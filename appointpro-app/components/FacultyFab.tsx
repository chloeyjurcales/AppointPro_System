import React, { useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import AnimatedPressable from './AnimatedPressable';

const FAB_SIZE = 58;
const EDGE_GAP = 8;
const RIGHT_GAP = spacing.lg;
// A touch that moves less than this many pixels counts as a tap, not a drag.
const TAP_SLOP = 6;

// Remembered while the app is running so the button stays where the faculty
// dragged it when moving between screens. Offsets are relative to the default
// bottom-right spot. `moved` is false until the faculty drags it once.
const savedPosition = { x: 0, y: 0, moved: false };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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
 * It can be dragged anywhere on screen. Tapping it opens a small sheet asking how the faculty wants to create or set
 * their availability / consultation schedule.
 */
export default function FacultyFab({
  bottomOffset = 0,
  onAddTimeSlot,
  onSetRecurringSchedule,
  onOpenSlotIQ,
}: FacultyFabProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [open, setOpen] = useState(false);

  // Default spot: bottom-right. The drag offsets below are relative to it.
  const baseBottom = Math.max(insets.bottom, 12) + spacing.md;

  // Furthest the button may travel from its default spot, keeping it on screen.
  const bounds = {
    minX: -(width - RIGHT_GAP - FAB_SIZE - EDGE_GAP),
    maxX: RIGHT_GAP - EDGE_GAP,
    minY: -(height - baseBottom - FAB_SIZE - insets.top - EDGE_GAP),
    maxY: baseBottom - insets.bottom - EDGE_GAP,
  };
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  const openRef = useRef(() => setOpen(true));

  // Until it has been dragged, sit above any pinned footer (bottomOffset).
  const startY = savedPosition.moved ? savedPosition.y : -bottomOffset;
  const position = useRef({ x: savedPosition.x, y: startY });
  const pan = useRef(new Animated.ValueXY({ x: position.current.x, y: position.current.y })).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const b = boundsRef.current;
        pan.setValue({
          x: clamp(position.current.x + g.dx, b.minX, b.maxX),
          y: clamp(position.current.y + g.dy, b.minY, b.maxY),
        });
      },
      onPanResponderRelease: (_, g) => {
        const b = boundsRef.current;
        const isTap = Math.abs(g.dx) < TAP_SLOP && Math.abs(g.dy) < TAP_SLOP;
        if (isTap) {
          openRef.current();
          return;
        }
        position.current = {
          x: clamp(position.current.x + g.dx, b.minX, b.maxX),
          y: clamp(position.current.y + g.dy, b.minY, b.maxY),
        };
        savedPosition.x = position.current.x;
        savedPosition.y = position.current.y;
        savedPosition.moved = true;
      },
    }),
  ).current;

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
      <View pointerEvents="box-none" style={[styles.fabWrap, { bottom: baseBottom }]}>
        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.fab, { transform: pan.getTranslateTransform() }]}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Create or set availability schedule. Drag to move."
        >
          <Ionicons name="add-circle-outline" size={34} color={colors.white} />
        </Animated.View>
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
    right: spacing.lg,
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