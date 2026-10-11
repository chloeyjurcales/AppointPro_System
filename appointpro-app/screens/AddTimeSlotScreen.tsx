import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import FacultyBottomTabBar, { FacultyTabKey } from '../components/FacultyBottomTabBar';
import { ConsultationMode, DAY_NAMES, toDateKey } from '../data/facultySlots';

type Period = 'AM' | 'PM';

export type NewFacultySlotInput = {
  dateKey: string; // YYYY-MM-DD of the day this slot is for
  startHour: string;
  startMinute: string;
  startPeriod: Period;
  endHour: string;
  endMinute: string;
  endPeriod: Period;
  mode: ConsultationMode;
  location: string;
  recurring: boolean;
};

type AddTimeSlotScreenProps = {
  initialDateKey?: string;
  onBack?: () => void;
  onConfirm?: (slot: NewFacultySlotInput) => void;
  onTabChange?: (tab: FacultyTabKey) => void;
};

// Converts 12h hour/minute/period fields into minutes-since-midnight, or
// null if any field isn't a valid time component. Used to validate the
// range before it's ever sent to Supabase.
function toMinutesSinceMidnight(
  hourStr: string,
  minuteStr: string,
  period: Period
): number | null {
  const hourNum = parseInt(hourStr, 10);
  const minuteNum = parseInt(minuteStr, 10);
  if (
    !Number.isInteger(hourNum) ||
    !Number.isInteger(minuteNum) ||
    hourNum < 1 ||
    hourNum > 12 ||
    minuteNum < 0 ||
    minuteNum > 59
  ) {
    return null;
  }
  let hour24 = hourNum % 12;
  if (period === 'PM') hour24 += 12;
  return hour24 * 60 + minuteNum;
}

const DAYS_AHEAD = 60;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type DayOption = { dateKey: string; dayName: string; dayNum: number; month: string; isToday: boolean };

