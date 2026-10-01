import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MODES = ['Face-to-Face', 'Online'];

const suggestionSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          daysOfWeek: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } },
          startTime: { type: 'string', description: '24-hour HH:MM:SS' },
          endTime: { type: 'string', description: '24-hour HH:MM:SS' },
          mode: { type: 'string', enum: ['Face-to-Face', 'Online'] },
          location: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['daysOfWeek', 'startTime', 'endTime', 'mode', 'location', 'reason'],
      },
    },
  },
  required: ['summary', 'suggestions'],
};

type Body = {
  semesterEndDate: string;
  consultationDurationMinutes: number;
  preferredMode: 'Face-to-Face' | 'Online';
  preferredLocation: string;
  maxSlotsPerDay: number;
  // Times the faculty is TEACHING (busy), e.g. Monday 07:00:00 - 09:00:00.
  classSchedule: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  // Days the faculty accepts consultations (0 = Sunday ... 6 = Saturday).
  availableDays: number[];
  // Daily window consultations may be held in, 24-hour HH:MM:SS.
  windowStart: string;
  windowEnd: string;
};

type Suggestion = {
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  mode: 'Face-to-Face' | 'Online';
  location: string;
  reason: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function validDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function minutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function isValidTime(time: unknown) {
  return typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time);
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return minutes(aStart) < minutes(bEnd) && minutes(bStart) < minutes(aEnd);
}

function toTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const m = (totalMinutes % 60).toString().padStart(2, '0');
  return `${h}:${m}:00`;
}

// Free time on one day = the consultation window minus that day's classes.
function freeBlocks(
  windowStart: string,
  windowEnd: string,
  classes: Array<{ startTime: string; endTime: string }>,
): Array<{ start_time: string; end_time: string }> {
  const winStart = minutes(windowStart);
  const winEnd = minutes(windowEnd);
  const sorted = [...classes].sort((a, b) => minutes(a.startTime) - minutes(b.startTime));
  const free: Array<{ start_time: string; end_time: string }> = [];
  let cursor = winStart;
  for (const block of sorted) {
    const start = minutes(block.startTime);
    const end = minutes(block.endTime);
    if (end <= cursor) continue;
    if (start >= winEnd) break;
    if (start > cursor) free.push({ start_time: toTime(cursor), end_time: toTime(start) });
    cursor = Math.max(cursor, end);
    if (cursor >= winEnd) break;
  }
  if (cursor < winEnd) free.push({ start_time: toTime(cursor), end_time: toTime(winEnd) });
  return free;
}

function fitsInsideOfficeHours(
  suggestion: { daysOfWeek: number[]; startTime: string; endTime: string },
  officeHours: Array<{ days_of_week: number[]; start_time: string; end_time: string }>,
) {
  return suggestion.daysOfWeek.every((day) =>
    officeHours.some(
      (office) =>
        office.days_of_week.includes(day) &&
        minutes(office.start_time) <= minutes(suggestion.startTime) &&
        minutes(office.end_time) >= minutes(suggestion.endTime),
    ),
  );
}

