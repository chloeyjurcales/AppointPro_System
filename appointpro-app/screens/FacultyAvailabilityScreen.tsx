import React, { useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import FacultyBottomTabBar, { FacultyTabKey } from '../components/FacultyBottomTabBar';
import EditScheduleModal, { EditableScheduleValues, valuesFromLabel } from '../components/EditScheduleModal';
import {
  FacultySlot,
  FacultySlotsByDate,
  getWeekStart,
  getWeekDates,
  formatWeekRangeLabel,
  toDateKey,
} from '../data/facultySlots';
import {
  RecurringRule,
  formatRuleTimeLabel,
  formatDaysLabel,
  formatDateRangeLabel,
} from '../data/recurringSchedule';

type FacultyAvailabilityScreenProps = {
  slotsByDate: FacultySlotsByDate;
  recurringRules: RecurringRule[];
  onBack?: () => void;
  onInfoPress?: () => void;
  onAddTimeSlot?: (dateKey: string) => void;
  onToggleSlot?: (dateKey: string, slotId: string) => void;
  onDeleteTimeSlot?: (dateKey: string, slotId: string) => void;
  onSetRecurringSchedule?: () => void;
  onSlotIQPress?: () => void;
  onDeleteRecurringRule?: (ruleId: string) => void;
  onEditTimeSlot?: (dateKey: string, slotId: string, values: EditableScheduleValues) => Promise<string | null>;
  onEditRecurringRule?: (ruleId: string, values: EditableScheduleValues) => Promise<string | null>;
  onSaveAvailability?: () => void;
  onTabChange?: (tab: FacultyTabKey) => void;
};

export default function FacultyAvailabilityScreen({
  slotsByDate,
  recurringRules,
  onBack,
  onInfoPress,
  onAddTimeSlot,
  onToggleSlot,
  onDeleteTimeSlot,
  onSetRecurringSchedule,
  onSlotIQPress,
  onDeleteRecurringRule,
  onEditTimeSlot,
  onEditRecurringRule,
  onSaveAvailability,
  onTabChange,
}: FacultyAvailabilityScreenProps) {
  const today = new Date();
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(today));
  const weekDates = getWeekDates(weekStart);
  const todayIndex = weekDates.findIndex((d) => d.isToday);
  const [selectedDayIndex, setSelectedDayIndex] = useState(todayIndex >= 0 ? todayIndex : 0);

  // What the edit form is currently editing (a single slot or a whole weekly schedule).
  type EditTarget =
    | { kind: 'slot'; dateKey: string; slotId: string; initial: EditableScheduleValues }
    | { kind: 'rule'; ruleId: string; initial: EditableScheduleValues };
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const selectedDay = weekDates[selectedDayIndex];
  const currentSlots = slotsByDate[selectedDay.dateKey] ?? [];
  const hasSlots = currentSlots.length > 0;

  const goToPrevWeek = () => {
    const prev = new Date(weekStart);
    prev.setDate(weekStart.getDate() - 7);
    setWeekStart(prev);
    setSelectedDayIndex(0);
  };

  const goToNextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + 7);
    setWeekStart(next);
    setSelectedDayIndex(0);
  };

  const goToThisWeek = () => {
    const start = getWeekStart(new Date());
    setWeekStart(start);
    const idx = getWeekDates(start).findIndex((d) => d.isToday);
    setSelectedDayIndex(idx >= 0 ? idx : 0);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Faculty Availability & Location</Text>
        <TouchableOpacity onPress={onInfoPress}>
          <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <Text style={styles.headerSubtitle}>
        Set your office hours and where students can find you.
      </Text>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity style={styles.recurringBanner} onPress={onSetRecurringSchedule} activeOpacity={0.85}>
          <Ionicons name="repeat" size={18} color={colors.primary} />
          <Text style={styles.recurringBannerText}>Set a Recurring Weekly Schedule</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.slotIQBanner} onPress={onSlotIQPress} activeOpacity={0.85}>
          <View style={styles.slotIQIcon}>
            <Ionicons name="sparkles" size={17} color={colors.primary} />
          </View>
          <View style={styles.slotIQTextWrap}>
            <Text style={styles.slotIQTitle}>Generate with SlotIQ</Text>
            <Text style={styles.slotIQSubtitle}>Let AI suggest your weekly consultation schedule.</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>

        {recurringRules.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Active Weekly Schedules</Text>
            {recurringRules.map((rule) => (
              <View key={rule.id} style={styles.ruleCard}>
                <View style={styles.ruleTextWrap}>
                  <Text style={styles.ruleDays}>{formatDaysLabel(rule.daysOfWeek)}</Text>
                  <Text style={styles.ruleDetail}>{formatRuleTimeLabel(rule)} · {rule.mode}</Text>
                  <Text style={styles.ruleDetail}>{rule.location}</Text>
                  <Text style={styles.ruleDateRange}>{formatDateRangeLabel(rule)}</Text>
                </View>
                <View style={styles.iconGroup}>
                  <TouchableOpacity
                    onPress={() =>
                      setEditTarget({
                        kind: 'rule',
                        ruleId: rule.id,
                        initial: {
                          startHour: String(rule.startHour),
                          startMinute: String(rule.startMinute).padStart(2, '0'),
                          startPeriod: rule.startPeriod,
                          endHour: String(rule.endHour),
                          endMinute: String(rule.endMinute).padStart(2, '0'),
                          endPeriod: rule.endPeriod,
                          mode: rule.mode,
                          location: rule.location,
                        },
                      })
                    }
                  >
                    <Ionicons name="create-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert(
                        'Delete this weekly schedule?',
                        `Are you sure you want to delete your weekly schedule (${formatDaysLabel(rule.daysOfWeek)}, ${formatRuleTimeLabel(rule)})? All its upcoming slots will be removed. Slots that already have appointments will be kept as one-time slots.`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Yes, Delete', style: 'destructive', onPress: () => onDeleteRecurringRule?.(rule.id) },
                        ]
                      )
                    }
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={styles.weekNavRow}>
          <TouchableOpacity onPress={goToPrevWeek}>
            <Ionicons name="chevron-back" size={20} color={colors.textDark} />
          </TouchableOpacity>
          <TouchableOpacity onPress={goToThisWeek}>
            <Text style={styles.weekRangeText}>{formatWeekRangeLabel(weekStart)}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToNextWeek}>
            <Ionicons name="chevron-forward" size={20} color={colors.textDark} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Select Day</Text>

        <View style={styles.dateRow}>
          {weekDates.map((d, index) => {
            const isActive = index === selectedDayIndex;
            const dayHasSlots = (slotsByDate[d.dateKey] ?? []).length > 0;
            return (
              <TouchableOpacity
                key={d.dateKey}
                style={[
                  styles.dateChip,
                  isActive && styles.dateChipActive,
                  d.isToday && !isActive && styles.dateChipToday,
                ]}
                onPress={() => setSelectedDayIndex(index)}
              >
                <Text style={[styles.dateDay, isActive && styles.dateTextActive]}>{d.day}</Text>
                <Text style={[styles.dateNum, isActive && styles.dateTextActive]}>{d.dayNum}</Text>
                <View
                  style={[
                    styles.dateDot,
                    dayHasSlots
                      ? isActive
                        ? styles.dateDotActiveFilled
                        : styles.dateDotFilled
                      : styles.dateDotEmpty,
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.selectedDateRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
          <Text style={styles.selectedDateText}>{selectedDay.fullLabel}</Text>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Time Slots</Text>
          <TouchableOpacity
            style={styles.addSlotButton}
            onPress={() => onAddTimeSlot?.(selectedDay.dateKey)}
          >
            <Ionicons name="add" size={14} color={colors.primary} />
            <Text style={styles.addSlotText}>Add Time Slot</Text>
          </TouchableOpacity>
        </View>

        {hasSlots ? (
          currentSlots.map((slot) => (
            <View key={slot.id} style={styles.slotCard}>
              <View style={styles.dragHandle}>
                <MaterialCommunityIcons name="drag-vertical" size={18} color={colors.textMuted} />
              </View>

              <View style={styles.slotBody}>
                <View style={styles.slotTopRow}>
                  <View style={styles.slotTimeWrap}>
                    <View style={styles.slotLabelRow}>
                      <Text style={styles.slotLabel}>{slot.label}</Text>
                      {slot.recurring && (
                        <View style={styles.recurringPill}>
                          <Ionicons name="repeat" size={10} color={colors.primary} />
                          <Text style={styles.recurringPillText}>Weekly</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.slotModeRow}>
                      <Ionicons
                        name={slot.mode === 'Online' ? 'wifi' : 'people-outline'}
                        size={12}
                        color={colors.textMuted}
                      />
                      <Text style={styles.slotMode}>{slot.mode}</Text>
                    </View>
                  </View>
                  <Switch
                    value={slot.enabled}
                    onValueChange={() => onToggleSlot?.(selectedDay.dateKey, slot.id)}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.white}
                  />
                </View>

                <View style={styles.slotBottomRow}>
                  <View style={styles.locationRow}>
                    <Ionicons
                      name={slot.mode === 'Online' ? 'wifi-outline' : 'location-outline'}
                      size={14}
                      color={colors.textMuted}
                    />
                    <Text style={styles.locationText}>{slot.location}</Text>
                  </View>
                  <View style={styles.iconGroup}>
                    <TouchableOpacity
                      onPress={() => {
                        const initial = valuesFromLabel(slot.label, slot.mode, slot.location);
                        if (initial) setEditTarget({ kind: 'slot', dateKey: selectedDay.dateKey, slotId: slot.id, initial });
                      }}
                    >
                      <Ionicons name="create-outline" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    {!slot.enabled && (
                      <TouchableOpacity
                        onPress={() =>
                          Alert.alert(
                            'Delete this time slot?',
                            `Are you sure you want to delete the ${slot.label} slot on ${selectedDay.fullLabel}? This can't be undone.`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Yes, Delete', style: 'destructive', onPress: () => onDeleteTimeSlot?.(selectedDay.dateKey, slot.id) },
                            ]
                          )
                        }
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No time slots for this day</Text>
            <Text style={styles.emptySubtitle}>
              Add a one-time slot, or set a recurring weekly schedule above.
            </Text>
            <TouchableOpacity
              style={styles.emptyAddButton}
              onPress={() => onAddTimeSlot?.(selectedDay.dateKey)}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={16} color={colors.white} />
              <Text style={styles.emptyAddButtonText}>Add Time Slot</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={onSaveAvailability}
          activeOpacity={0.85}
        >
          <Text style={styles.saveButtonText}>Save Availability</Text>
        </TouchableOpacity>
      </View>


      <EditScheduleModal
        visible={!!editTarget}
        title={editTarget?.kind === 'rule' ? 'Edit Weekly Schedule' : 'Edit Time Slot'}
        note={
          editTarget?.kind === 'rule'
            ? 'Changes apply to this schedule\'s upcoming slots that have no booked appointment. Booked slots keep their current details.'
            : 'Changes apply to this slot only. Slots with a booked appointment can\'t be edited.'
        }
        confirmMessage={
          editTarget?.kind === 'rule'
            ? 'Are you sure you want to apply these changes to all upcoming unbooked slots in this weekly schedule?'
            : 'Are you sure you want to save the changes to this time slot?'
        }
        initial={editTarget?.initial ?? null}
        onClose={() => setEditTarget(null)}
        onSave={async (values) => {
          if (!editTarget) return 'Nothing to save.';
          const result =
            editTarget.kind === 'rule'
              ? await onEditRecurringRule?.(editTarget.ruleId, values)
              : await onEditTimeSlot?.(editTarget.dateKey, editTarget.slotId, values);
          return result === undefined ? 'Editing is not available right now.' : result;
        }}
      />

      <FacultyBottomTabBar active="appointment" onChange={onTabChange} />
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
    paddingTop: spacing.md,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDark,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  recurringBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.infoBg,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  recurringBannerText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.infoText },
  slotIQBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.infoBg,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: colors.white,
  },
  slotIQIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.infoBg,
    marginRight: spacing.sm,
  },
  slotIQTextWrap: { flex: 1 },
  slotIQTitle: { fontSize: 13, fontWeight: '800', color: colors.textDark },
  slotIQSubtitle: { marginTop: 2, fontSize: 10, color: colors.textMuted },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: spacing.sm,
  },
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  iconGroup: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ruleTextWrap: { flex: 1 },
  ruleDays: { fontSize: 13, fontWeight: '700', color: colors.textDark, marginBottom: 2 },
  ruleDetail: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  ruleDateRange: { fontSize: 10, color: colors.primary, fontWeight: '600', marginTop: 4 },
  weekNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  weekRangeText: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  dateChip: {
    width: 34,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
  },
  dateChipActive: { backgroundColor: colors.primary },
  dateChipToday: { borderWidth: 1, borderColor: colors.primary },
  dateDay: { fontSize: 10, color: colors.textMuted, marginBottom: 4 },
  dateNum: { fontSize: 13, fontWeight: '700', color: colors.textDark, marginBottom: 4 },
  dateTextActive: { color: colors.white },
  dateDot: { width: 5, height: 5, borderRadius: 2.5 },
  dateDotFilled: { backgroundColor: colors.primary },
  dateDotActiveFilled: { backgroundColor: colors.white },
  dateDotEmpty: { backgroundColor: 'transparent' },
  selectedDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  selectedDateText: { fontSize: 12, color: colors.textMuted },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  addSlotButton: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  addSlotText: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  slotCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  dragHandle: { justifyContent: 'center', marginRight: spacing.sm },
  slotBody: { flex: 1 },
  slotTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  slotTimeWrap: { flex: 1 },
  slotLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  slotLabel: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  recurringPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.tabInactiveBg,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recurringPillText: { fontSize: 9, fontWeight: '700', color: colors.primary },
  slotModeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  slotMode: { fontSize: 11, color: colors.textMuted },
  slotBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  locationText: { fontSize: 12, color: colors.textDark, fontWeight: '600' },
  emptyState: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.tabInactiveBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 13, fontWeight: '700', color: colors.textDark, marginBottom: 4 },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  emptyAddButtonText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});