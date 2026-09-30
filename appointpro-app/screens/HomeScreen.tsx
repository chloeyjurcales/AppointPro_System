import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import BottomTabBar, { TabKey } from '../components/BottomTabBar';
import ProfileAvatar from '../components/ProfileAvatar';
import {
  QueueEntry,
  AVERAGE_WAIT_MINUTES_PER_STUDENT,
  getRemainingSeconds,
  getEstimatedWaitSeconds,
  getSecondsUntilAppointment,
  formatCountdown,
} from '../data/queue';
import { NotificationItem } from '../data/notifications';
import { Appointment } from './AppointmentsScreen';

type HomeScreenProps = {
  userName?: string;
  hasPendingReschedule?: boolean;
  cancelledNotice?: string | null;
  onDismissCancelledNotice?: () => void;
  onReviewReschedule?: () => void;
  onMenuPress?: () => void;
  onNotificationsPress?: () => void;
  // Count of unread notifications for the logged-in student — drives the
  // numeric badge on the bell icon. Omit/0 to hide the badge.
  unreadCount?: number;
  onViewAppointments?: () => void;
  onViewNotifications?: () => void;
  onViewQueue?: () => void;
  // The soonest real upcoming appointment for this student, or null if
  // they don't have one — drives the "Upcoming Appointment" card below.
  nextAppointment?: Appointment | null;
  // Real notifications for the logged-in user (same data the
  // Notifications screen uses) — only the most recent few are shown.
  notifications?: NotificationItem[];
  // Live queue state — position and countdown are derived from this
  // instead of being passed in as precomputed numbers, so the Home
  // screen ticks down in real time right alongside the Queue screen.
  queue?: QueueEntry[];
  currentQueueId?: string | null;
  now?: Date;
  averageWaitMinutes?: number;
  // Only show the Queue card once the student's booked appointment
  // window has actually started (e.g. a 9-11 booking only shows it
  // starting at 9), instead of all the time.
  showQueueCard?: boolean;
  onTabChange?: (tab: TabKey) => void;
};

function getGreeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning!';
  if (hour < 18) return 'Good afternoon!';
  return 'Good evening!';
}

