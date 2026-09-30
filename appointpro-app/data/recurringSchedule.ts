import { ConsultationMode, FacultySlot, toDateKey, DAY_NAMES } from './facultySlots';

export type Period = 'AM' | 'PM';

export type RecurringRule = {
  id: string;
  daysOfWeek: number[]; // 0 = Sunday ... 6 = Saturday
  startHour: number;
  startMinute: number;
  startPeriod: Period;
  endHour: number;
  endMinute: number;
  endPeriod: Period;
  mode: ConsultationMode;
  location: string;
  createdDateKey: string; // generation starts here
  semesterEndDateKey: string; // generation stops here (inclusive)
};

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function formatRuleTimeLabel(rule: RecurringRule): string {
  const start = `${rule.startHour}:${pad(rule.startMinute)} ${rule.startPeriod}`;
  const end = `${rule.endHour}:${pad(rule.endMinute)} ${rule.endPeriod}`;
  return `${start} - ${end}`;
}

export function formatDaysLabel(daysOfWeek: number[]): string {
  return [...daysOfWeek].sort((a, b) => a - b).map((d) => DAY_NAMES[d]).join(', ');
}

export function formatDateRangeLabel(rule: RecurringRule): string {
  const start = new Date(rule.createdDateKey + 'T00:00:00');
  const end = new Date(rule.semesterEndDateKey + 'T00:00:00');
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(start)} - ${fmt(end)}`;
}

// Generates one FacultySlot per date that matches the rule's days of week,
// from createdDateKey through semesterEndDateKey inclusive.
export function generateSlotsFromRule(rule: RecurringRule): Record<string, FacultySlot[]> {
  const result: Record<string, FacultySlot[]> = {};
  const start = new Date(rule.createdDateKey + 'T00:00:00');
  const end = new Date(rule.semesterEndDateKey + 'T00:00:00');
  const label = formatRuleTimeLabel(rule);

  const cursor = new Date(start);
  let safety = 0;
  while (cursor <= end && safety < 400) {
    safety++;
    if (rule.daysOfWeek.includes(cursor.getDay())) {
      const key = toDateKey(cursor);
      const slot: FacultySlot = {
        id: `${rule.id}-${key}`,
        label,
        mode: rule.mode,
        location: rule.location,
        enabled: true,
        recurring: true,
        ruleId: rule.id,
      };
      result[key] = [...(result[key] ?? []), slot];
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}