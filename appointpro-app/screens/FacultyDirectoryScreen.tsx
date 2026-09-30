import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import FacultyBottomTabBar, { FacultyTabKey } from '../components/FacultyBottomTabBar';

type AppointmentStatus = 'upcoming' | 'pending' | 'completed' | 'cancelled';
type ConsultationMode = 'face-to-face' | 'online';

export type StudentAppointment = {
  id: string;
  studentName: string;
  status: AppointmentStatus;
  date: string;
  time: string;
  category: string;
  purpose?: string;
  room?: string;
  mode: ConsultationMode;
  meetingLink?: string;
  photoUri?: string;
  isOnline: boolean;
  studentId?: string;
  email?: string;
  department?: string;
  yearLevel?: string;
  // The real `profiles.id` (auth user id) of the student who booked this
  // appointment — distinct from `studentId` above (their school ID
  // number). This is what notifications must target.
  studentUserId?: string;
  // Raw values kept alongside the display-formatted ones above so other
  // screens (e.g. FacultyHomeScreen's "Today" stats/schedule) can
  // filter/sort by real date and time without re-parsing labels.
  dateKey?: string; // 'YYYY-MM-DD'
  startTime24?: string; // 'HH:MM:SS'
  endTime24?: string; // 'HH:MM:SS'
  startTimeLabel?: string; // e.g. '10:00 AM' (no end time)
  referenceNo?: string; // same reference number the student sees
  studentApprovalStatus?: 'pending' | 'approved' | 'declined';
  facultyApprovalStatus?: 'pending' | 'approved' | 'declined';
};

export const DEFAULT_APPOINTMENTS: StudentAppointment[] = [
  {
    id: '1',
    studentName: 'Maria Clara',
    status: 'upcoming',
    date: 'May 13, 2023',
    time: '10:00 AM',
    category: 'Academic Advising',
    room: 'Room 305',
    mode: 'face-to-face',
    isOnline: true,
    studentId: '2023-00456',
    email: 'mclara@gmail.com',
    department: 'College of Computer Studies',
    yearLevel: '2nd Year',
  },
  {
    id: '2',
    studentName: 'John Doe',
    status: 'upcoming',
    date: 'May 13, 2023',
    time: '10:00 AM',
    category: 'Project Discussion',
    mode: 'online',
    isOnline: true,
    studentId: '2023-00789',
    email: 'johndoe@gmail.com',
    department: 'College of Computer Studies',
    yearLevel: '4th Year',
  },
  {
    id: '3',
    studentName: 'Anna Reyes',
    status: 'upcoming',
    date: 'May 11, 2025',
    time: '2:00 PM',
    category: 'Thesis Consultation',
    room: 'Room 310',
    mode: 'face-to-face',
    isOnline: true,
    studentId: '2023-01011',
    email: 'areyes@gmail.com',
    department: 'College of Computer Studies',
    yearLevel: '4th Year',
  },
  {
    id: '4',
    studentName: 'Mark Santos',
    status: 'upcoming',
    date: 'May 14, 2023',
    time: '9:00 AM',
    category: 'Academic Advising',
    room: 'Room 305',
    mode: 'face-to-face',
    isOnline: true,
    studentId: '2023-01234',
    email: 'msantos@gmail.com',
    department: 'College of Computer Studies',
    yearLevel: '1st Year',
  },
];

// Shape of an `appointments` row (joined with the booking student's own
// students/profiles row) as returned by Supabase for the Directory list.
export type DbFacultyAppointment = {
  id: string;
  // The booking student's real `profiles.id` — needed to send them a
  // real-time notification when this appointment changes.
  student_id: string;
  date: string; // 'YYYY-MM-DD'
  start_time: string; // 'HH:MM:SS'
  end_time: string;
  category: string | null;
  purpose: string | null;
  mode: 'Face-to-Face' | 'Online';
  location: string;
  status: 'upcoming' | 'completed' | 'canceled';
  meeting_link: string | null;
  reference_no?: string | null;
  student_approval_status?: 'pending' | 'approved' | 'declined' | null;
  faculty_approval_status?: 'pending' | 'approved' | 'declined' | null;
  students: {
    student_id: string;
    department: string | null;
    year_level: string | null;
    profiles:
      | { full_name: string; email: string; avatar_url?: string | null }
      | { full_name: string; email: string; avatar_url?: string | null }[]
      | null;
  } | null;
};

