import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import './QueueView.css';

type QueueViewProps = {
  session: Session;
  facultyName: string;
};

type QueueEntry = {
  id: string;
  faculty_id: string;
  appointment_id: string | null;
  student_name: string;
  duration_minutes: number;
  started_at: string | null;
  queue_date: string;
  position: number;
  appointments:
    | {
        id: string;
        student_id: string;
        date: string;
        start_time: string;
        end_time: string;
        status: string;
        reference_no: string | null;
        purpose: string | null;
        category: string | null;
        mode: 'Face-to-Face' | 'Online';
        location: string | null;
        students:
          | {
              profiles:
                | { full_name: string; avatar_url: string | null }
                | { full_name: string; avatar_url: string | null }[]
                | null;
            }
          | {
              profiles:
                | { full_name: string; avatar_url: string | null }
                | { full_name: string; avatar_url: string | null }[]
                | null;
            }[]
          | null;
      }
    | {
        id: string;
        student_id: string;
        date: string;
        start_time: string;
        end_time: string;
        status: string;
        reference_no: string | null;
        purpose: string | null;
        category: string | null;
        mode: 'Face-to-Face' | 'Online';
        location: string | null;
        students:
          | {
              profiles:
                | { full_name: string; avatar_url: string | null }
                | { full_name: string; avatar_url: string | null }[]
                | null;
            }
          | {
              profiles:
                | { full_name: string; avatar_url: string | null }
                | { full_name: string; avatar_url: string | null }[]
                | null;
            }[]
          | null;
      }[]
    | null;
};

type ScheduledAppointment = {
  id: string;
  student_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  faculty_approval_status: string;
  purpose: string | null;
  category: string | null;
  students:
    | { profiles: { full_name: string } | { full_name: string }[] | null }
    | { profiles: { full_name: string } | { full_name: string }[] | null }[]
    | null;
};

type QueueItem = {
  id: string;
  appointmentId: string | null;
  studentUserId: string | null;
  studentName: string;
  avatarUrl: string | null;
  durationMinutes: number;
  startedAt: Date | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  referenceNo: string | null;
  purpose: string;
  mode: 'Face-to-Face' | 'Online' | null;
  location: string | null;
};

function getFirst<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function getManilaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

function manilaDateKey(date = new Date()): string {
  const p = getManilaParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function manilaDateFromDb(dateKey: string, time24: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute, second = 0] = time24.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second));
}

function queueWindowStart(dateKey: string, startTime: string): Date {
  return new Date(manilaDateFromDb(dateKey, startTime).getTime() - 60 * 60 * 1000);
}

