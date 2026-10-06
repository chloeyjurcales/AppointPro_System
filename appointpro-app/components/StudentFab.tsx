import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import AnimatedPressable from './AnimatedPressable';
import useKeyboardVisible from './useKeyboardVisible';

const FAB_SIZE = 58;
const RIGHT_GAP = spacing.lg;

type StudentFabProps = {
  /** Extra space above the bottom edge, so it clears the bottom tab bar. */
  bottomOffset?: number;
  onPress: () => void;
};

/**
 * Floating "+" button shown on the student screens (the student counterpart of
 * FacultyFab). Tapping it opens the "Book an Appointment" screen, where the
 * student can see, search and book instructors from their own department.
 */
export default function StudentFab({ bottomOffset = 0, onPress }: StudentFabProps) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();

  // Step aside while the student is typing (for example in the Directory search box).
  if (keyboardVisible) return null;

  const bottom = Math.max(insets.bottom, 12) + spacing.md + bottomOffset;

  return (
    <View pointerEvents="box-none" style={[styles.fabWrap, { bottom }]}>
      <AnimatedPressable
        style={styles.fab}
        onPress={onPress}
        scaleTo={0.9}
        accessibilityRole="button"
        accessibilityLabel="Book an appointment with an instructor in your department"
      >
        <Ionicons name="add-circle-outline" size={34} color={colors.white} />
      </AnimatedPressable>
    </View>
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
});