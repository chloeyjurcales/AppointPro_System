import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Student weekly class schedule: types, time helpers, the conflict checker used
// when faculty reschedule an appointment, and the Supabase load/save helpers.
// Times are 24-hour "HH:MM" strings; days use JavaScript numbering (0 = Sunday).
// ---------------------------------------------------------------------------

export type ClassBlock = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subject: string;
};

export type NewClassBlock = Omit<ClassBlock, 'id'>;

/** A proposed appointment time: one day of the week plus a start and end time. */
export type ProposedSlot = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Week shown Monday -> Sunday.
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const shortDayName = (day: number): string => DAY_NAMES[day].slice(0, 3);

// ---- time helpers ----------------------------------------------------------

/** "08:30" or "08:30:00" -> minutes after midnight. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** "08:30:00" -> "08:30" */
export function normalizeTime(time: string): string {
  const [h, m] = time.split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

/** "13:05" -> "1:05 PM" */
export function formatTime12(time: string): string {
  const [hText, mText] = time.split(':');
  const h = Number(hText);
  return `${h % 12 || 12}:${mText} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Hour (1-12), minute ("00"-"59") and "AM"/"PM" -> "HH:MM". */
export function to24h(hour: string, minute: string, period: string): string {
  let h = Number(hour) % 12;
  if (period.toUpperCase() === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

/** "9:30 AM" -> "09:30" */
export function clockLabelTo24h(label: string): string {
  const match = label.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return '00:00';
  return to24h(match[1], match[2], match[3]);
}

/** "2026-05-13" -> 3 (Wednesday) */
export function dayOfWeekFromDateKey(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00`).getDay();
}

// ---- conflict detection ----------------------------------------------------

/**
 * Returns the first class that overlaps the proposed slot, or null when the slot is clear.
 * Only classes on the same day count, and times that merely touch (a class ends at
 * 10:00, the slot starts at 10:00) are NOT an overlap.
 */
export function findScheduleConflict(studentSchedule: ClassBlock[], proposedSlot: ProposedSlot): ClassBlock | null {
  const start = toMinutes(proposedSlot.startTime);
  const end = toMinutes(proposedSlot.endTime);
  const sorted = [...studentSchedule].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  return (
    sorted.find(
      (block) =>
        block.dayOfWeek === proposedSlot.dayOfWeek && start < toMinutes(block.endTime) && toMinutes(block.startTime) < end,
    ) ?? null
  );
}

/** True when the proposed slot overlaps any of the student's class blocks. */
export function hasScheduleConflict(studentSchedule: ClassBlock[], proposedSlot: ProposedSlot): boolean {
  return findScheduleConflict(studentSchedule, proposedSlot) !== null;
}

/** The two-part message shown in the warning card (and in the save-time toast). */
export function describeConflict(block: ClassBlock): { title: string; body: string } {
  return {
    title: 'Conflict Detected',
    body: `The student has ${block.subject} on ${DAY_NAMES[block.dayOfWeek]} from ${formatTime12(block.startTime)} to ${formatTime12(block.endTime)}. Rescheduling to this time is unavailable.`,
  };
}

/** Class blocks sorted Monday -> Sunday, then by start time. */
export function sortClassBlocks<T extends { dayOfWeek: number; startTime: string }>(blocks: T[]): T[] {
  return [...blocks].sort(
    (a, b) =>
      DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek) || toMinutes(a.startTime) - toMinutes(b.startTime),
  );
}

// ---- Supabase --------------------------------------------------------------

type ClassRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject: string;
};

const mapRow = (row: ClassRow): ClassBlock => ({
  id: row.id,
  dayOfWeek: row.day_of_week,
  startTime: normalizeTime(row.start_time),
  endTime: normalizeTime(row.end_time),
  subject: row.subject,
});

/** Loads one student's weekly classes. `error` is set when they could not be loaded. */
export async function fetchStudentClassSchedule(
  studentId: string,
): Promise<{ classes: ClassBlock[]; error: string | null }> {
  const { data, error } = await supabase
    .from('student_class_schedule')
    .select('id, day_of_week, start_time, end_time, subject')
    .eq('student_id', studentId);
  if (error) return { classes: [], error: error.message };
  return { classes: sortClassBlocks(((data ?? []) as ClassRow[]).map(mapRow)), error: null };
}

/**
 * Replaces the student's saved classes and marks the setup as finished.
 * The new rows are written first and the old ones removed after, so a failed save
 * never leaves the student with no schedule. Returns an error message, or null on success.
 */
export async function saveStudentClassSchedule(studentId: string, classes: NewClassBlock[]): Promise<string | null> {
  const { data: oldRows, error: oldError } = await supabase
    .from('student_class_schedule')
    .select('id')
    .eq('student_id', studentId);
  if (oldError) return oldError.message;
  const oldIds = ((oldRows ?? []) as { id: string }[]).map((row) => row.id);

  if (classes.length > 0) {
    const { error: insertError } = await supabase.from('student_class_schedule').insert(
      classes.map((block) => ({
        student_id: studentId,
        day_of_week: block.dayOfWeek,
        start_time: block.startTime,
        end_time: block.endTime,
        subject: block.subject.trim(),
      })),
    );
    if (insertError) return insertError.message;
  }

  if (oldIds.length > 0) {
    const { error: deleteError } = await supabase.from('student_class_schedule').delete().in('id', oldIds);
    if (deleteError) return deleteError.message;
  }

  const { error: flagError } = await supabase
    .from('students')
    .update({ class_schedule_completed: true })
    .eq('profile_id', studentId);
  return flagError ? flagError.message : null;
}