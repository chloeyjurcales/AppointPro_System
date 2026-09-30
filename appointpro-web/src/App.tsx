import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import FacultySignUpPage from './pages/FacultySignUpPage'
import Dashboard from './pages/Dashboard'

type AuthView = 'login' | 'signup'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [authView, setAuthView] = useState<AuthView>('login')

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
      (_event, newSession) => {
        setSession(newSession)
      },
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  if (checkingSession) {
    return null
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
          // Sign-up succeeded; FacultySignUpPage shows its own "check your
          // email" confirmation screen and its "Go to Log in" button calls
          // onLogin above, so there's nothing extra to do here.
        }}
      />
    )
  }

  return (
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
  )
}

export default App