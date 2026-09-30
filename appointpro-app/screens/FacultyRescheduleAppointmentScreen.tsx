import React, { useEffect, useState } from 'react';
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
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import ProfileAvatar from '../components/ProfileAvatar';
import {
  WEEK_DAYS,
  ScheduleSlot,
  isSlotFull,
  getFittingDurationOptions,
} from '../data/facultySchedule';

type FacultyRescheduleAppointmentScreenProps = {
  scheduleByDate: Record<number, ScheduleSlot[]>;
  studentName?: string;
  studentPhotoUri?: string;
  category?: string;
  purpose?: string;
  originalDateLabel?: string;
  originalTime?: string;
  originalLocation?: string;
  originalMode?: string;
  durationMinutes?: number;
  onBack?: () => void;
  onConfirm?: (data: {
    date: number;
    dateLabel: string;
    slot: ScheduleSlot;
    durationMinutes: number;
    reason: string;
    meetingLink?: string;
  }) => void;
};

export default function FacultyRescheduleAppointmentScreen({
  scheduleByDate,
  studentName = 'Chloey Lyca Jurcales',
  studentPhotoUri,
  category = 'Academic Advising',
  purpose = '',
  originalDateLabel = 'May 13, 2026 (Tue)',
  originalTime = '10:00 AM',
  originalLocation = 'Room 305, CHMC Main Campus',
  originalMode = 'Face-to-Face',
  durationMinutes = 30,
  onBack,
  onConfirm,
}: FacultyRescheduleAppointmentScreenProps) {
  const firstAvailableDate =
    WEEK_DAYS.find((d) =>
      (scheduleByDate[d.date] ?? []).some(
        (s) => !isSlotFull(s) && getFittingDurationOptions(s).some((o) => o.minutes === durationMinutes)
      )
    )?.date ?? WEEK_DAYS[0].date;

  const [selectedDate, setSelectedDate] = useState(firstAvailableDate);
  const [selectedSlotId, setSelectedSlotId] = useState<string | undefined>();
  const [reason, setReason] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [userPickedDate, setUserPickedDate] = useState(false);

  // The faculty's schedule loads after this screen mounts; until the user
  // picks a day, jump to the first day that can actually fit this booking.
  useEffect(() => {
    if (userPickedDate) return;
    const first = WEEK_DAYS.find((d) =>
      (scheduleByDate[d.date] ?? []).some(
        (s) => !isSlotFull(s) && getFittingDurationOptions(s).some((o) => o.minutes === durationMinutes)
      )
    )?.date;
    if (first !== undefined) setSelectedDate(first);
  }, [scheduleByDate]);

  const slotsForDate = scheduleByDate[selectedDate] ?? [];
  const selectedDay = WEEK_DAYS.find((d) => d.date === selectedDate);
  const selectedSlot = slotsForDate.find((s) => s.id === selectedSlotId);
  const isNewSlotOnline = selectedSlot?.mode === 'Online';

  const slotFits = (slot: ScheduleSlot) =>
    !isSlotFull(slot) && getFittingDurationOptions(slot).some((o) => o.minutes === durationMinutes);

  const canConfirm =
    reason.trim().length > 0 &&
    !!selectedSlot &&
    (!isNewSlotOnline || meetingLink.trim().length > 0);

  const handleConfirm = () => {
    if (!selectedSlot || !selectedDay || !canConfirm) return;
    onConfirm?.({
      date: selectedDate,
      dateLabel: selectedDay.fullLabel,
      slot: selectedSlot,
      durationMinutes,
      reason: reason.trim(),
      meetingLink: isNewSlotOnline ? meetingLink.trim() : undefined,
    });
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
          <Text style={styles.headerTitle}>Reschedule Appointment</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.studentCard}>
            <ProfileAvatar uri={studentPhotoUri} name={studentName} size={44} role="student" />
            <View>
              <Text style={styles.studentName}>{studentName}</Text>
              <Text style={styles.studentDetail}>{category}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Current Schedule</Text>
          <View style={styles.currentCard}>
            <Text style={styles.currentText}>{originalDateLabel} · {originalTime}</Text>
            <Text style={styles.currentTextMuted}>{originalLocation}</Text>
            <Text style={styles.currentTextMuted}>{originalMode}</Text>
            {purpose.length > 0 && (
              <>
                <View style={styles.purposeDivider} />
                <Text style={styles.purposeLabel}>Purpose</Text>
                <Text style={styles.purposeText}>{purpose}</Text>
              </>
            )}
          </View>

          <Text style={styles.sectionTitle}>Reason for Reschedule</Text>
          <TextInput
            style={styles.reasonInput}
            placeholder="e.g. Emergency meeting, schedule conflict..."
            placeholderTextColor="#9B9B9B"
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.sectionTitle}>Select New Date</Text>
          <View style={styles.dateRow}>
            {WEEK_DAYS.map((d) => {
              const isActive = d.date === selectedDate;
              const hasFit = (scheduleByDate[d.date] ?? []).some(slotFits);
              return (
                <TouchableOpacity
                  key={d.date}
                  style={[
                    styles.dateChip,
                    isActive && styles.dateChipActive,
                    !hasFit && styles.dateChipDisabled,
                  ]}
                  onPress={() => {
                    if (!hasFit) return;
                    setUserPickedDate(true);
                    setSelectedDate(d.date);
                    setSelectedSlotId(undefined);
                  }}
                  disabled={!hasFit}
                >
                  <Text
                    style={[
                      styles.dateDay,
                      isActive && styles.dateTextActive,
                      !hasFit && styles.dateTextDisabled,
                    ]}
                  >
                    {d.day}
                  </Text>
                  <Text
                    style={[
                      styles.dateNum,
                      isActive && styles.dateTextActive,
                      !hasFit && styles.dateTextDisabled,
                    ]}
                  >
                    {d.date}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.selectedDayLabel}>{selectedDay?.fullLabel}</Text>

          <Text style={styles.sectionTitle}>Select New Time</Text>
          {slotsForDate.length === 0 ? (
            <Text style={styles.emptyText}>No slots on this day.</Text>
          ) : (
            slotsForDate.map((slot) => {
              const fits = slotFits(slot);
              const isSelected = slot.id === selectedSlotId;
              return (
                <TouchableOpacity
                  key={slot.id}
                  style={[
                    styles.slotCard,
                    isSelected && styles.slotCardSelected,
                    !fits && styles.slotCardDisabled,
                  ]}
                  onPress={() => fits && setSelectedSlotId(slot.id)}
                  disabled={!fits}
                  activeOpacity={fits ? 0.75 : 1}
                >
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterActive]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <View style={styles.slotTextWrap}>
                    <Text style={[styles.slotTime, !fits && styles.slotTextDisabled]}>
                      {slot.time}
                    </Text>
                    <Text style={[styles.slotLocation, !fits && styles.slotTextDisabled]}>
                      {slot.location}
                    </Text>
                  </View>
                  {!fits && <Text style={styles.noFitTag}>Doesn't fit</Text>}
                </TouchableOpacity>
              );
            })
          )}

          {isNewSlotOnline && (
            <>
              <Text style={styles.sectionTitle}>New Meeting Link</Text>
              <View style={styles.linkInputWrap}>
                <Ionicons name="link-outline" size={16} color={colors.textMuted} />
                <TextInput
                  style={styles.linkInput}
                  placeholder="e.g. https://meet.google.com/abc-defg-hij"
                  placeholderTextColor="#9B9B9B"
                  value={meetingLink}
                  onChangeText={setMeetingLink}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>
              <Text style={styles.linkHint}>
                This appointment moved to an online slot — the student needs a fresh
                link since the old one no longer applies.
              </Text>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={!canConfirm}
            activeOpacity={0.85}
          >
            <Text style={styles.confirmButtonText}>Confirm Reschedule</Text>
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
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  studentName: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  studentDetail: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  currentCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  currentText: { fontSize: 13, fontWeight: '700', color: colors.textDark, marginBottom: 2 },
  currentTextMuted: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  purposeDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  purposeLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginBottom: 2 },
  purposeText: { fontSize: 12, color: colors.textDark, lineHeight: 17 },
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: 13,
    color: colors.textDark,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  dateChip: {
    width: 40,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
  },
  dateChipActive: { backgroundColor: colors.primary },
  dateChipDisabled: { opacity: 0.35 },
  dateDay: { fontSize: 10, color: colors.textMuted, marginBottom: 4 },
  dateNum: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  dateTextActive: { color: colors.white },
  dateTextDisabled: { color: colors.textMuted },
  selectedDayLabel: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.md },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  slotCardSelected: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  slotCardDisabled: { backgroundColor: colors.inputBackground, opacity: 0.6 },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  radioOuterActive: { borderColor: colors.primary },
  radioInner: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.primary },
  slotTextWrap: { flex: 1 },
  slotTime: { fontSize: 13, fontWeight: '700', color: colors.textDark, marginBottom: 2 },
  slotLocation: { fontSize: 11, color: colors.textMuted },
  slotTextDisabled: { color: colors.textMuted },
  noFitTag: { fontSize: 10, fontWeight: '700', color: colors.danger },
  emptyText: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.md },
  linkInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  linkInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textDark,
  },
  linkHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 15,
  },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: { opacity: 0.4 },
  confirmButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});