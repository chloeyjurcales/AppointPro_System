import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import FacultyBottomTabBar, { FacultyTabKey } from '../components/FacultyBottomTabBar';
import { ConsultationMode } from '../data/facultySlots';

type Period = 'AM' | 'PM';

export type NewFacultySlotInput = {
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

export default function AddTimeSlotScreen({
  onBack,
  onConfirm,
  onTabChange,
}: AddTimeSlotScreenProps) {
  // Defaults to a valid 10:00 AM - 12:00 PM range (previously defaulted
  // to 10:00 PM - 12:30 PM, which is an end-before-start range and would
  // have produced a negative total_minutes if confirmed untouched).
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
                    ? 'Enter meeting link (e.g. Google Meet, Zoom)'
                    : 'Enter room or location (e.g. Office Room 204)'
                }
                placeholderTextColor="#9B9B9B"
                autoCapitalize="none"
              />
            </View>
            {locationError && <Text style={styles.errorText}>{locationError}</Text>}
          </View>

          <View style={styles.recurringRow}>
            <View style={styles.recurringTextWrap}>
              <Text style={styles.fieldLabel}>Repeat Weekly</Text>
              <Text style={styles.recurringHint}>
                This slot will automatically repeat every week for the semester.
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

      <FacultyBottomTabBar active="appointment" onChange={onTabChange} />
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