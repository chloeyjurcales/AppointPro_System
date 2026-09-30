import { useEffect, useState, type ReactElement } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import AppointmentsView from './AppointmentsView';
import FacultyView, { type FacultyTab } from './FacultyView';
import NotificationsView, { type Notification } from './NotificationsView';
import SettingsView from './SettingsView';
import './Dashboard.css';

type DashboardProps = {
  session: Session;
  onNavigate?: (section: NavId) => void;
  onLogout?: () => void | Promise<void>;
};

export type NavId =
  | 'home'
  | 'appointments'
  | 'faculty'
  | 'notifications'
  | 'settings';

type NavItem = {
  id: NavId;
  label: string;
  icon: () => ReactElement;
  badge?: number;
};

type ScheduleItem = {
  id: string;
  time: string;
  studentName: string;
  type: string;
  status: 'Upcoming' | 'Completed' | 'Cancelled';
};

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'appointments', label: 'Appointments', icon: AppointmentsIcon },
  { id: 'faculty', label: 'Faculty', icon: FacultyIcon },
  { id: 'notifications', label: 'Notifications', icon: BellIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const QUOTE = 'Better conversations build a brighter future.';

// ---------- Real data: today's schedule / stats ----------

// 'YYYY-MM-DD' for whatever "today" is right now — matches the
// `appointments.date` column format.
function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// "14:30:00" -> "2:30 PM"
function formatClockTime(time24: string): string {
  const [hourStr, minuteStr] = time24.split(':');
  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute.toString().padStart(2, '0')} ${period}`;
}

const STATUS_LABELS: Record<string, ScheduleItem['status']> = {
  upcoming: 'Upcoming',
  completed: 'Completed',
  canceled: 'Cancelled',
  cancelled: 'Cancelled',
};

// Shape of an `appointments` row (joined with the booking student's own
// profile) as returned by Supabase for today's schedule.
type DbTodayAppointment = {
  id: string;
  start_time: string;
  end_time: string;
  category: string | null;
  status: string;
  students: {
    profiles: { full_name: string } | { full_name: string }[] | null;
  } | null;
};

function mapDbTodayAppointment(row: DbTodayAppointment): ScheduleItem {
  const profile = Array.isArray(row.students?.profiles)
    ? row.students?.profiles[0]
    : row.students?.profiles;

  return {
    id: row.id,
    time: `${formatClockTime(row.start_time)} – ${formatClockTime(row.end_time)}`,
    studentName: profile?.full_name ?? 'Unknown Student',
    type: row.category ?? 'Consultation',
    status: STATUS_LABELS[row.status] ?? 'Upcoming',
  };
}

// ---------- Real data: notifications ----------

// Shape of a row from the real `notifications` table in Supabase.
type DbNotification = {
  id: string;
  icon: string;
  title: string;
  description: string | null;
  read: boolean;
  created_at: string;
};

// The `notifications` table doesn't have its own "kind" column, so the
// icon string chosen when the row was created (see App.tsx's
// sendNotification calls) is used to pick which of the four visual
// styles NotificationsView already supports.
function iconToNotificationType(icon: string): Notification['type'] {
  if (icon.includes('close-circle') || icon.includes('calendar')) {
    return 'appointment';
  }
  if (icon.includes('sync') || icon.includes('time')) return 'reminder';
  if (icon.includes('checkmark') || icon.includes('success')) return 'success';
  return 'system';
}

// "10 minutes ago" / "Yesterday" / "Sep 3, 2026" from a real timestamp.
function formatRelativeTime(isoTimestamp: string): string {
  const then = new Date(isoTimestamp).getTime();
  const diffMinutes = Math.max(0, Math.floor((Date.now() - then) / 60000));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return new Date(isoTimestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function mapDbNotification(row: DbNotification): Notification {
  return {
    id: row.id,
    type: iconToNotificationType(row.icon),
    title: row.title,
    message: row.description ?? '',
    time: formatRelativeTime(row.created_at),
    unread: !row.read,
  };
}

export default function Dashboard({
  session,
  onNavigate,
  onLogout,
}: DashboardProps) {
  const user = session.user;
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? '';

  const firstAndLast = fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(' ');

  const initials =
    firstAndLast
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';

  // The signed-in faculty member's profile photo (same profiles.avatar_url the
  // mobile app uses). Falls back to the initials above when there is none.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (isMounted) setAvatarUrl((data?.avatar_url as string | null) ?? null);
      });
    return () => {
      isMounted = false;
    };
  }, [user.id]);

  // SlotIQ isn't built yet — its Quick Action just shows this short notice.
  const [slotIqNotice, setSlotIqNotice] = useState(false);

  useEffect(() => {
    if (!slotIqNotice) return;
    const timer = window.setTimeout(() => setSlotIqNotice(false), 3500);
    return () => window.clearTimeout(timer);
  }, [slotIqNotice]);

  const [activeNav, setActiveNav] = useState<NavId>('home');
  const [facultyInitialTab, setFacultyInitialTab] =
    useState<FacultyTab>('profile');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [facultySearch, setFacultySearch] = useState('');
  const unreadNotificationCount = notifications.filter(
    (notification) => notification.unread,
  ).length;

  const [todaySchedule, setTodaySchedule] = useState<ScheduleItem[]>([]);
  const [inQueueCount, setInQueueCount] = useState(0);
  // There's no "reschedule request" concept in the schema yet — a
  // faculty-initiated reschedule applies immediately rather than sitting
  // in a pending state, and a student never requests one either. This
  // stays at 0 (honestly, not faked) until that workflow exists.
  const pendingReschedulesCount = 0;

  const facultyId = session.user.id;

  // Loads today's real appointments for this faculty member (backs both
  // the "Today's Schedule" list and the Appointments stat), then keeps
  // it live via Realtime so a new booking/cancellation shows up without
  // a manual refresh.
  useEffect(() => {
    let isMounted = true;
    const today = toDateKey(new Date());

    const loadTodaySchedule = () => {
      supabase
        .from('appointments')
        .select(
          `id, start_time, end_time, category, status,
           students ( profiles ( full_name ) )`,
        )
        .eq('faculty_id', facultyId)
        .eq('date', today)
        .order('start_time', { ascending: true })
        .then(({ data, error }) => {
          if (!isMounted) return;
          if (error) {
            console.log('Failed to load today\'s schedule:', error.message);
            return;
          }
          setTodaySchedule(
            (data as unknown as DbTodayAppointment[]).map(mapDbTodayAppointment),
          );
        });
    };

    loadTodaySchedule();

    const channel = supabase
      .channel(`dashboard-appointments-${facultyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `faculty_id=eq.${facultyId}`,
        },
        () => loadTodaySchedule(),
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [facultyId]);

  // Loads today's real walk-in queue length for the "In Queue" stat.
  useEffect(() => {
    let isMounted = true;
    const today = toDateKey(new Date());

    const loadQueueCount = () => {
      supabase
        .from('queue_entries')
        .select('id', { count: 'exact', head: true })
        .eq('faculty_id', facultyId)
        .eq('queue_date', today)
        .then(({ count, error }) => {
          if (!isMounted) return;
          if (error) {
            console.log('Failed to load queue count:', error.message);
            return;
          }
          setInQueueCount(count ?? 0);
        });
    };

    loadQueueCount();

    const channel = supabase
      .channel(`dashboard-queue-${facultyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_entries',
          filter: `faculty_id=eq.${facultyId}`,
        },
        () => loadQueueCount(),
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [facultyId]);

  // Loads this faculty member's real notifications, then keeps them live
  // via Realtime — new rows (e.g. a student cancelling or booking) appear
  // immediately, and read/delete stay in sync if changed from elsewhere.
  useEffect(() => {
    let isMounted = true;

    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', facultyId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.log('Failed to load notifications:', error.message);
          return;
        }
        setNotifications((data as DbNotification[]).map(mapDbNotification));
      });

    const channel = supabase
      .channel(`dashboard-notifications-${facultyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${facultyId}`,
        },
        (payload) => {
          const newItem = mapDbNotification(payload.new as DbNotification);
          setNotifications((prev) => [newItem, ...prev]);
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [facultyId]);

  // Marks every unread notification as read, both locally and in
  // Supabase.
  const handleMarkAllNotificationsRead = () => {
    const unreadIds = notifications
      .filter((notification) => notification.unread)
      .map((notification) => notification.id);
    if (unreadIds.length === 0) return;

    setNotifications((current) =>
      current.map((notification) => ({ ...notification, unread: false })),
    );

    supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds)
      .then(({ error }) => {
        if (error) console.log('Failed to mark notifications read:', error.message);
      });
  };

  const handleMarkSelectedNotificationsRead = (ids: string[]) => {
    setNotifications((current) =>
      current.map((notification) =>
        ids.includes(notification.id)
          ? { ...notification, unread: false }
          : notification,
      ),
    );

    supabase
      .from('notifications')
      .update({ read: true })
      .in('id', ids)
      .then(({ error }) => {
        if (error) console.log('Failed to mark notifications read:', error.message);
      });
  };

  const handleDeleteSelectedNotifications = (ids: string[]) => {
    setNotifications((current) =>
      current.filter((notification) => !ids.includes(notification.id)),
    );

    supabase
      .from('notifications')
      .delete()
      .in('id', ids)
      .then(({ error }) => {
        if (error) console.log('Failed to delete notifications:', error.message);
      });
  };

  const handleNavClick = (id: NavId, facultyTab: FacultyTab = 'profile') => {
    setActiveNav(id);
    if (id === 'faculty') setFacultyInitialTab(facultyTab);
    onNavigate?.(id);
  };

  const openFaculty = (tab: FacultyTab) => handleNavClick('faculty', tab);

  const handleLogout = async () => {
    if (onLogout) {
      await onLogout();
    } else {
      await supabase.auth.signOut();
    }
  };

  return (
    <div className="db-page">
      <aside className="db-sidebar">
        <div className="db-sidebar-brand">
          <div className="db-sidebar-brand-mark">
            <CapIcon />
          </div>
          <span>AppointPro</span>
        </div>

        <nav className="db-nav">
          {NAV_ITEMS.map(({ id, label, icon: Icon, badge }) => {
            const displayBadge =
              id === 'notifications' ? unreadNotificationCount : badge;

            return (
              <button
                key={id}
                type="button"
                className={`db-nav-item${
                  activeNav === id ? ' db-nav-item-active' : ''
                }`}
                onClick={() => handleNavClick(id)}
              >
                <Icon />
                <span>{label}</span>

                {typeof displayBadge === 'number' && displayBadge > 0 && (
                  <span className="db-nav-badge">{displayBadge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="db-sidebar-footer">
          <button
            type="button"
            className="db-sidebar-profile"
            onClick={handleLogout}
            title="Log out"
          >
            <span className="db-sidebar-avatar">
              {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
            </span>

            <span className="db-sidebar-profile-text">
              <span className="db-sidebar-profile-name">
                {firstAndLast || user.email}
              </span>
              <span className="db-sidebar-profile-role">Faculty</span>
            </span>

            <LogoutIcon />
          </button>
        </div>
      </aside>

      <div className="db-body">
        <header className="db-topbar">
          {activeNav === 'faculty' ? (
            <div className="db-search">
              <SearchIcon />
              <input
                type="text"
                placeholder="Search faculty members..."
                value={facultySearch}
                onChange={(event) => setFacultySearch(event.target.value)}
              />
            </div>
          ) : (
            <div />
          )}

          <div className="db-topbar-icons">
            <button
              type="button"
              className="db-icon-btn"
              aria-label="Notifications"
              onClick={() => handleNavClick('notifications')}
            >
              <BellIcon />
              {unreadNotificationCount > 0 && <span className="db-icon-dot" />}
            </button>

            <span className="db-avatar">
              {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
            </span>
          </div>
        </header>

        <main className="db-main">
          {activeNav === 'home' && (
            <>
              <div className="db-main-col">
                <section className="db-welcome">
                  <h1>Welcome, {firstAndLast || 'Faculty'}!</h1>
                  <p>Here&apos;s your schedule and upcoming appointments.</p>
                </section>

                <section className="db-stats db-stats-today">
                  <button
                    type="button"
                    className="db-stat-card db-stat-card-clickable"
                    onClick={() => handleNavClick('appointments')}
                  >
                    <div className="db-stat-icon">
                      <AppointmentsIcon />
                    </div>
                    <span className="db-stat-value">
                      {todaySchedule.filter((item) => item.status !== 'Cancelled').length}
                    </span>
                    <span className="db-stat-label">Appointments</span>
                  </button>

                  <button
                    type="button"
                    className="db-stat-card db-stat-card-clickable"
                    onClick={() => handleNavClick('appointments')}
                  >
                    <div className="db-stat-icon">
                      <ClockIcon />
                    </div>
                    <span className="db-stat-value">
                      {pendingReschedulesCount}
                    </span>
                    <span className="db-stat-label">
                      Pending
                      <br />
                      Reschedules
                    </span>
                  </button>

                  <button
                    type="button"
                    className="db-stat-card db-stat-card-clickable"
                    onClick={() => handleNavClick('appointments')}
                  >
                    <div className="db-stat-icon">
                      <QueueIcon />
                    </div>
                    <span className="db-stat-value">
                      {inQueueCount}
                    </span>
                    <span className="db-stat-label">
                      In
                      <br />
                      Queue
                    </span>
                  </button>
                </section>

                <section className="db-schedule-card">
                  <div className="db-schedule-header">
                    <h2>Today&apos;s Schedule</h2>

                    <button
                      type="button"
                      className="db-view-all"
                      onClick={() => handleNavClick('appointments')}
                    >
                      View All
                    </button>
                  </div>

                  {todaySchedule.length === 0 ? (
                    <p className="db-schedule-empty">
                      No appointments on your schedule today.
                    </p>
                  ) : (
                    <ul className="db-schedule-list">
                      {todaySchedule.map((item) => (
                        <li key={item.id} className="db-schedule-item">
                          <span className="db-schedule-time">{item.time}</span>
                          <span className="db-schedule-name">
                            {item.studentName}
                          </span>
                          <span className="db-schedule-type">{item.type}</span>
                          <span
                            className={`db-status-badge db-status-${item.status.toLowerCase()}`}
                          >
                            {item.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="db-quick-actions">
                  <h2>Quick Actions</h2>

                  <div className="db-quick-actions-grid">
                    <button
                      type="button"
                      className="db-quick-action"
                      onClick={() => handleNavClick('appointments')}
                    >
                      <span
                        className="db-quick-action-icon"
                        style={{ background: '#5B7FDE' }}
                      >
                        <AppointmentsIcon />
                      </span>
                      <span>Appointments</span>
                    </button>

                    <button
                      type="button"
                      className="db-quick-action"
                      onClick={() => openFaculty('settings')}
                    >
                      <span
                        className="db-quick-action-icon"
                        style={{ background: '#3FB68A' }}
                      >
                        <CheckIcon />
                      </span>
                      <span>Availability</span>
                    </button>

                    <button
                      type="button"
                      className="db-quick-action"
                      onClick={() => handleNavClick('appointments')}
                    >
                      <span
                        className="db-quick-action-icon"
                        style={{ background: '#F0C93A' }}
                      >
                        <QueueIcon />
                      </span>
                      <span>Queue</span>
                    </button>

                    <button
                      type="button"
                      className="db-quick-action"
                      onClick={() => setSlotIqNotice(true)}
                    >
                      <span
                        className="db-quick-action-icon"
                        style={{ background: 'var(--brand-500, #7a0e2c)' }}
                      >
                        <SparkleIcon />
                      </span>
                      <span>SlotIQ</span>
                    </button>
                  </div>
                </section>

                {slotIqNotice && (
                  <div className="db-toast" role="status" aria-live="polite">
                    <SparkleIcon />
                    <span>
                      <strong>SlotIQ</strong> is not available yet — it's coming
                      soon.
                    </span>
                    <button
                      type="button"
                      className="db-toast-close"
                      aria-label="Dismiss"
                      onClick={() => setSlotIqNotice(false)}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              <div className="db-right-rail">
                <CalendarCard />

                <div className="db-quote-card">
                  <QuoteIcon />
                  <p>&ldquo;{QUOTE}&rdquo;</p>
                </div>
              </div>
            </>
          )}

          {activeNav === 'appointments' && (
            <div className="db-main-col">
              <AppointmentsView
                session={session}
                facultyName={firstAndLast || user.email || 'Faculty'}
              />
            </div>
          )}

          {activeNav === 'faculty' && (
            <div className="db-main-col">
              <FacultyView
                session={session}
                initialTab={facultyInitialTab}
                searchQuery={facultySearch}
                onAvatarChange={setAvatarUrl}
              />
            </div>
          )}

          {activeNav === 'notifications' && (
            <div className="db-main-col">
              <NotificationsView
                notifications={notifications}
                onMarkAllRead={handleMarkAllNotificationsRead}
                onMarkSelectedRead={handleMarkSelectedNotificationsRead}
                onDeleteSelected={handleDeleteSelectedNotifications}
              />
            </div>
          )}

          {activeNav === 'settings' && (
            <div className="db-main-col">
              <SettingsView session={session} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function CalendarCard() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { day: number; inMonth: boolean; isToday: boolean }[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({
      day: daysInPrevMonth - i,
      inMonth: false,
      isToday: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      day,
      inMonth: true,
      isToday:
        day === today.getDate() &&
        viewMonth === today.getMonth() &&
        viewYear === today.getFullYear(),
    });
  }

  while (cells.length % 7 !== 0 || cells.length < 42) {
    cells.push({
      day: cells.length - (startOffset + daysInMonth) + 1,
      inMonth: false,
      isToday: false,
    });
  }

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((year) => year - 1);
    } else {
      setViewMonth((month) => month - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((year) => year + 1);
    } else {
      setViewMonth((month) => month + 1);
    }
  };

  return (
    <div className="db-calendar-card">
      <div className="db-calendar-header">
        <button
          type="button"
          onClick={goPrevMonth}
          aria-label="Previous month"
        >
          <ChevronLeftIcon />
        </button>

        <span>
          {MONTH_LABELS[viewMonth]} {viewYear}
        </span>

        <button type="button" onClick={goNextMonth} aria-label="Next month">
          <ChevronRightIcon />
        </button>
      </div>

      <div className="db-calendar-weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="db-calendar-grid">
        {cells.map((cell, index) => (
          <span
            key={index}
            className={`db-calendar-day${
              cell.inMonth ? '' : ' db-calendar-day-muted'
            }${cell.isToday ? ' db-calendar-day-today' : ''}`}
          >
            {cell.day}
          </span>
        ))}
      </div>
    </div>
  );
}

function CapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 3 1 8l11 5 9-4.09V17h2V8L12 3Z" fill="#ffffff" />
      <path
        d="M5 10.5V15c0 1.5 3 3.5 7 3.5s7-2 7-3.5v-4.5"
        stroke="#ffffff"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="m3 11 9-7 9 7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AppointmentsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M3 9.5h18M8 3v4M16 3v4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FacultyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <circle
        cx="17"
        cy="9"
        r="2.4"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M15.5 14.8c2.3.3 4 1.9 4.6 4.7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M10 18.5a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4.5a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10.5a1.7 1.7 0 0 0 1-1.6V4.5a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10.5a1.7 1.7 0 0 0 1.6 1h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 15l4-3-4-3M18 12H9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle
        cx="11"
        cy="11"
        r="7"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="m21 21-4.3-4.3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M12 7v5l3.5 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m8 12.5 2.5 2.5L16 9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function QueueIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <circle
        cx="17"
        cy="9"
        r="2.2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M3.5 19c.8-3.4 3.2-5.2 5.8-5.2s5 1.8 5.8 5.2M15.3 14.1c2 .4 3.4 1.9 4 4.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M11 3.5 12.9 9l5.6 1.9-5.6 1.9L11 18.3 9.1 12.8 3.5 10.9 9.1 9 11 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 15v4M16.5 17h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M15 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 8c-2 0-3.5 1.5-3.5 3.7 0 2 1.3 3.4 3.1 3.4.4 0 .8-.1 1-.2C7.2 17 6 18.3 4.3 18.9l.6 1.3c3-1 4.8-3.4 4.8-6.6C9.7 10.7 8.6 8 7 8Z"
        fill="currentColor"
      />
      <path
        d="M16.3 8c-2 0-3.5 1.5-3.5 3.7 0 2 1.3 3.4 3.1 3.4.4 0 .8-.1 1-.2-.4 2.1-1.6 3.4-3.3 4l.6 1.3c3-1 4.8-3.4 4.8-6.6C19 10.7 17.9 8 16.3 8Z"
        fill="currentColor"
      />
    </svg>
  );
}