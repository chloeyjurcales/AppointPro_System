import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { canceledMessage, formatWhen, rescheduledMessage } from '../lib/notificationMessages';
import './AppointmentsView.css';

type AppointmentStatus = 'Upcoming' | 'Completed' | 'Cancelled';

type MeetingMode = 'Face-to-Face' | 'Online';

type Appointment = {
  id: string;
  date: string;
  time: string;
  studentName: string;
  studentInfo: string;
  reason: string;
  status: AppointmentStatus;
  mode: MeetingMode;
  location: string;
  referenceNo: string;
  // The booking student's real `profiles.id` — needed to notify them
  // when this appointment is cancelled/rescheduled/completed.
  studentUserId: string | undefined;
  // Only approved appointments may join the live queue / get reminders.
  approved: boolean;
  // Real Date fields power the reminder/queue features below. `startsAt` is
  // this student's own turn start; `blockStart`/`blockEnd` describe the
  // underlying faculty schedule block the appointment falls in (e.g. a
  // "9:00–10:00 AM" slot several students can share).
  startsAt: Date;
  durationMinutes: number;
  blockStart: Date;
  blockEnd: Date;
};

type TabId = 'all' | 'upcoming' | 'completed' | 'cancelled';

type ModalState =
  | { type: 'none' }
  | { type: 'cancel'; appointment: Appointment }
  | { type: 'reschedule'; appointment: Appointment }
  | { type: 'details'; appointment: Appointment };

type QueueGroup = {
  blockKey: string;
  blockStart: Date;
  blockEnd: Date;
  entries: Appointment[];
};

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

// "2:30 PM" from a real Date, for the live-queue/reminder copy.
function formatClockTime(date: Date): string {
  let hour = date.getHours();
  const minute = date.getMinutes();
  const period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${pad2(minute)} ${period}`;
}

// ---------- Queue timing (mirrors the mobile app's data/queue.ts) ----------

// Fallback shown in the queue stats card — matches the mobile app's own
// constant, used purely as a general average, not derived from live data.
const AVERAGE_WAIT_MINUTES_PER_STUDENT = 10;

// "5:09" from a total seconds count, for a live mm:ss countdown.
function formatCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${pad2(seconds)}`;
}

// Seconds left in the current student's turn, counting down from the
// moment their turn actually started (which may be earlier than scheduled
// if the previous student finished early).
function getRemainingSeconds(
  turnStartedAt: Date,
  durationMinutes: number,
  now: Date,
): number {
  const elapsedSeconds = Math.floor(
    (now.getTime() - turnStartedAt.getTime()) / 1000,
  );
  return Math.max(durationMinutes * 60 - elapsedSeconds, 0);
}

// Total estimated wait, in seconds, before the student at `index` in the
// group gets called: whatever time is left on whoever's being served now,
// plus the full reserved duration of everyone else ahead of them.
function getEstimatedWaitSeconds(
  group: QueueGroup,
  index: number,
  currentRemainingSeconds: number,
): number {
  if (index <= 0) return 0;
  let total = currentRemainingSeconds;
  for (let i = 1; i < index; i += 1) {
    total += group.entries[i].durationMinutes * 60;
  }
  return total;
}

// Shape of an `appointments` row (joined with the booking student's own
// profile, and with the availability slot it was booked into, if any) as
// returned by Supabase.
type DbAppointment = {
  id: string;
  student_id: string;
  slot_id: string | null;
  date: string; // 'YYYY-MM-DD'
  start_time: string; // 'HH:MM:SS'
  end_time: string;
  duration_minutes: number;
  category: string | null;
  purpose: string | null;
  mode: MeetingMode;
  location: string;
  status: 'upcoming' | 'completed' | 'canceled';
  reference_no: string | null;
  faculty_approval_status: 'pending' | 'approved' | 'declined' | null;
  students: {
    student_id: string;
    department: string | null;
    year_level: string | null;
    profiles: { full_name: string } | { full_name: string }[] | null;
  } | null;
  // The parent slot's own time range, when this appointment was booked
  // into a shared slot — used to reconstruct the "Live Queue" block, since
  // several students can share one slot while each keeping their own
  // start_time/end_time turn within it.
  availability_slots:
    | { start_time: string; end_time: string }
    | { start_time: string; end_time: string }[]
    | null;
};

