import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import AnimatedPressable from '../components/AnimatedPressable';
import AuthInput from '../components/AuthInput';

export type PersonalInformation = {
  name: string;
  email: string;
  department: string;
  yearLevel: string;
};

export type PasswordChange = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type PersonalInformationScreenProps = PersonalInformation & {
  studentId?: string;
  onBack?: () => void;
  onSave?: (data: PersonalInformation, passwordChange?: PasswordChange) => void | Promise<void>;
};

export default function PersonalInformationScreen({
  name,
  email,
  department,
  yearLevel,
  studentId,
  onBack,
  onSave,
}: PersonalInformationScreenProps) {
  const [form, setForm] = useState<PersonalInformation>({
    name,
    email,
    department,
    yearLevel,
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (field: keyof PersonalInformation) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (saving) return;

    const wantsPasswordChange = !!(currentPassword || newPassword || confirmPassword);

    if (!wantsPasswordChange) {
      setPasswordError(null);
      setSaving(true);
      try {
        await onSave?.(form);
      } catch {
        // The parent displays the save error and keeps this screen open.
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Fill in all three password fields, or leave them all blank.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordError(null);
    setSaving(true);
    try {
      await onSave?.(form, { currentPassword, newPassword, confirmPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      // The parent displays the save error and keeps this screen open.
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.headerBg}>
          <AnimatedPressable onPress={onBack} style={styles.backButton} scaleTo={0.9}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </AnimatedPressable>
          <Text style={styles.headerTitle}>Personal Information</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {studentId ? (
            <View style={styles.readOnlyRow}>
              <Text style={styles.label}>Student ID</Text>
              <Text style={styles.readOnlyValue}>{studentId}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={update('name')}
            placeholder="Enter your full name"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={form.email}
            onChangeText={update('email')}
            placeholder="Enter your email"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Department</Text>
          <TextInput
            style={styles.input}
            value={form.department}
            onChangeText={update('department')}
            placeholder="Enter your department"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Year Level</Text>
          <TextInput
            style={styles.input}
            value={form.yearLevel}
            onChangeText={update('yearLevel')}
            placeholder="Enter your year level"
            placeholderTextColor={colors.textMuted}
          />

          <View style={styles.sectionDivider} />

          <View style={styles.sectionHeaderRow}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.textDark} />
            <Text style={styles.sectionHeaderText}>Change Password</Text>
          </View>
          <Text style={styles.sectionSubtext}>
            Leave these blank if you don't want to change your password.
          </Text>

          <Text style={styles.label}>Current Password</Text>
          <AuthInput
            icon="lock-closed-outline"
            placeholder="Enter your current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            isPassword
          />

          <View style={styles.spacerSm} />

          <Text style={styles.label}>New Password</Text>
          <AuthInput
            icon="lock-closed-outline"
            placeholder="Create a new password"
            value={newPassword}
            onChangeText={setNewPassword}
            isPassword
          />

          <View style={styles.spacerSm} />

          <Text style={styles.label}>Confirm New Password</Text>
          <AuthInput
            icon="lock-closed-outline"
            placeholder="Confirm your new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isPassword
          />

          {passwordError && <Text style={styles.errorText}>{passwordError}</Text>}

          <AnimatedPressable style={styles.saveButton} onPress={handleSave} scaleTo={0.97} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </AnimatedPressable>
        </ScrollView>
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
  headerBg: {
    backgroundColor: colors.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    marginRight: spacing.md,
    padding: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  readOnlyRow: {
    marginBottom: spacing.md,
  },
  readOnlyValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    backgroundColor: colors.tabInactiveBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    lineHeight: 46,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 6,
  },
  input: {
    height: 46,
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.textDark,
    marginBottom: spacing.md,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDark,
  },
  sectionSubtext: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  spacerSm: {
    height: spacing.sm,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.infoBg,
    borderRadius: 10,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  infoIcon: {
    marginRight: 8,
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: colors.infoText,
    lineHeight: 17,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  saveButton: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  saveButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});