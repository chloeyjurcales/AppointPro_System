import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import './LoginPage.css';

export type UserRole = 'student' | 'faculty';

type LoginPageProps = {
  /** Called when the user clicks "Sign up". */
  onSignUp?: () => void;
  /** Called when the user clicks "Forgot Password?". */
  onForgotPassword?: () => void;
  /** Called after a successful faculty login. */
  onSuccess?: () => void;
};

export default function LoginPage({
  onSignUp,
  onForgotPassword,
  onSuccess,
}: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (): string | null => {
    if (!email.trim() || !password) {
      return 'Please enter your email and password.';
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email.trim())) {
      return 'Please enter a valid email address.';
    }
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword(
        {
          email: email.trim(),
          password,
        },
      );

      if (signInError) {
        // Supabase returns this exact message for both "no such user" and
        // "wrong password" (by design, so attackers can't tell which).
        if (signInError.message.toLowerCase().includes('invalid login credentials')) {
          setError('Incorrect email or password. Please try again.');
        } else if (signInError.message.toLowerCase().includes('email not confirmed')) {
          setError('Please confirm your email address before logging in.');
        } else {
          setError(signInError.message);
        }
        return;
      }

      // This web app is faculty-only. If a student account signs in here,
      // sign them back out and point them somewhere else instead.
      // Prefer the role stored in `profiles` (what the app and the database
      // rules use). user_metadata can be edited by the user themselves.
      const { data: profileRow } = data.user
        ? await supabase.from('profiles').select('role').eq('id', data.user.id).single()
        : { data: null };
      const accountRole = ((profileRow as { role?: string } | null)?.role ??
        data.user?.user_metadata?.role) as UserRole | undefined;

      if (accountRole && accountRole !== 'faculty') {
        await supabase.auth.signOut();
        setError(
          'This is a faculty account portal. Please use the student app to log in.',
        );
        return;
      }

      onSuccess?.();
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'azure') => {
    setError(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
      });
      if (oauthError) setError(oauthError.message);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error(err);
    }
  };

  return (
    <div className="lp-page">
      {/* Left brand panel — desktop only, hidden on narrow screens via CSS */}
      <div className="lp-panel">
        <div className="lp-panel-content">
          <div className="lp-brand">
            <div className="lp-brand-mark">
              <CapIcon />
            </div>
            <span className="lp-brand-name">AppointPro</span>
          </div>

          <h2 className="lp-panel-heading">
            Smart Faculty
            <br />
            Consultation Scheduling
          </h2>
          <p className="lp-panel-text">
            Manage your availability, appointments, and student requests all
            in one place.
          </p>

          <ul className="lp-panel-list">
            <li>
              <CheckIcon />
              <span>Set your own consultation hours</span>
            </li>
            <li>
              <CheckIcon />
              <span>Review and respond to booking requests</span>
            </li>
            <li>
              <CheckIcon />
              <span>Get notified the moment a student books</span>
            </li>
          </ul>
        </div>

        <div className="lp-panel-glow" aria-hidden="true" />
      </div>

      {/* Right form panel */}
      <div className="lp-form-panel">
        <div className="lp-form-wrap">
          <div className="lp-form-card">
            <div className="lp-form-brand">
              <CapIcon color="#7a0e2c" />
              <span className="lp-form-brand-name">AppointPro</span>
            </div>
            <p className="lp-form-tagline">
              Smart Faculty Consultation Scheduling
              <br />
              with <strong>Slatiq AI.</strong>
            </p>

            <h1 className="lp-heading">Welcome!</h1>
            <p className="lp-subheading">Sign in to continue to your account.</p>

            <form className="lp-form" onSubmit={handleSubmit} noValidate>
              <div className="lp-field">
                <label className="lp-label" htmlFor="email">
                  Email
                </label>
                <div className="lp-input-icon-wrap">
                  <MailIcon />
                  <input
                    id="email"
                    className="lp-input lp-input-with-icon"
                    type="email"
                    placeholder="Enter your email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="lp-field">
                <label className="lp-label" htmlFor="password">
                  Password
                </label>
                <div className="lp-input-icon-wrap">
                  <LockIcon />
                  <input
                    id="password"
                    className="lp-input lp-input-with-icon lp-input-with-trailing-icon"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="lp-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div className="lp-forgot-row">
                <button
                  type="button"
                  className="lp-link"
                  onClick={onForgotPassword}
                >
                  Forgot Password?
                </button>
              </div>

              {error && <p className="lp-error">{error}</p>}

              <button type="submit" className="lp-submit" disabled={loading}>
                {loading && <span className="lp-spinner" aria-hidden="true" />}
                {loading ? 'Logging in…' : 'Log In'}
              </button>
            </form>

            <div className="lp-divider">
              <span>or continue with</span>
            </div>

            <div className="lp-social-row">
              <button
                type="button"
                className="lp-social-btn"
                onClick={() => handleOAuth('google')}
              >
                <GoogleIcon />
                Sign in with Google
              </button>
              <button
                type="button"
                className="lp-social-btn"
                onClick={() => handleOAuth('azure')}
              >
                <MicrosoftIcon />
                Sign in with Microsoft
              </button>
            </div>

            <p className="lp-signup-row">
              Don&apos;t have an account?{' '}
              <button type="button" className="lp-link" onClick={onSignUp}>
                Sign up
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Small inline icons so this component has zero extra icon-library
   dependencies (the web app doesn't currently install one). */

function CapIcon({ color = '#ffffff' }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 3 1 8l11 5 9-4.09V17h2V8L12 3Z" fill={color} />
      <path
        d="M5 10.5V15c0 1.5 3 3.5 7 3.5s7-2 7-3.5v-4.5"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.15)" />
      <path
        d="m8 12.5 2.5 2.5L16 9"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m4 6.5 8 6 8-6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 10V7a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M6.6 6.7C4.5 8 3 12 3 12s3.5 7 10 7c1.7 0 3.2-.4 4.4-1.1M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a15.6 15.6 0 0 1-3 4.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A11.99 11.99 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.27 6.61l4 3.11C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <rect x="2" y="2" width="9.2" height="9.2" fill="#F25022" />
      <rect x="12.8" y="2" width="9.2" height="9.2" fill="#7FBA00" />
      <rect x="2" y="12.8" width="9.2" height="9.2" fill="#00A4EF" />
      <rect x="12.8" y="12.8" width="9.2" height="9.2" fill="#FFB900" />
    </svg>
  );
}