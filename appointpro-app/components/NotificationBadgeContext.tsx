import { createContext } from 'react';

// Unread notification count for the logged-in user. App.tsx provides it and
// the bottom tab bars read it to show a badge on the Notifications tab.
export const NotificationBadgeContext = createContext<number>(0);