export default function HomeScreen({
  userName = 'there',
  hasPendingReschedule = false,
  cancelledNotice = null,
  onDismissCancelledNotice,
  onReviewReschedule,
  onMenuPress,
  onNotificationsPress,
  unreadCount = 0,
  onViewAppointments,
  onViewNotifications,
  onViewQueue,
  nextAppointment = null,
  notifications = [],
  queue = [],
  currentQueueId = null,
  now = new Date(),
  averageWaitMinutes = AVERAGE_WAIT_MINUTES_PER_STUDENT,
  showQueueCard = false,
  onTabChange,
}: HomeScreenProps) {
  // Under 5 minutes to go: swap the ticking digits for a heads-up message
  // instead of letting them run down to, and sit stuck at, "0:00".
  const STARTING_SOON_SECONDS = 5 * 60;
  const queuePosition = currentQueueId
    ? queue.findIndex((entry) => entry.id === currentQueueId) + 1
    : null;
  const isNowServing = queuePosition === 1;
  // Being #1 doesn't mean the session has begun: until the faculty's
  // client stamps `startedAt`, count down to the scheduled start instead of
  // showing a full, un-ticking session length (matches the Queue screen).
  const isWaitingToStart = isNowServing && queue[0]?.startedAt === null;
  const isOnlineAppointment = nextAppointment?.mode?.trim().toLowerCase() === 'online';
  const meetingLink = isOnlineAppointment ? nextAppointment?.location : undefined;
  const handleOpenMeetingLink = () => {
    if (!meetingLink) return;
    const url = /^https?:\/\//i.test(meetingLink) ? meetingLink : `https://${meetingLink}`;
    Linking.openURL(url).catch(() => {});
  };
  const queueCountdownSeconds =
    queuePosition && queuePosition > 0
      ? queuePosition === 1
        ? queue[0].startedAt !== null
          ? getRemainingSeconds(queue[0], now)
          : getSecondsUntilAppointment(
              queue[0].scheduledDateKey,
              queue[0].scheduledStartTime24,
              now
            )
        : getEstimatedWaitSeconds(queue, queuePosition - 1, now)
      : null;
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onMenuPress}>
          <Ionicons name="menu" size={24} color={colors.textDark} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.greeting}>Hi, {userName} 👋</Text>
          <Text style={styles.greetingSub}>{getGreeting(now)}</Text>
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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {hasPendingReschedule && (
          <TouchableOpacity style={styles.rescheduleBanner} onPress={onReviewReschedule} activeOpacity={0.8}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={styles.rescheduleBannerText}>
              Your faculty proposed a new schedule. Tap to review.
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}

        {cancelledNotice && (
          <View style={styles.cancelledBanner}>
            <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.cancelledBannerText}>{cancelledNotice}</Text>
            <TouchableOpacity onPress={onDismissCancelledNotice}>
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Upcoming Appointment</Text>
          <TouchableOpacity onPress={onViewAppointments}>
            <Text style={styles.link}>View all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.appointmentCard}>
          {nextAppointment ? (
            <>
              <View style={styles.appointmentRow}>
                <View style={styles.calendarIconWrap}>
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                </View>
                <ProfileAvatar uri={nextAppointment.facultyAvatarUrl} name={nextAppointment.doctorName} size={44} role="faculty" />
                <View style={styles.appointmentTextWrap}>
                  <Text style={styles.appointmentDate}>{nextAppointment.date}</Text>
                  <Text style={styles.appointmentDoctor}>{nextAppointment.doctorName}</Text>
                  {!!nextAppointment.department && (
                    <Text style={styles.appointmentDept}>{nextAppointment.department}</Text>
                  )}
                </View>
              </View>
              <View style={styles.modeBadge}>
                <Text style={styles.modeBadgeText}>{nextAppointment.mode}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.emptyCardText}>No upcoming appointments.</Text>
          )}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Notifications</Text>
          <TouchableOpacity onPress={onViewNotifications}>
            <Text style={styles.link}>View all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.notificationsCard}>
          {notifications.length === 0 ? (
            <Text style={styles.emptyCardText}>No notifications yet.</Text>
          ) : (
            notifications.slice(0, 3).map((item, index, arr) => (
              <View
                key={item.id}
                style={[
                  styles.notificationRow,
                  index < arr.length - 1 && styles.notificationRowBorder,
                ]}
              >
                <View style={styles.notificationIconWrap}>
                  <Ionicons name={item.icon} size={18} color={colors.primary} />
                </View>
                <View style={styles.notificationTextWrap}>
                  <Text style={styles.notificationTitle}>{item.title}</Text>
                  <Text style={styles.notificationDesc}>{item.description}</Text>
                </View>
                <Text style={styles.notificationTime}>{item.time}</Text>
              </View>
            ))
          )}
        </View>

        {showQueueCard && (
          <View style={styles.queueCard}>
            <Text style={styles.smallCardTitle}>Queue</Text>
            {queuePosition ? (
              <View style={styles.queueStatsRow}>
                <View style={styles.queueStatItem}>
                  <Text style={styles.queueLabel}>Your Number</Text>
                  <Text style={styles.queueValue}>#{queuePosition}</Text>
                </View>
                <View style={styles.queueStatDivider} />
                <View style={styles.queueStatItem}>
                  <Text style={styles.queueLabel}>
                    {isNowServing ? (isWaitingToStart ? 'Starts In' : 'Time Remaining') : 'Est. Wait'}
                  </Text>
                  <Text style={styles.queueValue}>
                    {formatCountdown(queueCountdownSeconds ?? 0)}
                  </Text>
                </View>
              </View>
            ) : null}

            {isWaitingToStart && (queueCountdownSeconds ?? Infinity) <= STARTING_SOON_SECONDS && (
              <View style={styles.startingSoonBox}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
                <View style={styles.startingSoonTextWrap}>
                  <Text style={styles.startingSoonTitle}>
                    {(queueCountdownSeconds ?? 0) <= 0
                      ? 'Your appointment is starting'
                      : 'Your appointment is starting soon'}
                  </Text>
                  <Text style={styles.startingSoonSubtext}>
                    {isOnlineAppointment
                      ? 'Be ready to join the meeting using the link below.'
                      : 'Be ready to head to the room.'}
                  </Text>
                  {isOnlineAppointment && !!meetingLink && (
                    <TouchableOpacity onPress={handleOpenMeetingLink} activeOpacity={0.7}>
                      <Text style={styles.startingSoonLink} selectable>
                        {meetingLink}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {!queuePosition && (
              <View style={styles.queueStatsRow}>
                <View style={styles.queueStatItem}>
                  <Text style={styles.queueLabel}>Waiting</Text>
                  <Text style={styles.queueValue}>{queue.length}</Text>
                </View>
                <View style={styles.queueStatDivider} />
                <View style={styles.queueStatItem}>
                  <Text style={styles.queueLabel}>Estimated Waiting Time</Text>
                  <Text style={styles.queueValue}>{averageWaitMinutes} min</Text>
                </View>
              </View>
            )}
            <TouchableOpacity onPress={onViewQueue}>
              <Text style={styles.link}>View Queue</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <BottomTabBar active="home" onChange={onTabChange} />
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
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  rescheduleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.infoBg,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  rescheduleBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.infoText,
    fontWeight: '600',
  },
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cancelledBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDark,
  },
  link: {
    fontSize: 12,
    color: colors.link,
    fontWeight: '600',
  },
  appointmentCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  appointmentRow: {
    flexDirection: 'row',
  },
  calendarIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.tabInactiveBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  appointmentTextWrap: {
    flex: 1,
  },
  appointmentDate: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  appointmentDoctor: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDark,
  },
  appointmentDept: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  modeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: spacing.sm,
  },
  modeBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyCardText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 13,
    paddingVertical: spacing.md,
  },
  notificationsCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  notificationRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  notificationIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.tabInactiveBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  notificationTextWrap: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
  },
  notificationDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  notificationTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  queueCard: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  smallCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: spacing.sm,
  },
  queueStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  queueStatItem: {
    flex: 1,
  },
  queueStatDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  queueLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 3,
  },
  queueValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textDark,
  },
  startingSoonBox: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  startingSoonTextWrap: {
    flex: 1,
    gap: 2,
  },
  startingSoonTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
  },
  startingSoonSubtext: {
    fontSize: 12,
    color: colors.textMuted,
  },
  startingSoonLink: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    textDecorationLine: 'underline',
    marginTop: 2,
  },
});