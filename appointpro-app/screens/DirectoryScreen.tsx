import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import BottomTabBar, { TabKey } from '../components/BottomTabBar';
import ProfileAvatar from '../components/ProfileAvatar';

export type FacultyStatus = 'available' | 'unavailable';

export type FacultyMember = {
  id: string;
  name: string;
  role: string;
  department: string;
  status: FacultyStatus;
  photoUri?: string;
  consultationTypes?: string;
};

type DirectoryScreenProps = {
  faculty?: FacultyMember[];
  loading?: boolean;
  onMenuPress?: () => void;
  onSelectFaculty?: (faculty: FacultyMember) => void;
  onTabChange?: (tab: TabKey) => void;
};

export default function DirectoryScreen({
  faculty = [],
  loading = false,
  onMenuPress,
  onSelectFaculty,
  onTabChange,
}: DirectoryScreenProps) {
  const [query, setQuery] = useState('');

  const filtered = faculty.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onMenuPress}>
          <Ionicons name="menu" size={24} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Directory</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search faculty..."
            placeholderTextColor="#9B9B9B"
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyStateText}>
              {loading
                ? 'Loading faculty…'
                : query
                ? 'No faculty match your search.'
                : 'No faculty have signed up yet.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => onSelectFaculty?.(item)}
            activeOpacity={0.8}
          >
            <ProfileAvatar uri={item.photoUri} name={item.name} size={48} role="faculty" />
            <View style={styles.infoWrap}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.role}>
                {item.role} · {item.department}
              </Text>
              <Text
                style={[
                  styles.status,
                  item.status === 'available' ? styles.statusAvailable : styles.statusUnavailable,
                ]}
              >
                {item.status === 'available' ? 'Available' : 'Unavailable'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      />

      <BottomTabBar active="directory" onChange={onTabChange} />
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
  headerSpacer: {
    width: 24,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textDark,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xl,
  },
  emptyStateText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  infoWrap: {
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
  },
  role: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  status: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  statusAvailable: {
    color: colors.success,
  },
  statusUnavailable: {
    color: colors.danger,
  },
});