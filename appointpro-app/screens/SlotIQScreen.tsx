import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import FacultyBottomTabBar, { FacultyTabKey } from '../components/FacultyBottomTabBar';
import ClassTimePicker, {
  TimeBox,
  emptyTimeBox,
  isTimeBoxComplete,
  isTimeBoxEmpty,
  timeBoxToText,
} from '../components/ClassTimePicker';
import {
  SlotIQOptions,
  SlotIQResult,
  SlotIQSuggestion,
  computeFreeBlocks,
  findOverlapError,
  generateSlotIQSchedule,
  parseTimeBox,
  parseWindowInput,
  rangeLengthMinutes,
} from '../lib/slotiq';
import { toDateKey } from '../data/facultySlots';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// A day starts with no classes; "Add class" adds a class time, up to this limit.
const MAX_BOXES_PER_DAY = 6;
// Show the week Monday -> Sunday.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatTime(time: string): string {
  const [hText, mText] = time.split(':');
  const h = Number(hText);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${mText} ${period}`;
}

function parseDateInput(value: string): string | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const d = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(d.getTime()) || toDateKey(d) !== trimmed) return null;
  return trimmed;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2027-02-28" -> "Feb 28, 2027"
function formatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

const shortDay = (day: number) => DAY_NAMES[day].slice(0, 3);
const timeRangeText = (range: { startTime: string; endTime: string }) =>
  `${formatTime(range.startTime)} - ${formatTime(range.endTime)}`;

const DURATION_CHOICES = ['15', '30', '45', '60'];
const SEMESTER_CHOICES = [3, 4, 5, 6];

// ---- Small static building blocks (no animation: Pressable only changes colour while pressed) ----
type ButtonProps = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
};

function Button({ label, icon, onPress, variant = 'primary', disabled }: ButtonProps) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        pressed && (primary ? styles.buttonPrimaryPressed : styles.buttonSecondaryPressed),
        disabled && styles.buttonDisabled,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={primary ? colors.white : colors.primary} /> : null}
      <Text style={[styles.buttonText, primary ? styles.buttonTextPrimary : styles.buttonTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

type BadgeTone = 'neutral' | 'success' | 'warning';
function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: BadgeTone; icon?: keyof typeof Ionicons.glyphMap }) {
  const toneStyle = tone === 'success' ? styles.badgeSuccess : tone === 'warning' ? styles.badgeWarning : styles.badgeNeutral;
  const textStyle = tone === 'success' ? styles.badgeTextSuccess : tone === 'warning' ? styles.badgeTextWarning : styles.badgeTextNeutral;
  const iconColor = tone === 'success' ? colors.success : tone === 'warning' ? colors.danger : colors.textMuted;
  return (
    <View style={[styles.badge, toneStyle]}>
      {icon ? <Ionicons name={icon} size={12} color={iconColor} /> : null}
      <Text style={[styles.badgeText, textStyle]}>{label}</Text>
    </View>
  );
}

function SectionHeader({ step, title, helper }: { step: string; title: string; helper: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>{step}</Text>
      </View>
      <View style={styles.sectionHeaderText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionHelper}>{helper}</Text>
      </View>
    </View>
  );
}

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

type Props = {
  onBack?: () => void;
  onApprove?: (suggestions: SlotIQSuggestion[], semesterEndDate: string) => Promise<void>;
  onTabChange?: (tab: FacultyTabKey) => void;
};

export default function SlotIQScreen({ onBack, onApprove, onTabChange }: Props) {
  const [semesterEndDate, setSemesterEndDate] = useState(toDateKey(addMonths(new Date(), 4)));
  const [duration, setDuration] = useState('30');
  const [minSlotsPerDay, setMinSlotsPerDay] = useState('2');
  const [maxSlotsPerDay, setMaxSlotsPerDay] = useState('4');
  const [mode, setMode] = useState<'Face-to-Face' | 'Online'>('Face-to-Face');
  const [location, setLocation] = useState('');
  // Class times per day (busy time). Each entry is one class time picked with hour / minute / AM-PM dropdowns.
  const [dayInputs, setDayInputs] = useState<Record<number, TimeBox[]>>({});
  // Days consultations may be held on; default Monday-Friday.
  const [availableDays, setAvailableDays] = useState<number[]>([1, 2, 3, 4, 5]);
  // Consultations are only suggested inside this daily window (picked with dropdowns, 8:00 AM - 5:00 PM by default).
  const [windowBox, setWindowBox] = useState<TimeBox>({
    startHour: '8',
    startMinute: '00',
    startPeriod: 'AM',
    endHour: '5',
    endMinute: '00',
    endPeriod: 'PM',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SlotIQResult | null>(null);
  // One step per screen so nothing needs scrolling past something else.
  const [tab, setTab] = useState<'classes' | 'prefs' | 'results'>('classes');
  // The checked end date the current result was generated for (the text box may be edited afterwards).
  const [generatedEndDate, setGeneratedEndDate] = useState<string | null>(null);
  // Set when the faculty taps Generate; the confirm dialog reads from it.
  const [pendingOptions, setPendingOptions] = useState<SlotIQOptions | null>(null);

  const parsedWindow = useMemo(
    () =>
      isTimeBoxComplete(windowBox)
        ? parseWindowInput(timeBoxToText(windowBox))
        : { range: null, error: 'Choose the hour, minute and AM/PM for both start and end.' },
    [windowBox],
  );

  const parsedDays = useMemo(
    () =>
      DAY_ORDER.map((day) => {
        const boxes = (dayInputs[day] ?? []).map((timeBox) =>
          // Half-picked times (e.g. hour chosen but no AM/PM yet) are flagged until every dropdown is set.
          !isTimeBoxEmpty(timeBox) && !isTimeBoxComplete(timeBox)
            ? { range: null, error: 'Pick the hour, minute and AM/PM for both start and end.' }
            : parseTimeBox(timeBoxToText(timeBox)),
        );
        const ranges = boxes
          .flatMap((box) => (box.range ? [box.range] : []))
          .sort((x, y) => x.startTime.localeCompare(y.startTime));
        const error = boxes.find((box) => box.error)?.error ?? findOverlapError(ranges);
        const available = availableDays.includes(day);
        // Free time = consultation window minus the classes typed for the day.
        const free = available && parsedWindow.range && !error ? computeFreeBlocks(parsedWindow.range, ranges) : [];
        return { day, available, boxes, ranges, error, free };
      }),
    [dayInputs, availableDays, parsedWindow],
  );

  const setBox = (day: number, index: number, value: TimeBox) => {
    setDayInputs((prev) => {
      const boxes = [...(prev[day] ?? [])];
      boxes[index] = value;
      return { ...prev, [day]: boxes };
    });
  };

  const addBox = (day: number) => {
    setDayInputs((prev) => {
      const boxes = prev[day] ?? [];
      if (boxes.length >= MAX_BOXES_PER_DAY) return prev;
      return { ...prev, [day]: [...boxes, emptyTimeBox()] };
    });
  };

  const removeBox = (day: number, index: number) => {
    setDayInputs((prev) => {
      const boxes = (prev[day] ?? []).filter((_, i) => i !== index);
      return { ...prev, [day]: boxes };
    });
  };

  const toggleDay = (day: number, enabled: boolean) => {
    setAvailableDays((prev) => (enabled ? [...new Set([...prev, day])] : prev.filter((d) => d !== day)));
  };

  // Step 1: validate everything, then ask "Continue?" before calling the AI.
  const requestGenerate = () => {
    // Computed now (not when the screen opened) so it stays right if the app was left open overnight.
    const today = toDateKey(new Date());
    const end = parseDateInput(semesterEndDate);
    const minutes = Number(duration);
    const minPerDay = Number(minSlotsPerDay);
    const maxPerDay = Number(maxSlotsPerDay);

    if (parsedWindow.error || !parsedWindow.range) {
      Alert.alert('Check consultation hours', parsedWindow.error ?? 'Enter hours like 8am-5pm.');
      return;
    }
    const windowRange = parsedWindow.range;

    const activeDays = parsedDays.filter((item) => item.available);
    if (!activeDays.length) {
      Alert.alert('Choose consultation days', 'Turn on at least one day for consultations.');
      return;
    }

    const badDay = activeDays.find((item) => item.error);
    if (badDay) {
      Alert.alert(`Check ${DAY_NAMES[badDay.day]}`, badDay.error ?? 'Could not read this day.');
      return;
    }

    const classSchedule = activeDays.flatMap((item) =>
      item.ranges.map((range) => ({ dayOfWeek: item.day, startTime: range.startTime, endTime: range.endTime })),
    );
    if (!end || end < today) {
      Alert.alert('Invalid semester date', 'Use YYYY-MM-DD and choose a date on or after today.');
      return;
    }
    // Schedules are created day by day for at most a year; longer would be cut off partway.
    const latest = new Date();
    latest.setDate(latest.getDate() + 365);
    if (end > toDateKey(latest)) {
      Alert.alert('Semester too long', 'Choose a semester end date within one year from today.');
      return;
    }
    if (!Number.isInteger(minutes) || minutes < 15 || minutes > 180) {
      Alert.alert('Invalid duration', 'Consultation duration must be between 15 and 180 minutes.');
      return;
    }
    if (!Number.isInteger(minPerDay) || minPerDay < 1 || minPerDay > 12) {
      Alert.alert('Invalid minimum', 'The minimum suggestions per day must be a whole number from 1 to 12.');
      return;
    }
    if (!Number.isInteger(maxPerDay) || maxPerDay < 1 || maxPerDay > 12) {
      Alert.alert('Invalid maximum', 'The maximum suggestions per day must be a whole number from 1 to 12.');
      return;
    }
    if (minPerDay > maxPerDay) {
      Alert.alert('Check your limits', 'The minimum suggestions per day cannot be higher than the maximum.');
      return;
    }
    if (!location.trim()) {
      Alert.alert('Location required', mode === 'Online' ? 'Enter the meeting platform or link.' : 'Enter the consultation room/location.');
      return;
    }

    const hasRoom = activeDays.some((item) => item.free.some((range) => rangeLengthMinutes(range) >= minutes));
    if (!hasRoom) {
      Alert.alert(
        'No free time',
        `Your classes leave no free gap of ${minutes} minutes between ${formatTime(windowRange.startTime)} and ${formatTime(windowRange.endTime)}. Try a shorter duration, wider hours, or more days.`,
      );
      return;
    }

    setPendingOptions({
      semesterEndDate: end,
      consultationDurationMinutes: minutes,
      preferredMode: mode,
      preferredLocation: location.trim(),
      minSlotsPerDay: minPerDay,
      maxSlotsPerDay: maxPerDay,
      classSchedule,
      availableDays: activeDays.map((item) => item.day),
      windowStart: windowRange.startTime,
      windowEnd: windowRange.endTime,
    });
  };

  // Step 2: the faculty tapped "Continue" in the dialog.
  const confirmGenerate = async () => {
    const options = pendingOptions;
    if (!options) return;
    setPendingOptions(null);

    try {
      setLoading(true);
      setResult(null);
      setGeneratedEndDate(null);
      const generated = await generateSlotIQSchedule(options);
      setResult(generated);
      setGeneratedEndDate(options.semesterEndDate);
      setTab('results');
    } catch (error) {
      Alert.alert('SlotIQ error', error instanceof Error ? error.message : 'Could not generate a schedule.');
    } finally {
      setLoading(false);
    }
  };

  const approve = async () => {
    if (!result?.suggestions.length || !onApprove || !generatedEndDate) return;
    try {
      setSaving(true);
      await onApprove(result.suggestions, generatedEndDate);
    } catch (error) {
      Alert.alert('Could not save schedule', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Simple, static checklist shown above the Generate button. requestGenerate() below still does the real validation.
  const activeDayItems = parsedDays.filter((item) => item.available);
  const issues: string[] = [];
  if (parsedWindow.error) issues.push('Set your consultation hours.');
  if (!activeDayItems.length) issues.push('Turn on at least one consultation day.');
  const daysWithErrors = activeDayItems.filter((item) => item.error).map((item) => DAY_NAMES[item.day]);
  if (daysWithErrors.length) issues.push(`Fix the class times on ${daysWithErrors.join(', ')}.`);
  if (!parseDateInput(semesterEndDate)) issues.push('Enter a valid semester end date.');
  if (!location.trim()) issues.push(mode === 'Online' ? 'Enter the meeting platform or link.' : 'Enter the consultation location.');
  const classCount = activeDayItems.reduce((total, item) => total + item.ranges.length, 0);
  const endDateLabel = parseDateInput(semesterEndDate) ? formatDateLabel(semesterEndDate.trim()) : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colors.textDark} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <View style={styles.titleRow}>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
            <Text style={styles.headerTitle}>SlotIQ</Text>
          </View>
          <Text style={styles.headerSubtitle}>AI-assisted schedule generation</Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      {/* ---------- Tabs: one step per screen ---------- */}
      <View style={styles.tabBar} accessibilityRole="tablist">
        {([
          { key: 'classes', label: 'Classes', step: '1' },
          { key: 'prefs', label: 'Preferences', step: '2' },
          { key: 'results', label: 'Results', step: '3' },
        ] as const).map((item) => {
          const active = tab === item.key;
          const disabled = item.key === 'results' && !result;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              disabled={disabled}
              style={[styles.tabButton, active && styles.tabButtonActive, disabled && styles.tabButtonDisabled]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active, disabled }}
              accessibilityLabel={`Step ${item.step}: ${item.label}`}
            >
              <View style={[styles.tabStep, active && styles.tabStepActive]}>
                <Text style={[styles.tabStepText, active && styles.tabStepTextActive]}>{item.step}</Text>
              </View>
              <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView key={tab} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {tab === 'classes' && (
          <>
        {/* ---------- Step 1: classes ---------- */}
        <Text style={styles.tabHelper}>
          Add the classes you teach on each day. SlotIQ never suggests a consultation during a class. Turn a day off if you don't hold consultations on it.
        </Text>

        {parsedDays.map((item) => (
          <View key={item.day} style={[styles.card, styles.dayCard, !item.available && styles.dayCardOff]}>
            <View style={styles.dayHeader}>
              <View style={styles.dayHeaderText}>
                <Text style={styles.dayName}>{DAY_NAMES[item.day]}</Text>
                <View style={styles.badgeRow}>
                  {!item.available ? (
                    <Badge label="Day off" />
                  ) : (
                    <Badge
                      label={item.ranges.length === 0 ? 'No classes' : `${item.ranges.length} ${item.ranges.length === 1 ? 'class' : 'classes'}`}
                      icon="school-outline"
                    />
                  )}
                </View>
              </View>
              <View style={styles.dayToggle}>
                <Text style={styles.dayToggleText}>{item.available ? 'Open' : 'Closed'}</Text>
                <Switch
                  value={item.available}
                  onValueChange={(value) => toggleDay(item.day, value)}
                  trackColor={{ true: colors.primary }}
                  accessibilityLabel={`Hold consultations on ${DAY_NAMES[item.day]}`}
                />
              </View>
            </View>

            {item.available && (
              <>
                {item.boxes.map((box, boxIndex) => (
                  <View key={boxIndex} style={styles.classBox}>
                    <View style={styles.classBoxHeader}>
                      <Text style={styles.classBoxTitle}>Class {boxIndex + 1}</Text>
                      <Pressable
                        onPress={() => removeBox(item.day, boxIndex)}
                        style={styles.removeButton}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove class ${boxIndex + 1}`}
                      >
                        <Ionicons name="trash-outline" size={15} color={colors.danger} />
                        <Text style={styles.removeText}>Remove</Text>
                      </Pressable>
                    </View>
                    <ClassTimePicker
                      value={(dayInputs[item.day] ?? [])[boxIndex] ?? emptyTimeBox()}
                      onChange={(value) => setBox(item.day, boxIndex, value)}
                      hasError={!!box.error}
                    />
                    {box.error ? <Text style={styles.errorText}>{box.error}</Text> : null}
                  </View>
                ))}

                {item.boxes.length < MAX_BOXES_PER_DAY && (
                  <Button
                    label={item.boxes.length === 0 ? 'Add a class' : 'Add another class'}
                    icon="add"
                    variant="secondary"
                    onPress={() => addBox(item.day)}
                  />
                )}

                {item.error && !item.boxes.some((box) => box.error) ? <Text style={styles.errorText}>{item.error}</Text> : null}

                {!item.error && parsedWindow.range && (
                  <View style={styles.freeRow}>
                    <Text style={styles.freeLabel}>Free for consultations</Text>
                    {item.free.length > 0 ? (
                      <View style={styles.badgeRow}>
                        {item.free.map((range) => (
                          <Badge key={`${range.startTime}-${range.endTime}`} label={timeRangeText(range)} tone="success" icon="time-outline" />
                        ))}
                      </View>
                    ) : (
                      <Badge label="No free time inside your hours" tone="warning" icon="alert-circle-outline" />
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        ))}

          </>
        )}

        {tab === 'prefs' && (
          <>
        {/* ---------- Step 2: preferences ---------- */}
        <Text style={styles.tabHelper}>Tell SlotIQ when, how long and where you hold consultations.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>When</Text>
          <Field label="Consultation hours" helper="SlotIQ only suggests times between these hours.">
            <ClassTimePicker value={windowBox} onChange={setWindowBox} hasError={!!parsedWindow.error} />
            {parsedWindow.error ? <Text style={styles.errorText}>{parsedWindow.error}</Text> : null}
          </Field>

          <Field
            label="Semester end date"
            helper={endDateLabel ? `Schedule runs until ${endDateLabel}.` : 'Use the format YYYY-MM-DD, for example 2027-02-28.'}
          >
            <TextInput
              value={semesterEndDate}
              onChangeText={setSemesterEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, !endDateLabel && styles.inputError]}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Semester end date"
            />
            <View style={styles.chipRow}>
              {SEMESTER_CHOICES.map((months) => {
                const value = toDateKey(addMonths(new Date(), months));
                const active = semesterEndDate.trim() === value;
                return (
                  <Pressable
                    key={months}
                    onPress={() => setSemesterEndDate(value)}
                    style={[styles.chip, active && styles.chipActive]}
                    accessibilityRole="button"
                    accessibilityLabel={`End in ${months} months`}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{months} months</Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>How long</Text>
          <Field label="Consultation length" helper="Between 15 and 180 minutes.">
            <TextInput
              value={duration}
              onChangeText={setDuration}
              placeholder="e.g. 30"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              style={styles.input}
              accessibilityLabel="Consultation length in minutes"
            />
            <View style={styles.chipRow}>
              {DURATION_CHOICES.map((value) => {
                const active = duration === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setDuration(value)}
                    style={[styles.chip, active && styles.chipActive]}
                    accessibilityRole="button"
                    accessibilityLabel={`${value} minutes`}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{value} min</Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label="Suggestions per day" helper="SlotIQ aims for this range, as far as your free time allows.">
            <View style={styles.limitRow}>
              <View style={styles.limitCol}>
                <Text style={styles.limitLabel}>At least</Text>
                <TextInput
                  value={minSlotsPerDay}
                  onChangeText={setMinSlotsPerDay}
                  placeholder="e.g. 2"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  style={styles.input}
                  accessibilityLabel="Minimum suggestions per day"
                />
              </View>
              <View style={styles.limitCol}>
                <Text style={styles.limitLabel}>At most</Text>
                <TextInput
                  value={maxSlotsPerDay}
                  onChangeText={setMaxSlotsPerDay}
                  placeholder="e.g. 4"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  style={styles.input}
                  accessibilityLabel="Maximum suggestions per day"
                />
              </View>
            </View>
          </Field>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Where</Text>
          <Field label="Consultation mode">
            <View style={styles.choiceRow}>
              {(['Face-to-Face', 'Online'] as const).map((item) => {
                const active = mode === item;
                return (
                  <Pressable
                    key={item}
                    style={[styles.choice, active && styles.choiceActive]}
                    onPress={() => setMode(item)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons
                      name={item === 'Online' ? 'videocam-outline' : 'people-outline'}
                      size={18}
                      color={active ? colors.primary : colors.textMuted}
                    />
                    <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label={mode === 'Online' ? 'Meeting platform or link' : 'Consultation location'}>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder={mode === 'Online' ? 'e.g. Google Meet' : 'e.g. Faculty Office 204'}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoCapitalize="none"
              accessibilityLabel={mode === 'Online' ? 'Meeting platform or link' : 'Consultation location'}
            />
          </Field>
        </View>

        {/* ---------- Generate ---------- */}
        {issues.length > 0 ? (
          <View style={[styles.statusCard, styles.statusWarning]}>
            <View style={styles.statusHeader}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={[styles.statusTitle, { color: colors.danger }]}>Before you generate</Text>
            </View>
            {issues.map((issue) => (
              <Text key={issue} style={styles.statusItem}>
                • {issue}
              </Text>
            ))}
          </View>
        ) : (
          <View style={[styles.statusCard, styles.statusReady]}>
            <View style={styles.statusHeader}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
              <Text style={[styles.statusTitle, { color: colors.success }]}>Ready to generate</Text>
            </View>
            <Text style={styles.statusItem}>
              {activeDayItems.length} consultation {activeDayItems.length === 1 ? 'day' : 'days'} · {classCount} {classCount === 1 ? 'class' : 'classes'} blocked
              {endDateLabel ? ` · until ${endDateLabel}` : ''}
            </Text>
          </View>
        )}

          </>
        )}

        {tab === 'results' && result && (
          <>
        {/* ---------- Step 3: results ---------- */}
        {result && (
          <View style={styles.resultsSection}>

            <View style={styles.summaryCard}>
              <Ionicons name="bulb-outline" size={18} color={colors.primary} />
              <Text style={styles.summaryText}>{result.summary}</Text>
            </View>

            {result.suggestions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="calendar-clear-outline" size={30} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No compatible schedule found</Text>
                <Text style={styles.emptyText}>Try a shorter consultation length, wider consultation hours, or more consultation days.</Text>
              </View>
            ) : (
              result.suggestions.map((suggestion, index) => (
                <View key={`${suggestion.startTime}-${suggestion.endTime}-${index}`} style={[styles.card, styles.suggestionCard]}>
                  <View style={styles.suggestionTopRow}>
                    <View style={styles.numberCircle}>
                      <Text style={styles.numberText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.suggestionTime}>{timeRangeText(suggestion)}</Text>
                  </View>
                  <View style={styles.badgeRow}>
                    {suggestion.daysOfWeek.map((day) => (
                      <Badge key={day} label={shortDay(day)} icon="calendar-outline" />
                    ))}
                    <Badge
                      label={`${suggestion.mode} · ${suggestion.location}`}
                      icon={suggestion.mode === 'Online' ? 'videocam-outline' : 'location-outline'}
                    />
                  </View>
                  <Text style={styles.reason}>{suggestion.reason}</Text>
                </View>
              ))
            )}

          </View>
        )}
          </>
        )}
      </ScrollView>

      {/* ---------- Fixed footer: the one action for this step ---------- */}
      <View style={styles.footer}>
        {tab === 'classes' && (
          <Button label="Next: Preferences" icon="arrow-forward" onPress={() => setTab('prefs')} />
        )}
        {tab === 'prefs' && (
          <View style={styles.footerRow}>
            <View style={styles.footerSide}>
              <Button label="Back" variant="secondary" onPress={() => setTab('classes')} />
            </View>
            <View style={styles.footerMain}>
              <Button
                label={loading ? 'Generating… please wait' : 'Generate with SlotIQ'}
                icon={loading ? undefined : 'sparkles'}
                onPress={requestGenerate}
                disabled={loading}
              />
            </View>
          </View>
        )}
        {tab === 'results' && (
          <View style={styles.footerRow}>
            <View style={styles.footerSide}>
              <Button label="Redo" variant="secondary" onPress={() => setTab('prefs')} disabled={loading || saving} />
            </View>
            <View style={styles.footerMain}>
              {result && result.suggestions.length > 0 ? (
                <Button
                  label={saving ? 'Saving…' : 'Approve and save schedule'}
                  icon={saving ? undefined : 'checkmark-circle-outline'}
                  onPress={approve}
                  disabled={saving}
                />
              ) : (
                <Button label="Change preferences" onPress={() => setTab('prefs')} />
              )}
            </View>
          </View>
        )}
      </View>

      <Modal visible={!!pendingOptions} transparent animationType="none" onRequestClose={() => setPendingOptions(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons name="sparkles" size={22} color={colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Generate this schedule?</Text>
            <Text style={styles.modalText}>SlotIQ will plan around these classes. You can review the result before anything is saved.</Text>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {parsedDays
                .filter((item) => item.available)
                .map((item) => (
                  <View key={item.day} style={styles.modalRow}>
                    <Text style={styles.modalDay}>{DAY_NAMES[item.day]}</Text>
                    <Text style={styles.modalTimes}>
                      {item.ranges.length > 0 ? item.ranges.map(timeRangeText).join('\n') : 'No classes'}
                    </Text>
                  </View>
                ))}
            </ScrollView>

            {pendingOptions && (
              <View style={styles.modalMetaBox}>
                <Text style={styles.modalMeta}>
                  {pendingOptions.consultationDurationMinutes}-minute slots · {pendingOptions.minSlotsPerDay}-{pendingOptions.maxSlotsPerDay} per day
                </Text>
                <Text style={styles.modalMeta}>
                  {pendingOptions.preferredMode} · {pendingOptions.preferredLocation}
                </Text>
                <Text style={styles.modalMeta}>
                  Hours: {formatTime(pendingOptions.windowStart)} - {formatTime(pendingOptions.windowEnd)}
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <View style={styles.modalButtonCol}>
                <Button label="Cancel" variant="secondary" onPress={() => setPendingOptions(null)} />
              </View>
              <View style={styles.modalButtonCol}>
                <Button label="Generate" onPress={confirmGenerate} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <FacultyBottomTabBar active="profile" onChange={onTabChange} />
    </SafeAreaView>
  );
}

// One set of sizes used everywhere: 16 padding, 14 card radius, 10 control radius.
const CARD_RADIUS = 14;
const CONTROL_RADIUS = 10;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerButton: { width: 36, height: 36, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.textDark },
  headerSubtitle: { marginTop: 2, fontSize: 12, color: colors.textMuted },
  content: { padding: spacing.md, paddingBottom: spacing.lg, gap: 12 },
  tabHelper: { fontSize: 13, lineHeight: 18, color: colors.textMuted },

  // Step tabs
  tabBar: { flexDirection: 'row', gap: 6, padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.white },
  tabButton: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: CONTROL_RADIUS, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  tabButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabButtonDisabled: { backgroundColor: colors.background, opacity: 0.6 },
  tabStep: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.border },
  tabStepActive: { backgroundColor: colors.white },
  tabStepText: { fontSize: 12, fontWeight: '800', color: colors.textDark },
  tabStepTextActive: { color: colors.primary },
  tabText: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  tabTextActive: { color: colors.white },

  // Fixed footer
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.white },
  footerRow: { flexDirection: 'row', gap: 10 },
  footerSide: { flex: 1 },
  footerMain: { flex: 2.2 },

  // Cards
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: CARD_RADIUS, padding: spacing.md, backgroundColor: colors.white },
  cardTitle: { fontSize: 13, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },

  // Overview
  overviewTitle: { fontSize: 18, fontWeight: '800', color: colors.textDark },
  overviewText: { marginTop: 4, fontSize: 13, lineHeight: 19, color: colors.textMuted },
  overviewSteps: { flexDirection: 'row', gap: 8, marginTop: 14 },
  overviewStep: { flex: 1, alignItems: 'center', gap: 6, padding: 10, borderRadius: CONTROL_RADIUS, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  overviewIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.infoBg },
  overviewStepText: { fontSize: 12, fontWeight: '700', color: colors.textDark, textAlign: 'center' },

  // Section headers
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 8 },
  stepBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  stepBadgeText: { fontSize: 13, fontWeight: '800', color: colors.white },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.textDark },
  sectionHelper: { marginTop: 2, fontSize: 13, lineHeight: 18, color: colors.textMuted },

  // Day cards
  dayCard: { gap: 10 },
  dayCardOff: { backgroundColor: colors.background },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayHeaderText: { flex: 1, gap: 6 },
  dayName: { fontSize: 16, fontWeight: '800', color: colors.textDark },
  dayToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayToggleText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  classBox: { padding: 12, borderRadius: CONTROL_RADIUS, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, gap: 8 },
  classBoxHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  classBoxTitle: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  removeButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  removeText: { fontSize: 12, fontWeight: '700', color: colors.danger },
  freeRow: { gap: 6 },
  freeLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted },

  // Badges
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  badgeNeutral: { backgroundColor: colors.background, borderColor: colors.border },
  badgeSuccess: { backgroundColor: '#E6F4EA', borderColor: '#B7DFC1' },
  badgeWarning: { backgroundColor: '#FDECEA', borderColor: '#F5B7B1' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextNeutral: { color: colors.textDark },
  badgeTextSuccess: { color: '#14632B' },
  badgeTextWarning: { color: '#A3261B' },

  // Fields
  field: { marginTop: 12 },
  label: { fontSize: 14, fontWeight: '700', color: colors.textDark, marginBottom: 6 },
  helper: { fontSize: 12, lineHeight: 17, color: colors.textMuted, marginTop: 6 },
  input: { height: 46, borderWidth: 1, borderColor: colors.border, borderRadius: CONTROL_RADIUS, paddingHorizontal: 12, fontSize: 14, color: colors.textDark, backgroundColor: colors.white },
  inputError: { borderColor: colors.danger },
  errorText: { fontSize: 12, lineHeight: 17, color: colors.danger, marginTop: 4 },
  limitRow: { flexDirection: 'row', gap: 12 },
  limitCol: { flex: 1 },
  limitLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  chipTextActive: { color: colors.primary },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: CONTROL_RADIUS, paddingVertical: 12, backgroundColor: colors.white },
  choiceActive: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  choiceText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  choiceTextActive: { color: colors.primary },

  // Buttons: primary = filled, secondary = outlined
  button: { height: 48, borderRadius: CONTROL_RADIUS, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonPrimaryPressed: { backgroundColor: colors.primaryDark },
  buttonSecondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.primary },
  buttonSecondaryPressed: { backgroundColor: colors.infoBg },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { fontSize: 15, fontWeight: '800' },
  buttonTextPrimary: { color: colors.white },
  buttonTextSecondary: { color: colors.primary },

  // Status card above Generate
  statusCard: { borderWidth: 1, borderRadius: CARD_RADIUS, padding: spacing.md, gap: 4 },
  statusWarning: { backgroundColor: '#FDECEA', borderColor: '#F5B7B1' },
  statusReady: { backgroundColor: '#E6F4EA', borderColor: '#B7DFC1' },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusTitle: { fontSize: 14, fontWeight: '800' },
  statusItem: { fontSize: 13, lineHeight: 19, color: colors.textDark },

  // Results
  resultsSection: { gap: 12, marginTop: 12 },
  summaryCard: { flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: CARD_RADIUS, padding: spacing.md, backgroundColor: colors.background },
  summaryText: { flex: 1, color: colors.textDark, fontSize: 13, lineHeight: 19 },
  suggestionCard: { gap: 10 },
  suggestionTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numberCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.infoBg, alignItems: 'center', justifyContent: 'center' },
  numberText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  suggestionTime: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.textDark },
  reason: { fontSize: 13, lineHeight: 19, color: colors.textMuted },
  resultActions: { gap: 10 },
  emptyCard: { borderWidth: 1, borderColor: colors.border, borderRadius: CARD_RADIUS, padding: 24, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.textDark },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 13, lineHeight: 19 },

  // Confirm dialog
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: colors.white, borderRadius: 18, padding: spacing.md },
  modalIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.infoBg, alignSelf: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textDark, textAlign: 'center' },
  modalText: { marginTop: 6, fontSize: 13, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
  modalList: { maxHeight: 200, marginTop: 14, borderWidth: 1, borderColor: colors.border, borderRadius: CONTROL_RADIUS, paddingHorizontal: 12 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalDay: { fontSize: 13, fontWeight: '800', color: colors.textDark },
  modalTimes: { fontSize: 13, color: colors.textMuted, textAlign: 'right' },
  modalMetaBox: { marginTop: 12, padding: 12, borderRadius: CONTROL_RADIUS, backgroundColor: colors.background, gap: 2 },
  modalMeta: { fontSize: 13, lineHeight: 19, color: colors.textDark, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalButtonCol: { flex: 1 },
});