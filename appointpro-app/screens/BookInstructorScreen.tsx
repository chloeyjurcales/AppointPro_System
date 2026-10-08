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
  Image,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import BottomTabBar, { TabKey } from '../components/BottomTabBar';
import ProfileAvatar from '../components/ProfileAvatar';
import { FacultyMember } from './DirectoryScreen';
import { DEPARTMENT_OPTIONS, departmentKey } from '../lib/departments';
import { DEPARTMENT_LOGOS } from '../lib/departmentLogos';

type BookInstructorScreenProps = {
  // All instructors the student can book (own department listed first by the caller).
  faculty?: FacultyMember[];
  studentDepartment?: string;
  loading?: boolean;
  onBack?: () => void;
  onSelectFaculty?: (faculty: FacultyMember) => void;
  onTabChange?: (tab: TabKey) => void;
};

/**
 * Opened from the "+" button on the student side. The student can see, search
 * and book any instructor.
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
  // The student picks a department first; only then are its instructors shown.
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const needle = query.trim().toLowerCase();
  const filtered = selectedDept
    ? faculty.filter(
        (f) =>
          departmentKey(f.department) === selectedDept &&
          (!needle || f.name.toLowerCase().includes(needle) || f.role.toLowerCase().includes(needle))
      )
    : [];

  const emptyText = loading
    ? 'Loading instructors…'
    : query
    ? 'No instructors match your search.'
    : `No ${selectedDept} instructors have signed up yet.`;

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

        <Text style={styles.subtitle}>Choose a department to see its instructors</Text>

        <TouchableOpacity
          style={styles.deptField}
          onPress={() => setPickerOpen(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Select department"
        >
          {selectedDept ? (
            <Image source={DEPARTMENT_LOGOS[selectedDept]} style={styles.deptLogoSmall} resizeMode="contain" />
          ) : (
            <Ionicons name="school-outline" size={20} color={colors.textMuted} />
          )}
          <Text style={[styles.deptFieldText, !selectedDept && styles.deptPlaceholder]}>
            {selectedDept ?? 'Select a department'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {selectedDept && (
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
        )}

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={28} color={colors.textMuted} />
              <Text style={styles.emptyStateText}>
                {selectedDept ? emptyText : 'Select a department above to see its instructors.'}
              </Text>
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
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Select a department</Text>
            {DEPARTMENT_OPTIONS.map((option) => {
              const selected = selectedDept === option.code;
              return (
                <TouchableOpacity
                  key={option.code}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => {
                    setSelectedDept(option.code);
                    setQuery('');
                    setPickerOpen(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Image source={DEPARTMENT_LOGOS[option.code]} style={styles.optionLogo} resizeMode="contain" />
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
                  {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
      <BottomTabBar active={null} onChange={onTabChange} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  deptField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  deptLogoSmall: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden' },
  deptFieldText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textDark },
  deptPlaceholder: { fontWeight: '400', color: '#9B9B9B' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.white, borderRadius: 16, padding: spacing.lg },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: colors.textDark, marginBottom: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  optionLogo: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  optionText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textDark },
  optionTextSelected: { fontWeight: '700', color: colors.primary },
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