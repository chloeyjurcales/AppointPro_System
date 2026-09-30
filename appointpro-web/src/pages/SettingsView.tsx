import { useState, type ReactElement } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { usePersistentState } from '../lib/usePersistentState';
import './SettingsView.css';

type ToggleKey = 'pushNotifications' | 'emailNotifications' | 'notificationSound';

type ToggleRow = {
  key: ToggleKey;
  label: string;
  description: string;
  icon: () => ReactElement;
};

// Push/Email aren't backed by a real notifications backend in this demo,
// so they're local-only — flipping them just moves the toggle, same as
// the mobile app's SettingsScreen.
const TOGGLE_ROWS: ToggleRow[] = [
  {
    key: 'pushNotifications',
    label: 'Push Notifications',
    description:
      'Get notified about appointments, reschedules, and queue updates.',
    icon: BellIcon,
  },
  {
    key: 'emailNotifications',
    label: 'Email Notifications',
    description: 'Receive a copy of important updates by email.',
    icon: MailIcon,
  },
  {
    key: 'notificationSound',
    label: 'Notification Sound',
    description: 'Play a sound when a new notification arrives.',
    icon: VolumeIcon,
  },
];

type Props = {
  session: Session;
};

export default function SettingsView({ session }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (savingPassword) return;
    setPasswordSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Fill in all three fields.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (!session.user.email) {
      setPasswordError('No email on this account to verify against.');
      return;
    }

    setSavingPassword(true);
    setPasswordError(null);

    // Re-verify the current password before allowing a change.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    });
    if (reauthError) {
      setPasswordError('Current password is incorrect.');
      setSavingPassword(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      setPasswordError(`Could not update your password: ${error.message}`);
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordSuccess(true);
  };

  const [values, setValues] = usePersistentState<Record<ToggleKey, boolean>>(
    'appointpro.notificationSettings',
    {
      pushNotifications: true,
      emailNotifications: true,
      notificationSound: true,
    },
  );

  const toggle = (key: ToggleKey) => {
    setValues((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="sv-page">
      <div className="sv-header">
        <h1>Settings</h1>
        <p>Manage your account security and how AppointPro notifies you.</p>
      </div>

      <div className="sv-grid">
        <div className="sv-card">
          <h2>
            <LockIcon /> Change Password
          </h2>
          <p className="sv-card-subtext">
            Update the password you use to sign in.
          </p>

          <div className="sv-password-form">
            <div className="sv-field">
              <label htmlFor="sv-current-password">Current Password</label>
              <input
                id="sv-current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => {
                  setCurrentPassword(event.target.value);
                  setPasswordError(null);
                  setPasswordSuccess(false);
                }}
                placeholder="Enter your current password"
              />
            </div>

            <div className="sv-field">
              <label htmlFor="sv-new-password">New Password</label>
              <input
                id="sv-new-password"
                type="password"
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setPasswordError(null);
                  setPasswordSuccess(false);
                }}
                placeholder="At least 8 characters"
              />
            </div>

            <div className="sv-field">
              <label htmlFor="sv-confirm-password">Confirm New Password</label>
              <input
                id="sv-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setPasswordError(null);
                  setPasswordSuccess(false);
                }}
                placeholder="Re-enter your new password"
              />
            </div>

            {passwordError && <p className="sv-field-error">{passwordError}</p>}
            {passwordSuccess && (
              <p className="sv-field-success">Password updated.</p>
            )}

            <button
              type="button"
              className="sv-password-save"
              onClick={handleChangePassword}
              disabled={savingPassword}
            >
              {savingPassword ? 'Saving…' : 'Update Password'}
            </button>
          </div>
        </div>

        <div className="sv-col">
        <div className="sv-card">
          <h2>Notifications</h2>

          {TOGGLE_ROWS.map((row) => (
            <div key={row.key} className="sv-row">
              <span className="sv-row-icon" aria-hidden="true">
                <row.icon />
              </span>

              <div className="sv-row-text">
                <p className="sv-row-label">{row.label}</p>
                <p className="sv-row-description">{row.description}</p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={values[row.key]}
                aria-label={row.label}
                className={`sv-toggle${values[row.key] ? ' sv-toggle-on' : ''}`}
                onClick={() => toggle(row.key)}
              >
                <span className="sv-toggle-knob" />
              </button>
            </div>
          ))}
        </div>

        <div className="sv-about-card">
          <div className="sv-about-logo">AP</div>
          <p className="sv-about-version">Version 1.0.0</p>
          <p className="sv-about-description">
            AppointPro gives faculty a simple way to publish their
            availability, manage appointment requests, and handle walk-in
            queues.
          </p>
          <p className="sv-about-footer">
            © 2026 AppointPro. All rights reserved.
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect
        x="5"
        y="10.5"
        width="14"
        height="9.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M8 10.5V8a4 4 0 0 1 8 0v2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 10.5a6 6 0 1 1 12 0v3.5l1.5 3H4.5l1.5-3v-3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M10 20a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <rect
        x="3.5"
        y="5.5"
        width="17"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M4.5 6.5 12 12.5l7.5-6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 9.5h3.2L11 6v12l-3.8-3.5H4v-5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M15 9a3.5 3.5 0 0 1 0 6M17.3 6.7a7 7 0 0 1 0 10.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}