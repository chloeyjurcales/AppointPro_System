import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

// Keeps the faculty member's live queue running no matter which web page is
// open (mirrors what the mobile app does from App.tsx):
//   1. an approved appointment joins today's queue one hour before it starts;
//   2. the person at the front is marked "started" at their scheduled time.
// 3. the queue stops when its consultation schedule ends (e.g. a 10–11 AM
//    schedule closes at 11:00) and only reopens for the next schedule.
// QueueView only displays the queue and handles Done / Skip.
//
// Appointment date/time values have no timezone; AppointPro treats them as
// Philippine Standard Time (Asia/Manila, UTC+8) on every device.

function getFirst<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function manilaDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function manilaDateFromDb(dateKey: string, time24: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute, second = 0] = time24.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second));
}

function formatClockTime(time24: string): string {
  const [hourText, minuteText] = time24.split(':');
  let hour = Number(hourText);
  const minute = Number(minuteText);
  const period = hour >= 12 ? 'PM' : 'AM';
  hour %= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${String(minute).padStart(2, '0')} ${period}`;
}

type Profile = { full_name: string };

type SlotEnd = { end_time: string } | { end_time: string }[] | null;

// The queue's closing time: the end of the consultation schedule (availability
// slot) the appointment was booked in, or the appointment's own end when it has
// no slot (e.g. after a reschedule).
function queueWindowEnd(
  date: string,
  appointmentEnd: string,
  slot: SlotEnd | undefined,
): Date {
  const slotEnd = getFirst(slot)?.end_time;
  const end = manilaDateFromDb(date, appointmentEnd);
  if (!slotEnd) return end;
  const blockEnd = manilaDateFromDb(date, slotEnd);
  return blockEnd > end ? blockEnd : end;
}

type ScheduledAppointment = {
  id: string;
  student_id: string;
  date: string;
  start_time: string;
  end_time: string;
  availability_slots: SlotEnd;
  students:
    | { profiles: Profile | Profile[] | null }
    | { profiles: Profile | Profile[] | null }[]
    | null;
};

type QueueAppointment = {
  id: string;
  student_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  faculty_approval_status?: string | null;
  availability_slots: SlotEnd;
};

type QueueRow = {
  id: string;
  started_at: string | null;
  appointments: QueueAppointment | QueueAppointment[] | null;
};

export function useQueueEngine(facultyId: string, facultyName: string) {
  const busyRef = useRef(false);
  const nameRef = useRef(facultyName);

  useEffect(() => {
    nameRef.current = facultyName;
  }, [facultyName]);

  useEffect(() => {
    let cancelled = false;

    const notify = async (
      userId: string,
      icon: string,
      title: string,
      description: string,
      fromFaculty: boolean,
    ) => {
      await supabase.from('notifications').insert({
        user_id: userId,
        ...(fromFaculty ? { sender_id: facultyId } : {}),
        icon,
        title,
        description,
      });
    };

    const syncScheduledQueue = async (now: Date) => {
      const today = manilaDateKey(now);
      const { data, error } = await supabase
        .from('appointments')
        .select(
          'id, student_id, date, start_time, end_time, availability_slots ( end_time ), students ( profiles ( full_name ) )',
        )
        .eq('faculty_id', facultyId)
        .eq('date', today)
        .eq('status', 'upcoming')
        .or('faculty_approval_status.eq.approved,faculty_approval_status.is.null');
      if (error || !data?.length) return;

      for (const appointment of data as unknown as ScheduledAppointment[]) {
        if (cancelled) return;
        const start = manilaDateFromDb(appointment.date, appointment.start_time);
        const end = manilaDateFromDb(appointment.date, appointment.end_time);
        const opensAt = new Date(start.getTime() - 60 * 60 * 1000);
        const closesAt = queueWindowEnd(
          appointment.date,
          appointment.end_time,
          appointment.availability_slots,
        );
        // Outside the schedule's window the queue is closed: it opens one hour
        // before this appointment and stops when the schedule ends.
        if (now < opensAt || now > end || now >= closesAt) continue;

        const { data: existing, error: existingError } = await supabase
          .from('queue_entries')
          .select('id')
          .eq('appointment_id', appointment.id)
          .maybeSingle();
        if (existingError || existing) continue;

        const { data: positionRows } = await supabase
          .from('queue_entries')
          .select('position')
          .eq('faculty_id', facultyId)
          .eq('queue_date', today)
          .order('position', { ascending: false })
          .limit(1);
        const nextPosition =
          ((positionRows?.[0] as { position?: number } | undefined)?.position ?? 0) + 1;

        const student = getFirst(appointment.students);
        const profile = getFirst(student?.profiles);
        const studentName = profile?.full_name ?? 'Student';

        const { error: insertError } = await supabase.from('queue_entries').insert({
          faculty_id: facultyId,
          appointment_id: appointment.id,
          student_name: studentName,
          duration_minutes: Math.max(
            1,
            Math.round((end.getTime() - start.getTime()) / 60000),
          ),
          queue_date: today,
          position: nextPosition,
        });

        // Another client (e.g. the phone) may have added it first; only the
        // client that actually created the row sends the reminders.
        if (insertError) {
          if (insertError.code !== '23505') {
            console.log('Could not add appointment to queue:', insertError.message);
          }
          continue;
        }

        const timeLabel = formatClockTime(appointment.start_time);
        await notify(
          facultyId,
          'notifications-outline',
          'Upcoming Appointment',
          `${studentName}'s appointment starts at ${timeLabel}. The queue is now open — the appointment is on the way.`,
          false,
        );
        await notify(
          appointment.student_id,
          'notifications-outline',
          'Your Appointment Is Coming Up',
          `Your appointment with ${nameRef.current} starts at ${timeLabel}. The queue is now open — your appointment is on the way.`,
          true,
        );
      }
    };

    // Stops the queue once its consultation schedule is over. Anyone still in
    // it is removed; a student who was being served is marked completed. Waiting
    // students are left as scheduled (never silently cancelled). The queue then
    // stays empty until the next schedule's window opens.
    const closeFinishedQueue = async (now: Date) => {
      const today = manilaDateKey(now);
      const { data, error } = await supabase
        .from('queue_entries')
        .select(
          'id, started_at, appointments ( id, student_id, date, start_time, end_time, status, availability_slots ( end_time ) )',
        )
        .eq('faculty_id', facultyId)
        .eq('queue_date', today);
      if (error || !data?.length) return;

      for (const row of data as unknown as QueueRow[]) {
        if (cancelled) return;
        const appointment = getFirst(row.appointments);
        if (!appointment) continue;
        const closesAt = queueWindowEnd(
          appointment.date,
          appointment.end_time,
          appointment.availability_slots,
        );
        if (now < closesAt) continue;

        if (row.started_at && appointment.status === 'upcoming') {
          await supabase
            .from('appointments')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', appointment.id)
            .eq('faculty_id', facultyId)
            .eq('status', 'upcoming');
        }
        await supabase.from('queue_entries').delete().eq('id', row.id);
      }
    };

    const startFrontIfDue = async (now: Date) => {
      const today = manilaDateKey(now);
      const { data, error } = await supabase
        .from('queue_entries')
        .select(
          'id, started_at, appointments ( student_id, date, start_time, status, faculty_approval_status )',
        )
        .eq('faculty_id', facultyId)
        .eq('queue_date', today);
      if (error || !data?.length) return;

      const rows = data as unknown as QueueRow[];

      // Drop spots whose appointment was cancelled / completed elsewhere.
      const staleIds = rows
        .filter((row) => {
          const appointment = getFirst(row.appointments);
          return (
            (!!appointment?.status && appointment.status !== 'upcoming') ||
            (!!appointment?.faculty_approval_status && appointment.faculty_approval_status !== 'approved')
          );
        })
        .map((row) => row.id);
      if (staleIds.length) {
        await supabase.from('queue_entries').delete().in('id', staleIds);
      }

      const live = rows
        .filter((row) => !staleIds.includes(row.id))
        .sort((a, b) => {
          if (!!a.started_at !== !!b.started_at) return a.started_at ? -1 : 1;
          const aTime = getFirst(a.appointments)?.start_time;
          const bTime = getFirst(b.appointments)?.start_time;
          if (aTime && bTime) return aTime.localeCompare(bTime);
          return 0;
        });

      const front = live[0];
      if (!front || front.started_at) return;
      const appointment = getFirst(front.appointments);
      if (!appointment) return;
      const startsAt = manilaDateFromDb(appointment.date, appointment.start_time);
      if (now < startsAt) return;

      // `.is('started_at', null)` + select() means only one client wins, so
      // only one "It's Your Turn" is sent even with web and phone both open.
      const { data: updated, error: updateError } = await supabase
        .from('queue_entries')
        .update({ started_at: startsAt.toISOString() })
        .eq('id', front.id)
        .is('started_at', null)
        .select('id');
      if (updateError || !updated?.length) return;

      const timeLabel = formatClockTime(appointment.start_time);
      await notify(
        appointment.student_id,
        'sync-outline',
        "It's Your Turn",
        `${nameRef.current} is ready for you now (${timeLabel}). Your appointment has started — please head over.`,
        true,
      );
      await notify(
        facultyId,
        'sync-outline',
        'Appointment Started',
        `Your ${timeLabel} appointment is now being served.`,
        false,
      );
    };

    const tick = async () => {
      if (busyRef.current || cancelled) return;
      busyRef.current = true;
      try {
        const now = new Date();
        await closeFinishedQueue(now);
        await syncScheduledQueue(now);
        await startFrontIfDue(now);
      } catch (err) {
        console.log('Queue engine failed:', err);
      } finally {
        busyRef.current = false;
      }
    };

    void tick();
    const interval = window.setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [facultyId]);
}