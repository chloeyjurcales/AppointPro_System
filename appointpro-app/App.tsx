import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
// SDK 54+ moved readAsStringAsync/getInfoAsync to the "legacy" entrypoint;
// the new default export uses a different File/Directory class API.
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import * as Font from 'expo-font';
import { Ionicons, Feather, FontAwesome, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { colors, spacing } from './theme';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from './screens/LoginScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import SettingsScreen from './screens/SettingsScreen';
import AccountTypeScreen from './screens/AccountTypeScreen';
import StudentSignUpScreen from './screens/StudentSignUpScreen';
import FacultySignUpScreen from './screens/FacultySignUpScreen';
import HomeScreen from './screens/HomeScreen';
import DirectoryScreen, { FacultyMember } from './screens/DirectoryScreen';
import FacultyProfileScreen from './screens/FacultyProfileScreen';
import BookAppointmentScreen, { BookingSelection } from './screens/BookAppointmentScreen';
import BookingConfirmationScreen from './screens/BookingConfirmationScreen';
import BookingCancellationScreen from './screens/BookingCancellationScreen';
import AppointmentDetailsScreen from './screens/AppointmentDetailsScreen';
import AppointmentsScreen, {
  Appointment,
  DbStudentAppointment,
  mapDbStudentAppointment,
} from './screens/AppointmentsScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import ProfileScreen from './screens/ProfileScreen';
import FacultyHomeScreen, { ScheduleItem } from './screens/FacultyHomeScreen';
import FacultyDirectoryScreen, {
  StudentAppointment,
  DbFacultyAppointment,
  mapDbFacultyAppointment,
} from './screens/FacultyDirectoryScreen';
import StudentProfileScreen from './screens/StudentProfileScreen';
import FacultyAvailabilityScreen from './screens/FacultyAvailabilityScreen';
import AddTimeSlotScreen, { NewFacultySlotInput } from './screens/AddTimeSlotScreen';
import FacultyNotificationsScreen from './screens/FacultyNotificationsScreen';
import FacultyProfileMenuScreen from './screens/FacultyProfileMenuScreen';
import FacultyScheduleCalendarScreen from './screens/FacultyScheduleCalendarScreen';
import PersonalInformationScreen, {
  PersonalInformation,
} from './screens/PersonalInformationScreen';
import FacultyPersonalInformationScreen, {
  FacultyPersonalInformation,
} from './screens/FacultyPersonalInformationScreen';
import AboutScreen from './screens/AboutScreen';
import QueueScreen from './screens/QueueScreen';
import FacultyRescheduleAppointmentScreen from './screens/FacultyRescheduleAppointmentScreen';
import RescheduleProposalScreen from './screens/RescheduleProposalScreen';
import FacultyCancelAppointmentScreen from './screens/FacultyCancelAppointmentScreen';
import FacultyActionSuccessScreen, {
  FacultyActionSuccessType,
} from './screens/FacultyActionSuccessScreen';
import BookingRescheduleScreen from './screens/BookingRescheduleScreen';
import RecurringScheduleScreen from './screens/RecurringScheduleScreen';
import SideMenu, { SideMenuKey, SideMenuRole } from './components/SideMenu';
import { TabKey } from './components/BottomTabBar';
import { FacultyTabKey } from './components/FacultyBottomTabBar';
import {
  ScheduleSlot,
  BookedRange,
  WEEK_DAYS,
  INITIAL_SCHEDULE_BY_DATE,
  bookMinutes,
  releaseMinutes,
  getBookedTimeRangeLabel,
} from './data/facultySchedule';
import {
  FacultySlot,
  INITIAL_FACULTY_SLOTS_BY_DATE,
  toDateKey,
} from './data/facultySlots';
import { RecurringRule } from './data/recurringSchedule';
import {
  QueueEntry,
  DbQueueEntry,
  mapDbQueueEntry,
  sortQueueByScheduledTime,
  getScheduledTimeRangeLabel,
  AVERAGE_WAIT_MINUTES_PER_STUDENT,
  hasQueueOpened,
  hasAppointmentStartedAt,
  getSecondsUntilAppointment,
} from './data/queue';
import {
  NotificationItem,
  DbNotification,
  mapDbNotification,
} from './data/notifications';

type Screen =
  | 'login'
  | 'forgotPassword'
  | 'accountType'
  | 'studentSignUp'
  | 'facultySignUp'
  | 'home'
  | 'directory'
  | 'facultyProfile'
  | 'bookAppointment'
  | 'rescheduleAppointment'
  | 'bookingConfirmation'
  | 'bookingCancellation'
  | 'bookingReschedule'
  | 'appointmentDetails'
  | 'appointments'
  | 'notifications'
  | 'profile'
  | 'facultyHome'
  | 'facultyDirectory'
  | 'studentProfile'
  | 'facultyAvailability'
  | 'addTimeSlot'
  | 'facultyNotifications'
  | 'facultyProfileMenu'
  | 'facultySchedule'
  | 'settings'
  | 'personalInformation'
  | 'facultyPersonalInformation'
  | 'about'
  | 'queue'
  | 'facultyRescheduleAppointment'
  | 'rescheduleProposal'
  | 'facultyCancelAppointment'
  | 'facultyActionSuccess'
  | 'recurringSchedule';

type StudentProfileData = PersonalInformation & {
  studentId: string;
  role: string;
  photoUri?: string;
};
type FacultyProfileData = FacultyPersonalInformation & {
  employeeId: string;
  department: string;
  photoUri?: string;
};

type PendingReschedule = {
  reason: string;
  originalDateLabel: string;
  originalTime: string;
  originalLocation: string;
  originalMode: string;
  proposedDateLabel: string;
  proposedTime: string;
  proposedLocation: string;
  proposedMode: string;
};

// Drives the confirmation screen shown to the faculty member right after
// they cancel or reschedule a student's appointment.
type FacultyActionResult = {
  type: FacultyActionSuccessType;
  studentName: string;
  category: string;
  dateLabel: string;
  timeLabel: string;
  location: string;
  mode: string;
  reason?: string;
  meetingLink?: string;
  referenceNo: string;
};

// Drives the confirmation screen shown to the student right after they
// cancel or reschedule their own appointment.
type StudentBookingResult = {
  type: 'cancelled' | 'rescheduled';
  doctorName: string;
  doctorPhotoUri?: string;
  department: string;
  dateLabel: string;
  timeLabel: string;
  category: string;
  location: string;
  mode: string;
  referenceNo: string;
};


// Turns a bookingId (e.g. "slot-3-1725720000000") into a stable, readable
// reference number like "APP-2026-720000" for the confirmation screens.
function toReferenceNo(bookingId: string): string {
  const digits = bookingId.replace(/\D/g, '').slice(-6).padStart(6, '0');
  return `APP-2026-${digits}`;
}

// Parses the start time out of a booked time-range label like
// "9:00 AM - 9:30 AM" and reports whether that moment has arrived yet.
// Used to only surface the Home screen's Queue card once a student's
// appointment window has actually begun.
//
// Bug fix: this used to compare ONLY the clock time, ignoring the
// appointment's actual date. That meant a booking made for a future day
// would flip to "started" the instant today's clock reached the same
// time-of-day, auto-joining the student into today's queue for an
// appointment that isn't happening yet. It now also requires the
// appointment's date to be today.
function hasTimeArrived(
  dateKey: string | undefined,
  bookedTimeRangeLabel: string | undefined,
  now: Date
): boolean {
  if (!dateKey || !bookedTimeRangeLabel) return false;
  if (dateKey !== toDateKey(now)) return false;

  const startPart = bookedTimeRangeLabel.split('-')[0]?.trim();
  const match = startPart?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return false;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  const startTime = new Date(now);
  startTime.setHours(hours, minutes, 0, 0);
  return now.getTime() >= startTime.getTime();
}

// --- Faculty availability: DB row shapes + mapping to/from the local
// FacultySlot/RecurringRule shapes the rest of the app already uses ---
type AvailabilitySlotRow = {
  id: string;
  faculty_id: string;
  rule_id: string | null;
  date: string; // 'YYYY-MM-DD'
  start_time: string; // 'HH:MM:SS'
  end_time: string;
  mode: 'Face-to-Face' | 'Online';
  location: string;
  total_minutes: number;
  enabled: boolean;
};

type RecurringRuleRow = {
  id: string;
  faculty_id: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  mode: 'Face-to-Face' | 'Online';
  location: string;
  start_date: string;
  end_date: string;
};

// Builds a "HH:MM:00" 24h time string from 12h form input (accepts either
// numbers from a RecurringRule or raw strings from the Add Slot form).
function to24hTime(hour: number | string, minute: number | string, period: 'AM' | 'PM'): string {
  let h = parseInt(String(hour), 10) % 12;
  if (period === 'PM') h += 12;
  const m = parseInt(String(minute), 10);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
}

function minutesBetween(startTime24: string, endTime24: string): number {
  const [sh, sm] = startTime24.split(':').map(Number);
  const [eh, em] = endTime24.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

function formatTime12h(time24: string): { display: string; period: 'AM' | 'PM'; hour: number; minute: number } {
  const [hStr, mStr] = time24.split(':');
  const h24 = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);
  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  let hour = h24 % 12;
  if (hour === 0) hour = 12;
  return { display: `${hour}:${minute.toString().padStart(2, '0')} ${period}`, period, hour, minute };
}

function mapAvailabilitySlotRow(row: AvailabilitySlotRow): FacultySlot {
  const start = formatTime12h(row.start_time);
  const end = formatTime12h(row.end_time);
  return {
    id: row.id,
    label: `${start.display} - ${end.display}`,
    mode: row.mode,
    location: row.location,
    enabled: row.enabled,
    recurring: !!row.rule_id,
    ruleId: row.rule_id ?? undefined,
  };
}

function mapRecurringRuleRow(row: RecurringRuleRow): RecurringRule {
  const start = formatTime12h(row.start_time);
  const end = formatTime12h(row.end_time);
  return {
    id: row.id,
    daysOfWeek: row.days_of_week,
    startHour: start.hour,
    startMinute: start.minute,
    startPeriod: start.period,
    endHour: end.hour,
    endMinute: end.minute,
    endPeriod: end.period,
    mode: row.mode,
    location: row.location,
    createdDateKey: row.start_date,
    semesterEndDateKey: row.end_date,
  };
}

// --- Real per-faculty bookable schedule (what students see/book) ---
type SlotBookingRow = {
  id: string;
  slot_id: string;
  appointment_id: string;
  start_minute: number;
  duration_minutes: number;
};

// Parses a 12h label like "9:30 AM" into a "HH:MM:00" 24h time string.
function labelTo24h(label: string): string {
  const match = label.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return '00:00:00';
  let h = parseInt(match[1], 10) % 12;
  if (match[3].toUpperCase() === 'PM') h += 12;
  return `${h.toString().padStart(2, '0')}:${match[2]}:00`;
}

// Returns true if two "HH:MM:SS" 24h time ranges on the same day overlap.
// These are zero-padded 24h strings, so plain string comparison already
// matches chronological order — no need to parse them into minutes.
function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// A student should never end up double-booked — two appointments, with
// the same faculty or different ones, that overlap in time on the same
// day. This re-queries that student's own live "upcoming" appointments
// (rather than trusting local state, which can be stale) and checks the
// proposed new window against every one of them. `excludeAppointmentId`
// lets a reschedule check against everything EXCEPT the appointment
// that's actually being moved.
async function findStudentScheduleConflict(
  studentId: string,
  dateKey: string,
  startTime24: string,
  endTime24: string,
  excludeAppointmentId?: string
): Promise<{ conflict: boolean; checkFailed: boolean }> {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, start_time, end_time')
    .eq('student_id', studentId)
    .eq('date', dateKey)
    .eq('status', 'upcoming');

  if (error) {
    console.log('Failed to check schedule conflicts:', error.message);
    return { conflict: false, checkFailed: true };
  }

  const rows = (data ?? []) as { id: string; start_time: string; end_time: string }[];
  const conflict = rows.some(
    (row) =>
      row.id !== excludeAppointmentId &&
      timeRangesOverlap(row.start_time, row.end_time, startTime24, endTime24)
  );
  return { conflict, checkFailed: false };
}

// Parses a "HH:MM" or "HH:MM:SS" 24h time string into minutes-since-midnight.
function timeStringToMinutes(time: string): number {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

// Fetches a specific faculty's real availability for the current real
// week (WEEK_DAYS), plus everyone's existing slot_bookings so remaining
// capacity is accurate — not just "the one demo faculty's" fake calendar.
//
// Bug fix: this used to hand back EVERY row in the current week verbatim,
// which meant a student could "book" a slot on a day that had already
// passed (e.g. browsing on Wednesday still showed Monday's slots), or
// book an already-elapsed time window earlier today. We now (1) drop any
// day before today entirely, (2) drop today's slots whose whole window
// has already finished, and (3) for a slot today that's already under
// way, block off the elapsed portion (its start up to right now) as if
// it were booked, so the remaining-capacity math and "next available
// start time" logic never hand out a time that's already in the past.
//
// `excludeAppointmentId` leaves one appointment's own booking out of the
// capacity math — used while that appointment is being rescheduled so it
// doesn't block the very slot it currently occupies.
async function fetchFacultyWeekSchedule(
  facultyId: string,
  excludeAppointmentId?: string
): Promise<Record<number, ScheduleSlot[]>> {
  const dateKeys = WEEK_DAYS.map((d) => d.dateKey);
  const dateKeyToDayNum = new Map(WEEK_DAYS.map((d) => [d.dateKey, d.date]));

  const { data: slotRows, error } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('faculty_id', facultyId)
    .eq('enabled', true)
    .in('date', dateKeys);

  if (error || !slotRows || slotRows.length === 0) return {};

  const rows = slotRows as AvailabilitySlotRow[];
  const slotIds = rows.map((r) => r.id);
  const { data: bookingRows } = await supabase
    .from('slot_bookings')
    .select('*')
    .in('slot_id', slotIds);

  const now = new Date();
  const todayKey = toDateKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const byDayNum: Record<number, ScheduleSlot[]> = {};
  rows.forEach((row) => {
    // Whole day is in the past — never offer it.
    if (row.date < todayKey) return;

    const dayNum = dateKeyToDayNum.get(row.date);
    if (dayNum === undefined) return;

    const isToday = row.date === todayKey;
    const startMinutes = timeStringToMinutes(row.start_time);
    const endMinutes = timeStringToMinutes(row.end_time);

    // Today's slot has already fully ended — never offer it.
    if (isToday && endMinutes <= nowMinutes) return;

    const start = formatTime12h(row.start_time);
    const end = formatTime12h(row.end_time);
    const bookings: BookedRange[] = ((bookingRows ?? []) as SlotBookingRow[])
      .filter((b) => b.slot_id === row.id && b.appointment_id !== excludeAppointmentId)
      .map((b) => ({
        bookingId: b.id,
        startMinuteOffset: b.start_minute,
        durationMinutes: b.duration_minutes,
        // Other students' names aren't needed for capacity math and
        // shouldn't be exposed to whoever's browsing this slot.
        studentName: 'Booked',
      }));

    // Today's slot has already started — treat the elapsed portion as
    // "booked" so no one can be assigned a start time that's already
    // passed, without hiding the still-open remainder of the slot.
    if (isToday && startMinutes < nowMinutes) {
      bookings.push({
        bookingId: `elapsed-${row.id}`,
        startMinuteOffset: 0,
        durationMinutes: Math.min(nowMinutes - startMinutes, row.total_minutes),
        studentName: 'Elapsed',
      });
    }

    const slot: ScheduleSlot = {
      id: row.id,
      time: `${start.display} - ${end.display}`,
      startLabel: start.display,
      mode: row.mode,
      location: row.location,
      totalMinutes: row.total_minutes,
      bookings,
    };
    byDayNum[dayNum] = [...(byDayNum[dayNum] ?? []), slot];
  });

  return byDayNum;
}

// Live check of whether a faculty member is currently accepting consultations
// (their "Available for consultations" switch). Fails open: if the lookup
// itself fails, booking is not blocked because of a network hiccup.
async function isFacultyAcceptingBookings(facultyId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('faculty')
    .select('is_available')
    .eq('profile_id', facultyId)
    .single();
  if (error || !data) return true;
  return (data as { is_available: boolean }).is_available !== false;
}

// Basic client-side checks for the sign-up forms. The forms collect a
// confirm-password field but nothing compared it, and empty/short values
// went straight to Supabase.
function validateSignUp(
  requiredFields: { label: string; value: string }[],
  email: string,
  password: string,
  confirmPassword: string
): string | null {
  const missing = requiredFields.find((f) => !f.value.trim());
  if (missing) return `${missing.label} is required.`;
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Enter a valid email address.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password !== confirmPassword) return 'Passwords do not match.';
  return null;
}

// Directory appointments store mode/room in a compact shape; these turn
// them into the plain display strings the reschedule/cancel/success
// screens expect.
function directoryLocationLabel(appt: StudentAppointment): string {
  if (appt.mode === 'online') return 'Online';
  return appt.room ?? 'Face-to-Face';
}

function directoryModeLabel(appt: StudentAppointment): string {
  return appt.mode === 'online' ? 'Online' : 'Face-to-Face';
}

function AppContent() {
  const [screen, setScreen] = useState<Screen>('login');
  const [previousScreen, setPreviousScreen] = useState<Screen>('profile');
  const [userRole, setUserRole] = useState<SideMenuRole>('student');
  const [sideMenuOpen, setSideMenuOpen] = useState(false);

  // Whether a chime plays when a new student notification arrives —
  // toggled from Settings. Defaults on so the feature is discoverable.
  const [soundEnabled, setSoundEnabled] = useState(true);
  const notificationSoundPlayer = useAudioPlayer(
    require('./assets/sounds/notification.wav')
  );

  // Lightweight app-wide toast for actions that are wired up but don't
  // have a real destination yet (e.g. "Filters", "More options") — so
  // every button gives real feedback on tap instead of doing nothing.
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 2200);
  };


  const [studentProfile, setStudentProfile] = useState<StudentProfileData>({
    name: '',
    role: 'Student',
    studentId: '',
    email: '',
    department: '',
    yearLevel: '',
    photoUri: undefined,
  });

  const [facultyProfile, setFacultyProfile] = useState<FacultyProfileData>({
    name: '',
    department: '',
    employeeId: '',
    email: '',
    fullDepartment: '',
    consultationTypes: 'Face-to-Face   Online',
    photoUri: undefined,
  });

  // --- Real auth/session, backed by Supabase ---
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  // Guards against double-tapping a login/signup button firing the
  // request twice (e.g. a second signUp for the same email landing a
  // split second after the first one already succeeded, which Supabase
  // correctly — but confusingly — reports as "already registered").
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Pulls the signed-in user's real profile (+ role-specific student/
  // faculty row) from Supabase and populates studentProfile/facultyProfile
  // — this is what makes the displayed name match what they typed at
  // sign-up instead of a hardcoded placeholder.
  const loadProfileForUser = async (userId: string): Promise<'student' | 'faculty' | null> => {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      setAuthError(profileError?.message ?? 'Could not load your profile.');
      return null;
    }

    if (profile.role === 'student') {
      const { data: student } = await supabase
        .from('students')
        .select('*')
        .eq('profile_id', userId)
        .single();

      setStudentProfile({
        name: profile.full_name,
        role: student?.year_level ? `${student.year_level} Student` : 'Student',
        studentId: student?.student_id ?? '',
        email: profile.email,
        department: student?.department ?? '',
        yearLevel: student?.year_level ?? '',
        photoUri: profile.avatar_url ?? undefined,
      });
      setUserRole('student');
      return 'student';
    }

    const { data: faculty } = await supabase
      .from('faculty')
      .select('*')
      .eq('profile_id', userId)
      .single();

    setFacultyProfile({
      name: profile.full_name,
      department: faculty?.department ?? '',
      employeeId: faculty?.faculty_id ?? '',
      email: profile.email,
      fullDepartment: faculty?.department ?? '',
      photoUri: profile.avatar_url ?? undefined,
      consultationTypes: faculty?.consultation_types ?? 'Face-to-Face   Online',
    });
    setUserRole('faculty');
    return 'faculty';
  };

  // Saves the account-level parts of the Personal Information form (name,
  // email, password). Throws an Error with a user-facing message on failure so
  // the form stays open (the screens already expect a rejecting onSave).
  const applyAccountChanges = async (
    newName: string,
    newEmail: string,
    currentEmail: string,
    passwordChange?: { currentPassword: string; newPassword: string }
  ): Promise<{ emailChangePending: boolean }> => {
    if (!session) throw new Error('You are signed out. Please log in again.');
    const trimmedName = newName.trim();
    if (!trimmedName) throw new Error('Full name cannot be empty.');

    if (passwordChange) {
      // Re-verify the current password before allowing a change.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: session.user.email ?? currentEmail,
        password: passwordChange.currentPassword,
      });
      if (verifyError) throw new Error('Your current password is incorrect.');
      const { error: passwordError } = await supabase.auth.updateUser({
        password: passwordChange.newPassword,
      });
      if (passwordError) throw new Error(passwordError.message);
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: trimmedName })
      .eq('id', session.user.id);
    if (profileError) throw new Error(profileError.message);

    // Email changes go through Supabase's confirmation email; the address
    // only actually changes once the new one is confirmed.
    let emailChangePending = false;
    const trimmedEmail = newEmail.trim();
    if (trimmedEmail && trimmedEmail.toLowerCase() !== currentEmail.toLowerCase()) {
      const { error: emailError } = await supabase.auth.updateUser({ email: trimmedEmail });
      if (emailError) throw new Error(emailError.message);
      emailChangePending = true;
    }
    return { emailChangePending };
  };

  // --- Profile photo upload (Supabase Storage 'avatars' bucket) ---
  // Uploads the picked local file to a per-user path in the 'avatars'
  // bucket and returns a cache-busted public URL, or null on failure.
  //
  // NOTE: we intentionally do NOT use `fetch(localUri).arrayBuffer()`
  // here. On-device that call frequently returns an empty or truncated
  // buffer for local file:// / content:// URIs (a long-standing RN/Expo
  // gotcha), which uploads "successfully" (no error thrown) but produces
  // a 0-byte or corrupt image in storage — exactly the "upload works but
  // I can't see the picture" symptom. Reading the file as base64 via
  // expo-file-system and decoding it ourselves is the reliable path.
  const uploadAvatar = async (
    localUri: string,
    userId: string,
    mimeType?: string
  ): Promise<string | null> => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (!fileInfo.exists || (fileInfo.size ?? 0) === 0) {
        console.warn('[uploadAvatar] picked file is missing or empty:', localUri, fileInfo);
        showToast('That photo could not be read. Please try picking it again.');
        return null;
      }

      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = decodeBase64(base64);

      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        console.warn('[uploadAvatar] decoded buffer is empty for:', localUri);
        showToast('Could not process that photo. Please try a different one.');
        return null;
      }

      const extFromUri = localUri.split('.').pop()?.toLowerCase();
      const fileExt =
        extFromUri && /^[a-z0-9]{2,4}$/.test(extFromUri) ? extFromUri : 'jpg';
      const contentType =
        mimeType || (fileExt === 'png' ? 'image/png' : 'image/jpeg');
      // Same path every time (per user) so re-uploading overwrites the
      // old photo instead of littering the bucket with orphaned files.
      const filePath = `${userId}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, { contentType, upsert: true });

      if (uploadError) {
        console.warn('[uploadAvatar] storage upload failed:', uploadError);
        // "Bucket not found" / RLS "new row violates row-level security
        // policy" are the two most common causes and both point at the
        // Supabase Storage setup rather than the app code.
        showToast(uploadError.message || 'Could not upload photo. Please try again.');
        return null;
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      // Cache-bust: the path is stable, so without this the <Image>
      // component (and other devices) would keep showing the old photo.
      return `${data.publicUrl}?t=${Date.now()}`;
    } catch (err) {
      console.warn('[uploadAvatar] unexpected error:', err);
      showToast('Could not upload photo. Please try again.');
      return null;
    }
  };

  // Lets a signed-in student or faculty member tap their avatar, pick a
  // photo from their device, and persist it as their real profile photo.
  const handleChangeAvatar = async (role: 'student' | 'faculty') => {
    if (!session) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast('Photo library permission is required to change your picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    const picked = result.assets[0];
    const publicUrl = await uploadAvatar(picked.uri, session.user.id, picked.mimeType);
    if (!publicUrl) return;

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', session.user.id);

    if (error) {
      showToast(error.message);
      return;
    }

    if (role === 'student') {
      setStudentProfile((prev) => ({ ...prev, photoUri: publicUrl }));
    } else {
      setFacultyProfile((prev) => ({ ...prev, photoUri: publicUrl }));
    }
    showToast('Profile photo updated');
  };

  // Deliberately do NOT restore a persisted session on app launch — every
  // fresh open of the app should land on the Login screen, even if
  // Supabase still has a valid session saved from last time. Sign that
  // persisted session out (clearing it from storage too) instead of
  // reading it back in, then keep profile data in sync with auth state
  // (login, logout, token refresh) for the rest of this run from anywhere.
  useEffect(() => {
    let isMounted = true;

    supabase.auth.signOut().finally(() => {
      if (!isMounted) return;
      setSession(null);
      setAuthLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, newSession: Session | null) => {
        if (!isMounted) return;
        setSession(newSession);
        if (newSession) {
          loadProfileForUser(newSession.user.id);
        } else {
          // Signed out from anywhere (including token expiry) — make sure
          // the UI actually returns to the login screen.
          setScreen('login');
        }
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Ref so the realtime subscription below doesn't need to resubscribe
  // every time the Notification Sound setting is flipped.
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Loads this student's real notifications on login, then keeps them
  // live via Supabase Realtime — new rows (including ones your DB
  // triggers insert automatically, e.g. on appointment status changes)
  // appear immediately without polling, and only ever append once.
  useEffect(() => {
    if (!session) {
      setStudentNotifications([]);
      return;
    }

    let isMounted = true;

    const loadNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      if (!isMounted) return;
      if (error) {
        console.log('Failed to load notifications:', error.message);
        return;
      }
      setStudentNotifications((data as DbNotification[]).map(mapDbNotification));
    };

    loadNotifications();

    // Realtime is the primary path. This lightweight refresh is a fallback
    // for development/device sessions where Realtime delivery is delayed or
    // the notifications table has not yet been added to the publication.
    const refreshTimer = setInterval(loadNotifications, 10000);

    const channel = supabase
      .channel(`notifications-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload) => {
          const newItem = mapDbNotification(payload.new as DbNotification);
          setStudentNotifications((prev) => {
            if (prev.some((item) => item.id === newItem.id)) return prev;
            return [newItem, ...prev];
          });
          if (soundEnabledRef.current) {
            try {
              notificationSoundPlayer.seekTo(0);
              notificationSoundPlayer.play();
            } catch {
              // Never let sound playback failures (e.g. unsupported
              // simulator) block the notification itself.
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      clearInterval(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [session]);

  // --- Faculty directory (real data) ---
  const [facultyDirectory, setFacultyDirectory] = useState<FacultyMember[]>([]);
  const [facultyDirectoryLoading, setFacultyDirectoryLoading] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyMember | null>(null);

  useEffect(() => {
    if (!session) {
      setFacultyDirectory([]);
      return;
    }

    let isMounted = true;
    setFacultyDirectoryLoading(true);

    supabase
      .from('faculty')
      .select('profile_id, department, role_title, is_available, consultation_types, profiles(full_name, avatar_url)')
      .then(({ data, error }) => {
        if (!isMounted) return;
        setFacultyDirectoryLoading(false);
        if (error) {
          console.log('Failed to load faculty directory:', error.message);
          return;
        }
        type FacultyRow = {
          profile_id: string;
          department: string | null;
          role_title: string;
          is_available: boolean;
          consultation_types?: string | null;
          profiles: { full_name: string; avatar_url?: string | null } | { full_name: string; avatar_url?: string | null }[] | null;
        };
        const rows = (data ?? []) as FacultyRow[];
        setFacultyDirectory(
          rows.map((row) => {
            const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
            return {
              id: row.profile_id,
              name: profile?.full_name ?? 'Unknown Faculty',
              role: row.role_title,
              department: row.department ?? '',
              status: row.is_available ? 'available' : 'unavailable',
              photoUri: profile?.avatar_url ?? undefined,
              consultationTypes: row.consultation_types ?? undefined,
            };
          })
        );
      });

    return () => {
      isMounted = false;
    };
  }, [session]);

  // The directory is loaded once per login, so a faculty member switching their
  // availability afterwards would not show up. Re-read the switch each time the
  // student opens the directory or a faculty profile.
  useEffect(() => {
    if (!session || userRole !== 'student') return;
    if (screen !== 'directory' && screen !== 'facultyProfile') return;
    let isMounted = true;

    supabase
      .from('faculty')
      .select('profile_id, is_available')
      .then(({ data, error }) => {
        if (!isMounted || error || !data) return;
        const availability = new Map(
          (data as { profile_id: string; is_available: boolean }[]).map((r) => [
            r.profile_id,
            r.is_available,
          ])
        );
        const apply = (f: FacultyMember): FacultyMember => {
          const value = availability.get(f.id);
          if (value === undefined) return f;
          const status: FacultyMember['status'] = value ? 'available' : 'unavailable';
          return status === f.status ? f : { ...f, status };
        };
        setFacultyDirectory((prev) => prev.map(apply));
        setSelectedFaculty((prev) => (prev ? apply(prev) : prev));
      });

    return () => {
      isMounted = false;
    };
  }, [screen, session, userRole]);

  const [studentAppointments, setStudentAppointments] = useState<Appointment[]>([]);

  // --- This student's own appointments (real data) — backs both the
  // Appointments tab and the Home screen's "Upcoming Appointment" card ---
  // (declared just below, before the selected-appointment lookups)

  // The appointment the student tapped into from the Appointments list,
  // so the Details screen can show its real doctor/date/location/meeting
  // link instead of placeholder text.
  // Stored as an id and looked up in the live list so the Details screen
  // reflects changes (status after a cancel, new time after a reschedule)
  // instead of showing a stale snapshot.
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const selectedAppointment =
    studentAppointments.find((a) => a.id === selectedAppointmentId) ?? null;

  // The appointment a student is currently rescheduling.
  const [actionAppointmentId, setActionAppointmentId] = useState<string | null>(null);
  const actionAppointment =
    studentAppointments.find((a) => a.id === actionAppointmentId) ?? null;
  // Guards cancel/reschedule handlers against double taps.
  const actionInFlightRef = useRef(false);

  useEffect(() => {
    if (!session || userRole !== 'student') {
      setStudentAppointments([]);
      return;
    }
    let isMounted = true;
    const studentId = session.user.id;

    const loadStudentAppointments = () => {
      supabase
        .from('appointments')
        .select(
          `id, faculty_id, date, start_time, end_time, category, mode, location, status, reference_no,
           faculty ( department, profiles ( full_name, avatar_url ) )`
        )
        .eq('student_id', studentId)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
        .then(({ data, error }) => {
          if (!isMounted) return;
          if (error) {
            console.log('Failed to load appointments:', error.message);
            return;
          }
          setStudentAppointments(
            (data as unknown as DbStudentAppointment[]).map(mapDbStudentAppointment)
          );
        });
    };

    loadStudentAppointments();

    const channel = supabase
      .channel(`student-appointments-${studentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `student_id=eq.${studentId}` },
        () => loadStudentAppointments()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [session, userRole]);

  // The soonest real upcoming appointment, for the Home screen card.
  const nextStudentAppointment =
    studentAppointments
      // An appointment left "upcoming" from a past day (never completed or
      // cancelled) must not permanently hog the Home card / queue.
      .filter((a) => a.status === 'upcoming' && (a.dateKey ?? '') >= toDateKey(new Date()))
      .sort(
        (a, b) =>
          (a.dateKey ?? '').localeCompare(b.dateKey ?? '') ||
          (a.startTime24 ?? '').localeCompare(b.startTime24 ?? '')
      )[0] ?? null;

  const [scheduleByDate, setScheduleByDate] =
    useState<Record<number, ScheduleSlot[]>>(INITIAL_SCHEDULE_BY_DATE);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  // Bumped after a booking is cancelled/moved so the schedule is refetched.
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);
  const scheduleFacultyIdRef = useRef<string | null>(null);
  // While rescheduling, the appointment being moved must not count against
  // its own slot's capacity.
  const scheduleExcludeAppointmentId =
    screen === 'rescheduleAppointment' ? actionAppointmentId ?? undefined : undefined;

  // Whenever a student picks a specific faculty from the Directory,
  // fetch THAT faculty's real bookable schedule for the current week —
  // scheduleByDate now represents whoever's actually selected, not a
  // single hardcoded demo faculty.
  useEffect(() => {
    if (!selectedFaculty) {
      scheduleFacultyIdRef.current = null;
      setScheduleByDate({});
      return;
    }
    let isMounted = true;
    // A different faculty than the one whose slots are on screen: drop the
    // old slots right away so they can't be booked against the new faculty
    // while the fetch is in flight.
    if (scheduleFacultyIdRef.current !== selectedFaculty.id) {
      scheduleFacultyIdRef.current = selectedFaculty.id;
      setScheduleByDate({});
    }
    setScheduleLoading(true);
    fetchFacultyWeekSchedule(selectedFaculty.id, scheduleExcludeAppointmentId).then((byDayNum) => {
      if (!isMounted) return;
      setScheduleByDate(byDayNum);
      setScheduleLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [selectedFaculty, scheduleRefreshKey, scheduleExcludeAppointmentId]);

  const [facultySlotsByDate, setFacultySlotsByDate] =
    useState<Record<string, FacultySlot[]>>(INITIAL_FACULTY_SLOTS_BY_DATE);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [addSlotForDate, setAddSlotForDate] = useState<string>(toDateKey(new Date()));

  // Loads the logged-in faculty's real availability slots + recurring
  // rules from Supabase so "My Schedule"/the Availability screen show
  // what they've actually set up, not local mock data.
  useEffect(() => {
    if (!session) {
      // Don't leave the previous faculty's schedule around for the next login.
      setFacultySlotsByDate({});
      setRecurringRules([]);
    }
    if (!session || userRole !== 'faculty') return;
    let isMounted = true;

    supabase
      .from('availability_slots')
      .select('*')
      .eq('faculty_id', session.user.id)
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.log('Failed to load availability slots:', error.message);
          return;
        }
        const byDate: Record<string, FacultySlot[]> = {};
        (data as AvailabilitySlotRow[]).forEach((row) => {
          byDate[row.date] = [...(byDate[row.date] ?? []), mapAvailabilitySlotRow(row)];
        });
        setFacultySlotsByDate(byDate);
      });

    supabase
      .from('recurring_rules')
      .select('*')
      .eq('faculty_id', session.user.id)
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.log('Failed to load recurring rules:', error.message);
          return;
        }
        setRecurringRules((data as RecurringRuleRow[]).map(mapRecurringRuleRow));
      });

    return () => {
      isMounted = false;
    };
  }, [session, userRole]);

  const [bookingPreselect, setBookingPreselect] = useState<{
    date?: number;
    slotId?: string;
  } | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingSelection | null>(null);
  const [isChoosingAfterReject, setIsChoosingAfterReject] = useState(false);
  const [pendingReschedule, setPendingReschedule] = useState<PendingReschedule | null>(null);
  const [cancelledNotice, setCancelledNotice] = useState<string | null>(null);
  const [facultyActionResult, setFacultyActionResult] = useState<FacultyActionResult | null>(
    null
  );
  const [studentBookingResult, setStudentBookingResult] = useState<StudentBookingResult | null>(
    null
  );

  const [studentNotifications, setStudentNotifications] = useState<NotificationItem[]>([]);
  // Unread count for whoever is currently signed in (student or faculty)
  // — drives the numeric badge on every bell icon in the app.
  const unreadNotificationCount = studentNotifications.filter((n) => !n.read).length;

  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [currentStudentQueueId, setCurrentStudentQueueId] = useState<string | null>(null);
  // Set when a student opens the queue of a faculty they're merely browsing
  // (the "fully booked → View Queue" banner), so that view doesn't get
  // confused with the queue of the faculty they actually have an appointment with.
  const [queueViewFacultyId, setQueueViewFacultyId] = useState<string | null>(null);

  // Ticks every second so the live countdowns (session time remaining,
  // estimated wait) actually move in real time, and so a booked
  // appointment's start time gets picked up right on time.
  const [nowTick, setNowTick] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hasAppointmentStarted = confirmedBooking
    ? hasTimeArrived(confirmedBooking.dateKey, confirmedBooking.bookedTimeRangeLabel, nowTick)
    : false;

  // The student's appointment happening today, read from the live list (so
  // it also works after an app restart, when no booking has been made in
  // this session).
  const todaysStudentAppointment =
    nextStudentAppointment && nextStudentAppointment.dateKey === toDateKey(nowTick)
      ? nextStudentAppointment
      : null;
  const todaysApptQueueOpen =
    !!todaysStudentAppointment &&
    hasQueueOpened(todaysStudentAppointment.dateKey, todaysStudentAppointment.startTime24, nowTick);

  // Which faculty's real queue this client cares about: faculty watch
  // their own; students watch the faculty they have an appointment with
  // today (or one they're explicitly viewing / browsing). Both sides
  // read/write the SAME real queue_entries rows.
  const queueFacultyId =
    userRole === 'faculty'
      ? session?.user.id ?? null
      : queueViewFacultyId ??
        todaysStudentAppointment?.facultyId ??
        selectedFaculty?.id ??
        null;

  // Loads today's real queue for that faculty, then keeps it live via
  // Realtime — any insert/update/delete (by either side, or by the SQL
  // triggers) refreshes everyone's view immediately.
  useEffect(() => {
    if (!queueFacultyId) {
      setQueue([]);
      return;
    }
    let isMounted = true;
    const today = toDateKey(new Date());

    const loadQueue = () => {
      supabase
        .from('queue_entries')
        .select('*, appointments ( date, start_time, end_time, students ( profiles ( avatar_url ) ) )')
        .eq('faculty_id', queueFacultyId)
        .eq('queue_date', today)
        .order('position', { ascending: true })
        .then(({ data, error }) => {
          if (!isMounted) return;
          if (error) {
            console.log('Failed to load queue:', error.message);
            return;
          }
          // The DB's `position` column just reflects insertion order —
          // re-sort by each entry's actual scheduled appointment time so
          // the person booked earliest is always first in line.
          setQueue(
            sortQueueByScheduledTime((data as DbQueueEntry[]).map(mapDbQueueEntry))
          );
        });
    };

    loadQueue();

    // Realtime gives instant updates when enabled. The short polling
    // interval is a fallback because this project may be used with
    // Supabase Realtime disabled for one of the tables.
    const pollId = setInterval(loadQueue, 2000);

    const channel = supabase
      .channel(`queue-${queueFacultyId}-${today}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_entries',
          filter: `faculty_id=eq.${queueFacultyId}`,
        },
        () => loadQueue()
      )
      .subscribe();

    return () => {
      isMounted = false;
      clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [queueFacultyId]);

  // Which queue row (if any) is the logged-in student's own — derived
  // from the real data instead of tracked by hand.
  useEffect(() => {
    if (userRole !== 'student') {
      setCurrentStudentQueueId(null);
      return;
    }
    // Match against ALL of this student's own upcoming appointments (plus
    // one just booked this session), not only the last booking made — that
    // is what was leaving the queue "empty" after logging back in.
    const ownIds = new Set(
      studentAppointments.filter((a) => a.status === 'upcoming').map((a) => a.id)
    );
    if (confirmedBooking) ownIds.add(confirmedBooking.bookingId);
    const mine = queue.find((q) => q.appointmentId !== null && ownIds.has(q.appointmentId));
    setCurrentStudentQueueId(mine?.id ?? null);
  }, [queue, studentAppointments, confirmedBooking, userRole]);

  // Student-side fallback: when the queue opens one hour before the
  // appointment, make sure this student's appointment has a real queue row.
  // The faculty client also performs the same reconciliation for every
  // appointment, so either side can bring the queue online. The unique DB
  // index prevents both clients from creating duplicates.
  const joiningQueueRef = useRef(false);
  const reminderSentRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!confirmedBooking || !session) return;
    // The faculty this appointment is actually with — NOT whichever faculty
    // the student happens to be browsing now (using selectedFaculty here put
    // the queue row and reminders on the wrong faculty after browsing).
    const bookedFacultyId =
      studentAppointments.find((a) => a.id === confirmedBooking.bookingId)?.facultyId ??
      selectedFaculty?.id;
    if (!bookedFacultyId) return;
    const bookedFaculty = facultyDirectory.find((f) => f.id === bookedFacultyId);
    if (confirmedBooking.dateKey !== toDateKey(nowTick)) return;
    const startPart = confirmedBooking.bookedTimeRangeLabel.split('-')[0]?.trim();
    const start24 = labelTo24h(startPart || '12:00 AM');
    if (!hasQueueOpened(confirmedBooking.dateKey, start24, nowTick)) return;

    const appointmentKey = confirmedBooking.bookingId;
    if (!queue.some((q) => q.appointmentId === appointmentKey) && !joiningQueueRef.current) {
      joiningQueueRef.current = true;
      supabase
        .from('queue_entries')
        .select('id')
        .eq('appointment_id', appointmentKey)
        .maybeSingle()
        .then(async ({ data: existing, error: lookupError }) => {
          if (lookupError) console.log('Could not check queue entry:', lookupError.message);
          if (!existing) {
            const { data: positionRows } = await supabase
              .from('queue_entries')
              .select('position')
              .eq('faculty_id', bookedFacultyId)
              .eq('queue_date', confirmedBooking.dateKey)
              .order('position', { ascending: false })
              .limit(1);
            const nextPosition = ((positionRows?.[0] as { position?: number } | undefined)?.position ?? 0) + 1;
            const { error } = await supabase.from('queue_entries').insert({
              faculty_id: bookedFacultyId,
              appointment_id: appointmentKey,
              student_name: studentProfile.name,
              duration_minutes: confirmedBooking.durationMinutes,
              queue_date: confirmedBooking.dateKey,
              position: nextPosition,
            });
            if (error && error.code !== '23505') console.log('Failed to join queue:', error.message);

            // One reminder, sent only by whichever client actually created the
            // queue row. Both the student and faculty clients try to create it,
            // and each used to send its own reminder, so both people got the
            // same notification twice.
            if (!error && !reminderSentRef.current.has(appointmentKey)) {
              reminderSentRef.current.add(appointmentKey);
              const facultyName = bookedFaculty?.name || 'your faculty member';
              sendNotification(session.user.id, {
                icon: 'notifications-outline',
                title: 'Your Appointment Is Coming Up',
                description: `Your appointment with ${facultyName} starts at ${startPart}. Please get ready — your queue is now open.`,
              });
              sendNotification(bookedFacultyId, {
                icon: 'notifications-outline',
                title: 'Upcoming Appointment',
                description: `${studentProfile.name}'s appointment starts at ${startPart}. The queue is now open.`,
              });
            }
          }
          joiningQueueRef.current = false;
        });
    }
  }, [confirmedBooking, session, selectedFaculty, facultyDirectory, studentAppointments, nowTick, queue, studentProfile.name]);

  // The faculty member's list of student appointments shown in the
  // Directory tab — loaded from the real `appointments` table further
  // below and kept live via Realtime. Declared up here (rather than next
  // to the effect that populates it) because the queue-start effect right
  // below needs to read it to look up a student's user id, and a
  // block-scoped variable can't be referenced before its declaration.
  const [facultyAppointments, setFacultyAppointments] = useState<StudentAppointment[]>([]);
  const [facultyAppointmentsLoading, setFacultyAppointmentsLoading] = useState(false);

  // Only the owning faculty is allowed to write queue_entries (per RLS),
  // so only their client marks the front of their own queue as "now
  // serving". Right here — the moment that write succeeds — is also
  // exactly when it becomes that student's real turn, so this is where
  // we notify both sides: the student ("it's your time, the queue is
  // starting") and the faculty member themselves.
  const startingQueueEntryRef = useRef<string | null>(null);
  useEffect(() => {
    if (userRole !== 'faculty' || queue.length === 0 || !session) return;
    const front = queue[0];
    if (front.startedAt !== null || startingQueueEntryRef.current === front.id) return;

    // The first person in the queue starts at their scheduled time.
    // A later person may start early only when the Done handler explicitly
    // advances them, which writes started_at immediately.
    const frontAppointment = facultyAppointments.find((a) => a.id === front.appointmentId);
    if (!frontAppointment?.dateKey || !frontAppointment.startTime24) return;
    if (!hasAppointmentStartedAt(frontAppointment.dateKey, frontAppointment.startTime24, nowTick)) return;

    startingQueueEntryRef.current = front.id;
    supabase
      .from('queue_entries')
      .update({ started_at: new Date().toISOString() })
      .eq('id', front.id)
      .is('started_at', null)
      .then(({ error }) => {
        startingQueueEntryRef.current = null;
        if (error) {
          console.log('Failed to start queue entry:', error.message);
          return;
        }

        const timeRangeLabel = getScheduledTimeRangeLabel(front);
        const timeSuffix = timeRangeLabel ? ` (${timeRangeLabel})` : '';
        const studentUserId = frontAppointment.studentUserId;
        if (studentUserId) {
          sendNotification(studentUserId, {
            icon: 'sync-outline',
            title: "It's Your Turn",
            description: `${facultyProfile.name} is ready for you now${timeSuffix}. Your appointment has started — please head over.`,
          });
        }
        sendNotification(session.user.id, {
          icon: 'sync-outline',
          title: 'Appointment Started',
          description: `${front.studentName} is now being served${timeSuffix}.`,
        });
      });
  }, [userRole, queue, session, facultyAppointments, facultyProfile.name, nowTick]);


  // Faculty is the authoritative reconciler for the scheduled queue.
  // Every appointment enters the queue exactly one hour before its booked
  // start time. This means a 9:00 AM appointment becomes a queue item at
  // 8:00 AM, while a 10:00 AM appointment joins at 9:00 AM.
  //
  // When the first appointment reaches 9:00 AM, the separate start effect
  // marks it as started. If the faculty presses Done early, that handler
  // immediately starts the next already-queued appointment, so the next
  // student can begin before their original scheduled time.
  const facultyQueueReminderRef = useRef<Set<string>>(new Set());
  const facultyQueueSyncRef = useRef(false);
  useEffect(() => {
    if (userRole !== 'faculty' || !session || facultyAppointments.length === 0) return;
    if (facultyQueueSyncRef.current) return;
    const today = toDateKey(nowTick);
    const eligible = facultyAppointments.filter((appointment) => {
      if (appointment.status !== 'upcoming' || appointment.dateKey !== today || !appointment.startTime24) return false;
      return hasQueueOpened(appointment.dateKey, appointment.startTime24, nowTick);
    });
    if (eligible.length === 0) return;

    facultyQueueSyncRef.current = true;
    (async () => {
      try {
        for (const appointment of eligible) {
          const { data: existing, error: existingError } = await supabase
            .from('queue_entries')
            .select('id')
            .eq('appointment_id', appointment.id)
            .maybeSingle();
          if (existingError) {
            console.log('Could not check scheduled queue entry:', existingError.message);
            continue;
          }
          let createdQueueEntry = false;
          if (!existing) {
            const { data: positionRows } = await supabase
              .from('queue_entries')
              .select('position')
              .eq('faculty_id', session.user.id)
              .eq('queue_date', today)
              .order('position', { ascending: false })
              .limit(1);
            const nextPosition = ((positionRows?.[0] as { position?: number } | undefined)?.position ?? 0) + 1;
            const { error: insertError } = await supabase.from('queue_entries').insert({
              faculty_id: session.user.id,
              appointment_id: appointment.id,
              student_name: appointment.studentName,
              duration_minutes: Math.max(1, minutesBetween(appointment.startTime24!, appointment.endTime24 ?? appointment.startTime24!)),
              queue_date: today,
              position: nextPosition,
            });
            if (insertError && insertError.code !== '23505') {
              console.log('Failed to create scheduled queue entry:', insertError.message);
            }
            createdQueueEntry = !insertError;
          }

          // Only the client that created the row sends the reminder (see the
          // matching note in the student-side effect).
          if (createdQueueEntry && !facultyQueueReminderRef.current.has(appointment.id)) {
            facultyQueueReminderRef.current.add(appointment.id);
            const timeLabel = appointment.startTimeLabel ?? appointment.time.split(' - ')[0];
            sendNotification(session.user.id, {
              icon: 'notifications-outline',
              title: 'Upcoming Appointment',
              description: `${appointment.studentName}'s appointment is coming up at ${timeLabel}. The queue is now open.`,
            });
            if (appointment.studentUserId) {
              sendNotification(appointment.studentUserId, {
                icon: 'notifications-outline',
                title: 'Your Appointment Is Coming Up',
                description: `Your appointment with ${facultyProfile.name} starts at ${timeLabel}. Please get ready — your queue is now open.`,
              });
            }
          }
        }
      } catch (err) {
        console.log('Queue sync failed:', err);
      } finally {
        facultyQueueSyncRef.current = false;
      }
    })();
  }, [userRole, session, facultyAppointments, nowTick, facultyProfile.name]);

  const [selectedStudent, setSelectedStudent] = useState<StudentAppointment | null>(null);

  // Loads the logged-in faculty's real appointments (joined with the
  // booking student's profile) for the Directory tab, then keeps it live
  // via Realtime so a new booking/cancellation shows up without a refetch.
  useEffect(() => {
    if (!session || userRole !== 'faculty') {
      setFacultyAppointments([]);
      return;
    }
    let isMounted = true;
    const facultyId = session.user.id;

    const loadFacultyAppointments = () => {
      setFacultyAppointmentsLoading(true);
      supabase
        .from('appointments')
        .select(
          `id, student_id, date, start_time, end_time, category, mode, location, status, meeting_link, reference_no,
           students ( student_id, department, year_level, profiles ( full_name, email, avatar_url ) )`
        )
        .eq('faculty_id', facultyId)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
        .then(({ data, error }) => {
          if (!isMounted) return;
          setFacultyAppointmentsLoading(false);
          if (error) {
            console.log('Failed to load faculty appointments:', error.message);
            return;
          }
          setFacultyAppointments(
            (data as unknown as DbFacultyAppointment[]).map(mapDbFacultyAppointment)
          );
        });
    };

    loadFacultyAppointments();

    const channel = supabase
      .channel(`faculty-appointments-${facultyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `faculty_id=eq.${facultyId}` },
        () => loadFacultyAppointments()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [session, userRole]);

  // Today's upcoming appointments (sorted), used for FacultyHomeScreen's
  // "Today's Overview" stat and "Today's Schedule" list.
  const todaysFacultyAppointments = facultyAppointments
    .filter((a) => a.status === 'upcoming' && a.dateKey === toDateKey(nowTick))
    .sort((a, b) => (a.startTime24 ?? '').localeCompare(b.startTime24 ?? ''));

  const todaysFacultySchedule: ScheduleItem[] = todaysFacultyAppointments.map((a) => ({
    id: a.id,
    time: a.startTimeLabel ?? a.time,
    studentName: a.studentName,
    category: a.category,
    mode: a.mode,
    photoUri: a.photoUri,
  }));

  // The specific appointment a faculty member tapped "Reschedule" or
  // "Cancel" on from the Directory — this is what the reschedule/cancel
  // screens and their confirm handlers operate on.
  const [facultyActionAppointment, setFacultyActionAppointment] =
    useState<StudentAppointment | null>(null);

  // The FACULTY's own open slots for this week. The reschedule screen used to
  // be fed `scheduleByDate`, which holds whichever faculty a *student* last
  // browsed (empty for a faculty account), so there was nothing to pick.
  const [facultyOwnSchedule, setFacultyOwnSchedule] = useState<Record<number, ScheduleSlot[]>>({});
  useEffect(() => {
    if (userRole !== 'faculty' || !session || screen !== 'facultyRescheduleAppointment') return;
    const apptId = facultyActionAppointment?.id;
    if (!apptId) return;
    let isMounted = true;
    setFacultyOwnSchedule({});
    fetchFacultyWeekSchedule(session.user.id, apptId).then((byDayNum) => {
      if (isMounted) setFacultyOwnSchedule(byDayNum);
    });
    return () => {
      isMounted = false;
    };
  }, [userRole, session, screen, facultyActionAppointment?.id]);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Stop any in-flight transition before starting the next one so rapid
    // screen switches (e.g. fast tab taps) don't fight each other or jump.
    fadeAnim.stopAnimation();
    slideAnim.stopAnimation();
    fadeAnim.setValue(0);
    slideAnim.setValue(28);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [screen]);

  const handleTabChange = (tab: TabKey) => {
    setQueueViewFacultyId(null);
    switch (tab) {
      case 'home':
        setScreen('home');
        break;
      case 'directory':
        setScreen('directory');
        break;
      case 'appointments':
        setScreen('appointments');
        break;
      case 'notifications':
        setScreen('notifications');
        break;
      case 'profile':
        setScreen('profile');
        break;
    }
  };

  const handleFacultyTabChange = (tab: FacultyTabKey) => {
    switch (tab) {
      case 'home':
        setScreen('facultyHome');
        break;
      case 'appointment':
        setScreen('facultyAvailability');
        break;
      case 'directory':
        setScreen('facultyDirectory');
        break;
      case 'notifications':
        setScreen('facultyNotifications');
        break;
      case 'profile':
        setScreen('facultyProfileMenu');
        break;
    }
  };

  const goToPersonalInformation = (from: Screen) => {
    setPreviousScreen(from);
    setScreen('personalInformation');
  };

  const goToFacultyPersonalInformation = (from: Screen) => {
    setPreviousScreen(from);
    setScreen('facultyPersonalInformation');
  };

  const goToAbout = (from: Screen) => {
    setPreviousScreen(from);
    setScreen('about');
  };

  // --- Side menu handlers ---
  const openSideMenu = (role: SideMenuRole) => {
    setUserRole(role);
    setSideMenuOpen(true);
  };

  const handleSideMenuNavigate = (key: SideMenuKey) => {
    setSideMenuOpen(false);
    if (key === 'helpSupport') {
      goToAbout(screen);
      return;
    }
    if (key === 'settings') {
      setPreviousScreen(screen);
      setScreen('settings');
      return;
    }
    setScreen(key);
  };

  // Maps the current app screen back to a SideMenu key so the matching
  // row can be highlighted while the menu is open.
  const sideMenuActiveKey: SideMenuKey | undefined = (
    [
      'home',
      'directory',
      'appointments',
      'notifications',
      'profile',
      'facultyHome',
      'facultyDirectory',
      'facultyAvailability',
      'facultyNotifications',
      'facultyProfileMenu',
      'settings',
    ] as SideMenuKey[]
  ).includes(screen as SideMenuKey)
    ? (screen as SideMenuKey)
    : undefined;

  // Signs the user out for real. The Profile screens' Log Out buttons only
  // changed the screen before, leaving the Supabase session (and the
  // previous user's data) alive behind the login form.
  const handleLogout = () => {
    setSideMenuOpen(false);
    setConfirmedBooking(null);
    setSelectedFaculty(null);
    setSelectedAppointmentId(null);
    setActionAppointmentId(null);
    setSelectedStudent(null);
    setFacultyActionAppointment(null);
    setFacultyActionResult(null);
    setStudentBookingResult(null);
    setQueueViewFacultyId(null);
    setAuthError(null);
    setUserRole('student');
    setScreen('login');
    supabase.auth.signOut();
  };
  const handleSideMenuLogout = handleLogout;

  // --- Faculty availability editing handlers (one-off slots) ---
  const handleToggleFacultySlot = async (dateKey: string, slotId: string) => {
    const current = facultySlotsByDate[dateKey]?.find((s) => s.id === slotId);
    if (!current) return;
    const nextEnabled = !current.enabled;

    setFacultySlotsByDate((prev) => ({
      ...prev,
      [dateKey]: (prev[dateKey] ?? []).map((s) =>
        s.id === slotId ? { ...s, enabled: nextEnabled } : s
      ),
    }));

    const { error } = await supabase
      .from('availability_slots')
      .update({ enabled: nextEnabled })
      .eq('id', slotId);
    if (error) showToast('Could not update slot.');
  };

  // Re-reads this faculty's slots and rules. Used to undo optimistic UI
  // changes when a delete is refused by the database.
  const reloadFacultyAvailability = async () => {
    if (!session) return;
    const [slotsRes, rulesRes] = await Promise.all([
      supabase.from('availability_slots').select('*').eq('faculty_id', session.user.id),
      supabase.from('recurring_rules').select('*').eq('faculty_id', session.user.id),
    ]);
    if (!slotsRes.error && slotsRes.data) {
      const byDate: Record<string, FacultySlot[]> = {};
      (slotsRes.data as AvailabilitySlotRow[]).forEach((row) => {
        byDate[row.date] = [...(byDate[row.date] ?? []), mapAvailabilitySlotRow(row)];
      });
      setFacultySlotsByDate(byDate);
    }
    if (!rulesRes.error && rulesRes.data) {
      setRecurringRules((rulesRes.data as RecurringRuleRow[]).map(mapRecurringRuleRow));
    }
  };

  const handleDeleteFacultySlot = async (dateKey: string, slotId: string) => {
    const { error } = await supabase.from('availability_slots').delete().eq('id', slotId);
    if (error) {
      // 23503 = still referenced by an appointment (even a cancelled/completed one).
      showToast(
        error.code === '23503'
          ? 'This slot has appointments on record and can\'t be deleted. Turn it off instead.'
          : 'Could not delete slot.'
      );
      return;
    }
    setFacultySlotsByDate((prev) => ({
      ...prev,
      [dateKey]: (prev[dateKey] ?? []).filter((s) => s.id !== slotId),
    }));
  };

  const handleAddTimeSlot = (dateKey: string) => {
    setAddSlotForDate(dateKey);
    setScreen('addTimeSlot');
  };

  const handleConfirmNewFacultySlot = async (data: NewFacultySlotInput) => {
    if (!session) return;
    const startTime = to24hTime(data.startHour, data.startMinute, data.startPeriod);
    const endTime = to24hTime(data.endHour, data.endMinute, data.endPeriod);

    // Overlapping slots would let the same minutes be booked twice.
    const overlapsExisting = (facultySlotsByDate[addSlotForDate] ?? []).some((s) => {
      const [a, b] = s.label.split(' - ');
      return timeRangesOverlap(labelTo24h(a), labelTo24h(b), startTime, endTime);
    });
    if (overlapsExisting) {
      showToast('That time overlaps another slot on this day.');
      return;
    }

    const { data: inserted, error } = await supabase
      .from('availability_slots')
      .insert({
        faculty_id: session.user.id,
        date: addSlotForDate,
        start_time: startTime,
        end_time: endTime,
        mode: data.mode,
        location: data.location,
        total_minutes: minutesBetween(startTime, endTime),
      })
      .select()
      .single();

    if (error || !inserted) {
      showToast(error?.message ?? 'Could not add time slot.');
      return;
    }

    const newSlot = mapAvailabilitySlotRow(inserted as AvailabilitySlotRow);
    setFacultySlotsByDate((prev) => ({
      ...prev,
      [addSlotForDate]: [...(prev[addSlotForDate] ?? []), newSlot],
    }));
    setScreen('facultyAvailability');
  };

  // --- Recurring weekly schedule handlers ---
  const handleCreateRecurringRule = async (rule: RecurringRule) => {
    if (!session) return;
    const startTime = to24hTime(rule.startHour, rule.startMinute, rule.startPeriod);
    const endTime = to24hTime(rule.endHour, rule.endMinute, rule.endPeriod);
    const totalMinutes = minutesBetween(startTime, endTime);

    const { data: insertedRule, error: ruleError } = await supabase
      .from('recurring_rules')
      .insert({
        faculty_id: session.user.id,
        days_of_week: rule.daysOfWeek,
        start_time: startTime,
        end_time: endTime,
        mode: rule.mode,
        location: rule.location,
        start_date: rule.createdDateKey,
        end_date: rule.semesterEndDateKey,
      })
      .select()
      .single();

    if (ruleError || !insertedRule) {
      showToast(ruleError?.message ?? 'Could not save recurring schedule.');
      return;
    }

    // Generate one concrete availability_slots row per matching date in
    // the range, and insert them all in a single call.
    const start = new Date(rule.createdDateKey + 'T00:00:00');
    const end = new Date(rule.semesterEndDateKey + 'T00:00:00');
    const rowsToInsert: Record<string, unknown>[] = [];
    const cursor = new Date(start);
    let safety = 0;
    while (cursor <= end && safety < 400) {
      safety++;
      if (rule.daysOfWeek.includes(cursor.getDay())) {
        rowsToInsert.push({
          faculty_id: session.user.id,
          rule_id: insertedRule.id,
          date: toDateKey(cursor),
          start_time: startTime,
          end_time: endTime,
          mode: rule.mode,
          location: rule.location,
          total_minutes: totalMinutes,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const { data: insertedSlots, error: slotsError } = await supabase
      .from('availability_slots')
      .insert(rowsToInsert)
      .select();

    if (slotsError) {
      showToast('Recurring schedule saved, but some slots failed to generate.');
    }

    const generatedSlots = (insertedSlots ?? []) as AvailabilitySlotRow[];
    setFacultySlotsByDate((prev) => {
      const merged = { ...prev };
      generatedSlots.forEach((row) => {
        merged[row.date] = [...(merged[row.date] ?? []), mapAvailabilitySlotRow(row)];
      });
      return merged;
    });
    setRecurringRules((prev) => [...prev, mapRecurringRuleRow(insertedRule as RecurringRuleRow)]);
    setScreen('facultyAvailability');
  };

  const handleDeleteRecurringRule = async (ruleId: string) => {
    // Slots that ever had an appointment can't be deleted (foreign key), which
    // used to make this fail silently after the UI had already dropped them.
    // Delete what can be deleted, keep the rest as one-off slots, then drop the rule.
    const { data: ruleSlots, error: listError } = await supabase
      .from('availability_slots')
      .select('id')
      .eq('rule_id', ruleId);
    if (listError) {
      showToast('Could not delete recurring schedule.');
      return;
    }
    const slotIds = ((ruleSlots ?? []) as { id: string }[]).map((s) => s.id);
    const chunks: string[][] = [];
    for (let i = 0; i < slotIds.length; i += 50) chunks.push(slotIds.slice(i, i + 50));

    const referenced = new Set<string>();
    for (const chunk of chunks) {
      const { data: appts } = await supabase.from('appointments').select('slot_id').in('slot_id', chunk);
      ((appts ?? []) as { slot_id: string | null }[]).forEach((a) => a.slot_id && referenced.add(a.slot_id));
    }

    let failed = false;
    for (const chunk of chunks) {
      const deletable = chunk.filter((id) => !referenced.has(id));
      if (deletable.length) {
        const { error } = await supabase.from('availability_slots').delete().in('id', deletable);
        if (error) failed = true;
      }
    }
    if (referenced.size) {
      const { error } = await supabase
        .from('availability_slots')
        .update({ rule_id: null })
        .in('id', Array.from(referenced));
      if (error) failed = true;
    }

    if (!failed) {
      const { error: ruleError } = await supabase.from('recurring_rules').delete().eq('id', ruleId);
      if (ruleError) failed = true;
    }

    await reloadFacultyAvailability();
    if (failed) showToast('Could not fully delete the recurring schedule.');
    else if (referenced.size) {
      showToast(`${referenced.size} slot(s) with appointments were kept as one-time slots.`);
    }
  };

  // --- Queue handlers ---
  // Faculty presses "Done" once a student's consultation wraps up
  // (including early finishes) — deletes their real queue_entries row.
  // The renumber_queue_positions DB trigger shifts everyone else up, and
  // the notify_queue_done trigger tells that student it's complete.
  const handleCompleteCurrentQueue = async () => {
    if (userRole !== 'faculty' || queue.length === 0 || !session) return;
    const front = queue[0];
    if (front.startedAt === null) {
      showToast('This appointment has not started yet.');
      return;
    }

    // First make the appointment history permanent. The Appointment screen
    // will then move this record from Upcoming to Completed.
    if (front.appointmentId) {
      const { error: appointmentError } = await supabase
        .from('appointments')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', front.appointmentId);
      if (appointmentError) {
        showToast('Could not complete this appointment: ' + appointmentError.message);
        return;
      }
      // Without this, `facultyAppointments` still shows this appointment as
      // "upcoming" until the next full refetch. The queue auto-sync effect
      // below reads that same stale list, decides this appointment is still
      // eligible for today's queue (its queue_entries row was just deleted,
      // so it looks like it never joined), and recreates it — which is
      // exactly why a just-completed student, especially the only one in
      // line, would silently reappear at the front of the queue.
      setFacultyAppointments((prev) =>
        prev.map((a) => (a.id === front.appointmentId ? { ...a, status: 'completed' } : a))
      );
    }

    const studentUserId = front.appointmentId
      ? facultyAppointments.find((a) => a.id === front.appointmentId)?.studentUserId
      : undefined;
    if (studentUserId) {
      sendNotification(studentUserId, {
        icon: 'checkmark-circle-outline',
        title: 'Appointment Completed',
        description: `Your appointment with ${facultyProfile.name} has been completed.`,
      });
    }

    const { error: deleteError } = await supabase.from('queue_entries').delete().eq('id', front.id);
    if (deleteError) {
      showToast('Appointment completed, but the queue could not advance: ' + deleteError.message);
      return;
    }

    // If another student is already queued, immediately start them. This is
    // what allows Student B to begin early when Student A finishes early.
    const next = queue[1];
    if (next) {
      const { error: nextError } = await supabase
        .from('queue_entries')
        .update({ started_at: new Date().toISOString() })
        .eq('id', next.id)
        .is('started_at', null);
      if (nextError) {
        console.log('Could not start the next queue entry:', nextError.message);
      } else {
        const nextStudentUserId = next.appointmentId
          ? facultyAppointments.find((a) => a.id === next.appointmentId)?.studentUserId
          : undefined;
        if (nextStudentUserId) {
          const nextRange = getScheduledTimeRangeLabel(next);
          sendNotification(nextStudentUserId, {
            icon: 'sync-outline',
            title: "It's Your Turn",
            description: `${facultyProfile.name} finished the previous appointment early. It is now your turn${nextRange ? ` (${nextRange})` : ''}. Please head over.`,
          });
        }
        sendNotification(session.user.id, {
          icon: 'sync-outline',
          title: 'Queue Advanced',
          description: `${next.studentName} is now being served.`,
        });
      }
    }
  };

  // --- Notifications ---
  // Inserts a real row into the `notifications` table for whichever user
  // should receive it (the other party in a booking/cancel/reschedule —
  // not necessarily the person currently signed in). Local state for the
  // *recipient's own* session is updated by the realtime subscription
  // below (not here), so a notification only ever gets appended/sounded
  // once even though many places in the app call this function.
  const sendNotification = async (
    userId: string,
    input: Pick<NotificationItem, 'icon' | 'title' | 'description'>
  ) => {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      icon: input.icon,
      title: input.title,
      description: input.description,
    });
    if (error) {
      console.log('Failed to save notification:', error.message);
    }
  };

  const handleDeleteStudentNotifications = async (ids: string[]) => {
    setStudentNotifications((prev) => prev.filter((n) => !ids.includes(n.id)));
    const { error } = await supabase.from('notifications').delete().in('id', ids);
    if (error) showToast('Could not delete notifications.');
  };

  const handleMarkAllStudentNotificationsRead = async () => {
    if (!session) return;
    setStudentNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', session.user.id)
      .eq('read', false);
    if (error) showToast('Could not update notifications.');
  };

  const handleMarkStudentNotificationRead = async (id: string) => {
    setStudentNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error) showToast('Could not update notification.');
  };

  // --- Cancellation ---
  // Faculty cancels a student's appointment. This used to update local state
  // and notify the student but never touched the database, so the
  // appointment came back on the next reload and the student still saw it
  // as upcoming.
  const handleFacultyCancel = async (reason: string) => {
    if (!facultyActionAppointment || actionInFlightRef.current) return;
    const appt = facultyActionAppointment;
    actionInFlightRef.current = true;
    try {
      const { error: apptError } = await supabase
        .from('appointments')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('id', appt.id);
      if (apptError) {
        showToast('Could not cancel appointment: ' + apptError.message);
        return;
      }

      // Free the reserved minutes and drop any queue spot (best effort —
      // the appointment itself is already cancelled).
      const { error: bookingError } = await supabase
        .from('slot_bookings')
        .delete()
        .eq('appointment_id', appt.id);
      if (bookingError) console.log('Failed to release slot capacity:', bookingError.message);
      const { error: queueError } = await supabase
        .from('queue_entries')
        .delete()
        .eq('appointment_id', appt.id);
      if (queueError) console.log('Failed to remove queue entry:', queueError.message);

      setFacultyAppointments((prev) =>
        prev.map((a) => (a.id === appt.id ? { ...a, status: 'cancelled' } : a))
      );

      if (appt.studentUserId) {
        sendNotification(appt.studentUserId, {
          icon: 'close-circle-outline',
          title: 'Appointment Cancelled',
          description: `${facultyProfile.name} cancelled your appointment on ${appt.date} at ${appt.time}. Reason: ${reason}`,
        });
      }
      if (session) {
        sendNotification(session.user.id, {
          icon: 'close-circle-outline',
          title: 'Appointment Cancelled',
          description: `You cancelled ${appt.studentName}'s appointment on ${appt.date} at ${appt.time}.`,
        });
      }

      setFacultyActionResult({
        type: 'cancelled',
        studentName: appt.studentName,
        category: appt.category,
        dateLabel: appt.date,
        timeLabel: appt.time,
        location: directoryLocationLabel(appt),
        mode: directoryModeLabel(appt),
        reason,
        referenceNo: appt.referenceNo ?? toReferenceNo(appt.id),
      });

      setFacultyActionAppointment(null);
      setScreen('facultyActionSuccess');
    } finally {
      actionInFlightRef.current = false;
    }
  };

  // --- Student-initiated cancellation ---
  // Works on the appointment the student actually opened. It used to cancel
  // whatever `confirmedBooking` was (only set for a booking made in this app
  // session), so cancelling from the Appointments list did nothing after a
  // restart — or cancelled a different, freshly booked appointment.
  const handleStudentCancel = async (appt: Appointment | null) => {
    if (!appt || appt.status !== 'upcoming') {
      showToast('There is no upcoming appointment to cancel.');
      return;
    }
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;

    try {
      const { error: apptError } = await supabase
        .from('appointments')
        .update({ status: 'canceled' })
        .eq('id', appt.id);
      if (apptError) {
        // Don't show a "cancelled" confirmation for something that wasn't.
        showToast('Could not cancel appointment: ' + apptError.message);
        return;
      }

      // If they were already in today's queue for this appointment, leave it
      // too — a cancelled appointment shouldn't still hold a spot in line.
      const { error: queueError } = await supabase
        .from('queue_entries')
        .delete()
        .eq('appointment_id', appt.id);
      if (queueError) console.log('Failed to leave queue:', queueError.message);

      const { error: bookingRowError } = await supabase
        .from('slot_bookings')
        .delete()
        .eq('appointment_id', appt.id);
      if (bookingRowError) {
        console.log('Failed to release slot capacity:', bookingRowError.message);
      }

      const [dateLabel = appt.date, timeLabel = ''] = appt.date.split(' · ');

      if (appt.facultyId) {
        sendNotification(appt.facultyId, {
          icon: 'close-circle-outline',
          title: 'Appointment Cancelled',
          description: `${studentProfile.name} cancelled their appointment on ${dateLabel} at ${timeLabel}.`,
        });
      }
      if (session) {
        sendNotification(session.user.id, {
          icon: 'close-circle-outline',
          title: 'Appointment Cancelled',
          description: `Your appointment with ${appt.doctorName} on ${dateLabel} at ${timeLabel} was cancelled.`,
        });
      }

      setStudentBookingResult({
        type: 'cancelled',
        doctorName: appt.doctorName,
        doctorPhotoUri: appt.facultyAvatarUrl,
        department: appt.department ?? '',
        dateLabel,
        timeLabel,
        category: appt.category,
        location: appt.location,
        mode: appt.mode,
        referenceNo: appt.referenceNo ?? toReferenceNo(appt.id),
      });

      if (confirmedBooking?.bookingId === appt.id) setConfirmedBooking(null);
      setSelectedAppointmentId(appt.id);
      setScheduleRefreshKey((k) => k + 1);
      setScreen('bookingCancellation');
    } finally {
      actionInFlightRef.current = false;
    }
  };

  // --- Student-initiated reschedule ---
  // Opens the reschedule picker for a specific appointment. The picker shows
  // `scheduleByDate`, which belongs to `selectedFaculty`, so point that at the
  // appointment's own faculty first (it may be someone else the student was
  // last browsing).
  const startStudentReschedule = (appt: Appointment | null) => {
    if (!appt || appt.status !== 'upcoming') {
      showToast('There is no upcoming appointment to reschedule.');
      return;
    }
    const faculty = facultyDirectory.find((f) => f.id === appt.facultyId);
    if (!faculty) {
      showToast("Couldn't load this faculty member's schedule. Please try again.");
      return;
    }
    setSelectedFaculty(faculty);
    setSelectedAppointmentId(appt.id);
    setActionAppointmentId(appt.id);
    setScreen('rescheduleAppointment');
  };

  const handleStudentReschedule = async (selection: BookingSelection) => {
    const appt = actionAppointment;
    if (!appt || appt.status !== 'upcoming') {
      showToast('There is no upcoming appointment to reschedule.');
      return;
    }
    if (actionInFlightRef.current) return;

    if (appt.facultyId && !(await isFacultyAcceptingBookings(appt.facultyId))) {
      showToast(`${appt.doctorName} isn't accepting consultations right now.`);
      return;
    }

    // Re-read the schedule (leaving this appointment's own booking out) so a
    // stale on-screen copy can't hand out minutes someone else just took.
    const freshSchedule = appt.facultyId
      ? await fetchFacultyWeekSchedule(appt.facultyId, appt.id)
      : scheduleByDate;
    const { scheduleByDate: afterBooking, startOffset } = bookMinutes(
      freshSchedule,
      selection.date,
      selection.slot.id,
      selection.durationMinutes,
      studentProfile.name
    );
    if (startOffset === null) {
      showToast('That slot no longer has enough free time. Please pick another.');
      return;
    }

    const bookedSlot = (afterBooking[selection.date] ?? []).find(
      (s) => s.id === selection.slot.id
    );
    const bookedTimeRangeLabel = bookedSlot
      ? getBookedTimeRangeLabel(bookedSlot, startOffset, selection.durationMinutes)
      : selection.slot.time;

    // Move the SAME appointment row to the new slot/time (rather than
    // cancel + create new) so its id — and anything already referencing
    // it — stays stable.
    const dayInfo = WEEK_DAYS.find((d) => d.date === selection.date);
    const realDateKey = dayInfo?.dateKey ?? toDateKey(new Date());
    const [startLabelPart, endLabelPart] = bookedTimeRangeLabel.split(' - ');
    const newStartTime24 = labelTo24h(startLabelPart);
    const newEndTime24 = labelTo24h(endLabelPart);

    actionInFlightRef.current = true;
    try {
      // Make sure moving this appointment doesn't land it on top of
      // another appointment the student already has (excluding itself).
      if (session) {
        const { conflict, checkFailed } = await findStudentScheduleConflict(
          session.user.id,
          realDateKey,
          newStartTime24,
          newEndTime24,
          appt.id
        );
        if (checkFailed) {
          showToast('Could not verify your schedule — please try again.');
          return;
        }
        if (conflict) {
          showToast('You already have another appointment that overlaps this time.');
          return;
        }
      }

      const { error: apptError } = await supabase
        .from('appointments')
        .update({
          slot_id: selection.slot.id,
          date: realDateKey,
          start_time: newStartTime24,
          end_time: newEndTime24,
          duration_minutes: selection.durationMinutes,
          mode: selection.slot.mode,
          location: selection.slot.location,
        })
        .eq('id', appt.id);

      if (apptError) {
        showToast('Could not reschedule: ' + apptError.message);
        return;
      }

      // Free the old slot's reserved minutes and reserve the new ones.
      await supabase.from('slot_bookings').delete().eq('appointment_id', appt.id);
      const { error: bookingRowError } = await supabase.from('slot_bookings').insert({
        slot_id: selection.slot.id,
        appointment_id: appt.id,
        start_minute: startOffset,
        duration_minutes: selection.durationMinutes,
      });
      if (bookingRowError) {
        showToast('Rescheduled, but capacity tracking failed to save.');
      }

      // The old queue spot belonged to the old time (possibly another day).
      // Faculty's client re-adds it when the new time's queue opens.
      await supabase.from('queue_entries').delete().eq('appointment_id', appt.id);

      if (appt.facultyId) {
        sendNotification(appt.facultyId, {
          icon: 'calendar-outline',
          title: 'Appointment Rescheduled',
          description: `${studentProfile.name} moved their appointment to ${selection.dateLabel} at ${bookedTimeRangeLabel}.`,
        });
      }
      if (session) {
        sendNotification(session.user.id, {
          icon: 'calendar-outline',
          title: 'Appointment Rescheduled',
          description: `Your appointment with ${appt.doctorName} was moved to ${selection.dateLabel} at ${bookedTimeRangeLabel}.`,
        });
      }

      if (confirmedBooking?.bookingId === appt.id) {
        setConfirmedBooking({
          ...selection,
          slot: bookedSlot ?? selection.slot,
          bookingId: appt.id,
          bookedTimeRangeLabel,
        });
      }

      setStudentBookingResult({
        type: 'rescheduled',
        doctorName: appt.doctorName,
        doctorPhotoUri: appt.facultyAvatarUrl,
        department: appt.department ?? '',
        dateLabel: selection.dateLabel,
        timeLabel: bookedTimeRangeLabel,
        category: appt.category,
        location: selection.slot.location,
        mode: selection.slot.mode,
        referenceNo: appt.referenceNo ?? toReferenceNo(appt.id),
      });

      setSelectedAppointmentId(appt.id);
      setScheduleRefreshKey((k) => k + 1);
      setScreen('bookingReschedule');
    } finally {
      actionInFlightRef.current = false;
    }
  };

  // --- Faculty-initiated reschedule ---
  // Moves the appointment to one of the FACULTY's own open slots and saves it.
  // Previously this only edited local state (using the wrong schedule) so the
  // change vanished on reload and the student's record never changed.
  const handleFacultyReschedule = async (data: {
    date: number;
    dateLabel: string;
    slot: ScheduleSlot;
    durationMinutes: number;
    reason: string;
    meetingLink?: string;
  }) => {
    if (!facultyActionAppointment || !session || actionInFlightRef.current) return;
    const appt = facultyActionAppointment;
    const isOnline = data.slot.mode === 'Online';

    const freshSchedule = await fetchFacultyWeekSchedule(session.user.id, appt.id);
    const { scheduleByDate: afterBooking, startOffset } = bookMinutes(
      freshSchedule,
      data.date,
      data.slot.id,
      data.durationMinutes,
      appt.studentName
    );
    if (startOffset === null) {
      showToast('That slot no longer has enough free time. Please pick another.');
      return;
    }

    const newSlot = (afterBooking[data.date] ?? []).find((s) => s.id === data.slot.id);
    const bookedTimeRangeLabel = newSlot
      ? getBookedTimeRangeLabel(newSlot, startOffset, data.durationMinutes)
      : data.slot.time;

    const dayInfo = WEEK_DAYS.find((d) => d.date === data.date);
    const realDateKey = dayInfo?.dateKey ?? toDateKey(new Date());
    const [startLabelPart, endLabelPart] = bookedTimeRangeLabel.split(' - ');
    const newStartTime24 = labelTo24h(startLabelPart);
    const newEndTime24 = labelTo24h(endLabelPart);

    actionInFlightRef.current = true;
    try {
      if (appt.studentUserId) {
        // Only appointments this faculty can see are checked (RLS), so this is
        // a best-effort guard against double-booking the student.
        const { conflict, checkFailed } = await findStudentScheduleConflict(
          appt.studentUserId,
          realDateKey,
          newStartTime24,
          newEndTime24,
          appt.id
        );
        if (!checkFailed && conflict) {
          showToast('The student already has another appointment at that time.');
          return;
        }
      }

      const { error: apptError } = await supabase
        .from('appointments')
        .update({
          slot_id: data.slot.id,
          date: realDateKey,
          start_time: newStartTime24,
          end_time: newEndTime24,
          duration_minutes: data.durationMinutes,
          mode: data.slot.mode,
          location: isOnline ? data.meetingLink || data.slot.location : data.slot.location,
          meeting_link: isOnline ? data.meetingLink ?? null : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', appt.id);
      if (apptError) {
        showToast('Could not reschedule: ' + apptError.message);
        return;
      }

      await supabase.from('slot_bookings').delete().eq('appointment_id', appt.id);
      const { error: bookingRowError } = await supabase.from('slot_bookings').insert({
        slot_id: data.slot.id,
        appointment_id: appt.id,
        start_minute: startOffset,
        duration_minutes: data.durationMinutes,
      });
      if (bookingRowError) {
        showToast('Rescheduled, but capacity tracking failed to save.');
      }

      // The old queue spot belonged to the old time; it is recreated when the
      // new time's queue opens.
      await supabase.from('queue_entries').delete().eq('appointment_id', appt.id);

      setFacultyAppointments((prev) =>
        prev.map((a) =>
          a.id === appt.id
            ? {
                ...a,
                date: data.dateLabel,
                time: bookedTimeRangeLabel,
                room: isOnline ? undefined : data.slot.location,
                mode: isOnline ? 'online' : 'face-to-face',
                meetingLink: isOnline ? data.meetingLink : undefined,
                dateKey: realDateKey,
                startTime24: newStartTime24,
                endTime24: newEndTime24,
                startTimeLabel: startLabelPart,
              }
            : a
        )
      );

      if (appt.studentUserId) {
        sendNotification(appt.studentUserId, {
          icon: 'calendar-outline',
          title: 'Appointment Rescheduled',
          description: isOnline
            ? `Your appointment with ${facultyProfile.name} was rescheduled to ${data.dateLabel} at ${bookedTimeRangeLabel}. Reason: ${data.reason}. New meeting link: ${data.meetingLink}`
            : `Your appointment with ${facultyProfile.name} was rescheduled to ${data.dateLabel} at ${bookedTimeRangeLabel}. Reason: ${data.reason}.`,
        });
      }
      if (session) {
        sendNotification(session.user.id, {
          icon: 'calendar-outline',
          title: 'Appointment Rescheduled',
          description: `You rescheduled ${appt.studentName}'s appointment to ${data.dateLabel} at ${bookedTimeRangeLabel}.`,
        });
      }

      setFacultyActionResult({
        type: 'rescheduled',
        studentName: appt.studentName,
        category: appt.category,
        dateLabel: data.dateLabel,
        timeLabel: bookedTimeRangeLabel,
        location: data.slot.location,
        mode: data.slot.mode,
        reason: data.reason,
        meetingLink: isOnline ? data.meetingLink : undefined,
        referenceNo: appt.referenceNo ?? toReferenceNo(appt.id),
      });

      setFacultyActionAppointment(null);
      setScreen('facultyActionSuccess');
    } finally {
      actionInFlightRef.current = false;
    }
  };

  const handleAcceptReschedule = () => {
    setPendingReschedule(null);
    setScreen('home');
  };

  const handleRejectReschedule = () => {
    if (confirmedBooking) {
      setScheduleByDate((prev) =>
        releaseMinutes(prev, confirmedBooking.date, confirmedBooking.slot.id, confirmedBooking.bookingId)
      );
    }
    setPendingReschedule(null);
    setIsChoosingAfterReject(true);
    setBookingPreselect(null);
    setScreen('bookAppointment');
  };

  const queueFaculty = facultyDirectory.find((f) => f.id === queueFacultyId);

  const isAuthScreen =
    screen === 'login' ||
    screen === 'forgotPassword' ||
    screen === 'accountType' ||
    screen === 'studentSignUp' ||
    screen === 'facultySignUp';

  if (authLoading) {
    return (
      <View style={appStyles.loadingScreen}>
        <Text style={appStyles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <>
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
        {screen === 'login' && (
          <LoginScreen
            onSignUp={() => {
              setAuthError(null);
              setScreen('accountType');
            }}
            onForgotPassword={() => setScreen('forgotPassword')}
            errorMessage={authError}
            submitting={authSubmitting}
            onLogin={async (role, identifier, password) => {
              if (authSubmitting) return;
              // Phone keyboards love to append a trailing space to emails.
              const email = identifier.trim();
              if (!email || !password) {
                setAuthError('Enter your email and password.');
                return;
              }
              setAuthError(null);
              setAuthSubmitting(true);
              try {
                const { data, error } = await supabase.auth.signInWithPassword({
                  email,
                  password,
                });
                if (error) {
                  setAuthError(error.message);
                  showToast(error.message);
                  return;
                }
                const loadedRole = data.user ? await loadProfileForUser(data.user.id) : null;
                if (!loadedRole) {
                  // Signed in but no usable profile: stay on the login screen
                  // (loadProfileForUser already set the error) instead of
                  // opening an empty app.
                  await supabase.auth.signOut();
                  return;
                }
                setScreen(loadedRole === 'faculty' ? 'facultyHome' : 'home');
              } finally {
                setAuthSubmitting(false);
              }
            }}
          />
        )}

        {screen === 'forgotPassword' && (
          <ForgotPasswordScreen
            onBack={() => setScreen('login')}
            onBackToLogin={() => setScreen('login')}
            onSendResetLink={async (email) => {
              const { error } = await supabase.auth.resetPasswordForEmail(email);
              if (error) {
                showToast(error.message);
                return false;
              }
              return true;
            }}
          />
        )}

        {screen === 'accountType' && (
          <AccountTypeScreen
            onBack={() => setScreen('login')}
            onLogin={() => setScreen('login')}
            onSelectStudent={() => setScreen('studentSignUp')}
            onSelectFaculty={() => setScreen('facultySignUp')}
          />
        )}

        {screen === 'studentSignUp' && (
          <StudentSignUpScreen
            onBack={() => {
              setAuthError(null);
              setScreen('accountType');
            }}
            onLogin={() => {
              setAuthError(null);
              setScreen('login');
            }}
            errorMessage={authError}
            submitting={authSubmitting}
            onCreateAccount={async (data) => {
              if (authSubmitting) return;
              const validationError = validateSignUp(
                [
                  { label: 'Full name', value: data.fullName },
                  { label: 'Student ID', value: data.studentId },
                  { label: 'Email', value: data.email },
                  { label: 'Department', value: data.department },
                  { label: 'Year level', value: data.yearLevel },
                ],
                data.email,
                data.password,
                data.confirmPassword
              );
              if (validationError) {
                setAuthError(validationError);
                return;
              }
              setAuthError(null);
              setAuthSubmitting(true);
              try {
                const { data: signUpData, error } = await supabase.auth.signUp({
                  email: data.email.trim(),
                  password: data.password,
                  options: {
                    data: {
                      role: 'student',
                      full_name: data.fullName.trim(),
                      student_id: data.studentId.trim(),
                      department: data.department.trim(),
                      year_level: data.yearLevel.trim(),
                    },
                  },
                });
                if (error) {
                  setAuthError(error.message);
                  showToast(error.message);
                  return;
                }
                if (!signUpData.session) {
                  // Email confirmation is required before they're signed in.
                  showToast('Account created — check your email to confirm before logging in.');
                  setScreen('login');
                  return;
                }
                await loadProfileForUser(signUpData.user!.id);
                setScreen('home');
              } finally {
                setAuthSubmitting(false);
              }
            }}
          />
        )}

        {screen === 'facultySignUp' && (
          <FacultySignUpScreen
            onBack={() => {
              setAuthError(null);
              setScreen('accountType');
            }}
            onLogin={() => {
              setAuthError(null);
              setScreen('login');
            }}
            errorMessage={authError}
            submitting={authSubmitting}
            onCreateAccount={async (data) => {
              if (authSubmitting) return;
              const validationError = validateSignUp(
                [
                  { label: 'Full name', value: data.fullName },
                  { label: 'Faculty ID', value: data.facultyId },
                  { label: 'Email', value: data.email },
                  { label: 'Department', value: data.department },
                ],
                data.email,
                data.password,
                data.confirmPassword
              );
              if (validationError) {
                setAuthError(validationError);
                return;
              }
              setAuthError(null);
              setAuthSubmitting(true);
              try {
                const { data: signUpData, error } = await supabase.auth.signUp({
                  email: data.email.trim(),
                  password: data.password,
                  options: {
                    data: {
                      role: 'faculty',
                      full_name: data.fullName.trim(),
                      faculty_id: data.facultyId.trim(),
                      department: data.department.trim(),
                    },
                  },
                });
                if (error) {
                  setAuthError(error.message);
                  showToast(error.message);
                  return;
                }
                if (!signUpData.session) {
                  showToast('Account created — check your email to confirm before logging in.');
                  setScreen('login');
                  return;
                }
                await loadProfileForUser(signUpData.user!.id);
                setScreen('facultyHome');
              } finally {
                setAuthSubmitting(false);
              }
            }}
          />
        )}

        {screen === 'home' && (
          <HomeScreen
            userName={studentProfile.name}
            hasPendingReschedule={!!pendingReschedule}
            cancelledNotice={cancelledNotice}
            onDismissCancelledNotice={() => setCancelledNotice(null)}
            onReviewReschedule={() => setScreen('rescheduleProposal')}
            onMenuPress={() => openSideMenu('student')}
            onNotificationsPress={() => setScreen('notifications')}
            onViewAppointments={() => setScreen('appointments')}
            onViewNotifications={() => setScreen('notifications')}
            onViewQueue={() => {
              setQueueViewFacultyId(null);
              setScreen('queue');
            }}
            nextAppointment={nextStudentAppointment}
            notifications={studentNotifications}
            unreadCount={unreadNotificationCount}
            queue={queue}
            currentQueueId={currentStudentQueueId}
            now={nowTick}
            averageWaitMinutes={AVERAGE_WAIT_MINUTES_PER_STUDENT}
            showQueueCard={hasAppointmentStarted || todaysApptQueueOpen || (confirmedBooking?.dateKey === toDateKey(nowTick) && !!confirmedBooking?.bookedTimeRangeLabel && hasQueueOpened(confirmedBooking.dateKey, labelTo24h(confirmedBooking.bookedTimeRangeLabel.split('-')[0]?.trim() || '12:00 AM'), nowTick))}
            onTabChange={handleTabChange}
          />
        )}

        {screen === 'directory' && (
          <DirectoryScreen
            faculty={facultyDirectory}
            loading={facultyDirectoryLoading}
            onMenuPress={() => openSideMenu('student')}
            onSelectFaculty={(faculty) => {
              setSelectedFaculty(faculty);
              setScreen('facultyProfile');
            }}
            onTabChange={handleTabChange}
          />
        )}

        {screen === 'facultyProfile' && (
          <FacultyProfileScreen
            scheduleByDate={scheduleByDate}
            facultyName={selectedFaculty?.name}
            facultyDepartment={selectedFaculty?.department}
            facultyRole={selectedFaculty?.role}
            facultyStatus={selectedFaculty?.status}
            consultationTypes={selectedFaculty?.consultationTypes}
            loading={scheduleLoading}
            onBack={() => setScreen('directory')}
            onMorePress={() => showToast('More options coming soon')}
            onSelectSlot={(date, slot) => {
              setBookingPreselect({ date, slotId: slot.id });
              setIsChoosingAfterReject(false);
              setScreen('bookAppointment');
            }}
            onContinue={() => {
              setBookingPreselect(null);
              setIsChoosingAfterReject(false);
              setScreen('bookAppointment');
            }}
            onJoinWalkInQueue={() => {
              setQueueViewFacultyId(selectedFaculty?.id ?? null);
              setScreen('queue');
            }}
            onTabChange={handleTabChange}
          />
        )}

        {screen === 'bookAppointment' && (
          <BookAppointmentScreen
            scheduleByDate={scheduleByDate}
            studentName={studentProfile.name}
            mode="book"
            doctorName={selectedFaculty?.name ?? 'Faculty member'}
            department={selectedFaculty?.department ?? ''}
            initialDate={bookingPreselect?.date}
            initialSlotId={bookingPreselect?.slotId}
            onBack={() => setScreen(isChoosingAfterReject ? 'home' : 'facultyProfile')}
            onContinue={async (selection) => {
              if (!session || !selectedFaculty) return;

              if (!(await isFacultyAcceptingBookings(selectedFaculty.id))) {
                const unavailable = { ...selectedFaculty, status: 'unavailable' as const };
                setSelectedFaculty(unavailable);
                setFacultyDirectory((prev) =>
                  prev.map((f) => (f.id === unavailable.id ? unavailable : f))
                );
                showToast(`${selectedFaculty.name} isn't accepting consultations right now.`);
                setScreen('facultyProfile');
                return;
              }

              // Local capacity math decides WHERE in the slot this
              // booking fits (same engine as before) — only now the
              // slot itself came from a real availability_slots row.
              // Re-read the slot's bookings right now: the copy on screen may be
              // minutes old, and two students could otherwise be handed the
              // same start time.
              const freshSchedule = await fetchFacultyWeekSchedule(selectedFaculty.id);
              const { scheduleByDate: updated, startOffset } = bookMinutes(
                freshSchedule,
                selection.date,
                selection.slot.id,
                selection.durationMinutes,
                studentProfile.name
              );
              if (startOffset === null) {
                setScheduleByDate(freshSchedule);
                showToast('That slot was just taken or changed. Please pick another.');
                return;
              }

              const bookedSlot = (updated[selection.date] ?? []).find(
                (s) => s.id === selection.slot.id
              );
              const bookedTimeRangeLabel = bookedSlot
                ? getBookedTimeRangeLabel(bookedSlot, startOffset, selection.durationMinutes)
                : selection.slot.time;

              const dayInfo = WEEK_DAYS.find((d) => d.date === selection.date);
              const realDateKey = dayInfo?.dateKey ?? toDateKey(new Date());
              const [startLabelPart, endLabelPart] = bookedTimeRangeLabel.split(' - ');
              const newStartTime24 = labelTo24h(startLabelPart);
              const newEndTime24 = labelTo24h(endLabelPart);

              // Never let a student end up with two overlapping
              // appointments — whether with this same faculty member or
              // a different one.
              const { conflict, checkFailed } = await findStudentScheduleConflict(
                session.user.id,
                realDateKey,
                newStartTime24,
                newEndTime24
              );
              if (checkFailed) {
                showToast('Could not verify your schedule — please try again.');
                return;
              }
              if (conflict) {
                showToast('You already have an appointment that overlaps this time.');
                return;
              }

              const { data: insertedAppt, error: apptError } = await supabase
                .from('appointments')
                .insert({
                  student_id: session.user.id,
                  faculty_id: selectedFaculty.id,
                  slot_id: selection.slot.id,
                  date: realDateKey,
                  start_time: newStartTime24,
                  end_time: newEndTime24,
                  duration_minutes: selection.durationMinutes,
                  category: 'Consultation',
                  purpose: selection.purpose,
                  mode: selection.slot.mode,
                  location: selection.slot.location,
                })
                .select()
                .single();

              if (apptError || !insertedAppt) {
                showToast(apptError?.message ?? 'Could not book appointment.');
                return;
              }

              const { error: bookingRowError } = await supabase.from('slot_bookings').insert({
                slot_id: selection.slot.id,
                appointment_id: insertedAppt.id,
                start_minute: startOffset,
                duration_minutes: selection.durationMinutes,
              });
              if (bookingRowError) {
                showToast('Booked, but capacity tracking failed to save.');
              }

              sendNotification(selectedFaculty.id, {
                icon: 'calendar-outline',
                title: 'New Appointment',
                description: `${studentProfile.name} booked an appointment on ${dayInfo?.fullLabel ?? realDateKey} at ${bookedTimeRangeLabel}.`,
              });
              sendNotification(session.user.id, {
                icon: 'calendar-outline',
                title: 'Appointment Request Sent',
                description: `Your appointment request with ${selectedFaculty.name} was sent for ${dayInfo?.fullLabel ?? realDateKey} at ${bookedTimeRangeLabel}.`,
              });

              setScheduleByDate(updated);
              setConfirmedBooking({
                ...selection,
                slot: bookedSlot ?? selection.slot,
                bookingId: insertedAppt.id,
                bookedTimeRangeLabel,
                referenceNo: (insertedAppt as { reference_no?: string }).reference_no,
              });
              setIsChoosingAfterReject(false);
              setScreen('bookingConfirmation');
            }}
          />
        )}

        {screen === 'rescheduleAppointment' && (
          <BookAppointmentScreen
            scheduleByDate={scheduleByDate}
            studentName={studentProfile.name}
            mode="reschedule"
            doctorName={actionAppointment?.doctorName ?? selectedFaculty?.name ?? 'Faculty member'}
            department={actionAppointment?.department ?? selectedFaculty?.department ?? ''}
            onBack={() => setScreen('appointmentDetails')}
            onContinue={handleStudentReschedule}
          />
        )}

        {screen === 'bookingConfirmation' && (
          <BookingConfirmationScreen
            onBack={() => setScreen('bookAppointment')}
            onMorePress={() => showToast('More options coming soon')}
            onBookAnother={() => {
              setBookingPreselect(null);
              setScreen('bookAppointment');
            }}
            onBackToHome={() => setScreen('home')}
            doctorName={selectedFaculty?.name}
            doctorPhotoUri={selectedFaculty?.photoUri}
            department={selectedFaculty?.department ?? ''}
            consultationCategory="Consultation"
            referenceNo={confirmedBooking?.referenceNo}
            date={confirmedBooking?.dateLabel}
            bookedTimeRangeLabel={confirmedBooking?.bookedTimeRangeLabel}
            duration={confirmedBooking?.duration}
            purpose={confirmedBooking?.purpose}
            location={confirmedBooking?.slot.location}
            mode={confirmedBooking?.slot.mode}
            dateKey={confirmedBooking?.dateKey}
            startTime24={
              confirmedBooking
                ? labelTo24h(confirmedBooking.bookedTimeRangeLabel.split(' - ')[0])
                : undefined
            }
            endTime24={
              confirmedBooking
                ? labelTo24h(confirmedBooking.bookedTimeRangeLabel.split(' - ')[1])
                : undefined
            }
          />
        )}

        {screen === 'bookingCancellation' && studentBookingResult && (
          <BookingCancellationScreen
            onBack={() => setScreen('appointmentDetails')}
            onBackToHome={() => setScreen('home')}
            doctorName={studentBookingResult.doctorName}
            doctorPhotoUri={studentBookingResult.doctorPhotoUri}
            department={studentBookingResult.department}
            date={studentBookingResult.dateLabel}
            time={studentBookingResult.timeLabel}
            category={studentBookingResult.category}
            location={studentBookingResult.location}
            mode={studentBookingResult.mode}
            referenceNo={studentBookingResult.referenceNo}
          />
        )}

        {screen === 'bookingReschedule' && studentBookingResult && (
          <BookingRescheduleScreen
            onBack={() => setScreen('appointmentDetails')}
            onBackToHome={() => setScreen('home')}
            doctorName={studentBookingResult.doctorName}
            doctorPhotoUri={studentBookingResult.doctorPhotoUri}
            department={studentBookingResult.department}
            date={studentBookingResult.dateLabel}
            time={studentBookingResult.timeLabel}
            category={studentBookingResult.category}
            location={studentBookingResult.location}
            mode={studentBookingResult.mode}
            referenceNo={studentBookingResult.referenceNo}
          />
        )}

        {screen === 'appointmentDetails' && (
          <AppointmentDetailsScreen
            onBack={() => setScreen('appointments')}
            onMorePress={() => showToast('More options coming soon')}
            onReschedule={() => startStudentReschedule(selectedAppointment)}
            onCancelAppointment={() => handleStudentCancel(selectedAppointment)}
            status={selectedAppointment?.status?.toUpperCase()}
            doctorName={selectedAppointment?.doctorName}
            department={selectedAppointment?.department}
            date={selectedAppointment?.date.split(' · ')[0]}
            time={selectedAppointment?.date.split(' · ')[1]}
            category={selectedAppointment?.category}
            location={selectedAppointment?.location}
            mode={selectedAppointment?.mode}
            referenceNo={selectedAppointment?.referenceNo}
            photoUri={selectedAppointment?.facultyAvatarUrl}
            dateKey={selectedAppointment?.dateKey}
            startTime24={selectedAppointment?.startTime24}
            endTime24={selectedAppointment?.endTime24}
          />
        )}

        {screen === 'appointments' && (
          <AppointmentsScreen
            appointments={studentAppointments}
            onMenuPress={() => openSideMenu('student')}
            onSelectAppointment={(appointment) => {
              setSelectedAppointmentId(appointment.id);
              setScreen('appointmentDetails');
            }}
            onTabChange={handleTabChange}
          />
        )}

        {screen === 'notifications' && (
          <NotificationsScreen
            notifications={studentNotifications}
            onDeleteNotifications={handleDeleteStudentNotifications}
            onMenuPress={() => openSideMenu('student')}
            onMarkAllRead={handleMarkAllStudentNotificationsRead}
            onMarkAsRead={handleMarkStudentNotificationRead}
            onSelectNotification={(item) => console.log('Selected notification:', item)}
            onTabChange={handleTabChange}
          />
        )}

        {screen === 'profile' && (
          <ProfileScreen
            {...studentProfile}
            onBack={() => setScreen('home')}
            onPersonalInformation={() => goToPersonalInformation('profile')}
            onAbout={() => goToAbout('profile')}
            onLogout={handleLogout}
            onTabChange={handleTabChange}
            onChangePhoto={() => handleChangeAvatar('student')}
          />
        )}

        {screen === 'facultyHome' && (
          <FacultyHomeScreen
            facultyFirstName={(() => {
              // Keep a title the user typed ("Prof. Maria Santos"); otherwise assume "Dr.".
              const m = facultyProfile.name.trim().match(/^(dr|prof|engr|mr|ms|mrs)\.?\s+(\S+)/i);
              if (m) return `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()}. ${m[2]}`;
              const first = facultyProfile.name.trim().split(/\s+/)[0];
              return first ? `Dr. ${first}` : undefined;
            })()}
            appointmentsCount={todaysFacultyAppointments.length}
            // No feature tracks student-initiated reschedule requests yet
            // (only faculty-initiated ones exist), so this is honestly 0
            // rather than a fake placeholder.
            pendingReschedulesCount={0}
            schedule={todaysFacultySchedule}
            walkInQueueCount={queue.length}
            onMenuPress={() => openSideMenu('faculty')}
            onNotificationsPress={() => setScreen('facultyNotifications')}
            unreadCount={unreadNotificationCount}
            onViewSchedule={() => setScreen('facultyDirectory')}
            onOpenAppointments={() => setScreen('facultyDirectory')}
            onOpenPendingReschedules={() => setScreen('facultyDirectory')}
            onOpenAvailability={() => setScreen('facultyAvailability')}
            onOpenWalkInQueue={() => setScreen('queue')}
            onOpenSlotIQAI={() => console.log('Open SlotIQ AI')}
            onTabChange={handleFacultyTabChange}
          />
        )}

        {screen === 'facultyDirectory' && (
          <FacultyDirectoryScreen
            appointments={facultyAppointments}
            onSelectAppointment={(appointment) => {
              setSelectedStudent(appointment);
              setScreen('studentProfile');
            }}
            onReschedulePress={(appointment) => {
              setFacultyActionAppointment(appointment);
              setScreen('facultyRescheduleAppointment');
            }}
            onCancelPress={(appointment) => {
              setFacultyActionAppointment(appointment);
              setScreen('facultyCancelAppointment');
            }}
            onTabChange={handleFacultyTabChange}
          />
        )}

        {screen === 'studentProfile' && selectedStudent && (
          <StudentProfileScreen
            studentName={selectedStudent.studentName}
            studentId={selectedStudent.studentId}
            email={selectedStudent.email}
            department={selectedStudent.department}
            yearLevel={selectedStudent.yearLevel}
            photoUri={selectedStudent.photoUri}
            appointmentCategory={selectedStudent.category}
            appointmentDate={selectedStudent.date}
            appointmentTime={selectedStudent.time}
            appointmentMode={selectedStudent.mode}
            appointmentRoom={selectedStudent.room}
            onBack={() => setScreen('facultyDirectory')}
            onTabChange={handleFacultyTabChange}
          />
        )}

        {screen === 'facultyAvailability' && (
          <FacultyAvailabilityScreen
            slotsByDate={facultySlotsByDate}
            recurringRules={recurringRules}
            onBack={() => setScreen('facultyHome')}
            onInfoPress={() => showToast('Availability info coming soon')}
            onAddTimeSlot={handleAddTimeSlot}
            onToggleSlot={handleToggleFacultySlot}
            onDeleteTimeSlot={handleDeleteFacultySlot}
            onSetRecurringSchedule={() => setScreen('recurringSchedule')}
            onDeleteRecurringRule={handleDeleteRecurringRule}
            onSaveAvailability={() => {
              console.log('Save availability:', facultySlotsByDate);
              setScreen('facultyHome');
            }}
            onTabChange={handleFacultyTabChange}
          />
        )}

        {screen === 'addTimeSlot' && (
          <AddTimeSlotScreen
            onBack={() => setScreen('facultyAvailability')}
            onConfirm={handleConfirmNewFacultySlot}
            onTabChange={handleFacultyTabChange}
          />
        )}

        {screen === 'recurringSchedule' && (
          <RecurringScheduleScreen
            onBack={() => setScreen('facultyAvailability')}
            onConfirm={handleCreateRecurringRule}
          />
        )}

        {screen === 'facultyNotifications' && (
          <FacultyNotificationsScreen
            notifications={studentNotifications}
            onDeleteNotifications={handleDeleteStudentNotifications}
            onMarkAllRead={handleMarkAllStudentNotificationsRead}
            onMarkAsRead={handleMarkStudentNotificationRead}
            onBack={() => setScreen('facultyHome')}
            onSelectNotification={(item) => console.log('Selected notification:', item)}
            onTabChange={handleFacultyTabChange}
          />
        )}

        {screen === 'facultyProfileMenu' && (
          <FacultyProfileMenuScreen
            {...facultyProfile}
            onBack={() => setScreen('facultyHome')}
            onPersonalInformation={() => goToFacultyPersonalInformation('facultyProfileMenu')}
            onMySchedule={() => setScreen('facultySchedule')}
            onAbout={() => goToAbout('facultyProfileMenu')}
            onLogout={handleLogout}
            onTabChange={handleFacultyTabChange}
            onChangePhoto={() => handleChangeAvatar('faculty')}
          />
        )}

        {screen === 'facultySchedule' && (
          <FacultyScheduleCalendarScreen
            slotsByDate={facultySlotsByDate}
            onBack={() => setScreen('facultyProfileMenu')}
            onTabChange={handleFacultyTabChange}
          />
        )}

        {screen === 'personalInformation' && (
          <PersonalInformationScreen
            {...studentProfile}
            onBack={() => setScreen(previousScreen)}
            // Persists to Supabase (this used to only update local state and
            // log the password change to the console). Throws on failure so
            // the form stays open with the error toast.
            onSave={async (data, passwordChange) => {
              try {
                const { emailChangePending } = await applyAccountChanges(
                  data.name,
                  data.email,
                  studentProfile.email,
                  passwordChange
                );
                const department = data.department.trim();
                const yearLevel = data.yearLevel.trim();
                const { error: studentError } = await supabase
                  .from('students')
                  .update({ department, year_level: yearLevel })
                  .eq('profile_id', session!.user.id);
                if (studentError) throw new Error(studentError.message);

                setStudentProfile((prev) => ({
                  ...prev,
                  name: data.name.trim(),
                  department,
                  yearLevel,
                  role: yearLevel ? `${yearLevel} Student` : 'Student',
                  email: emailChangePending ? prev.email : data.email.trim(),
                }));
                showToast(
                  emailChangePending
                    ? 'Saved. Confirm the link sent to your new email to change it.'
                    : passwordChange
                    ? 'Password updated'
                    : 'Profile saved'
                );
                setScreen(previousScreen);
              } catch (err) {
                showToast(err instanceof Error ? err.message : 'Could not save your changes.');
                throw err;
              }
            }}
          />
        )}

        {screen === 'facultyPersonalInformation' && (
          <FacultyPersonalInformationScreen
            {...facultyProfile}
            onBack={() => setScreen(previousScreen)}
            onSave={async (data, passwordChange) => {
              try {
                const { emailChangePending } = await applyAccountChanges(
                  data.name,
                  data.email,
                  facultyProfile.email,
                  passwordChange
                );
                const department = data.fullDepartment.trim();
                const { error: facultyError } = await supabase
                  .from('faculty')
                  .update({ department, consultation_types: data.consultationTypes })
                  .eq('profile_id', session!.user.id);
                if (facultyError) throw new Error(facultyError.message);

                setFacultyProfile((prev) => ({
                  ...prev,
                  name: data.name.trim(),
                  department,
                  fullDepartment: department,
                  consultationTypes: data.consultationTypes,
                  email: emailChangePending ? prev.email : data.email.trim(),
                }));
                showToast(
                  emailChangePending
                    ? 'Saved. Confirm the link sent to your new email to change it.'
                    : passwordChange
                    ? 'Password updated'
                    : 'Profile saved'
                );
                setScreen(previousScreen);
              } catch (err) {
                showToast(err instanceof Error ? err.message : 'Could not save your changes.');
                throw err;
              }
            }}
          />
        )}

        {screen === 'about' && <AboutScreen onBack={() => setScreen(previousScreen)} />}

        {screen === 'settings' && (
          <SettingsScreen
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled((prev) => !prev)}
            onBack={() => setScreen(previousScreen)}
          />
        )}

        {screen === 'queue' && (
          <QueueScreen
            queue={queue}
            currentQueueId={currentStudentQueueId}
            hasAppointment={!!(todaysStudentAppointment ?? nextStudentAppointment)}
            role={userRole}
            // For a student this is the faculty whose queue is on screen, not
            // the (empty) faculty profile of the signed-in student.
            doctorName={
              userRole === 'faculty'
                ? facultyProfile.name
                : queueFaculty?.name ?? todaysStudentAppointment?.doctorName
            }
            doctorDepartment={
              userRole === 'faculty'
                ? facultyProfile.department
                : queueFaculty?.department ?? todaysStudentAppointment?.department
            }
            appointmentMode={todaysStudentAppointment?.mode}
            appointmentLocation={todaysStudentAppointment?.location}
            now={nowTick}
            onBack={() => {
              setQueueViewFacultyId(null);
              setScreen(userRole === 'faculty' ? 'facultyHome' : 'home');
            }}
            onReschedule={() => startStudentReschedule(todaysStudentAppointment ?? nextStudentAppointment)}
            onCancelAppointment={() => handleStudentCancel(todaysStudentAppointment ?? nextStudentAppointment)}
            onCompleteCurrent={handleCompleteCurrentQueue}
            onTabChange={handleTabChange}
            onFacultyTabChange={handleFacultyTabChange}
          />
        )}

        {screen === 'facultyRescheduleAppointment' && facultyActionAppointment && (
          <FacultyRescheduleAppointmentScreen
            scheduleByDate={facultyOwnSchedule}
            studentName={facultyActionAppointment.studentName}
            studentPhotoUri={facultyActionAppointment.photoUri}
            category={facultyActionAppointment.category}
            originalDateLabel={facultyActionAppointment.date}
            originalTime={facultyActionAppointment.time}
            originalLocation={directoryLocationLabel(facultyActionAppointment)}
            originalMode={directoryModeLabel(facultyActionAppointment)}
            durationMinutes={
              facultyActionAppointment.startTime24 && facultyActionAppointment.endTime24
                ? minutesBetween(
                    facultyActionAppointment.startTime24,
                    facultyActionAppointment.endTime24
                  )
                : 30
            }
            onBack={() => {
              setFacultyActionAppointment(null);
              setScreen('facultyDirectory');
            }}
            onConfirm={handleFacultyReschedule}
          />
        )}

        {screen === 'rescheduleProposal' && pendingReschedule && (
          <RescheduleProposalScreen
            reason={pendingReschedule.reason}
            originalDateLabel={pendingReschedule.originalDateLabel}
            originalTime={pendingReschedule.originalTime}
            originalLocation={pendingReschedule.originalLocation}
            proposedDateLabel={pendingReschedule.proposedDateLabel}
            proposedTime={pendingReschedule.proposedTime}
            proposedLocation={pendingReschedule.proposedLocation}
            proposedMode={pendingReschedule.proposedMode}
            onBack={() => setScreen('home')}
            onAccept={handleAcceptReschedule}
            onChooseAnother={handleRejectReschedule}
          />
        )}

        {screen === 'facultyCancelAppointment' && facultyActionAppointment && (
          <FacultyCancelAppointmentScreen
            studentName={facultyActionAppointment.studentName}
            dateLabel={facultyActionAppointment.date}
            bookedTimeRangeLabel={facultyActionAppointment.time}
            location={directoryLocationLabel(facultyActionAppointment)}
            mode={directoryModeLabel(facultyActionAppointment)}
            onBack={() => {
              setFacultyActionAppointment(null);
              setScreen('facultyDirectory');
            }}
            onConfirmCancel={handleFacultyCancel}
          />
        )}

        {screen === 'facultyActionSuccess' && facultyActionResult && (
          <FacultyActionSuccessScreen
            type={facultyActionResult.type}
            studentName={facultyActionResult.studentName}
            category={facultyActionResult.category}
            dateLabel={facultyActionResult.dateLabel}
            timeLabel={facultyActionResult.timeLabel}
            location={facultyActionResult.location}
            mode={facultyActionResult.mode}
            reason={facultyActionResult.reason}
            meetingLink={facultyActionResult.meetingLink}
            referenceNo={facultyActionResult.referenceNo}
            onBackToDirectory={() => {
              setFacultyActionResult(null);
              setScreen('facultyDirectory');
            }}
          />
        )}
      </Animated.View>

      <SideMenu
        visible={sideMenuOpen}
        role={userRole}
        userName={userRole === 'faculty' ? facultyProfile.name : studentProfile.name}
        activeKey={sideMenuActiveKey}
        // Real unread count — the same notifications state now backs
        // both the student and faculty Notifications screens.
        notificationCount={unreadNotificationCount}
        // Same photo shown on the Profile screen — updates immediately
        // after handleChangeAvatar saves a new one to Supabase.
        photoUri={userRole === 'faculty' ? facultyProfile.photoUri : studentProfile.photoUri}
        onClose={() => setSideMenuOpen(false)}
        onNavigate={handleSideMenuNavigate}
        onLogout={handleSideMenuLogout}
      />

      <StatusBar style={isAuthScreen ? 'light' : 'dark'} />

      {toastMessage && (
        <View style={appStyles.toastWrap} pointerEvents="none">
          <View style={appStyles.toastPill}>
            <Text style={appStyles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}
    </>
  );
}

const appStyles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  toastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 100,
    alignItems: 'center',
  },
  toastPill: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: 20,
    maxWidth: '85%',
  },
  toastText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

// All @expo/vector-icons font families used anywhere in this app. Loading
// them together, once, at startup — instead of letting each screen lazily
// trigger its own font fetch the first time it renders — means a flaky
// connection to the Metro dev server produces one clear, recoverable error
// instead of random missing icons scattered across different screens as
// you navigate (that's what "ExpoAsset.downloadAsync ... Feather.ttf" then
// later "... MaterialCommunityIcons.ttf" was: two separate lazy font
// fetches, each failing independently).
const ICON_FONTS = {
  ...Ionicons.font,
  ...Feather.font,
  ...FontAwesome.font,
  ...FontAwesome5.font,
  ...MaterialCommunityIcons.font,
};

function useIconFonts() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(() => {
    setStatus('loading');
    Font.loadAsync(ICON_FONTS)
      .then(() => setStatus('ready'))
      .catch((err) => {
        // This is almost always a network problem between your device and
        // the Metro dev server (different Wi-Fi, VPN, firewall, or LAN
        // asset requests being blocked) rather than a bug in the app —
        // see the retry screen below for what to try.
        console.warn('[fonts] failed to load icon fonts:', err);
        setStatus('error');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { status, retry: load, forceReady: () => setStatus('ready') };
}

export default function App() {
  const { status, retry, forceReady } = useIconFonts();

  if (status === 'loading') {
    return (
      <View style={loadingStyles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={loadingStyles.container}>
        <Text style={loadingStyles.title}>Couldn't load app icons</Text>
        <Text style={loadingStyles.subtitle}>
          Your phone couldn't reach the dev server to download some assets.
          This is a network issue, not a bug in the app — try running{' '}
          <Text style={loadingStyles.code}>npx expo start --tunnel</Text>{' '}
          instead of the default LAN mode, or make sure your phone and
          computer are on the same Wi-Fi.
        </Text>
        <TouchableOpacity style={loadingStyles.retryButton} onPress={retry} activeOpacity={0.85}>
          <Text style={loadingStyles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={forceReady} activeOpacity={0.6}>
          <Text style={loadingStyles.continueText}>Continue without icons</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 19,
  },
  code: {
    fontFamily: 'monospace',
    fontWeight: '700',
    color: colors.textDark,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  retryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  continueText: {
    color: colors.textMuted,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});