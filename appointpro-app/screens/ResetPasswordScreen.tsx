import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import AuthInput from '../components/AuthInput';

type ResetPasswordScreenProps = {
  onCancel?: () => void;
  onSave?: (newPassword: string) => Promise<boolean>;
};

export default function ResetPasswordScreen({
  onCancel,
  onSave,
}: ResetPasswordScreenProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave?.(newPassword);
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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              <Ionicons name="key-outline" size={28} color={colors.white} />
            </View>
          </View>

          <Text style={styles.heading}>Set a New Password</Text>
          <Text style={styles.subheading}>
            Choose a new password for your account. You'll use it to log in
            right after.
          </Text>

          <Text style={styles.label}>New Password</Text>
          <AuthInput
            icon="lock-closed-outline"
            placeholder="Enter a new password"
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

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={saving}
          >
            <Text style={styles.primaryButtonText}>
              {saving ? 'Saving…' : 'Save New Password'}
            </Text>
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <TouchableOpacity onPress={onCancel}>
              <Text style={styles.link}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  avatarWrap: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
    color: colors.textDark,
    marginBottom: spacing.sm,
  },
  subheading: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 6,
  },
  spacerSm: {
    height: spacing.sm,
  },
  errorText: {
    color: '#D93025',
    fontSize: 12,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  link: {
    fontSize: 12,
    color: colors.link,
    fontWeight: '700',
  },
});