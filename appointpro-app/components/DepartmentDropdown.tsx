import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

export const DEPARTMENTS = ['CCS', 'CCJE', 'BSA', 'BSE'] as const;

type Props = {
  value: string;
  onChange: (department: string) => void;
  placeholder?: string;
  /** Match the surrounding form: 'auth' (taller field) or 'form' (profile screens). */
  variant?: 'auth' | 'form';
};

/** Drop-down for choosing a department (CCS, CCJE, BSA or BSE). */
export default function DepartmentDropdown({
  value,
  onChange,
  placeholder = 'Select your department',
  variant = 'form',
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={[styles.field, variant === 'auth' ? styles.fieldAuth : styles.fieldForm]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Select department"
      >
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Select your department</Text>
            {DEPARTMENTS.map((department) => {
              const selected = department === value;
              return (
                <TouchableOpacity
                  key={department}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => {
                    onChange(department);
                    setOpen(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{department}</Text>
                  {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
  },
  fieldAuth: { height: 48, paddingHorizontal: 12 },
  fieldForm: { height: 46, paddingHorizontal: 14, marginBottom: spacing.md },
  value: { flex: 1, fontSize: 14, color: colors.textDark },
  placeholder: { color: '#9B9B9B' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.lg,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
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
