import { supabase } from './supabase';

export type CancelRole = 'student' | 'faculty';

export type CancelReasonCheck = {
  valid: boolean;
  /** Friendly explanation shown to the student when the reason is rejected. */
  message: string;
};

export const CANCEL_REASON_MIN_LENGTH = 10;
export const CANCEL_REASON_MAX_LENGTH = 300;

const PLACEHOLDERS = new Set([
  'test', 'testing', 'asdf', 'asdfgh', 'qwerty', 'n/a', 'na', 'none', 'idk', 'nothing',
  'because', 'no reason', 'just because', 'wala', 'basta', 'xxx', 'sample', 'reason',
]);

/**
 * Basic offline check. Used if the AI service can't be reached, so students
 * aren't blocked from cancelling when the service is down.
 */
export function basicReasonCheck(reason: string, role: CancelRole = 'student'): CancelReasonCheck {
  const text = reason.trim();
  const fail = (message: string) => ({ valid: false, message });

  if (text.length < CANCEL_REASON_MIN_LENGTH) {
    return fail('Please explain your reason in a bit more detail (at least a short sentence).');
  }
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s/]/g, '').trim();
  if (PLACEHOLDERS.has(normalized)) {
    return fail('Please share a genuine reason, such as illness, a class conflict, or an emergency.');
  }
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  const words = text.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  if (letters / text.length < 0.6 || words.length < 2) {
    return fail('Please write your reason in a clear sentence so the other person understands.');
  }
  if (/(.)\1{4,}/u.test(text)) {
    return fail('That does not look like a real reason. Please explain why you need to cancel.');
  }
  return { valid: true, message: '' };
}

/**
 * Asks the `validate-cancel-reason` edge function (Gemini) whether the reason
 * is genuine. Falls back to the basic check if the service is unavailable.
 */
export async function validateCancelReason(
  reason: string,
  role: CancelRole = 'student'
): Promise<CancelReasonCheck> {
  const trimmed = reason.trim().slice(0, CANCEL_REASON_MAX_LENGTH);

  // Obvious junk never needs an AI call.
  const basic = basicReasonCheck(trimmed, role);
  if (!basic.valid) return basic;

  try {
    const { data, error } = await supabase.functions.invoke('validate-cancel-reason', {
      body: { reason: trimmed, role },
    });
    if (error || typeof data?.valid !== 'boolean') return basic;
    return { valid: data.valid, message: typeof data.message === 'string' ? data.message : '' };
  } catch {
    return basic;
  }
}