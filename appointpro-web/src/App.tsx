import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import FacultySignUpPage from './pages/FacultySignUpPage'
import Dashboard from './pages/Dashboard'
import ResetPasswordPage from './pages/ResetPasswordPage'

type AuthView = 'login' | 'signup'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [authView, setAuthView] = useState<AuthView>('login')
  // Mirrors authView for the auth listener below. A SIGNED_IN event while the
  // sign-up page is open can only come from verifying the email code, and that
  // must NOT log the user in: they have to sign in themselves afterwards.
  const authViewRef = useRef<AuthView>('login')
  useEffect(() => {
    authViewRef.current = authView
  }, [authView])
  // True while the user is setting a new password after opening the reset link
  // from their email. Checked from the URL up front because Supabase clears the
  // link's hash once it has read it.
  const [recovering, setRecovering] = useState(
    () => /type=recovery/.test(window.location.hash),
  )
  const [resetNotice, setResetNotice] = useState(false)
  const [verifiedNotice, setVerifiedNotice] = useState(false)

  useEffect(() => {
    // Restore an existing session on page load/refresh...
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session)
      })
      .catch(() => {
        // If Supabase can't be reached, fall through to the login page
        // instead of leaving the app stuck on a blank screen.
      })
      .finally(() => {
        setCheckingSession(false)
      })

    // ...and keep it in sync afterwards (login, logout, token refresh).
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (event === 'PASSWORD_RECOVERY') setRecovering(true)
        if (newSession && authViewRef.current === 'signup') return
        setSession(newSession)
      },
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  if (checkingSession) {
    return null
  }

  // Opened from a password-reset email: ask for the new password first
  // instead of dropping straight into the dashboard.
  if (recovering) {
    return (
      <ResetPasswordPage
        onDone={() => {
          setRecovering(false)
          setSession(null)
          setAuthView('login')
          setResetNotice(true)
        }}
        onCancel={() => {
          setRecovering(false)
          setSession(null)
          setAuthView('login')
        }}
      />
    )
  }

  // Only a real, Supabase-authenticated session gets into the app. Anyone
  // who hasn't signed in — or typed the wrong email/password — stays on
  // the login screen.
  if (session) {
    return (
      <Dashboard
        session={session}
        onLogout={async () => {
          await supabase.auth.signOut()
        }}
      />
    )
  }

  if (authView === 'signup') {
    return (
      <FacultySignUpPage
        onLogin={() => setAuthView('login')}
        onSuccess={() => {
          // Email verified (the page already signed the temporary session
          // out): send them to the login page to sign in themselves.
          setSession(null)
          setAuthView('login')
          setVerifiedNotice(true)
        }}
      />
    )
  }

  return (
    <>
    {verifiedNotice && (
      <div
        role="status"
        style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: '#1E8E3E', color: '#fff', padding: '10px 18px',
          borderRadius: 10, fontSize: 14, fontWeight: 600, zIndex: 1000,
          boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
        }}
        onClick={() => setVerifiedNotice(false)}
      >
        Email verified! Please log in with your email and password.
      </div>
    )}
    {resetNotice && (
      <div
        role="status"
        style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: '#1E8E3E', color: '#fff', padding: '10px 18px',
          borderRadius: 10, fontSize: 14, fontWeight: 600, zIndex: 1000,
          boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
        }}
        onClick={() => setResetNotice(false)}
      >
        Password updated. Please log in with your new password.
      </div>
    )}
    <LoginPage
      onSignUp={() => setAuthView('signup')}
      onForgotPassword={() => {
        const email = window.prompt('Enter your account email to receive a reset link:')?.trim()
        if (!email) return
        supabase.auth
          .resetPasswordForEmail(email, { redirectTo: window.location.origin })
          .then(({ error }) => {
            window.alert(
              error
                ? `Could not send the reset email: ${error.message}`
                : 'If that email has an account, a reset link is on its way.',
            )
          })
      }}
      onSuccess={() => {
        // onAuthStateChange above already updates `session` the moment
        // Supabase signs the user in, which re-renders into <Dashboard>.
      }}
    />
    </>
  )
}

export default App