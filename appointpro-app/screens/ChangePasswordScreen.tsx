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

type ChangePasswordScreenProps = {
  onBack?: () => void;
  onSave?: (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => void;
};

export default function ChangePasswordScreen({
  onBack,
  onSave,
}: ChangePasswordScreenProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconWrap}>
            <View style={styles.iconCircle}>
              <Ionicons name="lock-closed-outline" size={26} color={colors.white} />
            </View>
          </View>

          <Text style={styles.heading}>Update Your Password</Text>
          <Text style={styles.subheading}>
            Choose a strong password you haven't used before.
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

          <View style={styles.infoBox}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={colors.infoText}
              style={styles.infoIcon}
            />
            <Text style={styles.infoText}>
              Use at least 8 characters with a mix of letters, numbers, and symbols.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => onSave?.({ currentPassword, newPassword, confirmPassword })}
            activeOpacity={0.85}
          >
            <Text style={styles.saveButtonText}>Save New Password</Text>
          </TouchableOpacity>
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
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  iconWrap: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.infoBg,
    borderRadius: 10,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
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
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});