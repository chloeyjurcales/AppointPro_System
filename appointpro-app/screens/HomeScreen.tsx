import React from 'react';
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
import { TabKey } from '../components/BottomTabBar';
import ProfileAvatar from '../components/ProfileAvatar';
import {
  QueueEntry,
  getRemainingSeconds,
  getSecondsUntilAppointment,
  hasAppointmentStartedAt,
  getAppointmentEndDate,
  formatCountdown,
} from '../data/queue';
import { NotificationItem } from '../data/notifications';
import { Appointment } from './AppointmentsScreen';

const AVERAGE_WAIT_MINUTES_PER_STUDENT = 10;

function getEstimatedWaitSeconds(
  queue: QueueEntry[],
  index: number,
  now: Date
): number {
  if (index <= 0 || queue.length === 0) return 0;

  let total =
    queue[0].startedAt !== null
      ? getRemainingSeconds(queue[0], now)
      : queue[0].durationMinutes * 60;

  for (let i = 1; i < index; i += 1) {
    total += queue[i].durationMinutes * 60;
  }

  return total;
}

type HomeScreenProps = {
  userName?: string;
  hasPendingReschedule?: boolean;
  cancelledNotice?: string | null;
  onDismissCancelledNotice?: () => void;
  onReviewReschedule?: () => void;
  onMenuPress?: () => void;
  onNotificationsPress?: () => void;
  unreadCount?: number;
  onViewAppointments?: () => void;
  onViewNotifications?: () => void;
  onViewQueue?: () => void;
  nextAppointment?: Appointment | null;
  notifications?: NotificationItem[];
  queue?: QueueEntry[];
  currentQueueId?: string | null;
  now?: Date;
  averageWaitMinutes?: number;
  showQueueCard?: boolean;
  queueStartsInSeconds?: number | null;
  queueAppointmentTime?: string | null;

  // Student HomeScreen uses the student TabKey type.
  onTabChange?: (tab: TabKey) => void;
};

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
  queueStartsInSeconds = null,
  queueAppointmentTime = null,
  onTabChange,
}: HomeScreenProps) {
  const queuePosition = currentQueueId
    ? queue.findIndex((entry) => entry.id === currentQueueId) + 1
    : null;

  const isNowServing = queuePosition === 1;

  const currentQueueEntry =
    queuePosition && queuePosition > 0 ? queue[queuePosition - 1] : null;

  const currentQueueStarted =
    currentQueueEntry
      ? currentQueueEntry.startedAt !== null ||
        hasAppointmentStartedAt(
          currentQueueEntry.scheduledDateKey,
          currentQueueEntry.scheduledStartTime24,
          now
        )
      : false;

  const currentQueueEnded =
    currentQueueEntry?.scheduledDateKey && currentQueueEntry?.scheduledEndTime24
      ? now.getTime() >=
        getAppointmentEndDate(
          currentQueueEntry.scheduledDateKey,
          currentQueueEntry.scheduledEndTime24
        ).getTime()
      : false;

  const queueCountdownSeconds =
    queuePosition && queuePosition > 0
      ? queuePosition === 1
        ? currentQueueEnded
          ? 0
          : currentQueueStarted
            ? getRemainingSeconds(currentQueueEntry!, now)
            : getSecondsUntilAppointment(
                currentQueueEntry?.scheduledDateKey,
                currentQueueEntry?.scheduledStartTime24,
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
          <Text style={styles.greetingSub}>Good morning!</Text>
        </View>

        <TouchableOpacity
          onPress={onNotificationsPress}
          style={styles.bellWrap}
        >
          <Ionicons
            name="notifications-outline"
            size={22}
            color={colors.textDark}
          />

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
          <TouchableOpacity
            style={styles.rescheduleBanner}
            onPress={onReviewReschedule}
            activeOpacity={0.8}
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={colors.primary}
            />
            <Text style={styles.rescheduleBannerText}>
              Your faculty proposed a new schedule. Tap to review.
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.primary}
            />
          </TouchableOpacity>
        )}

        {cancelledNotice && (
          <View style={styles.cancelledBanner}>
            <Ionicons
              name="close-circle-outline"
              size={18}
              color={colors.danger}
            />
            <Text style={styles.cancelledBannerText}>
              {cancelledNotice}
            </Text>
            <TouchableOpacity onPress={onDismissCancelledNotice}>
              <Ionicons
                name="close"
                size={16}
                color={colors.textMuted}
              />
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
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={colors.primary}
                  />
                </View>

                <ProfileAvatar
                  uri={nextAppointment.facultyAvatarUrl}
                  name={nextAppointment.doctorName}
                  size={44}
                  role="faculty"
                  style={styles.facultyAvatar}
                />

                <View style={styles.appointmentTextWrap}>
                  <Text style={styles.appointmentDate}>
                    {nextAppointment.date}
                  </Text>
                  <Text style={styles.appointmentDoctor}>
                    {nextAppointment.doctorName}
                  </Text>

                  {!!nextAppointment.department && (
                    <Text style={styles.appointmentDept}>
                      {nextAppointment.department}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.modeBadge}>
                <Text style={styles.modeBadgeText}>
                  {nextAppointment.mode}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.emptyCardText}>
              No upcoming appointments.
            </Text>
          )}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Today's Notifications</Text>
          <TouchableOpacity onPress={onViewNotifications}>
            <Text style={styles.link}>View all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.notificationsCard}>
          {notifications.length === 0 ? (
            <Text style={styles.emptyCardText}>
              No notifications yet.
            </Text>
          ) : (
            notifications.slice(0, 3).map((item, index, arr) => (
              <View
                key={item.id}
                style={[
                  styles.notificationRow,
                  index < arr.length - 1 &&
                    styles.notificationRowBorder,
                ]}
              >
                <View style={styles.notificationIconWrap}>
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={colors.primary}
                  />
                </View>

                <View style={styles.notificationTextWrap}>
                  <Text style={styles.notificationTitle}>
                    {item.title}
                  </Text>
                  <Text style={styles.notificationDesc}>
                    {item.description}
                  </Text>
                </View>

                <Text style={styles.notificationTime}>
                  {item.time}
                </Text>
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
                  <Text style={styles.queueValue}>
                    #{queuePosition}
                  </Text>
                </View>

                <View style={styles.queueStatDivider} />

                <View style={styles.queueStatItem}>
                  <Text style={styles.queueLabel}>
                    {isNowServing
                      ? currentQueueEnded
                        ? 'Appointment Done'
                        : currentQueueStarted
                          ? 'Started'
                          : 'Starts in'
                      : 'Est. Wait'}
                  </Text>
                  <Text style={styles.queueValue}>
                    {isNowServing && currentQueueEnded
                      ? 'Done'
                      : formatCountdown(queueCountdownSeconds ?? 0)}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.queueStatsRow}>
                <View style={styles.queueStatItem}>
                  <Text style={styles.queueLabel}>Waiting</Text>
                  <Text style={styles.queueValue}>
                    {queue.length}
                  </Text>
                </View>

                <View style={styles.queueStatDivider} />

                <View style={styles.queueStatItem}>
                  <Text style={styles.queueLabel}>
                    Estimated Waiting Time
                  </Text>
                  <Text style={styles.queueValue}>
                    {averageWaitMinutes} min
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity onPress={onViewQueue}>
              <Text style={styles.link}>View Queue</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

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
  facultyAvatar: {
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
});
