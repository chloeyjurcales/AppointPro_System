import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import {
  WEEK_DAYS,
  ScheduleSlot,
  DURATION_OPTIONS,
  getRemainingMinutes,
  isSlotFull,
  getFittingDurationOptions,
} from '../data/facultySchedule';
import { toDateKey } from '../data/facultySlots';

export type BookingSelection = {
  date: number;
  // Real 'YYYY-MM-DD' key for the selected day. Needed (in addition to
  // the display-only `date` day-of-month number) so downstream code can
  // tell whether a confirmed booking's start time is happening *today*
  // versus just matching today's clock time on some other day.
  dateKey: string;
  dateLabel: string;
  slot: ScheduleSlot;
  duration: string;
  durationMinutes: number;
  purpose: string;
  bookingId: string;
  bookedTimeRangeLabel: string;
  // Real reference number from the saved appointment row (set by App.tsx
  // after the booking succeeds).
  referenceNo?: string;
};

type BookAppointmentScreenProps = {
  scheduleByDate: Record<number, ScheduleSlot[]>;
  studentName: string;
  mode?: 'book' | 'reschedule';
  onBack?: () => void;
  onContinue?: (selection: BookingSelection) => void;
  doctorName?: string;
  department?: string;
  initialDate?: number;
  initialSlotId?: string;
};

