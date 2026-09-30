import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import AnimatedPressable from './AnimatedPressable';

export type TabKey = 'home' | 'directory' | 'appointments' | 'notifications' | 'profile';

type BottomTabBarProps = {
  active: TabKey;
  onChange?: (tab: TabKey) => void;
};

const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'directory', label: 'Directory', icon: 'grid-outline' },
  { key: 'appointments', label: 'Appointments', icon: 'calendar-outline' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications-outline' },
  { key: 'profile', label: 'Profile', icon: 'person-outline' },
];

export default function BottomTabBar({ active, onChange }: BottomTabBarProps) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <AnimatedPressable
            key={tab.key}
            style={styles.tab}
            onPress={() => onChange?.(tab.key)}
            scaleTo={0.88}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={isActive ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
    paddingTop: 8,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  label: {
    fontSize: 10,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});