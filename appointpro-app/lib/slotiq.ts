import { supabase } from './supabase';

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

// One class the faculty typed in, e.g. Monday 07:00:00 - 09:00:00.
// These are the times they are BUSY teaching, not their free time.
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
  maxSlotsPerDay: number;
  classSchedule: ClassScheduleBlock[];
  // Days the faculty accepts consultations (0 = Sunday ... 6 = Saturday).
  availableDays: number[];
  // Daily window consultations may be held in, 24-hour HH:MM:SS.
  windowStart: string;
  windowEnd: string;
};

// ---------------------------------------------------------------------------
// Parsing the class times the faculty types for each day
// Accepts things like: "7-9am, 3-4pm or 7-8pm", "9am-12pm", "1:30-3pm",
// "13:00-15:00". Separators: comma, "or", "and", ";", "/", "&".
// ---------------------------------------------------------------------------
export type ParsedRange = { startTime: string; endTime: string };
export type ParsedDay = { ranges: ParsedRange[]; error: string | null };

type Meridiem = 'am' | 'pm';
type RawTime = { hour: number; minute: number; meridiem: Meridiem | null };

const TIME_PATTERN = /^(\d{1,2})(?::(\d{2}))?\s*(?:(a|p)\.?(?:m\.?)?)?$/i;

function parseRawTime(text: string): RawTime | null {
  const match = text.trim().match(TIME_PATTERN);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem: Meridiem | null = match[3] ? (match[3].toLowerCase() === 'a' ? 'am' : 'pm') : null;
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
  } else if (hour > 23) {
    return null;
  }
  return { hour, minute, meridiem };
}

function toMinutes(time: RawTime, meridiem: Meridiem | null): number {
  // Hours written as 0 or 13+ are already 24-hour times.
  if (!meridiem || time.hour === 0 || time.hour > 12) return time.hour * 60 + time.minute;
  const base = time.hour % 12;
  return (meridiem === 'pm' ? base + 12 : base) * 60 + time.minute;
}

function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const m = (totalMinutes % 60).toString().padStart(2, '0');
  return `${h}:${m}:00`;
}

function parseRange(chunk: string): { range?: ParsedRange; error?: string } {
  const formatError = `Couldn't read "${chunk}". Use a format like 7-9am or 3:30-5pm.`;
  const parts = chunk
    .split(/\s*(?:-|–|—|\bto\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length !== 2) return { error: formatError };

  const a = parseRawTime(parts[0]);
  const b = parseRawTime(parts[1]);
  if (!a || !b) return { error: formatError };

  const flip = (m: Meridiem): Meridiem => (m === 'am' ? 'pm' : 'am');
  let start: number;
  let end: number;

  if (!a.meridiem && !b.meridiem) {
    const is24Hour = a.hour === 0 || b.hour === 0 || a.hour > 12 || b.hour > 12;
    if (!is24Hour) return { error: `Add AM or PM to "${chunk}" (for example 7-9am).` };
    start = toMinutes(a, null);
    end = toMinutes(b, null);
  } else if (a.meridiem && b.meridiem) {
    start = toMinutes(a, a.meridiem);
    end = toMinutes(b, b.meridiem);
  } else if (b.meridiem) {
    // "7-9am": the start borrows AM/PM from the end. "11-1pm" flips to 11am.
    start = toMinutes(a, b.meridiem);
    end = toMinutes(b, b.meridiem);
    if (start >= end) start = toMinutes(a, flip(b.meridiem));
  } else {
    // "9am-12": the end borrows AM/PM from the start, flipping if needed.
    const startMer = a.meridiem as Meridiem;
    start = toMinutes(a, startMer);
    end = toMinutes(b, startMer);
    if (end <= start) end = toMinutes(b, flip(startMer));
  }

  if (end <= start) return { error: `In "${chunk}" the end time must be after the start time.` };
  if (end >= 24 * 60) return { error: `"${chunk}" must end before midnight.` };

  return { range: { startTime: minutesToTime(start), endTime: minutesToTime(end) } };
}

export function parseDayInput(input: string): ParsedDay {
  const trimmed = input.trim();
  if (!trimmed || /^(none|no|off|n\/a|na|x|-)$/i.test(trimmed)) return { ranges: [], error: null };

  const chunks = trimmed
    .split(/\s*(?:,|;|\/|&|\band\b|\bor\b)\s*/i)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const ranges: ParsedRange[] = [];
  for (const chunk of chunks) {
    const parsed = parseRange(chunk);
    if (parsed.error) return { ranges: [], error: parsed.error };
    if (parsed.range) ranges.push(parsed.range);
  }

  ranges.sort((x, y) => x.startTime.localeCompare(y.startTime));
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].startTime < ranges[i - 1].endTime) {
      return { ranges: [], error: 'Some of these times overlap. Check them and try again.' };
    }
  }

  return { ranges, error: null };
}

// One input box holds exactly one time range, e.g. "7-9am". Empty = nothing entered.
export function parseTimeBox(input: string): { range: ParsedRange | null; error: string | null } {
  const text = input.trim();
  if (!text) return { range: null, error: null };
  const parsed = parseRange(text);
  if (parsed.error || !parsed.range) {
    return { range: null, error: parsed.error ?? `Couldn't read \"${text}\". Use a format like 7-9am.` };
  }
  return { range: parsed.range, error: null };
}

// Checks the boxes of one day against each other.
export function findOverlapError(ranges: ParsedRange[]): string | null {
  const sorted = [...ranges].sort((x, y) => x.startTime.localeCompare(y.startTime));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startTime < sorted[i - 1].endTime) {
      return 'Some of these times overlap. Check them and try again.';
    }
  }
  return null;
}

// The daily consultation window, e.g. "8am-5pm". Must be exactly one range.
export function parseWindowInput(input: string): { range: ParsedRange | null; error: string | null } {
  const parsed = parseDayInput(input);
  if (parsed.error) return { range: null, error: parsed.error };
  if (parsed.ranges.length !== 1) {
    return { range: null, error: 'Enter one time window, for example 8am-5pm.' };
  }
  return { range: parsed.ranges[0], error: null };
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// Free time on one day = the consultation window minus that day's classes.
// The server repeats this calculation; this copy is for the on-screen preview.
export function computeFreeBlocks(windowRange: ParsedRange, classes: ParsedRange[]): ParsedRange[] {
  const winStart = timeToMinutes(windowRange.startTime);
  const winEnd = timeToMinutes(windowRange.endTime);
  const sorted = [...classes].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const free: ParsedRange[] = [];
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

export function rangeLengthMinutes(range: ParsedRange): number {
  const [sh, sm] = range.startTime.split(':').map(Number);
  const [eh, em] = range.endTime.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

// ---------------------------------------------------------------------------
// Calling the edge function
// ---------------------------------------------------------------------------
async function readFunctionError(error: any): Promise<string> {
  // For non-2xx responses, supabase-js puts the raw Response in error.context.
  try {
    const response = error?.context;
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
  return error?.message || 'SlotIQ could not generate a schedule.';
}

export async function generateSlotIQSchedule(options: SlotIQOptions): Promise<SlotIQResult> {
  const { data, error } = await supabase.functions.invoke('slotiq-generate', {
    body: options,
  });

  if (error) {
    throw new Error(await readFunctionError(error));
  }

  if (!data?.suggestions || !Array.isArray(data.suggestions)) {
    throw new Error('SlotIQ returned an invalid schedule.');
  }

  return data as SlotIQResult;
}