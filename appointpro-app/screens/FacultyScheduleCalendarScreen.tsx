import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import FacultyBottomTabBar, { FacultyTabKey } from '../components/FacultyBottomTabBar';
import {
  FacultySlot,
  FacultySlotsByDate,
  getWeekDates,
  formatWeekRangeLabel,
} from '../data/facultySlots';

type FacultyScheduleCalendarScreenProps = {
  slotsByDate: FacultySlotsByDate;
  onBack?: () => void;
  onTabChange?: (tab: FacultyTabKey) => void;
};

// Start of the Monday-first week containing `date` (Sunday belongs to the
// week that began the Monday before it).
function getMondayWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// Slot labels are strings like "8:00 AM - 9:00 AM" — pull out the start
// time (minutes since midnight) so a day's slots sort chronologically,
// including slots that start at different minutes within the same hour.
function parseStartMinutes(label: string): number {
  const startPart = label.split('-')[0]?.trim();
  const match = startPart?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export default function FacultyScheduleCalendarScreen({
  slotsByDate,
  onBack,
  onTabChange,
}: FacultyScheduleCalendarScreenProps) {
  const [weekStart, setWeekStart] = useState(() => getMondayWeekStart(new Date()));
  // 0 = Monday .. 6 = Sunday, matching the reordered display below.
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    const jsDay = new Date().getDay(); // 0 = Sunday
    return jsDay === 0 ? 6 : jsDay - 1;
  });

  const days = getWeekDates(weekStart); // Mon..Sun (weekStart is a Monday)

  const goPrevWeek = () => {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    setWeekStart(prev);
  };

  const goNextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
  };

  const goToday = () => {
    setWeekStart(getMondayWeekStart(new Date()));
    const jsDay = new Date().getDay();
    setSelectedDayIndex(jsDay === 0 ? 6 : jsDay - 1);
  };

  const selectedDay = days[selectedDayIndex];
  const daySlots = [...(slotsByDate[selectedDay.dateKey] ?? [])].sort(
    (a, b) => parseStartMinutes(a.label) - parseStartMinutes(b.label)
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Schedule</Text>
        <TouchableOpacity onPress={goToday} hitSlop={8}>
          <Text style={styles.todayLink}>Today</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.weekNav}>
        <TouchableOpacity onPress={goPrevWeek} style={styles.weekNavButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.weekRangeText}>{formatWeekRangeLabel(weekStart)}</Text>
        <TouchableOpacity onPress={goNextWeek} style={styles.weekNavButton} hitSlop={8}>
          <Ionicons name="chevron-forward" size={18} color={colors.textDark} />
        </TouchableOpacity>
      </View>

      <View style={styles.dayStrip}>
        {days.map((day, index) => {
          const isSelected = index === selectedDayIndex;
          const count = (slotsByDate[day.dateKey] ?? []).length;
          return (
            <TouchableOpacity
              key={day.dateKey}
              style={[styles.dayChip, isSelected && styles.dayChipSelected]}
              onPress={() => setSelectedDayIndex(index)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dayChipName, isSelected && styles.dayChipTextSelected]}>
                {day.day}
              </Text>
              <Text style={[styles.dayChipNum, isSelected && styles.dayChipTextSelected]}>
                {day.dayNum}
              </Text>
              <View
                style={[
                  styles.dayChipDot,
                  count > 0 && (isSelected ? styles.dayChipDotOnSelected : styles.dayChipDotActive),
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.dayPanel}>
        <View style={styles.dayPanelHeader}>
          <Text style={styles.dayPanelTitle}>{selectedDay.fullLabel}</Text>
          <Text style={styles.dayPanelCount}>
            {daySlots.length} slot{daySlots.length === 1 ? '' : 's'}
          </Text>
        </View>

        {daySlots.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-clear-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyStateText}>No slots scheduled for this day.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.slotList} showsVerticalScrollIndicator={false}>
            {daySlots.map((slot) => (
              <SlotCard key={slot.id} slot={slot} />
            ))}
          </ScrollView>
        )}
      </View>

      <FacultyBottomTabBar active="profile" onChange={onTabChange} />
    </SafeAreaView>
  );
}

function SlotCard({ slot }: { slot: FacultySlot }) {
  const isOnline = slot.mode === 'Online';
  const disabled = !slot.enabled;

  return (
    <View
      style={[
        styles.slotCard,
        disabled ? styles.slotCardDisabled : isOnline ? styles.slotCardOnline : styles.slotCardFace,
      ]}
    >
      <View
        style={[
          styles.slotBar,
          disabled ? styles.slotBarDisabled : isOnline ? styles.slotBarOnline : styles.slotBarFace,
        ]}
      />
      <View style={styles.slotBody}>
        <Text style={styles.slotTime}>{slot.label}</Text>
        <View style={styles.slotMetaRow}>
          <Ionicons
            name={isOnline ? 'wifi-outline' : 'location-outline'}
            size={13}
            color={colors.textMuted}
          />
          <Text style={styles.slotLocation}>{slot.location}</Text>
        </View>
      </View>
      <View
        style={[
          styles.slotTag,
          disabled ? styles.slotTagDisabled : isOnline ? styles.slotTagOnline : styles.slotTagFace,
        ]}
      >
        <Text
          style={[
            styles.slotTagText,
            disabled
              ? styles.slotTagTextDisabled
              : isOnline
              ? styles.slotTagTextOnline
              : styles.slotTagTextFace,
          ]}
        >
          {disabled ? 'Unavailable' : 'Available'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
  },
  todayLink: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.link,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  weekNavButton: {
    padding: 4,
  },
  weekRangeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
    minWidth: 150,
    textAlign: 'center',
  },
  dayStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  dayChip: {
    flex: 1,
    marginHorizontal: 3,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.tabInactiveBg,
  },
  dayChipSelected: {
    backgroundColor: colors.primary,
  },
  dayChipName: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  dayChipNum: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDark,
    marginTop: 2,
  },
  dayChipTextSelected: {
    color: colors.white,
  },
  dayChipDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 5,
    backgroundColor: 'transparent',
  },
  dayChipDotActive: {
    backgroundColor: colors.success,
  },
  dayChipDotOnSelected: {
    backgroundColor: colors.white,
  },
  dayPanel: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  dayPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  dayPanelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
  },
  dayPanelCount: {
    fontSize: 11,
    color: colors.textMuted,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  emptyStateText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  slotList: {
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  slotCardFace: {
    backgroundColor: '#F3FBF5',
    borderColor: '#CDEAD5',
  },
  slotCardOnline: {
    backgroundColor: '#F2F6FD',
    borderColor: '#CBDAF5',
  },
  slotCardDisabled: {
    backgroundColor: colors.tabInactiveBg,
    borderColor: colors.border,
  },
  slotBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  slotBarFace: {
    backgroundColor: colors.success,
  },
  slotBarOnline: {
    backgroundColor: '#2F5FD1',
  },
  slotBarDisabled: {
    backgroundColor: colors.textMuted,
  },
  slotBody: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  slotTime: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 3,
  },
  slotMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  slotLocation: {
    fontSize: 11,
    color: colors.textMuted,
  },
  slotTag: {
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginRight: spacing.md,
  },
  slotTagFace: {
    backgroundColor: '#DFF3E4',
  },
  slotTagOnline: {
    backgroundColor: '#DEE9FB',
  },
  slotTagDisabled: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  slotTagTextFace: {
    color: colors.success,
  },
  slotTagTextOnline: {
    color: '#2F5FD1',
  },
  slotTagTextDisabled: {
    color: colors.textMuted,
  },
});