const STATUS_FROM_DB: Record<DbAppointment['status'], AppointmentStatus> = {
  upcoming: 'Upcoming',
  completed: 'Completed',
  canceled: 'Cancelled',
};

// "2:30 PM" from a "14:30:00" DB time string.
function formatDbTime(time24: string): string {
  const [hourStr, minuteStr] = time24.split(':');
  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${pad2(minute)} ${period}`;
}

function combineDbDateAndTime(dateKey: string, time24: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = time24.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function formatDbDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildStudentInfo(
  department: string | null | undefined,
  yearLevel: string | null | undefined,
  studentId: string | undefined,
): string {
  const parts = [department, yearLevel].filter(
    (part): part is string => !!part,
  );
  if (studentId) parts.push(`Student ID ${studentId}`);
  return parts.join(' · ');
}

function mapDbAppointment(row: DbAppointment): Appointment {
  const student = row.students;
  const profile = Array.isArray(student?.profiles)
    ? student?.profiles[0]
    : student?.profiles;
  const slot = Array.isArray(row.availability_slots)
    ? row.availability_slots[0]
    : row.availability_slots;

  const startsAt = combineDbDateAndTime(row.date, row.start_time);
  const durationMinutes = row.duration_minutes;
  const blockStart = slot
    ? combineDbDateAndTime(row.date, slot.start_time)
    : startsAt;
  const blockEnd = slot
    ? combineDbDateAndTime(row.date, slot.end_time)
    : addMinutes(startsAt, durationMinutes);

  return {
    id: row.id,
    referenceNo: row.reference_no ?? '',
    studentName: profile?.full_name ?? 'Unknown Student',
    studentInfo: buildStudentInfo(
      student?.department,
      student?.year_level,
      student?.student_id,
    ),
    reason: row.purpose ?? row.category ?? 'Consultation',
    status: STATUS_FROM_DB[row.status] ?? 'Upcoming',
    mode: row.mode,
    location: row.location,
    studentUserId: row.student_id,
    approved: (row.faculty_approval_status ?? 'approved') === 'approved',
    date: formatDbDateLabel(row.date),
    time: `${formatDbTime(row.start_time)} - ${formatDbTime(row.end_time)}`,
    startsAt,
    durationMinutes,
    blockStart,
    blockEnd,
  };
}

// Converts an <input type="date"> value ("2026-09-07") into the same
// display format the DB data uses ("Sep 7, 2026").
function formatDateLabel(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Converts an <input type="time"> value ("14:30") into "2:30 PM".
function formatTimeLabel(value: string): string {
  const [hourStr, minuteStr] = value.split(':');
  let hour = Number(hourStr);
  const minute = Number(minuteStr);
  const period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute.toString().padStart(2, '0')} ${period}`;
}

