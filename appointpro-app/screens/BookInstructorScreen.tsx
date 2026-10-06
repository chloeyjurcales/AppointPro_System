import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import BottomTabBar, { TabKey } from '../components/BottomTabBar';
import ProfileAvatar from '../components/ProfileAvatar';
import { FacultyMember } from './DirectoryScreen';

type BookInstructorScreenProps = {
  // Already limited to the student's own department by the caller.
  faculty?: FacultyMember[];
  studentDepartment?: string;
  loading?: boolean;
  onBack?: () => void;
  onSelectFaculty?: (faculty: FacultyMember) => void;
  onTabChange?: (tab: TabKey) => void;
};

/**
 * Opened from the "+" button on the student side. The student can see, search
 * and book instructors from their own department only.
 */
export default function BookInstructorScreen({
  faculty = [],
  studentDepartment = '',
  loading = false,
  onBack,
  onSelectFaculty,
  onTabChange,
}: BookInstructorScreenProps) {
  const [query, setQuery] = useState('');
  const hasDepartment = studentDepartment.trim().length > 0;

  const needle = query.trim().toLowerCase();
  const filtered = faculty.filter(
    (f) => !needle || f.name.toLowerCase().includes(needle) || f.role.toLowerCase().includes(needle)
  );

  const emptyText = loading
    ? 'Loading instructors…'
    : !hasDepartment
    ? 'Your department isn\'t set yet. Add it in your profile to see instructors you can book.'
    : query
    ? 'No instructors match your search.'
    : `No instructors from ${studentDepartment} have signed up yet.`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={22} color={colors.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book an Appointment</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.subtitle}>
          {hasDepartment
            ? `Instructors from your department (${studentDepartment})`
            : 'Instructors from your department'}
        </Text>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search instructors..."
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
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={28} color={colors.textMuted} />
              <Text style={styles.emptyStateText}>{emptyText}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => onSelectFaculty?.(item)} activeOpacity={0.8}>
              <ProfileAvatar
                uri={item.photoUri}
                name={item.name}
                size={48}
                role="faculty"
                style={styles.avatarSpacing}
              />
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
              <View style={styles.bookPill}>
                <Text style={styles.bookPillText}>Book</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </KeyboardAvoidingView>
      <BottomTabBar active={null} onChange={onTabChange} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.white },
  keyboardAvoidingView: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.textDark },
  headerSpacer: { width: 22 },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
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
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: colors.textDark },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, flexGrow: 1 },
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
  avatarSpacing: { marginRight: spacing.md },
  infoWrap: { flex: 1 },
  name: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  role: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  status: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  statusAvailable: { color: colors.success },
  statusUnavailable: { color: colors.danger },
  bookPill: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  bookPillText: { fontSize: 12, fontWeight: '700', color: colors.white },
});