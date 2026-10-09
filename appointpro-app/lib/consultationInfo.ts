// "Both" consultations (face-to-face AND online) keep the database unchanged:
// the room and the meeting link are saved together in the normal `location`
// text, separated by " | ", e.g. "Faculty Office 204 | https://meet.google.com/abc-defg-hij".
// These helpers build and read that text.

const SEPARATOR = ' | ';
const LINK_PATTERN = /^(?:https?:\/\/|www\.)\S+$/i;

/** Adds https:// to a link that was typed without it. */
export function ensureUrl(link: string): string {
  const trimmed = link.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function combineLocationAndLink(place: string, link: string): string {
  return `${place.trim()}${SEPARATOR}${ensureUrl(link)}`;
}

/** Splits saved location text into its room and its meeting link (either can be null). */
export function splitLocationAndLink(text?: string | null): { place: string | null; link: string | null } {
  const value = (text ?? '').trim();
  if (!value) return { place: null, link: null };
  if (!value.includes('|')) return { place: value, link: null };
  const parts = value.split('|').map((part) => part.trim()).filter(Boolean);
  const linkIndex = parts.findIndex((part) => LINK_PATTERN.test(part));
  if (linkIndex === -1) return { place: value, link: null };
  const link = parts[linkIndex];
  const place = parts.filter((_, index) => index !== linkIndex).join(', ');
  return { place: place || null, link };
}

/** True when the saved location holds both a room and a meeting link. */
export function isBothLocation(text?: string | null): boolean {
  const { place, link } = splitLocationAndLink(text);
  return !!place && !!link;
}