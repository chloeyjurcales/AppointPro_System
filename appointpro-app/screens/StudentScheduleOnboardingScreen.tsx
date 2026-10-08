import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import ClassTimePicker, { TimeBox, emptyTimeBox, isTimeBoxComplete } from '../components/ClassTimePicker';
import {
  ClassBlock,
  DAY_NAMES,
  DAY_ORDER,
  NewClassBlock,
  formatTime12,
  shortDayName,
  sortClassBlocks,
  to24h,
  toMinutes,
} from '../lib/classSchedule';

const BORDER = '#E2E8F0';
const SURFACE = '#F8FAFC';

type Props = {
  /** 'onboarding' = mandatory step after sign-up; 'edit' = changing it later from Profile. */
  mode?: 'onboarding' | 'edit';
  loading?: boolean;
  initialClasses?: ClassBlock[];
  /** Start with "No classes scheduled" already confirmed (edit mode, saved with no classes). */
  initialNoClasses?: boolean;
  onSave: (classes: NewClassBlock[], noClasses: boolean) => Promise<void>;
  onBack?: () => void;
  onLogout?: () => void;
};

type BadgeTone = 'neutral' | 'success' | 'warning';

function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: BadgeTone; icon?: keyof typeof Ionicons.glyphMap }) {
  const palette =
    tone === 'success'
      ? { bg: '#E6F4EA', border: '#B7DFC1', text: '#14632B' }
      : tone === 'warning'
      ? { bg: '#FDECEA', border: '#F5B7B1', text: '#A3261B' }
      : { bg: '#F1F5F9', border: BORDER, text: '#334155' };
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      {icon ? <Ionicons name={icon} size={12} color={palette.text} /> : null}
      <Text style={[styles.badgeText, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

function CardTitle({ icon, title, helper }: { icon: keyof typeof Ionicons.glyphMap; title: string; helper?: string }) {
  return (
    <View style={styles.cardTitleRow}>
      <View style={styles.cardTitleIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.cardTitleText}>
        <Text style={styles.cardTitle}>{title}</Text>
        {helper ? <Text style={styles.cardHelper}>{helper}</Text> : null}
      </View>
    </View>
  );
}

export default function StudentScheduleOnboardingScreen({
  mode = 'onboarding',
  loading = false,
  initialClasses = [],
  initialNoClasses = false,
  onSave,
  onBack,
  onLogout,
}: Props) {
  const isOnboarding = mode === 'onboarding';

  const [classes, setClasses] = useState<ClassBlock[]>(initialClasses);
  const [noClasses, setNoClasses] = useState(initialNoClasses);
  const [day, setDay] = useState<number | null>(null);
  const [timeBox, setTimeBox] = useState<TimeBox>(emptyTimeBox());
  const [subject, setSubject] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  // Two separate views so nothing needs scrolling past the other: add a class, or review the list.
  const [tab, setTab] = useState<'add' | 'list'>('add');
  // Confirmation line shown after a class is added (cleared on the next action).
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const nextId = useRef(0);

  // The saved schedule is loaded after this screen opens, so copy it in once it arrives.
  useEffect(() => {
    if (loading) return;
    setClasses(initialClasses);
    setNoClasses(initialNoClasses);
    // Coming back to edit an existing schedule? Start on the list.
    setTab(initialClasses.length > 0 || initialNoClasses ? 'list' : 'add');
  }, [loading]);

  const sorted = useMemo(() => sortClassBlocks(classes), [classes]);
  const daysWithClasses = new Set(classes.map((block) => block.dayOfWeek)).size;
  const canSave = !saving && (classes.length > 0 || noClasses);

  const addClass = () => {
    setSaveError(null);
    if (day === null) {
      setFormError('Choose the day of the week.');
      return;
    }
    if (!isTimeBoxComplete(timeBox)) {
      setFormError('Choose the hour, minute and AM/PM for both the start and end time.');
      return;
    }
    const startTime = to24h(timeBox.startHour, timeBox.startMinute, timeBox.startPeriod);
    const endTime = to24h(timeBox.endHour, timeBox.endMinute, timeBox.endPeriod);
    if (toMinutes(endTime) <= toMinutes(startTime)) {
      setFormError('The end time must be later than the start time.');
      return;
    }
    const name = subject.trim();
    if (!name) {
      setFormError('Enter the subject code or name, for example IT 101.');
      return;
    }
    const overlap = classes.find(
      (block) =>
        block.dayOfWeek === day && toMinutes(startTime) < toMinutes(block.endTime) && toMinutes(block.startTime) < toMinutes(endTime),
    );
    if (overlap) {
      setFormError(
        `This overlaps ${overlap.subject} on ${DAY_NAMES[overlap.dayOfWeek]} (${formatTime12(overlap.startTime)} - ${formatTime12(overlap.endTime)}).`,
      );
      return;
    }

    const summary = `${name} · ${DAY_NAMES[day]} ${formatTime12(startTime)} - ${formatTime12(endTime)}`;
    Alert.alert('Add this class?', `${summary}\n\nAre you sure you want to add this to your class schedule?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, Add',
        onPress: () => {
          nextId.current += 1;
          setClasses((prev) => [...prev, { id: `new-${nextId.current}`, dayOfWeek: day, startTime, endTime, subject: name }]);
          setLastAdded(`${name} · ${shortDayName(day)} ${formatTime12(startTime)} - ${formatTime12(endTime)}`);
          setTimeBox(emptyTimeBox());
          setSubject('');
          setFormError(null);
        },
      },
    ]);
  };

  // Anything the student would lose by leaving now: edits to the saved list, or a half-filled class form.
  const signature = (list: ClassBlock[]) =>
    sortClassBlocks(list)
      .map((b) => `${b.dayOfWeek}|${b.startTime}|${b.endTime}|${b.subject}`)
      .join(';');
  const hasUnsavedChanges =
    signature(classes) !== signature(initialClasses) ||
    noClasses !== initialNoClasses ||
    subject.trim().length > 0 ||
    day !== null;

  const handleBack = () => {
    if (saving) return true;
    if (!hasUnsavedChanges) {
      onBack?.();
      return true;
    }
    Alert.alert('Leave without saving?', 'Any changes you made to your class schedule will not be saved.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Yes, Leave', style: 'destructive', onPress: () => onBack?.() },
    ]);
    return true;
  };

  // Android's hardware/gesture back button gets the same confirmation (edit mode only).
  const handleBackRef = useRef(handleBack);
  handleBackRef.current = handleBack;
  useEffect(() => {
    if (isOnboarding) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => handleBackRef.current());
    return () => sub.remove();
  }, [isOnboarding]);

  const switchTab = (next: 'add' | 'list') => {
    setTab(next);
    setLastAdded(null);
    setFormError(null);
  };

  const removeClass = (id: string) => {
    setClasses((prev) => prev.filter((block) => block.id !== id));
    setSaveError(null);
    setLastAdded(null);
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(
        noClasses ? [] : sorted.map(({ dayOfWeek, startTime, endTime, subject: name }) => ({ dayOfWeek, startTime, endTime, subject: name })),
        noClasses,
      );
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save your class schedule. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleNoClasses = () => {
    if (classes.length > 0) return;
    setNoClasses((value) => !value);
    setFormError(null);
    setSaveError(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        {isOnboarding ? (
          <View style={styles.headerSide} />
        ) : (
          <Pressable onPress={handleBack} style={styles.headerSide} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={22} color={colors.textDark} />
          </Pressable>
        )}
        <Text style={styles.headerTitle}>{isOnboarding ? 'Class Schedule Setup' : 'My Class Schedule'}</Text>
        {isOnboarding && onLogout ? (
          <Pressable onPress={onLogout} style={[styles.headerSide, styles.headerSideRight]} accessibilityRole="button" accessibilityLabel="Log out">
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSide} />
        )}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading your class schedule…</Text>
        </View>
      ) : (
        <>
          {/* ---- Fixed top: steps, banner, view switch ---- */}
          <View style={styles.topArea}>
            {isOnboarding && (
              <View style={styles.stepRow}>
                <View style={[styles.stepPill, styles.stepPillDone]}>
                  <Ionicons name="checkmark-circle" size={14} color="#14632B" />
                  <Text style={[styles.stepText, { color: '#14632B' }]}>1. Account created</Text>
                </View>
                <View style={[styles.stepPill, styles.stepPillCurrent]}>
                  <Text style={[styles.stepText, { color: colors.white }]}>2. Class schedule</Text>
                </View>
              </View>
            )}

            <View style={styles.banner}>
              <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.bannerText}>
                Your class schedule prevents faculty members from rescheduling appointments during your class hours.
              </Text>
            </View>

            <View style={styles.segment} accessibilityRole="tablist">
              <Pressable
                onPress={() => switchTab('add')}
                style={[styles.segmentButton, tab === 'add' && styles.segmentButtonActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === 'add' }}
                accessibilityLabel="Add a class"
              >
                <Ionicons name="add-circle-outline" size={18} color={tab === 'add' ? colors.white : colors.textMuted} />
                <Text style={[styles.segmentText, tab === 'add' && styles.segmentTextActive]}>Add a class</Text>
              </Pressable>
              <Pressable
                onPress={() => switchTab('list')}
                style={[styles.segmentButton, tab === 'list' && styles.segmentButtonActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === 'list' }}
                accessibilityLabel={`Weekly classes, ${classes.length} added`}
              >
                <Ionicons name="calendar-outline" size={18} color={tab === 'list' ? colors.white : colors.textMuted} />
                <Text style={[styles.segmentText, tab === 'list' && styles.segmentTextActive]}>Weekly classes</Text>
                <View style={[styles.countBadge, tab === 'list' && styles.countBadgeActive]}>
                  <Text style={[styles.countBadgeText, tab === 'list' && styles.countBadgeTextActive]}>
                    {noClasses ? '0' : classes.length}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {tab === 'add' ? (
              <>
                {lastAdded ? (
                  <View style={styles.successBox}>
                    <Ionicons name="checkmark-circle" size={18} color="#14632B" />
                    <View style={styles.successTextWrap}>
                      <Text style={styles.successTitle}>Class added</Text>
                      <Text style={styles.successText}>{lastAdded}</Text>
                    </View>
                  </View>
                ) : null}

                {noClasses ? (
                  <View style={styles.card}>
                    <CardTitle
                      icon="moon-outline"
                      title="No classes confirmed"
                      helper="You confirmed that you have no classes. To add classes, change this in Weekly classes."
                    />
                    <Pressable onPress={() => switchTab('list')} style={styles.secondaryButton} accessibilityRole="button" accessibilityLabel="Go to weekly classes">
                      <Text style={styles.secondaryButtonText}>Go to Weekly classes</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.card}>
                    <CardTitle icon="add-circle-outline" title="Add a class" helper="Add each class you attend every week. You can add several on the same day." />

                    <Text style={styles.label}>Day of the week</Text>
                    <View style={styles.dayRow}>
                      {DAY_ORDER.map((value) => {
                        const active = day === value;
                        return (
                          <Pressable
                            key={value}
                            onPress={() => setDay(value)}
                            style={[styles.dayChip, active && styles.dayChipActive]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={DAY_NAMES[value]}
                          >
                            <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{shortDayName(value)}</Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <Text style={styles.label}>Class time</Text>
                    <ClassTimePicker value={timeBox} onChange={setTimeBox} hasError={!!formError && !isTimeBoxComplete(timeBox)} />

                    <Text style={styles.label}>Subject code or name</Text>
                    <TextInput
                      value={subject}
                      onChangeText={setSubject}
                      placeholder="e.g. IT 101 or Programming 1"
                      placeholderTextColor={colors.textMuted}
                      style={styles.input}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      accessibilityLabel="Subject code or name"
                    />

                    {formError ? (
                      <View style={styles.errorBox}>
                        <Ionicons name="alert-circle-outline" size={16} color="#A3261B" />
                        <Text style={styles.errorText}>{formError}</Text>
                      </View>
                    ) : null}

                    <Pressable onPress={addClass} style={styles.addButton} accessibilityRole="button" accessibilityLabel="Add class to schedule">
                      <Ionicons name="add" size={18} color={colors.white} />
                      <Text style={styles.addButtonText}>Add class</Text>
                    </Pressable>
                  </View>
                )}

                {!noClasses && (
                  <Pressable onPress={() => switchTab('list')} style={styles.linkRow} accessibilityRole="button" accessibilityLabel="View weekly classes">
                    <Text style={styles.linkRowText}>
                      {classes.length === 0 ? 'No classes this semester? Confirm it in Weekly classes.' : `View your ${classes.length} added ${classes.length === 1 ? 'class' : 'classes'}`}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                  </Pressable>
                )}
              </>
            ) : (
              <>
                <View style={styles.card}>
                  <CardTitle icon="calendar-outline" title="Your weekly classes" />
                  <View style={styles.badgeRow}>
                    {noClasses ? (
                      <Badge label="No classes scheduled (confirmed)" tone="success" icon="checkmark-circle-outline" />
                    ) : classes.length === 0 ? (
                      <Badge label="No classes added yet" tone="warning" icon="alert-circle-outline" />
                    ) : (
                      <>
                        <Badge label={`${classes.length} ${classes.length === 1 ? 'class' : 'classes'}`} icon="school-outline" />
                        <Badge label={`${daysWithClasses} ${daysWithClasses === 1 ? 'day' : 'days'}`} icon="calendar-outline" />
                      </>
                    )}
                  </View>

                  {!noClasses && sorted.length > 0 && (
                    <View style={styles.table}>
                      <View style={[styles.tableRow, styles.tableHead]}>
                        <Text style={[styles.headCell, styles.colDay]}>Day</Text>
                        <Text style={[styles.headCell, styles.colTime]}>Time</Text>
                        <Text style={[styles.headCell, styles.colSubject]}>Subject</Text>
                        <View style={styles.colAction} />
                      </View>
                      {sorted.map((block) => (
                        <View key={block.id} style={[styles.tableRow, styles.tableRowDivider]}>
                          <View style={styles.colDay}>
                            <Badge label={shortDayName(block.dayOfWeek)} />
                          </View>
                          <Text style={[styles.cell, styles.colTime]}>
                            {formatTime12(block.startTime)} - {formatTime12(block.endTime)}
                          </Text>
                          <Text style={[styles.cell, styles.colSubject, styles.cellStrong]} numberOfLines={2}>
                            {block.subject}
                          </Text>
                          <Pressable
                            onPress={() => removeClass(block.id)}
                            style={styles.colAction}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${block.subject} on ${DAY_NAMES[block.dayOfWeek]}`}
                          >
                            <Ionicons name="trash-outline" size={18} color="#A3261B" />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}

                  {!noClasses && (
                    <Pressable onPress={() => switchTab('add')} style={styles.secondaryButton} accessibilityRole="button" accessibilityLabel="Add a class">
                      <Ionicons name="add" size={18} color={colors.primary} />
                      <Text style={styles.secondaryButtonText}>{classes.length === 0 ? 'Add a class' : 'Add another class'}</Text>
                    </Pressable>
                  )}
                </View>

                <View style={styles.card}>
                  <CardTitle icon="moon-outline" title="No classes this semester?" helper="Only confirm this if you really have no classes to add." />
                  <Pressable
                    onPress={toggleNoClasses}
                    disabled={classes.length > 0}
                    style={[styles.checkRow, noClasses && styles.checkRowActive, classes.length > 0 && styles.checkRowDisabled]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: noClasses, disabled: classes.length > 0 }}
                    accessibilityLabel="I have no classes scheduled"
                  >
                    <Ionicons
                      name={noClasses ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={classes.length > 0 ? colors.textMuted : colors.primary}
                    />
                    <Text style={styles.checkText}>I have no classes scheduled</Text>
                  </Pressable>
                  {classes.length > 0 ? <Text style={styles.cardHelper}>Remove your classes above to choose this option.</Text> : null}
                </View>
              </>
            )}
          </ScrollView>

          {/* ---- Footer ---- */}
          <View style={styles.footer}>
            {saveError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#A3261B" />
                <Text style={styles.errorText}>{saveError}</Text>
              </View>
            ) : null}
            <Pressable
              onPress={save}
              disabled={!canSave}
              style={[styles.primaryButton, !canSave && styles.primaryButtonDisabled]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
              accessibilityLabel={isOnboarding ? 'Save and continue to Home' : 'Save class schedule'}
            >
              <Text style={styles.primaryButtonText}>
                {saving ? 'Saving…' : isOnboarding ? 'Save & Continue to Home' : 'Save Class Schedule'}
              </Text>
            </Pressable>
            {!canSave && !saving ? (
              <Text style={styles.footerHint}>Add at least one class, or confirm that you have no classes, to continue.</Text>
            ) : null}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: BORDER },
  headerSide: { width: 70, height: 36, justifyContent: 'center' },
  headerSideRight: { alignItems: 'flex-end' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: colors.textDark },
  logoutText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, color: colors.textMuted },
  topArea: { padding: spacing.md, paddingBottom: 0, gap: 10 },
  content: { padding: spacing.md, paddingBottom: spacing.lg, gap: 12 },

  segment: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 12, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE },
  segmentButton: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 9 },
  segmentButtonActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
  segmentTextActive: { color: colors.white },
  countBadge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: BORDER },
  countBadgeActive: { backgroundColor: colors.white },
  countBadgeText: { fontSize: 12, fontWeight: '800', color: colors.textDark },
  countBadgeTextActive: { color: colors.primary },

  successBox: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#B7DFC1', backgroundColor: '#E6F4EA' },
  successTextWrap: { flex: 1 },
  successTitle: { fontSize: 13, fontWeight: '800', color: '#14632B' },
  successText: { marginTop: 1, fontSize: 13, color: colors.textDark },

  addButton: { height: 48, borderRadius: 10, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  addButtonText: { fontSize: 15, fontWeight: '800', color: colors.white },
  linkRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE },
  linkRowText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.primary },

  stepRow: { flexDirection: 'row', gap: 8 },
  stepPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  stepPillDone: { backgroundColor: '#E6F4EA', borderColor: '#B7DFC1' },
  stepPillCurrent: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepText: { fontSize: 12, fontWeight: '800' },

  banner: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.primary, backgroundColor: SURFACE },
  bannerText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.textDark },

  card: { padding: spacing.md, borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: colors.white, gap: 8 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitleIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.infoBg },
  cardTitleText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.textDark },
  cardHelper: { marginTop: 2, fontSize: 13, lineHeight: 18, color: colors.textMuted },

  label: { marginTop: 6, fontSize: 14, fontWeight: '700', color: colors.textDark },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { minWidth: 48, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: BORDER, backgroundColor: colors.white },
  dayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayChipText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  dayChipTextActive: { color: colors.white },
  input: { height: 46, borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: colors.textDark, backgroundColor: colors.white },

  errorBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#F5B7B1', backgroundColor: '#FDECEA' },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#A3261B', fontWeight: '600' },

  secondaryButton: { height: 46, borderRadius: 10, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  secondaryButtonText: { fontSize: 14, fontWeight: '800', color: colors.primary },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: '700' },

  table: { marginTop: 4, borderWidth: 1, borderColor: BORDER, borderRadius: 10, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, gap: 8, backgroundColor: colors.white },
  tableHead: { backgroundColor: SURFACE, paddingVertical: 8 },
  tableRowDivider: { borderTopWidth: 1, borderTopColor: BORDER },
  headCell: { fontSize: 12, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase' },
  cell: { fontSize: 13, color: colors.textDark },
  cellStrong: { fontWeight: '700' },
  colDay: { width: 52 },
  colTime: { flex: 1.3 },
  colSubject: { flex: 1 },
  colAction: { width: 32, alignItems: 'center', justifyContent: 'center' },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: BORDER, backgroundColor: colors.white },
  checkRowActive: { borderColor: colors.primary, backgroundColor: SURFACE },
  checkRowDisabled: { backgroundColor: SURFACE },
  checkText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textDark },

  footer: { padding: spacing.md, gap: 8, borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: colors.white },
  primaryButton: { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  primaryButtonDisabled: { backgroundColor: '#CBD5E1' },
  primaryButtonText: { fontSize: 15, fontWeight: '800', color: colors.white },
  footerHint: { textAlign: 'center', fontSize: 12, lineHeight: 17, color: colors.textMuted },
});