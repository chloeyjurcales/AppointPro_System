import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import ProfileAvatar from '../components/ProfileAvatar';
import BottomTabBar, { TabKey } from '../components/BottomTabBar';

type AppointmentStatus = 'upcoming' | 'completed' | 'canceled';
type FilterKey = 'upcoming' | 'completed' | 'canceled';

export type Appointment = {
  id: string;
  status: AppointmentStatus;
  doctorName: string;
  date: string;
  category: string;
  purpose?: string;
  location: string;
  mode: string;
  department?: string;
  // Raw values kept alongside the display-formatted `date` above so the
  // Home screen can find/sort the soonest upcoming one without
  // re-parsing the label.
  dateKey?: string; // 'YYYY-MM-DD'
  startTime24?: string; // 'HH:MM:SS'
  endTime24?: string; // 'HH:MM:SS' — used to build the "Add to Calendar" event
  referenceNo?: string;
  facultyId?: string;
  facultyAvatarUrl?: string;
  studentApprovalStatus?: 'pending' | 'approved' | 'declined';
  facultyApprovalStatus?: 'pending' | 'approved' | 'declined';
};

export const DEFAULT_APPOINTMENTS: Appointment[] = [
  {
    id: '1',
    status: 'upcoming',
    doctorName: 'Prof. Maria Santos',
    date: 'May 13, 2026 · 10:00 AM',
    category: 'Academic Advising',
    location: 'Room 305',
    mode: 'Face-to-Face',
  },
  {
    id: '2',
    status: 'completed',
    doctorName: 'Prof. Maria Santos',
    date: 'May 9, 2026 · 10:00 AM',
    category: 'Academic Advising',
    location: 'Room 305',
    mode: 'Face-to-Face',
  },
  {
    id: '3',
    status: 'completed',
    doctorName: 'Prof. Maria Santos',
    date: 'May 3, 2026 · 10:00 AM',
    category: 'Academic Advising',
    location: 'Room 305',
    mode: 'Face-to-Face',
  },
  {
    id: '4',
    status: 'canceled',
    doctorName: 'Prof. Maria Santos',
    date: 'May 1, 2026 · 10:00 AM',
    category: 'Academic Advising',
    location: 'Room 305',
    mode: 'Face-to-Face',
  },
];

// Shape of an `appointments` row (joined with the booked faculty's own
// faculty/profiles row) as returned by Supabase for this student's list.
export type DbStudentAppointment = {
  id: string;
  faculty_id: string;
  date: string; // 'YYYY-MM-DD'
  start_time: string; // 'HH:MM:SS'
  end_time: string;
  category: string | null;
  purpose: string | null;
  mode: 'Face-to-Face' | 'Online';
  location: string;
  status: 'upcoming' | 'completed' | 'canceled';
  student_approval_status?: 'pending' | 'approved' | 'declined' | null;
  faculty_approval_status?: 'pending' | 'approved' | 'declined' | null;
  reference_no: string;
  faculty: {
    department: string | null;
    profiles: { full_name: string; avatar_url?: string | null } | { full_name: string; avatar_url?: string | null }[] | null;
  } | null;
};

