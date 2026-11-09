import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowUpRight, Check, Clock3, Search, ShieldCheck, Users, X } from 'lucide-react'
import { toast } from 'react-toastify'
import api from './api'
import { useAuth } from './useAuth'

const statItems = [
  ['users', 'Attendees', Users],
  ['organizers', 'Organizers', Users],
  ['events', 'All events', Clock3],
  ['registrations', 'Active tickets', Check],
]

export default function AdminPage() {
  const { user, ready } = useAuth()
  const [stats, setStats] = useState(null)
  const [events, setEvents] = useState([])
  const [users, setUsers] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('events')
  const [query, setQuery] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (user?.role !== 'admin') return
    let active = true
    Promise.all([
      api.get('/users/stats'),
      api.get('/events/admin/pending'),
      api.get('/users'),
      api.get('/registrations/admin'),
    ]).then(([statsResponse, eventResponse, userResponse, registrationResponse]) => {
      if (!active) return
      setStats(statsResponse.data.stats)
      setEvents(eventResponse.data.events || [])
      setUsers(userResponse.data.users || [])
      setRegistrations(registrationResponse.data.registrations || [])
    }).catch((error) => {
      if (!active) return
      console.error('Unable to load admin dashboard:', error)
      toast.error(error.response?.data?.message || 'Could not load the admin dashboard.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user, refreshKey])

  if (!ready) return <main className="loading-state page-empty">Restoring your session…</main>
  if (!user) return <Navigate to="/login?next=%2Fadmin" replace />
  if (user.role !== 'admin') return <main className="empty-state page-empty"><ShieldCheck size={30} /><h2>Admin access only.</h2><Link className="button button-dark" to="/dashboard">Back to dashboard</Link></main>

  const moderate = async (event, approvalStatus) => {
    const rejectionReason = approvalStatus === 'rejected' ? window.prompt('Optional: tell the organizer what to improve.', '') : undefined
    if (approvalStatus === 'rejected' && rejectionReason === null) return
    try {
      await api.patch(`/events/${event._id}/approval`, { approvalStatus, rejectionReason: rejectionReason || '' })
      setEvents((items) => items.filter((item) => item._id !== event._id))
      toast.success(approvalStatus === 'approved' ? 'Event approved and published.' : 'Event returned to the organizer.')
    } catch (error) {
      console.error('Unable to moderate event:', error)
      toast.error(error.response?.data?.message || 'Could not update event approval.')
    }
  }

  const toggleBlocked = async (account) => {
    try {
      const { data } = await api.patch(`/users/${account._id}/status`, { isBlocked: !account.isBlocked })
      setUsers((items) => items.map((item) => item._id === account._id ? data.user : item))
      toast.success(data.user.isBlocked ? 'Account blocked.' : 'Account access restored.')
    } catch (error) {
      console.error('Unable to update account status:', error)
      toast.error(error.response?.data?.message || 'Could not update account.')
    }
  }

  const filteredUsers = users.filter((account) => `${account.name} ${account.email} ${account.phone} ${account.location}`.toLowerCase().includes(query.toLowerCase()))

  return <main className="admin-page">
    <header className="admin-heading"><div><p className="eyebrow dark-eyebrow">EVENTEASE CONTROL ROOM</p><h1>Good morning, {user.name?.split(' ')[0]}<span>.</span></h1><p>Keep the community running smoothly.</p></div><button className="button button-dark" onClick={() => { setLoading(true); setRefreshKey((value) => value + 1) }}>Refresh dashboard <ArrowUpRight size={16} /></button></header>
    <div className="admin-stats">{statItems.map(([key, label, Icon]) => <article className="admin-stat" key={key}><span><Icon size={18} /></span><div><strong>{stats?.[key] ?? '—'}</strong><small>{label}</small></div></article>)}</div>
    <nav className="admin-tabs" aria-label="Admin sections">{[['events', 'Event review'], ['users', 'People'], ['registrations', 'Registrations']].map(([value, label]) => <button key={value} className={tab === value ? 'admin-tab-active' : ''} onClick={() => setTab(value)}>{label}{value === 'events' && events.length > 0 && <span>{events.length}</span>}</button>)}</nav>
    {loading ? <div className="loading-state">Loading the control room…</div> : <>
      {tab === 'events' && <section className="admin-content"><div className="admin-section-heading"><div><h2>Waiting for review</h2><p>Approve events to make them discoverable.</p></div></div>{events.length ? <div className="admin-table">{events.map((event) => <article className="admin-event-row" key={event._id}><img src={event.banner || ''} alt="" /><div className="admin-event-info"><span className="admin-status">Pending review</span><h3>{event.title}</h3><p>{event.category} · {event.city} · {new Date(event.date).toLocaleDateString()}</p><small>Hosted by {event.organizer?.name || 'Unknown organizer'}</small></div><div className="admin-row-actions"><button className="admin-approve" onClick={() => moderate(event, 'approved')}><Check size={15} /> Approve</button><button className="admin-reject" onClick={() => moderate(event, 'rejected')}><X size={15} /> Request changes</button></div></article>)}</div> : <div className="admin-empty"><Check size={22} /><h3>All caught up.</h3><p>There are no events waiting for review.</p></div>}</section>}
      {tab === 'users' && <section className="admin-content"><div className="admin-section-heading"><div><h2>Community members</h2><p>Contact and profile details, with access controls.</p></div><label className="admin-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, phone, or city" /></label></div><div className="admin-table">{filteredUsers.map((account) => <article className="admin-user-row" key={account._id}><div className="admin-user-avatar">{account.name?.slice(0, 1).toUpperCase()}</div><div className="admin-event-info"><h3>{account.name}</h3><p>{account.email}</p><div className="admin-registration-details"><span><b>Phone:</b> {account.phone || 'Not provided'}</span><span><b>Location:</b> {account.location || 'Not provided'}</span>{account.bio && <span><b>About:</b> {account.bio}</span>}</div><small>{account.role} · joined {new Date(account.createdAt).toLocaleDateString()}</small></div><span className={`account-status ${account.isBlocked ? 'account-blocked' : ''}`}>{account.isBlocked ? 'Blocked' : 'Active'}</span><button className="admin-user-action" disabled={account._id === user._id || account.role === 'admin'} onClick={() => toggleBlocked(account)}>{account.isBlocked ? 'Unblock' : 'Block'}</button></article>)}{filteredUsers.length === 0 && <div className="admin-empty"><p>No matching accounts.</p></div>}</div></section>}
      {tab === 'registrations' && <section className="admin-content"><div className="admin-section-heading"><div><h2>Recent registrations</h2><p>Most recent 200 event tickets and attendee details.</p></div></div><div className="admin-table">{registrations.map((registration) => {
        const contact = registration.attendeeDetails || {}
        const slot = registration.bookingSlot || {}
        const amount = Number(registration.paymentAmount || 0) / 100
        return <article className="admin-user-row admin-registration-row" key={registration._id}><div className="admin-user-avatar">{(contact.name || registration.user?.name || 'A').slice(0, 1).toUpperCase()}</div><div className="admin-event-info"><h3>{contact.name || registration.user?.name || 'Deleted attendee'}</h3><p>{registration.event?.title || 'Deleted event'} · ticket {registration.registrationId}</p><div className="admin-registration-details"><span><b>Email:</b> {contact.email || registration.user?.email || 'Not provided'}</span><span><b>Phone:</b> {contact.phone || registration.user?.phone || 'Not provided'}</span><span><b>Attendee city:</b> {contact.city || 'Not provided'}</span><span><b>Event:</b> {slot.date ? new Date(slot.date).toLocaleDateString() : 'Date unavailable'} · {slot.startTime || 'Time TBA'} · {slot.venue || 'Place unavailable'}, {slot.city || ''}</span>{contact.note && <span><b>Note:</b> {contact.note}</span>}<span><b>Booked:</b> {new Date(registration.registeredAt).toLocaleString()}</span></div></div><div className="admin-registration-status"><span className="account-status">{registration.status}</span><small>{registration.paymentStatus === 'not_required' ? 'Free booking' : `${registration.paymentStatus} · ₹${amount.toLocaleString('en-IN')}`}</small></div></article>
      })}{registrations.length === 0 && <div className="admin-empty"><p>No registrations yet.</p></div>}</div></section>}
    </>}
  </main>
}
