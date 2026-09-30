import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Dimensions,
  Easing,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import AnimatedPressable from './AnimatedPressable';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PANEL_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 320);

export type SideMenuRole = 'student' | 'faculty';

export type SideMenuKey =
  | 'home'
  | 'directory'
  | 'appointments'
  | 'notifications'
  | 'queue'
  | 'profile'
  | 'facultyHome'
  | 'facultyDirectory'
  | 'facultyAvailability'
  | 'facultyNotifications'
  | 'facultyProfileMenu'
  | 'settings'
  | 'helpSupport';

type MenuItem = {
  key: SideMenuKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const STUDENT_ITEMS: MenuItem[] = [
  { key: 'home', label: 'Home', icon: 'home-outline' },
  { key: 'appointments', label: 'Appointments', icon: 'calendar-outline' },
  { key: 'directory', label: 'Directory', icon: 'grid-outline' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications-outline' },
  { key: 'profile', label: 'Profile', icon: 'person-outline' },
];

const FACULTY_ITEMS: MenuItem[] = [
  { key: 'facultyHome', label: 'Home', icon: 'home-outline' },
  { key: 'facultyAvailability', label: 'Availability', icon: 'grid-outline' },
  { key: 'facultyDirectory', label: 'Appointments', icon: 'calendar-outline' },
  { key: 'facultyNotifications', label: 'Notifications', icon: 'notifications-outline' },
  { key: 'facultyProfileMenu', label: 'Profile', icon: 'person-outline' },
];

const SECONDARY_ITEMS: MenuItem[] = [
  { key: 'settings', label: 'Settings', icon: 'settings-outline' },
  { key: 'helpSupport', label: 'Help & Support', icon: 'help-circle-outline' },
];

type SideMenuProps = {
  visible: boolean;
  role: SideMenuRole;
  userName?: string;
  /** Small greeting line under the name, e.g. "Good morning!". */
  greeting?: string;
  /** Which menu key is currently the active screen, for highlighting. */
  activeKey?: SideMenuKey;
  /** Badge count shown on the Notifications row. Omit/0 to hide the badge. */
  notificationCount?: number;
  /** The signed-in user's real profile photo, if they've set one. Falls
   * back to a generic person icon when omitted. */
  photoUri?: string;
  onClose: () => void;
  onNavigate: (key: SideMenuKey) => void;
  onLogout: () => void;
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning!';
  if (hour < 18) return 'Good afternoon!';
  return 'Good evening!';
}

export default function SideMenu({
  visible,
  role,
  userName = 'AppointPro User',
  greeting = getGreeting(),
  activeKey,
  notificationCount = 0,
  photoUri,
  onClose,
  onNavigate,
  onLogout,
}: SideMenuProps) {
  const items = role === 'faculty' ? FACULTY_ITEMS : STUDENT_ITEMS;
  // Tapping the avatar/name jumps straight to the signed-in user's own
  // profile screen (the same one the "Profile" row below opens).
  const profileKey: SideMenuKey = role === 'faculty' ? 'facultyProfileMenu' : 'profile';

  // Drives both the panel slide and the backdrop fade. 0 = closed
  // (panel off-screen left), 1 = open.
  const progress = useRef(new Animated.Value(0)).current;
  const [isMounted, setIsMounted] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (isMounted) {
      Animated.timing(progress, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setIsMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!isMounted) return null;

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-PANEL_WIDTH, 0],
  });

  const handleNavigate = (key: SideMenuKey) => onNavigate(key);

  return (
    <Modal visible={isMounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View style={[styles.overlay, { opacity: progress }]} />
        </Pressable>

        <Animated.View
          style={[styles.panel, { width: PANEL_WIDTH, transform: [{ translateX }] }]}
        >
          <AnimatedPressable
            style={styles.headerRow}
            onPress={() => handleNavigate(profileKey)}
            scaleTo={0.97}
          >
            <View style={styles.avatarCircle}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={22} color={colors.textMuted} />
              )}
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.userName} numberOfLines={1}>
                Hi, {userName} 👋
              </Text>
              <Text style={styles.greeting}>{greeting}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </AnimatedPressable>

          <View style={styles.divider} />

          <View style={styles.itemsList}>
            {items.map((item) => {
              const isActive = item.key === activeKey;
              const showBadge = item.key === 'notifications' || item.key === 'facultyNotifications';
              return (
                <AnimatedPressable
                  key={item.key}
                  style={[styles.itemRow, isActive && styles.itemRowActive]}
                  onPress={() => handleNavigate(item.key)}
                  scaleTo={0.97}
                >
                  {isActive && <View style={styles.activeBar} />}
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={isActive ? colors.primary : colors.textDark}
                    style={styles.itemIcon}
                  />
                  <Text style={[styles.itemLabel, isActive && styles.itemLabelActive]}>
                    {item.label}
                  </Text>
                  {showBadge && notificationCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{notificationCount}</Text>
                    </View>
                  )}
                </AnimatedPressable>
              );
            })}
          </View>

          <View style={styles.secondaryDivider} />

          <View style={styles.secondaryList}>
            {SECONDARY_ITEMS.map((item) => (
              <AnimatedPressable
                key={item.key}
                style={styles.itemRow}
                onPress={() => handleNavigate(item.key)}
                scaleTo={0.97}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={colors.textMuted}
                  style={styles.itemIcon}
                />
                <Text style={styles.secondaryLabel}>{item.label}</Text>
              </AnimatedPressable>
            ))}
          </View>

          <View style={styles.footer}>
            <AnimatedPressable style={styles.logoutRow} onPress={onLogout} scaleTo={0.97}>
              <Ionicons name="log-out-outline" size={20} color={colors.primary} style={styles.itemIcon} />
              <Text style={styles.logoutLabel}>Log Out</Text>
            </AnimatedPressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  panel: {
    backgroundColor: colors.white,
    paddingTop: spacing.xl + 12,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.tabInactiveBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  headerTextWrap: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDark,
  },
  greeting: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  itemsList: {
    marginTop: spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    marginBottom: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  itemRowActive: {
    backgroundColor: colors.infoBg,
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  itemIcon: {
    marginRight: spacing.md,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  itemLabelActive: {
    color: colors.primary,
  },
  badge: {
    marginLeft: 'auto',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  secondaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  secondaryList: {
    flex: 1,
  },
  secondaryLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
  },
  logoutLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});