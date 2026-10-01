import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import { FacultyTabKey } from '../components/FacultyBottomTabBar';
import ProfileAvatar from '../components/ProfileAvatar';

export type ScheduleMode = 'face-to-face' | 'online';

export type ScheduleItem = {
  id: string;
  time: string;
  studentName: string;
  category: string;
  mode: ScheduleMode;
  photoUri?: string;
};

type QuickAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  background: string;
  onPress?: () => void;
};

type FacultyHomeScreenProps = {
  facultyFirstName?: string;
  appointmentsCount?: number;
  pendingReschedulesCount?: number;
  walkInQueueCount?: number;
  queueWindowActive?: boolean;
  queueStartsInSeconds?: number;
  queueAppointmentTime?: string;
  queueStudentName?: string;
  // Today's real appointments (already filtered/sorted by the caller).
  // Falls back to a small mock list so this screen still works standalone.
  schedule?: ScheduleItem[];
  onMenuPress?: () => void;
  onNotificationsPress?: () => void;
  // Count of unread notifications for the logged-in faculty member —
  // drives the numeric badge on the bell icon. Omit/0 to hide the badge.
  unreadCount?: number;
  onViewSchedule?: () => void;
  onOpenAppointments?: () => void;
  onOpenPendingReschedules?: () => void;
  onOpenAvailability?: () => void;
  onOpenWalkInQueue?: () => void;
  onOpenSlotIQAI?: () => void;
  onTabChange?: (tab: FacultyTabKey) => void;
};

const FALLBACK_SCHEDULE: ScheduleItem[] = [
  { id: '1', time: '10:00 AM', studentName: 'Maria Clara', category: 'Academic Advising', mode: 'face-to-face' },
  { id: '2', time: '11:30 AM', studentName: 'John Doe', category: 'Project Discussion', mode: 'online' },
  { id: '3', time: '2:00 PM', studentName: 'Anna Reyes', category: 'Thesis Consultation', mode: 'face-to-face' },
];