function formatFacultyApptDate(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatFacultyApptTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  let hour = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute.toString().padStart(2, '0')} ${period}`;
}

// Converts a real `appointments` row into the shape this screen (and the
// reschedule/cancel/student-profile screens downstream) already expects.
export function mapDbFacultyAppointment(row: DbFacultyAppointment): StudentAppointment {
  const profile = Array.isArray(row.students?.profiles)
    ? row.students?.profiles[0]
    : row.students?.profiles;
  const isOnline = row.mode === 'Online';

  return {
    id: row.id,
    studentName: profile?.full_name ?? 'Unknown Student',
    status: row.status === 'canceled' ? 'cancelled' : row.status,
    date: formatFacultyApptDate(row.date),
    time: `${formatFacultyApptTime12h(row.start_time)} - ${formatFacultyApptTime12h(row.end_time)}`,
    category: row.category ?? 'Consultation',
    purpose: row.purpose ?? undefined,
    room: isOnline ? undefined : row.location,
    mode: isOnline ? 'online' : 'face-to-face',
    // Online bookings made by students store the link/platform in
    // `location`, so fall back to it when no explicit meeting_link is set.
    meetingLink: row.meeting_link ?? (isOnline ? row.location || undefined : undefined),
    // No presence/live-status tracking in the DB yet, so this always
    // renders without the green "online" dot rather than faking one.
    isOnline: false,
    studentId: row.students?.student_id,
    studentUserId: row.student_id,
    photoUri: profile?.avatar_url ?? undefined,
    email: profile?.email,
    department: row.students?.department ?? undefined,
    yearLevel: row.students?.year_level ?? undefined,
    dateKey: row.date,
    startTime24: row.start_time,
    endTime24: row.end_time,
    startTimeLabel: formatFacultyApptTime12h(row.start_time),
    referenceNo: row.reference_no ?? undefined,
    studentApprovalStatus: row.student_approval_status ?? 'approved',
    facultyApprovalStatus: row.faculty_approval_status ?? 'approved',
  };
}

const TABS: { key: AppointmentStatus; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'pending', label: 'Pending Approval' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

type FacultyDirectoryScreenProps = {
  appointments?: StudentAppointment[];
  onSelectAppointment?: (appointment: StudentAppointment) => void;
  onReschedulePress?: (appointment: StudentAppointment) => void;
  onCancelPress?: (appointment: StudentAppointment) => void;
  onApprovePress?: (appointment: StudentAppointment) => void;
  onDeclinePress?: (appointment: StudentAppointment) => void;
  onTabChange?: (tab: FacultyTabKey) => void;
};

export default function FacultyDirectoryScreen({
  appointments,
  onSelectAppointment,
  onReschedulePress,
  onCancelPress,
  onApprovePress,
  onDeclinePress,
  onTabChange,
}: FacultyDirectoryScreenProps) {
  const [activeFilter, setActiveFilter] = useState<AppointmentStatus>('upcoming');

  const source = appointments ?? DEFAULT_APPOINTMENTS;

  const isFullyApproved = (appointment: StudentAppointment) =>
    (appointment.facultyApprovalStatus ?? 'approved') === 'approved';

  const [searchQuery, setSearchQuery] = useState('');
  const normRef = (v?: string) => (v ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  const query = normRef(searchQuery);

  const filtered = source.filter((appointment) => {
    // While searching, match by reference number across every tab.
    if (query) return normRef(appointment.referenceNo).includes(query);
    if (activeFilter === 'upcoming') {
      return appointment.status === 'upcoming' && isFullyApproved(appointment);
    }
    if (activeFilter === 'pending') {
      return appointment.status === 'upcoming' && !isFullyApproved(appointment);
    }
    return appointment.status === activeFilter;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Directory</Text>
      </View>

      <View style={styles.searchBar}>
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by reference number (e.g. APP-2026-000791)"
          placeholderTextColor="#9B9B9B"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Feather name="x-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeFilter;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.filterTab}
              onPress={() => setActiveFilter(tab.key)}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.filterUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => onSelectAppointment?.(item)}
            activeOpacity={0.8}
          >
            <View style={styles.cardTopRow}>
              <View style={styles.avatarWrap}>
                {item.photoUri ? (
                  <Image source={{ uri: item.photoUri }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Feather name="user" size={20} color={colors.white} />
                  </View>
                )}
                {item.isOnline && <View style={styles.onlineDot} />}
              </View>

              <View style={styles.infoWrap}>
                <Text style={styles.name}>{item.studentName}</Text>
                <Text style={styles.detailText}>
                  {item.date}, {item.time}
                </Text>
                <Text style={styles.detailText}>{item.purpose || item.category}</Text>
                <Text style={styles.detailText}>
                  {item.mode === 'online'
                    ? 'Online'
                    : item.room
                    ? `${item.room} · Face-to-Face`
                    : 'Face-to-Face'}
                </Text>
              </View>
            </View>

            {activeFilter === 'pending' && item.facultyApprovalStatus === 'pending' && (
              <View style={styles.approvalStatusWrap}>
                <View style={[styles.approvalBadge, styles.approvalBadgeReady]}>
                  <Text style={[styles.approvalBadgeText, styles.approvalBadgeReadyText]}>
                    AWAITING FACULTY APPROVAL
                  </Text>
                </View>
                <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => onApprovePress?.(item)}
                    >
                      <Text style={styles.actionButtonText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.actionButtonDanger]}
                      onPress={() => onDeclinePress?.(item)}
                    >
                      <Text style={styles.actionButtonDangerText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
              </View>
            )}

            {activeFilter === 'upcoming' && (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => onReschedulePress?.(item)}
                >
                  <Text style={styles.actionButtonText}>Reschedule</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonDanger]}
                  onPress={() => onCancelPress?.(item)}
                >
                  <Text style={styles.actionButtonDangerText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {searchQuery.trim()
              ? 'No appointment found with that reference number.'
              : `No ${activeFilter} appointments.`}
          </Text>
        }
      />

      <FacultyBottomTabBar active="directory" onChange={onTabChange} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textDark,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  searchInput: {
    flex: 1,
    marginHorizontal: 8,
    fontSize: 13,
    color: colors.textDark,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  filterTab: {
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  filterText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  filterTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  filterUnderline: {
    marginTop: 6,
    height: 2,
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row',
  },
  avatarWrap: {
    marginRight: spacing.md,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.white,
  },
  infoWrap: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 2,
  },
  detailText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  approvalStatusWrap: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  approvalBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
  },
  approvalBadgeWaiting: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  approvalBadgeReady: {
    backgroundColor: colors.primary + '12',
    borderColor: colors.primary,
  },
  approvalBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  approvalBadgeWaitingText: {
    color: colors.textMuted,
  },
  approvalBadgeReadyText: {
    color: colors.primary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  actionButtonDanger: {
    borderColor: colors.danger,
  },
  actionButtonDangerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.xl,
  },
});