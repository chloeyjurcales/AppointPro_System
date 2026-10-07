import { useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import './FacultyView.css';
import { useConfirm } from '../lib/useConfirm';


export type FacultyTab = 'profile' | 'schedule' | 'settings' | 'directory';

type SlotStatus = 'face-to-face' | 'online' | 'unavailable';

type ScheduleCell = {
  status: SlotStatus;
  location: string | null; // room name, or the meeting link for Online
};

type ScheduleRow = {
  time: string;
  start: number; // minutes after midnight, start of this hour row
  end: number; // minutes after midnight, end of this hour row
  cells: ScheduleCell[]; // Mon..Sun
};

// One rendered table cell: `span` is how many hour-rows it covers (a slot
// from 7-10 AM renders as ONE cell with span 3, instead of three separate
// "available" rows), and `rangeLabel` is that whole covered range, e.g.
// "7:00 AM – 10:00 AM". A cell is `null` when it's covered by a previous
// row's span and should not be rendered at all.
type MergedCell = {
  status: SlotStatus;
  span: number;
  rangeLabel: string;
  location: string | null;
} | null;

type ConsultationMode = 'Face-to-Face' | 'Online';

type TimeSlot = {
  id: string;
  time: string;
  mode: ConsultationMode;
  location: string;
  enabled: boolean;
  ruleId: string | null;
};

type EditableScheduleValues = {
  startHour: string;
  startMinute: string;
  startPeriod: string;
  endHour: string;
  endMinute: string;
  endPeriod: string;
  mode: ConsultationMode;
  location: string;
};

type RecurringSchedule = {
  id: string;
  days: string;
  time: string;
  mode: ConsultationMode;
  dateRange: string;
};

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Native JS Date.getDay() order (0 = Sunday ... 6 = Saturday), used only by
// the recurring-schedule form below since it iterates real calendar dates.
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------- Real calendar date helpers ----------
// Everything below works with genuine Date objects so week navigation and
// "today" are always correct, instead of a single hardcoded demo week.

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addDaysToDate(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Monday of the week containing `date`.
function startOfWeek(date: Date): Date {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (base.getDay() + 6) % 7; // Sun=0..Sat=6 -> Mon=0..Sun=6
  return addDaysToDate(base, -mondayOffset);
}

function getWeekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => addDaysToDate(weekStart, index));
}

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMonthDay(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeekRangeLabel(weekDates: Date[]): string {
  const start = weekDates[0];
  const end = weekDates[6];
  return `${formatMonthDay(start)} – ${formatMonthDay(end)}, ${end.getFullYear()}`;
}

// ---------- Philippine holiday calendar ----------
// Fixed-date holidays apply every year. Movable ones (tied to Easter) and
// National Heroes Day (last Monday of August) are computed, so this stays
// correct no matter which year the faculty member navigates to.

const FIXED_PH_HOLIDAYS: { month: number; day: number; name: string }[] = [
  { month: 1, day: 1, name: "New Year's Day" },
  { month: 4, day: 9, name: 'Araw ng Kagitingan' },
  { month: 5, day: 1, name: 'Labor Day' },
  { month: 6, day: 12, name: 'Independence Day' },
  { month: 8, day: 21, name: 'Ninoy Aquino Day' },
  { month: 11, day: 1, name: "All Saints' Day" },
  { month: 11, day: 30, name: 'Bonifacio Day' },
  { month: 12, day: 25, name: 'Christmas Day' },
  { month: 12, day: 30, name: 'Rizal Day' },
  { month: 12, day: 31, name: "New Year's Eve" },
];

// Meeus/Jones/Butcher algorithm for the Gregorian Easter Sunday.
function computeEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getLastMondayOfAugust(year: number): Date {
  const lastDayOfAugust = new Date(year, 8, 0); // Aug 31
  const mondayOffset = (lastDayOfAugust.getDay() + 6) % 7;
  return addDaysToDate(lastDayOfAugust, -mondayOffset);
}

function getHolidayName(date: Date): string | null {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const fixed = FIXED_PH_HOLIDAYS.find(
    (holiday) => holiday.month === month && holiday.day === day,
  );
  if (fixed) return fixed.name;

  const year = date.getFullYear();
  const easterSunday = computeEasterSunday(year);
  if (isSameDay(date, addDaysToDate(easterSunday, -3))) return 'Maundy Thursday';
  if (isSameDay(date, addDaysToDate(easterSunday, -2))) return 'Good Friday';
  if (isSameDay(date, getLastMondayOfAugust(year))) return 'National Heroes Day';

  return null;
}

// ---------- Schedule tab time-row axis ----------
// The Schedule tab shows one row per hour from 7 AM to 9 PM. This is just
// the display axis (like the weekday header row) — it carries no faculty
// data of its own. Every cell's actual status comes from real rows in the
// `availability_slots` table, matched by which hour-row and day they fall
// on, so a faculty member sees only slots they actually created.
const SCHEDULE_ROW_START_HOURS = Array.from({ length: 14 }, (_, i) => 7 + i); // 7 AM .. 8 PM start hours (last row ends 9 PM)

function formatHourLabel(hour24: number): string {
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour}:00 ${period}`;
}

function formatHourRangeLabel(startHour: number): string {
  return `${formatHourLabel(startHour)} – ${formatHourLabel((startHour + 1) % 24)}`;
}

const SCHEDULE_TIME_ROWS = SCHEDULE_ROW_START_HOURS.map((startHour) => ({
  label: formatHourRangeLabel(startHour),
  start: startHour * 60,
  end: (startHour + 1) * 60,
}));

function timeRangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) {
  return aStart < bEnd && bStart < aEnd;
}

// ---------- Postgres time <-> minutes-after-midnight helpers ----------
// `time without time zone` columns come back as "HH:MM:SS" strings.

function dbTimeToMinutes(dbTime: string): number | null {
  const match = dbTime.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesToDbTime(minutesAfterMidnight: number): string {
  const hour = Math.floor(minutesAfterMidnight / 60);
  const minute = minutesAfterMidnight % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

// Faculty availability lives entirely in the real `availability_slots`
// table, keyed here by real ISO calendar date (e.g. "2026-09-08") with
// each enabled slot's minute range and real consultation mode for that
// day. Every cell in the grid is built fresh from that real data — there
// is no fallback/placeholder status. `weekDates` is the 7 real Date
// objects (Mon..Sun) currently being displayed.
function buildDisplayRows(
  slotRangesByDate: Record<
    string,
    { start: number; end: number; mode: ConsultationMode; location: string }[]
  >,
  weekDates: Date[],
): ScheduleRow[] {
  return SCHEDULE_TIME_ROWS.map(({ label, start, end }) => {
    const cells: ScheduleCell[] = weekDates.map((date) => {
      const rangesForDay = slotRangesByDate[toISODate(date)] ?? [];

      const overlapping = rangesForDay.find((slotRange) =>
        timeRangesOverlap(start, end, slotRange.start, slotRange.end),
      );

      if (!overlapping) return { status: 'unavailable', location: null };

      return {
        status: overlapping.mode === 'Online' ? 'online' : 'face-to-face',
        location: overlapping.location || null,
      };
    });

    return { time: label, start, end, cells };
  });
}

// Turns the hour-by-hour grid into one entry per day per contiguous block of
// the same status, so "7-8 available, 8-9 available, 9-10 available" becomes
// a single "7-10 available" cell spanning three rows.
function buildMergedGrid(rows: ScheduleRow[]): MergedCell[][] {
  const dayCount = rows[0]?.cells.length ?? 0;
  const grid: MergedCell[][] = rows.map(() => new Array<MergedCell>(dayCount).fill(null));

  for (let day = 0; day < dayCount; day++) {
    let rowIndex = 0;
    while (rowIndex < rows.length) {
      const status = rows[rowIndex].cells[day].status;
      const location = rows[rowIndex].cells[day].location;
      let lastRowIndex = rowIndex;
      while (
        lastRowIndex + 1 < rows.length &&
        rows[lastRowIndex + 1].cells[day].status === status &&
        rows[lastRowIndex + 1].cells[day].location === location
      ) {
        lastRowIndex += 1;
      }

      grid[rowIndex][day] = {
        status,
        span: lastRowIndex - rowIndex + 1,
        rangeLabel: formatMergedRangeLabel(rows[rowIndex].start, rows[lastRowIndex].end),
        location,
      };

      rowIndex = lastRowIndex + 1;
    }
  }

  return grid;
}

function formatMergedRangeLabel(startMinutes: number, endMinutes: number): string {
  return `${formatHourLabel(startMinutes / 60)} – ${formatHourLabel((endMinutes / 60) % 24)}`;
}

type FacultyViewProps = {
  session: Session;
  initialTab?: FacultyTab;
  searchQuery?: string;
  // Lets the dashboard's top-bar/sidebar avatar update immediately after the
  // faculty member changes or removes their photo on the Profile tab.
  onAvatarChange?: (url: string | null) => void;
  // Keeps dashboard text such as the sidebar name and Welcome heading in sync
  // immediately after Personal Information is saved.
  onProfileNameChange?: (name: string) => void;
};

export default function FacultyView({
  session,
  initialTab = 'profile',
  searchQuery = '',
  onAvatarChange,
  onProfileNameChange,
}: FacultyViewProps) {
  const facultyId = session.user.id;
  const [activeTab, setActiveTab] = useState<FacultyTab>(initialTab);

  const [scheduleWeekStart, setScheduleWeekStart] = useState(() => startOfWeek(new Date()));
  const scheduleWeekDates = useMemo(() => getWeekDates(scheduleWeekStart), [scheduleWeekStart]);
  const [weekSlotRanges, setWeekSlotRanges] = useState<
    Record<string, { start: number; end: number; mode: ConsultationMode; location: string }[]>
  >({});

  useEffect(() => {
    let isMounted = true;
    const from = toISODate(scheduleWeekDates[0]);
    const to = toISODate(scheduleWeekDates[6]);

    const load = () => {
      supabase
        .from('availability_slots')
        .select('date, start_time, end_time, mode, location')
        .eq('faculty_id', facultyId)
        .eq('enabled', true)
        .gte('date', from)
        .lte('date', to)
        .then(({ data, error }) => {
          if (!isMounted) return;
          if (error) {
            console.log('Failed to load schedule availability:', error.message);
            return;
          }
          const byDate: Record<string, { start: number; end: number; mode: ConsultationMode; location: string }[]> = {};
          (data ?? []).forEach((row) => {
            const start = dbTimeToMinutes(row.start_time);
            const end = dbTimeToMinutes(row.end_time);
            if (start === null || end === null) return;
            const mode = (row.mode as ConsultationMode) ?? 'Face-to-Face';
            byDate[row.date] = [...(byDate[row.date] ?? []), { start, end, mode, location: row.location ?? '' }];
          });
          setWeekSlotRanges(byDate);
        });
    };

    load();
    const channel = supabase
      .channel(`faculty-week-slots-${facultyId}-${from}-${to}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability_slots', filter: `faculty_id=eq.${facultyId}` }, () => load())
      .subscribe();
    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [facultyId, scheduleWeekDates]);

  // Jump to the Directory tab the moment the faculty starts typing a new
  // search (but never on mount/deep-link, even if a leftover search query
  // from a previous visit is still sitting in the search box).
  const previousSearchRef = useRef(searchQuery);
  useEffect(() => {
    const wasEmpty = previousSearchRef.current.trim().length === 0;
    const isNowFilled = searchQuery.trim().length > 0;
    if (wasEmpty && isNowFilled) {
      setActiveTab('directory');
    }
    previousSearchRef.current = searchQuery;
  }, [searchQuery]);

  return (
    <div className="fv-page">
      <div className="fv-tabs">
        {(
          [
            { id: 'profile', label: 'Profile' },
            { id: 'schedule', label: 'Schedule' },
            { id: 'settings', label: 'Availability' },
            { id: 'directory', label: 'Directory' },
          ] as { id: FacultyTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`fv-tab${activeTab === tab.id ? ' fv-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <ProfileTab
          session={session}
          onAvatarChange={onAvatarChange}
          onProfileNameChange={onProfileNameChange}
        />
      )}

      {activeTab === 'schedule' && (
        <ScheduleTab
          weekDates={scheduleWeekDates}
          weekSlotRanges={weekSlotRanges}
          onPreviousWeek={() => setScheduleWeekStart((d) => addDaysToDate(d, -7))}
          onNextWeek={() => setScheduleWeekStart((d) => addDaysToDate(d, 7))}
          onToday={() => setScheduleWeekStart(startOfWeek(new Date()))}
        />
      )}

      {activeTab === 'settings' && <AvailabilityTab facultyId={facultyId} />}

      {activeTab === 'directory' && (
        <DirectoryTab searchQuery={searchQuery} currentFacultyId={facultyId} />
      )}
    </div>
  );
}

type FacultyDirectoryStatus = 'Available' | 'Unavailable';

type FacultyDirectoryMember = {
  id: string;
  name: string;
  email: string | null;
  facultyCode: string | null;
  role: string;
  department: string;
  consultationTypes: string;
  status: FacultyDirectoryStatus;
  avatarUrl: string | null;
};

// Shape returned by the `faculty` table embedded query below.
type DbDirectoryRow = {
  profile_id: string;
  department: string | null;
  role_title: string;
  faculty_id: string | null;
  is_available: boolean;
  consultation_types: string | null;
  profiles:
    | { full_name: string; email: string | null; avatar_url: string | null }
    | { full_name: string; email: string | null; avatar_url: string | null }[]
    | null;
};

function DirectoryTab({
  searchQuery,
  currentFacultyId,
}: {
  searchQuery: string;
  currentFacultyId: string;
}) {
  const [members, setMembers] = useState<FacultyDirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<FacultyDirectoryMember | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = () => {
      supabase
        .from('faculty')
        .select('profile_id, faculty_id, department, role_title, is_available, consultation_types, profiles ( full_name, email, avatar_url )')
        .then(({ data, error }) => {
          if (!isMounted) return;
          if (error) {
            setLoadError(error.message);
            setLoading(false);
            return;
          }

          const rows = (data ?? []) as unknown as DbDirectoryRow[];
          setMembers(
            rows.map((row) => {
              const profile = Array.isArray(row.profiles)
                ? row.profiles[0]
                : row.profiles;
              return {
                id: row.profile_id,
                name: profile?.full_name ?? 'Unnamed Faculty',
                avatarUrl: profile?.avatar_url ?? null,
                email: profile?.email ?? null,
                facultyCode: row.faculty_id ?? null,
                role: row.role_title,
                department: row.department ?? '—',
                consultationTypes:
                  row.consultation_types ?? DEFAULT_CONSULTATION_TYPES,
                status: row.is_available ? 'Available' : 'Unavailable',
              };
            }),
          );
          setLoadError(null);
          setLoading(false);
        });
    };

    load();

    const channel = supabase
      .channel('faculty-directory')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'faculty' },
        () => load(),
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const query = searchQuery.trim().toLowerCase();
  const filtered = members.filter((member) =>
    member.name.toLowerCase().includes(query),
  );

  return (
    <div className="fv-card fv-directory-card">
      <h2>Faculty Directory</h2>
      <p className="fv-schedule-subtitle">
        Browse other faculty members{query ? ` matching "${searchQuery}"` : ''}.
      </p>

      {loading ? (
        <p className="fv-empty-slots">Loading faculty directory…</p>
      ) : loadError ? (
        <p className="fv-empty-slots">
          Couldn't load the directory: {loadError}
        </p>
      ) : filtered.length === 0 ? (
        <p className="fv-empty-slots">
          No faculty members match "{searchQuery}".
        </p>
      ) : (
        <div className="fv-directory-list">
          {filtered.map((member) => (
            <button
              key={member.id}
              type="button"
              className="fv-directory-row"
              onClick={() => setSelectedMember(member)}
            >
              <span className="fv-directory-avatar">
                {member.avatarUrl ? (
                  <img src={member.avatarUrl} alt="" />
                ) : (
                  <UserIcon />
                )}
              </span>

              <span className="fv-directory-info">
                <span className="fv-directory-name">
                  {member.name}
                  {member.id === currentFacultyId ? ' (You)' : ''}
                </span>
                <span className="fv-directory-role">
                  {member.role} · {member.department}
                </span>
                <span
                  className={`fv-directory-status fv-directory-status-${member.status.toLowerCase()}`}
                >
                  {member.status}
                </span>
              </span>

              <ChevronRightIcon />
            </button>
          ))}
        </div>
      )}

      {selectedMember && (
        <div
          className="fv-profile-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedMember(null);
          }}
        >
          <div
            className="fv-profile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fv-profile-modal-title"
          >
            <button
              type="button"
              className="fv-profile-modal-close"
              onClick={() => setSelectedMember(null)}
              aria-label="Close profile"
            >
              ×
            </button>

            <div className="fv-profile-modal-avatar">
              {selectedMember.avatarUrl ? (
                <img src={selectedMember.avatarUrl} alt="" />
              ) : (
                <UserIcon />
              )}
            </div>

            <h3 id="fv-profile-modal-title">{selectedMember.name}</h3>
            <p className="fv-profile-modal-role">{selectedMember.role}</p>

            <div className="fv-profile-modal-status">
              <span
                className={`fv-directory-status fv-directory-status-${selectedMember.status.toLowerCase()}`}
              >
                {selectedMember.status}
              </span>
            </div>

            <dl className="fv-profile-modal-info">
              <div>
                <dt>Department</dt>
                <dd>{selectedMember.department}</dd>
              </div>
              <div>
                <dt>Consultation types</dt>
                <dd>{selectedMember.consultationTypes || '—'}</dd>
              </div>
              <div>
                <dt>Faculty ID</dt>
                <dd>{selectedMember.facultyCode || '—'}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{selectedMember.email || '—'}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

type PersonalInfo = {
  name: string;
  email: string;
  department: string;
  consultationTypes: string;
  about: string;
};

// Same default the mobile app shows when a faculty hasn't set this yet.
const DEFAULT_CONSULTATION_TYPES = 'Face-to-Face · Online';

type DbProfileRow = { full_name: string; email: string; avatar_url: string | null };
type DbFacultyRow = {
  faculty_id: string;
  department: string | null;
  role_title: string;
  is_available: boolean;
  consultation_types: string | null;
  about?: string | null;
};

function ProfileTab({
  session,
  onAvatarChange,
  onProfileNameChange,
}: {
  session: Session;
  onAvatarChange?: (url: string | null) => void;
  onProfileNameChange?: (name: string) => void;
}) {
  const facultyId = session.user.id;
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [facultyCode, setFacultyCode] = useState('');
  const [roleTitle, setRoleTitle] = useState('Instructor');
  const [isAvailable, setIsAvailable] = useState(true);
  const [savedInfo, setSavedInfo] = useState<PersonalInfo>({
    name: '',
    email: session.user.email ?? '',
    department: '',
    consultationTypes: DEFAULT_CONSULTATION_TYPES,
    about: '',
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<PersonalInfo>(savedInfo);
  const [formAvailable, setFormAvailable] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      supabase
        .from('profiles')
        .select('full_name, email, avatar_url')
        .eq('id', facultyId)
        .single(),
      supabase
        .from('faculty')
        .select('*')
        .eq('profile_id', facultyId)
        .single(),
    ]).then(([profileRes, facultyRes]) => {
      if (!isMounted) return;

      if (profileRes.error) {
        console.log('Failed to load profile:', profileRes.error.message);
      }
      if (facultyRes.error) {
        console.log('Failed to load faculty record:', facultyRes.error.message);
      }

      const profileData = profileRes.data as DbProfileRow | null;
      const facultyData = facultyRes.data as DbFacultyRow | null;

      const info: PersonalInfo = {
        name: profileData?.full_name ?? '',
        email: profileData?.email ?? session.user.email ?? '',
        department: facultyData?.department ?? '',
        consultationTypes:
          facultyData?.consultation_types ?? DEFAULT_CONSULTATION_TYPES,
        about: facultyData?.about ?? '',
      };

      setSavedInfo(info);
      setForm(info);
      setAvatarUrl(profileData?.avatar_url ?? null);
      setFacultyCode(facultyData?.faculty_id ?? '');
      setRoleTitle(facultyData?.role_title ?? 'Instructor');
      setIsAvailable(facultyData?.is_available ?? true);
      setFormAvailable(facultyData?.is_available ?? true);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [facultyId, session.user.email]);

  // Uploads to the same Storage bucket the mobile app uses and saves only the
  // URL. This used to store the whole image as a base64 string in
  // profiles.avatar_url, which bloated every profile/directory query.
  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      window.alert('Please choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      window.alert('Please choose a photo under 5 MB.');
      return;
    }

    const ext =
      (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4) ||
      'jpg';
    const path = `${facultyId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { contentType: file.type, upsert: true });
    if (uploadError) {
      window.alert(`Could not upload your new photo: ${uploadError.message}`);
      return;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = `${data.publicUrl}?t=${Date.now()}`;
    setAvatarUrl(url);
    onAvatarChange?.(url);

    const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', facultyId);
    if (error) window.alert(`Could not save your new photo: ${error.message}`);
  };

  const removeAvatar = async () => {
    const ok = await confirm({
      title: 'Remove your profile photo?',
      message: 'Your initials will be shown instead.',
      confirmLabel: 'Yes, Remove',
      danger: true,
    });
    if (!ok) return;
    setAvatarUrl(null);
    onAvatarChange?.(null);
    supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', facultyId)
      .then(({ error }) => {
        if (error) window.alert(`Could not remove your photo: ${error.message}`);
      });
  };

  const updateField = (field: keyof PersonalInfo) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const startEditing = () => {
    setForm(savedInfo);
    setFormAvailable(isAvailable);
    setFormError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setFormError(null);
  };

  const handleSave = async () => {
    if (saving) return;

    setSaving(true);
    setFormError(null);

    const emailChanged = form.email !== savedInfo.email;
    if (emailChanged) {
      const { error: emailError } = await supabase.auth.updateUser({
        email: form.email,
      });
      if (emailError) {
        setFormError(`Could not update your login email: ${emailError.message}`);
        setSaving(false);
        return;
      }
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: form.name })
      .eq('id', facultyId);

    const { error: facultyError } = await supabase
      .from('faculty')
      .update({
        department: form.department,
        is_available: formAvailable,
        consultation_types: form.consultationTypes.trim(),
        about: form.about.trim(),
      })
      .eq('profile_id', facultyId);

    setSaving(false);

    if (profileError || facultyError) {
      setFormError(
        `Some changes could not be saved: ${
          profileError?.message ?? facultyError?.message
        }`,
      );
      return;
    }

    // A new email only takes effect once confirmed from the link Supabase sends.
    const savedProfileInfo = emailChanged
      ? { ...form, email: savedInfo.email }
      : form;

    setSavedInfo(savedProfileInfo);
    onProfileNameChange?.(savedProfileInfo.name);

    if (emailChanged) {
      window.alert('Saved. Confirm the link sent to your new email address to finish changing it.');
    }
    setIsAvailable(formAvailable);
    setFormError(null);
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="fv-grid-two">
        <div className="fv-card">
          <p className="fv-empty-slots">Loading your profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fv-grid-two">
      <div className="fv-card">
        <h2>Personal Information</h2>

        <div className="fv-avatar-block">
          <div className="fv-avatar-photo">
            {avatarUrl ? (
              <img src={avatarUrl} alt={`${savedInfo.name}'s profile photo`} />
            ) : (
              <UserIcon />
            )}
            <label className="fv-avatar-edit-btn" title="Change photo">
              <CameraIcon />
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                hidden
              />
            </label>
          </div>

          {avatarUrl && (
            <button
              type="button"
              className="fv-avatar-remove"
              onClick={removeAvatar}
            >
              Remove photo
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="fv-edit-form">
            <div className="fv-edit-field">
              <label htmlFor="pi-id">Employee ID</label>
              <input id="pi-id" type="text" value={facultyCode} disabled />
            </div>

            <div className="fv-edit-field">
              <label htmlFor="pi-name">Full Name</label>
              <input
                id="pi-name"
                type="text"
                value={form.name}
                onChange={(event) => updateField('name')(event.target.value)}
                placeholder="Enter your full name"
              />
            </div>

            <div className="fv-edit-field">
              <label htmlFor="pi-email">Email</label>
              <input
                id="pi-email"
                type="email"
                value={form.email}
                onChange={(event) => updateField('email')(event.target.value)}
                placeholder="Enter your email"
              />
            </div>

            <div className="fv-edit-field">
              <label htmlFor="pi-department">Department</label>
              <input
                id="pi-department"
                type="text"
                value={form.department}
                onChange={(event) =>
                  updateField('department')(event.target.value)
                }
                placeholder="Enter your department"
              />
            </div>

            <div className="fv-edit-field">
              <label htmlFor="pi-consultation-types">Consultation types</label>
              <input
                id="pi-consultation-types"
                type="text"
                value={form.consultationTypes}
                onChange={(event) =>
                  updateField('consultationTypes')(event.target.value)
                }
                placeholder="e.g. Face-to-Face, Online"
              />
            </div>

            <div className="fv-edit-field">
              <label htmlFor="pi-about">About</label>
              <textarea
                id="pi-about"
                rows={4}
                maxLength={300}
                value={form.about}
                onChange={(event) => updateField('about')(event.target.value)}
                placeholder="Tell students a little about yourself (optional)"
              />
            </div>

            <p className="fv-edit-password-hint">
              Want to change your password? That's now in Settings.
            </p>

            <div className="fv-edit-field">
              <label htmlFor="pi-available">Available for consultations</label>
              <button
                type="button"
                id="pi-available"
                role="switch"
                aria-checked={formAvailable}
                className={`fv-toggle${formAvailable ? ' fv-toggle-on' : ''}`}
                onClick={() => setFormAvailable((prev) => !prev)}
              >
                <span className="fv-toggle-knob" />
              </button>
            </div>

            {formError && <p className="fv-edit-error">{formError}</p>}

            <div className="fv-edit-actions">
              <button
                type="button"
                className="fv-edit-save"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                type="button"
                className="fv-edit-cancel"
                onClick={cancelEditing}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <dl className="fv-info-list">
              <div className="fv-info-row">
                <dt>Name:</dt>
                <dd>{savedInfo.name}</dd>
              </div>
              <div className="fv-info-row">
                <dt>Faculty ID:</dt>
                <dd>{facultyCode}</dd>
              </div>
              <div className="fv-info-row">
                <dt>Email:</dt>
                <dd>{savedInfo.email}</dd>
              </div>
              <div className="fv-info-row">
                <dt>Department:</dt>
                <dd>{savedInfo.department || '—'}</dd>
              </div>
              <div className="fv-info-row">
                <dt>Consultation:</dt>
                <dd>{savedInfo.consultationTypes || '—'}</dd>
              </div>
              <div className="fv-info-row">
                <dt>Availability:</dt>
                <dd>{isAvailable ? 'Available' : 'Unavailable'}</dd>
              </div>
              <div className="fv-info-row">
                <dt>Position:</dt>
                <dd>{roleTitle}</dd>
              </div>
            </dl>

            <button
              type="button"
              className="fv-edit-button"
              onClick={startEditing}
            >
              <EditIcon /> Edit
            </button>
          </>
        )}
      </div>

      <div className="fv-card">
        <h2>About</h2>
        {savedInfo.about.trim() ? (
          <p className="fv-about-text">{savedInfo.about.trim()}</p>
        ) : (
          <p className="fv-about-text fv-about-empty">
            You haven&apos;t added an About yet. Use Edit above to add one.
          </p>
        )}

        <h3 className="fv-subheading">Contact Information</h3>
        <div className="fv-contact-row">
          <MailIcon />
          <span>{savedInfo.email}</span>
        </div>
        <div className="fv-contact-row">
          <BuildingIcon />
          <span>{savedInfo.department || 'No department set'}</span>
        </div>
      </div>

      {confirmDialog}
    </div>
  );
}

function ScheduleTab({
  weekDates,
  weekSlotRanges,
  onPreviousWeek,
  onNextWeek,
  onToday,
}: {
  weekDates: Date[];
  weekSlotRanges: Record<string, { start: number; end: number; mode: ConsultationMode; location: string }[]>;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
}) {
  const displayRows = useMemo(
    () => buildDisplayRows(weekSlotRanges, weekDates),
    [weekSlotRanges, weekDates],
  );
  const mergedGrid = useMemo(() => buildMergedGrid(displayRows), [displayRows]);

  const hasAnySlotThisWeek = Object.values(weekSlotRanges).some(
    (ranges) => ranges.length > 0,
  );

  return (
    <div className="fv-card fv-schedule-card">
      <div className="fv-schedule-header fv-schedule-header-sticky">
        <div>
          <h2>Faculty Schedule</h2>
          <p className="fv-schedule-subtitle">
            {hasAnySlotThisWeek
              ? 'Your real consultation availability for this week.'
              : 'No availability set for this week yet — add slots from the Availability tab.'}
          </p>
        </div>
        <div className="fv-schedule-nav">
          <button type="button" onClick={onPreviousWeek} aria-label="Previous week"><ChevronLeftIcon /></button>
          <button type="button" className="fv-schedule-today" onClick={onToday}>Today</button>
          <button type="button" onClick={onNextWeek} aria-label="Next week"><ChevronRightIcon /></button>
        </div>
      </div>
      <div className="fv-schedule-week-label">{formatWeekRangeLabel(weekDates)}</div>

      <div className="fv-schedule-table-wrap">
        <table className="fv-schedule-table">
          <thead>
            <tr>
              <th></th>
              {weekDates.map((date, index) => {
                const holiday = getHolidayName(date);

                return (
                  <th key={toISODate(date)}>
                    <span className="fv-th-day">{WEEKDAY_HEADERS[index]}</span>
                    <span className="fv-th-date">{formatMonthDay(date)}</span>
                    {holiday && (
                      <span className="fv-th-holiday">{holiday}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIndex) => (
              <tr key={row.time}>
                <td className="fv-schedule-time">{row.time}</td>
                {row.cells.map((_cell, dayIndex) => {
                  const merged = mergedGrid[rowIndex][dayIndex];
                  // Covered by an earlier row's rowSpan — render nothing here.
                  if (!merged) return null;
                  return (
                    <td
                      key={dayIndex}
                      rowSpan={merged.span}
                      className={`fv-schedule-cell fv-schedule-cell-${merged.status}`}
                    >
                      <ScheduleCellBadge
                        status={merged.status}
                        rangeLabel={merged.rangeLabel}
                        location={merged.location}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="fv-legend">
        <span className="fv-legend-item">
          <span className="fv-legend-dot fv-dot-face-to-face" /> Face-to-Face
        </span>
        <span className="fv-legend-item">
          <span className="fv-legend-dot fv-dot-online" /> Online
        </span>
        <span className="fv-legend-item">
          <span className="fv-legend-dot fv-dot-unavailable" /> Unavailable
        </span>
      </div>
    </div>
  );
}

function ScheduleCellBadge({
  status,
  rangeLabel,
  location,
}: {
  status: SlotStatus;
  rangeLabel: string;
  location: string | null;
}) {
  if (status === 'unavailable') {
    return <span className="fv-cell-dash">–</span>;
  }

  const labelByStatus: Record<Exclude<SlotStatus, 'unavailable'>, string> = {
    'face-to-face': 'Face-to-Face',
    online: 'Online',
  };

  return (
    <div className="fv-cell-merged">
      <span className="fv-cell-time-range">{rangeLabel}</span>
      <span className="fv-cell-label">
        {labelByStatus[status as Exclude<SlotStatus, 'unavailable'>]}
      </span>
      {/* Online's "location" is a meeting link — shown as plain text here
          rather than a clickable link, since faculty can't join early from
          this read-only overview. */}
      {location && <span className="fv-cell-location">{location}</span>}
    </div>
  );
}
// Accepts typed times such as "9:00 AM", "9 PM", "09:00", and "13:00".
function parseTimeInput(value: string): number | null {
  const input = value.trim().replace(/\s+/g, ' ');

  if (!input) return null;

  const twelveHourMatch = input.match(
    /^(\d{1,2})(?::([0-5]\d))?\s*(AM|PM)$/i,
  );

  if (twelveHourMatch) {
    const hour = Number(twelveHourMatch[1]);
    const minute = Number(twelveHourMatch[2] ?? '0');
    const period = twelveHourMatch[3].toUpperCase();

    if (hour < 1 || hour > 12) return null;

    const hourIn24HourTime =
      period === 'AM'
        ? hour === 12
          ? 0
          : hour
        : hour === 12
          ? 12
          : hour + 12;

    return hourIn24HourTime * 60 + minute;
  }

  const twentyFourHourMatch = input.match(
    /^([01]?\d|2[0-3]):([0-5]\d)$/,
  );

  if (twentyFourHourMatch) {
    return (
      Number(twentyFourHourMatch[1]) * 60 +
      Number(twentyFourHourMatch[2])
    );
  }

  return null;
}

function formatTime(minutesAfterMidnight: number): string {
  const hour = Math.floor(minutesAfterMidnight / 60);
  const minute = minutesAfterMidnight % 60;
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}
// Shapes returned from Supabase for this tab.
type DbRecurringRule = {
  id: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  mode: ConsultationMode;
  location: string;
  start_date: string;
  end_date: string;
};

type DbAvailabilitySlot = {
  id: string;
  rule_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  mode: ConsultationMode;
  location: string;
  enabled: boolean;
};

function mapDbRecurringRule(row: DbRecurringRule): RecurringSchedule {
  const startMin = dbTimeToMinutes(row.start_time) ?? 0;
  const endMin = dbTimeToMinutes(row.end_time) ?? 0;
  const daysLabel = [...row.days_of_week]
    .sort((a, b) => a - b)
    .map((d) => DAY_NAMES_SHORT[d])
    .join(', ');
  const formatFullDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  return {
    id: row.id,
    days: daysLabel,
    time: `${formatTime(startMin)} - ${formatTime(endMin)} · ${row.mode}`,
    mode: row.mode,
    dateRange: `${formatFullDate(row.start_date)} – ${formatFullDate(row.end_date)}`,
  };
}

function mapDbSlot(row: DbAvailabilitySlot): TimeSlot {
  const startMin = dbTimeToMinutes(row.start_time) ?? 0;
  const endMin = dbTimeToMinutes(row.end_time) ?? 0;
  return {
    id: row.id,
    ruleId: row.rule_id,
    time: `${formatTime(startMin)} - ${formatTime(endMin)}`,
    mode: row.mode,
    location: row.location,
    enabled: row.enabled,
  };
}

function AvailabilityTab({ facultyId }: { facultyId: string }) {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [recurring, setRecurring] = useState<RecurringSchedule[]>([]);
  const [loadingRecurring, setLoadingRecurring] = useState(true);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [recurringDays, setRecurringDays] = useState<number[]>([1, 3]);
  const [recurringStartText, setRecurringStartText] = useState('1:00 PM');
  const [recurringEndText, setRecurringEndText] = useState('3:00 PM');
  const [recurringMode, setRecurringMode] =
    useState<ConsultationMode>('Face-to-Face');
  const [recurringLocation, setRecurringLocation] = useState('');
  const [recurringWeeks, setRecurringWeeks] = useState('16');
  const [recurringError, setRecurringError] = useState<string | null>(null);
  const [creatingRecurring, setCreatingRecurring] = useState(false);

  const today = new Date();
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(today));
  const [selectedDate, setSelectedDate] = useState(() => today);

  const weekDates = useMemo(() => getWeekDates(weekAnchor), [weekAnchor]);
  const selectedISO = toISODate(selectedDate);

  const goPrevWeek = () => {
    const newAnchor = addDaysToDate(weekAnchor, -7);
    setWeekAnchor(newAnchor);
    setSelectedDate(newAnchor);
  };

  const goNextWeek = () => {
    const newAnchor = addDaysToDate(weekAnchor, 7);
    setWeekAnchor(newAnchor);
    setSelectedDate(newAnchor);
  };

  const selectedHoliday = getHolidayName(selectedDate);

  // The Schedule tab only ever shows the current real week, so let people
  // know when they're editing availability for a week it won't reflect on.
  const isCurrentWeek = isSameDay(weekAnchor, startOfWeek(today));

  // ---------- Load recurring rules for this faculty member ----------
  useEffect(() => {
    let isMounted = true;

    const load = () => {
      supabase
        .from('recurring_rules')
        .select(
          'id, days_of_week, start_time, end_time, mode, location, start_date, end_date',
        )
        .eq('faculty_id', facultyId)
        .order('created_at', { ascending: true })
        .then(({ data, error }) => {
          if (!isMounted) return;
          if (error) {
            console.log('Failed to load recurring schedules:', error.message);
            setLoadingRecurring(false);
            return;
          }
          setRecurring(
            (data as unknown as DbRecurringRule[]).map(mapDbRecurringRule),
          );
          setLoadingRecurring(false);
        });
    };

    load();

    const channel = supabase
      .channel(`recurring-rules-${facultyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recurring_rules',
          filter: `faculty_id=eq.${facultyId}`,
        },
        () => load(),
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [facultyId]);

  const toggleRecurringDay = (dayIndex: number) => {
    setRecurringDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex],
    );
  };

  const openRecurringForm = () => {
    setRecurringError(null);
    setShowRecurringForm((prev) => !prev);
  };

  const canCreateRecurring =
    recurringDays.length > 0 &&
    recurringLocation.trim().length > 0 &&
    (parseInt(recurringWeeks, 10) || 0) > 0 &&
    (parseInt(recurringWeeks, 10) || 0) <= 52;

  const handleCreateRecurring = async () => {
    if (!canCreateRecurring || creatingRecurring) return;

    const startMinutes = parseTimeInput(recurringStartText);
    const endMinutes = parseTimeInput(recurringEndText);

    if (startMinutes === null || endMinutes === null) {
      setRecurringError('Enter valid start and end times, e.g. "1:00 PM".');
      return;
    }
    if (endMinutes <= startMinutes) {
      setRecurringError('End time must be after the start time.');
      return;
    }

    setCreatingRecurring(true);
    setRecurringError(null);

    const rangeStart = new Date();
    rangeStart.setHours(0, 0, 0, 0);
    const numWeeks = parseInt(recurringWeeks, 10) || 16;
    const rangeEnd = addDaysToDate(rangeStart, numWeeks * 7 - 1);
    const location = recurringLocation.trim();

    const { data: newRule, error: ruleError } = await supabase
      .from('recurring_rules')
      .insert({
        faculty_id: facultyId,
        days_of_week: recurringDays,
        start_time: minutesToDbTime(startMinutes),
        end_time: minutesToDbTime(endMinutes),
        mode: recurringMode,
        location,
        start_date: toISODate(rangeStart),
        end_date: toISODate(rangeEnd),
      })
      .select('id')
      .single();

    if (ruleError || !newRule) {
      setRecurringError(
        `Could not create the recurring schedule: ${
          ruleError?.message ?? 'unknown error'
        }`,
      );
      setCreatingRecurring(false);
      return;
    }

    const generatedDates: string[] = [];
    const cursor = new Date(rangeStart);
    let safety = 0;
    while (cursor <= rangeEnd && safety < 400) {
      safety += 1;
      if (recurringDays.includes(cursor.getDay())) {
        generatedDates.push(toISODate(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    // Skip days that already have an overlapping slot (one-off or from another
    // rule) so the same minutes can't be offered - and booked - twice.
    const { data: existingSlots } = await supabase
      .from('availability_slots')
      .select('date, start_time, end_time')
      .eq('faculty_id', facultyId)
      .gte('date', toISODate(rangeStart))
      .lte('date', toISODate(rangeEnd));
    const busyByDate = new Map<string, { start: number; end: number }[]>();
    (existingSlots ?? []).forEach((row) => {
      const s = dbTimeToMinutes(row.start_time);
      const e = dbTimeToMinutes(row.end_time);
      if (s === null || e === null) return;
      busyByDate.set(row.date, [...(busyByDate.get(row.date) ?? []), { start: s, end: e }]);
    });
    const freeDates = generatedDates.filter(
      (iso) =>
        !(busyByDate.get(iso) ?? []).some((r) =>
          timeRangesOverlap(startMinutes, endMinutes, r.start, r.end),
        ),
    );
    const skippedCount = generatedDates.length - freeDates.length;

    if (freeDates.length > 0) {
      const slotRows = freeDates.map((iso) => ({
        faculty_id: facultyId,
        rule_id: newRule.id,
        date: iso,
        start_time: minutesToDbTime(startMinutes),
        end_time: minutesToDbTime(endMinutes),
        mode: recurringMode,
        location,
        total_minutes: endMinutes - startMinutes,
        enabled: true,
      }));

      const { error: slotsError } = await supabase
        .from('availability_slots')
        .insert(slotRows);

      if (slotsError) {
        // Don't leave a rule behind that has no slots.
        await supabase.from('recurring_rules').delete().eq('id', newRule.id);
        setRecurringError(`Could not generate the daily slots: ${slotsError.message}`);
        setCreatingRecurring(false);
        return;
      }
    }
    if (skippedCount > 0) {
      window.alert(`${skippedCount} day(s) were skipped because they overlap existing slots.`);
    }

    setRecurringError(null);
    setRecurringLocation('');
    setShowRecurringForm(false);
    setCreatingRecurring(false);

    if (generatedDates.includes(selectedISO)) {
      loadSlotsRef.current?.();
    }
  };

  const deleteRecurring = async (id: string) => {
    const ok = await confirm({
      title: 'Delete this weekly schedule?',
      message: 'Its future time slots without bookings will be removed. Slots that already have appointments are kept as one-time slots.',
      confirmLabel: 'Yes, Delete',
      danger: true,
    });
    if (!ok) return;
    // Slots that ever had an appointment can't be deleted (foreign key). Delete
    // every slot that can be, and detach only the rest so they stay as
    // one-time slots. (This used to detach ALL of the rule's slots as soon as
    // one delete failed, leaving every future slot behind.)
    const { data: ruleSlots, error: listError } = await supabase
      .from('availability_slots')
      .select('id')
      .eq('rule_id', id);
    if (listError) {
      window.alert(`Could not delete this recurring schedule: ${listError.message}`);
      return;
    }

    const slotIds = (ruleSlots ?? []).map((s) => s.id as string);
    const chunks: string[][] = [];
    for (let i = 0; i < slotIds.length; i += 50) chunks.push(slotIds.slice(i, i + 50));

    const referenced = new Set<string>();
    for (const chunk of chunks) {
      const { data: appts } = await supabase.from('appointments').select('slot_id').in('slot_id', chunk);
      (appts ?? []).forEach((a) => {
        if (a.slot_id) referenced.add(a.slot_id as string);
      });
    }

    for (const chunk of chunks) {
      const deletable = chunk.filter((slotId) => !referenced.has(slotId));
      if (deletable.length > 0) {
        await supabase.from('availability_slots').delete().in('id', deletable);
      }
    }
    if (referenced.size > 0) {
      await supabase
        .from('availability_slots')
        .update({ rule_id: null })
        .in('id', Array.from(referenced));
    }

    const { error } = await supabase.from('recurring_rules').delete().eq('id', id);
    if (error) {
      window.alert(`Could not delete this recurring schedule: ${error.message}`);
      return;
    }

    if (referenced.size > 0) {
      window.alert(`${referenced.size} slot(s) with appointments were kept as one-time slots.`);
    }
    loadSlotsRef.current?.();
  };

  // ---------- Load individual slots for the selected day ----------
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const loadSlotsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = () => {
      setLoadingSlots(true);
      supabase
        .from('availability_slots')
        .select('id, rule_id, date, start_time, end_time, mode, location, enabled')
        .eq('faculty_id', facultyId)
        .eq('date', selectedISO)
        .order('start_time', { ascending: true })
        .then(({ data, error }) => {
          if (!isMounted) return;
          if (error) {
            console.log('Failed to load availability slots:', error.message);
            setLoadingSlots(false);
            return;
          }
          setSlots((data as unknown as DbAvailabilitySlot[]).map(mapDbSlot));
          setLoadingSlots(false);
        });
    };

    loadSlotsRef.current = load;
    load();

    const channel = supabase
      .channel(`availability-slots-${facultyId}-${selectedISO}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'availability_slots',
          filter: `faculty_id=eq.${facultyId}`,
        },
        () => load(),
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [facultyId, selectedISO]);

  const [isAddingSlot, setIsAddingSlot] = useState(false);
  const [newSlotStart, setNewSlotStart] = useState('');
  const [newSlotEnd, setNewSlotEnd] = useState('');
  const [newSlotMode, setNewSlotMode] =
    useState<ConsultationMode>('Face-to-Face');
  const [newSlotLocation, setNewSlotLocation] = useState('');
  const [slotError, setSlotError] = useState<string | null>(null);
  const [addedNotice, setAddedNotice] = useState<string | null>(null);
  const [savingSlot, setSavingSlot] = useState(false);
  const [editTarget, setEditTarget] = useState<
    | { kind: 'slot'; id: string; initial: EditableScheduleValues }
    | { kind: 'rule'; id: string; initial: EditableScheduleValues }
    | null
  >(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const valuesFromTimeSlot = (slot: TimeSlot): EditableScheduleValues => {
    const [startLabel, endLabel] = slot.time.split(' - ');
    const start = parseTimeInput(startLabel) ?? 0;
    const end = parseTimeInput(endLabel) ?? 0;
    const toParts = (minutes: number) => {
      const hour24 = Math.floor(minutes / 60);
      const minute = minutes % 60;
      return {
        hour: String(hour24 % 12 || 12),
        minute: String(minute).padStart(2, '0'),
        period: hour24 >= 12 ? 'PM' : 'AM',
      };
    };
    const a = toParts(start);
    const b = toParts(end);
    return {
      startHour: a.hour, startMinute: a.minute, startPeriod: a.period,
      endHour: b.hour, endMinute: b.minute, endPeriod: b.period,
      mode: slot.mode, location: slot.location,
    };
  };


  const openSlotEdit = async (slotId: string) => {
    const slot = slots.find((item) => item.id === slotId);
    if (!slot) return;
    const { data } = await supabase.from('availability_slots').select('location, mode, start_time, end_time').eq('id', slotId).maybeSingle();
    const initial = valuesFromTimeSlot({ ...slot, location: data?.location ?? slot.location, mode: (data?.mode as ConsultationMode) ?? slot.mode, time: data ? `${formatTime(dbTimeToMinutes(data.start_time) ?? 0)} - ${formatTime(dbTimeToMinutes(data.end_time) ?? 0)}` : slot.time });
    setEditError(null);
    setEditTarget({ kind: 'slot', id: slotId, initial });
  };

  const openRuleEdit = async (ruleId: string) => {
    const { data, error } = await supabase.from('recurring_rules').select('start_time,end_time,mode,location').eq('id', ruleId).maybeSingle();
    if (error || !data) { window.alert(error?.message ?? 'Could not load that schedule.'); return; }
    const start = dbTimeToMinutes(data.start_time) ?? 0;
    const end = dbTimeToMinutes(data.end_time) ?? 0;
    const parts = (m: number) => { const h = Math.floor(m / 60); return { hour: String(h % 12 || 12), minute: String(m % 60).padStart(2, '0'), period: h >= 12 ? 'PM' : 'AM' }; };
    const a = parts(start), b = parts(end);
    setEditError(null);
    setEditTarget({ kind: 'rule', id: ruleId, initial: { startHour:a.hour,startMinute:a.minute,startPeriod:a.period,endHour:b.hour,endMinute:b.minute,endPeriod:b.period,mode:data.mode as ConsultationMode,location:data.location ?? '' } });
  };

  const findBookedSlotIds = async (slotIds: string[]) => {
    const booked = new Set<string>();
    for (let i = 0; i < slotIds.length; i += 50) {
      const { data, error } = await supabase.from('appointments').select('slot_id,status').in('slot_id', slotIds.slice(i, i + 50));
      if (error) throw new Error(error.message);
      ((data ?? []) as { slot_id: string | null; status: string }[]).forEach((row) => {
        if (row.slot_id && !['canceled','cancelled','completed'].includes(row.status)) booked.add(row.slot_id);
      });
    }
    return booked;
  };

  const saveEdit = async (values: EditableScheduleValues) => {
    if (!editTarget || savingEdit) return;
    const start = Number(values.startHour) % 12 + (values.startPeriod === 'PM' ? 12 : 0);
    const end = Number(values.endHour) % 12 + (values.endPeriod === 'PM' ? 12 : 0);
    const startMinutes = start * 60 + Number(values.startMinute);
    const endMinutes = end * 60 + Number(values.endMinute);
    if (startMinutes >= endMinutes) { setEditError('End time must be after the start time.'); return; }
    if (!values.location.trim()) { setEditError(values.mode === 'Online' ? 'Enter a meeting link or platform.' : 'Enter a location.'); return; }
    setSavingEdit(true); setEditError(null);
    try {
      if (editTarget.kind === 'slot') {
        const slot = slots.find((item) => item.id === editTarget.id);
        if (!slot) throw new Error('That slot is no longer available.');
        const booked = await findBookedSlotIds([editTarget.id]);
        if (booked.has(editTarget.id)) throw new Error('This slot has a booked appointment, so it cannot be edited. Turn it off or cancel the appointment first.');
        const overlap = slots.some((item) => { const [a, b] = item.time.split(' - '); const itemStart = parseTimeInput(a ?? ''); const itemEnd = parseTimeInput(b ?? ''); return item.id !== editTarget.id && itemStart !== null && itemEnd !== null && timeRangesOverlap(startMinutes, endMinutes, itemStart, itemEnd); });
        if (overlap) throw new Error('That time overlaps another slot on this day.');
        const { data, error } = await supabase.from('availability_slots').update({start_time:minutesToDbTime(startMinutes),end_time:minutesToDbTime(endMinutes),mode:values.mode,location:values.location.trim(),total_minutes:endMinutes-startMinutes}).eq('id',editTarget.id).select('id,rule_id,date,start_time,end_time,mode,location,enabled').maybeSingle();
        if (error || !data) throw new Error(error?.message ?? 'Could not update the slot.');
        setSlots((prev) => prev.map((item) => item.id === editTarget.id ? mapDbSlot(data as unknown as DbAvailabilitySlot) : item));
        setAddedNotice('Time slot updated successfully.');
      } else {
        const { data: ruleSlots, error } = await supabase.from('availability_slots').select('id,date').eq('rule_id',editTarget.id).gte('date',toISODate(new Date()));
        if (error) throw new Error(error.message);
        const upcoming = (ruleSlots ?? []) as {id:string;date:string}[];
        const booked = await findBookedSlotIds(upcoming.map((row)=>row.id));
        const editable = upcoming.filter((row)=>!booked.has(row.id));
        const editableIds = new Set(editable.map((row)=>row.id));
        const { data: otherSlots } = await supabase.from('availability_slots').select('id,date,start_time,end_time').eq('faculty_id',facultyId).gte('date',toISODate(new Date()));
        const conflict = (otherSlots ?? []).some((row) => editableIds.has(row.id) ? false : editable.some((item)=>item.date===row.date && timeRangesOverlap(startMinutes,endMinutes,dbTimeToMinutes(row.start_time) ?? 0,dbTimeToMinutes(row.end_time) ?? 0)));
        if (conflict) throw new Error('The new time overlaps another availability slot on at least one upcoming date.');
        const { error: ruleError } = await supabase.from('recurring_rules').update({start_time:minutesToDbTime(startMinutes),end_time:minutesToDbTime(endMinutes),mode:values.mode,location:values.location.trim()}).eq('id',editTarget.id);
        if (ruleError) throw new Error(ruleError.message);
        for (let i=0;i<editable.length;i+=50) {
          const { error: slotError } = await supabase.from('availability_slots').update({start_time:minutesToDbTime(startMinutes),end_time:minutesToDbTime(endMinutes),mode:values.mode,location:values.location.trim(),total_minutes:endMinutes-startMinutes}).in('id',editable.slice(i,i+50).map((row)=>row.id));
          if (slotError) throw new Error(slotError.message);
        }
        loadSlotsRef.current?.();
        setAddedNotice(booked.size ? `Weekly schedule updated. ${booked.size} booked slot(s) kept unchanged.` : 'Weekly schedule updated successfully.');
      }
      setEditTarget(null);
    } catch (error) { setEditError(error instanceof Error ? error.message : 'Could not save the changes.'); }
    finally { setSavingEdit(false); }
  };

  const toggleSlot = async (id: string) => {
    const slot = slots.find((s) => s.id === id);
    if (!slot) return;

    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    );

    const { error } = await supabase
      .from('availability_slots')
      .update({ enabled: !slot.enabled })
      .eq('id', id);

    if (error) {
      setSlots((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled: slot.enabled } : s)),
      );
      window.alert(`Could not update that slot: ${error.message}`);
    }
  };

  const deleteSlot = async (id: string) => {
    const ok = await confirm({
      title: 'Delete this time slot?',
      message: 'Students will no longer be able to book it.',
      confirmLabel: 'Yes, Delete',
      danger: true,
    });
    if (!ok) return;
    const previous = slots;
    setSlots((prev) => prev.filter((s) => s.id !== id));

    const { error } = await supabase
      .from('availability_slots')
      .delete()
      .eq('id', id);

    if (error) {
      setSlots(previous);
      window.alert(
        error.code === '23503'
          ? "This slot has appointments on record and can't be deleted. Turn it off instead."
          : `Could not delete that slot: ${error.message}`,
      );
    }
  };

  const openAddSlot = () => {
    setSlotError(null);
    setAddedNotice(null);
    setNewSlotStart('');
    setNewSlotEnd('');
    setNewSlotMode('Face-to-Face');
    setNewSlotLocation('');
    setIsAddingSlot(true);
  };

  const cancelAddSlot = () => {
    setIsAddingSlot(false);
    setSlotError(null);
  };

  const confirmAddSlot = async () => {
    if (savingSlot) return;

    const startMinutes = parseTimeInput(newSlotStart);
    const endMinutes = parseTimeInput(newSlotEnd);

    if (startMinutes === null || endMinutes === null) {
      setSlotError('Enter valid times, such as 9:00 AM or 13:00.');
      return;
    }

    if (startMinutes >= endMinutes) {
      setSlotError('End time must be after start time.');
      return;
    }

    if (!newSlotLocation.trim()) {
      setSlotError(
        newSlotMode === 'Online'
          ? 'Please enter a meeting link or platform (e.g. Google Meet, Zoom).'
          : 'Please enter a location (e.g. Room 204, CITE Building).',
      );
      return;
    }

    const time = `${formatTime(startMinutes)} - ${formatTime(endMinutes)}`;

    const overlaps = slots.some((slot) => {
      const [from, to] = slot.time.split(' - ');
      const s = parseTimeInput(from ?? '');
      const e = parseTimeInput(to ?? '');
      return s !== null && e !== null && timeRangesOverlap(startMinutes, endMinutes, s, e);
    });
    if (overlaps) {
      setSlotError('That time overlaps another slot on this day.');
      return;
    }

    setSavingSlot(true);

    const { data, error } = await supabase
      .from('availability_slots')
      .insert({
        faculty_id: facultyId,
        rule_id: null,
        date: selectedISO,
        start_time: minutesToDbTime(startMinutes),
        end_time: minutesToDbTime(endMinutes),
        mode: newSlotMode,
        location: newSlotLocation.trim(),
        total_minutes: endMinutes - startMinutes,
        enabled: true,
      })
      .select('id, rule_id, date, start_time, end_time, mode, location, enabled')
      .single();

    setSavingSlot(false);

    if (error || !data) {
      setSlotError(`Could not add that slot: ${error?.message ?? 'unknown error'}`);
      return;
    }

    setSlots((prev) => [...prev, mapDbSlot(data as unknown as DbAvailabilitySlot)]);
    setIsAddingSlot(false);
    setSlotError(null);
    setAddedNotice(
      isCurrentWeek
        ? `Added ${time} — it now shows as Available on the Schedule tab.`
        : `Added ${time} for ${selectedDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}.`,
    );
  };

  const renderEditModal = () => {
    if (!editTarget) return null;
    const initial = editTarget.initial;
    return (
      <div className="fv-edit-overlay" role="dialog" aria-modal="true">
        <div className="fv-edit-modal">
          <div className="fv-edit-modal-header">
            <div><h3>{editTarget.kind === 'rule' ? 'Edit Weekly Schedule' : 'Edit Time Slot'}</h3><p>{editTarget.kind === 'rule' ? 'Changes apply to upcoming slots without booked appointments.' : 'Booked slots cannot be edited.'}</p></div>
            <button type="button" onClick={() => setEditTarget(null)} aria-label="Close">×</button>
          </div>
          <div className="fv-add-slot-row">
            <div className="fv-add-slot-field"><label>Start Time</label><input defaultValue={`${initial.startHour}:${initial.startMinute} ${initial.startPeriod}`} id="fv-edit-start" /></div>
            <div className="fv-add-slot-field"><label>End Time</label><input defaultValue={`${initial.endHour}:${initial.endMinute} ${initial.endPeriod}`} id="fv-edit-end" /></div>
          </div>
          <div className="fv-add-slot-field fv-add-slot-field-wide"><label>Consultation Type</label><select id="fv-edit-mode" defaultValue={initial.mode}><option value="Face-to-Face">Face-to-Face</option><option value="Online">Online</option></select></div>
          <div className="fv-add-slot-field fv-add-slot-field-wide"><label>Location / Meeting Link</label><input id="fv-edit-location" defaultValue={initial.location} /></div>
          {editError && <p className="fv-slot-error">{editError}</p>}
          <div className="fv-add-slot-actions">
            <button type="button" className="fv-add-slot-cancel" onClick={() => setEditTarget(null)} disabled={savingEdit}>Cancel</button>
            <button type="button" className="fv-add-slot-confirm" disabled={savingEdit} onClick={() => {
              const start = (document.getElementById('fv-edit-start') as HTMLInputElement)?.value ?? '';
              const end = (document.getElementById('fv-edit-end') as HTMLInputElement)?.value ?? '';
              const mode = ((document.getElementById('fv-edit-mode') as HTMLSelectElement)?.value ?? initial.mode) as ConsultationMode;
              const location = (document.getElementById('fv-edit-location') as HTMLInputElement)?.value ?? '';
              const [sh, smp='00', sp='AM'] = start.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)?.slice(1) ?? [];
              const [eh, emp='00', ep='AM'] = end.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)?.slice(1) ?? [];
              if (!sh || !eh) { setEditError('Enter valid times such as 9:00 AM.'); return; }
              void saveEdit({startHour:sh,startMinute:smp,startPeriod:sp.toUpperCase(),endHour:eh,endMinute:emp,endPeriod:ep.toUpperCase(),mode,location});
            }}>{savingEdit ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fv-availability">
      <div className="fv-avail-header">
        <h2>Faculty Availability &amp; Location</h2>
        <p>Set your office hours and where students can find you.</p>
      </div>

      <button
        type="button"
        className="fv-recurring-banner"
        onClick={openRecurringForm}
      >
        <span className="fv-recurring-banner-text">
          <StarIcon /> Get a Recurring Weekly Schedule
        </span>
        <ChevronRightIcon />
      </button>

      {showRecurringForm && (
        <div className="fv-card fv-recurring-form">
          <h3>Recurring Weekly Schedule</h3>
          <p className="fv-recurring-form-intro">
            Set a schedule that repeats automatically every week for the
            rest of the semester — no need to add it week by week.
          </p>

          <p className="fv-select-day-label">Repeat on these days</p>
          <div className="fv-day-chips">
            {DAY_NAMES_SHORT.map((label, index) => (
              <button
                key={label}
                type="button"
                className={`fv-day-chip${
                  recurringDays.includes(index) ? ' fv-day-chip-active' : ''
                }`}
                onClick={() => toggleRecurringDay(index)}
              >
                <span className="fv-day-chip-label">{label}</span>
              </button>
            ))}
          </div>

          <div className="fv-add-slot-row">
            <div className="fv-add-slot-field">
              <label htmlFor="rec-start">Start Time</label>
              <input
                id="rec-start"
                type="text"
                placeholder="1:00 PM"
                value={recurringStartText}
                onChange={(event) =>
                  setRecurringStartText(event.target.value)
                }
              />
            </div>
            <div className="fv-add-slot-field">
              <label htmlFor="rec-end">End Time</label>
              <input
                id="rec-end"
                type="text"
                placeholder="3:00 PM"
                value={recurringEndText}
                onChange={(event) => setRecurringEndText(event.target.value)}
              />
            </div>
          </div>

          <p className="fv-select-day-label">Consultation Type</p>
          <div className="fv-modal-mode-toggle">
            <button
              type="button"
              className={`fv-mode-btn${
                recurringMode === 'Face-to-Face' ? ' fv-mode-btn-active' : ''
              }`}
              onClick={() => setRecurringMode('Face-to-Face')}
            >
              Face-to-Face
            </button>
            <button
              type="button"
              className={`fv-mode-btn${
                recurringMode === 'Online' ? ' fv-mode-btn-active' : ''
              }`}
              onClick={() => setRecurringMode('Online')}
            >
              Online
            </button>
          </div>

          <div className="fv-add-slot-field fv-add-slot-field-wide">
            <label htmlFor="rec-location">
              {recurringMode === 'Online' ? 'Meeting Link' : 'Location'}
            </label>
            <input
              id="rec-location"
              type="text"
              placeholder={
                recurringMode === 'Online'
                  ? 'Enter meeting link (e.g. Google Meet, Zoom)'
                  : 'Enter room or location (e.g. Room 204)'
              }
              value={recurringLocation}
              onChange={(event) => setRecurringLocation(event.target.value)}
            />
          </div>

          <div className="fv-add-slot-field fv-recurring-weeks-field">
            <label htmlFor="rec-weeks">Repeat for how many weeks</label>
            <input
              id="rec-weeks"
              type="number"
              min={1}
              max={30}
              value={recurringWeeks}
              onChange={(event) => setRecurringWeeks(event.target.value)}
            />
          </div>
          <p className="fv-slots-hint">
            A typical semester runs about 16 weeks. Slots will be created
            automatically for every matching day until then.
          </p>

          {recurringError && (
            <p className="fv-slot-error">{recurringError}</p>
          )}

          <div className="fv-add-slot-actions">
            <button
              type="button"
              className="fv-add-slot-cancel"
              onClick={() => setShowRecurringForm(false)}
              disabled={creatingRecurring}
            >
              Cancel
            </button>
            <button
              type="button"
              className="fv-add-slot-confirm"
              disabled={!canCreateRecurring || creatingRecurring}
              onClick={handleCreateRecurring}
            >
              {creatingRecurring ? 'Creating…' : 'Create Recurring Schedule'}
            </button>
          </div>
        </div>
      )}

      <div
        className={`fv-availability-columns${
          recurring.length === 0 ? ' fv-availability-columns-single' : ''
        }`}
      >
        {loadingRecurring ? (
          <div className="fv-card fv-active-schedules-card">
            <h3>Active Weekly Schedules</h3>
            <p className="fv-empty-slots">Loading…</p>
          </div>
        ) : (
          recurring.length > 0 && (
            <div className="fv-card fv-active-schedules-card">
              <h3>Active Weekly Schedules</h3>

              <div className="fv-recurring-list">
              {recurring.map((rule) => (
                <div key={rule.id} className="fv-recurring-row">
                  <div>
                    <p className="fv-recurring-days">{rule.days}</p>
                    <p className="fv-recurring-detail">{rule.time}</p>
                    <p className="fv-recurring-range">{rule.dateRange}</p>
                  </div>

                  <div className="fv-recurring-actions">
                    <button type="button" className="fv-edit-small" onClick={() => openRuleEdit(rule.id)}>Edit</button>
                    <button
                      type="button"
                      aria-label="Delete schedule"
                      className="fv-icon-danger"
                      onClick={() => deleteRecurring(rule.id)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
              </div>
            </div>
          )
        )}

        <div className="fv-card fv-day-picker-card">
        <div className="fv-week-nav">
          <button
            type="button"
            aria-label="Previous week"
            onClick={goPrevWeek}
          >
            <ChevronLeftIcon />
          </button>
          <span>{formatWeekRangeLabel(weekDates)}</span>
          <button type="button" aria-label="Next week" onClick={goNextWeek}>
            <ChevronRightIcon />
          </button>
        </div>

        <p className="fv-select-day-label">Select Day</p>

        <div className="fv-day-chips">
          {weekDates.map((date, index) => {
            const iso = toISODate(date);
            const holiday = getHolidayName(date);
            const isSelected = selectedISO === iso;
            const isToday = isSameDay(date, today);

            return (
              <button
                key={iso}
                type="button"
                className={`fv-day-chip${
                  isSelected ? ' fv-day-chip-active' : ''
                }${isToday && !isSelected ? ' fv-day-chip-today' : ''}${
                  holiday ? ' fv-day-chip-holiday' : ''
                }`}
                title={holiday ?? undefined}
                onClick={() => {
                  setSelectedDate(date);
                  setAddedNotice(null);
                }}
              >
                <span className="fv-day-chip-label">
                  {WEEKDAY_HEADERS[index]}
                </span>
                <span className="fv-day-chip-date">{date.getDate()}</span>
                {holiday && <span className="fv-day-chip-holiday-dot" />}
              </button>
            );
          })}
        </div>

        {selectedHoliday && (
          <p className="fv-holiday-banner">
            <StarIcon /> {selectedHoliday} — this day is a Philippine holiday.
          </p>
        )}

        <div className="fv-slots-header">
          <p>Time Slots</p>

          {!isAddingSlot && (
            <button
              type="button"
              className="fv-add-slot-button"
              onClick={openAddSlot}
            >
              <PlusIcon /> Add Time Slot
            </button>
          )}
        </div>

        <p className="fv-slots-hint">
          {isCurrentWeek
            ? 'Slots you add here automatically appear as “Available” for that day on the Schedule tab.'
            : 'This slot will be saved, but the Schedule tab only shows the current week — come back to it once this week arrives.'}
        </p>

        {addedNotice && (
          <div className="fv-slots-added-notice">
            <CheckSmallIcon />
            <span>{addedNotice}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setAddedNotice(null)}
            >
              <XSmallIcon />
            </button>
          </div>
        )}

        {isAddingSlot && (
          <div className="fv-add-slot-form">
            <div className="fv-add-slot-row">
              <div className="fv-add-slot-field">
                <label htmlFor="new-slot-start">Start time</label>
                <input
                  id="new-slot-start"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  placeholder="e.g. 9:00 AM"
                  value={newSlotStart}
                  onChange={(event) => {
                    setNewSlotStart(event.target.value);
                    setSlotError(null);
                  }}
                />
              </div>

              <div className="fv-add-slot-field">
                <label htmlFor="new-slot-end">End time</label>
                <input
                  id="new-slot-end"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  placeholder="e.g. 10:30 AM"
                  value={newSlotEnd}
                  onChange={(event) => {
                    setNewSlotEnd(event.target.value);
                    setSlotError(null);
                  }}
                />
              </div>

              <div className="fv-add-slot-field">
                <label htmlFor="new-slot-mode">Mode</label>
                <select
                  id="new-slot-mode"
                  value={newSlotMode}
                  onChange={(event) => {
                    const mode = event.target.value as ConsultationMode;
                    setNewSlotMode(mode);
                    setNewSlotLocation('');
                  }}
                >
                  <option value="Face-to-Face">Face-to-Face</option>
                  <option value="Online">Online</option>
                </select>
              </div>
            </div>

            <p
              style={{
                margin: '0 0 10px',
                fontSize: '11.5px',
                color: '#6b7280',
              }}
            >
              Type a time like 9:00 AM, 9 PM, or 13:00.
            </p>

            <div className="fv-add-slot-row">
              <div className="fv-add-slot-field fv-add-slot-field-wide">
                <label htmlFor="new-slot-location">
                  {newSlotMode === 'Online'
                    ? 'Meeting link / platform'
                    : 'Location'}
                </label>

                <input
                  id="new-slot-location"
                  type="text"
                  placeholder={
                    newSlotMode === 'Online'
                      ? 'e.g. Google Meet, Zoom link'
                      : 'e.g. Room 204, CITE Building'
                  }
                  value={newSlotLocation}
                  onChange={(event) =>
                    setNewSlotLocation(event.target.value)
                  }
                />
              </div>
            </div>

            {slotError && <p className="fv-slot-error">{slotError}</p>}

            <div className="fv-add-slot-actions">
              <button
                type="button"
                className="fv-add-slot-cancel"
                onClick={cancelAddSlot}
                disabled={savingSlot}
              >
                Cancel
              </button>

              <button
                type="button"
                className="fv-add-slot-confirm"
                onClick={confirmAddSlot}
                disabled={savingSlot}
              >
                {savingSlot ? 'Adding…' : 'Add Slot'}
              </button>
            </div>
          </div>
        )}

        {loadingSlots ? (
          <p className="fv-empty-slots">Loading time slots…</p>
        ) : slots.length === 0 ? (
          <p className="fv-empty-slots">No time slots for this day.</p>
        ) : (
          slots.map((slot) => (
            <div key={slot.id} className="fv-slot-row">
              <div>
                <p className="fv-slot-time">{slot.time}</p>
                <p className="fv-slot-mode">
                  {slot.mode}
                  {slot.location && ` · ${slot.location}`}
                </p>
              </div>

              <div className="fv-slot-actions">
                <button type="button" className="fv-edit-small" onClick={() => openSlotEdit(slot.id)} disabled={!slot.enabled}>Edit</button>
                <button
                  type="button"
                  className={`fv-toggle${
                    slot.enabled ? ' fv-toggle-on' : ''
                  }`}
                  onClick={() => toggleSlot(slot.id)}
                  aria-label="Toggle slot"
                >
                  <span className="fv-toggle-knob" />
                </button>

                {!slot.enabled && (
                  <button
                    type="button"
                    className="fv-icon-danger"
                    onClick={() => deleteSlot(slot.id)}
                    aria-label="Delete slot"
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            </div>
          ))
        )}

        <button
          type="button"
          className="fv-save-button"
          onClick={() =>
            setAddedNotice('All changes here are already saved automatically.')
          }
        >
          Save Availability
        </button>
      </div>
      </div>
      {renderEditModal()}
      {confirmDialog}
    </div>
  );
}

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8.5" r="3.6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4.5 19.2c1.1-3.6 4.2-5.4 7.5-5.4s6.4 1.8 7.5 5.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-1.6A1.5 1.5 0 0 1 9.8 4.6h4.4a1.5 1.5 0 0 1 1.3.8L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0-.8 12.2a2 2 0 0 1-2 1.8H8.8a2 2 0 0 1-2-1.8L6 7h12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="m4 7 8 6 8-6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <rect
        x="4"
        y="3"
        width="12"
        height="18"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 7h4M8 11h4M8 15h4M16 10h4v11h-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="m12 3 2.6 5.7 6.2.6-4.6 4.2 1.3 6.1L12 16.8 6.5 19.6l1.3-6.1L3.2 9.3l6.2-.6L12 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M15 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckSmallIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12.5l4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XSmallIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}