export default function FacultyHomeScreen({
  facultyFirstName = 'Dr. Juan',
  appointmentsCount = 8,
  pendingReschedulesCount = 2,
  walkInQueueCount = 6,
  queueWindowActive = false,
  queueStartsInSeconds = 0,
  queueAppointmentTime,
  queueStudentName,
  schedule = FALLBACK_SCHEDULE,
  onMenuPress,
  onNotificationsPress,
  unreadCount = 0,
  onViewSchedule,
  onOpenAppointments,
  onOpenPendingReschedules,
  onOpenAvailability,
  onOpenWalkInQueue,
  onOpenSlotIQAI,
  onTabChange,
}: FacultyHomeScreenProps) {
  // SlotIQ AI isn't built yet — pressing it shows a brief "not available"
  // toast instead of navigating anywhere.
  const [showSlotIQNotice, setShowSlotIQNotice] = useState(false);
  const slotIQNoticeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (slotIQNoticeTimeout.current) clearTimeout(slotIQNoticeTimeout.current);
    };
  }, []);

  const handleSlotIQPress = () => {
    setShowSlotIQNotice(true);
    if (slotIQNoticeTimeout.current) clearTimeout(slotIQNoticeTimeout.current);
    slotIQNoticeTimeout.current = setTimeout(() => setShowSlotIQNotice(false), 2500);
    onOpenSlotIQAI?.();
  };

  const quickActions: QuickAction[] = [
    { key: 'appointments', label: 'Appointments', icon: 'calendar-outline', background: '#5B7FDE', onPress: onOpenAppointments },
    { key: 'availability', label: 'Availability', icon: 'checkmark-circle-outline', background: '#3FB68A', onPress: onOpenAvailability },
    { key: 'queue', label: 'Queue', icon: 'notifications-outline', background: '#F0C93A', onPress: onOpenWalkInQueue },
    { key: 'slotiq', label: 'SlotIQ AI', icon: 'sparkles-outline', background: '#9B5DE5', onPress: handleSlotIQPress },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onMenuPress}>
          <Ionicons name="menu" size={24} color={colors.textDark} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.greeting}>Hi, {facultyFirstName}! 👋</Text>
          <Text style={styles.greetingSub}>Welcome back</Text>
        </View>
        <TouchableOpacity onPress={onNotificationsPress} style={styles.bellWrap}>
          <Ionicons name="notifications-outline" size={22} color={colors.textDark} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.headerDivider} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Today's Overview</Text>

        <View style={styles.statsRow}>
          <TouchableOpacity
            style={styles.statCard}
            onPress={onOpenAppointments}
            activeOpacity={0.75}
          >
            <Text style={[styles.statNumber, { color: colors.success }]}>{appointmentsCount}</Text>
            <Text style={styles.statLabel}>Appointments</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statCard}
            onPress={onOpenPendingReschedules}
            activeOpacity={0.75}
          >
            <Text style={[styles.statNumber, { color: colors.primary }]}>{pendingReschedulesCount}</Text>
            <Text style={styles.statLabel}>Pending{'\n'}Reschedules</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statCard}
            onPress={onOpenWalkInQueue}
            activeOpacity={0.75}
          >
            <Text style={[styles.statNumber, { color: '#3B4A9E' }]}>{walkInQueueCount}</Text>
            <Text style={styles.statLabel}>In{'\n'}Queue</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Today's Schedule</Text>
          <TouchableOpacity onPress={onViewSchedule}>
            <Text style={styles.link}>View all</Text>
          </TouchableOpacity>
        </View>

        {queueWindowActive && (
          <TouchableOpacity style={styles.queueAlertCard} onPress={onOpenWalkInQueue} activeOpacity={0.82}>
            <View style={styles.queueAlertIconWrap}>
              <Ionicons name="time-outline" size={22} color={colors.white} />
            </View>
            <View style={styles.queueAlertTextWrap}>
              <Text style={styles.queueAlertTitle}>Upcoming Consultation</Text>
              <Text style={styles.queueAlertStudent}>
                {queueStudentName ? `${queueStudentName} · ${queueAppointmentTime ?? ''}` : queueAppointmentTime ?? 'Appointment coming up'}
              </Text>
              <Text style={styles.queueAlertCountdown}>
                {queueStartsInSeconds > 0
                  ? `Starts in ${Math.floor(queueStartsInSeconds / 60)}:${String(queueStartsInSeconds % 60).padStart(2, '0')}`
                  : 'Appointment is starting now'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        <View style={styles.card}>
          {schedule.length === 0 ? (
            <Text style={styles.emptyScheduleText}>No appointments today.</Text>
          ) : (
            schedule.map((item, index) => (
              <View
                key={item.id}
                style={[styles.scheduleRow, index < schedule.length - 1 && styles.rowBorder]}
              >
                <Text style={styles.scheduleTime}>{item.time}</Text>
                <View style={styles.schedulePersonWrap}>
                  <ProfileAvatar uri={item.photoUri} name={item.studentName} size={36} role="student" />
                  <View style={styles.scheduleTextWrap}>
                    <Text style={styles.studentName}>{item.studentName}</Text>
                    <Text style={styles.detailText}>{item.category}</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.modeBadge,
                    item.mode === 'online' ? styles.modeBadgeOnline : styles.modeBadgeFaceToFace,
                  ]}
                >
                  <Text style={styles.modeBadgeText}>
                    {item.mode === 'online' ? 'Online' : 'Face-to-Face'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <Text style={[styles.sectionTitle, styles.quickActionsTitle]}>Quick Actions</Text>

        <View style={styles.quickActionsCard}>
          <View style={styles.quickActionsRow}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.key}
                style={styles.quickAction}
                onPress={action.onPress}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIconWrap, { backgroundColor: action.background }]}>
                  <Ionicons name={action.icon} size={20} color={colors.white} />
                </View>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>


      {showSlotIQNotice && (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={styles.toast}>
            <Text style={styles.toastText}>Currently not available</Text>
          </View>
        </View>
      )}
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: spacing.md,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDark,
  },
  greetingSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  bellWrap: {
    padding: 2,
  },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  bellBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '700',
  },
  headerDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDark,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textDark,
    textAlign: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  link: {
    fontSize: 12,
    color: colors.link,
    fontWeight: '600',
  },
  queueAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.white,
  },
  queueAlertIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  queueAlertTextWrap: {
    flex: 1,
  },
  queueAlertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
  },
  queueAlertStudent: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  queueAlertCountdown: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 5,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  emptyScheduleText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 13,
    paddingVertical: spacing.lg,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  scheduleTime: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textDark,
    width: 68,
  },
  schedulePersonWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scheduleTextWrap: {
    flex: 1,
  },
  studentName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
  },
  detailText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  modeBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  modeBadgeFaceToFace: {
    backgroundColor: colors.primary,
  },
  modeBadgeOnline: {
    backgroundColor: colors.success,
  },
  modeBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  quickActionsTitle: {
    marginBottom: spacing.sm,
  },
  quickActionsCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAction: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  quickActionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textDark,
    textAlign: 'center',
  },
  toastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 90,
    alignItems: 'center',
  },
  toast: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: 20,
  },
  toastText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
});