import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

type SettingsScreenProps = {
  // Notification Sound is the one toggle that's actually wired to real
  // behavior (it controls whether a chime plays when a new notification
  // arrives), so it's controlled from App.tsx rather than local state.
  soundEnabled: boolean;
  onToggleSound: () => void;
  onBack?: () => void;
};

type ToggleRow = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
};

// Push/Email aren't backed by a real notifications backend in this app,
// so they stay local — flipping them just shows the toggle moving.
const LOCAL_TOGGLE_ROWS: ToggleRow[] = [
  {
    key: 'pushNotifications',
    icon: 'notifications-outline',
    label: 'Push Notifications',
    description: 'Get notified about appointments, reschedules, and queue updates.',
  },
  {
    key: 'emailNotifications',
    icon: 'mail-outline',
    label: 'Email Notifications',
    description: 'Receive a copy of important updates by email.',
  },
];

export default function SettingsScreen({
  soundEnabled,
  onToggleSound,
  onBack,
}: SettingsScreenProps) {
  const [localValues, setLocalValues] = useState<Record<string, boolean>>({
    pushNotifications: true,
    emailNotifications: true,
  });

  const toggleLocal = (key: string) => {
    setLocalValues((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.card}>
          {LOCAL_TOGGLE_ROWS.map((row) => (
            <View key={row.key} style={[styles.row, styles.rowBorder]}>
              <View style={styles.rowIconWrap}>
                <Ionicons name={row.icon} size={18} color={colors.primary} />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowDescription}>{row.description}</Text>
              </View>
              <Switch
                value={localValues[row.key]}
                onValueChange={() => toggleLocal(row.key)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
          ))}

          <View style={styles.row}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="volume-high-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowLabel}>Notification Sound</Text>
              <Text style={styles.rowDescription}>
                Play a sound when a new notification arrives.
              </Text>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={onToggleSound}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
  },
  headerSpacer: {
    width: 22,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.tabInactiveBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextWrap: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
  },
  rowDescription: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});