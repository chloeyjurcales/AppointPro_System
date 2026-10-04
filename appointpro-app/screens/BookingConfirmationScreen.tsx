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
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import ProfileAvatar from '../components/ProfileAvatar';

type BookingConfirmationScreenProps = {
  onBack?: () => void;
  onMorePress?: () => void;
  onBookAnother?: () => void;
  onBackToHome?: () => void;
  onApproveAppointment?: () => void;
  onCancelAppointment?: () => void;
  approvalPending?: boolean;
  doctorName?: string;
  department?: string;
  date?: string;
  bookedTimeRangeLabel?: string;
  duration?: string;
  purpose?: string;
  consultationCategory?: string;
  location?: string;
  mode?: string;
  referenceNo?: string;
  doctorPhotoUri?: string;
  // Real ISO date + 24h times behind the display-formatted `date`/
  // `bookedTimeRangeLabel` above, kept for callers; no longer used here.
  dateKey?: string;
  startTime24?: string;
  endTime24?: string;
};

export default function BookingConfirmationScreen({
  onBack,
  onMorePress,
  onBookAnother,
  onBackToHome,
  onApproveAppointment,
  onCancelAppointment,
  approvalPending = false,
  doctorName = 'Dr. Juan Dela Cruz',
  department = 'Computer Studies',
  date = 'May 13, 2026 (Tue)',
  bookedTimeRangeLabel = '10:00 AM - 10:30 AM',
  duration = '30 mins',
  purpose = '',
  consultationCategory = 'Academic Advising',
  location = 'Room 305, CHMC Main Campus',
  mode = 'Face-to-Face',
  referenceNo = 'APP-2026-000791',
  doctorPhotoUri,
  dateKey,
  startTime24,
  endTime24,
}: BookingConfirmationScreenProps) {
  const isOnline = mode.trim().toLowerCase() === 'online';

  const handleOpenMeetingLink = () => {
    if (!location) return;
    const url = /^https?:\/\//i.test(location) ? location : `https://${location}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Confirmation</Text>
        <TouchableOpacity onPress={onMorePress}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textDark} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.successWrap}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={36} color={colors.white} />
          </View>
          <Text style={styles.successTitle}>Appointment Request Sent</Text>
          <Text style={styles.successSubtitle}>
            Your appointment was submitted and is waiting for faculty approval.
          </Text>
        </View>

        <View style={styles.detailsCard}>
          <View style={styles.doctorRow}>
            <ProfileAvatar uri={doctorPhotoUri} name={doctorName} size={44} role="faculty" />
            <View>
              <Text style={styles.doctorName}>{doctorName}</Text>
              <Text style={styles.doctorDept}>{department}</Text>
            </View>
          </View>

          <View style={styles.detailsDivider} />

          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} style={styles.detailIcon} />
            <Text style={styles.detailText}>{date}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={16} color={colors.primary} style={styles.detailIcon} />
            <Text style={styles.detailText}>{bookedTimeRangeLabel}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="hourglass-outline" size={16} color={colors.primary} style={styles.detailIcon} />
            <Text style={styles.detailText}>{duration}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="school-outline" size={16} color={colors.primary} style={styles.detailIcon} />
            <Text style={styles.detailText}>{consultationCategory}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons
              name={isOnline ? 'link-outline' : 'location-outline'}
              size={16}
              color={colors.primary}
              style={styles.detailIcon}
            />
            {isOnline ? (
              <TouchableOpacity
                style={styles.linkTouchable}
                onPress={handleOpenMeetingLink}
                activeOpacity={0.7}
              >
                <Text style={styles.linkText} numberOfLines={1}>
                  {location}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.detailText}>{location}</Text>
            )}
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="people-outline" size={16} color={colors.primary} style={styles.detailIcon} />
            <Text style={styles.detailText}>{mode}</Text>
          </View>

          {purpose.length > 0 && (
            <>
              <View style={styles.detailsDivider} />
              <View style={styles.purposeBlock}>
                <Text style={styles.purposeLabel}>Purpose of Appointment</Text>
                <Text style={styles.purposeText}>{purpose}</Text>
              </View>
            </>
          )}

          <View style={styles.detailsDivider} />

          <View>
            <Text style={styles.refLabel}>Reference No.</Text>
            <Text style={styles.refValue}>{referenceNo}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {approvalPending ? (
          <>
            <Text style={styles.approvalFooterText}>{doctorName} must approve this request before the appointment is confirmed.</Text>
            <TouchableOpacity
              style={styles.dangerButton}
              onPress={onCancelAppointment}
              activeOpacity={0.85}
            >
              <Text style={styles.dangerButtonText}>Cancel Request</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onBookAnother}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Book Appointments</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onBackToHome}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryButtonText}>Back to Home</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
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
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  successWrap: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
  },
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
  },
  doctorRow: {
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
  doctorName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
  },
  doctorDept: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  detailsDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  detailIcon: {
    marginRight: spacing.sm,
  },
  detailText: {
    fontSize: 12,
    color: colors.textDark,
  },
  linkTouchable: {
    flex: 1,
  },
  linkText: {
    fontSize: 12,
    color: colors.link,
    textDecorationLine: 'underline',
  },
  purposeBlock: {},
  purposeLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 4,
    fontWeight: '600',
  },
  purposeText: {
    fontSize: 12,
    color: colors.textDark,
    lineHeight: 17,
  },
  refLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  refValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.textDark,
    fontWeight: '700',
    fontSize: 15,
  },
  approvalFooterText: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  approvalButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dangerButton: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonHalf: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonHalf: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
});