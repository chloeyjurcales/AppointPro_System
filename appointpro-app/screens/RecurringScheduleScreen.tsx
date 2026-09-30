import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import { ConsultationMode, DAY_NAMES } from '../data/facultySlots';
import { Period, RecurringRule } from '../data/recurringSchedule';

type RecurringScheduleScreenProps = {
  onBack?: () => void;
  onConfirm?: (rule: RecurringRule) => void;
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

export default function RecurringScheduleScreen({
  onBack,
  onConfirm,
}: RecurringScheduleScreenProps) {
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3]); // default Mon & Wed
  const [startHour, setStartHour] = useState('1');
  const [startMinute, setStartMinute] = useState('00');
  const [startPeriod, setStartPeriod] = useState<Period>('PM');
  const [endHour, setEndHour] = useState('3');
  const [endMinute, setEndMinute] = useState('00');
  const [endPeriod, setEndPeriod] = useState<Period>('PM');
  const [mode, setMode] = useState<ConsultationMode>('Face-to-Face');
  const [location, setLocation] = useState('');
  const [weeks, setWeeks] = useState('16');

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

  const canConfirm =
    selectedDays.length > 0 &&
    location.trim().length > 0 &&
    parseInt(weeks, 10) > 0 &&
    !timeError;

  const toggleDay = (dayIndex: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex]
    );
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const numWeeks = parseInt(weeks, 10);
    const semesterEnd = new Date(today);
    semesterEnd.setDate(today.getDate() + numWeeks * 7 - 1);

    const toDateKey = (d: Date) => {
      const y = d.getFullYear();
      const m = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const rule: RecurringRule = {
      id: `rule-${Date.now()}`,
      daysOfWeek: selectedDays,
      startHour: parseInt(startHour, 10) || 1,
      startMinute: parseInt(startMinute, 10) || 0,
      startPeriod,
      endHour: parseInt(endHour, 10) || 1,
      endMinute: parseInt(endMinute, 10) || 0,
      endPeriod,
      mode,
      location: location.trim(),
      createdDateKey: toDateKey(today),
      semesterEndDateKey: toDateKey(semesterEnd),
    };

    onConfirm?.(rule);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recurring Weekly Schedule</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.introText}>
          Set a schedule that repeats automatically every week for the rest of the
          semester — no need to add it week by week.
        </Text>

        <Text style={styles.sectionLabel}>Repeat on these days</Text>
        <View style={styles.dayRow}>
          {DAY_NAMES.map((name, index) => {
            const isActive = selectedDays.includes(index);
            return (
              <TouchableOpacity
                key={name}
                style={[styles.dayChip, isActive && styles.dayChipActive]}
                onPress={() => toggleDay(index)}
              >
                <Text style={[styles.dayChipText, isActive && styles.dayChipTextActive]}>
                  {name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Time Range</Text>
        <View style={styles.timeRow}>
          <Text style={styles.fieldLabel}>Start:</Text>
          <TextInput
            style={styles.timeInput}
            value={startHour}
            onChangeText={setStartHour}
            keyboardType="number-pad"
            maxLength={2}
          />
          <Text style={styles.colon}>:</Text>
          <TextInput
            style={styles.timeInput}
            value={startMinute}
            onChangeText={setStartMinute}
            keyboardType="number-pad"
            maxLength={2}
          />
          <View style={styles.periodToggle}>
            {(['AM', 'PM'] as Period[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.periodOption, startPeriod === p && styles.periodOptionActive]}
                onPress={() => setStartPeriod(p)}
              >
                <Text
                  style={[
                    styles.periodOptionText,
                    startPeriod === p && styles.periodOptionTextActive,
                  ]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
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
          <Text style={styles.colon}>:</Text>
          <TextInput
            style={styles.timeInput}
            value={endMinute}
            onChangeText={setEndMinute}
            keyboardType="number-pad"
            maxLength={2}
          />
          <View style={styles.periodToggle}>
            {(['AM', 'PM'] as Period[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.periodOption, endPeriod === p && styles.periodOptionActive]}
                onPress={() => setEndPeriod(p)}
              >
                <Text
                  style={[
                    styles.periodOptionText,
                    endPeriod === p && styles.periodOptionTextActive,
                  ]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {timeError && <Text style={styles.errorText}>{timeError}</Text>}

        <Text style={styles.sectionLabel}>Consultation Type</Text>
        <View style={styles.typeRow}>
          {(['Face-to-Face', 'Online'] as ConsultationMode[]).map((opt) => {
            const isActive = mode === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={styles.typeOption}
                onPress={() => setMode(opt)}
                activeOpacity={0.7}
              >
                <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                  {isActive && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.typeLabel}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>{isOnline ? 'Meeting Link' : 'Location'}</Text>
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
                ? 'Enter meeting link (e.g. Google Meet, Zoom)'
                : 'Enter room or location (e.g. Office Room 204)'
            }
            placeholderTextColor="#9B9B9B"
            autoCapitalize="none"
          />
        </View>

        <Text style={styles.sectionLabel}>Repeat for how many weeks</Text>
        <TextInput
          style={styles.weeksInput}
          value={weeks}
          onChangeText={setWeeks}
          keyboardType="number-pad"
          maxLength={2}
        />
        <Text style={styles.helperText}>
          A typical semester runs about 16 weeks. Slots will be created automatically for
          every matching day until then.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={!canConfirm}
          activeOpacity={0.85}
        >
          <Text style={styles.confirmButtonText}>Create Recurring Schedule</Text>
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
  introText: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dayChip: {
    width: 44,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
  },
  dayChipActive: { backgroundColor: colors.primary },
  dayChipText: { fontSize: 12, fontWeight: '600', color: colors.textDark },
  dayChipTextActive: { color: colors.white },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textDark, width: 42 },
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
  colon: { fontSize: 13, color: colors.textMuted },
  periodToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    marginLeft: 'auto',
  },
  periodOption: { paddingHorizontal: 10, paddingVertical: 8 },
  periodOptionActive: { backgroundColor: colors.tabInactiveBg },
  periodOptionText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  periodOptionTextActive: { color: colors.textDark },
  typeRow: { flexDirection: 'row', gap: spacing.xl },
  typeOption: { flexDirection: 'row', alignItems: 'center' },
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
  radioOuterActive: { borderColor: colors.primary },
  radioInner: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.primary },
  typeLabel: { fontSize: 12, color: colors.textDark },
  locationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  locationIcon: { marginRight: 8 },
  locationInput: { flex: 1, fontSize: 13, color: colors.textDark },
  errorText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.danger,
    marginTop: -4,
    marginBottom: spacing.sm,
  },
  weeksInput: {
    width: 60,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  helperText: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: { opacity: 0.4 },
  confirmButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});