import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ProfileAvatar from '../components/ProfileAvatar';
import { colors, spacing } from '../theme';
import BottomTabBar, { TabKey } from '../components/BottomTabBar';
import {
  WEEK_DAYS,
  ScheduleSlot,
  getRemainingMinutes,
  isSlotFull,
} from '../data/facultySchedule';

type FacultyProfileScreenProps = {
  scheduleByDate: Record<number, ScheduleSlot[]>;
  facultyName?: string;
  facultyDepartment?: string;
  facultyRole?: string;
  facultyStatus?: 'available' | 'unavailable';
  facultyPhotoUri?: string;
  consultationTypes?: string;
  // The faculty's own "About" text from their profile.
  about?: string;
  // True while this faculty's schedule is still being fetched.
  loading?: boolean;
  // 'view' (opened from the Directory) only shows the faculty's details: no schedule and
  // no booking. 'book' (opened from the + button) also shows the schedule and Continue.
  mode?: 'view' | 'book';
  onBack?: () => void;
  onMorePress?: () => void;
  onSelectSlot?: (date: number, slot: ScheduleSlot) => void;
  onContinue?: () => void;
  onJoinWalkInQueue?: () => void;
  onTabChange?: (tab: TabKey) => void;
};

export default function FacultyProfileScreen({
  scheduleByDate,
  facultyName = 'Dr. Juan Dela Cruz',
  facultyDepartment = 'Computer Studies',
  facultyRole = 'Instructor',
  facultyStatus = 'available',
  facultyPhotoUri, 
  consultationTypes = 'Face-to-Face · Online',
  about,
  loading = false,
  mode = 'book',
  onBack,
  onMorePress,
  onSelectSlot,
  onContinue,
  onJoinWalkInQueue,
  onTabChange,
}: FacultyProfileScreenProps) {
  const firstAvailableDate =
    WEEK_DAYS.find((d) =>
      (scheduleByDate[d.date] ?? []).some((s) => !isSlotFull(s))
    )?.date ?? WEEK_DAYS[0].date;
  const [selectedDate, setSelectedDate] = useState(firstAvailableDate);

  // The schedule is fetched after this screen mounts, so the initial
  // "first available day" is usually computed from an empty schedule. Once
  // real slots arrive, move off an empty day onto the first day that has some.
  useEffect(() => {
    if ((scheduleByDate[selectedDate] ?? []).length > 0) return;
    const next = WEEK_DAYS.find((d) =>
      (scheduleByDate[d.date] ?? []).some((s) => !isSlotFull(s))
    )?.date;
    if (next !== undefined) setSelectedDate(next);
  }, [scheduleByDate]);

  const slotsForDate = scheduleByDate[selectedDate] ?? [];
  const selectedDay = WEEK_DAYS.find((d) => d.date === selectedDate);
  const isFullyBookedToday = slotsForDate.length > 0 && slotsForDate.every((s) => isSlotFull(s));
  // The faculty turned off "Available for consultations" on their profile.
  const isUnavailable = facultyStatus === 'unavailable';
  const canBook = mode === 'book';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Faculty Profile</Text>
        <TouchableOpacity onPress={onMorePress}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textDark} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileRow}>
          <ProfileAvatar
            uri={facultyPhotoUri}
            name={facultyName}
            size={56}
            role="faculty"
            style={styles.avatar}
          />
          <View style={styles.profileTextWrap}>
            <Text style={styles.name}>{facultyName}</Text>
            <Text style={styles.department}>
              {facultyRole} · {facultyDepartment}
            </Text>
            <Text style={styles.status}>
              {facultyStatus === 'available' ? 'Available' : 'Unavailable'}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Consultation Information</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color={colors.primary} style={styles.infoIcon} />
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoLabel}>Consultation Type</Text>
              <Text style={styles.infoValue}>{consultationTypes}</Text>
            </View>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} style={styles.infoIcon} />
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoLabel}>About</Text>
              <Text style={styles.infoValue}>
                {about?.trim() ? about.trim() : 'This instructor has not added a description yet.'}
              </Text>
            </View>
          </View>
        </View>

        {canBook && (
          <>
            <Text style={styles.sectionTitle}>Available Schedule</Text>

            <View style={styles.dateRow}>
              {WEEK_DAYS.map((d) => {
                const isActive = d.date === selectedDate;
                const hasAvailable = (scheduleByDate[d.date] ?? []).some((s) => !isSlotFull(s));
                return (
                  <TouchableOpacity
                    key={d.date}
                    style={[styles.dateChip, isActive && styles.dateChipActive]}
                    onPress={() => setSelectedDate(d.date)}
                  >
                    <Text style={[styles.dateDay, isActive && styles.dateTextActive]}>{d.day}</Text>
                    <Text style={[styles.dateNum, isActive && styles.dateTextActive]}>{d.date}</Text>
                    <View
                      style={[
                        styles.dateDot,
                        hasAvailable
                          ? isActive
                            ? styles.dateDotActiveFilled
                            : styles.dateDotFilled
                          : styles.dateDotEmpty,
                      ]}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.selectedDayLabel}>{selectedDay?.fullLabel}</Text>

            {isUnavailable && (
              <View style={styles.queueBanner}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.queueBannerText}>
                  {facultyName} isn't accepting consultations right now. Please check back later.
                </Text>
              </View>
            )}

            {!isUnavailable && isFullyBookedToday && (
              <View style={styles.queueBanner}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.queueBannerText}>
                  {facultyName} is fully booked for this day.
                </Text>
                <TouchableOpacity style={styles.queueBannerButton} onPress={onJoinWalkInQueue}>
                  <Text style={styles.queueBannerButtonText}>View Queue</Text>
                </TouchableOpacity>
              </View>
            )}

            {slotsForDate.length === 0 ? (
              <View style={styles.emptySchedule}>
                <Ionicons name="calendar-outline" size={22} color={colors.textMuted} />
                <Text style={styles.emptyScheduleText}>
                  {loading ? 'Loading schedule…' : 'No slots offered this day.'}
                </Text>
              </View>
            ) : (
              slotsForDate.map((slot) => {
                const full = isSlotFull(slot);
                const blocked = full || isUnavailable;
                const remaining = getRemainingMinutes(slot);
                return (
                  <TouchableOpacity
                    key={slot.id}
                    style={[styles.slotCard, blocked && styles.slotCardDisabled]}
                    onPress={() => !blocked && onSelectSlot?.(selectedDate, slot)}
                    activeOpacity={blocked ? 1 : 0.75}
                    disabled={blocked}
                  >
                    <View style={styles.slotIconWrap}>
                      <Ionicons
                        name={slot.mode === 'Online' ? 'wifi-outline' : 'location-outline'}
                        size={16}
                        color={blocked ? colors.textMuted : colors.primary}
                      />
                    </View>
                    <View style={styles.slotTextWrap}>
                      <Text style={[styles.slotTime, blocked && styles.slotTextDisabled]}>
                        {slot.time}
                      </Text>
                      <Text style={[styles.slotLocation, blocked && styles.slotTextDisabled]}>
                        {slot.location}
                      </Text>
                    </View>
                    <View style={styles.slotStatusWrap}>
                      <Text
                        style={[
                          styles.slotStatus,
                          blocked ? styles.slotStatusBooked : styles.slotStatusAvailable,
                        ]}
                      >
                        {full ? 'Fully Booked' : isUnavailable ? 'Not accepting' : `${remaining} min left`}
                      </Text>
                      {!blocked && (
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={colors.textMuted}
                          style={styles.slotChevron}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {canBook && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueButton, isUnavailable && { opacity: 0.5 }]}
            onPress={onContinue}
            disabled={isUnavailable}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}

      <BottomTabBar active={canBook ? null : 'directory'} onChange={onTabChange} />
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
  profileTextWrap: {
    flex: 1,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
  },
  department: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  infoCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
  },
  infoIcon: {
    marginRight: spacing.md,
    marginTop: 2,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  dateChip: {
    width: 36,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
  },
  dateChipActive: {
    backgroundColor: colors.primary,
  },
  dateDay: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 4,
  },
  dateNum: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 4,
  },
  dateTextActive: {
    color: colors.white,
  },
  dateDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dateDotFilled: {
    backgroundColor: colors.primary,
  },
  dateDotActiveFilled: {
    backgroundColor: colors.white,
  },
  dateDotEmpty: {
    backgroundColor: 'transparent',
  },
  selectedDayLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  queueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    backgroundColor: colors.infoBg,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  queueBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.infoText,
    minWidth: 140,
  },
  queueBannerButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  queueBannerButtonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  emptySchedule: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  emptyScheduleText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  slotCardDisabled: {
    backgroundColor: colors.inputBackground,
    opacity: 0.7,
  },
  slotIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.tabInactiveBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  slotTextWrap: {
    flex: 1,
  },
  slotTime: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 2,
  },
  slotLocation: {
    fontSize: 11,
    color: colors.textMuted,
  },
  slotTextDisabled: {
    color: colors.textMuted,
  },
  slotStatusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slotStatus: {
    fontSize: 10,
    fontWeight: '700',
    marginRight: spacing.xs,
  },
  slotStatusAvailable: {
    color: colors.success,
  },
  slotStatusBooked: {
    color: colors.danger,
  },
  slotChevron: {
    marginLeft: 2,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  continueButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});