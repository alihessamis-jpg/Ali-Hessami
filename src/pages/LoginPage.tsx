import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { KidneyIcon } from '../components/icons'
import { NephronIllustration } from '../components/illustrations/NephronIllustration'

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
    <div className="signin-page">
      <NephronIllustration className="signin-illustration" />
      <motion.div
        className="signin-content"
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: 0.08, delayChildren: 0.05 }}
      >
        <motion.div className="signin-wordmark" variants={reveal} transition={{ duration: 0.35 }}>
          <KidneyIcon />
          Nephron
        </motion.div>
        <motion.h1 className="signin-heading" variants={reveal} transition={{ duration: 0.35 }}>
          Your nephrology residency, in one place.
        </motion.h1>
        <motion.p className="signin-subtitle" variants={reveal} transition={{ duration: 0.35 }}>
          Patients, case log, study and research — synced.
        </motion.p>

        <motion.div className="signin-card" variants={reveal} transition={{ duration: 0.4 }}>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <label>
              Email
              <input
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="signin-submit" disabled={submitting}>
              {mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </button>
          </form>
          <button type="button" className="signin-toggle" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
            {mode === 'sign-in' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
          </button>
        </motion.div>

        <motion.div className="signin-footer-signature" variants={reveal} transition={{ duration: 0.35 }}>
          <strong>Ali Hesami</strong>
          Pediatric Nephrology
        </motion.div>
      </motion.div>
    </div>
  )
}
