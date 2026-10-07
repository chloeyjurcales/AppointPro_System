import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  canceledMessage,
  declinedMessage,
  formatWhen,
  rescheduledMessage,
} from '../lib/notificationMessages';
import './AppointmentsView.css';

type AppointmentStatus = 'Upcoming' | 'Completed' | 'Cancelled';

type MeetingMode = 'Face-to-Face' | 'Online';

type Appointment = {
  id: string;
  date: string;
  time: string;
  studentName: string;
  studentAvatarUrl: string | null;
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
  // Students submit a request; only the faculty member can approve/decline
  // it (mirrors the mobile app's `faculty_approval_status`).
  approvalStatus: 'pending' | 'approved' | 'declined';
  purpose: string | null;
  category: string | null;
  // Real Date fields power the reminder/queue features below. `startsAt` is
  // this student's own turn start; `blockStart`/`blockEnd` describe the
  // underlying faculty schedule block the appointment falls in (e.g. a
  // "9:00–10:00 AM" slot several students can share).
  startsAt: Date;
  durationMinutes: number;
  blockStart: Date;
  blockEnd: Date;
};

type TabId = 'all' | 'pending' | 'upcoming' | 'completed' | 'cancelled';

type ModalState =
  | { type: 'none' }
  | { type: 'cancel'; appointment: Appointment }
  | { type: 'decline'; appointment: Appointment }
  | { type: 'reschedule'; appointment: Appointment }
  | { type: 'details'; appointment: Appointment };

type ActionSuccess = {
  type: 'approved' | 'cancelled' | 'rescheduled';
  appointment: Appointment;
  date?: string;
  time?: string;
  location?: string;
  mode?: MeetingMode;
  reason?: string;
};

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

function dbTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const parts = value.split(':').map(Number);
  if (parts.length < 2 || parts.some((part) => Number.isNaN(part))) return null;
  return parts[0] * 60 + parts[1];
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
    profiles:
      | { full_name: string; avatar_url: string | null }
      | { full_name: string; avatar_url: string | null }[]
      | null;
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

