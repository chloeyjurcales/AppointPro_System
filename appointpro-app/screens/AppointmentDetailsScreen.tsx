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
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import ProfileAvatar from '../components/ProfileAvatar';

type AppointmentDetailsScreenProps = {
  onBack?: () => void;
  onMorePress?: () => void;
  onReschedule?: () => void;
  onCancelAppointment?: () => void;
  status?: string;
  doctorName?: string;
  department?: string;
  date?: string;
  time?: string;
  category?: string;
  purpose?: string;
  location?: string;
  mode?: string;
  referenceNo?: string;
  photoUri?: string;
  // Real ISO date + 24h times behind the display-formatted `date`/`time`
  // above, kept for callers; no longer used by this screen.
  dateKey?: string;
  startTime24?: string;
  endTime24?: string;
};

export default function AppointmentDetailsScreen({
  onBack,
  onMorePress,
  onReschedule,
  onCancelAppointment,
  status = 'UPCOMING',
  doctorName = 'Dr. Juan Dela Cruz',
  department = 'Computer Studies',
  date = 'May 13, 2026 (Tue)',
  time = '10:00 AM',
  category = 'Consultation',
  purpose = '',
  location = 'Room 305, CHMC Main Campus',
  mode = 'Face-to-Face',
  referenceNo = 'APP-2026-000791',
  photoUri,
  dateKey,
  startTime24,
  endTime24,
}: AppointmentDetailsScreenProps) {
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
        <Text style={styles.headerTitle}>Appointment Details</Text>
        <TouchableOpacity onPress={onMorePress}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textDark} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>{status}</Text>
        </View>

        <View style={styles.detailsCard}>
          <View style={styles.doctorRow}>
            <ProfileAvatar uri={photoUri} name={doctorName} size={44} role="faculty" />
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
            <Text style={styles.detailText}>{purpose || category}</Text>
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

      {status.trim().toUpperCase() === 'UPCOMING' && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onReschedule}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>Reschedule</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={onCancelAppointment}
            activeOpacity={0.85}
          >
            <Text style={styles.dangerButtonText}>Cancel Appointment</Text>
          </TouchableOpacity>
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
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  statusBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
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
  dangerButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});