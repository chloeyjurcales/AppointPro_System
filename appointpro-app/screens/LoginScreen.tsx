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
import Logo from '../components/Logo';
import AuthInput from '../components/AuthInput';
import SocialButton from '../components/SocialButton';

type Role = 'student' | 'faculty';

type LoginScreenProps = {
  initialRole?: Role;
  onLogin?: (role: Role, identifier: string, password: string) => void;
  onSignUp?: () => void;
  onForgotPassword?: () => void;
  errorMessage?: string | null;
  submitting?: boolean;
};

export default function LoginScreen({
  initialRole = 'student',
  onLogin,
  onSignUp,
  onForgotPassword,
  errorMessage,
  submitting = false,
}: LoginScreenProps) {
  const [role, setRole] = useState<Role>(initialRole);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const isStudent = role === 'student';

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
          <Logo />
          <Text style={styles.subtitle}>
            Smart Faculty Consultation{'\n'}Scheduling with{' '}
            <Text style={styles.subtitleAccent}>SlotIQ AI</Text>.
          </Text>

          <Text style={styles.welcome}>WELCOME!</Text>
          <Text style={styles.welcomeSub}>Sign in to continue to your account.</Text>

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, isStudent && styles.tabActive]}
              onPress={() => setRole('student')}
            >
              <Ionicons
                name="school-outline"
                size={16}
                color={isStudent ? colors.white : colors.tabInactiveText}
              />
              <Text style={[styles.tabText, isStudent && styles.tabTextActive]}>
                Student
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, !isStudent && styles.tabActive]}
              onPress={() => setRole('faculty')}
            >
              <Ionicons
                name="person-outline"
                size={16}
                color={!isStudent ? colors.white : colors.tabInactiveText}
              />
              <Text style={[styles.tabText, !isStudent && styles.tabTextActive]}>
                Faculty
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Email</Text>
          <AuthInput
            icon="mail-outline"
            placeholder="Enter your email"
            value={identifier}
            onChangeText={setIdentifier}
            keyboardType="email-address"
          />

          <View style={styles.spacerSm} />

          <Text style={styles.label}>Password</Text>
          <AuthInput
            icon="lock-closed-outline"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            isPassword
          />

          <TouchableOpacity onPress={onForgotPassword} style={styles.forgotWrap}>
            <Text style={styles.link}>Forgot Password?</Text>
          </TouchableOpacity>

          {!!errorMessage && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.loginButton, submitting && styles.loginButtonDisabled]}
            onPress={() => onLogin?.(role, identifier, password)}
            activeOpacity={0.85}
            disabled={submitting}
          >
            <Text style={styles.loginButtonText}>{submitting ? 'Logging In…' : 'Log In'}</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialRow}>
            <SocialButton provider="google" />
          </View>

          <View style={styles.signupRow}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={onSignUp}>
              <Text style={styles.link}>Sign up</Text>
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
  subtitle: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  subtitleAccent: {
    color: colors.primary,
    fontWeight: '700',
  },
  welcome: {
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
    marginTop: spacing.lg,
    color: colors.textDark,
  },
  welcomeSub: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.tabInactiveBg,
    borderRadius: 10,
    padding: 4,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.tabInactiveText,
  },
  tabTextActive: {
    color: colors.white,
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
  forgotWrap: {
    alignSelf: 'flex-end',
    marginTop: 6,
    marginBottom: spacing.md,
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  loginButtonDisabled: {
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
  loginButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: 8,
    fontSize: 11,
    color: colors.textMuted,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.md,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signupText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  link: {
    fontSize: 12,
    color: colors.link,
    fontWeight: '700',
  },
});