import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import ProfileAvatar from '../components/ProfileAvatar';

export type FacultyActionSuccessType = 'cancelled' | 'rescheduled';

type FacultyActionSuccessScreenProps = {
  type: FacultyActionSuccessType;
  studentName?: string;
  studentPhotoUri?: string;
  category?: string;
  dateLabel?: string;
  timeLabel?: string;
  location?: string;
  mode?: string;
  reason?: string;
  meetingLink?: string;
  referenceNo?: string;
  onBack?: () => void;
  onBackToDirectory?: () => void;
};

const COPY: Record<
  FacultyActionSuccessType,
  {
    headerTitle: string;
    successTitle: string;
    successSubtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    circleColor: string;
  }
> = {
  cancelled: {
    headerTitle: 'Booking Cancellation',
    successTitle: 'Appointment Canceled!',
    successSubtitle: 'The appointment has been successfully canceled.',
    icon: 'close',
    circleColor: colors.primary,
  },
  rescheduled: {
    headerTitle: 'Booking Reschedule',
    successTitle: 'Appointment Rescheduled!',
    successSubtitle: 'The appointment has been successfully rescheduled.',
    icon: 'checkmark',
    circleColor: colors.success,
  },
};

export default function FacultyActionSuccessScreen({
  type,
  studentName = 'Chloey Lyca Jurcales',
  studentPhotoUri,
  category = 'Academic Advising',
  dateLabel = 'May 13, 2026 (Tue)',
  timeLabel = '10:00 AM',
  location = 'Room 305, CHMC Main Campus',
  mode = 'Face-to-Face',
  reason,
  meetingLink,
  referenceNo = 'APP-2026-000791',
  onBack,
  onBackToDirectory,
}: FacultyActionSuccessScreenProps) {
  const copy = COPY[type];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack ?? onBackToDirectory}>
          <Ionicons name="arrow-back" size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{copy.headerTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.successWrap}>
          <View style={[styles.successCircle, { backgroundColor: copy.circleColor }]}>
            <Ionicons name={copy.icon} size={36} color={colors.white} />
          </View>
          <Text style={styles.successTitle}>{copy.successTitle}</Text>
          <Text style={styles.successSubtitle}>{copy.successSubtitle}</Text>
        </View>

        <View style={styles.detailsCard}>
          <View style={styles.studentRow}>
            <ProfileAvatar uri={studentPhotoUri} name={studentName} size={44} role="student" />
            <View>
              <Text style={styles.studentName}>{studentName}</Text>
              <Text style={styles.studentDetail}>{category}</Text>
            </View>
          </View>

          <View style={styles.detailsDivider} />

          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} style={styles.detailIcon} />
            <Text style={styles.detailText}>{dateLabel}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={16} color={colors.primary} style={styles.detailIcon} />
            <Text style={styles.detailText}>{timeLabel}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color={colors.primary} style={styles.detailIcon} />
            <Text style={styles.detailText}>{location}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="people-outline" size={16} color={colors.primary} style={styles.detailIcon} />
            <Text style={styles.detailText}>{mode}</Text>
          </View>
          {!!meetingLink && (
            <View style={styles.detailRow}>
              <Ionicons name="link-outline" size={16} color={colors.primary} style={styles.detailIcon} />
              <Text style={[styles.detailText, styles.detailTextFlex]} numberOfLines={1}>
                {meetingLink}
              </Text>
            </View>
          )}

          {!!reason && (
            <>
              <View style={styles.detailsDivider} />
              <Text style={styles.reasonLabel}>Reason</Text>
              <Text style={styles.reasonText}>{reason}</Text>
            </>
          )}

          <View style={styles.detailsDivider} />

          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="receipt-text-outline"
              size={16}
              color={colors.primary}
              style={styles.detailIcon}
            />
            <View>
              <Text style={styles.refLabel}>Reference No.</Text>
              <Text style={styles.refValue}>{referenceNo}</Text>
            </View>
          </View>
        </View>

        <View style={styles.notifyBox}>
          <Ionicons name="notifications-outline" size={16} color={colors.infoText} />
          <Text style={styles.notifyText}>
            {studentName} has been notified of this {type === 'cancelled' ? 'cancellation' : 'change'}.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onBackToDirectory}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>Back to Directory</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: colors.textDark },
  headerSpacer: { width: 22 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  successWrap: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successTitle: { fontSize: 16, fontWeight: '700', color: colors.textDark },
  successSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: spacing.lg,
  },
  detailsCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  studentName: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  studentDetail: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  detailsDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  detailIcon: { marginRight: spacing.sm },
  detailText: { fontSize: 12, color: colors.textDark },
  detailTextFlex: { flex: 1 },
  reasonLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4, fontWeight: '600' },
  reasonText: { fontSize: 12, color: colors.textDark, lineHeight: 17 },
  refLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
  refValue: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  notifyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.infoBg,
    borderRadius: 10,
    padding: spacing.md,
  },
  notifyText: { flex: 1, fontSize: 11, color: colors.infoText, lineHeight: 16 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
});