function buildDayOptions(initialDateKey?: string): DayOption[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = toDateKey(today);
  const toOption = (d: Date): DayOption => ({
    dateKey: toDateKey(d),
    dayName: DAY_NAMES[d.getDay()],
    dayNum: d.getDate(),
    month: MONTH_NAMES[d.getMonth()],
    isToday: toDateKey(d) === todayKey,
  });
  const options: DayOption[] = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    options.push(toOption(d));
  }
  // Keep a pre-selected date that falls outside the window selectable.
  if (initialDateKey && !options.some((o) => o.dateKey === initialDateKey)) {
    const d = new Date(`${initialDateKey}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      options.push(toOption(d));
      options.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    }
  }
  return options;
}

export default function AddTimeSlotScreen({
  initialDateKey,
  onBack,
  onConfirm,
  onTabChange,
}: AddTimeSlotScreenProps) {
  // Defaults to a valid 10:00 AM - 12:00 PM range (previously defaulted
  // to 10:00 PM - 12:30 PM, which is an end-before-start range and would
  // have produced a negative total_minutes if confirmed untouched).
  const dayOptions = useMemo(() => buildDayOptions(initialDateKey), [initialDateKey]);
  const [dateKey, setDateKey] = useState<string>(
    initialDateKey && dayOptions.some((o) => o.dateKey === initialDateKey)
      ? initialDateKey
      : dayOptions[0].dateKey
  );
  const selectedDay = dayOptions.find((o) => o.dateKey === dateKey);
  const [startHour, setStartHour] = useState('10');
  const [startMinute, setStartMinute] = useState('00');
  const [startPeriod, setStartPeriod] = useState<Period>('AM');
  const [endHour, setEndHour] = useState('12');
  const [endMinute, setEndMinute] = useState('00');
  const [endPeriod, setEndPeriod] = useState<Period>('PM');
  const [mode, setMode] = useState<ConsultationMode>('Face-to-Face');
  const [location, setLocation] = useState('');
  const [recurring, setRecurring] = useState(true);

  const isOnline = mode === 'Online';

  const startMinutes = useMemo(
    () => toMinutesSinceMidnight(startHour, startMinute, startPeriod),
    [startHour, startMinute, startPeriod]
  );
  const endMinutes = useMemo(
    () => toMinutesSinceMidnight(endHour, endMinute, endPeriod),
    [endHour, endMinute, endPeriod]
  );

  const timeError =
    startMinutes === null || endMinutes === null
      ? 'Enter a valid hour (1-12) and minute (0-59) for both times.'
      : endMinutes <= startMinutes
      ? 'End time must be after the start time.'
      : null;

  const locationError = location.trim().length === 0
    ? isOnline
      ? 'Enter a meeting link or platform.'
      : 'Enter a room or location.'
    : null;

  const canConfirm = !timeError && !locationError;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm?.({
      dateKey,
      startHour,
      startMinute,
      startPeriod,
      endHour,
      endMinute,
      endPeriod,
      mode,
      location: location.trim(),
      recurring,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Availability</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Set New Time Slot</Text>

          <View style={styles.dayBlock}>
            <Text style={styles.fieldLabel}>Day:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dayScroll}
            >
              {dayOptions.map((opt) => {
                const active = opt.dateKey === dateKey;
                return (
                  <TouchableOpacity
                    key={opt.dateKey}
                    style={[styles.dayChip, active && styles.dayChipActive]}
                    onPress={() => setDateKey(opt.dateKey)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${opt.dayName} ${opt.month} ${opt.dayNum}`}
                  >
                    <Text style={[styles.dayChipName, active && styles.dayChipTextActive]}>
                      {opt.isToday ? 'Today' : opt.dayName}
                    </Text>
                    <Text style={[styles.dayChipNum, active && styles.dayChipTextActive]}>{opt.dayNum}</Text>
                    <Text style={[styles.dayChipMonth, active && styles.dayChipTextActive]}>{opt.month}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {selectedDay && (
              <Text style={styles.dayHint}>
                {new Date(`${selectedDay.dateKey}T00:00:00`).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            )}
          </View>

          <View style={styles.timeRow}>
            <Text style={styles.fieldLabel}>Hour:</Text>
            <TextInput
              style={styles.timeInput}
              value={startHour}
              onChangeText={setStartHour}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={styles.fieldLabel}>Minute:</Text>
            <TextInput
              style={styles.timeInput}
              value={startMinute}
              onChangeText={setStartMinute}
              keyboardType="number-pad"
              maxLength={2}
            />
            <View style={styles.periodToggle}>
              <TouchableOpacity
                style={[styles.periodOption, startPeriod === 'AM' && styles.periodOptionActive]}
                onPress={() => setStartPeriod('AM')}
              >
                <Text
                  style={[
                    styles.periodOptionText,
                    startPeriod === 'AM' && styles.periodOptionTextActive,
                  ]}
                >
                  AM
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodOption, startPeriod === 'PM' && styles.periodOptionActive]}
                onPress={() => setStartPeriod('PM')}
              >
                <Text
                  style={[
                    styles.periodOptionText,
                    startPeriod === 'PM' && styles.periodOptionTextActive,
                  ]}
                >
                  PM
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.timeRow}>
            <Text style={styles.fieldLabel}>End:</Text>
            <TextInput
              style={styles.timeInput}
              value={endHour}
              onChangeText={setEndHour}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={styles.fieldLabel}>Minute:</Text>
            <TextInput
              style={styles.timeInput}
              value={endMinute}
              onChangeText={setEndMinute}
              keyboardType="number-pad"
              maxLength={2}
            />
            <View style={styles.periodToggle}>
              <TouchableOpacity
                style={[styles.periodOption, endPeriod === 'AM' && styles.periodOptionActive]}
                onPress={() => setEndPeriod('AM')}
              >
                <Text
                  style={[
                    styles.periodOptionText,
                    endPeriod === 'AM' && styles.periodOptionTextActive,
                  ]}
                >
                  AM
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodOption, endPeriod === 'PM' && styles.periodOptionActive]}
                onPress={() => setEndPeriod('PM')}
              >
                <Text
                  style={[
                    styles.periodOptionText,
                    endPeriod === 'PM' && styles.periodOptionTextActive,
                  ]}
                >
                  PM
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {timeError && <Text style={styles.errorText}>{timeError}</Text>}

          <View style={styles.typeRow}>
            {(
              [
                { key: 'Face-to-Face', label: 'Face-to-Face' },
                { key: 'Online', label: 'Online' },
              ] as { key: ConsultationMode; label: string }[]
            ).map((opt) => {
              const isActive = mode === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={styles.typeOption}
                  onPress={() => setMode(opt.key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                    {isActive && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.typeLabel}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.locationBlock}>
            <Text style={styles.fieldLabel}>
              {isOnline ? 'Meeting Link' : 'Location'}
            </Text>
            <View style={styles.locationInputRow}>
              <Ionicons
                name={isOnline ? 'link-outline' : 'location-outline'}
                size={16}
                color={colors.textMuted}
                style={styles.locationIcon}
              />
              <TextInput
                style={styles.locationInput}
                value={location}
                onChangeText={setLocation}
                placeholder={
                  isOnline
                    ? 'Enter meeting link'
                    : 'Enter room or location'
                }
                placeholderTextColor="#9B9B9B"
                autoCapitalize="none"
              />
            </View>
            {locationError && <Text style={styles.locationErrorText}>{locationError}</Text>}
          </View>

          <View style={styles.recurringRow}>
            <View style={styles.recurringTextWrap}>
              <Text style={styles.fieldLabel}>Repeat Weekly</Text>
              <Text style={styles.recurringHint}>
                This slot will automatically repeat every {selectedDay ? new Date(`${selectedDay.dateKey}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' }) : 'week'} for the semester.
              </Text>
            </View>
            <Switch
              value={recurring}
              onValueChange={setRecurring}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          activeOpacity={0.85}
          disabled={!canConfirm}
        >
          <Text style={styles.confirmButtonText}>Confirm and Add Time Slot</Text>
        </TouchableOpacity>
      </ScrollView>

      </KeyboardAvoidingView>
      <FacultyBottomTabBar active="appointment" onChange={onTabChange} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  keyboardAvoidingView: {
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
    fontSize: 16,
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
  formCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  formTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  dayBlock: {
    marginBottom: spacing.lg,
  },
  dayScroll: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  dayChip: {
    width: 60,
    alignItems: 'center',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  dayChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  dayChipName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  dayChipNum: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textDark,
    marginVertical: 2,
  },
  dayChipMonth: {
    fontSize: 11,
    color: colors.textMuted,
  },
  dayChipTextActive: {
    color: colors.white,
  },
  dayHint: {
    fontSize: 11,
    color: colors.textMuted,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textDark,
  },
  timeInput: {
    width: 44,
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 13,
    color: colors.textDark,
  },
  periodToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    marginLeft: 'auto',
  },
  periodOption: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  periodOptionActive: {
    backgroundColor: colors.tabInactiveBg,
  },
  periodOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  periodOptionTextActive: {
    color: colors.textDark,
  },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  radioOuterActive: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.primary,
  },
  typeLabel: {
    fontSize: 12,
    color: colors.textDark,
  },
  locationBlock: {
    marginBottom: spacing.lg,
  },
  locationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginTop: 6,
    marginBottom: spacing.sm,
  },
  locationIcon: {
    marginRight: 8,
  },
  locationInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textDark,
  },
  errorText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.danger,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  locationErrorText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.danger,
    marginTop: 0,
    marginBottom: spacing.md,
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  recurringTextWrap: {
    flex: 1,
    marginRight: spacing.md,
  },
  recurringHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
  confirmButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});