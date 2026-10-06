import type { ClassBlock } from './classSchedule';

// ---------------------------------------------------------------------------
// Student booking conflicts: does a faculty slot overlap one of the student's
// recurring classes? Every time is converted to total minutes from midnight
// before comparing, so "9:00 AM", "09:00" and "21:00:00" all work the same.
// ---------------------------------------------------------------------------

/** A faculty slot (or proposed appointment) the student is about to book. */
export type BookableSlot = {
  /** 0 = Sunday ... 6 = Saturday (same numbering as ClassBlock.dayOfWeek). */
  dayOfWeek: number;
  /** "9:00 AM", "09:00" or "09:00:00". */
  startTime: string;
  /** "10:30 AM", "10:30" or "10:30:00". */
  endTime: string;
};

/**
 * Converts a 12-hour ("9:30 AM", "12:00 pm") or 24-hour ("13:05", "13:05:00")
 * clock string to total minutes from midnight. Returns NaN if unreadable.
 */
export function parseTimeToMinutes(time: string): number {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return NaN;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (minutes > 59) return NaN;
  if (period) {
    if (hours < 1 || hours > 12) return NaN;
    hours = (hours % 12) + (period === 'PM' ? 12 : 0); // 12 AM -> 0, 12 PM -> 12
  } else if (hours > 23) {
    return NaN;
  }
  return hours * 60 + minutes;
}

/**
 * Returns the first class that overlaps the slot, or null when the slot is clear.
 *
 * Overlap rule: (slot start < class end) AND (slot end > class start), on the same
 * day. Times that only touch do not overlap, so a class ending at 10:00 and a slot
 * starting at 10:00 is fine.
 */
export function findStudentBookingConflict(studentClasses: ClassBlock[], slot: BookableSlot): ClassBlock | null {
  const slotStart = parseTimeToMinutes(slot.startTime);
  const slotEnd = parseTimeToMinutes(slot.endTime);
  if (Number.isNaN(slotStart) || Number.isNaN(slotEnd)) return null;

  const sameDay = studentClasses
    .filter((block) => block.dayOfWeek === slot.dayOfWeek)
    .sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));

  return (
    sameDay.find((block) => {
      const classStart = parseTimeToMinutes(block.startTime);
      const classEnd = parseTimeToMinutes(block.endTime);
      if (Number.isNaN(classStart) || Number.isNaN(classEnd)) return false;
      return slotStart < classEnd && slotEnd > classStart;
    }) ?? null
  );
}

/** True when the slot overlaps any of the student's recurring classes. */
export function hasStudentBookingConflict(studentClasses: ClassBlock[], slot: BookableSlot): boolean {
  return findStudentBookingConflict(studentClasses, slot) !== null;
}

/** Total minutes from midnight -> "HH:MM" (24-hour). */
export function minutesToClock(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Builds a BookableSlot from a faculty slot's start label ("8:00 AM") and length in
 * minutes. Returns null if the start label can't be read.
 */
export function toBookableSlot(dayOfWeek: number, startLabel: string, totalMinutes: number): BookableSlot | null {
  const start = parseTimeToMinutes(startLabel);
  if (Number.isNaN(start)) return null;
  return { dayOfWeek, startTime: minutesToClock(start), endTime: minutesToClock(start + totalMinutes) };
}