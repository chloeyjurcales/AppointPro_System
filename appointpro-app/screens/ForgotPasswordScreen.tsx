import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import AuthInput from '../components/AuthInput';
import { OTP_LENGTH } from './VerifyEmailScreen';

type ForgotPasswordScreenProps = {
  onBack?: () => void;
  onBackToLogin?: () => void;
  onSendResetLink?: (email: string) => void | boolean | Promise<void | boolean>;
  // Checks the code from the email. Return true when it was accepted (the parent then
  // opens the new-password screen).
  onVerifyCode?: (email: string, code: string) => boolean | Promise<boolean>;
};

export default function ForgotPasswordScreen({
  onBack,
  onBackToLogin,
  onSendResetLink,
  onVerifyCode,
}: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const canSubmit = email.trim().length > 0;

  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!canSubmit || sending) return;
    setSending(true);
    try {
      // The parent returns false when the request failed (it shows the
      // error itself) so we don't claim an email was sent when it wasn't.
      const result = await onSendResetLink?.(email.trim());
      if (result !== false) setSent(true);
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== OTP_LENGTH || verifying) return;
    setVerifying(true);
    try {
      const ok = await onVerifyCode?.(email.trim(), code);
      if (ok === false) setCode('');
    } finally {
      setVerifying(false);
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
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color={colors.textDark} />
          </TouchableOpacity>

          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              <Ionicons
                name={sent ? 'mail-open-outline' : 'lock-closed-outline'}
                size={28}
                color={colors.white}
              />
            </View>
          </View>

          {sent ? (
            <>
              <Text style={styles.heading}>Check Your Email</Text>
              <Text style={styles.subheading}>
                We sent a {OTP_LENGTH}-digit code to{'\n'}
                <Text style={styles.emailHighlight}>{email.trim()}</Text>.{'\n'}Enter it below to set a new
                password.
              </Text>

              <Text style={styles.label}>Verification Code</Text>
              <View style={styles.codeBox}>
                <TextInput
                  style={styles.codeInput}
                  value={code}
                  onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                  keyboardType="number-pad"
                  placeholder={'•'.repeat(OTP_LENGTH)}
                  placeholderTextColor="#9B9B9B"
                  maxLength={OTP_LENGTH}
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  autoCorrect={false}
                  autoFocus
                  editable={!verifying}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, (code.length !== OTP_LENGTH || verifying) && styles.primaryButtonDisabled]}
                onPress={handleVerify}
                activeOpacity={0.85}
                disabled={code.length !== OTP_LENGTH || verifying}
              >
                <Text style={styles.primaryButtonText}>{verifying ? 'Checking…' : 'Verify Code'}</Text>
              </TouchableOpacity>

              <View style={styles.footerRow}>
                <Text style={styles.footerText}>Didn't get the email? </Text>
                <TouchableOpacity onPress={handleSend}>
                  <Text style={styles.link}>Resend code</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.footerRow, { marginTop: spacing.sm }]}>
                <TouchableOpacity onPress={onBackToLogin ?? onBack}>
                  <Text style={styles.link}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.heading}>Forgot Password?</Text>
              <Text style={styles.subheading}>
                Enter the email address linked to your account and we'll send you a
                code to reset your password.
              </Text>

              <Text style={styles.label}>Email</Text>
              <AuthInput
                icon="mail-outline"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
              />

              <TouchableOpacity
                style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
                onPress={handleSend}
                activeOpacity={0.85}
                disabled={!canSubmit || sending}
              >
                <Text style={styles.primaryButtonText}>
                  {sending ? 'Sending…' : 'Send Reset Code'}
                </Text>
              </TouchableOpacity>

              <View style={styles.footerRow}>
                <Text style={styles.footerText}>Remembered your password? </Text>
                <TouchableOpacity onPress={onBack}>
                  <Text style={styles.link}>Log In</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  codeBox: {
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    height: 56,
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  codeInput: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.textDark,
  },
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
  emailHighlight: {
    color: colors.textDark,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 6,
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
  footerText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  link: {
    fontSize: 12,
    color: colors.link,
    fontWeight: '700',
  },
});