function formatStudentApptDate(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatStudentApptTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  let hour = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute.toString().padStart(2, '0')} ${period}`;
}

// Converts a real `appointments` row into the shape this screen (and the
// Home screen's "Upcoming Appointment" card) already expects.
export function mapDbStudentAppointment(row: DbStudentAppointment): Appointment {
  const facultyProfile = Array.isArray(row.faculty?.profiles)
    ? row.faculty?.profiles[0]
    : row.faculty?.profiles;

  return {
    id: row.id,
    status: row.status,
    doctorName: facultyProfile?.full_name ?? 'Unknown Faculty',
    date: `${formatStudentApptDate(row.date)} · ${formatStudentApptTime12h(row.start_time)}`,
    category: row.category ?? 'Consultation',
    purpose: row.purpose ?? undefined,
    // Keep the real value here even for Online appointments — for
    // Online mode this is the faculty member's meeting link, and the
    // Details screen needs it intact to render a working, tappable
    // link. The list card below shows a short "Online" label instead
    // of the raw link so the row stays tidy.
    location: row.location,
    mode: row.mode,
    department: row.faculty?.department ?? undefined,
    dateKey: row.date,
    startTime24: row.start_time,
    endTime24: row.end_time,
    referenceNo: row.reference_no,
    facultyId: row.faculty_id,
    facultyAvatarUrl: facultyProfile?.avatar_url ?? undefined,
    studentApprovalStatus: row.student_approval_status ?? 'approved',
    facultyApprovalStatus: row.faculty_approval_status ?? 'approved',
  };
}

const TABS: { key: FilterKey; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'canceled', label: 'Canceled' },
];

type StatusStyle = { label: string; background: string };

const STATUS_STYLES: Record<AppointmentStatus, StatusStyle> = {
  upcoming: { label: 'UPCOMING', background: colors.primary },
  completed: { label: 'COMPLETED', background: colors.success },
  canceled: { label: 'CANCELED', background: colors.danger },
};

function matchesFilter(appointment: Appointment, filter: FilterKey) {
  return appointment.status === filter;
}

function EmptySpaceIllustration() {
  return (
    <View style={styles.illustrationWrap}>
      <MaterialCommunityIcons
        name="calendar-blank-outline"
        size={90}
        color={colors.tabInactiveBg}
      />
      <View style={styles.illustrationClockBadge}>
        <Ionicons name="time-outline" size={30} color={colors.white} />
      </View>
    </View>
  );
}

type AppointmentsScreenProps = {
  // Controlled from App.tsx (real `appointments` rows for the logged-in
  // student). Falls back to the mock list so this screen still works
  // standalone.
  appointments?: Appointment[];
  onMenuPress?: () => void;
  onSelectAppointment?: (appointment: Appointment) => void;
  onTabChange?: (tab: TabKey) => void;
};

export default function AppointmentsScreen({
  appointments = DEFAULT_APPOINTMENTS,
  onMenuPress,
  onSelectAppointment,
  onTabChange,
}: AppointmentsScreenProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('upcoming');

  const [searchQuery, setSearchQuery] = useState('');
  const normRef = (v?: string) => (v ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  const query = normRef(searchQuery);
  // While searching, look through ALL of the student's appointments by
  // reference number (ignoring the status tab).
  const filtered = query
    ? appointments.filter((a) => normRef(a.referenceNo).includes(query))
    : appointments.filter((a) => matchesFilter(a, activeFilter));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onMenuPress}>
          <Ionicons name="menu" size={24} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Appointments</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
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
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
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
        renderItem={({ item }) => {
          const statusStyle = STATUS_STYLES[item.status];
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => onSelectAppointment?.(item)}
              activeOpacity={0.8}
            >
              <View style={[styles.statusBadge, { backgroundColor: statusStyle.background }]}>
                <Text style={styles.statusBadgeText}>{statusStyle.label}</Text>
              </View>
              {item.status === 'upcoming' && item.facultyApprovalStatus === 'pending' && (
                  <Text style={styles.approvalHint}>AWAITING FACULTY APPROVAL</Text>
                )}
              <View style={styles.cardRow}>
                <ProfileAvatar
                  uri={item.facultyAvatarUrl}
                  name={item.doctorName}
                  size={44}
                  role="faculty"
                  style={styles.avatarSpacing}
                />
                <View style={styles.infoWrap}>
                  <Text style={styles.doctorName}>{item.doctorName}</Text>
                  <Text style={styles.detailText}>{item.date}</Text>
                  <Text style={styles.detailText}>{item.purpose || item.category}</Text>
                  <Text style={styles.detailText} numberOfLines={1}>
                    {item.mode === 'Online' ? 'Online' : item.location} · {item.mode}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {searchQuery.trim()
              ? 'No appointment found with that reference number.'
              : `No ${activeFilter} appointments.`}
          </Text>
        }
        ListFooterComponent={
          filtered.length > 0 && filtered.length <= 1 ? <EmptySpaceIllustration /> : null
        }
      />

      <BottomTabBar active="appointments" onChange={onTabChange} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
  },
  headerSpacer: {
    width: 24,
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
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: spacing.sm,
  },
  statusBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarSpacing: {
    marginRight: spacing.md,
  },
  infoWrap: {
    flex: 1,
  },
  doctorName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 2,
  },
  detailText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.xl,
  },
  illustrationWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl * 2,
  },
  illustrationClockBadge: {
    position: 'absolute',
    bottom: -6,
    right: '28%',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#A8493C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  approvalHint: {
    marginTop: 5,
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.3,
  },
});