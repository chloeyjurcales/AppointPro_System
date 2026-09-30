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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import ProfileAvatar from '../components/ProfileAvatar';

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
  const canCancel = reason.trim().length > 0;

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
            style={styles.reasonInput}
            placeholder="e.g. Emergency, unavailability..."
            placeholderTextColor="#9B9B9B"
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={4}
          />

          <View style={styles.warningBox}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={styles.warningText}>
              The student will be notified immediately once this appointment is cancelled.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.cancelButton, !canCancel && styles.cancelButtonDisabled]}
            onPress={() => canCancel && onConfirmCancel?.(reason.trim())}
            disabled={!canCancel}
            activeOpacity={0.85}
          >
            <Text style={styles.cancelButtonText}>Cancel Appointment</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.keepButton} onPress={onBack} activeOpacity={0.85}>
            <Text style={styles.keepButtonText}>Keep Appointment</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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