// Combines <input type="date"> + <input type="time"> values into a real
// Date, so a rescheduled appointment keeps working with the reminder and
// live-queue features below.
function combineDateAndTime(dateValue: string, timeValue: string): Date {
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

type AppointmentsViewProps = {
  session: Session;
  facultyName: string;
};

export default function AppointmentsView({
  session,
  facultyName,
}: AppointmentsViewProps) {
  const facultyId = session.user.id;
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // The faculty member's department, shown to students in notifications.
  const [facultyDepartment, setFacultyDepartment] = useState('');
  useEffect(() => {
    supabase
      .from('faculty')
      .select('department')
      .eq('profile_id', facultyId)
      .maybeSingle()
      .then(({ data }) => setFacultyDepartment((data as { department?: string } | null)?.department ?? ''));
  }, [facultyId]);

  // Loads this faculty member's real appointments (joined with the
  // booking student's profile and, when applicable, the shared slot they
  // booked into), then keeps them live via Realtime so a new booking or a
  // change made from the mobile app shows up without a refresh.
  useEffect(() => {
    let isMounted = true;

    const loadAppointments = () => {
      supabase
        .from('appointments')
        .select(
          `id, student_id, slot_id, date, start_time, end_time, duration_minutes,
           category, purpose, mode, location, status, reference_no, faculty_approval_status,
           students ( student_id, department, year_level, profiles ( full_name ) ),
           availability_slots ( start_time, end_time )`,
        )
        .eq('faculty_id', facultyId)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
        .then(({ data, error }) => {
          if (!isMounted) return;
          if (error) {
            console.log('Failed to load appointments:', error.message);
            return;
          }
          setAppointments(
            (data as unknown as DbAppointment[]).map(mapDbAppointment),
          );
        });
    };

    loadAppointments();

    const channel = supabase
      .channel(`av-appointments-${facultyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `faculty_id=eq.${facultyId}`,
        },
        () => loadAppointments(),
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [facultyId]);
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [modal, setModal] = useState<ModalState>({ type: 'none' });

  const [cancelReason, setCancelReason] = useState('');

  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStart, setRescheduleStart] = useState('');
  const [rescheduleEnd, setRescheduleEnd] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleMode, setRescheduleMode] = useState<MeetingMode>(
    'Face-to-Face',
  );
  const [rescheduleMeetingLink, setRescheduleMeetingLink] = useState('');
  const [rescheduleLocation, setRescheduleLocation] = useState('');

  // ---------- Reminders + live queue ----------
  // `now` ticks every 15s so "starts in 1 hour" / "starting now" reminders
  // and the live-queue block stay accurate without needing a page refresh.
  const [now, setNow] = useState(() => new Date());
  const [dismissedReminders, setDismissedReminders] = useState<Set<string>>(
    new Set(),
  );
  const [turnStartedAt, setTurnStartedAt] = useState<Record<string, Date>>({});
  const [queueNotice, setQueueNotice] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const queueGroups = useMemo<QueueGroup[]>(() => {
    const groups = new Map<string, QueueGroup>();

    appointments
      .filter((appt) => appt.status === 'Upcoming' && appt.approved)
      .forEach((appt) => {
        const key = `${appt.blockStart.getTime()}-${appt.blockEnd.getTime()}`;
        const existing = groups.get(key);
        if (existing) {
          existing.entries.push(appt);
        } else {
          groups.set(key, {
            blockKey: key,
            blockStart: appt.blockStart,
            blockEnd: appt.blockEnd,
            entries: [appt],
          });
        }
      });

    return Array.from(groups.values()).sort(
      (a, b) => a.blockStart.getTime() - b.blockStart.getTime(),
    );
  }, [appointments]);

  const liveGroups = useMemo(
    () => queueGroups.filter((g) => now >= g.blockStart && now < g.blockEnd),
    [queueGroups, now],
  );

  const reminders = useMemo(() => {
    const list: { key: string; message: string }[] = [];

    appointments.forEach((appt) => {
      if (appt.status !== 'Upcoming' || !appt.approved) return;
      const minutesUntil = (appt.startsAt.getTime() - now.getTime()) / 60000;

      const oneHourKey = `${appt.id}-1hr`;
      const startKey = `${appt.id}-start`;

      if (
        minutesUntil <= 60 &&
        minutesUntil > 50 &&
        !dismissedReminders.has(oneHourKey)
      ) {
        list.push({
          key: oneHourKey,
          message: `Reminder: ${appt.studentName}'s appointment starts in about 1 hour (${formatClockTime(
            appt.startsAt,
          )}).`,
        });
      }

      if (
        minutesUntil <= 0 &&
        minutesUntil > -10 &&
        !dismissedReminders.has(startKey)
      ) {
        list.push({
          key: startKey,
          message: `${appt.studentName}'s appointment is starting now.`,
        });
      }
    });

    return list;
  }, [appointments, now, dismissedReminders]);

  const dismissReminder = (key: string) => {
    setDismissedReminders((prev) => new Set(prev).add(key));
  };

  const advanceQueue = (group: QueueGroup, current: Appointment) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === current.id ? { ...a, status: 'Completed' } : a)),
    );
    setTurnStartedAt((prev) => ({ ...prev, [group.blockKey]: new Date() }));

    const remaining = group.entries.filter((entry) => entry.id !== current.id);
    setQueueNotice(
      remaining.length > 0
        ? `${remaining[0].studentName} has been notified — their turn has started.`
        : 'Queue complete for this time block.',
    );

    // The mobile app's queue lives in queue_entries; without removing the
    // finished student's row there, they stay "in line" on every phone.
    supabase.from('queue_entries').delete().eq('appointment_id', current.id);

    supabase
      .from('appointments')
      .update({ status: 'completed' })
      .eq('id', current.id)
      .then(({ error }) => {
        if (error) {
          window.alert('Could not mark appointment complete: ' + error.message);
        }
      });

    const next = remaining[0];
    if (next?.studentUserId) {
      supabase.from('notifications').insert({
        user_id: next.studentUserId,
        sender_id: facultyId,
        icon: 'notifications-outline',
        title: 'Your Turn',
        description: `${facultyName} is ready for you now for ${next.reason} (${next.date}, ${next.time}).`,
      });
    }
  };

  const counts = useMemo(
    () => ({
      all: appointments.length,
      upcoming: appointments.filter((a) => a.status === 'Upcoming').length,
      completed: appointments.filter((a) => a.status === 'Completed').length,
      cancelled: appointments.filter((a) => a.status === 'Cancelled').length,
    }),
    [appointments],
  );

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'upcoming', label: 'Upcoming', count: counts.upcoming },
    { id: 'completed', label: 'Completed', count: counts.completed },
    { id: 'cancelled', label: 'Cancelled', count: counts.cancelled },
  ];

  const normRef = (v: string) => v.replace(/[^a-z0-9]/gi, '').toUpperCase();
  const refQuery = normRef(searchQuery);
  // While searching, look through every appointment by reference number.
  const filtered = refQuery
    ? appointments.filter((a) => normRef(a.referenceNo).includes(refQuery))
    : activeTab === 'all'
      ? appointments
      : appointments.filter((a) => a.status.toLowerCase() === activeTab);

  const closeModal = () => setModal({ type: 'none' });

  const openDetails = (appointment: Appointment) => {
    setModal({ type: 'details', appointment });
  };

  const openCancel = (appointment: Appointment) => {
    setCancelReason('');
    setModal({ type: 'cancel', appointment });
  };

  const openReschedule = (appointment: Appointment) => {
    setRescheduleDate('');
    setRescheduleStart('');
    setRescheduleEnd('');
    setRescheduleReason('');
    setRescheduleMode(appointment.mode);
    setRescheduleMeetingLink('');
    // For an online appointment `location` holds the meeting link, which is
    // not a room — don't carry it over as the face-to-face location.
    setRescheduleLocation(appointment.mode === 'Face-to-Face' ? appointment.location : '');
    setModal({ type: 'reschedule', appointment });
  };

  const confirmCancel = () => {
    if (modal.type !== 'cancel' || !cancelReason.trim()) return;

    const { id, date, time, studentUserId } = modal.appointment;
    const reason = cancelReason.trim();

    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'Cancelled' } : a)),
    );
    closeModal();

    supabase
      .from('appointments')
      .update({ status: 'canceled' })
      .eq('id', id)
      .then(({ error }) => {
        if (error) window.alert('Could not cancel appointment: ' + error.message);
      });

    // The appointment no longer occupies its slot's capacity, or a queue spot.
    supabase.from('slot_bookings').delete().eq('appointment_id', id);
    supabase.from('queue_entries').delete().eq('appointment_id', id);

    if (studentUserId) {
      supabase.from('notifications').insert({
        user_id: studentUserId,
        sender_id: facultyId,
        ...canceledMessage(
          { name: facultyName, department: facultyDepartment, role: 'Faculty' },
          formatWhen({ dateLabel: date, timeLabel: time }),
          reason,
        ),
      });
    }
  };

  const canConfirmReschedule =
    modal.type === 'reschedule' &&
    !!rescheduleDate &&
    !!rescheduleStart &&
    !!rescheduleEnd &&
    rescheduleEnd > rescheduleStart &&
    rescheduleReason.trim().length > 0 &&
    (rescheduleMode !== 'Online' || rescheduleMeetingLink.trim().length > 0) &&
    (rescheduleMode !== 'Face-to-Face' || rescheduleLocation.trim().length > 0);

  const confirmReschedule = () => {
    if (modal.type !== 'reschedule' || !canConfirmReschedule) return;

    const { id, studentUserId } = modal.appointment;
    const newDate = formatDateLabel(rescheduleDate);
    const newTime = `${formatTimeLabel(rescheduleStart)} - ${formatTimeLabel(
      rescheduleEnd,
    )}`;
    const newStartsAt = combineDateAndTime(rescheduleDate, rescheduleStart);
    const newEndsAt = combineDateAndTime(rescheduleDate, rescheduleEnd);
    const newLocation =
      rescheduleMode === 'Online'
        ? rescheduleMeetingLink.trim()
        : rescheduleLocation.trim();
    const reason = rescheduleReason.trim();

    // The stored duration used to keep its OLD value even when the new
    // start/end changed the length of the appointment.
    const durationMinutes = Math.round(
      (newEndsAt.getTime() - newStartsAt.getTime()) / 60000,
    );
    if (durationMinutes <= 0) {
      window.alert('End time must be after the start time.');
      return;
    }
    if (newStartsAt.getTime() < Date.now()) {
      window.alert('Please choose a time in the future.');
      return;
    }
    const clash = appointments.find(
      (a) =>
        a.id !== id &&
        a.status === 'Upcoming' &&
        a.startsAt < newEndsAt &&
        addMinutes(a.startsAt, a.durationMinutes) > newStartsAt,
    );
    if (clash) {
      window.alert(`That time overlaps ${clash.studentName}'s appointment.`);
      return;
    }

    setAppointments((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              date: newDate,
              time: newTime,
              startsAt: newStartsAt,
              mode: rescheduleMode,
              location: newLocation,
              // Rescheduling moves the student out of their old shared
              // block into a standalone slot of their own.
              blockStart: newStartsAt,
              blockEnd: addMinutes(newStartsAt, durationMinutes),
            }
          : a,
      ),
    );
    closeModal();

    supabase
      .from('appointments')
      .update({
        date: rescheduleDate,
        start_time: `${rescheduleStart}:00`,
        end_time: `${rescheduleEnd}:00`,
        duration_minutes: durationMinutes,
        mode: rescheduleMode,
        location: newLocation,
        meeting_link: rescheduleMode === 'Online' ? newLocation : null,
        updated_at: new Date().toISOString(),
        // No longer tied to its original shared slot — it's now a
        // standalone time this faculty member picked directly.
        slot_id: null,
      })
      .eq('id', id)
      .then(({ error }) => {
        if (error) window.alert('Could not reschedule appointment: ' + error.message);
      });

    supabase.from('slot_bookings').delete().eq('appointment_id', id);
    supabase.from('queue_entries').delete().eq('appointment_id', id);

    if (studentUserId) {
      supabase.from('notifications').insert({
        user_id: studentUserId,
        sender_id: facultyId,
        ...rescheduledMessage(
          { name: facultyName, department: facultyDepartment, role: 'Faculty' },
          { purpose: modal.appointment.reason },
          formatWhen({ dateLabel: newDate, timeLabel: newTime }),
          {
            reason,
            meetingLink: rescheduleMode === 'Online' ? rescheduleMeetingLink : undefined,
          },
        ),
      });
    }
  };

  return (
    <div className="av-page">
      <div className="av-header">
        <div>
          <h1>Appointments</h1>
          <p>View and manage your appointments.</p>
        </div>
      </div>

      {reminders.length > 0 && (
        <div className="av-reminders">
          {reminders.map((reminder) => (
            <div key={reminder.key} className="av-reminder-banner">
              <BellIcon />
              <span>{reminder.message}</span>
              <button
                type="button"
                aria-label="Dismiss reminder"
                onClick={() => dismissReminder(reminder.key)}
              >
                <XSmallIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      {queueNotice && (
        <div className="av-queue-toast">
          <CheckSmallIcon />
          <span>{queueNotice}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setQueueNotice(null)}
          >
            <XSmallIcon />
          </button>
        </div>
      )}

      {liveGroups.length > 0 && (
        <div className="av-queue-section">
          {liveGroups.map((group) => {
            const current = group.entries[0];
            const upcomingInQueue = group.entries.slice(1);
            const turnStart = turnStartedAt[group.blockKey] ?? group.blockStart;
            const currentRemainingSeconds = getRemainingSeconds(
              turnStart,
              current.durationMinutes,
              now,
            );

            return (
              <div key={group.blockKey} className="av-queue-card">
                <div className="av-queue-card-header">
                  <span className="av-queue-live-dot" />
                  <h2>
                    Live Queue · {formatClockTime(group.blockStart)} –{' '}
                    {formatClockTime(group.blockEnd)}
                  </h2>
                </div>

                <div className="av-queue-stats-row">
                  <div className="av-queue-stat">
                    <span className="av-queue-stat-number">
                      {group.entries.length}
                    </span>
                    <span className="av-queue-stat-label">Waiting</span>
                  </div>
                  <div className="av-queue-stat">
                    <span className="av-queue-stat-number">
                      {AVERAGE_WAIT_MINUTES_PER_STUDENT}
                    </span>
                    <span className="av-queue-stat-label">
                      Avg. min/student
                    </span>
                  </div>
                </div>

                <div className="av-queue-current">
                  <span className="av-queue-current-badge">
                    Now Serving · #1
                  </span>
                  <p className="av-queue-current-name">
                    {current.studentName}
                  </p>
                  <p className="av-queue-current-info">
                    {current.studentInfo}
                  </p>
                  <p className="av-queue-current-reason">{current.reason}</p>
                  <p className="av-queue-current-timer">
                    Allotted {current.durationMinutes} min ·{' '}
                    {formatCountdown(currentRemainingSeconds)} remaining
                  </p>
                  <button
                    type="button"
                    className="av-queue-done-btn"
                    onClick={() => advanceQueue(group, current)}
                  >
                    <CheckSmallIcon /> Done — Next Student
                  </button>
                </div>

                {upcomingInQueue.length > 0 && (
                  <div className="av-queue-waiting-list">
                    <p className="av-queue-waiting-title">Waiting</p>
                    {upcomingInQueue.map((entry, index) => {
                      const estimatedWaitSeconds = getEstimatedWaitSeconds(
                        group,
                        index + 1,
                        currentRemainingSeconds,
                      );

                      return (
                        <div key={entry.id} className="av-queue-waiting-row">
                          <span className="av-queue-number">
                            #{index + 2}
                          </span>
                          <span className="av-queue-waiting-name">
                            {entry.studentName}
                          </span>
                          <span className="av-queue-waiting-duration">
                            {formatCountdown(estimatedWaitSeconds)} wait
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="av-search">
        <input
          type="search"
          className="av-search-input"
          placeholder="Search by reference number (e.g. APP-2026-000791)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="av-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`av-tab${activeTab === tab.id ? ' av-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      <div className="av-table-card">
        <table className="av-table">
          <thead>
            <tr>
              <th>Date &amp; Time</th>
              <th>Student</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((appt) => {
              const isHistory =
                appt.status === 'Completed' || appt.status === 'Cancelled';

              return (
              <tr
                key={appt.id}
                className={isHistory ? 'av-history-row' : undefined}
                onClick={isHistory ? () => openDetails(appt) : undefined}
                onKeyDown={
                  isHistory
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openDetails(appt);
                        }
                      }
                    : undefined
                }
                tabIndex={isHistory ? 0 : undefined}
                role={isHistory ? 'button' : undefined}
                aria-label={
                  isHistory
                    ? `View details for ${appt.studentName}'s ${appt.status.toLowerCase()} appointment`
                    : undefined
                }
              >
                <td>
                  <div className="av-datetime">
                    <span className="av-date">{appt.date}</span>
                    <span className="av-time">{appt.time}</span>
                  </div>
                </td>
                <td className="av-student">
                  {appt.studentName}
                  {appt.referenceNo && (
                    <div className="av-ref">Ref: {appt.referenceNo}</div>
                  )}
                </td>
                <td className="av-reason">{appt.reason}</td>
                <td>
                  <span
                    className={`av-status av-status-${appt.status.toLowerCase()}`}
                  >
                    {appt.status}
                  </span>
                </td>
                <td>
                  {appt.status === 'Upcoming' ? (
                    <div className="av-actions">
                      <button
                        type="button"
                        className="av-row-btn"
                        onClick={() => openReschedule(appt)}
                      >
                        Reschedule
                      </button>
                      <button
                        type="button"
                        className="av-row-btn av-row-btn-danger"
                        onClick={() => openCancel(appt)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="av-actions">
                      <span className="av-actions-muted">—</span>
                    </div>
                  )}
                </td>
              </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="av-empty">
                  <div className="av-empty-inner">
                    <span className="av-empty-icon" aria-hidden="true">
                      <CalendarEmptyIcon />
                    </span>
                    <span className="av-empty-title">
                      {refQuery
                        ? 'No appointment found with that reference number'
                        : 'No appointments in this category'}
                    </span>
                    <span className="av-empty-subtitle">
                      New bookings will show up here as students schedule
                      them.
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="av-footer">
          Showing {filtered.length === 0 ? 0 : 1}-{filtered.length} of{' '}
          {filtered.length}
        </div>
      </div>

      {modal.type !== 'none' && (
        <div className="av-modal-overlay" onClick={closeModal}>
          <div
            className="av-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            {modal.type === 'details' && (
              <>
                <div className="av-modal-heading-row">
                  <div>
                    <h2>Appointment Details</h2>
                    <p className="av-modal-heading-subtitle">
                      {modal.appointment.status} appointment
                    </p>
                  </div>
                  <button
                    type="button"
                    className="av-modal-close"
                    aria-label="Close appointment details"
                    onClick={closeModal}
                  >
                    <XSmallIcon />
                  </button>
                </div>

                <div className="av-details-status">
                  <span
                    className={`av-status av-status-${modal.appointment.status.toLowerCase()}`}
                  >
                    {modal.appointment.status}
                  </span>
                </div>

                <div className="av-details-grid">
                  <div className="av-details-item av-details-item-wide">
                    <span className="av-details-label">Student</span>
                    <strong>{modal.appointment.studentName}</strong>
                    {modal.appointment.studentInfo && (
                      <span className="av-details-value-muted">
                        {modal.appointment.studentInfo}
                      </span>
                    )}
                  </div>

                  <div className="av-details-item">
                    <span className="av-details-label">Date</span>
                    <strong>{modal.appointment.date}</strong>
                  </div>

                  <div className="av-details-item">
                    <span className="av-details-label">Time</span>
                    <strong>{modal.appointment.time}</strong>
                  </div>

                  <div className="av-details-item av-details-item-wide">
                    <span className="av-details-label">Reason / Purpose</span>
                    <strong>{modal.appointment.reason}</strong>
                  </div>

                  <div className="av-details-item">
                    <span className="av-details-label">Meeting Mode</span>
                    <strong>{modal.appointment.mode}</strong>
                  </div>

                  <div className="av-details-item">
                    <span className="av-details-label">Duration</span>
                    <strong>{modal.appointment.durationMinutes} minutes</strong>
                  </div>

                  <div className="av-details-item av-details-item-wide">
                    <span className="av-details-label">Location / Meeting Link</span>
                    <strong className="av-details-break">
                      {modal.appointment.location || 'Not specified'}
                    </strong>
                  </div>
                </div>

                <div className="av-modal-actions">
                  <button
                    type="button"
                    className="av-modal-btn av-modal-btn-secondary"
                    onClick={closeModal}
                  >
                    Close
                  </button>
                </div>
              </>
            )}

            {modal.type === 'cancel' && (
              <>
                <h2>Cancel Appointment</h2>

                <div className="av-modal-summary">
                  <p className="av-modal-summary-name">
                    {modal.appointment.studentName}
                  </p>
                  <p className="av-modal-summary-line">
                    {modal.appointment.date} · {modal.appointment.time}
                  </p>
                  <p className="av-modal-summary-muted">
                    {modal.appointment.reason}
                  </p>
                </div>

                <label className="av-modal-label" htmlFor="av-cancel-reason">
                  Reason for Cancellation
                </label>
                <textarea
                  id="av-cancel-reason"
                  className="av-modal-textarea"
                  rows={4}
                  placeholder="e.g. Faculty unavailable, emergency..."
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                />

                <div className="av-modal-warning">
                  <AlertIcon />
                  <p>
                    The student will be notified immediately once this
                    appointment is cancelled.
                  </p>
                </div>

                <div className="av-modal-actions">
                  <button
                    type="button"
                    className="av-modal-btn av-modal-btn-danger"
                    disabled={!cancelReason.trim()}
                    onClick={confirmCancel}
                  >
                    Cancel Appointment
                  </button>
                  <button
                    type="button"
                    className="av-modal-btn av-modal-btn-secondary"
                    onClick={closeModal}
                  >
                    Keep Appointment
                  </button>
                </div>
              </>
            )}

            {modal.type === 'reschedule' && (
              <>
                <h2>Reschedule Appointment</h2>

                <div className="av-modal-summary">
                  <p className="av-modal-summary-name">
                    {modal.appointment.studentName}
                  </p>
                  <p className="av-modal-summary-line">
                    Currently: {modal.appointment.date} ·{' '}
                    {modal.appointment.time}
                  </p>
                  <p className="av-modal-summary-muted">
                    {modal.appointment.reason}
                  </p>
                  <p className="av-modal-summary-muted">
                    {modal.appointment.mode} · {modal.appointment.location}
                  </p>
                </div>

                <div className="av-modal-field">
                  <label htmlFor="av-res-date">New Date</label>
                  <input
                    id="av-res-date"
                    type="date"
                    value={rescheduleDate}
                    onChange={(event) => setRescheduleDate(event.target.value)}
                  />
                </div>

                <div className="av-modal-field-row">
                  <div className="av-modal-field">
                    <label htmlFor="av-res-start">Start Time</label>
                    <input
                      id="av-res-start"
                      type="time"
                      value={rescheduleStart}
                      onChange={(event) =>
                        setRescheduleStart(event.target.value)
                      }
                    />
                  </div>
                  <div className="av-modal-field">
                    <label htmlFor="av-res-end">End Time</label>
                    <input
                      id="av-res-end"
                      type="time"
                      value={rescheduleEnd}
                      onChange={(event) => setRescheduleEnd(event.target.value)}
                    />
                  </div>
                </div>

                <label className="av-modal-label" htmlFor="av-res-mode-ftf">
                  New Meeting Mode
                </label>
                <div className="av-modal-mode-toggle">
                  <button
                    type="button"
                    id="av-res-mode-ftf"
                    className={`av-modal-mode-btn${
                      rescheduleMode === 'Face-to-Face'
                        ? ' av-modal-mode-btn-active'
                        : ''
                    }`}
                    onClick={() => setRescheduleMode('Face-to-Face')}
                  >
                    Face-to-Face
                  </button>
                  <button
                    type="button"
                    className={`av-modal-mode-btn${
                      rescheduleMode === 'Online'
                        ? ' av-modal-mode-btn-active'
                        : ''
                    }`}
                    onClick={() => setRescheduleMode('Online')}
                  >
                    Online
                  </button>
                </div>

                {rescheduleMode === 'Face-to-Face' && (
                  <>
                    <label className="av-modal-label" htmlFor="av-res-room">
                      Room / Location
                    </label>
                    <input
                      id="av-res-room"
                      type="text"
                      className="av-modal-link-input"
                      placeholder="e.g. Room 204, CITE Building"
                      value={rescheduleLocation}
                      onChange={(event) =>
                        setRescheduleLocation(event.target.value)
                      }
                    />
                  </>
                )}

                {rescheduleMode === 'Online' && (
                  <>
                    <label className="av-modal-label" htmlFor="av-res-link">
                      New Meeting Link
                    </label>
                    <input
                      id="av-res-link"
                      type="url"
                      className="av-modal-link-input"
                      placeholder="e.g. https://meet.google.com/abc-defg-hij"
                      value={rescheduleMeetingLink}
                      onChange={(event) =>
                        setRescheduleMeetingLink(event.target.value)
                      }
                    />
                    <p className="av-modal-link-hint">
                      This appointment moved to an online slot — the student
                      needs a fresh link since the old one no longer applies.
                    </p>
                  </>
                )}

                <label className="av-modal-label" htmlFor="av-res-reason">
                  Reason for Reschedule
                </label>
                <textarea
                  id="av-res-reason"
                  className="av-modal-textarea"
                  rows={3}
                  placeholder="e.g. Schedule conflict, emergency..."
                  value={rescheduleReason}
                  onChange={(event) =>
                    setRescheduleReason(event.target.value)
                  }
                />

                <div className="av-modal-actions">
                  <button
                    type="button"
                    className="av-modal-btn av-modal-btn-primary"
                    disabled={!canConfirmReschedule}
                    onClick={confirmReschedule}
                  >
                    Confirm Reschedule
                  </button>
                  <button
                    type="button"
                    className="av-modal-btn av-modal-btn-secondary"
                    onClick={closeModal}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* Small inline icons so this component has zero extra icon-library
   dependencies (same convention as Dashboard.tsx / LoginPage.tsx). */

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 7.5v5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.3" r="1" fill="currentColor" />
    </svg>
  );
}

function CalendarEmptyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect
        x="3.5"
        y="5.5"
        width="17"
        height="15"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M3.5 9.5h17M8 3.5v4M16 3.5v4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M9 14.5h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 10.5a6 6 0 1 1 12 0v3.5l1.5 3H4.5l1.5-3v-3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M10 20a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckSmallIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12.5l4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XSmallIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}