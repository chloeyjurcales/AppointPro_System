import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

// A localStorage-backed drop-in replacement for useState, so faculty-entered
// data (availability, recurring schedules, personal info, settings) survives
// a page refresh instead of resetting to the seed data every time.
//
// This is a convenience layer, not a database: reads/writes are wrapped in
// try/catch so a full or unavailable localStorage (private browsing, quota
// exceeded, etc.) just falls back to normal in-memory state instead of
// crashing the app.
export function usePersistentState<T>(
  key: string,
  initialValue: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch {
      // Corrupt or inaccessible storage — fall through to the seed value.
    }
    return typeof initialValue === 'function'
      ? (initialValue as () => T)()
      : initialValue;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Storage full or unavailable — this save just won't persist.
    }
  }, [key, state]);

  return [state, setState];
}