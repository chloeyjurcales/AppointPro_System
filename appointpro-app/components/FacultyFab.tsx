import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import AnimatedPressable from './AnimatedPressable';

const FAB_SIZE = 58;
const RIGHT_GAP = spacing.lg;

type FacultyFabProps = {
  /** Extra space above the bottom edge, e.g. to clear a footer button. */
  bottomOffset?: number;
  onAddTimeSlot: () => void;
  onSetRecurringSchedule: () => void;
  onOpenSlotIQ: () => void;
};

type Action = {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

/**
 * Floating "+" button (a "+" inside a circle) shown on the faculty screens.
 * Tapping it opens a small sheet asking how the faculty wants to create or set
 * their availability / consultation schedule.
 */
export default function FacultyFab({
  bottomOffset = 0,
  onAddTimeSlot,
  onSetRecurringSchedule,
  onOpenSlotIQ,
}: FacultyFabProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  // Fixed spot: bottom-right, above any bottom bar (bottomOffset).
  const bottom = Math.max(insets.bottom, 12) + spacing.md + bottomOffset;

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  const actions: Action[] = [
    {
      key: 'slot',
      title: 'Add a time slot',
      subtitle: 'Open a one-time availability slot for a specific date.',
      icon: 'time-outline',
      onPress: run(onAddTimeSlot),
    },
    {
      key: 'recurring',
      title: 'Set a recurring weekly schedule',
      subtitle: 'Repeat your consultation hours every week.',
      icon: 'repeat',
      onPress: run(onSetRecurringSchedule),
    },
    {
      key: 'slotiq',
      title: 'Generate with SlotIQ',
      subtitle: 'Let AI suggest a schedule around your classes.',
      icon: 'sparkles-outline',
      onPress: run(onOpenSlotIQ),
    },
  ];

  return (
    <>
      <View pointerEvents="box-none" style={[styles.fabWrap, { bottom }]}>
        <AnimatedPressable
          style={styles.fab}
          onPress={() => setOpen(true)}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel="Create or set availability schedule"
        >
          <Ionicons name="add-circle-outline" size={34} color={colors.white} />
        </AnimatedPressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + spacing.md }]}
            onPress={() => {}}
          >
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Set your availability</Text>
            <Text style={styles.sheetSubtitle}>Choose how you want to create your schedule.</Text>

            {actions.map((action) => (
              <AnimatedPressable key={action.key} style={styles.row} onPress={action.onPress} scaleTo={0.97}>
                <View style={styles.rowIcon}>
                  <Ionicons name={action.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{action.title}</Text>
                  <Text style={styles.rowSubtitle}>{action.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </AnimatedPressable>
            ))}

            <AnimatedPressable style={styles.cancel} onPress={() => setOpen(false)} scaleTo={0.97}>
              <Text style={styles.cancelText}>Cancel</Text>
            </AnimatedPressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    position: 'absolute',
    right: RIGHT_GAP,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.textDark },
  sheetSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.textDark },
  rowSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cancel: { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
  cancelText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
});