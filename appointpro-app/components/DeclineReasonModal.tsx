import React, { useEffect, useState } from 'react';
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
import { colors, spacing } from '../theme';
import ProfileAvatar from './ProfileAvatar';

const MAX_LENGTH = 200;

type Props = {
  visible: boolean;
  studentName: string;
  studentPhotoUri?: string | null;
  /** One line with the appointment date and time. */
  summary: string;
  onClose: () => void;
  /** Called with the (optional) reason once the faculty confirms. */
  onConfirm: (reason: string) => void;
};

/**
 * Asked before declining a student's request: confirms the decision and lets the
 * faculty add an optional reason, which is sent to the student in the notification.
 */
export default function DeclineReasonModal({
  visible,
  studentName,
  studentPhotoUri,
  summary,
  onClose,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (visible) setReason('');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.avatarWrap}>
                <ProfileAvatar uri={studentPhotoUri} name={studentName} size={60} role="student" />
              </View>
              <Text style={styles.title}>Decline {studentName}'s appointment?</Text>
              {!!summary && <Text style={styles.summary}>{summary}</Text>}
              <Text style={styles.prompt}>
                Add a reason so {studentName} knows why (optional). They will be notified.
              </Text>

              <TextInput
                style={styles.input}
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. I'm unavailable at that time. Please book another slot."
                placeholderTextColor="#9B9B9B"
                multiline
                maxLength={MAX_LENGTH}
                textAlignVertical="top"
              />
              <Text style={styles.counter}>
                {reason.length}/{MAX_LENGTH}
              </Text>

              <View style={styles.buttons}>
                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.declineButton} onPress={() =>
                  Alert.alert(
                    'Decline this request?',
                    'The student will be told it was declined. This cannot be undone.',
                    [
                      { text: 'Go Back', style: 'cancel' },
                      { text: 'Yes, Decline', style: 'destructive', onPress: () => onConfirm(reason.trim()) },
                    ]
                  )
                }>
                  <Text style={styles.declineText}>Decline Appointment</Text>
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
    minHeight: 90,
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: colors.textDark,
  },
  counter: { fontSize: 11, color: colors.textMuted, alignSelf: 'flex-end', marginTop: 4 },
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
  cancelText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  declineButton: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineText: { fontSize: 13, fontWeight: '700', color: colors.white },
});