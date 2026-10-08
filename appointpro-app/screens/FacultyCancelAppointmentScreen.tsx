import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import ProfileAvatar from '../components/ProfileAvatar';
import { CANCEL_REASON_MAX_LENGTH, validateCancelReason } from '../lib/cancelReason';

type FacultyCancelAppointmentScreenProps = {
  studentName?: string;
  studentPhotoUri?: string;
  dateLabel?: string;
  bookedTimeRangeLabel?: string;
  location?: string;
  mode?: string;
  onBack?: () => void;
  onConfirmCancel?: (reason: string) => void;
};

export default function FacultyCancelAppointmentScreen({
  studentName = 'Chloey Lyca Jurcales',
  studentPhotoUri,
  dateLabel = 'May 13, 2026 (Tue)',
  bookedTimeRangeLabel = '10:00 AM - 10:30 AM',
  location = 'Room 305, CHMC Main Campus',
  mode = 'Face-to-Face',
  onBack,
  onConfirmCancel,
}: FacultyCancelAppointmentScreenProps) {
  const [reason, setReason] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canCancel = reason.trim().length > 0 && !checking;

  // AI reviews the reason first; the cancellation only goes ahead once it is
  // judged genuine and the faculty confirms.
  const submit = async () => {
    if (!canCancel) return;
    const text = reason.trim();
    setChecking(true);
    setError(null);
    try {
      const result = await validateCancelReason(text, 'faculty');
      if (!result.valid) {
        setError(result.message || 'Please share a genuine reason for cancelling.');
        return;
      }
      Alert.alert(
        'Cancel this appointment?',
        'The student will be notified. This cannot be undone.',
        [
          { text: 'Keep Appointment', style: 'cancel' },
          { text: 'Yes, Cancel It', style: 'destructive', onPress: () => onConfirmCancel?.(text) },
        ]
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Ionicons name="arrow-back" size={22} color={colors.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cancel Appointment</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.cardName}>{studentName}</Text>
            <Text style={styles.cardText}>{dateLabel} · {bookedTimeRangeLabel}</Text>
            <Text style={styles.cardTextMuted}>{location}</Text>
            <Text style={styles.cardTextMuted}>{mode}</Text>
          </View>

          <Text style={styles.sectionTitle}>Reason for Cancellation</Text>
          <TextInput
            style={[styles.reasonInput, !!error && { borderColor: colors.danger }]}
            placeholder="e.g. Emergency, unavailability..."
            placeholderTextColor="#9B9B9B"
            value={reason}
            onChangeText={(t) => {
              setReason(t);
              if (error) setError(null);
            }}
            multiline
            numberOfLines={4}
            maxLength={CANCEL_REASON_MAX_LENGTH}
            editable={!checking}
          />

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.warningBox}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={styles.warningText}>
              {studentName} will be notified immediately once this appointment is cancelled.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.cancelButton, !canCancel && styles.cancelButtonDisabled]}
            onPress={submit}
            disabled={!canCancel}
            activeOpacity={0.85}
          >
            {checking ? (
              <View style={styles.checkingRow}>
                <ActivityIndicator size="small" color={colors.white} />
                <Text style={styles.cancelButtonText}>Checking...</Text>
              </View>
            ) : (
              <Text style={styles.cancelButtonText}>Cancel Appointment</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.keepButton} onPress={onBack} disabled={checking} activeOpacity={0.85}>
            <Text style={styles.keepButtonText}>Keep Appointment</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  checkingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  safeArea: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: colors.textDark },
  headerSpacer: { width: 22 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  cardName: { fontSize: 13, fontWeight: '700', color: colors.textDark, marginBottom: 4 },
  cardText: { fontSize: 12, color: colors.textDark, marginBottom: 2 },
  cardTextMuted: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textDark, marginBottom: spacing.sm },
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: 13,
    color: colors.textDark,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.infoBg,
    borderRadius: 10,
    padding: spacing.md,
  },
  warningText: { flex: 1, fontSize: 11, color: colors.infoText, lineHeight: 16 },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  cancelButton: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonDisabled: { opacity: 0.4 },
  cancelButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  keepButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepButtonText: { color: colors.textDark, fontWeight: '700', fontSize: 15 },
});