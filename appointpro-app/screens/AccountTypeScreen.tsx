import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import Logo from '../components/Logo';

type AccountTypeScreenProps = {
  onBack?: () => void;
  onSelectStudent?: () => void;
  onSelectFaculty?: () => void;
  onLogin?: () => void;
};

export default function AccountTypeScreen({
  onBack,
  onSelectStudent,
  onSelectFaculty,
  onLogin,
}: AccountTypeScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.textDark} />
        </TouchableOpacity>

        <Logo />

        <Text style={styles.heading}>Create Your Account</Text>
        <Text style={styles.subheading}>
          Join AppointPro to book appointments, manage schedules, and more.
        </Text>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={onSelectStudent}
          activeOpacity={0.8}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#A8493C' }]}>
            <FontAwesome5 name="graduation-cap" size={16} color={colors.white} />
          </View>
          <View style={styles.optionTextWrap}>
            <Text style={styles.optionTitle}>I am a Student</Text>
            <Text style={styles.optionDesc}>
              Book consultations, join walk-in queue, and manage your appointments.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={onSelectFaculty}
          activeOpacity={0.8}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#A8493C' }]}>
            <Ionicons name="person" size={16} color={colors.white} />
          </View>
          <View style={styles.optionTextWrap}>
            <Text style={styles.optionTitle}>I am a Faculty Member</Text>
            <Text style={styles.optionDesc}>
              Manage your availability, appointments, and consultation schedules.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={onLogin}>
            <Text style={styles.link}>Log in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  backButton: {
    marginBottom: spacing.md,
  },
  heading: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textDark,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  subheading: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: 8,
    fontSize: 11,
    color: colors.textMuted,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  link: {
    fontSize: 12,
    color: colors.link,
    fontWeight: '700',
  },
});