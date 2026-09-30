export type ConsultationMode = 'Face-to-Face' | 'Online';

export type BookedRange = {
  bookingId: string;
  startMinuteOffset: number; // minutes after slot start
  durationMinutes: number;
  studentName: string;
};

export type ScheduleSlot = {
  id: string;
  time: string; // display label, e.g. "8:00 AM - 10:00 AM"
  startLabel: string; // e.g. "8:00 AM" — needed to compute real clock times
  mode: ConsultationMode;
  location: string;
  totalMinutes: number;
  bookings: BookedRange[]; // replaces the old flat `bookedMinutes` number
};

export type WeekDay = {
  day: string;
  date: number;
  dateKey: string; // real 'YYYY-MM-DD', used to query Supabase
  fullLabel: string;
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Builds the real current week (Sun–Sat containing today) instead of a
// fixed fake week, so booking a "Wed" actually means the real Wednesday.
function generateCurrentWeek(): WeekDay[] {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(today.getDate() - today.getDay());

  const days: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    days.push({
      day: DAY_NAMES[d.getDay()],
      date: d.getDate(),
      dateKey: `${y}-${m}-${dd}`,
      fullLabel: d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    });
  }
  return days;
}

export const WEEK_DAYS: WeekDay[] = generateCurrentWeek();

export type DurationOption = { label: string; minutes: number };

export const DURATION_OPTIONS: DurationOption[] = [
  { label: '15 mins', minutes: 15 },
  { label: '30 mins', minutes: 30 },
  { label: '45 mins', minutes: 45 },
  { label: '1 hour', minutes: 60 },
];

export const SMALLEST_DURATION_MINUTES = Math.min(
  ...DURATION_OPTIONS.map((d) => d.minutes)
);

function getBookedMinutesTotal(slot: ScheduleSlot): number {
  return slot.bookings.reduce((sum, b) => sum + b.durationMinutes, 0);
}

export function getRemainingMinutes(slot: ScheduleSlot): number {
  return Math.max(slot.totalMinutes - getBookedMinutesTotal(slot), 0);
}

// Longest single free stretch in the slot. After a cancellation in the middle
// of a slot, 30 free minutes can be two separate 15-minute gaps — the total
// says a 30-minute booking fits but findNextAvailableOffset can't place it.
export function getLargestFreeChunk(slot: ScheduleSlot): number {
  const sorted = [...slot.bookings].sort((a, b) => a.startMinuteOffset - b.startMinuteOffset);
  let cursor = 0;
  let best = 0;
  for (const booking of sorted) {
    best = Math.max(best, booking.startMinuteOffset - cursor);
    cursor = Math.max(cursor, booking.startMinuteOffset + booking.durationMinutes);
  }
  return Math.max(best, slot.totalMinutes - cursor, 0);
}

export function isSlotFull(slot: ScheduleSlot): boolean {
  return getLargestFreeChunk(slot) < SMALLEST_DURATION_MINUTES;
}

export function getFittingDurationOptions(slot: ScheduleSlot): DurationOption[] {
  const largest = getLargestFreeChunk(slot);
  return DURATION_OPTIONS.filter((d) => d.minutes <= largest);
}

// Finds the next open chunk of `minutes` length within the slot, in order.
// Returns the minute-offset from slot start where the booking should begin,
// or null if nothing large enough is free.
export function findNextAvailableOffset(slot: ScheduleSlot, minutes: number): number | null {
  const sorted = [...slot.bookings].sort((a, b) => a.startMinuteOffset - b.startMinuteOffset);
  let cursor = 0;
  for (const booking of sorted) {
    if (booking.startMinuteOffset - cursor >= minutes) {
      return cursor;
    }
    cursor = Math.max(cursor, booking.startMinuteOffset + booking.durationMinutes);
  }
  if (slot.totalMinutes - cursor >= minutes) {
    return cursor;
  }
  return null;
}

// Converts a minute-offset into an actual clock-time label, given the slot's start label.
// Assumes startLabel is like "8:00 AM" / "1:30 PM".
export function offsetToClockLabel(startLabel: string, offsetMinutes: number): string {
  const match = startLabel.match(/(\d+):(\d+)\s?(AM|PM)/i);
  if (!match) return startLabel;
  let [, hourStr, minuteStr, period] = match;
  let hour = parseInt(hourStr, 10) % 12;
  if (period.toUpperCase() === 'PM') hour += 12;
  let totalMinutes = hour * 60 + parseInt(minuteStr, 10) + offsetMinutes;
  totalMinutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  let outHour24 = Math.floor(totalMinutes / 60);
  const outMinute = totalMinutes % 60;
  const outPeriod = outHour24 >= 12 ? 'PM' : 'AM';
  let outHour12 = outHour24 % 12;
  if (outHour12 === 0) outHour12 = 12;
  return `${outHour12}:${outMinute.toString().padStart(2, '0')} ${outPeriod}`;
}

export function getBookedTimeRangeLabel(
  slot: ScheduleSlot,
  startOffset: number,
  durationMinutes: number
): string {
  const start = offsetToClockLabel(slot.startLabel, startOffset);
  const end = offsetToClockLabel(slot.startLabel, startOffset + durationMinutes);
  return `${start} - ${end}`;
}

export function bookMinutes(
  scheduleByDate: Record<number, ScheduleSlot[]>,
  date: number,
  slotId: string,
  minutes: number,
  studentName: string
): { scheduleByDate: Record<number, ScheduleSlot[]>; startOffset: number | null } {
  const slot = (scheduleByDate[date] ?? []).find((s) => s.id === slotId);
  if (!slot) return { scheduleByDate, startOffset: null };

  const startOffset = findNextAvailableOffset(slot, minutes);
  if (startOffset === null) return { scheduleByDate, startOffset: null };

  const newBooking: BookedRange = {
    bookingId: `${slotId}-${Date.now()}`,
    startMinuteOffset: startOffset,
    durationMinutes: minutes,
    studentName,
  };

  const updated = {
    ...scheduleByDate,
    [date]: (scheduleByDate[date] ?? []).map((s) =>
      s.id === slotId ? { ...s, bookings: [...s.bookings, newBooking] } : s
    ),
  };

  return { scheduleByDate: updated, startOffset };
}

export function releaseMinutes(
  scheduleByDate: Record<number, ScheduleSlot[]>,
  date: number,
  slotId: string,
  bookingId: string
): Record<number, ScheduleSlot[]> {
  return {
    ...scheduleByDate,
    [date]: (scheduleByDate[date] ?? []).map((slot) =>
      slot.id === slotId
        ? { ...slot, bookings: slot.bookings.filter((b) => b.bookingId !== bookingId) }
        : slot
    ),
  };
}

export const INITIAL_SCHEDULE_BY_DATE: Record<number, ScheduleSlot[]> = {};