// ---------------------------------------------------------------------------
// Gemini call with retry + model fallback
// Pass 1 tries every model once (so lighter models are reached quickly when the
// top model is overloaded), then pauses and does a second pass.
// ---------------------------------------------------------------------------
const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
];
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const PASSES = 2;
const REQUEST_TIMEOUT_MS = 15000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGemini(
  apiKey: string,
  prompt: string,
): Promise<{ ok: true; data: any } | { ok: false; status: number }> {
  let lastStatus = 0;
  const skipModels = new Set<string>();

  for (let pass = 0; pass < PASSES; pass++) {
    for (const model of GEMINI_MODELS) {
      if (skipModels.has(model)) continue;

      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: 'application/json',
                responseSchema: suggestionSchema,
              },
            }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          },
        );

        if (res.ok) return { ok: true, data: await res.json() };

        lastStatus = res.status;
        console.error(`Gemini ${model} pass ${pass + 1} failed (${res.status}):`, await res.text());

        // Non-retryable error (e.g. 404 model gone): never try this model again.
        if (!RETRYABLE_STATUSES.has(res.status)) skipModels.add(model);
      } catch (error) {
        console.error(`Gemini ${model} pass ${pass + 1} network/timeout error:`, error);
      }
    }

    if (pass < PASSES - 1) await sleep(2000);
  }

  return { ok: false, status: lastStatus };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authentication required.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!supabaseUrl || !supabaseAnonKey || !geminiApiKey) {
      return json({ error: 'SlotIQ server configuration is incomplete.' }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Invalid session.' }, 401);

    const body = (await req.json()) as Body;
    if (
      !body ||
      !validDate(body.semesterEndDate) ||
      !MODES.includes(body.preferredMode) ||
      !Number.isInteger(body.consultationDurationMinutes) ||
      body.consultationDurationMinutes < 15 ||
      body.consultationDurationMinutes > 180 ||
      !Number.isInteger(body.maxSlotsPerDay) ||
      body.maxSlotsPerDay < 1 ||
      body.maxSlotsPerDay > 12 ||
      typeof body.preferredLocation !== 'string' ||
      !body.preferredLocation.trim()
    ) {
      return json({ error: 'Invalid SlotIQ settings.' }, 400);
    }

    const preferredLocation = body.preferredLocation.trim();

    // The class schedule the faculty typed in: the times they are TEACHING and
    // therefore NOT available for consultations.
    if (!Array.isArray(body.classSchedule) || !Array.isArray(body.availableDays)) {
      return json({ error: 'Invalid class schedule.' }, 400);
    }
    const invalidClass = body.classSchedule.some(
      (block) =>
        !block ||
        !Number.isInteger(block.dayOfWeek) ||
        block.dayOfWeek < 0 ||
        block.dayOfWeek > 6 ||
        !isValidTime(block.startTime) ||
        !isValidTime(block.endTime) ||
        minutes(block.endTime) <= minutes(block.startTime),
    );
    if (body.classSchedule.length > 60 || invalidClass) {
      return json({ error: 'Invalid class schedule.' }, 400);
    }

    // Days the faculty accepts consultations, and the daily window they may be held in.
    const availableDays = [...new Set(body.availableDays)];
    if (
      !availableDays.length ||
      availableDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
    ) {
      return json({ error: 'Choose at least one consultation day.' }, 400);
    }
    if (
      !isValidTime(body.windowStart) ||
      !isValidTime(body.windowEnd) ||
      minutes(body.windowEnd) - minutes(body.windowStart) < body.consultationDurationMinutes
    ) {
      return json({ error: 'Invalid consultation window.' }, 400);
    }

    // "Today" in Philippine time (UTC+8), not UTC.
    const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (body.semesterEndDate < today) return json({ error: 'Semester end date must be in the future.' }, 400);

    // Only classes on days the faculty accepts consultations matter.
    const classSchedule = body.classSchedule.filter((block) => availableDays.includes(block.dayOfWeek));

    // Free time = consultation window minus classes, computed here so the
    // server (not the AI, not the client) decides what is actually free.
    const officeHours: Array<{ days_of_week: number[]; start_time: string; end_time: string }> =
      availableDays.flatMap((day) =>
        freeBlocks(
          body.windowStart,
          body.windowEnd,
          classSchedule.filter((block) => block.dayOfWeek === day),
        )
          .filter((block) => minutes(block.end_time) - minutes(block.start_time) >= body.consultationDurationMinutes)
          .map((block) => ({ days_of_week: [day], ...block })),
      );

    if (!officeHours.length) {
      return json({
        summary: `Your classes leave no free gap of ${body.consultationDurationMinutes} minutes inside your consultation window. Try a shorter duration, a wider window, or more consultation days.`,
        suggestions: [],
      });
    }

    const facultyId = userData.user.id;
    // Only schedule data is sent to the AI. Student-written fields
    // (purpose, category) are intentionally NOT selected.
    const appointmentsRes = await supabase
      .from('appointments')
      .select('date,start_time,end_time,status,mode,location')
      .eq('faculty_id', facultyId)
      .gte('date', today)
      .lte('date', body.semesterEndDate)
      .neq('status', 'canceled');

    if (appointmentsRes.error) throw new Error(appointmentsRes.error.message || 'Could not load appointments.');
    const appointments = appointmentsRes.data ?? [];

    const prompt = `You are SlotIQ, an AI scheduling assistant inside AppointPro, a faculty-student consultation booking system in the Philippines.\n\nGenerate a practical recurring weekly consultation schedule for the faculty member. The schedule will be used for the whole semester after the faculty approves it.\n\nThe faculty member entered their CLASS SCHEDULE: the times they are teaching and cannot hold consultations. Consultations must be placed in the free gaps between and around their classes.\n\nHard rules:\n1. Never place a consultation block that overlaps any class in the class schedule below, on any day.\n2. Only use times completely inside the free blocks listed below (the consultation window minus the classes). Never invent availability.\n3. Only suggest the days that appear in the free blocks.\n4. Each suggested block must be exactly ${body.consultationDurationMinutes} minutes.\n5. Do not exceed ${body.maxSlotsPerDay} suggested blocks on a day.\n6. Prefer the requested mode and location: ${body.preferredMode}, ${preferredLocation}.\n7. Avoid times that conflict with the faculty's existing appointments where possible.\n8. Return recurring weekly patterns, not individual calendar dates.\n9. Keep the number of suggestions practical; do not fill every possible minute.\n10. Use 24-hour HH:MM:SS times.\n11. The faculty will review the suggestions before saving them.\n\nSemester: ${today} through ${body.semesterEndDate}.\n\nFaculty class schedule (busy, NOT available):\n${JSON.stringify(classSchedule)}\n\nFree blocks for consultations (consultation window ${body.windowStart}-${body.windowEnd} minus classes):\n${JSON.stringify(officeHours)}\n\nExisting appointments:\n${JSON.stringify(appointments.slice(0, 500))}\n\nDay numbers: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday.\n\nExplain briefly why the suggested patterns fit around the faculty's classes and existing appointments.`;

    const result = await callGemini(geminiApiKey, prompt);
    if (!result.ok) {
      const busy = result.status === 503 || result.status === 429;
      return json(
        {
          error: busy
            ? 'SlotIQ is busy right now. Please try again in a moment.'
            : 'Gemini could not generate the schedule right now.',
        },
        503,
      );
    }
    const geminiData = result.data;

    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return json({ error: 'Gemini returned an empty schedule.' }, 502);

    let parsed: { summary?: string; suggestions?: Suggestion[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error('SlotIQ could not parse Gemini output:', text);
      return json({ error: 'SlotIQ received an unreadable response. Please try again.' }, 502);
    }

    // Deterministic validation: the AI only proposes, the code decides.
    const cleanSuggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
      .filter((suggestion) => {
        const validDays =
          Array.isArray(suggestion.daysOfWeek) &&
          suggestion.daysOfWeek.length > 0 &&
          suggestion.daysOfWeek.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
        if (!validDays || !isValidTime(suggestion.startTime) || !isValidTime(suggestion.endTime)) return false;
        if (minutes(suggestion.endTime) - minutes(suggestion.startTime) !== body.consultationDurationMinutes) return false;
        if (!fitsInsideOfficeHours(suggestion, officeHours)) return false;
        const hitsClass = suggestion.daysOfWeek.some((day) =>
          classSchedule.some(
            (block) =>
              block.dayOfWeek === day &&
              overlaps(suggestion.startTime, suggestion.endTime, block.startTime, block.endTime),
          ),
        );
        if (hitsClass) return false;
        return true;
      })
      .slice(0, 30);

    // Reject suggestions that overlap each other and enforce maxSlotsPerDay.
    // Conflicts with existing appointments on specific dates are handled by the
    // normal AppointPro booking rules, since these are recurring patterns.
    const perDay = new Map<number, number>();
    const accepted: Suggestion[] = [];
    for (const suggestion of cleanSuggestions) {
      const days = [...new Set(suggestion.daysOfWeek)];

      const conflictWithSuggestion = accepted.some((other) =>
        days.some(
          (day) =>
            other.daysOfWeek.includes(day) &&
            overlaps(suggestion.startTime, suggestion.endTime, other.startTime, other.endTime),
        ),
      );
      if (conflictWithSuggestion) continue;

      if (days.some((day) => (perDay.get(day) ?? 0) >= body.maxSlotsPerDay)) continue;

      accepted.push({ ...suggestion, daysOfWeek: days });
      days.forEach((day) => perDay.set(day, (perDay.get(day) ?? 0) + 1));
    }

    return json({
      summary:
        parsed.summary ||
        `SlotIQ generated ${accepted.length} recurring schedule suggestion${accepted.length === 1 ? '' : 's'}.`,
      suggestions: accepted.map((suggestion) => ({
        ...suggestion,
        daysOfWeek: [...suggestion.daysOfWeek].sort((a, b) => a - b),
        location: preferredLocation,
        mode: body.preferredMode,
        reason:
          suggestion.reason ||
          `Fits between the faculty's classes on ${suggestion.daysOfWeek.map((d) => DAY_NAMES[d]).join(', ')}.`,
      })),
    });
  } catch (error) {
    console.error('SlotIQ function error:', error);
    const message = (error as any)?.message;
    return json({ error: typeof message === 'string' && message ? message : 'Unexpected SlotIQ error.' }, 500);
  }
});