import { Ionicons } from '@expo/vector-icons';

export type NotificationItem = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  time: string;
  read: boolean;
  // Who the notification is from (set when the sender is known), so the
  // list can show their real name and profile picture.
  senderName?: string;
  senderAvatarUrl?: string;
  // Role and department of the sender, pulled from their profile so the
  // detail view can say e.g. "Student · College of Computer Studies (CCS)".
  senderRole?: string;
  senderDepartment?: string;
  // Raw timestamp, so the detail view can show the full date and time.
  createdAt?: string;
};

export const INITIAL_STUDENT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    icon: 'notifications-outline',
    title: 'Appointment Reminder',
    description: 'You have an appointment today at 10:00 AM.',
    time: '8:00 AM',
    read: false,
  },
  {
    id: '2',
    icon: 'sync-outline',
    title: 'Queue Update',
    description: "You're next in line.",
    time: '9:30 AM',
    read: false,
  },
  {
    id: '3',
    icon: 'megaphone-outline',
    title: 'Faculty Announcement',
    description: 'New schedule for this week.',
    time: '7:30 AM',
    read: true,
  },
  {
    id: '4',
    icon: 'notifications-outline',
    title: 'Appointment Reminder',
    description: 'You have an appointment today at 11:00 AM.',
    time: '8:00 AM',
    read: false,
  },
  {
    id: '5',
    icon: 'sync-outline',
    title: 'Queue Update',
    description: "You're next in line.",
    time: '11:30 AM',
    read: true,
  },
];

// Fallback used only if FacultyNotificationsScreen is rendered without
// real data passed in (e.g. in isolation/tests).
export const INITIAL_FACULTY_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    icon: 'notifications-outline',
    title: 'New Appointment',
    description: 'Maria Clara booked an appointment',
    time: '8:00 AM',
    read: true,
  },
  {
    id: '2',
    icon: 'sync-outline',
    title: 'Reschedule Request',
    description: 'Chloey Lyca Jurcales requested for a reschedule',
    time: '10:20 AM',
    read: true,
  },
  {
    id: '3',
    icon: 'sync-outline',
    title: 'Walk in Queue Update',
    description: 'New walk-in added, you are now servicing #2',
    time: '7:00 AM',
    read: true,
  },
  {
    id: '4',
    icon: 'information-circle-outline',
    title: 'System Update',
    description: 'Your schedule for next week has been updated.',
    time: '9:00 AM',
    read: false,
  },
  {
    id: '5',
    icon: 'notifications-outline',
    title: 'Reminder',
    description: 'You have 3 appointments tomorrow.',
    time: '11:20 AM',
    read: false,
  },
];

// Formats the current time the same way the mock data above is formatted
// (e.g. "9:05 AM"), so notifications generated at runtime match the rest
// of the list.
export function formatNotificationTime(date: Date = new Date()): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const paddedMinutes = minutes.toString().padStart(2, '0');
  return `${hours}:${paddedMinutes} ${period}`;
}

// Same as above, but older notifications also show their date so a
// notification from last week doesn't look like it arrived today.
export function formatNotificationTimeWithDate(date: Date): string {
  const now = new Date();
  const time = formatNotificationTime(date);
  if (date.toDateString() === now.toDateString()) return time;
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${day}, ${time}`;
}

// Builds a new notification with a unique id and the current time, so
// callers only need to supply the icon/title/description.
export function createNotification(
  input: Pick<NotificationItem, 'icon' | 'title' | 'description'>
): NotificationItem {
  return {
    id: `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    time: formatNotificationTime(),
    read: false,
    ...input,
  };
}

// Shape of a row from the real `notifications` table in Supabase.
export type DbNotification = {
  id: string;
  user_id: string;
  icon: string;
  title: string;
  description: string | null;
  read: boolean;
  created_at: string;
  sender_id?: string | null;
  // Joined from profiles when the notification was loaded with its sender.
  sender?: DbSender | DbSender[] | null;
};

type OneOrMany<T> = T | T[] | null;
export type DbSender = {
  full_name: string | null;
  avatar_url: string | null;
  role?: string | null;
  // `department` lives on the role tables, not on `profiles`.
  students?: OneOrMany<{ department: string | null }>;
  faculty?: OneOrMany<{ department: string | null }>;
};

// Select string that pulls the sender's name, picture, role and department.
export const NOTIFICATION_SENDER_SELECT =
  'sender:profiles!sender_id(full_name, avatar_url, role, students(department), faculty(department))';

const first = <T,>(v: OneOrMany<T> | undefined): T | null | undefined => (Array.isArray(v) ? v[0] : v);

export function senderDepartment(sender?: DbSender | null): string | undefined {
  return first(sender?.students)?.department ?? first(sender?.faculty)?.department ?? undefined;
}

// Converts a real DB row into the shape every notification screen expects.
export function mapDbNotification(row: DbNotification): NotificationItem {
  const sender = Array.isArray(row.sender) ? row.sender[0] : row.sender;
  const role = sender?.role ? sender.role.charAt(0).toUpperCase() + sender.role.slice(1) : undefined;
  return {
    id: row.id,
    icon: (row.icon as NotificationItem['icon']) || 'notifications-outline',
    title: row.title,
    description: row.description ?? '',
    time: formatNotificationTimeWithDate(new Date(row.created_at)),
    createdAt: row.created_at,
    read: row.read,
    senderName: sender?.full_name ?? undefined,
    senderAvatarUrl: sender?.avatar_url ?? undefined,
    senderRole: role,
    senderDepartment: senderDepartment(sender),
  };
}