import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

type RescheduleProposalScreenProps = {
  doctorName?: string;
  reason?: string;
  originalDateLabel?: string;
  originalTime?: string;
  originalLocation?: string;
  proposedDateLabel?: string;
  proposedTime?: string;
  proposedLocation?: string;
  proposedMode?: string;
  onBack?: () => void;
  onAccept?: () => void;
  onChooseAnother?: () => void;
};

export default function RescheduleProposalScreen({
  doctorName = 'Dr. Juan Dela Cruz',
  reason = '',
  originalDateLabel = '',
  originalTime = '',
  originalLocation = '',
  proposedDateLabel = '',
  proposedTime = '',
  proposedLocation = '',
  proposedMode = '',
  onBack,
  onAccept,
  onChooseAnother,
}: RescheduleProposalScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reschedule Request</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.banner}>
          <Ionicons name="calendar-outline" size={22} color={colors.primary} />
          <Text style={styles.bannerText}>
            {doctorName} has requested to reschedule your appointment.
          </Text>
        </View>

        {reason.length > 0 && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Reason</Text>
            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Original Schedule</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>{originalDateLabel} · {originalTime}</Text>
          <Text style={styles.cardTextMuted}>{originalLocation}</Text>
        </View>

        <Text style={styles.sectionTitle}>Proposed New Schedule</Text>
        <View style={[styles.card, styles.cardHighlight]}>
          <Text style={styles.cardText}>{proposedDateLabel} · {proposedTime}</Text>
          <Text style={styles.cardTextMuted}>{proposedLocation}</Text>
          <Text style={styles.cardTextMuted}>{proposedMode}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.acceptButton} onPress={onAccept} activeOpacity={0.85}>
          <Text style={styles.acceptButtonText}>Accept New Schedule</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.chooseButton} onPress={onChooseAnother} activeOpacity={0.85}>
          <Text style={styles.chooseButtonText}>Choose Another Slot</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.white },
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.infoBg,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  bannerText: { flex: 1, fontSize: 12, color: colors.infoText, lineHeight: 17 },
  reasonBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  reasonLabel: { fontSize: 11, fontWeight: '700', color: colors.textDark, marginBottom: 4 },
  reasonText: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textDark, marginBottom: spacing.sm },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  cardHighlight: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  cardText: { fontSize: 13, fontWeight: '700', color: colors.textDark, marginBottom: 2 },
  cardTextMuted: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  acceptButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  chooseButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooseButtonText: { color: colors.textDark, fontWeight: '700', fontSize: 15 },
});