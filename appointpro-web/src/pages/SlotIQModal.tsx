import { useMemo, useState } from 'react';
import {
  computeFreeBlocks,
  findOverlapError,
  formatTime12,
  generateSlotIQSchedule,
  rangeLengthMinutes,
  saveSlotIQSuggestions,
  toDateKey,
  toFullTime,
  type SlotIQOptions,
  type SlotIQResult,
  type TimeRange,
} from '../lib/slotiq';
import './SlotIQModal.css';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Show the week Monday -> Sunday.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const MAX_CLASSES_PER_DAY = 6;
const DURATION_CHOICES = [15, 30, 45, 60];

type ClassBox = { start: string; end: string }; // "HH:MM" from <input type="time">
type Step = 'classes' | 'prefs' | 'results';

type Props = {
  facultyId: string;
  onClose: () => void;
  // Called after the approved schedule was saved.
  onSaved: (message: string) => void;
};

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

const timeRangeText = (r: TimeRange) => `${formatTime12(r.startTime)} – ${formatTime12(r.endTime)}`;

export default function SlotIQModal({ facultyId, onClose, onSaved }: Props) {
  // Computed once when the modal opens: today, and the latest allowed end date (one year out).
  const [{ today, maxDate }] = useState(() => {
    const now = new Date();
    const latest = new Date(now);
    latest.setDate(latest.getDate() + 365);
    return { today: toDateKey(now), maxDate: toDateKey(latest) };
  });

  const [step, setStep] = useState<Step>('classes');
  const [availableDays, setAvailableDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [windowStart, setWindowStart] = useState('08:00');
  const [windowEnd, setWindowEnd] = useState('17:00');
  const [classes, setClasses] = useState<Record<number, ClassBox[]>>({});

  const [semesterEnd, setSemesterEnd] = useState(toDateKey(addMonths(new Date(), 4)));
  const [duration, setDuration] = useState(30);
  const [minPerDay, setMinPerDay] = useState(2);
  const [maxPerDay, setMaxPerDay] = useState(4);
  const [mode, setMode] = useState<'Face-to-Face' | 'Online'>('Face-to-Face');
  const [location, setLocation] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SlotIQResult | null>(null);
  // The end date the current result was generated for (the field may be edited afterwards).
  const [generatedEnd, setGeneratedEnd] = useState<string | null>(null);

  const windowRange = useMemo<TimeRange | null>(
    () =>
      windowStart && windowEnd && windowStart < windowEnd
        ? { startTime: toFullTime(windowStart), endTime: toFullTime(windowEnd) }
        : null,
    [windowStart, windowEnd],
  );

  // Per-day parsed class ranges + validation.
  const days = useMemo(
    () =>
      DAY_ORDER.map((day) => {
        const boxes = classes[day] ?? [];
        const incomplete = boxes.some((b) => (b.start || b.end) && !(b.start && b.end));
        const reversed = boxes.some((b) => b.start && b.end && b.start >= b.end);
        const ranges: TimeRange[] = boxes
          .filter((b) => b.start && b.end && b.start < b.end)
          .map((b) => ({ startTime: toFullTime(b.start), endTime: toFullTime(b.end) }));
        const dayError = incomplete
          ? 'Fill in both the start and end of each class time.'
          : reversed
            ? 'A class must end after it starts.'
            : findOverlapError(ranges);
        const available = availableDays.includes(day);
        const free = available && windowRange && !dayError ? computeFreeBlocks(windowRange, ranges) : [];
        return { day, available, boxes, ranges, error: dayError, free };
      }),
    [classes, availableDays, windowRange],
  );

  const activeDays = days.filter((d) => d.available);

  const toggleDay = (day: number) =>
    setAvailableDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));

  const setBox = (day: number, index: number, patch: Partial<ClassBox>) =>
    setClasses((prev) => {
      const boxes = [...(prev[day] ?? [])];
      boxes[index] = { ...boxes[index], ...patch };
      return { ...prev, [day]: boxes };
    });
  const addBox = (day: number) =>
    setClasses((prev) => {
      const boxes = prev[day] ?? [];
      if (boxes.length >= MAX_CLASSES_PER_DAY) return prev;
      return { ...prev, [day]: [...boxes, { start: '', end: '' }] };
    });
  const removeBox = (day: number, index: number) =>
    setClasses((prev) => ({ ...prev, [day]: (prev[day] ?? []).filter((_, i) => i !== index) }));

  // Validates step 1; returns an error message or null.
  const classesProblem = (): string | null => {
    if (!windowRange) return 'Set consultation hours where the start is before the end.';
    if (!activeDays.length) return 'Turn on at least one consultation day.';
    const bad = activeDays.find((d) => d.error);
    if (bad) return `${DAY_NAMES[bad.day]}: ${bad.error}`;
    return null;
  };

  const goToPrefs = () => {
    const problem = classesProblem();
    setError(problem);
    if (!problem) setStep('prefs');
  };

  const generate = async () => {
    const problem = classesProblem();
    if (problem) {
      setError(problem);
      setStep('classes');
      return;
    }
    if (!semesterEnd || semesterEnd < today) {
      setError('Choose a semester end date on or after today.');
      return;
    }
    if (semesterEnd > maxDate) {
      setError('Choose a semester end date within one year from today.');
      return;
    }
    if (minPerDay < 1 || maxPerDay < 1 || minPerDay > 12 || maxPerDay > 12) {
      setError('Suggestions per day must be between 1 and 12.');
      return;
    }
    if (minPerDay > maxPerDay) {
      setError('The minimum suggestions per day cannot be higher than the maximum.');
      return;
    }
    if (!location.trim()) {
      setError(mode === 'Online' ? 'Enter the meeting platform or link.' : 'Enter the consultation room/location.');
      return;
    }
    const hasRoom = activeDays.some((d) => d.free.some((r) => rangeLengthMinutes(r) >= duration));
    if (!hasRoom) {
      setError(
        `Your classes leave no free gap of ${duration} minutes inside your consultation hours. Try shorter consultations or wider hours.`,
      );
      return;
    }

    const options: SlotIQOptions = {
      semesterEndDate: semesterEnd,
      consultationDurationMinutes: duration,
      preferredMode: mode,
      preferredLocation: location.trim(),
      minSlotsPerDay: minPerDay,
      maxSlotsPerDay: maxPerDay,
      classSchedule: activeDays.flatMap((d) =>
        d.ranges.map((r) => ({ dayOfWeek: d.day, startTime: r.startTime, endTime: r.endTime })),
      ),
      availableDays: activeDays.map((d) => d.day),
      windowStart: windowRange!.startTime,
      windowEnd: windowRange!.endTime,
    };

    setError(null);
    setLoading(true);
    setResult(null);
    setGeneratedEnd(null);
    try {
      const generated = await generateSlotIQSchedule(options);
      setResult(generated);
      setGeneratedEnd(options.semesterEndDate);
      setStep('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate a schedule.');
    } finally {
      setLoading(false);
    }
  };

  const approve = async () => {
    if (!result?.suggestions.length || !generatedEnd) return;
    setError(null);
    setSaving(true);
    try {
      const { saved, skippedSlots } = await saveSlotIQSuggestions(facultyId, result.suggestions, generatedEnd);
      const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
      if (saved === 0) {
        onSaved('These times already exist in your schedule, so nothing new was added.');
      } else if (skippedSlots > 0) {
        onSaved(
          `${plural(saved, 'SlotIQ schedule')} saved. ${plural(skippedSlots, 'slot')} skipped because they already exist.`,
        );
      } else {
        onSaved(`${plural(saved, 'SlotIQ schedule')} saved for the semester.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the schedule. Please try again.');
      setSaving(false);
    }
  };

  const busy = loading || saving;
  const steps: { id: Step; label: string }[] = [
    { id: 'classes', label: '1. Classes' },
    { id: 'prefs', label: '2. Preferences' },
    { id: 'results', label: '3. Results' },
  ];

  return (
    <div className="siq-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="siq-modal" role="dialog" aria-modal="true" aria-labelledby="siq-title">
        <header className="siq-header">
          <div>
            <h2 id="siq-title">SlotIQ</h2>
            <p>Tell SlotIQ when you teach and it suggests consultation slots for the semester.</p>
          </div>
          <button type="button" className="siq-close" aria-label="Close" onClick={onClose} disabled={busy}>
            ×
          </button>
        </header>

        <ol className="siq-steps">
          {steps.map((s) => (
            <li key={s.id} className={s.id === step ? 'siq-step siq-step-active' : 'siq-step'}>
              {s.label}
            </li>
          ))}
        </ol>

        <div className="siq-body">
          {step === 'classes' && (
            <>
              <section className="siq-section">
                <h3>Consultation hours</h3>
                <p className="siq-help">SlotIQ only suggests times inside this daily window.</p>
                <div className="siq-row">
                  <input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
                  <span>to</span>
                  <input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
                </div>
              </section>

              <section className="siq-section">
                <h3>Days &amp; class times</h3>
                <p className="siq-help">
                  Turn on the days you accept consultations, then add the times you are teaching (busy) on each day.
                </p>
                {days.map((d) => (
                  <div key={d.day} className={`siq-day${d.available ? '' : ' siq-day-off'}`}>
                    <div className="siq-day-head">
                      <label className="siq-toggle">
                        <input type="checkbox" checked={d.available} onChange={() => toggleDay(d.day)} />
                        <span>{DAY_NAMES[d.day]}</span>
                      </label>
                      {d.available && !d.error && windowRange && (
                        <span className="siq-free">
                          {d.free.length ? `Free: ${d.free.map(timeRangeText).join(', ')}` : 'No free time'}
                        </span>
                      )}
                    </div>
                    {d.available && (
                      <>
                        {d.boxes.map((b, i) => (
                          <div className="siq-row" key={i}>
                            <input type="time" value={b.start} onChange={(e) => setBox(d.day, i, { start: e.target.value })} aria-label={`${DAY_NAMES[d.day]} class ${i + 1} start`} />
                            <span>to</span>
                            <input type="time" value={b.end} onChange={(e) => setBox(d.day, i, { end: e.target.value })} aria-label={`${DAY_NAMES[d.day]} class ${i + 1} end`} />
                            <button type="button" className="siq-link siq-link-danger" onClick={() => removeBox(d.day, i)}>
                              Remove
                            </button>
                          </div>
                        ))}
                        {d.error && <p className="siq-field-error">{d.error}</p>}
                        {d.boxes.length < MAX_CLASSES_PER_DAY && (
                          <button type="button" className="siq-link" onClick={() => addBox(d.day)}>
                            + Add class time
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </section>
            </>
          )}

          {step === 'prefs' && (
            <section className="siq-section siq-grid">
              <label className="siq-field">
                <span>Semester end date</span>
                <input type="date" value={semesterEnd} min={today} max={maxDate} onChange={(e) => setSemesterEnd(e.target.value)} />
              </label>
              <label className="siq-field">
                <span>Consultation length</span>
                <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                  {DURATION_CHOICES.map((m) => (
                    <option key={m} value={m}>
                      {m} minutes
                    </option>
                  ))}
                </select>
              </label>
              <label className="siq-field">
                <span>Min suggestions per day</span>
                <input type="number" min={1} max={12} value={minPerDay} onChange={(e) => setMinPerDay(Number(e.target.value))} />
              </label>
              <label className="siq-field">
                <span>Max suggestions per day</span>
                <input type="number" min={1} max={12} value={maxPerDay} onChange={(e) => setMaxPerDay(Number(e.target.value))} />
              </label>
              <label className="siq-field">
                <span>Mode</span>
                <select value={mode} onChange={(e) => setMode(e.target.value as 'Face-to-Face' | 'Online')}>
                  <option value="Face-to-Face">Face-to-Face</option>
                  <option value="Online">Online</option>
                </select>
              </label>
              <label className="siq-field">
                <span>{mode === 'Online' ? 'Meeting platform or link' : 'Room / location'}</span>
                <input
                  type="text"
                  value={location}
                  placeholder={mode === 'Online' ? 'e.g. Google Meet' : 'e.g. Faculty Room 3'}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </label>
            </section>
          )}

          {step === 'results' && result && (
            <section className="siq-section">
              {result.summary && <p className="siq-summary">{result.summary}</p>}
              {result.suggestions.length === 0 ? (
                <p className="siq-help">SlotIQ had no suggestions. Go back and widen your hours or shorten the length.</p>
              ) : (
                <ul className="siq-suggestions">
                  {result.suggestions.map((s, i) => (
                    <li key={i} className="siq-suggestion">
                      <div className="siq-suggestion-top">
                        <strong>{[...s.daysOfWeek].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => DAY_NAMES[d].slice(0, 3)).join(', ')}</strong>
                        <span>{timeRangeText({ startTime: toFullTime(s.startTime), endTime: toFullTime(s.endTime) })}</span>
                      </div>
                      <div className="siq-suggestion-meta">
                        {s.mode} · {s.location}
                      </div>
                      {s.reason && <div className="siq-suggestion-reason">{s.reason}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {error && (
            <p className="siq-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <footer className="siq-footer">
          {step === 'classes' && (
            <>
              <button type="button" className="siq-btn siq-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="siq-btn siq-btn-primary" onClick={goToPrefs}>
                Next
              </button>
            </>
          )}
          {step === 'prefs' && (
            <>
              <button type="button" className="siq-btn siq-btn-secondary" onClick={() => { setError(null); setStep('classes'); }} disabled={loading}>
                Back
              </button>
              <button type="button" className="siq-btn siq-btn-primary" onClick={generate} disabled={loading}>
                {loading ? 'Generating…' : 'Generate with SlotIQ'}
              </button>
            </>
          )}
          {step === 'results' && (
            <>
              <button type="button" className="siq-btn siq-btn-secondary" onClick={() => { setError(null); setStep('prefs'); }} disabled={saving}>
                Back
              </button>
              <button
                type="button"
                className="siq-btn siq-btn-primary"
                onClick={approve}
                disabled={saving || !result?.suggestions.length}
              >
                {saving ? 'Saving…' : 'Approve & save'}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}