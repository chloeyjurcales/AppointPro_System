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

type StudentProfileScreenProps = {
  studentName?: string;
  studentId?: string;
  email?: string;
  department?: string;
  yearLevel?: string;
  photoUri?: string;
  appointmentCategory?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  appointmentMode?: 'face-to-face' | 'online';
  appointmentRoom?: string;
  onBack?: () => void;
  onTabChange?: (tab: FacultyTabKey) => void;
};

export default function StudentProfileScreen({
  studentName = 'Student Name',
  studentId,
  email,
  department,
  yearLevel,
  photoUri,
  appointmentCategory,
  appointmentDate,
  appointmentTime,
  appointmentMode,
  appointmentRoom,
  onBack,
  onTabChange,
}: StudentProfileScreenProps) {
  // Falls back to the placeholder if the photo URL fails to load (e.g.
  // the Supabase Storage bucket isn't public, or the object is missing)
  // instead of silently showing a blank circle.
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [photoUri]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Student Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileRow}>
          <View style={styles.avatarWrap}>
            {photoUri && !imageFailed ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.avatarImage}
                onError={(e) => {
                  console.warn(
                    '[StudentProfileScreen] avatar failed to load:',
                    photoUri,
                    e.nativeEvent.error
                  );
                  setImageFailed(true);
                }}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Feather name="user" size={30} color={colors.white} />
              </View>
            )}
          </View>
          <Text style={styles.name}>{studentName}</Text>
          {(department || yearLevel) && (
            <Text style={styles.subtitle}>
              {[department, yearLevel].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Student Information</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="id-card-outline" size={18} color={colors.primary} style={styles.infoIcon} />
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoLabel}>Student ID</Text>
              <Text style={styles.infoValue}>{studentId || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={18} color={colors.primary} style={styles.infoIcon} />
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{email || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Ionicons name="school-outline" size={18} color={colors.primary} style={styles.infoIcon} />
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoLabel}>Department</Text>
              <Text style={styles.infoValue}>{department || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Ionicons name="layers-outline" size={18} color={colors.primary} style={styles.infoIcon} />
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoLabel}>Year Level</Text>
              <Text style={styles.infoValue}>{yearLevel || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {(appointmentCategory || appointmentDate || appointmentTime) && (
          <>
            <Text style={styles.sectionTitle}>Appointment Details</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons name="bookmark-outline" size={18} color={colors.primary} style={styles.infoIcon} />
                <View style={styles.infoTextWrap}>
                  <Text style={styles.infoLabel}>Purpose</Text>
                  <Text style={styles.infoValue}>{appointmentCategory || 'N/A'}</Text>
                </View>
              </View>

              <View style={styles.infoDivider} />

              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} style={styles.infoIcon} />
                <View style={styles.infoTextWrap}>
                  <Text style={styles.infoLabel}>Date &amp; Time</Text>
                  <Text style={styles.infoValue}>
                    {[appointmentDate, appointmentTime].filter(Boolean).join(', ') || 'N/A'}
                  </Text>
                </View>
              </View>

              <View style={styles.infoDivider} />

              <View style={styles.infoRow}>
                <Ionicons
                  name={appointmentMode === 'online' ? 'wifi-outline' : 'location-outline'}
                  size={18}
                  color={colors.primary}
                  style={styles.infoIcon}
                />
                <View style={styles.infoTextWrap}>
                  <Text style={styles.infoLabel}>Mode</Text>
                  <Text style={styles.infoValue}>
                    {appointmentMode === 'online'
                      ? 'Online'
                      : appointmentRoom
                      ? `${appointmentRoom} · Face-to-Face`
                      : 'Face-to-Face'}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <FacultyBottomTabBar active="directory" onChange={onTabChange} />
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
    paddingBottom: spacing.lg,
  },
  profileRow: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatarWrap: {
    marginBottom: spacing.sm,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textDark,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  infoCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
  },
  infoIcon: {
    marginRight: spacing.md,
    marginTop: 2,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
});