function formatClockTime(time24: string | null): string {
  if (!time24) return '—';
  const [hourText, minuteText] = time24.split(':');
  let hour = Number(hourText);
  const minute = Number(minuteText);
  const period = hour >= 12 ? 'PM' : 'AM';
  hour %= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${String(minute).padStart(2, '0')} ${period}`;
}

function formatDateLabel(dateKey: string | null): string {
  if (!dateKey) return '—';
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function remainingSeconds(item: QueueItem, now: Date): number {
  if (!item.startedAt) {
    if (item.date && item.startTime) {
      return Math.max(
        0,
        Math.floor((manilaDateFromDb(item.date, item.startTime).getTime() - now.getTime()) / 1000),
      );
    }
    return item.durationMinutes * 60;
  }

  return Math.max(
    0,
    item.durationMinutes * 60 - Math.floor((now.getTime() - item.startedAt.getTime()) / 1000),
  );
}

function mapQueueRow(row: QueueEntry): QueueItem {
  const appointment = getFirst(row.appointments);
  const student = getFirst(appointment?.students);
  const profile = getFirst(student?.profiles);

  return {
    id: row.id,
    appointmentId: row.appointment_id,
    studentUserId: appointment?.student_id ?? null,
    studentName: profile?.full_name ?? row.student_name,
    avatarUrl: profile?.avatar_url ?? null,
    durationMinutes: Math.max(1, row.duration_minutes || 1),
    startedAt: row.started_at ? new Date(row.started_at) : null,
    date: appointment?.date ?? row.queue_date ?? null,
    startTime: appointment?.start_time ?? null,
    endTime: appointment?.end_time ?? null,
    referenceNo: appointment?.reference_no ?? null,
    purpose: appointment?.purpose ?? appointment?.category ?? 'Consultation',
    mode: appointment?.mode ?? null,
    location: appointment?.location ?? null,
  };
}

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'ST'
  );
}

export default function QueueView({ session, facultyName }: QueueViewProps) {
  const facultyId = session.user.id;
  const [now, setNow] = useState(() => new Date());
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const syncingRef = useRef(false);
  const startingRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadQueue = useCallback(async () => {
    const today = manilaDateKey();
    const { data, error: loadError } = await supabase
      .from('queue_entries')
      .select(
        `id, faculty_id, appointment_id, student_name, duration_minutes, started_at, queue_date, position,
         appointments (
           id, student_id, date, start_time, end_time, status, reference_no, purpose, category, mode, location,
           students ( profiles ( full_name, avatar_url ) )
         )`,
      )
      .eq('faculty_id', facultyId)
      .eq('queue_date', today)
      .order('position', { ascending: true });

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as unknown as QueueEntry[];
    const staleIds = rows
      .filter((row) => {
        const appointment = getFirst(row.appointments);
        return !!appointment?.status && appointment.status !== 'upcoming';
      })
      .map((row) => row.id);

    if (staleIds.length) {
      await supabase.from('queue_entries').delete().in('id', staleIds);
    }

    const mapped = rows
      .filter((row) => !staleIds.includes(row.id))
      .map(mapQueueRow)
      .sort((a, b) => {
        const aStarted = a.startedAt ? 0 : 1;
        const bStarted = b.startedAt ? 0 : 1;
        if (aStarted !== bStarted) return aStarted - bStarted;
        if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
        return 0;
      });

    setQueue(mapped);
    setError(null);
    setLoading(false);
  }, [facultyId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadQueue();
    }, 0);

    const poll = window.setInterval(() => {
      void loadQueue();
    }, 2000);
    const channel = supabase
      .channel(`web-faculty-queue-${facultyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_entries',
          filter: `faculty_id=eq.${facultyId}`,
        },
        () => loadQueue(),
      )
      .subscribe();

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [facultyId, loadQueue]);

  // The faculty client is authoritative for scheduled queue creation, matching
  // the mobile app. Approved appointments join exactly one hour before start.
  useEffect(() => {
    if (now.getSeconds() % 2 !== 0 || syncingRef.current) return;

    const syncScheduledQueue = async () => {
      const today = manilaDateKey(now);
      const { data: appointmentData, error: appointmentError } = await supabase
        .from('appointments')
        .select('id, student_id, date, start_time, end_time, status, faculty_approval_status, purpose, category, students ( profiles ( full_name ) )')
        .eq('faculty_id', facultyId)
        .eq('date', today)
        .eq('status', 'upcoming')
        .eq('faculty_approval_status', 'approved');
      const appointments = (appointmentData ?? []) as unknown as ScheduledAppointment[];

      if (appointmentError || appointments.length === 0) return;

      syncingRef.current = true;
      try {
        for (const appointment of appointments) {
          const start = manilaDateFromDb(appointment.date, appointment.start_time);
          const end = manilaDateFromDb(appointment.date, appointment.end_time);
          const open = queueWindowStart(appointment.date, appointment.start_time);

          if (now < open || now > end) continue;

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

          const nextPosition = ((positionRows?.[0] as { position?: number } | undefined)?.position ?? 0) + 1;
          const studentRow = getFirst(appointment.students);
          const studentProfile = Array.isArray(studentRow?.profiles) ? studentRow.profiles[0] : studentRow?.profiles;
          const studentName = studentProfile?.full_name ?? 'Student';
          const durationMinutes = Math.max(1,
            Math.round((end.getTime() - start.getTime()) / 60000),
          );

          const { error: insertError } = await supabase.from('queue_entries').insert({
            faculty_id: facultyId,
            appointment_id: appointment.id,
            student_name: studentName,
            duration_minutes: durationMinutes,
            queue_date: today,
            position: nextPosition,
          });

          if (insertError && insertError.code !== '23505') {
            console.log('Could not add appointment to queue:', insertError.message);
          }
        }
      } finally {
        syncingRef.current = false;
        loadQueue();
      }
    };

    syncScheduledQueue();
  }, [facultyId, now, loadQueue]);

  // Start the front appointment at its actual scheduled time. If the previous
  // student finishes early, handleCompleteCurrent starts the next one early.
  useEffect(() => {
    const front = queue[0];
    if (!front || front.startedAt || startingRef.current === front.id) return;
    if (!front.date || !front.startTime) return;
    if (now < manilaDateFromDb(front.date, front.startTime)) return;

    startingRef.current = front.id;
    supabase
      .from('queue_entries')
      .update({
        started_at: manilaDateFromDb(front.date, front.startTime).toISOString(),
      })
      .eq('id', front.id)
      .is('started_at', null)
      .then(async ({ error: updateError }) => {
        startingRef.current = null;
        if (updateError) return;
        await loadQueue();
        if (front.studentUserId) {
          await supabase.from('notifications').insert({
            user_id: front.studentUserId,
            sender_id: facultyId,
            icon: 'sync-outline',
            title: "It's Your Turn",
            description: `${facultyName} is ready for you now. Your appointment has started — please head over.`,
          });
        }
      });
  }, [queue, now, facultyId, facultyName, loadQueue]);

  const current = queue[0] ?? null;
  const currentSeconds = current ? remainingSeconds(current, now) : 0;
  const currentStarted = !!current?.startedAt;
  const currentDone = currentStarted && currentSeconds <= 0;

  const handleCompleteCurrent = async () => {
    if (!current || busy || !currentStarted) return;
    setBusy(true);
    setNotice(null);

    try {
      if (current.appointmentId) {
        const { error: appointmentError } = await supabase
          .from('appointments')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', current.appointmentId)
          .eq('faculty_id', facultyId);
        if (appointmentError) throw new Error(appointmentError.message);
      }

      const { error: deleteError } = await supabase
        .from('queue_entries')
        .delete()
        .eq('id', current.id);
      if (deleteError) throw new Error(deleteError.message);

      if (current.studentUserId) {
        await supabase.from('notifications').insert({
          user_id: current.studentUserId,
          sender_id: facultyId,
          icon: 'checkmark-circle-outline',
          title: 'Appointment Completed',
          description: `Your appointment with ${facultyName} has been completed.`,
        });
      }

      const next = queue[1];
      if (next) {
        const { error: nextError } = await supabase
          .from('queue_entries')
          .update({ started_at: new Date().toISOString() })
          .eq('id', next.id)
          .is('started_at', null);
        if (nextError) throw new Error(nextError.message);

        if (next.studentUserId) {
          await supabase.from('notifications').insert({
            user_id: next.studentUserId,
            sender_id: facultyId,
            icon: 'sync-outline',
            title: "It's Your Turn",
            description: `${facultyName} finished the previous appointment early. It is now your turn. Please head over.`,
          });
        }

        setNotice(`${next.studentName} is now being served.`);
      } else {
        setNotice('No more appointments in the queue for this time block.');
      }

      await loadQueue();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Could not advance the queue.');
    } finally {
      setBusy(false);
    }
  };

  const nextUp = useMemo(() => queue.slice(1), [queue]);

  return (
    <div className="qv-page">
      <div className="qv-header">
        <div>
          <h1>Queue</h1>
          <p>Manage today&apos;s live consultation queue.</p>
        </div>
        <div className="qv-live-pill"><span /> Live</div>
      </div>

      <div className="qv-banner">
        <span className="qv-banner-icon">i</span>
        <p>
          Approved appointments enter the queue <strong>one hour before</strong> their scheduled consultation.
          When a consultation finishes early, use <strong>Done — Call Next</strong> to immediately advance the queue.
        </p>
      </div>

      {notice && <div className="qv-notice" role="status">{notice}</div>}
      {error && <div className="qv-error" role="alert">{error}</div>}

      <div className="qv-stats">
        <div className="qv-stat-card">
          <span className="qv-stat-value">{queue.length}</span>
          <span className="qv-stat-label">Waiting</span>
        </div>
        <div className="qv-stat-card">
          <span className="qv-stat-value">{current ? 1 : 0}</span>
          <span className="qv-stat-label">Now Serving</span>
        </div>
        <div className="qv-stat-card">
          <span className="qv-stat-value">{nextUp.length}</span>
          <span className="qv-stat-label">Next in Line</span>
        </div>
      </div>

      <div className="qv-grid">
        <section className="qv-card qv-now-card">
          <div className="qv-card-heading">
            <div>
              <h2>Now Serving</h2>
              <p>Faculty control for the current appointment.</p>
            </div>
          </div>

          {loading ? (
            <div className="qv-empty">Loading today&apos;s queue…</div>
          ) : !current ? (
            <div className="qv-empty">
              <div className="qv-empty-icon">✓</div>
              <strong>No one is waiting right now.</strong>
              <span>Upcoming approved appointments will appear one hour before their start time.</span>
            </div>
          ) : (
            <div className="qv-current">
              <div className="qv-person">
                {current.avatarUrl ? (
                  <img src={current.avatarUrl} alt="" className="qv-avatar" />
                ) : (
                  <div className="qv-avatar qv-avatar-fallback">{getInitials(current.studentName)}</div>
                )}
                <div>
                  <h3>{current.studentName}</h3>
                  <p>{current.purpose}</p>
                  {current.referenceNo && <span>Ref: {current.referenceNo}</span>}
                </div>
              </div>

              <div className="qv-time-block">
                <span>Scheduled</span>
                <strong>{formatClockTime(current.startTime)} – {formatClockTime(current.endTime)}</strong>
                <small>{formatDateLabel(current.date)}</small>
              </div>

              <div className={`qv-countdown${currentDone ? ' qv-countdown-done' : ''}`}>
                {currentDone
                  ? 'Appointment Done'
                  : currentStarted
                    ? `${formatCountdown(currentSeconds)} remaining`
                    : `Starts in ${formatCountdown(currentSeconds)}`}
              </div>

              {current.mode === 'Online' && current.location && (
                <a
                  className="qv-meeting-link"
                  href={/^https?:\/\//i.test(current.location) ? current.location : `https://${current.location}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open meeting link
                </a>
              )}

              {currentStarted && (
                <button
                  type="button"
                  className="qv-done-button"
                  onClick={handleCompleteCurrent}
                  disabled={busy}
                >
                  ✓ {busy ? 'Advancing…' : currentDone ? 'Complete — Call Next' : 'Done — Call Next'}
                </button>
              )}
            </div>
          )}
        </section>

        <section className="qv-card qv-list-card">
          <div className="qv-card-heading">
            <div>
              <h2>Current Queue</h2>
              <p>Appointments are ordered by their scheduled time.</p>
            </div>
          </div>

          {queue.length === 0 ? (
            <div className="qv-empty qv-list-empty">No one is in the queue right now.</div>
          ) : (
            <div className="qv-list">
              {queue.map((item, index) => {
                const isCurrent = index === 0;
                const seconds = isCurrent ? remainingSeconds(item, now) : null;
                const started = isCurrent && !!item.startedAt;
                return (
                  <div key={item.id} className={`qv-row${isCurrent ? ' qv-row-current' : ''}`}>
                    <span className="qv-position">#{index + 1}</span>
                    {item.avatarUrl ? (
                      <img src={item.avatarUrl} alt="" className="qv-row-avatar" />
                    ) : (
                      <div className="qv-row-avatar qv-avatar-fallback">{getInitials(item.studentName)}</div>
                    )}
                    <div className="qv-row-main">
                      <strong>{item.studentName}</strong>
                      <span>{formatClockTime(item.startTime)} – {formatClockTime(item.endTime)} · {item.purpose}</span>
                    </div>
                    <div className="qv-row-status">
                      {isCurrent
                        ? started
                          ? seconds !== null && seconds <= 0
                            ? 'Done'
                            : `${formatCountdown(seconds ?? 0)} left`
                          : `Starts ${formatCountdown(seconds ?? 0)}`
                        : 'Scheduled'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
