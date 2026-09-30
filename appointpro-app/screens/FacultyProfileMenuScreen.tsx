import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import FacultyBottomTabBar, { FacultyTabKey } from '../components/FacultyBottomTabBar';

type MenuItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
};

type FacultyProfileMenuScreenProps = {
  name?: string;
  department?: string;
  employeeId?: string;
  email?: string;
  fullDepartment?: string;
  consultationTypes?: string;
  photoUri?: string;
  onBack?: () => void;
  onPersonalInformation?: () => void;
  onMySchedule?: () => void;
  onAbout?: () => void;
  onLogout?: () => void;
  onTabChange?: (tab: FacultyTabKey) => void;
  // Lets the faculty member tap their avatar to pick a new photo from
  // their device and upload it. Omit to render a static, non-editable
  // avatar.
  onChangePhoto?: () => void;
};

export default function FacultyProfileMenuScreen({
  name = 'Dr. Juan DelaCruz',
  department = 'Computer Studies',
  employeeId = '2023-00123',
  email = 'juandelacruz@gmail.com',
  fullDepartment = 'Computer Studies Socsiety',
  consultationTypes = 'Face-to-Face   Online',
  photoUri,
  onBack,
  onPersonalInformation,
  onMySchedule,
  onAbout,
  onLogout,
  onTabChange,
  onChangePhoto,
}: FacultyProfileMenuScreenProps) {
  // Falls back to the placeholder if the photo URL fails to load (e.g.
  // the Supabase Storage bucket isn't public, or the object is missing)
  // instead of silently showing a blank circle.
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [photoUri]);

  const menuItems: MenuItem[] = [
    { key: 'personal', icon: 'person-outline', label: 'Personal Information', onPress: onPersonalInformation },
    { key: 'schedule', icon: 'calendar-outline', label: 'My Schedule', onPress: onMySchedule },
    { key: 'about', icon: 'information-circle-outline', label: 'About AppointmentPro', onPress: onAbout },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        <View style={styles.headerBg}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={onChangePhoto}
            activeOpacity={onChangePhoto ? 0.75 : 1}
            disabled={!onChangePhoto}
          >
            {photoUri && !imageFailed ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.avatarImage}
                onError={(e) => {
                  console.warn(
                    '[FacultyProfileMenuScreen] avatar failed to load:',
                    photoUri,
                    e.nativeEvent.error
                  );
                  setImageFailed(true);
                }}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Feather name="user" size={40} color={colors.white} />
              </View>
            )}
            {onChangePhoto && (
              <View style={styles.avatarEditBadge}>
                <Feather name="camera" size={13} color={colors.white} />
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.name}>{name}</Text>
          <Text style={styles.department}>{department}</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Employee ID</Text>
            <Text style={styles.infoValue}>{employeeId}</Text>
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValueMuted}>{email}</Text>
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Department</Text>
            <Text style={styles.infoValueMuted}>{fullDepartment}</Text>
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Consultation Type</Text>
            <Text style={styles.infoValueMuted}>{consultationTypes}</Text>
          </View>
        </View>

        <View style={styles.menuCard}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.menuRow,
                index < menuItems.length - 1 && styles.menuRowBorder,
              ]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon} size={20} color={colors.textDark} style={styles.menuIcon} />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.logoutWrap}>
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout} activeOpacity={0.85}>
            <Text style={styles.logoutButtonText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <FacultyBottomTabBar active="profile" onChange={onTabChange} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerBg: {
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  avatarWrap: {
    marginBottom: spacing.md,
    position: 'relative',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: spacing.md - 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.white,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: '#A8493C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
  },
  department: {
    fontSize: 12,
    color: '#E9C7CE',
    marginTop: 2,
  },
  infoCard: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  infoRow: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoBlock: {
    marginBottom: spacing.md,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDark,
  },
  infoValueMuted: {
    fontSize: 13,
    color: colors.textMuted,
  },
  menuCard: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuIcon: {
    marginRight: spacing.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.textDark,
    fontWeight: '600',
  },
  logoutWrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  logoutButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});