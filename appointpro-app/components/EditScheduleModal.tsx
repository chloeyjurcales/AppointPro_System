import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import { ConsultationMode } from '../data/facultySlots';

type Period = 'AM' | 'PM';

export type EditableScheduleValues = {
  startHour: string;
  startMinute: string;
  startPeriod: Period;
  endHour: string;
  endMinute: string;
  endPeriod: Period;
  mode: ConsultationMode;
  location: string;
};

type Props = {
  visible: boolean;
  title: string;
  /** Short explanation shown under the title (what this edit will affect). */
  note?: string;
  /** "Are you sure...?" text shown before saving. */
  confirmMessage: string;
  initial: EditableScheduleValues | null;
  /** Resolve null when saved (modal closes) or an error message to show in the form. */
  onSave: (values: EditableScheduleValues) => Promise<string | null>;
  onClose: () => void;
};

/** Parses a label like "9:30 AM - 10:00 AM" into editable form values. */
export function valuesFromLabel(
  label: string,
  mode: ConsultationMode,
  location: string,
): EditableScheduleValues | null {
  const match = label.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  return {
    startHour: String(parseInt(match[1], 10)),
    startMinute: match[2],
    startPeriod: match[3].toUpperCase() as Period,
    endHour: String(parseInt(match[4], 10)),
    endMinute: match[5],
    endPeriod: match[6].toUpperCase() as Period,
    mode,
    location,
  };
}

function toMinutes(hourStr: string, minuteStr: string, period: Period): number | null {
  const h = parseInt(hourStr, 10);
  const m = parseInt(minuteStr, 10);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 1 || h > 12 || m < 0 || m > 59) return null;
  return (h % 12) * 60 + (period === 'PM' ? 12 * 60 : 0) + m;
}

export default function EditScheduleModal({
  visible,
  title,
  note,
  confirmMessage,
  initial,
  onSave,
  onClose,
}: Props) {
  const [v, setV] = useState<EditableScheduleValues | null>(initial);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setV(initial);
      setSaveError(null);
    }
  }, [visible, initial]);

  const values = v ?? initial;
  const isOnline = values?.mode === 'Online';

  const startMin = useMemo(
    () => (values ? toMinutes(values.startHour, values.startMinute, values.startPeriod) : null),
    [values],
  );
  const endMin = useMemo(
    () => (values ? toMinutes(values.endHour, values.endMinute, values.endPeriod) : null),
    [values],
  );

  if (!values) return null;

  const timeError =
    startMin === null || endMin === null
      ? 'Enter a valid hour (1-12) and minute (0-59) for both times.'
      : endMin <= startMin
      ? 'End time must be after the start time.'
      : null;
  const locationError = values.location.trim()
    ? null
    : isOnline
    ? 'Enter a meeting link or platform.'
    : 'Enter a room or location.';
  const canSave = !timeError && !locationError && !saving;

  const set = <K extends keyof EditableScheduleValues>(key: K, value: EditableScheduleValues[K]) =>
    setV({ ...values, [key]: value });

  const submit = () => {
    if (!canSave) return;
    Alert.alert('Save changes?', confirmMessage, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, Save Changes',
        onPress: async () => {
          setSaving(true);
          setSaveError(null);
          try {
            const error = await onSave({ ...values, location: values.location.trim() });
            if (error === null) onClose();
            else setSaveError(error);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const periodToggle = (value: Period, onChange: (p: Period) => void) => (
    <View style={styles.periodToggle}>
      {(['AM', 'PM'] as Period[]).map((p) => (
        <TouchableOpacity
          key={p}
          style={[styles.periodOption, value === p && styles.periodOptionActive]}
          onPress={() => onChange(p)}
        >
          <Text style={[styles.periodText, value === p && styles.periodTextActive]}>{p}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={saving ? undefined : onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>{title}</Text>
              {!!note && <Text style={styles.note}>{note}</Text>}

              <View style={styles.timeRow}>
                <Text style={styles.label}>Start:</Text>
                <TextInput
                  style={styles.timeInput}
                  value={values.startHour}
                  onChangeText={(t) => set('startHour', t)}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={styles.colon}>:</Text>
                <TextInput
                  style={styles.timeInput}
                  value={values.startMinute}
                  onChangeText={(t) => set('startMinute', t)}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                {periodToggle(values.startPeriod, (p) => set('startPeriod', p))}
              </View>

              <View style={styles.timeRow}>
                <Text style={styles.label}>End:</Text>
                <TextInput
                  style={styles.timeInput}
                  value={values.endHour}
                  onChangeText={(t) => set('endHour', t)}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={styles.colon}>:</Text>
                <TextInput
                  style={styles.timeInput}
                  value={values.endMinute}
                  onChangeText={(t) => set('endMinute', t)}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                {periodToggle(values.endPeriod, (p) => set('endPeriod', p))}
              </View>
              {!!timeError && <Text style={styles.error}>{timeError}</Text>}

              <View style={styles.modeRow}>
                {(['Face-to-Face', 'Online'] as ConsultationMode[]).map((m) => (
                  <TouchableOpacity key={m} style={styles.modeOption} onPress={() => set('mode', m)}>
                    <View style={[styles.radioOuter, values.mode === m && styles.radioOuterActive]}>
                      {values.mode === m && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.modeLabel}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>{isOnline ? 'Meeting Link' : 'Location'}</Text>
              <View style={styles.locationRow}>
                <Ionicons
                  name={isOnline ? 'link-outline' : 'location-outline'}
                  size={16}
                  color={colors.textMuted}
                />
                <TextInput
                  style={styles.locationInput}
                  value={values.location}
                  onChangeText={(t) => set('location', t)}
                  placeholder={isOnline ? 'Enter meeting link' : 'Enter room or location'}
                  placeholderTextColor="#9B9B9B"
                  autoCapitalize="none"
                />
              </View>
              {!!locationError && <Text style={styles.error}>{locationError}</Text>}
              {!!saveError && <Text style={styles.saveError}>{saveError}</Text>}

              <View style={styles.buttons}>
                <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={saving}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
                  onPress={submit}
                  disabled={!canSave}
                >
                  <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.white, borderRadius: 16, padding: spacing.lg, maxHeight: '90%' },
  title: { fontSize: 16, fontWeight: '700', color: colors.textDark, textAlign: 'center' },
  note: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 6, marginBottom: spacing.md },
  label: { fontSize: 12, fontWeight: '600', color: colors.textDark },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
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
  colon: { fontSize: 14, color: colors.textDark },
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
  periodText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  periodTextActive: { color: colors.textDark },
  modeRow: { flexDirection: 'row', gap: spacing.xl, marginVertical: spacing.lg },
  modeOption: { flexDirection: 'row', alignItems: 'center' },
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
  modeLabel: { fontSize: 12, color: colors.textDark },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginTop: 6,
  },
  locationInput: { flex: 1, fontSize: 13, color: colors.textDark },
  saveError: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
    backgroundColor: '#FDECEA',
    borderRadius: 8,
    padding: 10,
    marginTop: spacing.md,
  },
  error: { fontSize: 11, fontWeight: '600', color: colors.danger, marginTop: 6 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  cancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  saveButton: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveText: { fontSize: 14, fontWeight: '700', color: colors.white },
});