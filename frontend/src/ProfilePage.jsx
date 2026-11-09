import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { toast } from 'react-toastify'
import api from './api'
import { useAuth } from './useAuth'

export default function ProfilePage() {
  const { user, ready, login } = useAuth()
  if (!ready) return <main className="loading-state page-empty">Restoring your session…</main>
  if (!user) return <Navigate to="/login?next=%2Fprofile" replace />
  return <ProfileForm key={user._id} user={user} onSave={login} />
}

function ProfileForm({ user, onSave }) {
  const [busy, setBusy] = useState(false)
  const [values, setValues] = useState({ name: user.name || '', phone: user.phone || '', bio: user.bio || '', location: user.location || '', profileImage: user.profileImage || '' })
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      const { data } = await api.put('/users/me', values)
      onSave(data.user)
      toast.success('Your profile has been updated.')
    } catch (error) {
      console.error('Unable to update profile:', error)
      toast.error(error.response?.data?.message || 'Could not update your profile.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="profile-page"><Link to="/" className="brand"><span className="brand-mark"><Sparkles size={17} fill="currentColor" /></span> eventease<span className="brand-dot">.</span></Link><section className="profile-card">
    <p className="eyebrow dark-eyebrow">YOUR ACCOUNT</p><h1>A little more<br /><span>about you.</span></h1><p className="profile-email">{user.email} · {user.role}</p>
    <form className="profile-form" onSubmit={submit}>
      <label>Your name<input value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} required minLength="2" maxLength="80" /></label>
      <div className="form-row"><label>Phone<input value={values.phone} onChange={(event) => setValues({ ...values, phone: event.target.value })} maxLength="30" /></label><label>Location<input value={values.location} onChange={(event) => setValues({ ...values, location: event.target.value })} maxLength="100" placeholder="City, country" /></label></div>
      <label>About you<textarea value={values.bio} onChange={(event) => setValues({ ...values, bio: event.target.value })} rows="4" maxLength="500" placeholder="A few words about what you love." /></label>
      <label>Profile image URL<input type="url" value={values.profileImage} onChange={(event) => setValues({ ...values, profileImage: event.target.value })} placeholder="https://" /></label>
      <button className="button button-dark button-wide" disabled={busy}>{busy ? 'Saving…' : 'Save profile'} <ArrowRight size={16} /></button>
    </form>
  </section></main>
}
