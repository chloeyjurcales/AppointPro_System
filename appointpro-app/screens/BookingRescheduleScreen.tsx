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

type BookingRescheduleScreenProps = {
  onBack?: () => void;
  onBackToHome?: () => void;
  doctorName?: string;
  department?: string;
  date?: string;
  time?: string;
  category?: string;
  location?: string;
  mode?: string;
  referenceNo?: string;
  doctorPhotoUri?: string;
};

export default function BookingRescheduleScreen({
  onBack,
  onBackToHome,
  doctorName = 'Dr. Juan Dela Cruz',
  department = 'Computer Studies',
  date = 'May 13, 2026 (Tue)',
  time = '10:00 AM',
  category = 'Academic Advising',
  location = 'Room 305, CHMC Main Campus',
  mode = 'Face-to-Face',
  referenceNo = 'APP-2026-000791',
  doctorPhotoUri,
}: BookingRescheduleScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Reschedule</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.successWrap}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={36} color={colors.white} />
          </View>
          <Text style={styles.successTitle}>Appointment Rescheduled!</Text>
          <Text style={styles.successSubtitle}>
            Your appointment has been successfully rescheduled.
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
            <Text style={styles.detailText}>{time}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="school-outline" size={16} color={colors.primary} style={styles.detailIcon} />
            <Text style={styles.detailText}>{category}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color={colors.primary} style={styles.detailIcon} />
            <Text style={styles.detailText}>{location}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="people-outline" size={16} color={colors.primary} style={styles.detailIcon} />
            <Text style={styles.detailText}>{mode}</Text>
          </View>

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
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onBackToHome}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>Back to Home</Text>
        </TouchableOpacity>
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
  headerSpacer: {
    width: 22,
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
    backgroundColor: colors.success,
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
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
});