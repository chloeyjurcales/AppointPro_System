import React, { useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import AnimatedPressable from './AnimatedPressable';
import { NotificationBadgeContext } from './NotificationBadgeContext';
import useKeyboardVisible from './useKeyboardVisible';

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
  const unreadCount = useContext(NotificationBadgeContext);
  const keyboardVisible = useKeyboardVisible();
  if (keyboardVisible) return null;
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
            <View>
              <Ionicons
                name={tab.icon}
                size={20}
                color={isActive ? colors.primary : colors.textMuted}
              />
              {tab.key === 'notifications' && unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </View>
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
  badge: {
    position: 'absolute',
    top: -4,
    right: -9,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.white,
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