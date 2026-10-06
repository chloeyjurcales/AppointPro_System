import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { ClassBlock, DAY_NAMES, DAY_ORDER, formatTime12, shortDayName, sortClassBlocks } from '../lib/classSchedule';

const BORDER = '#E2E8F0';
const SURFACE = '#F8FAFC';

type Props = {
  studentName?: string;
  classes: ClassBlock[];
  loading?: boolean;
  /** True when the classes could not be loaded. */
  error?: boolean;
  /** Highlights this day (the day the faculty is currently looking at). */
  selectedDayOfWeek?: number;
  /** The class the proposed time collides with; it is drawn in red. */
  conflictBlockId?: string;
  defaultExpanded?: boolean;
};

/**
 * Read-only "Student's Weekly Class Availability" card for faculty. Each day lists the
 * student's class blocks as badges; a day with no classes shows a green "Free all day" badge.
 * Tapping the header shows or hides the list (instantly, no animation).
 */
export default function StudentClassScheduleCard({
  studentName = 'The student',
  classes,
  loading = false,
  error = false,
  selectedDayOfWeek,
  conflictBlockId,
  defaultExpanded = true,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const sorted = sortClassBlocks(classes);

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.header}
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel="Student's weekly class availability"
      >
        <View style={styles.headerIcon}>
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Student's Weekly Class Availability</Text>
          <Text style={styles.subtitle}>
            {loading
              ? 'Loading class schedule…'
              : error
              ? 'Could not load the class schedule'
              : `${studentName} · ${sorted.length} ${sorted.length === 1 ? 'class' : 'classes'} per week`}
          </Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          <View style={styles.legend}>
            <View style={[styles.badge, styles.badgeBusy]}>
              <Ionicons name="school-outline" size={12} color="#475569" />
              <Text style={[styles.badgeText, { color: '#334155' }]}>Class (busy)</Text>
            </View>
            <View style={[styles.badge, styles.badgeFree]}>
              <Ionicons name="checkmark-circle-outline" size={12} color="#14632B" />
              <Text style={[styles.badgeText, { color: '#14632B' }]}>No classes (free)</Text>
            </View>
          </View>

          {loading ? (
            <Text style={styles.note}>Loading class schedule…</Text>
          ) : error ? (
            <View style={[styles.badge, styles.badgeConflict]}>
              <Ionicons name="alert-circle-outline" size={12} color="#A3261B" />
              <Text style={[styles.badgeText, { color: '#A3261B' }]}>Could not load this student's classes</Text>
            </View>
          ) : (
            <View style={styles.table}>
              {DAY_ORDER.map((day, index) => {
                const dayClasses = sorted.filter((block) => block.dayOfWeek === day);
                const isSelected = day === selectedDayOfWeek;
                return (
                  <View
                    key={day}
                    style={[styles.row, index > 0 && styles.rowDivider, isSelected && styles.rowSelected]}
                    accessibilityLabel={`${DAY_NAMES[day]}: ${dayClasses.length === 0 ? 'no classes' : `${dayClasses.length} classes`}`}
                  >
                    <View style={styles.dayCol}>
                      <Text style={styles.dayText}>{shortDayName(day)}</Text>
                      {isSelected ? <Text style={styles.selectedTag}>Viewing</Text> : null}
                    </View>
                    <View style={styles.blocksCol}>
                      {dayClasses.length === 0 ? (
                        <View style={[styles.badge, styles.badgeFree]}>
                          <Text style={[styles.badgeText, { color: '#14632B' }]}>Free all day</Text>
                        </View>
                      ) : (
                        dayClasses.map((block) => {
                          const isConflict = block.id === conflictBlockId;
                          return (
                            <View key={block.id} style={[styles.badge, isConflict ? styles.badgeConflict : styles.badgeBusy]}>
                              <Text style={[styles.badgeText, { color: isConflict ? '#A3261B' : '#334155' }]}>
                                {block.subject} · {formatTime12(block.startTime)} - {formatTime12(block.endTime)}
                              </Text>
                            </View>
                          );
                        })
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: BORDER, borderRadius: 14, backgroundColor: colors.white, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: SURFACE },
  headerIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.infoBg },
  headerText: { flex: 1 },
  title: { fontSize: 14, fontWeight: '800', color: colors.textDark },
  subtitle: { marginTop: 2, fontSize: 12, color: colors.textMuted },
  body: { padding: 14, gap: 10, borderTopWidth: 1, borderTopColor: BORDER },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  note: { fontSize: 13, color: colors.textMuted },
  table: { borderWidth: 1, borderColor: BORDER, borderRadius: 10, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, paddingHorizontal: 10, gap: 10, backgroundColor: colors.white },
  rowDivider: { borderTopWidth: 1, borderTopColor: BORDER },
  rowSelected: { backgroundColor: '#F1F5F9' },
  dayCol: { width: 48 },
  dayText: { fontSize: 13, fontWeight: '800', color: colors.textDark },
  selectedTag: { marginTop: 2, fontSize: 10, fontWeight: '700', color: colors.primary },
  blocksCol: { flex: 1, gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  badgeBusy: { backgroundColor: '#F1F5F9', borderColor: BORDER },
  badgeFree: { backgroundColor: '#E6F4EA', borderColor: '#B7DFC1' },
  badgeConflict: { backgroundColor: '#FDECEA', borderColor: '#F5B7B1' },
  badgeText: { fontSize: 12, fontWeight: '700' },
});