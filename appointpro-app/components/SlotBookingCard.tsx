import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import type { ClassBlock } from '../lib/classSchedule';
import { formatTime12 } from '../lib/classSchedule';

// Static on purpose: no animations, transitions or press effects anywhere.
const BORDER = '#E2E8F0';
const MUTED_BG = '#F1F5F9';
const TEXT_STRONG = '#0F172A';
const TEXT_MUTED = '#64748B';
const WARNING_BG = '#FEF2F2';
const WARNING_BORDER = '#FECACA';
const WARNING_TEXT = '#B91C1C';

type SlotBookingCardProps = {
  /** Display time range, e.g. "8:00 AM - 10:00 AM". */
  time: string;
  mode: 'Face-to-Face' | 'Online';
  location: string;
  remainingMinutes: number;
  isSelected: boolean;
  /** The student's class this slot overlaps, or null when the slot is free. */
  conflict: ClassBlock | null;
  onSelect: () => void;
  /** Called when a conflicting slot is tapped; receives the explanation to show. */
  onBlockedPress: (message: string) => void;
};

export const conflictMessage = (block: ClassBlock): string =>
  `You cannot book this slot because it conflicts with your scheduled class (${block.subject}, ${formatTime12(
    block.startTime,
  )} - ${formatTime12(block.endTime)}).`;

/**
 * One faculty slot in the student's booking list. Available slots show a green
 * status and a "Book Slot" button. Slots that overlap a class are muted, struck
 * through, carry a "Conflict: Class at ..." badge and a disabled button.
 */
export default function SlotBookingCard({
  time,
  mode,
  location,
  remainingMinutes,
  isSelected,
  conflict,
  onSelect,
  onBlockedPress,
}: SlotBookingCardProps) {
  const blocked = conflict !== null;
  const press = () => (conflict ? onBlockedPress(conflictMessage(conflict)) : onSelect());

  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected, blocked && styles.cardBlocked]}
      onPress={press}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, selected: isSelected }}
      accessibilityLabel={blocked ? `${time}, class conflict` : `${time}, available`}
    >
      <View style={styles.topRow}>
        <Text style={[styles.time, blocked && styles.timeBlocked]}>{time}</Text>
        <View style={[styles.status, blocked ? styles.statusBlocked : styles.statusAvailable]}>
          <View style={[styles.statusDot, blocked ? styles.dotBlocked : styles.dotAvailable]} />
          <Text style={[styles.statusText, blocked ? styles.statusTextBlocked : styles.statusTextAvailable]}>
            {blocked ? 'Unavailable' : 'Available'}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Ionicons name={mode === 'Online' ? 'wifi-outline' : 'location-outline'} size={13} color={TEXT_MUTED} />
        <Text style={[styles.meta, blocked && styles.metaBlocked]}>
          {location} · {mode}
        </Text>
      </View>
      <Text style={[styles.meta, blocked && styles.metaBlocked]}>{remainingMinutes} min remaining</Text>

      {conflict && (
        <View style={styles.conflictBadge}>
          <Ionicons name="alert-circle-outline" size={14} color={WARNING_TEXT} />
          <Text style={styles.conflictText}>
            Conflict: Class at {formatTime12(conflict.startTime)} - {formatTime12(conflict.endTime)}
          </Text>
        </View>
      )}

      <View style={[styles.button, blocked && styles.buttonDisabled, isSelected && styles.buttonSelected]}>
        <Text style={[styles.buttonText, blocked && styles.buttonTextDisabled]}>
          {isSelected ? 'Selected' : 'Book Slot'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  cardBlocked: {
    backgroundColor: MUTED_BG,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  time: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_STRONG,
  },
  timeBlocked: {
    color: TEXT_MUTED,
    textDecorationLine: 'line-through',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: spacing.sm,
  },
  statusAvailable: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  statusBlocked: { backgroundColor: '#E2E8F0', borderColor: BORDER },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  dotAvailable: { backgroundColor: colors.success },
  dotBlocked: { backgroundColor: TEXT_MUTED },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusTextAvailable: { color: '#166534' },
  statusTextBlocked: { color: TEXT_MUTED },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
    color: '#475569',
  },
  metaBlocked: {
    color: TEXT_MUTED,
  },
  conflictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: WARNING_BG,
    borderWidth: 1,
    borderColor: WARNING_BORDER,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: spacing.sm,
  },
  conflictText: {
    fontSize: 12,
    fontWeight: '700',
    color: WARNING_TEXT,
    flexShrink: 1,
  },
  button: {
    marginTop: spacing.md,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSelected: {
    backgroundColor: colors.primaryDark,
  },
  buttonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  buttonTextDisabled: {
    color: '#64748B',
  },
});