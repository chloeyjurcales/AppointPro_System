import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import ProfileAvatar from '../components/ProfileAvatar';
import FacultyBottomTabBar, { FacultyTabKey } from '../components/FacultyBottomTabBar';
import NotificationDetailModal, { NotificationPerson } from '../components/NotificationDetailModal';
import { NotificationItem, INITIAL_FACULTY_NOTIFICATIONS } from '../data/notifications';

type FacultyNotificationsScreenProps = {
  // Controlled from App.tsx (same real notifications table/state the
  // student Notifications screen uses). Falls back to the mock list so
  // this screen still works standalone.
  notifications?: NotificationItem[];
  onDeleteNotifications?: (ids: string[]) => void;
  onBack?: () => void;
  onMarkAllRead?: () => void;
  onMarkAsRead?: (id: string) => void;
  onSelectNotification?: (item: NotificationItem) => void;
  // Names + profile pictures used to show who a notification is about.
  people?: NotificationPerson[];
  onTabChange?: (tab: FacultyTabKey) => void;
};

export default function FacultyNotificationsScreen({
  notifications = INITIAL_FACULTY_NOTIFICATIONS,
  onDeleteNotifications,
  onBack,
  onMarkAllRead,
  onMarkAsRead,
  onSelectNotification,
  people,
  onTabChange,
}: FacultyNotificationsScreenProps) {
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

  const handleMarkAllRead = () => {
    onMarkAllRead?.();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        {selectMode ? (
          <TouchableOpacity onPress={exitSelectMode}>
            <Ionicons name="close" size={24} color={colors.textDark} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onBack}>
            <Ionicons name="arrow-back" size={22} color={colors.textDark} />
          </TouchableOpacity>
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
            <Text style={styles.markReadText}>{allSelected ? 'Deselect all' : 'Select all'}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Today</Text>
            <TouchableOpacity onPress={handleMarkAllRead} disabled={!hasUnread}>
              <Text style={[styles.markReadText, !hasUnread && styles.markReadTextDisabled]}>
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
        renderItem={({ item, index }) => {
          const isSelected = selectedIds.has(item.id);
          return (
            <TouchableOpacity
              style={[
                styles.row,
                !item.read && !selectMode && styles.rowUnread,
                index < notifications.length - 1 &&
                  (item.read || selectMode) &&
                  styles.rowBorder,
              ]}
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
                  style={styles.icon}
                />
              ) : (
                <MaterialCommunityIcons
                  name={
                    item.icon === 'sync-outline'
                      ? 'autorenew'
                      : item.icon === 'information-circle-outline'
                      ? 'information-outline'
                      : 'bell-outline'
                  }
                  size={20}
                  color={colors.textDark}
                  style={styles.icon}
                />
              )}
              <View style={styles.textWrap}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                {!!item.senderName && (
                  <Text style={styles.itemSender} numberOfLines={1}>
                    {[item.senderName, item.senderRole, item.senderDepartment].filter(Boolean).join(' · ')}
                  </Text>
                )}
                <Text style={styles.itemDesc}>{item.description}</Text>
              </View>
              <Text style={styles.itemTime}>{item.time}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>You have no notifications.</Text>
        }
      />

      <NotificationDetailModal notification={openNotification} people={people} onClose={() => setOpenNotification(null)} />

      <FacultyBottomTabBar active="notifications" onChange={onTabChange} />
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
  markReadText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.link,
  },
  markReadTextDisabled: {
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
    borderRadius: 8,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowUnread: {
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    marginBottom: spacing.sm,
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
  icon: {
    marginRight: spacing.md,
    marginTop: 2,
  },
  textWrap: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
  },
  itemSender: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 1,
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