import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import ProfileAvatar from '../components/ProfileAvatar';
import BottomTabBar, { TabKey } from '../components/BottomTabBar';
import NotificationDetailModal, { NotificationPerson } from '../components/NotificationDetailModal';
import { NotificationItem, INITIAL_STUDENT_NOTIFICATIONS } from '../data/notifications';

type NotificationsScreenProps = {
  // Controlled from App.tsx so events elsewhere (like a faculty member
  // cancelling/rescheduling an appointment) can push new notifications in.
  // Falls back to the mock list so this screen still works standalone.
  notifications?: NotificationItem[];
  onDeleteNotifications?: (ids: string[]) => void;
  onMenuPress?: () => void;
  onMarkAllRead?: () => void;
  onMarkAsRead?: (id: string) => void;
  onSelectNotification?: (item: NotificationItem) => void;
  // Names + profile pictures used to show who a notification is about.
  people?: NotificationPerson[];
  onTabChange?: (tab: TabKey) => void;
};

export default function NotificationsScreen({
  notifications = INITIAL_STUDENT_NOTIFICATIONS,
  onDeleteNotifications,
  onMenuPress,
  onMarkAllRead,
  onMarkAsRead,
  onSelectNotification,
  people,
  onTabChange,
}: NotificationsScreenProps) {
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [openNotification, setOpenNotification] = useState<NotificationItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allSelected = selectedIds.size > 0 && selectedIds.size === notifications.length;
  const hasUnread = notifications.some((n) => !n.read);

  const enterSelectMode = () => {
    setOptionsMenuOpen(false);
    setSelectMode(true);
    setSelectedIds(new Set());
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map((n) => n.id)));
    }
  };

  const handleDeleteSelected = () => {
    onDeleteNotifications?.(Array.from(selectedIds));
    exitSelectMode();
  };

  const handleRowPress = (item: NotificationItem) => {
    if (selectMode) {
      toggleSelected(item.id);
    } else {
      if (!item.read) onMarkAsRead?.(item.id);
      setOpenNotification({ ...item, read: true });
      onSelectNotification?.(item);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        {selectMode ? (
          <TouchableOpacity onPress={exitSelectMode}>
            <Ionicons name="close" size={24} color={colors.textDark} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
        <Text style={styles.headerTitle}>
          {selectMode ? `${selectedIds.size} selected` : 'Notifications'}
        </Text>
        {selectMode ? (
          <TouchableOpacity
            onPress={handleDeleteSelected}
            disabled={selectedIds.size === 0}
          >
            <Ionicons
              name="trash-outline"
              size={22}
              color={selectedIds.size === 0 ? colors.textMuted : colors.danger}
            />
          </TouchableOpacity>
        ) : (
          <View>
            <TouchableOpacity onPress={() => setOptionsMenuOpen((prev) => !prev)}>
              <Ionicons name="ellipsis-vertical" size={20} color={colors.textDark} />
            </TouchableOpacity>
            {optionsMenuOpen && (
              <View style={styles.optionsDropdown}>
                <TouchableOpacity style={styles.optionsRow} onPress={enterSelectMode}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={colors.textDark} />
                  <Text style={styles.optionsRowText}>Select</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.sectionHeaderRow}>
        {selectMode ? (
          <TouchableOpacity onPress={toggleSelectAll}>
            <Text style={styles.link}>{allSelected ? 'Deselect all' : 'Select all'}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Today</Text>
            <TouchableOpacity onPress={onMarkAllRead} disabled={!hasUnread}>
              <Text style={[styles.link, !hasUnread && styles.linkDisabled]}>
                Mark all as read
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isSelected = selectedIds.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.row, !item.read && !selectMode && styles.rowUnread]}
              onPress={() => handleRowPress(item)}
              activeOpacity={0.7}
            >
              {selectMode && (
                <View style={[styles.checkboxOuter, isSelected && styles.checkboxOuterActive]}>
                  {isSelected && <Ionicons name="checkmark" size={12} color={colors.white} />}
                </View>
              )}
              {item.senderName ? (
                <ProfileAvatar
                  uri={item.senderAvatarUrl}
                  name={item.senderName}
                  size={40}
                  style={{ marginRight: spacing.md }}
                />
              ) : (
                <View style={styles.iconWrap}>
                  <Ionicons name={item.icon} size={18} color={colors.primary} />
                </View>
              )}
              <View style={styles.textWrap}>
                <View style={styles.titleRow}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  {!item.read && <View style={styles.unreadDot} />}
                </View>
                {!!item.senderName && (
                  <Text style={styles.itemSender} numberOfLines={1}>
                    {[item.senderName, item.senderRole, item.senderDepartment].filter(Boolean).join(' · ')}
                  </Text>
                )}
                <Text style={styles.itemDesc}>{item.description}</Text>
              </View>
              <Text style={styles.itemTime}>{item.time}</Text>
              {!selectMode && (
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>You have no notifications.</Text>
        }
      />

      <NotificationDetailModal notification={openNotification} people={people} onClose={() => setOpenNotification(null)} />

      <BottomTabBar active="notifications" onChange={onTabChange} />
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
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
  },
  optionsDropdown: {
    position: 'absolute',
    top: 30,
    right: 0,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.xs,
    minWidth: 140,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 10,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionsRowText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textDark,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
  },
  link: {
    fontSize: 12,
    color: colors.link,
    fontWeight: '600',
  },
  linkDisabled: {
    color: colors.textMuted,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowUnread: {
    backgroundColor: colors.tabInactiveBg,
    borderBottomColor: 'transparent',
    borderRadius: 10,
    marginVertical: 2,
  },
  checkboxOuter: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  checkboxOuterActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.tabInactiveBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  textWrap: {
    flex: 1,
  },
  itemSender: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
  },
  itemDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  itemTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.xl,
  },
});