import React, { useEffect, useRef, useState } from 'react';
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

// Must match "Email OTP Length" in Supabase → Authentication → Providers →
// Email (default is 6).
export const OTP_LENGTH = 8;
const RESEND_COOLDOWN_SECONDS = 60;

type VerifyEmailScreenProps = {
  email: string;
  onBack?: () => void;
  onChangeEmail?: () => void;
  // Return true when the code was accepted. The parent handles navigation.
  onVerify?: (code: string) => void | boolean | Promise<void | boolean>;
  // Return true when a new code was sent.
  onResend?: () => void | boolean | Promise<void | boolean>;
  errorMessage?: string | null;
  submitting?: boolean;
};

export default function VerifyEmailScreen({
  email,
  onBack,
  onChangeEmail,
  onVerify,
  onResend,
  errorMessage,
  submitting = false,
}: VerifyEmailScreenProps) {
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);
  const lastSubmittedRef = useRef<string>('');

  // Tick the resend countdown down once a second.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const canVerify = code.length === OTP_LENGTH && !submitting;

  const submit = async (value: string) => {
    if (value.length !== OTP_LENGTH || submitting) return;
    lastSubmittedRef.current = value;
    const ok = await onVerify?.(value);
    // Wrong/expired code: clear it so they can type a fresh one.
    if (ok === false) {
      setCode('');
      lastSubmittedRef.current = '';
    }
  };

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    // Auto-submit as soon as the last digit is entered (or pasted).
    if (digits.length === OTP_LENGTH && lastSubmittedRef.current !== digits) {
      submit(digits);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      const ok = await onResend?.();
      if (ok !== false) {
        setCode('');
        lastSubmittedRef.current = '';
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }
    } finally {
      setResending(false);
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
              <Ionicons name="mail-open-outline" size={28} color={colors.white} />
            </View>
          </View>

          <Text style={styles.heading}>Verify Your Email</Text>
          <Text style={styles.subheading}>
            We sent a {OTP_LENGTH}-digit code to{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
            {'\n'}Enter it below to finish creating your account.
          </Text>

          <Text style={styles.label}>Verification Code</Text>
          <View style={styles.codeBox}>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={handleChange}
              keyboardType="number-pad"
              placeholder={'•'.repeat(OTP_LENGTH)}
              placeholderTextColor="#9B9B9B"
              maxLength={OTP_LENGTH}
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              autoCorrect={false}
              autoFocus
              editable={!submitting}
            />
          </View>

          {!!errorMessage && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.verifyButton, !canVerify && styles.verifyButtonDisabled]}
            onPress={() => submit(code)}
            activeOpacity={0.85}
            disabled={!canVerify}
          >
            <Text style={styles.verifyButtonText}>
              {submitting ? 'Verifying…' : 'Verify & Create Account'}
            </Text>
          </TouchableOpacity>

          <View style={styles.resendRow}>
            <Text style={styles.resendText}>Didn't get the code? </Text>
            {cooldown > 0 ? (
              <Text style={styles.resendCountdown}>Resend in {cooldown}s</Text>
            ) : (
              <TouchableOpacity onPress={handleResend} disabled={resending}>
                <Text style={styles.link}>{resending ? 'Sending…' : 'Resend code'}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.infoBox}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={colors.infoText}
              style={styles.infoIcon}
            />
            <Text style={styles.infoText}>
              Check your spam folder if you can't find it. The code expires after a short
              time, so request a new one if it stops working.
            </Text>
          </View>

          <View style={styles.resendRow}>
            <Text style={styles.resendText}>Wrong email? </Text>
            <TouchableOpacity onPress={onChangeEmail}>
              <Text style={styles.link}>Sign up again</Text>
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
    lineHeight: 18,
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
  verifyButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  resendText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  resendCountdown: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  link: {
    fontSize: 12,
    color: colors.link,
    fontWeight: '700',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.infoBg,
    borderRadius: 10,
    padding: spacing.md,
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
});