import { supabase } from './supabase';

// Same shapes as the mobile app (appointpro-app/lib/slotiq.ts) so the
// `slotiq-generate` edge function receives exactly what it expects.
export type SlotIQSuggestion = {
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  mode: 'Face-to-Face' | 'Online';
  location: string;
  reason: string;
};

export type SlotIQResult = {
  summary: string;
  suggestions: SlotIQSuggestion[];
};

// One class the faculty is BUSY teaching, e.g. Monday 07:00:00 - 09:00:00.
export type ClassScheduleBlock = {
  dayOfWeek: number; // 0 = Sunday ... 6 = Saturday
  startTime: string; // 24-hour HH:MM:SS
  endTime: string; // 24-hour HH:MM:SS
};

export type SlotIQOptions = {
  semesterEndDate: string;
  consultationDurationMinutes: number;
  preferredMode: 'Face-to-Face' | 'Online';
  preferredLocation: string;
  minSlotsPerDay: number;
  maxSlotsPerDay: number;
  classSchedule: ClassScheduleBlock[];
  availableDays: number[];
  windowStart: string;
  windowEnd: string;
};

export type TimeRange = { startTime: string; endTime: string };

// ---------------------------------------------------------------------------
// Time helpers. Web <input type="time"> gives "HH:MM"; the database and the
// edge function use "HH:MM:SS".
// ---------------------------------------------------------------------------
export function toFullTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const m = (totalMinutes % 60).toString().padStart(2, '0');
  return `${h}:${m}:00`;
}

export function rangeLengthMinutes(range: TimeRange): number {
  return timeToMinutes(range.endTime) - timeToMinutes(range.startTime);
}

