import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { toast } from 'react-toastify'
import api from './api'

export default function PasswordResetPage({ reset = false }) {
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = Object.fromEntries(new FormData(event.currentTarget))
    try {
      if (reset) {
        await api.post('/auth/reset-password', { token: params.get('token'), password: form.password })
        setComplete(true)
        toast.success('Your password has been updated.')
      } else {
        await api.post('/auth/forgot-password', { email: form.email })
        setComplete(true)
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'We could not complete that request. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="password-page">
    <Link to="/" className="brand"><span className="brand-mark"><Sparkles size={17} fill="currentColor" /></span> eventease<span className="brand-dot">.</span></Link>
    <section className="password-card">
      <p className="eyebrow dark-eyebrow">{reset ? 'A FRESH START' : 'ACCOUNT RECOVERY'}</p>
      <h1>{reset ? 'Choose a new password.' : 'Forgot your password?'}</h1>
      {complete ? <><p>{reset ? 'Your password is ready. Sign in with your new details.' : 'If that email is registered, a reset link will be sent shortly. Check your inbox.'}</p><Link className="button button-dark button-wide" to="/login">Back to log in <ArrowRight size={16} /></Link></> : <>
        <p>{reset ? 'Choose a strong password with at least 8 characters.' : 'Enter the email address linked to your account and we’ll send a reset link.'}</p>
        {error && <div className="form-error">{error}</div>}
        <form className="password-form" onSubmit={submit}>
          {reset ? <label>New password<input name="password" type="password" minLength="8" maxLength="128" required autoComplete="new-password" placeholder="At least 8 characters" /></label> : <label>Email address<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label>}
          <button className="button button-dark button-wide" disabled={busy}>{busy ? 'Please wait…' : reset ? 'Update password' : 'Send reset link'} <ArrowRight size={16} /></button>
        </form>
        <Link className="password-back" to="/login">Back to log in</Link>
      </>}
    </section>
  </main>
}
