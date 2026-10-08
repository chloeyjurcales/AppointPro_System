import React from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import { NotificationItem } from '../data/notifications';
import ProfileAvatar from './ProfileAvatar';
import { splitNotificationDescription } from '../lib/notificationMessages';

export type NotificationPerson = { name: string; photoUri?: string | null };

type Props = {
  notification: NotificationItem | null;
  /** People the app knows (students or faculty) so a notification can show who it is about. */
  people?: NotificationPerson[];
  onClose: () => void;
};

// Finds the person whose full name appears in the notification text.
function findPerson(notification: NotificationItem | null, people: NotificationPerson[]) {
  if (!notification) return null;
  const text = `${notification.title} ${notification.description}`.toLowerCase();
  return (
    [...people]
      .filter((p) => p.name.trim().length > 2)
      .sort((a, b) => b.name.length - a.name.length)
      .find((p) => text.includes(p.name.trim().toLowerCase())) ?? null
  );
}

function formatReceived(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

/** Overview of a single notification, shown when it is tapped in the list. */
export default function NotificationDetailModal({ notification, people = [], onClose }: Props) {
  // Prefer the real sender saved with the notification; otherwise fall back to
  // matching a known person's name in the text.
  const { main, extras } = splitNotificationDescription(notification?.description ?? '');
  const person: NotificationPerson | null = notification?.senderName
    ? { name: notification.senderName, photoUri: notification.senderAvatarUrl }
    : findPerson(notification, people);
  return (
    <Modal visible={!!notification} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {notification && (
            <>
              <View style={styles.headerRow}>
                {person ? (
                  <ProfileAvatar uri={person.photoUri} name={person.name} size={52} />
                ) : (
                  <View style={styles.iconWrap}>
                    <Ionicons name={notification.icon} size={26} color={colors.primary} />
                  </View>
                )}
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.title}>{notification.title}</Text>
              {!!person && <Text style={styles.personName}>{person.name}</Text>}
              {!!notification.senderName && !!(notification.senderRole || notification.senderDepartment) && (
                <Text style={styles.personMeta}>
                  {[notification.senderRole, notification.senderDepartment].filter(Boolean).join(' · ')}
                </Text>
              )}

              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={styles.metaText}>
                  Received {notification.createdAt ? formatReceived(notification.createdAt) : notification.time}
                </Text>
              </View>

              <View style={styles.divider} />

              <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionLabel}>Details</Text>
                <Text style={styles.body}>
                  {main || 'No additional details were included with this notification.'}
                </Text>
                {extras.map((extra) => {
                  const isLink = extra.label === 'New meeting link' && /^https?:\/\//i.test(extra.value);
                  return (
                    <View key={extra.label} style={styles.extraBlock}>
                      <Text style={styles.sectionLabel}>{extra.label === 'Reason' ? 'Reason' : 'New meeting link'}</Text>
                      <Text
                        style={[styles.body, isLink && styles.link]}
                        onPress={isLink ? () => Linking.openURL(extra.value) : undefined}
                      >
                        {extra.value}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>

              <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.85}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textDark,
  },
  personName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 2,
  },
  personMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  bodyScroll: {
    flexGrow: 0,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textDark,
  },
  extraBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  link: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  closeButton: {
    marginTop: spacing.lg,
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
});