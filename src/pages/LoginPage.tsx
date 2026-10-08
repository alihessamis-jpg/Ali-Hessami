import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

const reveal = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
}

export function LoginPage() {
  const { session, signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'sign-in') {
        await signIn(email, password)
      } else {
        await signUp(email, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-glow g1" />
      <div className="login-glow g2" />
      <div className="login-wrap">
        <div className="login-vis">
          <svg viewBox="0 0 390 420" fill="none" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <g className="login-beat">
              <circle cx="90" cy="110" r="34" stroke="#3E73D6" strokeWidth={2} />
              <path
                d="M70 100c6-14 22-14 26-4s-14 10-8 22 22 4 22-10M74 124c10 6 28 4 32-10"
                stroke="#9CC2FF"
                strokeWidth={2.4}
                strokeLinecap="round"
              />
            </g>
            <path
              d="M126 96C146 60 166 118 186 80S216 50 236 76L268 300Q286 334 304 300L322 120C330 90 350 130 360 100"
              stroke="#1D4A9E"
              strokeWidth={10}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M126 96C146 60 166 118 186 80S216 50 236 76L268 300Q286 334 304 300L322 120C330 90 350 130 360 100"
              stroke="#7FD4FF"
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeDasharray="6 8"
              className="login-flow"
            />
          </svg>
        </div>

        <motion.div className="login-side" initial="hidden" animate="show" transition={{ staggerChildren: 0.1, delayChildren: 0.05 }}>
          <motion.div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} variants={reveal} transition={{ duration: 0.35 }}>
            <motion.div className="login-brand" variants={reveal} transition={{ duration: 0.35 }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#9CC2FF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 3C5 3 3 7 3 11s2 9 6 9c2.5 0 3-2.5 2-4.5-.6-1.4-.6-2.8 0-4 1-2 2.5-3 2.5-5S12 3 9 3z" />
              </svg>
              NEPHRON
            </motion.div>
            <motion.h1 variants={reveal} transition={{ duration: 0.35 }}>
              Your nephrology residency, in one place.
            </motion.h1>
            <motion.p className="login-lead" variants={reveal} transition={{ duration: 0.35 }}>
              Patients, case log, study and research — synced.
            </motion.p>
          </motion.div>

          <motion.form className="login-form" onSubmit={(e) => void handleSubmit(e)} variants={reveal} transition={{ duration: 0.4 }}>
            <label htmlFor="login-email">
              Email
              <input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <label htmlFor="login-password">
              Password
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="login-go" disabled={submitting}>
              {submitting ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </button>
            <button type="button" className="login-forgot" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
              {mode === 'sign-in' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
            </button>
          </motion.form>

          <motion.div className="login-footer-signature" variants={reveal} transition={{ duration: 0.35 }}>
            <strong>Ali Hesami</strong>
            Pediatric Nephrology
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
