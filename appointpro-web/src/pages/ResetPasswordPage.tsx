import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import './LoginPage.css';

type ResetPasswordPageProps = {
  /** Called once the new password is saved (the user is signed out first). */
  onDone: () => void;
  /** Called if the user abandons the reset. */
  onCancel: () => void;
};

/**
 * Shown when a faculty member opens the reset link from their email. Without
 * this page the link would just sign them in without ever asking for a new
 * password. Reuses the login page styling.
 */
export default function ResetPasswordPage({ onDone, onCancel }: ResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      // Make them log in with the new password.
      await supabase.auth.signOut();
      window.history.replaceState(null, '', window.location.pathname);
      onDone();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    await supabase.auth.signOut();
    window.history.replaceState(null, '', window.location.pathname);
    onCancel();
  };

  return (
    <div className="lp-page">
      <div className="lp-form-panel" style={{ width: '100%' }}>
        <div className="lp-form-wrap">
          <div className="lp-form-card">
            <div className="lp-form-brand">
              <span className="lp-form-brand-name">AppointPro</span>
            </div>

            <h1 className="lp-heading">Set a new password</h1>
            <p className="lp-subheading">Choose a new password for your account.</p>

            <form className="lp-form" onSubmit={handleSubmit} noValidate>
              <div className="lp-field">
                <label className="lp-label" htmlFor="rp-password">
                  New Password
                </label>
                <div className="lp-input-icon-wrap">
                  <input
                    id="rp-password"
                    className="lp-input lp-input-with-trailing-icon"
                    type={show ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="lp-eye"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? 'Hide password' : 'Show password'}
                  >
                    {show ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="lp-field">
                <label className="lp-label" htmlFor="rp-confirm">
                  Confirm New Password
                </label>
                <input
                  id="rp-confirm"
                  className="lp-input"
                  type={show ? 'text' : 'password'}
                  placeholder="Re-enter the new password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>

              {error && <p className="lp-error">{error}</p>}

              <button type="submit" className="lp-submit" disabled={loading}>
                {loading && <span className="lp-spinner" aria-hidden="true" />}
                {loading ? 'Saving…' : 'Save New Password'}
              </button>
            </form>

            <p className="lp-signup-row">
              <button type="button" className="lp-link" onClick={handleCancel}>
                Back to log in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}