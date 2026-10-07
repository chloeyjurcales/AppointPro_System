import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

// Keeps the faculty member's live queue running no matter which web page is
// open (mirrors what the mobile app does from App.tsx):
//   1. an approved appointment joins today's queue one hour before it starts;
//   2. the person at the front is marked "started" at their scheduled time.
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

type ScheduledAppointment = {
  id: string;
  student_id: string;
  date: string;
  start_time: string;
  end_time: string;
  students:
    | { profiles: Profile | Profile[] | null }
    | { profiles: Profile | Profile[] | null }[]
    | null;
};

type QueueRow = {
  id: string;
  started_at: string | null;
  appointments:
    | { student_id: string; date: string; start_time: string; status: string; faculty_approval_status?: string | null }
    | { student_id: string; date: string; start_time: string; status: string; faculty_approval_status?: string | null }[]
    | null;
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
          'id, student_id, date, start_time, end_time, students ( profiles ( full_name ) )',
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
        if (now < opensAt || now > end) continue;

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