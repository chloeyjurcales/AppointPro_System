export type QueueEntry = {
  id: string;
  studentName: string;
  studentAvatarUrl?: string;
  // How long this student's appointment is reserved for.
  durationMinutes: number;
  // Epoch ms when this entry became "now serving" (reached the front of
  // the queue). Null until that happens — used to count down their
  // remaining time live instead of just showing a static estimate.
  startedAt: number | null;
  // The real appointments.id this entry is tied to — used to match a
  // queue row back to "is this me?" for the logged-in student.
  appointmentId: string | null;
  // The linked appointment's actual scheduled start/end time ('HH:MM:SS',
  // 24h) — pulled straight from the `appointments` row so the queue can
  // be ordered and displayed by real appointment time instead of by
  // whatever order entries happened to be inserted in.
  scheduledDateKey: string | null;
  scheduledStartTime24: string | null;
  scheduledEndTime24: string | null;
};

function timeToMinutes(time24: string | null | undefined): number | null {
  if (!time24) return null;
  const parts = time24.split(':').map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1];
}

// Appointment timestamps are stored as date/time values without a timezone.
// AppointPro treats those values as Philippine Standard Time (Asia/Manila, UTC+8)
// so start/end comparisons are identical on every device.
export function getPhilippineDateKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
}

export function getAppointmentStartDate(dateKey: string, startTime24: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute, second = 0] = startTime24.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second, 0));
}

export function hasAppointmentStartedAt(dateKey: string | null | undefined, startTime24: string | null | undefined, now: Date): boolean {
  if (!dateKey || !startTime24) return false;
  return now.getTime() >= getAppointmentStartDate(dateKey, startTime24).getTime();
}

export function getAppointmentEndDate(dateKey: string, endTime24: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute, second = 0] = endTime24.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second, 0));
}

// The queue opens exactly one hour before the booked consultation starts.
// AppointPro treats appointment date/time values as Philippine Standard Time.
export function getQueueWindowStartDate(dateKey: string, startTime24: string): Date {
  return new Date(getAppointmentStartDate(dateKey, startTime24).getTime() - 60 * 60 * 1000);
}

export function isQueueWindowActive(
  dateKey: string | null | undefined,
  startTime24: string | null | undefined,
  endTime24: string | null | undefined,
  now: Date
): boolean {
  if (!dateKey || !startTime24 || !endTime24) return false;
  const start = getAppointmentStartDate(dateKey, startTime24).getTime();
  const queueOpen = start - 60 * 60 * 1000;
  const end = getAppointmentEndDate(dateKey, endTime24).getTime();
  return now.getTime() >= queueOpen && now.getTime() <= end;
}

export function getSecondsUntilQueueWindowStart(
  dateKey: string | null | undefined,
  startTime24: string | null | undefined,
  now: Date
): number {
  if (!dateKey || !startTime24) return 0;
  return Math.max(0, Math.floor((getQueueWindowStartDate(dateKey, startTime24).getTime() - now.getTime()) / 1000));
}

export function getSecondsUntilAppointment(dateKey: string | null | undefined, startTime24: string | null | undefined, now: Date): number {
  if (!dateKey || !startTime24) return 0;
  return Math.max(0, Math.floor((getAppointmentStartDate(dateKey, startTime24).getTime() - now.getTime()) / 1000));
}

// Shape of a row from the real `queue_entries` table in Supabase, joined
// with its linked `appointments` row so we know that student's actual
// scheduled start/end time (not just their reserved duration).
export type DbQueueEntry = {
  id: string;
  faculty_id: string;
  appointment_id: string | null;
  student_name: string;
  duration_minutes: number;
  started_at: string | null;
  queue_date: string;
  position: number;
  created_at: string;
  appointments:
    | { date: string; start_time: string; end_time: string; status?: string; students?: { profiles?: { avatar_url?: string | null } | { avatar_url?: string | null }[] | null } | { profiles?: { avatar_url?: string | null } | { avatar_url?: string | null }[] | null }[] | null }
    | { date: string; start_time: string; end_time: string; status?: string; students?: { profiles?: { avatar_url?: string | null } | { avatar_url?: string | null }[] | null } | { profiles?: { avatar_url?: string | null } | { avatar_url?: string | null }[] | null }[] | null }[]
    | null;

};