// "13:30:00" -> "1:30 PM"
export function formatTime12(time: string): string {
  const [hText, mText] = time.split(':');
  const h = Number(hText);
  return `${h % 12 || 12}:${mText} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Checks one day's class times against each other. Returns an error message or null.
export function findOverlapError(ranges: TimeRange[]): string | null {
  const sorted = [...ranges].sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startTime < sorted[i - 1].endTime) {
      return 'Some of these class times overlap.';
    }
  }
  return null;
}

// Free time on one day = the consultation window minus that day's classes.
// The server repeats this calculation; this copy only powers the quick
// "no free time" check and the on-screen preview.
export function computeFreeBlocks(windowRange: TimeRange, classes: TimeRange[]): TimeRange[] {
  const winStart = timeToMinutes(windowRange.startTime);
  const winEnd = timeToMinutes(windowRange.endTime);
  const sorted = [...classes].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const free: TimeRange[] = [];
  let cursor = winStart;
  for (const block of sorted) {
    const start = timeToMinutes(block.startTime);
    const end = timeToMinutes(block.endTime);
    if (end <= cursor) continue;
    if (start >= winEnd) break;
    if (start > cursor) free.push({ startTime: minutesToTime(cursor), endTime: minutesToTime(start) });
    cursor = Math.max(cursor, end);
    if (cursor >= winEnd) break;
  }
  if (cursor < winEnd) free.push({ startTime: minutesToTime(cursor), endTime: minutesToTime(winEnd) });
  return free;
}

// ---------------------------------------------------------------------------
// Calling the edge function
// ---------------------------------------------------------------------------
async function readFunctionError(error: unknown): Promise<string> {
  // For non-2xx responses, supabase-js puts the raw Response in error.context.
  try {
    const response = (error as { context?: Response })?.context;
    if (response && typeof response.text === 'function') {
      const raw = await response.text();
      try {
        const parsed = JSON.parse(raw);
        const message = parsed?.error || parsed?.message;
        if (message) return `${message} (status ${response.status})`;
      } catch {
        // Not JSON: fall through and show the raw text.
      }
      if (raw) return `${raw} (status ${response.status})`;
    }
  } catch {
    // Ignore and use the generic message below.
  }
  return (error as { message?: string })?.message || 'SlotIQ could not generate a schedule.';
}

export async function generateSlotIQSchedule(options: SlotIQOptions): Promise<SlotIQResult> {
  const { data, error } = await supabase.functions.invoke('slotiq-generate', {
    body: options,
  });
  if (error) throw new Error(await readFunctionError(error));
  if (!data?.suggestions || !Array.isArray(data.suggestions)) {
    throw new Error('SlotIQ returned an invalid schedule.');
  }
  return data as SlotIQResult;
}

// ---------------------------------------------------------------------------
// Saving approved suggestions: one recurring rule + its daily availability
// slots per suggestion (same writes the mobile app does), skipping any date
// that already has an overlapping slot.
// ---------------------------------------------------------------------------
export async function saveSlotIQSuggestions(
  facultyId: string,
  suggestions: SlotIQSuggestion[],
  semesterEndDate: string,
): Promise<{ saved: number; skippedSlots: number }> {
  const startDateKey = toDateKey(new Date());

  const unique = new Map<string, SlotIQSuggestion>();
  suggestions.forEach((s) => {
    const days = [...new Set(s.daysOfWeek)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
    const startTime = toFullTime(s.startTime);
    const endTime = toFullTime(s.endTime);
    const key = `${days.join(',')}-${startTime}-${endTime}-${s.mode}-${s.location}`;
    if (days.length && startTime < endTime) {
      unique.set(key, { ...s, daysOfWeek: days, startTime, endTime });
    }
  });
  if (!unique.size) throw new Error('SlotIQ did not return any valid schedule suggestions.');

  // Existing slots for the semester, so we never insert a duplicate/overlap.
  const { data: existingRows, error: existingError } = await supabase
    .from('availability_slots')
    .select('date,start_time,end_time')
    .eq('faculty_id', facultyId)
    .gte('date', startDateKey)
    .lte('date', semesterEndDate);
  if (existingError) throw new Error(existingError.message);

  const occupied = new Map<string, TimeRange[]>();
  ((existingRows ?? []) as { date: string; start_time: string; end_time: string }[]).forEach((row) => {
    occupied.set(row.date, [
      ...(occupied.get(row.date) ?? []),
      { startTime: toFullTime(row.start_time), endTime: toFullTime(row.end_time) },
    ]);
  });

  let saved = 0;
  let skippedSlots = 0;

  for (const s of unique.values()) {
    const freeDates: string[] = [];
    const cursor = new Date(`${startDateKey}T00:00:00`);
    const end = new Date(`${semesterEndDate}T00:00:00`);
    let safety = 0;
    while (cursor <= end && safety < 400) {
      safety++;
      if (s.daysOfWeek.includes(cursor.getDay())) {
        const dateKey = toDateKey(cursor);
        const clashes = (occupied.get(dateKey) ?? []).some(
          (r) => r.startTime < s.endTime && s.startTime < r.endTime,
        );
        if (clashes) skippedSlots++;
        else freeDates.push(dateKey);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (!freeDates.length) continue;

    const { data: rule, error: ruleError } = await supabase
      .from('recurring_rules')
      .insert({
        faculty_id: facultyId,
        days_of_week: s.daysOfWeek,
        start_time: s.startTime,
        end_time: s.endTime,
        mode: s.mode,
        location: s.location,
        start_date: startDateKey,
        end_date: semesterEndDate,
      })
      .select()
      .single();
    if (ruleError || !rule) throw new Error(ruleError?.message ?? 'Could not save a SlotIQ schedule.');

    const totalMinutes = timeToMinutes(s.endTime) - timeToMinutes(s.startTime);
    const { error: slotsError } = await supabase.from('availability_slots').insert(
      freeDates.map((dateKey) => ({
        faculty_id: facultyId,
        rule_id: rule.id,
        date: dateKey,
        start_time: s.startTime,
        end_time: s.endTime,
        mode: s.mode,
        location: s.location,
        total_minutes: totalMinutes,
        enabled: true,
      })),
    );
    if (slotsError) {
      // Don't leave a rule behind that has no slots.
      await supabase.from('recurring_rules').delete().eq('id', rule.id);
      throw new Error(`Could not create the schedule slots: ${slotsError.message}`);
    }

    // Later suggestions in this batch must not overlap these.
    freeDates.forEach((dateKey) => {
      occupied.set(dateKey, [...(occupied.get(dateKey) ?? []), { startTime: s.startTime, endTime: s.endTime }]);
    });
    saved++;
  }

  return { saved, skippedSlots };
}