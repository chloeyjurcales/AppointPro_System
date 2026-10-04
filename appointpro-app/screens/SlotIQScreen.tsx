import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
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
// Each day starts with one class-time box; the + button adds more up to this limit.
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

function dayLabel(days: number[]): string {
  return days.map((day) => DAY_NAMES[day]).join(', ');
}

type Props = {
  onBack?: () => void;
  onApprove?: (suggestions: SlotIQSuggestion[], semesterEndDate: string) => Promise<void>;
  onTabChange?: (tab: FacultyTabKey) => void;
};

export default function SlotIQScreen({ onBack, onApprove, onTabChange }: Props) {
  const today = useMemo(() => toDateKey(new Date()), []);
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
  // Consultations are only suggested inside this daily window.
  const [windowInput, setWindowInput] = useState('8am-5pm');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SlotIQResult | null>(null);
  // Set when the faculty taps Generate; the confirm dialog reads from it.
  const [pendingOptions, setPendingOptions] = useState<SlotIQOptions | null>(null);

  const parsedWindow = useMemo(() => parseWindowInput(windowInput), [windowInput]);

  const parsedDays = useMemo(
    () =>
      DAY_ORDER.map((day) => {
        const boxes = (dayInputs[day] ?? [emptyTimeBox()]).map((timeBox) =>
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
      const boxes = [...(prev[day] ?? [emptyTimeBox()])];
      boxes[index] = value;
      return { ...prev, [day]: boxes };
    });
  };

  const addBox = (day: number) => {
    setDayInputs((prev) => {
      const boxes = prev[day] ?? [emptyTimeBox()];
      if (boxes.length >= MAX_BOXES_PER_DAY) return prev;
      return { ...prev, [day]: [...boxes, emptyTimeBox()] };
    });
  };

  const removeBox = (day: number, index: number) => {
    setDayInputs((prev) => {
      const boxes = (prev[day] ?? [emptyTimeBox()]).filter((_, i) => i !== index);
      return { ...prev, [day]: boxes.length ? boxes : [emptyTimeBox()] };
    });
  };

  const toggleDay = (day: number, enabled: boolean) => {
    setAvailableDays((prev) => (enabled ? [...new Set([...prev, day])] : prev.filter((d) => d !== day)));
  };

  // Step 1: validate everything, then ask "Continue?" before calling the AI.
  const requestGenerate = () => {
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
    if (!classSchedule.length) {
      Alert.alert('Add your classes', 'Enter the times you teach on at least one day, for example 7-9am.');
      return;
    }

    if (!end || end < today) {
      Alert.alert('Invalid semester date', 'Use YYYY-MM-DD and choose a date on or after today.');
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
      const generated = await generateSlotIQSchedule(options);
      setResult(generated);
    } catch (error) {
      Alert.alert('SlotIQ error', error instanceof Error ? error.message : 'Could not generate a schedule.');
    } finally {
      setLoading(false);
    }
  };

  const approve = async () => {
    if (!result?.suggestions.length || !onApprove) return;
    try {
      setSaving(true);
      await onApprove(result.suggestions, semesterEndDate);
    } catch (error) {
      Alert.alert('Could not save schedule', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={22} color={colors.textDark} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <View style={styles.titleRow}>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
            <Text style={styles.headerTitle}>SlotIQ</Text>
          </View>
          <Text style={styles.headerSubtitle}>AI-assisted schedule generation</Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="sparkles-outline" size={25} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Generate your consultation schedule</Text>
          <Text style={styles.heroText}>
            Tell SlotIQ when you teach each day. It keeps those class times blocked, checks your existing appointments, then asks Gemini to suggest recurring consultation times in the gaps.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Your class schedule</Text>
        <View style={styles.summaryCard}>
          <Ionicons name="chatbubble-ellipses-outline" size={19} color={colors.primary} />
          <Text style={styles.summaryText}>
            What are your classes this semester? For each day, choose the start and end of each class from the hour, minute and AM/PM dropdowns (on a computer, use the Up and Down arrow keys to move through the choices). Tap + to add another class time on the same day. Leave the dropdowns empty if you have no classes. SlotIQ will never suggest a consultation during these times. Turn a day off if you don't hold consultations on it.
          </Text>
        </View>

        <View style={styles.card}>
          {parsedDays.map((item, index) => (
            <View key={item.day} style={index === 0 ? undefined : styles.dayDivider}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayName}>{DAY_NAMES[item.day]}</Text>
                <View style={styles.dayToggle}>
                  <Text style={styles.dayToggleText}>{item.available ? 'Consultations on' : 'Day off'}</Text>
                  <Switch
                    value={item.available}
                    onValueChange={(value) => toggleDay(item.day, value)}
                    trackColor={{ true: colors.primary }}
                  />
                </View>
              </View>
              {item.available && (
                <>
                  {item.boxes.map((box, boxIndex) => (
                    <View key={boxIndex}>
                      <View style={styles.boxRow}>
                        <ClassTimePicker
                          value={(dayInputs[item.day] ?? [emptyTimeBox()])[boxIndex] ?? emptyTimeBox()}
                          onChange={(value) => setBox(item.day, boxIndex, value)}
                          hasError={!!box.error}
                        />
                        {item.boxes.length > 1 && (
                          <TouchableOpacity
                            onPress={() => removeBox(item.day, boxIndex)}
                            style={styles.removeButton}
                            accessibilityLabel="Remove this class time"
                          >
                            <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                          </TouchableOpacity>
                        )}
                      </View>
                      {box.error ? <Text style={styles.errorText}>{box.error}</Text> : null}
                    </View>
                  ))}
                  {item.boxes.length < MAX_BOXES_PER_DAY && (
                    <TouchableOpacity style={styles.addBoxButton} onPress={() => addBox(item.day)}>
                      <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                      <Text style={styles.addBoxText}>Add another class time</Text>
                    </TouchableOpacity>
                  )}
                  {item.error ? (
                    item.boxes.some((box) => box.error) ? null : <Text style={styles.errorText}>{item.error}</Text>
                  ) : (
                    <>
                      <Text style={styles.classText}>
                        {item.ranges.length > 0
                          ? `Classes: ${item.ranges.map((range) => `${formatTime(range.startTime)} - ${formatTime(range.endTime)}`).join('  ·  ')}`
                          : 'No classes entered, so you are free all day.'}
                      </Text>
                      {parsedWindow.range &&
                        (item.free.length > 0 ? (
                          <Text style={styles.previewText}>
                            Free for consultations: {item.free.map((range) => `${formatTime(range.startTime)} - ${formatTime(range.endTime)}`).join('  ·  ')}
                          </Text>
                        ) : (
                          <Text style={styles.classText}>No free time left inside your consultation hours.</Text>
                        ))}
                    </>
                  )}
                </>
              )}
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, styles.settingsTitle]}>Schedule settings</Text>
        <View style={styles.card}>
          <Text style={[styles.label, styles.firstLabel]}>Consultation hours (earliest - latest)</Text>
          <TextInput
            value={windowInput}
            onChangeText={setWindowInput}
            placeholder="e.g. 8am-5pm"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, !!parsedWindow.error && styles.inputError]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {parsedWindow.error ? (
            <Text style={styles.errorText}>{parsedWindow.error}</Text>
          ) : (
            <Text style={styles.hint}>SlotIQ only suggests times inside these hours, around your classes.</Text>
          )}

          <Text style={styles.label}>Semester end date</Text>
          <TextInput
            value={semesterEndDate}
            onChangeText={setSemesterEndDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="none"
          />
          <Text style={styles.hint}>Example: 2027-02-28</Text>

          <Text style={styles.label}>Consultation duration (minutes)</Text>
          <TextInput
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
            style={styles.input}
          />

          <Text style={styles.label}>Suggested slots per day</Text>
          <View style={styles.limitRow}>
            <View style={styles.limitCol}>
              <Text style={styles.limitLabel}>Minimum</Text>
              <TextInput
                value={minSlotsPerDay}
                onChangeText={setMinSlotsPerDay}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.limitCol}>
              <Text style={styles.limitLabel}>Maximum</Text>
              <TextInput
                value={maxSlotsPerDay}
                onChangeText={setMaxSlotsPerDay}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
          </View>
          <Text style={styles.hint}>SlotIQ aims for this many suggestions on each day, as far as your free time allows.</Text>

          <Text style={styles.label}>Consultation mode</Text>
          <View style={styles.choiceRow}>
            {(['Face-to-Face', 'Online'] as const).map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.choice, mode === item && styles.choiceActive]}
                onPress={() => setMode(item)}
              >
                <Text style={[styles.choiceText, mode === item && styles.choiceTextActive]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>{mode === 'Online' ? 'Meeting platform/link' : 'Consultation location'}</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder={mode === 'Online' ? 'e.g. Google Meet' : 'e.g. Faculty Office 204'}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity style={styles.generateButton} onPress={requestGenerate} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Ionicons name="sparkles" size={17} color={colors.white} />}
          <Text style={styles.generateButtonText}>{loading ? 'Generating...' : 'Generate with SlotIQ'}</Text>
        </TouchableOpacity>

        {result && (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>Suggested schedule</Text>
            <View style={styles.summaryCard}>
              <Ionicons name="bulb-outline" size={19} color={colors.primary} />
              <Text style={styles.summaryText}>{result.summary}</Text>
            </View>

            {result.suggestions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="calendar-clear-outline" size={30} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No compatible schedule found</Text>
                <Text style={styles.emptyText}>Try a shorter consultation duration, wider consultation hours, or more consultation days.</Text>
              </View>
            ) : (
              result.suggestions.map((suggestion, index) => (
                <View key={`${suggestion.startTime}-${suggestion.endTime}-${index}`} style={styles.suggestionCard}>
                  <View style={styles.suggestionTopRow}>
                    <View style={styles.numberCircle}><Text style={styles.numberText}>{index + 1}</Text></View>
                    <View style={styles.suggestionMain}>
                      <Text style={styles.suggestionDays}>{dayLabel(suggestion.daysOfWeek)}</Text>
                      <Text style={styles.suggestionTime}>{formatTime(suggestion.startTime)} - {formatTime(suggestion.endTime)}</Text>
                    </View>
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name={suggestion.mode === 'Online' ? 'wifi-outline' : 'location-outline'} size={14} color={colors.textMuted} />
                    <Text style={styles.metaText}>{suggestion.mode} · {suggestion.location}</Text>
                  </View>
                  <Text style={styles.reason}>{suggestion.reason}</Text>
                </View>
              ))
            )}

            {!!result.suggestions.length && (
              <TouchableOpacity style={styles.approveButton} onPress={approve} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.white} /> : <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />}
                <Text style={styles.approveButtonText}>{saving ? 'Saving...' : 'Approve & Save Schedule'}</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.disclaimer}>
              SlotIQ suggestions are reviewed by you before they become part of your AppointPro availability.
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={!!pendingOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingOptions(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons name="sparkles" size={22} color={colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Continue generating the schedule?</Text>
            <Text style={styles.modalText}>
              SlotIQ will build consultation times around the classes below. You can review it before anything is saved.
            </Text>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {parsedDays
                .filter((item) => item.available)
                .map((item) => (
                  <View key={item.day} style={styles.modalRow}>
                    <Text style={styles.modalDay}>{DAY_NAMES[item.day]}</Text>
                    <Text style={styles.modalTimes}>
                      {item.ranges.length > 0
                        ? item.ranges.map((range) => `${formatTime(range.startTime)} - ${formatTime(range.endTime)}`).join('\n')
                        : 'No classes'}
                    </Text>
                  </View>
                ))}
            </ScrollView>

            {pendingOptions && (
              <Text style={styles.modalMeta}>
                {pendingOptions.consultationDurationMinutes}-min slots · {pendingOptions.minSlotsPerDay}-{pendingOptions.maxSlotsPerDay} suggestions per day · {pendingOptions.preferredMode} ({pendingOptions.preferredLocation}){'\n'}Consultation hours: {formatTime(pendingOptions.windowStart)} - {formatTime(pendingOptions.windowEnd)}
              </Text>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.modalCancel]} onPress={() => setPendingOptions(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalContinue]} onPress={confirmGenerate}>
                <Text style={styles.modalContinueText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <FacultyBottomTabBar active="profile" onChange={onTabChange} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerButton: { width: 30, alignItems: 'flex-start' },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 19, fontWeight: '800', color: colors.textDark },
  headerSubtitle: { marginTop: 2, fontSize: 11, color: colors.textMuted },
  content: { padding: spacing.lg, paddingBottom: 100 },
  heroCard: { padding: spacing.lg, borderRadius: 18, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  heroIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, marginBottom: 12 },
  heroTitle: { fontSize: 20, fontWeight: '800', color: colors.textDark },
  heroText: { marginTop: 8, fontSize: 13, lineHeight: 20, color: colors.textMuted },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.textDark, marginBottom: 10 },
  settingsTitle: { marginTop: spacing.lg },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.lg, backgroundColor: colors.white },
  label: { fontSize: 12, fontWeight: '700', color: colors.textDark, marginTop: 13, marginBottom: 7 },
  firstLabel: { marginTop: 0 },
  dayDivider: { marginTop: 2 },
  limitRow: { flexDirection: 'row', gap: 12 },
  limitCol: { flex: 1 },
  limitLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  input: { height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, color: colors.textDark, backgroundColor: colors.white },
  inputError: { borderColor: colors.danger },
  errorText: { marginTop: 5, fontSize: 11, color: colors.danger },
  previewText: { marginTop: 3, fontSize: 11, color: colors.success, fontWeight: '600' },
  boxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  removeButton: { width: 28, height: 44, alignItems: 'center', justifyContent: 'center' },
  addBoxButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'flex-start', paddingVertical: 4 },
  addBoxText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  classText: { marginTop: 5, fontSize: 11, color: colors.textMuted },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 6 },
  dayName: { fontSize: 12, fontWeight: '700', color: colors.textDark },
  dayToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayToggleText: { fontSize: 11, color: colors.textMuted },
  hint: { fontSize: 10, color: colors.textMuted, marginTop: 5 },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  choiceActive: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  choiceText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  choiceTextActive: { color: colors.primary },
  generateButton: { marginTop: 20, height: 46, borderRadius: 12, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  generateButtonText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  resultsSection: { marginTop: spacing.xl },
  summaryCard: { flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, marginBottom: 10, backgroundColor: colors.background },
  summaryText: { flex: 1, color: colors.textDark, fontSize: 12, lineHeight: 18 },
  suggestionCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, marginBottom: 10 },
  suggestionTopRow: { flexDirection: 'row', alignItems: 'center' },
  numberCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.infoBg, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  numberText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  suggestionMain: { flex: 1 },
  suggestionDays: { fontSize: 13, fontWeight: '800', color: colors.textDark },
  suggestionTime: { marginTop: 3, fontSize: 12, color: colors.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 5 },
  metaText: { fontSize: 11, color: colors.textMuted, flex: 1 },
  reason: { marginTop: 9, fontSize: 11, lineHeight: 17, color: colors.textDark },
  approveButton: { height: 46, borderRadius: 12, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 },
  approveButtonText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  emptyCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 24, alignItems: 'center' },
  emptyTitle: { marginTop: 8, fontWeight: '800', color: colors.textDark },
  emptyText: { marginTop: 4, textAlign: 'center', color: colors.textMuted, fontSize: 12 },
  disclaimer: { textAlign: 'center', color: colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: colors.white, borderRadius: 18, padding: spacing.lg },
  modalIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.infoBg, alignSelf: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.textDark, textAlign: 'center' },
  modalText: { marginTop: 8, fontSize: 12, lineHeight: 18, color: colors.textMuted, textAlign: 'center' },
  modalList: { maxHeight: 220, marginTop: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalDay: { fontSize: 12, fontWeight: '800', color: colors.textDark },
  modalTimes: { fontSize: 12, color: colors.textMuted, textAlign: 'right' },
  modalMeta: { marginTop: 12, fontSize: 11, lineHeight: 16, color: colors.textMuted, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalButton: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalCancel: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  modalCancelText: { fontSize: 13, fontWeight: '800', color: colors.textDark },
  modalContinue: { backgroundColor: colors.primary },
  modalContinueText: { fontSize: 13, fontWeight: '800', color: colors.white },
});