export function mapDbQueueEntry(row: DbQueueEntry): QueueEntry {
  const appointment = Array.isArray(row.appointments)
    ? row.appointments[0]
    : row.appointments;

  return {
    id: row.id,
    studentName: row.student_name,
    studentAvatarUrl: (() => { const students = appointment?.students; const student = Array.isArray(students) ? students[0] : students; const p = Array.isArray(student?.profiles) ? student?.profiles[0] : student?.profiles; return p?.avatar_url ?? undefined; })(),
    durationMinutes: row.duration_minutes,
    startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
    appointmentId: row.appointment_id,
    scheduledDateKey: appointment?.date ?? null,
    scheduledStartTime24: appointment?.start_time ?? null,
    scheduledEndTime24: appointment?.end_time ?? null,
  };
}

// Orders queue entries by each one's actual scheduled appointment start
// time — so whoever is booked earliest in the day is first in line,
// regardless of the order entries happened to be inserted in (join
// order, walk-in timing, etc) — with two important exceptions:
//
// 1. An entry that's already being served (`startedAt` set) always stays
//    ahead of one that hasn't started yet, even if the other has an
//    earlier scheduled time. Otherwise a student who joins the queue
//    late for an earlier slot could bump whoever is mid-session right
//    now out of the #1 spot — which would make the app try to "start"
//    them too, and make faculty's "Done" button remove the wrong person.
// 2. We only reorder a pair when we actually know BOTH of their real
//    appointment times. Row-level security typically only lets a
//    student read their OWN appointment, so when a student loads the
//    queue for a faculty they're browsing, every other entry's
//    scheduledStartTime24 comes back null — in that case we leave those
//    entries in their original order instead of shoving them to the
//    back.
export function sortQueueByScheduledTime(queue: QueueEntry[]): QueueEntry[] {
  return [...queue].sort((a, b) => {
    const aStarted = a.startedAt !== null;
    const bStarted = b.startedAt !== null;
    if (aStarted !== bStarted) return aStarted ? -1 : 1;
    if (aStarted && bStarted) return (a.startedAt as number) - (b.startedAt as number);

    if (!a.scheduledStartTime24 || !b.scheduledStartTime24) return 0;
    return a.scheduledStartTime24.localeCompare(b.scheduledStartTime24);
  });
}

// Formats a 'HH:MM:SS' (24h) time as '10:00 AM' style 12h text.
export function formatQueueTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  let hour = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute.toString().padStart(2, '0')} ${period}`;
}

// The real "10:00 AM – 10:30 AM" label for an entry's actual scheduled
// appointment window, or null if it has no linked appointment on record.
export function getScheduledTimeRangeLabel(entry: QueueEntry): string | null {
  if (!entry.scheduledStartTime24 || !entry.scheduledEndTime24) return null;
  return `${formatQueueTime12h(entry.scheduledStartTime24)} – ${formatQueueTime12h(
    entry.scheduledEndTime24
  )}`;
}

// Seconds left in the current consultation. Before the realtime started_at
// write arrives, the scheduled end time remains authoritative so the timer
// can transition cleanly from "Starts in" to the consultation countdown.
export function getRemainingSeconds(entry: QueueEntry, now: Date): number {
  // Before the faculty stamps started_at, use the appointment's exact
  // scheduled end time. This keeps the countdown tied to the booked
  // Philippine time even if the realtime update arrives a moment later.
  if (!entry.startedAt) {
    if (entry.scheduledDateKey && entry.scheduledEndTime24) {
      const [year, month, day] = entry.scheduledDateKey.split('-').map(Number);
      const [hour, minute, second = 0] = entry.scheduledEndTime24.split(':').map(Number);
      const end = new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second, 0));
      return Math.max(Math.floor((end.getTime() - now.getTime()) / 1000), 0);
    }
    return entry.durationMinutes * 60;
  }
  const elapsedSeconds = Math.floor((now.getTime() - entry.startedAt) / 1000);
  return Math.max(entry.durationMinutes * 60 - elapsedSeconds, 0);
}

export function formatCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
// Minutes after the scheduled start before a missing student can be skipped.
export const NO_SHOW_GRACE_MINUTES = 15;

// Seconds until faculty may skip this entry as a no-show (0 = allowed now).
export function getSkipUnlockSeconds(entry: QueueEntry, now: Date): number {
  if (!entry.scheduledDateKey || !entry.scheduledStartTime24) return 0;
  const unlockAt =
    getAppointmentStartDate(entry.scheduledDateKey, entry.scheduledStartTime24).getTime() +
    NO_SHOW_GRACE_MINUTES * 60 * 1000;
  return Math.max(0, Math.ceil((unlockAt - now.getTime()) / 1000));
}