export default function BookAppointmentScreen({
  scheduleByDate,
  studentName,
  mode = 'book',
  onBack,
  onContinue,
  doctorName = 'Dr. Juan Dela Cruz',
  department = 'Computer Studies',
  initialDate,
  initialSlotId,
}: BookAppointmentScreenProps) {
  const todayKeyForDefault = toDateKey(new Date());
  const defaultDate =
    initialDate ??
    WEEK_DAYS.find(
      (d) =>
        d.dateKey >= todayKeyForDefault &&
        (scheduleByDate[d.date] ?? []).some((s) => !isSlotFull(s))
    )?.date ??
    WEEK_DAYS.find((d) => d.dateKey === todayKeyForDefault)?.date ??
    WEEK_DAYS[0].date;

  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [selectedSlotId, setSelectedSlotId] = useState<string | undefined>(initialSlotId);
  const [selectedDurationMinutes, setSelectedDurationMinutes] = useState<number | undefined>();
  const [purpose, setPurpose] = useState('');
  const [userPickedDate, setUserPickedDate] = useState(false);

  const isReschedule = mode === 'reschedule';
  // Belt-and-suspenders: even though the faculty schedule fed in here is
  // already filtered server-side to drop past days/slots, never allow a
  // day before today to be picked in this screen either — stale or
  // cached `scheduleByDate` data should never let someone book the past.
  const todayKey = toDateKey(new Date());
  const isPastDay = (dateKey: string) => dateKey < todayKey;
  const allSlotsForDate = isPastDay(
    WEEK_DAYS.find((d) => d.date === selectedDate)?.dateKey ?? todayKey
  )
    ? []
    : scheduleByDate[selectedDate] ?? [];
  // Fully booked slots are removed from the list entirely — once every
  // minute of a slot (e.g. a 2-hour 3-5 window) is claimed by other
  // students' bookings, it should no longer appear as a choice here.
  const slotsForDate = allSlotsForDate.filter((s) => !isSlotFull(s));
  const selectedDay = WEEK_DAYS.find((d) => d.date === selectedDate);
  const selectedSlot = slotsForDate.find((s) => s.id === selectedSlotId);
  const availableCount = slotsForDate.length;
  const fittingOptions = selectedSlot ? getFittingDurationOptions(selectedSlot) : [];

  useEffect(() => {
    if (!selectedSlot) {
      setSelectedDurationMinutes(undefined);
      return;
    }
    const options = getFittingDurationOptions(selectedSlot);
    if (options.length === 0) {
      setSelectedDurationMinutes(undefined);
    } else {
      const preferred = options.find((o) => o.minutes === 30) ?? options[options.length - 1];
      setSelectedDurationMinutes(preferred.minutes);
    }
  }, [selectedSlotId]);

  // The schedule is fetched after this screen mounts, so the initial date was
  // chosen from an empty schedule. Until the user picks a day themselves,
  // move onto the first day that actually has open slots once they arrive.
  useEffect(() => {
    if (userPickedDate || initialDate !== undefined) return;
    if ((scheduleByDate[selectedDate] ?? []).some((s) => !isSlotFull(s))) return;
    const next = WEEK_DAYS.find(
      (d) =>
        d.dateKey >= todayKey && (scheduleByDate[d.date] ?? []).some((s) => !isSlotFull(s))
    )?.date;
    if (next !== undefined) setSelectedDate(next);
  }, [scheduleByDate]);

  const handleSelectDate = (date: number) => {
    setUserPickedDate(true);
    setSelectedDate(date);
    setSelectedSlotId(undefined);
  };

  const canContinue =
    !!selectedSlot && !!selectedDurationMinutes && (isReschedule || purpose.trim().length > 0);

  const handleContinue = () => {
    if (!selectedSlot || !selectedDay || !selectedDurationMinutes || !canContinue) return;
    const durationLabel =
      DURATION_OPTIONS.find((d) => d.minutes === selectedDurationMinutes)?.label ?? '';
    onContinue?.({
      date: selectedDate,
      dateKey: selectedDay.dateKey,
      dateLabel: selectedDay.fullLabel,
      slot: selectedSlot,
      duration: durationLabel,
      durationMinutes: selectedDurationMinutes,
      purpose: purpose.trim(),
      bookingId: '',
      bookedTimeRangeLabel: '',
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Ionicons name="arrow-back" size={22} color={colors.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book Appointment</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.doctorCard}>
            <View style={styles.avatar}>
              <FontAwesome5 name="user-tie" size={20} color={colors.white} />
            </View>
            <View>
              <Text style={styles.doctorName}>{doctorName}</Text>
              <Text style={styles.doctorDept}>{department}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Select Date</Text>

          <View style={styles.dateRow}>
            {WEEK_DAYS.map((d) => {
              const isActive = d.date === selectedDate;
              const hasAvailable =
                !isPastDay(d.dateKey) &&
                (scheduleByDate[d.date] ?? []).some((s) => !isSlotFull(s));
              return (
                <TouchableOpacity
                  key={d.date}
                  style={[
                    styles.dateChip,
                    isActive && styles.dateChipActive,
                    !hasAvailable && styles.dateChipDisabled,
                  ]}
                  onPress={() => hasAvailable && handleSelectDate(d.date)}
                  disabled={!hasAvailable}
                >
                  <Text
                    style={[
                      styles.dateDay,
                      isActive && styles.dateTextActive,
                      !hasAvailable && styles.dateTextDisabled,
                    ]}
                  >
                    {d.day}
                  </Text>
                  <Text
                    style={[
                      styles.dateNum,
                      isActive && styles.dateTextActive,
                      !hasAvailable && styles.dateTextDisabled,
                    ]}
                  >
                    {d.date}
                  </Text>
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

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.selectedDayLabel}>{selectedDay?.fullLabel}</Text>
            <Text style={styles.availableCountText}>
              {availableCount} slot{availableCount === 1 ? '' : 's'} available
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Select Time & Location</Text>

          {allSlotsForDate.length === 0 ? (
            <View style={styles.emptySchedule}>
              <Ionicons name="calendar-outline" size={22} color={colors.textMuted} />
              <Text style={styles.emptyScheduleText}>
                No slots offered this day. Try another date.
              </Text>
            </View>
          ) : slotsForDate.length === 0 ? (
            <View style={styles.emptySchedule}>
              <Ionicons name="checkmark-done-outline" size={22} color={colors.textMuted} />
              <Text style={styles.emptyScheduleText}>
                All slots for this day are fully booked. Try another date.
              </Text>
            </View>
          ) : (
            slotsForDate.map((slot) => {
              const isSelected = slot.id === selectedSlotId;
              const remaining = getRemainingMinutes(slot);
              return (
                <TouchableOpacity
                  key={slot.id}
                  style={[styles.slotCard, isSelected && styles.slotCardSelected]}
                  onPress={() => setSelectedSlotId(slot.id)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterActive]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>

                  <View style={styles.slotTextWrap}>
                    <Text style={styles.slotTime}>{slot.time}</Text>
                    <View style={styles.slotMetaRow}>
                      <Ionicons
                        name={slot.mode === 'Online' ? 'wifi-outline' : 'location-outline'}
                        size={12}
                        color={colors.textMuted}
                      />
                      <Text style={styles.slotLocation}>{slot.location}</Text>
                    </View>
                    <Text style={styles.slotMode}>{remaining} min remaining</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {selectedSlot && (
            <>
              <Text style={styles.sectionTitle}>Appointment Duration</Text>
              <View style={styles.durationRow}>
                {DURATION_OPTIONS.map((option) => {
                  const fits = fittingOptions.some((o) => o.minutes === option.minutes);
                  const isActive = option.minutes === selectedDurationMinutes;
                  return (
                    <TouchableOpacity
                      key={option.label}
                      style={[
                        styles.durationChip,
                        isActive && styles.durationChipActive,
                        !fits && styles.durationChipDisabled,
                      ]}
                      onPress={() => fits && setSelectedDurationMinutes(option.minutes)}
                      disabled={!fits}
                    >
                      <Text
                        style={[
                          styles.durationChipText,
                          isActive && styles.durationChipTextActive,
                          !fits && styles.durationChipTextDisabled,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.durationHint}>
                {getRemainingMinutes(selectedSlot)} minutes remaining in this slot — your exact
                start time will be assigned automatically based on what's already booked.
              </Text>

              {!isReschedule && (
                <>
                  <Text style={styles.sectionTitle}>Purpose of Appointment</Text>
                  <TextInput
                    style={styles.purposeInput}
                    placeholder="e.g. Discuss thesis proposal, request academic advising..."
                    placeholderTextColor="#9B9B9B"
                    value={purpose}
                    onChangeText={setPurpose}
                    multiline
                    numberOfLines={3}
                  />
                  <Text style={styles.purposeHint}>
                    Let {doctorName} know what you'd like to discuss so they can prepare.
                  </Text>
                </>
              )}
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
            onPress={handleContinue}
            activeOpacity={0.85}
            disabled={!canContinue}
          >
            <Text style={styles.continueButtonText}>
              {isReschedule ? 'Reschedule' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  flex: {
    flex: 1,
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
  doctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: spacing.sm,
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
  dateChipDisabled: {
    opacity: 0.4,
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
  dateTextDisabled: {
    color: colors.textMuted,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  selectedDayLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  availableCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
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
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
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
  slotCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.infoBg,
  },
  slotCardDisabled: {
    backgroundColor: colors.inputBackground,
    opacity: 0.7,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  radioOuterActive: {
    borderColor: colors.primary,
  },
  radioOuterDisabled: {
    borderColor: colors.textMuted,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.primary,
  },
  slotTextWrap: {
    flex: 1,
  },
  slotTime: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 3,
  },
  slotMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  slotLocation: {
    fontSize: 11,
    color: colors.textMuted,
  },
  slotMode: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  slotTextDisabled: {
    color: colors.textMuted,
  },
  bookedTag: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.danger,
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  durationChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.inputBackground,
  },
  durationChipActive: {
    backgroundColor: colors.primary,
  },
  durationChipDisabled: {
    opacity: 0.35,
  },
  durationChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textDark,
  },
  durationChipTextActive: {
    color: colors.white,
  },
  durationChipTextDisabled: {
    color: colors.textMuted,
  },
  durationHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  purposeInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: 13,
    color: colors.textDark,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  purposeHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 6,
    marginBottom: spacing.lg,
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
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});