function StudentAvatar({
  name,
  url,
  large = false,
}: {
  name: string;
  url: string | null;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?';
  return (
    <span
      className={`av-avatar${large ? ' av-avatar-lg' : ''}`}
      aria-hidden="true"
    >
      {url && !failed ? (
        <img src={url} alt="" onError={() => setFailed(true)} />
      ) : (
        initials
      )}
    </span>
  );
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
    studentAvatarUrl: profile?.avatar_url ?? null,
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
    approvalStatus: row.faculty_approval_status ?? 'approved',
    purpose: row.purpose,
    category: row.category,
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

// A request the student submitted that the faculty hasn't answered yet.
function isPendingApproval(appt: Appointment): boolean {
  return appt.status === 'Upcoming' && appt.approvalStatus === 'pending';
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
           students ( student_id, department, year_level, profiles ( full_name, avatar_url ) ),
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
  const [declineReason, setDeclineReason] = useState('');
  // Blocks a double-click from approving/declining the same request twice.
  const actionInFlightRef = useRef(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  // True while a cancel is waiting on the database (disables the buttons).
  const [actionBusy, setActionBusy] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<ActionSuccess | null>(null);

  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStart, setRescheduleStart] = useState('');
  const [rescheduleEnd, setRescheduleEnd] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleMode, setRescheduleMode] = useState<MeetingMode>(
    'Face-to-Face',
  );
  const [rescheduleMeetingLink, setRescheduleMeetingLink] = useState('');
  const [rescheduleLocation, setRescheduleLocation] = useState('');

  // ---------- Reminders ----------
  // `now` ticks so "starts in 1 hour" / "starting now" reminders stay accurate
  // without a page refresh. The live queue itself lives in the Queue tab.
  const [now, setNow] = useState(() => new Date());
  const [dismissedReminders, setDismissedReminders] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

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

  const counts = useMemo(
    () => ({
      all: appointments.filter((a) => !isPendingApproval(a)).length,
      pending: appointments.filter(isPendingApproval).length,
      upcoming: appointments.filter(
        (a) => a.status === 'Upcoming' && !isPendingApproval(a),
      ).length,
      completed: appointments.filter((a) => a.status === 'Completed').length,
      cancelled: appointments.filter((a) => a.status === 'Cancelled').length,
    }),
    [appointments],
  );

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'pending', label: 'Pending Approval', count: counts.pending },
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
      ? appointments.filter((a) => !isPendingApproval(a))
      : activeTab === 'pending'
        ? appointments.filter(isPendingApproval)
        : activeTab === 'upcoming'
          ? appointments.filter(
              (a) => a.status === 'Upcoming' && !isPendingApproval(a),
            )
          : appointments.filter((a) => a.status.toLowerCase() === activeTab);

  const closeModal = () => setModal({ type: 'none' });

  const openDetails = (appointment: Appointment) => {
    setModal({ type: 'details', appointment });
  };

  const confirmDecline = async () => {
    if (modal.type !== 'decline' || actionInFlightRef.current) return;
    const appt = modal.appointment;
    if (!isPendingApproval(appt)) {
      closeModal();
      return;
    }
    const reason = declineReason.trim();

    actionInFlightRef.current = true;
    try {
      const { data, error } = await supabase
        .from('appointments')
        .update({
          student_approval_status: 'approved',
          faculty_approval_status: 'declined',
          status: 'canceled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', appt.id)
        .eq('faculty_id', facultyId)
        .eq('faculty_approval_status', 'pending')
        .select('id')
        .maybeSingle();

      if (error) {
        window.alert('Could not decline appointment: ' + error.message);
        return;
      }
      if (!data) {
        window.alert('This appointment was already processed or is no longer available.');
        closeModal();
        return;
      }

      setAppointments((prev) =>
        prev.map((a) =>
          a.id === appt.id ? { ...a, status: 'Cancelled', approvalStatus: 'declined' } : a,
        ),
      );
      closeModal();
      setActionNotice(`${appt.studentName}'s appointment was declined.`);

      // Free the reserved minutes in the shared slot and any queue spot.
      await supabase.from('slot_bookings').delete().eq('appointment_id', appt.id);
      await supabase.from('queue_entries').delete().eq('appointment_id', appt.id);

      if (appt.studentUserId) {
        await supabase.from('notifications').insert({
          user_id: appt.studentUserId,
          sender_id: facultyId,
          ...declinedMessage(
            { name: facultyName, department: facultyDepartment, role: 'Faculty' },
            { purpose: appt.purpose, category: appt.category },
            formatWhen({ dateLabel: appt.date, timeLabel: appt.time }),
            reason,
          ),
        });
      }
    } finally {
      actionInFlightRef.current = false;
    }
  };

  // Cancels an appointment on behalf of the faculty. Nothing changes on screen
  // (and the student is not told) until the database confirms the cancel, so a
  // failed update can't leave the web out of sync with what students see.
  const confirmCancel = async () => {
    if (modal.type !== 'cancel' || !cancelReason.trim()) return;
    if (actionInFlightRef.current) return;

    const appt = modal.appointment;
    const { id, date, time, studentUserId } = appt;
    const reason = cancelReason.trim();

    actionInFlightRef.current = true;
    setActionBusy(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('faculty_id', facultyId)
        .neq('status', 'canceled')
        .select('id')
        .maybeSingle();

      if (error) {
        window.alert('Could not cancel appointment: ' + error.message);
        return;
      }
      if (!data) {
        window.alert('This appointment was already cancelled or is no longer available.');
        closeModal();
        return;
      }

      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'Cancelled' } : a)),
      );
      closeModal();
      setActionNotice(`${appt.studentName}'s appointment was cancelled.`);

      // Free the reserved minutes in the shared slot and drop any queue spot
      // (best effort — the appointment itself is already cancelled).
      const { error: bookingError } = await supabase
        .from('slot_bookings')
        .delete()
        .eq('appointment_id', id);
      if (bookingError) console.log('Failed to release slot capacity:', bookingError.message);

      const { error: queueError } = await supabase
        .from('queue_entries')
        .delete()
        .eq('appointment_id', id);
      if (queueError) console.log('Failed to remove queue entry:', queueError.message);

      if (studentUserId) {
        const { error: notifyError } = await supabase.from('notifications').insert({
          user_id: studentUserId,
          sender_id: facultyId,
          ...canceledMessage(
            { name: facultyName, department: facultyDepartment, role: 'Faculty' },
            formatWhen({ dateLabel: date, timeLabel: time }),
            reason,
          ),
        });
        if (notifyError) console.log('Failed to notify student:', notifyError.message);
      }
      setActionSuccess({ type: 'cancelled', appointment: { ...appt, status: 'Cancelled' }, reason });
    } finally {
      actionInFlightRef.current = false;
      setActionBusy(false);
    }
  };

  const canConfirmReschedule =
    modal.type === 'reschedule' &&
    !!rescheduleDate &&
    !!rescheduleStart &&
    !!rescheduleEnd &&
    rescheduleEnd > rescheduleStart &&
    rescheduleReason.trim().length > 0;

  const fetchRescheduleValidation = async (appt: Appointment) => {
    const durationMinutes = Math.round(
      (combineDateAndTime(rescheduleDate, rescheduleEnd).getTime() -
        combineDateAndTime(rescheduleDate, rescheduleStart).getTime()) /
        60000,
    );
    const newStart = combineDateAndTime(rescheduleDate, rescheduleStart);
    const newEnd = combineDateAndTime(rescheduleDate, rescheduleEnd);
    if (durationMinutes <= 0) throw new Error('End time must be after the start time.');
    if (newStart.getTime() < Date.now()) throw new Error('Please choose a time in the future.');

    const { data: slots, error: slotsError } = await supabase
      .from('availability_slots')
      .select('id,start_time,end_time,mode,location,enabled')
      .eq('faculty_id', facultyId)
      .eq('date', rescheduleDate)
      .eq('enabled', true)
      .order('start_time', { ascending: true });
    if (slotsError) throw new Error(`Could not check faculty availability: ${slotsError.message}`);

    const startMinutes = newStart.getHours() * 60 + newStart.getMinutes();
    const endMinutes = newEnd.getHours() * 60 + newEnd.getMinutes();
    const matchingSlot = (slots ?? []).find((slot) => {
      const slotStart = dbTimeToMinutes(slot.start_time) ?? -1;
      const slotEnd = dbTimeToMinutes(slot.end_time) ?? -1;
      return slotStart <= startMinutes && slotEnd >= endMinutes;
    });
    if (!matchingSlot) {
      throw new Error('That date and time is outside your available consultation schedule. Choose a time inside one of your enabled availability slots.');
    }

    const slotMode = matchingSlot.mode as MeetingMode;
    if (slotMode !== rescheduleMode) {
      throw new Error(`That availability slot is ${slotMode}. Choose a time slot that matches the selected meeting mode.`);
    }

    const { data: classRows, error: classError } = await supabase
      .from('student_class_schedule')
      .select('id,day_of_week,start_time,end_time,subject')
      .eq('student_id', appt.studentUserId ?? '');
    if (classError) throw new Error(`Could not check the student's class schedule: ${classError.message}`);

    const dayOfWeek = newStart.getDay();
    const conflict = (classRows ?? []).find((row) => {
      if (row.day_of_week !== dayOfWeek) return false;
      const classStart = dbTimeToMinutes(row.start_time) ?? 0;
      const classEnd = dbTimeToMinutes(row.end_time) ?? 0;
      return startMinutes < classEnd && classStart < endMinutes;
    });
    if (conflict) {
      const classStart = formatDbTime(conflict.start_time);
      const classEnd = formatDbTime(conflict.end_time);
      throw new Error(`The student has ${conflict.subject} on ${newStart.toLocaleDateString('en-US', { weekday: 'long' })} from ${classStart} to ${classEnd}. Rescheduling to this time is unavailable.`);
    }

    const clash = appointments.find(
      (a) =>
        a.id !== appt.id &&
        a.status === 'Upcoming' &&
        a.startsAt < newEnd &&
        addMinutes(a.startsAt, a.durationMinutes) > newStart,
    );
    if (clash) throw new Error(`That time overlaps ${clash.studentName}'s appointment.`);

    return {
      durationMinutes,
      newStart,
      newEnd,
      location: matchingSlot.location,
      mode: slotMode,
    };
  };

  const confirmReschedule = async () => {
    if (modal.type !== 'reschedule' || !canConfirmReschedule || actionInFlightRef.current) return;
    const appt = modal.appointment;
    const reason = rescheduleReason.trim();
    actionInFlightRef.current = true;
    setActionBusy(true);
    try {
      const validation = await fetchRescheduleValidation(appt);
      const { durationMinutes, newStart, newEnd, location, mode } = validation;
      const newDateLabel = formatDateLabel(rescheduleDate);
      const newTimeLabel = `${formatTimeLabel(rescheduleStart)} - ${formatTimeLabel(rescheduleEnd)}`;
      const newLocation = location;

      const { data, error } = await supabase
        .from('appointments')
        .update({
          date: rescheduleDate,
          start_time: `${rescheduleStart}:00`,
          end_time: `${rescheduleEnd}:00`,
          duration_minutes: durationMinutes,
          mode,
          location: newLocation,
          meeting_link: mode === 'Online' ? newLocation : null,
          updated_at: new Date().toISOString(),
          slot_id: null,
        })
        .eq('id', appt.id)
        .eq('faculty_id', facultyId)
        .select('id')
        .maybeSingle();
      if (error) throw new Error(`Could not reschedule appointment: ${error.message}`);
      if (!data) throw new Error('This appointment was already changed or is no longer available.');

      await supabase.from('slot_bookings').delete().eq('appointment_id', appt.id);
      await supabase.from('queue_entries').delete().eq('appointment_id', appt.id);

      if (appt.studentUserId) {
        const { error: notifyError } = await supabase.from('notifications').insert({
          user_id: appt.studentUserId,
          sender_id: facultyId,
          ...rescheduledMessage(
            { name: facultyName, department: facultyDepartment, role: 'Faculty' },
            { purpose: appt.reason },
            formatWhen({ dateLabel: newDateLabel, timeLabel: newTimeLabel }),
            { reason, meetingLink: mode === 'Online' ? newLocation : undefined },
          ),
        });
        if (notifyError) console.log('Failed to notify student:', notifyError.message);
      }

      const updatedAppointment: Appointment = {
        ...appt,
        date: newDateLabel,
        time: newTimeLabel,
        startsAt: newStart,
        durationMinutes,
        mode,
        location: newLocation,
        blockStart: newStart,
        blockEnd: newEnd,
      };
      setAppointments((prev) => prev.map((item) => item.id === appt.id ? updatedAppointment : item));
      closeModal();
      setActionSuccess({ type: 'rescheduled', appointment: updatedAppointment, date: newDateLabel, time: newTimeLabel, location: newLocation, mode, reason });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not reschedule appointment.');
    } finally {
      actionInFlightRef.current = false;
      setActionBusy(false);
    }
  };

  return (
    <div className="av-page">
      {actionSuccess && (
        <div className="av-success-overlay" role="dialog" aria-modal="true">
          <div className="av-success-modal">
            <button type="button" className="av-success-close" onClick={() => setActionSuccess(null)} aria-label="Close">×</button>
            <div className={`av-success-icon av-success-${actionSuccess.type}`}>
              {actionSuccess.type === 'cancelled' ? '×' : '✓'}
            </div>
            <h2>{actionSuccess.type === 'cancelled' ? 'Appointment Canceled!' : actionSuccess.type === 'rescheduled' ? 'Appointment Rescheduled!' : 'Appointment Approved!'}</h2>
            <p className="av-success-subtitle">
              {actionSuccess.type === 'cancelled' ? 'The appointment has been successfully canceled.' : actionSuccess.type === 'rescheduled' ? 'The appointment has been successfully rescheduled.' : 'The appointment has been successfully approved.'}
            </p>
            <div className="av-success-details">
              <strong>{actionSuccess.appointment.studentName}</strong>
              <span>{actionSuccess.appointment.category ?? actionSuccess.appointment.reason}</span>
              <div className="av-success-detail-row"><span>📅</span><span>{actionSuccess.date ?? actionSuccess.appointment.date}</span></div>
              <div className="av-success-detail-row"><span>🕒</span><span>{actionSuccess.time ?? actionSuccess.appointment.time}</span></div>
              <div className="av-success-detail-row"><span>📍</span><span>{actionSuccess.location ?? actionSuccess.appointment.location}</span></div>
              <div className="av-success-detail-row"><span>👥</span><span>{actionSuccess.mode ?? actionSuccess.appointment.mode}</span></div>
              {actionSuccess.reason && <><div className="av-success-divider" /><strong className="av-success-label">Reason</strong><span>{actionSuccess.reason}</span></>}
              <div className="av-success-divider" />
              <strong className="av-success-label">Reference No.</strong>
              <strong>{actionSuccess.appointment.referenceNo}</strong>
            </div>
            <div className="av-success-notice">🔔 {actionSuccess.appointment.studentName} has been notified of this {actionSuccess.type === 'cancelled' ? 'cancellation' : actionSuccess.type === 'rescheduled' ? 'change' : 'approval'}.</div>
            <button type="button" className="av-success-back" onClick={() => setActionSuccess(null)}>Back to Appointments</button>
          </div>
        </div>
      )}

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

      {actionNotice && (
        <div className="av-queue-toast">
          <CheckSmallIcon />
          <span>{actionNotice}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setActionNotice(null)}
          >
            <XSmallIcon />
          </button>
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
                  <div className="av-student-cell">
                    <StudentAvatar
                      name={appt.studentName}
                      url={appt.studentAvatarUrl}
                    />
                    <div className="av-student-text">
                      <span className="av-student-name">{appt.studentName}</span>
                      {appt.referenceNo && (
                        <div className="av-ref">Ref: {appt.referenceNo}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="av-reason">{appt.reason}</td>
                <td>
                  <span
                    className={`av-status av-status-${
                      isPendingApproval(appt) ? 'pending' : appt.status.toLowerCase()
                    }`}
                  >
                    {isPendingApproval(appt) ? 'Pending' : appt.status}
                  </span>
                </td>
              </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="av-empty">
                  <div className="av-empty-inner">
                    <span className="av-empty-icon" aria-hidden="true">
                      <CalendarEmptyIcon />
                    </span>
                    <span className="av-empty-title">
                      {refQuery
                        ? 'No appointment found with that reference number'
                        : activeTab === 'pending'
                          ? 'No requests waiting for your approval'
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
                    <div className="av-student-cell">
                      <StudentAvatar
                        name={modal.appointment.studentName}
                        url={modal.appointment.studentAvatarUrl}
                        large
                      />
                      <strong>{modal.appointment.studentName}</strong>
                    </div>
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
                    disabled={!cancelReason.trim() || actionBusy}
                    onClick={confirmCancel}
                  >
                    {actionBusy ? 'Cancelling…' : 'Cancel Appointment'}
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

            {modal.type === 'decline' && (
              <>
                <h2>Decline Appointment Request</h2>

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

                <label className="av-modal-label" htmlFor="av-decline-reason">
                  Reason (optional)
                </label>
                <textarea
                  id="av-decline-reason"
                  className="av-modal-textarea"
                  rows={3}
                  maxLength={200}
                  placeholder="Add a reason so the student knows why..."
                  value={declineReason}
                  onChange={(event) => setDeclineReason(event.target.value)}
                />

                <div className="av-modal-warning">
                  <AlertIcon />
                  <p>
                    The student will be notified and the requested time will be
                    released.
                  </p>
                </div>

                <div className="av-modal-actions">
                  <button
                    type="button"
                    className="av-modal-btn av-modal-btn-danger"
                    onClick={confirmDecline}
                  >
                    Decline Request
                  </button>
                  <button
                    type="button"
                    className="av-modal-btn av-modal-btn-secondary"
                    onClick={closeModal}
                  >
                    Keep Request
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