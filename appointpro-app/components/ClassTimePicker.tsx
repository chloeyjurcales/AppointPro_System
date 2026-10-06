import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

// ---------------------------------------------------------------------------
// One class time = a start and an end, each picked from Hour / Minute / AM-PM
// dropdowns. Minutes go in steps of MINUTE_STEP (change it to 1 for every minute).
// ---------------------------------------------------------------------------
const MINUTE_STEP = 5;

export type TimeBox = {
  startHour: string;
  startMinute: string;
  startPeriod: string;
  endHour: string;
  endMinute: string;
  endPeriod: string;
};

export const emptyTimeBox = (): TimeBox => ({
  startHour: '',
  startMinute: '',
  startPeriod: '',
  endHour: '',
  endMinute: '',
  endPeriod: '',
});

const values = (box: TimeBox) => Object.values(box);

export const isTimeBoxEmpty = (box: TimeBox) => values(box).every((v) => !v);
export const isTimeBoxComplete = (box: TimeBox) => values(box).every((v) => !!v);

// Text the existing parser understands, e.g. "7:00am-9:30am". '' when nothing is picked yet.
export function timeBoxToText(box: TimeBox): string {
  if (isTimeBoxEmpty(box)) return '';
  if (!isTimeBoxComplete(box)) return '?';
  return `${box.startHour}:${box.startMinute}${box.startPeriod.toLowerCase()}-${box.endHour}:${box.endMinute}${box.endPeriod.toLowerCase()}`;
}

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) }));
const MINUTE_OPTIONS = Array.from({ length: Math.ceil(60 / MINUTE_STEP) }, (_, i) => {
  const text = String(i * MINUTE_STEP).padStart(2, '0');
  return { label: text, value: text };
});
const PERIOD_OPTIONS = [
  { label: 'AM', value: 'AM' },
  { label: 'PM', value: 'PM' },
];

type Option = { label: string; value: string };

type SelectProps = {
  value: string;
  options: Option[];
  placeholder: string;
  onChange: (value: string) => void;
  accessibilityLabel: string;
  hasError?: boolean;
  flex?: number;
};

/**
 * Dropdown. On the web it is a real <select>, so the Up (↑) and Down (↓) arrow keys
 * move through the items (and Enter / Tab confirms). On phones it opens a list.
 */
function Select({ value, options, placeholder, onChange, accessibilityLabel, hasError, flex = 1 }: SelectProps) {
  const [open, setOpen] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <View style={{ flex }}>
        {React.createElement(
          'select',
          {
            value,
            'aria-label': accessibilityLabel,
            onChange: (event: { target: { value: string } }) => onChange(event.target.value),
            style: {
              height: 44,
              width: '100%',
              borderRadius: 10,
              border: `1px solid ${hasError ? colors.danger : colors.border}`,
              backgroundColor: colors.white,
              color: value ? colors.textDark : colors.textMuted,
              fontSize: 14,
              paddingLeft: 8,
              paddingRight: 4,
              cursor: 'pointer',
            },
          },
          React.createElement('option', { value: '', disabled: true }, placeholder),
          ...options.map((option) =>
            React.createElement('option', { key: option.value, value: option.value }, option.label),
          ),
        )}
      </View>
    );
  }

  const selected = options.find((option) => option.value === value);
  return (
    <>
      <Pressable
        style={[styles.field, { flex }, hasError && styles.fieldError]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Text style={[styles.fieldText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{accessibilityLabel}</Text>
            <ScrollView style={styles.sheetList}>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{option.label}</Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

type PickerProps = {
  value: TimeBox;
  onChange: (box: TimeBox) => void;
  hasError?: boolean;
};

export default function ClassTimePicker({ value, onChange, hasError }: PickerProps) {
  const set = (patch: Partial<TimeBox>) => onChange({ ...value, ...patch });

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Start</Text>
        <Select
          value={value.startHour}
          options={HOUR_OPTIONS}
          placeholder="Hr"
          onChange={(v) => set({ startHour: v })}
          accessibilityLabel="Start hour"
          hasError={hasError}
        />
        <Text style={styles.colon}>:</Text>
        <Select
          value={value.startMinute}
          options={MINUTE_OPTIONS}
          placeholder="Min"
          onChange={(v) => set({ startMinute: v })}
          accessibilityLabel="Start minute"
          hasError={hasError}
        />
        <Select
          value={value.startPeriod}
          options={PERIOD_OPTIONS}
          placeholder="AM/PM"
          onChange={(v) => set({ startPeriod: v })}
          accessibilityLabel="Start AM or PM"
          hasError={hasError}
          flex={1.1}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>End</Text>
        <Select
          value={value.endHour}
          options={HOUR_OPTIONS}
          placeholder="Hr"
          onChange={(v) => set({ endHour: v })}
          accessibilityLabel="End hour"
          hasError={hasError}
        />
        <Text style={styles.colon}>:</Text>
        <Select
          value={value.endMinute}
          options={MINUTE_OPTIONS}
          placeholder="Min"
          onChange={(v) => set({ endMinute: v })}
          accessibilityLabel="End minute"
          hasError={hasError}
        />
        <Select
          value={value.endPeriod}
          options={PERIOD_OPTIONS}
          placeholder="AM/PM"
          onChange={(v) => set({ endPeriod: v })}
          accessibilityLabel="End AM or PM"
          hasError={hasError}
          flex={1.1}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowLabel: { width: 34, fontSize: 12, color: colors.textMuted },
  colon: { fontSize: 16, fontWeight: '700', color: colors.textDark },
  field: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    backgroundColor: colors.white,
  },
  fieldError: { borderColor: colors.danger },
  fieldText: { flex: 1, fontSize: 14, color: colors.textDark },
  placeholder: { color: colors.textMuted },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.white, borderRadius: 16, padding: spacing.lg, maxHeight: '70%' },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: colors.textDark, marginBottom: spacing.md },
  sheetList: { flexGrow: 0 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  optionText: { fontSize: 14, color: colors.textDark },
  optionTextSelected: { fontWeight: '700', color: colors.primary },
});