// Builds the text of every appointment notification so the wording is
// specific (who, what, when, why) and identical wherever it is sent from.
import { DEPARTMENT_OPTIONS } from './departments';

export type Actor = {
  name: string;
  department?: string | null;
  // 'Student' | 'Faculty' — only shown where the role is useful context.
  role?: 'Student' | 'Faculty';
};

export type Subject = { purpose?: string | null; category?: string | null };

// "CCS" -> "College of Computer Studies (CCS)"; full labels pass through.
export function fullDepartment(value?: string | null): string {
  const text = (value ?? '').trim();
  if (!text) return '';
  const hit = DEPARTMENT_OPTIONS.find(
    (o) => o.code.toLowerCase() === text.toLowerCase() || o.label.toLowerCase() === text.toLowerCase()
  );
  return hit ? hit.label : text;
}

function to12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${period}`;
}

// "Oct 10, 2026, 10:00 AM – 10:30 AM". Uses the raw date/time values when
// known; otherwise falls back to whatever display labels the caller has.
export function formatWhen(opts: {
  dateKey?: string | null; // 'YYYY-MM-DD'
  start24?: string | null; // 'HH:MM[:SS]'
  end24?: string | null;
  dateLabel?: string | null;
  timeLabel?: string | null; // e.g. '10:00 AM - 10:30 AM'
}): string {
  const { dateKey, start24, end24, dateLabel, timeLabel } = opts;
  let datePart = dateLabel ?? '';
  if (dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    const [y, mo, d] = dateKey.split('-').map(Number);
    datePart = new Date(y, mo - 1, d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  let timePart = (timeLabel ?? '').replace(/\s+-\s+/, ' – ');
  if (start24) {
    timePart = end24 ? `${to12h(start24)} – ${to12h(end24)}` : to12h(start24);
  }
  return [datePart, timePart].filter(Boolean).join(', ');
}

export function subjectOf(s: Subject): string {
  return (s.purpose ?? '').trim() || (s.category ?? '').trim() || 'a consultation';
}

function actorLabel(a: Actor, withRole: boolean): string {
  const parts = [withRole ? a.role : undefined, a.department ? fullDepartment(a.department) : undefined].filter(
    Boolean
  );
  return parts.length ? `${a.name} (${parts.join(', ')})` : a.name;
}

const reasonOf = (r?: string | null) => (r ?? '').trim() || 'No reason provided';
const stop = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

type Built = { icon: 'calendar-outline' | 'checkmark-circle-outline' | 'close-circle-outline'; title: string; description: string };

// Faculty view: a student booked.
export function bookedMessage(student: Actor, subject: Subject, when: string): Built {
  return {
    icon: 'calendar-outline',
    title: `New Booking from ${student.name}`,
    description: `${actorLabel(student, false)} booked an appointment for ${subjectOf(subject)} on ${when}.`,
  };
}

// Student view: faculty approved.
export function approvedMessage(faculty: Actor, subject: Subject, when: string): Built {
  return {
    icon: 'checkmark-circle-outline',
    title: `Approved by ${faculty.name}`,
    description: `${actorLabel(faculty, false)} approved your appointment for ${subjectOf(subject)} on ${when}.`,
  };
}

// Student view: faculty declined.
export function declinedMessage(faculty: Actor, subject: Subject, when: string, reason?: string | null): Built {
  const base = `${actorLabel(faculty, false)} declined your appointment for ${subjectOf(subject)} on ${when}.`;
  return {
    icon: 'close-circle-outline',
    title: `Declined by ${faculty.name}`,
    description: (reason ?? '').trim() ? `${base} Reason: ${stop(reason!.trim())}` : base,
  };
}

// Both views: either side canceled.
export function canceledMessage(by: Actor, when: string, reason?: string | null): Built {
  return {
    icon: 'close-circle-outline',
    title: `Canceled by ${by.name}`,
    description: `${actorLabel(by, true)} canceled the appointment scheduled for ${when}. Reason: ${stop(reasonOf(reason))}`,
  };
}

// Both views: either side rescheduled.
export function rescheduledMessage(
  by: Actor,
  subject: Subject,
  newWhen: string,
  extra?: { reason?: string | null; meetingLink?: string | null }
): Built {
  let description = `${actorLabel(by, true)} requested to reschedule the appointment for ${subjectOf(subject)} to ${newWhen}.`;
  if ((extra?.reason ?? '').trim()) description += ` Reason: ${stop(extra!.reason!.trim())}`;
  if ((extra?.meetingLink ?? '').trim()) description += ` New meeting link: ${extra!.meetingLink!.trim()}`;
  return { icon: 'calendar-outline', title: `Reschedule from ${by.name}`, description };
}

// Student view: faculty finished the consultation.
export function completedMessage(faculty: Actor, subject: Subject, when: string): Built {
  return {
    icon: 'checkmark-circle-outline',
    title: `Completed with ${faculty.name}`,
    description: `${actorLabel(faculty, false)} completed your appointment for ${subjectOf(subject)} on ${when}.`,
  };
}

// Splits a stored notification description into the main sentence(s) plus the
// labelled extras ("Reason: ...", "New meeting link: ...") so the detail view
// can show each one on its own line. Works on notifications already saved.
export type NotificationExtra = { label: 'Reason' | 'New meeting link'; value: string };

export function splitNotificationDescription(description: string): { main: string; extras: NotificationExtra[] } {
  const text = (description ?? '').trim();
  const parts = text.split(/(?:^|\s)(Reason|New meeting link):\s*/);
  const main = (parts[0] ?? '').trim();
  const extras: NotificationExtra[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const value = (parts[i + 1] ?? '').trim();
    if (value) extras.push({ label: parts[i] as NotificationExtra['label'], value });
  }
  return { main, extras };
}