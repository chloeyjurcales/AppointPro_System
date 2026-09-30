import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import './FacultySignUpPage.css';

type FacultySignUpPageProps = {
  /** Called when the user clicks "Log in". */
  onLogin?: () => void;
  /** Called after a faculty account has been created successfully. */
  onSuccess?: () => void;
};

type FormState = {
  fullName: string;
  facultyId: string;
  email: string;
  department: string;
  password: string;
  confirmPassword: string;
};

const initialState: FormState = {
  fullName: '',
  facultyId: '',
  email: '',
  department: '',
  password: '',
  confirmPassword: '',
};

export default function FacultySignUpPage({
  onLogin,
  onSuccess,
}: FacultySignUpPageProps) {
  const [form, setForm] = useState<FormState>(initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange =
    (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const validate = (): string | null => {
    if (
      !form.fullName.trim() ||
      !form.facultyId.trim() ||
      !form.email.trim() ||
      !form.department.trim() ||
      !form.password ||
      !form.confirmPassword
    ) {
      return 'Please fill in all fields.';
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(form.email.trim())) {
      return 'Please enter a valid email address.';
    }
    if (form.password.length < 8) {
      return 'Password must be at least 8 characters.';
    }
    if (form.password !== form.confirmPassword) {
      return 'Passwords do not match.';
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
      // Creates the auth user and stashes the faculty-specific fields as
      // user metadata. Adjust/extend this (e.g. insert into a `faculty`
      // table) to match your actual database schema.
      const { error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            role: 'faculty',
            full_name: form.fullName.trim(),
            faculty_id: form.facultyId.trim(),
            department: form.department.trim(),
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fsu-page">
      {/* Left brand panel — desktop only, hidden on narrow screens via CSS */}
      <div className="fsu-panel">
        <div className="fsu-panel-content">
          <div className="fsu-brand">
            <div className="fsu-brand-mark">AP</div>
            <span className="fsu-brand-name">AppointPro</span>
          </div>

          <h2 className="fsu-panel-heading">Faculty Portal</h2>
          <p className="fsu-panel-text">
            Manage your availability, appointments, and student requests all
            in one place.
          </p>

          <ul className="fsu-panel-list">
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

        <div className="fsu-panel-glow" aria-hidden="true" />
      </div>

      {/* Right form panel */}
      <div className="fsu-form-panel">
        <div className="fsu-form-topbar">
          <div className="fsu-topbar-login">
            <span>Already have an account?</span>
            <button type="button" className="fsu-link" onClick={onLogin}>
              Log in
            </button>
          </div>
        </div>

        <div className="fsu-form-wrap">
          <div className="fsu-form-card">
            <h1 className="fsu-heading">Create your faculty account</h1>
            <p className="fsu-subheading">
              Enter your details below to get started on AppointPro.
            </p>

            {success ? (
              <div className="fsu-success">
                <div className="fsu-success-icon">
                  <ShieldIcon />
                </div>
                <h3>Almost there</h3>
                <p>
                  Your faculty account request was submitted. Check your
                  email to confirm your account before logging in.
                </p>
                <button
                  type="button"
                  className="fsu-submit"
                  onClick={onLogin}
                >
                  Go to Log in
                </button>
              </div>
            ) : (
              <form className="fsu-form" onSubmit={handleSubmit} noValidate>
                <div className="fsu-grid">
                  <div className="fsu-field">
                    <label className="fsu-label" htmlFor="fullName">
                      Full Name
                    </label>
                    <input
                      id="fullName"
                      className="fsu-input"
                      type="text"
                      placeholder="Juan Dela Cruz"
                      autoComplete="name"
                      value={form.fullName}
                      onChange={handleChange('fullName')}
                    />
                  </div>

                  <div className="fsu-field">
                    <label className="fsu-label" htmlFor="facultyId">
                      Faculty ID
                    </label>
                    <input
                      id="facultyId"
                      className="fsu-input"
                      type="text"
                      placeholder="e.g. F-2024-0142"
                      value={form.facultyId}
                      onChange={handleChange('facultyId')}
                    />
                  </div>

                  <div className="fsu-field">
                    <label className="fsu-label" htmlFor="email">
                      Email Address
                    </label>
                    <input
                      id="email"
                      className="fsu-input"
                      type="email"
                      placeholder="name@university.edu"
                      autoComplete="email"
                      value={form.email}
                      onChange={handleChange('email')}
                    />
                  </div>

                  <div className="fsu-field">
                    <label className="fsu-label" htmlFor="department">
                      Department
                    </label>
                    <input
                      id="department"
                      className="fsu-input"
                      type="text"
                      placeholder="e.g. Computer Science"
                      value={form.department}
                      onChange={handleChange('department')}
                    />
                  </div>

                  <div className="fsu-field">
                    <label className="fsu-label" htmlFor="password">
                      Password
                    </label>
                    <div className="fsu-input-icon-wrap">
                      <LockIcon />
                      <input
                        id="password"
                        className="fsu-input fsu-input-with-icon"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Create a password"
                        autoComplete="new-password"
                        value={form.password}
                        onChange={handleChange('password')}
                      />
                      <button
                        type="button"
                        className="fsu-eye"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={
                          showPassword ? 'Hide password' : 'Show password'
                        }
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>

                  <div className="fsu-field">
                    <label className="fsu-label" htmlFor="confirmPassword">
                      Confirm Password
                    </label>
                    <div className="fsu-input-icon-wrap">
                      <LockIcon />
                      <input
                        id="confirmPassword"
                        className="fsu-input fsu-input-with-icon"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirm your password"
                        autoComplete="new-password"
                        value={form.confirmPassword}
                        onChange={handleChange('confirmPassword')}
                      />
                      <button
                        type="button"
                        className="fsu-eye"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        aria-label={
                          showConfirmPassword
                            ? 'Hide password'
                            : 'Show password'
                        }
                      >
                        {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="fsu-info-box">
                  <ShieldIcon />
                  <p>
                    Use at least 8 characters with a mix of letters, numbers,
                    and symbols.
                  </p>
                </div>

                {error && <p className="fsu-error">{error}</p>}

                <button
                  type="submit"
                  className="fsu-submit"
                  disabled={loading}
                >
                  {loading && <span className="lp-spinner" aria-hidden="true" />}
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Small inline icons so this component has zero extra icon-library
   dependencies (the web app doesn't currently install one). */

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

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2 2 4-4"
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
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
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