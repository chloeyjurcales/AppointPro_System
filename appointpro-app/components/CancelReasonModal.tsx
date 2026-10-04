import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { CANCEL_REASON_MAX_LENGTH, validateCancelReason } from '../lib/cancelReason';
import ProfileAvatar from './ProfileAvatar';

type Props = {
  visible: boolean;
  /** The faculty member the appointment is with (real name + profile picture). */
  facultyName: string;
  facultyPhotoUri?: string | null;
  /** One line with the appointment date/time. */
  summary: string;
  onClose: () => void;
  /** Called with the approved reason. Resolve when the cancellation is done. */
  onConfirm: (reason: string) => Promise<void> | void;
};

/**
 * Asks the student why they are cancelling. The reason is checked by AI and
 * the appointment is only cancelled once the reason is judged genuine.
 */
export default function CancelReasonModal({
  visible,
  facultyName,
  facultyPhotoUri,
  summary,
  onClose,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setReason('');
      setError(null);
      setChecking(false);
    }
  }, [visible]);

  const submit = async () => {
    if (checking) return;
    const text = reason.trim();
    if (!text) {
      setError('Please tell us why you are cancelling this appointment.');
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const result = await validateCancelReason(text);
      if (!result.valid) {
        setError(result.message || 'Please share a genuine reason for cancelling.');
        return;
      }
      await onConfirm(text);
    } finally {
      setChecking(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={checking ? undefined : onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={checking ? undefined : onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.avatarWrap}>
                <ProfileAvatar uri={facultyPhotoUri} name={facultyName} size={64} role="faculty" />
              </View>
              <Text style={styles.title}>Cancel your appointment with {facultyName}?</Text>
              {!!summary && <Text style={styles.summary}>{summary}</Text>}
              <Text style={styles.prompt}>
                Please give a valid reason for cancelling. {facultyName} will see it.
              </Text>

              <TextInput
                style={[styles.input, !!error && styles.inputError]}
                value={reason}
                onChangeText={(t) => {
                  setReason(t);
                  if (error) setError(null);
                }}
                placeholder="e.g. I have a class conflict at that time"
                placeholderTextColor="#9B9B9B"
                multiline
                maxLength={CANCEL_REASON_MAX_LENGTH}
                editable={!checking}
                textAlignVertical="top"
              />
              <Text style={styles.counter}>
                {reason.length}/{CANCEL_REASON_MAX_LENGTH}
              </Text>

              {!!error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.buttons}>
                <TouchableOpacity style={styles.keepButton} onPress={onClose} disabled={checking}>
                  <Text style={styles.keepText}>Keep Appointment</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelButton, checking && styles.cancelButtonBusy]}
                  onPress={submit}
                  disabled={checking}
                  activeOpacity={0.85}
                >
                  {checking ? (
                    <View style={styles.checkingRow}>
                      <ActivityIndicator size="small" color={colors.white} />
                      <Text style={styles.cancelText}>Checking...</Text>
                    </View>
                  ) : (
                    <Text style={styles.cancelText}>Cancel Appointment</Text>
                  )}
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
  sheet: { backgroundColor: colors.white, borderRadius: 18, padding: spacing.lg, maxHeight: '90%' },
  avatarWrap: { alignSelf: 'center', marginBottom: spacing.md },
  title: { fontSize: 17, fontWeight: '700', color: colors.textDark, textAlign: 'center' },
  summary: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
  prompt: { fontSize: 13, color: colors.textDark, marginTop: spacing.md, marginBottom: spacing.sm },
  input: {
    minHeight: 96,
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: 12,
    fontSize: 14,
    color: colors.textDark,
  },
  inputError: { borderColor: colors.danger },
  counter: { fontSize: 11, color: colors.textMuted, alignSelf: 'flex-end', marginTop: 4 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FDECEA',
    borderRadius: 10,
    padding: 10,
    marginTop: spacing.sm,
  },
  errorText: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.danger },
  buttons: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  keepButton: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  cancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonBusy: { opacity: 0.8 },
  cancelText: { fontSize: 13, fontWeight: '700', color: colors.white },
  checkingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
