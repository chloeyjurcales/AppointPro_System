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
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import AuthInput from '../components/AuthInput';

type StudentSignUpScreenProps = {
  onBack?: () => void;
  onLogin?: () => void;
  onCreateAccount?: (data: {
    fullName: string;
    studentId: string;
    email: string;
    department: string;
    yearLevel: string;
    password: string;
    confirmPassword: string;
  }) => void;
  errorMessage?: string | null;
  submitting?: boolean;
};

export default function StudentSignUpScreen({
  onBack,
  onLogin,
  onCreateAccount,
  errorMessage,
  submitting = false,
}: StudentSignUpScreenProps) {
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color={colors.textDark} />
          </TouchableOpacity>

          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              <FontAwesome5 name="graduation-cap" size={26} color={colors.white} />
            </View>
          </View>

          <Text style={styles.heading}>Create Student Account</Text>
          <Text style={styles.subheading}>
            Find your details to create your student account.
          </Text>

          <Text style={styles.label}>Full Name</Text>
          <AuthInput
            placeholder="Enter your full name"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />

          <View style={styles.spacerSm} />

          <Text style={styles.label}>Student ID</Text>
          <AuthInput
            placeholder="Enter your student ID"
            value={studentId}
            onChangeText={setStudentId}
          />

          <View style={styles.spacerSm} />

          <Text style={styles.label}>Email Address</Text>
          <AuthInput
            placeholder="Enter your email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />

          <View style={styles.spacerSm} />

          <Text style={styles.label}>Department</Text>
          <AuthInput
            placeholder="Enter your department"
            value={department}
            onChangeText={setDepartment}
            autoCapitalize="words"
          />

          <View style={styles.spacerSm} />

          <Text style={styles.label}>Year Level</Text>
          <AuthInput
            placeholder="e.g. 3rd Year"
            value={yearLevel}
            onChangeText={setYearLevel}
          />

          <View style={styles.spacerSm} />

          <Text style={styles.label}>Password</Text>
          <AuthInput
            icon="lock-closed-outline"
            placeholder="Create a password"
            value={password}
            onChangeText={setPassword}
            isPassword
          />

          <View style={styles.spacerSm} />

          <Text style={styles.label}>Confirm Password</Text>
          <AuthInput
            icon="lock-closed-outline"
            placeholder="Confirm your password"
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

          {!!errorMessage && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.createButton, submitting && styles.createButtonDisabled]}
            onPress={() =>
              !submitting &&
              onCreateAccount?.({
                fullName,
                studentId,
                email,
                department,
                yearLevel,
                password,
                confirmPassword,
              })
            }
            activeOpacity={0.85}
            disabled={submitting}
          >
            <Text style={styles.createButtonText}>
              {submitting ? 'Creating Account…' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={onLogin}>
              <Text style={styles.link}>Log in</Text>
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
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  backButton: {
    marginBottom: spacing.md,
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
    fontSize: 17,
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
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FBEAEA',
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: colors.danger,
    lineHeight: 16,
  },
  createButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  link: {
    fontSize: 12,
    color: colors.link,
    fontWeight: '700',
  },
});