import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowDown, ArrowRight, ArrowUpRight, Bookmark, CalendarDays, Check, Clock3, Compass, MapPin, Menu, Search, ShieldCheck, Sparkles, Ticket, Users, X } from 'lucide-react'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import './ticket.css'
import './explore.css'
import './landing.css'
import './account.css'
import api from './api'
import { AuthProvider } from './auth'
import { useAuth } from './useAuth'
import NotificationCenter from './NotificationCenter'
import SavedEventsPage from './SavedEventsPage'
import PasswordResetPage from './PasswordResetPage'
import AdminPage from './AdminPage'
import ProfilePage from './ProfilePage'

const categories = ['Technology', 'Music', 'Business', 'Workshop', 'Sports', 'Culture', 'Education', 'Networking']
const eventDate = (value) => new Date(`${String(value || '').slice(0, 10)}T00:00:00`)
const formatEventDate = (value, options) => eventDate(value).toLocaleDateString('en', options)
const firstUpcomingSlot = (event) => event.slots?.find((slot) => eventDate(slot.date) >= todayAtStart) || event.slots?.[0] || event
const earliestEventDate = new Date().toISOString().slice(0, 10)
const todayAtStart = new Date()
todayAtStart.setHours(0, 0, 0, 0)
const formatFee = (amount) => amount ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount) : 'Free'
const loadRazorpay = () => new Promise((resolve, reject) => {
  if (window.Razorpay) return resolve()
  const script = document.createElement('script')
  script.src = 'https://checkout.razorpay.com/v1/checkout.js'
  script.async = true
  script.onload = () => window.Razorpay ? resolve() : reject(new Error('Razorpay checkout did not load.'))
  script.onerror = () => reject(new Error('Could not load Razorpay checkout. Check your internet connection and try again.'))
  document.body.appendChild(script)
})
const fallbackEvents = [
  { _id: 'sample-1', title: 'The Future of Design Systems', category: 'Technology', date: '2026-11-18', startTime: '09:30', city: 'New York', venue: 'The Glasshouse', eventType: 'Offline', capacity: 240, registeredCount: 196, registrationFee: 35, banner: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1100&q=85', organizer: { name: 'Design Forward' }, status: 'published' },
  { _id: 'sample-2', title: 'Golden Hour Sessions', category: 'Music', date: '2026-11-22', startTime: '18:00', city: 'Brooklyn', venue: 'Pier 17', eventType: 'Offline', capacity: 800, registeredCount: 548, registrationFee: 48, banner: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=1100&q=85', organizer: { name: 'Good Company' }, status: 'published' },
  { _id: 'sample-3', title: 'Build Something That Matters', category: 'Workshop', date: '2026-12-03', startTime: '10:00', city: 'Online', venue: 'Online event', eventType: 'Online', capacity: 120, registeredCount: 72, registrationFee: 0, banner: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1100&q=85', organizer: { name: 'Makers Club' }, status: 'published' },
]

function App() {
  return <AuthProvider><BrowserRouter><div className="app-shell"><Navbar /><Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/events" element={<EventsPage />} />
    <Route path="/events/:id" element={<EventPage />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/forgot-password" element={<PasswordResetPage />} />
    <Route path="/reset-password" element={<PasswordResetPage reset />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/admin" element={<AdminPage />} />
    <Route path="/profile" element={<ProfilePage />} />
    <Route path="/saved" element={<SavedEventsPage />} />
    <Route path="/create-event" element={<CreateEvent />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes><Footer /><ToastContainer position="bottom-right" autoClose={3000} /></div></BrowserRouter></AuthProvider>
}

function Navbar() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  return <header className="site-header"><nav className="nav-wrap">
    <Link className="brand" to="/"><span className="brand-mark"><Sparkles size={17} fill="currentColor" /></span> eventease<span className="brand-dot">.</span></Link>
    <button className="mobile-menu" aria-label="Toggle menu" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    <div className={`nav-links ${open ? 'nav-open' : ''}`}><Link to="/events" onClick={() => setOpen(false)}>Explore events</Link><a href="/#how-it-works" onClick={() => setOpen(false)}>How it works</a><a href="/#about" onClick={() => setOpen(false)}>About</a>{user && <><Link to={user.role === 'admin' ? '/admin' : '/dashboard'} onClick={() => setOpen(false)}>{user.role === 'admin' ? 'Admin dashboard' : 'Dashboard'}</Link><Link to="/profile" onClick={() => setOpen(false)}>Your profile</Link>{user.role === 'attendee' && <Link to="/saved" onClick={() => setOpen(false)}>Saved events</Link>}</>}</div>
    <div className="nav-actions">{user ? <><Link className="nav-dashboard" to={user.role === 'admin' ? '/admin' : '/dashboard'}>{user.role === 'admin' ? 'Admin' : 'Dashboard'}</Link>{user.role === 'attendee' && <Link className="nav-saved" to="/saved" aria-label="Saved events"><Bookmark size={17} /></Link>}<Link className="nav-profile" to="/profile" aria-label="Your profile">{user.name?.slice(0, 1).toUpperCase()}</Link><NotificationCenter /><button className="button button-dark button-small" onClick={logout}>Sign out</button></> : <><Link className="sign-in" to="/login">Log in</Link><Link className="button button-dark button-small" to="/register">Get started <ArrowUpRight size={15} /></Link></>}</div>
  </nav></header>
}

function HomePage() {
  const [events, setEvents] = useState(fallbackEvents)
  useEffect(() => { api.get('/events?limit=3&sort=upcoming').then(({ data }) => { if (data.events?.length) setEvents(data.events) }).catch((error) => console.error('Unable to load featured events:', error)) }, [])
  return <main>
    <section className="hero"><div className="hero-noise" /><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot" /> YOUR NEXT GREAT STORY STARTS HERE</div>
      <h1>Find your people.<br /><span>Make it happen.</span></h1><p className="hero-intro">The good stuff happens when we get together. Discover thoughtful events, meet your kind of people, and leave with a story worth telling.</p>
      <div className="hero-actions"><Link className="button button-lime" to="/events">Explore events <ArrowRight size={17} /></Link><Link className="hero-secondary" to="/register">I'm hosting an event <ArrowUpRight size={15} /></Link></div>
      <div className="hero-social-proof"><div className="avatar-stack"><span>J</span><span>M</span><span>A</span><span>+</span></div><div><strong>Good things are happening</strong><small>Join 10,000+ curious humans</small></div></div>
    </div><div className="hero-art"><div className="hero-image"><img src="https://images.unsplash.com/photo-1517457373958-b7aa7b0f3f2b?auto=format&fit=crop&w=1300&q=90" alt="Friends enjoying an outdoor event" /><div className="image-shade" /></div>
      <div className="floating-note note-top"><span className="note-icon"><CalendarDays size={16} /></span><span><b>Something good is on</b><small>Find your next thing</small></span><ArrowUpRight size={16} /></div>
      <div className="floating-note note-bottom"><span className="online-dot" /><span><b>Events near you</b><small>Made for real life</small></span></div>
      <div className="hero-counter"><b>01</b><span>GOOD PLANS<br />START HERE</span><ArrowDown size={16} /></div>
    </div></section>
    <section className="ticker"><div>LESS SCROLLING, MORE <span>DOING</span> <i>✳</i> FIND YOUR PEOPLE <span>IRL</span> <i>✳</i> SHOW UP FOR SOMETHING <i>✳</i> LESS SCROLLING, MORE <span>DOING</span></div></section>
    <section className="section events-section"><div className="section-heading"><div><p className="eyebrow dark-eyebrow">A FEW GOOD PLANS</p><h2>Worth getting<br />out of the house for<span>.</span></h2></div><Link className="text-link" to="/events">See all events <ArrowUpRight size={17} /></Link></div>
      <div className="event-grid">{events.slice(0, 3).map((event, index) => <EventCard key={event._id} event={event} index={index} />)}</div>
    </section>
    <section className="category-section"><div className="section category-inner"><div><p className="eyebrow">A LITTLE BIT OF EVERYTHING</p><h2>Whatever you’re<br />into, <span>there’s a room.</span></h2></div><div className="category-chips">{categories.map((category, i) => <Link key={category} to={`/events?category=${category}`} className={`category-chip chip-${i}`}>{category}<ArrowUpRight size={14} /></Link>)}</div></div></section>
    <section className="section how-section" id="how-it-works"><div className="how-heading"><p className="eyebrow dark-eyebrow">NO SECRET HANDSHAKE REQUIRED</p><h2>Good plans. <span>Easy.</span></h2></div><div className="steps"><div className="step"><span>01</span><Compass /><h3>Find your thing</h3><p>Browse local happenings or find something new to get curious about.</p></div><div className="step"><span>02</span><Ticket /><h3>Save your spot</h3><p>A couple of taps and you’re in. Your ticket is right there when you need it.</p></div><div className="step"><span>03</span><Users /><h3>Show up & connect</h3><p>Meet good people, try something new, and make the day count.</p></div></div></section>
    <section className="bottom-cta" id="about"><div className="cta-star">✳</div><p className="eyebrow">YOUR CALENDAR LOOKS A LITTLE EMPTY</p><h2>Let’s fix that<span>.</span></h2><p>There’s something happening out there with your name on it.</p><Link className="button button-dark" to="/events">Find your next thing <ArrowRight size={17} /></Link></section>
  </main>
}

function EventCard({ event, index = 0 }) {
  const slot = firstUpcomingSlot(event)
  const date = eventDate(slot.date)
  return <motion.article className="event-card" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.08 }}>
    <Link to={`/events/${event._id}`} className="event-image-link"><img src={event.banner || fallbackEvents[0].banner} alt="" className="event-image" /><span className="event-type">{event.eventType || 'In person'}</span><span className="event-date"><b>{Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en', { day: '2-digit' })}</b><small>{Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en', { month: 'short' }).toUpperCase()}</small></span></Link>
    <div className="event-card-content"><div className="event-meta"><span>{event.category}</span><span className="event-price">{formatFee(event.registrationFee)}</span></div><Link to={`/events/${event._id}`}><h3>{event.title}</h3></Link><p className="event-location"><MapPin size={14} /> {slot.city || slot.venue || 'Location to be announced'} <span>·</span> {slot.startTime || ''}</p>
      <div className="event-card-foot"><span>Hosted by <b>{event.organizer?.name || 'EventEase community'}</b></span><span>{Math.max((event.capacity || 0) - (event.registeredCount || 0), 0)} spots left</span></div></div>
  </motion.article>
}

function EventsPage() {
  const [params, setParams] = useSearchParams()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [query, setQuery] = useState(params.get('search') || '')
  const [category, setCategory] = useState(params.get('category') || '')
  const [dateRange, setDateRange] = useState('any')
  const [sortBy, setSortBy] = useState('upcoming')
  useEffect(() => {
    const timer = setTimeout(() => api.get('/events', { params: { search: query || undefined, category: category || undefined, sort: 'upcoming' } })
      .then(({ data }) => { setEvents(data.events || []); setLoadError(false) })
      .catch((error) => { setEvents([]); setLoadError(true); console.error('Unable to load events:', error) })
      .finally(() => setLoading(false)), 250)
    return () => clearTimeout(timer)
  }, [query, category, retryKey])
  const updateCategory = (value) => {
    if (value !== category) setLoading(true)
    setCategory(value)
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set('category', value)
      else next.delete('category')
      return next
    })
  }
  const visibleEvents = events.filter((event) => {
    if (dateRange === 'any') return true
    const date = eventDate(event.date)
    if (Number.isNaN(date.getTime())) return false
    const limit = new Date(todayAtStart)
    limit.setDate(limit.getDate() + (dateRange === 'week' ? 7 : 30))
    const dates = event.slots?.length ? event.slots.map((slot) => eventDate(slot.date)) : [date]
    return dates.some((slotDate) => slotDate >= todayAtStart && slotDate < limit)
  }).sort((a, b) => {
    if (sortBy === 'popular') return (b.registeredCount || 0) - (a.registeredCount || 0)
    if (sortBy === 'price') return (a.registrationFee || 0) - (b.registrationFee || 0)
    const dateA = eventDate(a.date).getTime()
    const dateB = eventDate(b.date).getTime()
    return (Number.isNaN(dateA) ? Infinity : dateA) - (Number.isNaN(dateB) ? Infinity : dateB)
  })
  const clearFilters = () => {
    setQuery('')
    setDateRange('any')
    updateCategory('')
  }
  return <main className="listing-page"><div className="listing-top"><p className="eyebrow dark-eyebrow">THE GOOD STUFF IS OUT THERE</p><h1>Find your next<br /><span>favorite thing.</span></h1><p>Little gatherings, big ideas, and everything in between.</p><div className="search-bar"><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try “live music” or “Brooklyn”" aria-label="Search events" /><button onClick={() => setQuery('')}>{query ? <X size={18} /> : <ArrowRight size={18} />}</button></div></div>
    <div className="filter-row"><span>{loading ? 'Finding good plans…' : `${visibleEvents.length} ${visibleEvents.length === 1 ? 'event' : 'events'} worth a look`}</span><div className="filter-controls">
      <select className="filter-control" value={category} onChange={(e) => updateCategory(e.target.value)} aria-label="Filter by category"><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
      <select className="filter-control" value={dateRange} onChange={(e) => setDateRange(e.target.value)} aria-label="Filter by date"><option value="any">Any date</option><option value="week">Next 7 days</option><option value="month">Next 30 days</option></select>
      <select className="filter-control" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort events"><option value="upcoming">Soonest</option><option value="popular">Most popular</option><option value="price">Price: low to high</option></select>
      {(query || category || dateRange !== 'any') && <button className="filter-clear" onClick={clearFilters}>Clear filters</button>}
    </div></div>
    {loading ? <div className="loading-state">Finding good plans<span>...</span></div> : loadError ? <div className="empty-state"><h2>Events are taking a breather.</h2><p>We couldn’t connect to EventEase. Please try again in a moment.</p><button className="button button-dark" onClick={() => { setLoading(true); setRetryKey((value) => value + 1) }}>Try again</button></div> : visibleEvents.length ? <div className="event-grid">{visibleEvents.map((event, index) => <EventCard key={event._id} event={event} index={index} />)}</div> : <div className="empty-state"><span>✳</span><h2>No plans just yet.</h2><p>Try a different search or check back soon.</p><button className="button button-dark" onClick={clearFilters}>Clear filters</button></div>}
  </main>
}

function EventPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [pendingPayment, setPendingPayment] = useState(null)
  const [saved, setSaved] = useState(false)
  const [attendeeDetails, setAttendeeDetails] = useState({ name: '', email: '', phone: '', city: '', note: '' })
  const initializedForUser = useRef('')
  const [selectedSlotId, setSelectedSlotId] = useState('')
  useEffect(() => {
    if (!user?._id || initializedForUser.current === user._id) return
    initializedForUser.current = user._id
    setAttendeeDetails({ name: user.name || '', email: user.email || '', phone: user.phone || '', city: user.location || '', note: '' })
  }, [user])
  useEffect(() => {
    api.get(`/events/${id}`).then(({ data }) => setResult({ id, event: data.event })).catch((error) => {
      const demoEvent = fallbackEvents.find((item) => item._id === id) || null
      setResult({ id, event: demoEvent })
      console.error('Unable to load event details:', error)
    })
  }, [id])
  useEffect(() => {
    if (!user || user.role !== 'attendee') return
    api.get('/registrations/saved').then(({ data }) => {
      setSaved((data.savedEvents || []).some((item) => item.event?._id === id))
    }).catch((error) => console.error('Unable to check saved event status:', error))
  }, [id, user])
  const event = result?.id === id ? result.event : null
  const bookingSlots = event ? (event.slots?.length ? event.slots : [{ _id: 'default', date: event.date, startTime: event.startTime, endTime: event.endTime, venue: event.venue, city: event.city, capacity: event.capacity, registeredCount: event.registeredCount }]) : []
  const selectedSlot = bookingSlots.find((slot) => slot._id === selectedSlotId && eventDate(slot.date) >= todayAtStart) || bookingSlots.find((slot) => eventDate(slot.date) >= todayAtStart && slot.registeredCount < slot.capacity) || bookingSlots[0]
  if (!event && result?.id !== id) return <main className="loading-state page-empty">Loading event details…</main>
  if (!event) return <main className="empty-state page-empty"><h2>We couldn’t find that event.</h2><Link className="button button-dark" to="/events">Explore events</Link></main>
  const cancelPaymentReservation = async (registrationId) => {
    try { await api.post('/registrations/payment/cancel', { registrationId }) }
    catch (error) { console.error('Unable to release payment reservation:', error) }
  }
  const verifyPayment = async (payment) => {
    setBusy(true)
    try {
      const { data } = await api.post('/registrations/payment/verify', { registrationId: payment.registrationId, ...payment.response })
      setPendingPayment(null)
      toast.success('Payment confirmed! Your ticket is ready.')
      navigate('/dashboard', { state: { ticket: data.registration } })
    } catch (error) {
      console.error('Unable to verify Razorpay payment:', error)
      toast.error(error.response?.data?.message || 'Could not verify your payment. Retry verification before starting a new checkout.')
      setPendingPayment(payment)
    } finally {
      setBusy(false)
    }
  }
  const register = async () => {
    if (!user) return navigate(`/login?next=${encodeURIComponent(`/events/${event._id}`)}`)
    if (!selectedSlot) return toast.error('Choose an available date and location first.')
    const details = {
      name: attendeeDetails.name.trim() || user.name || '',
      email: attendeeDetails.email.trim() || user.email || '',
      phone: attendeeDetails.phone.trim() || user.phone || '',
      city: attendeeDetails.city.trim() || user.location || '',
      note: attendeeDetails.note.trim(),
    }
    if (details.name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email) || details.phone.length < 7 || !details.city) {
      return toast.error('Please complete your name, email, phone number, and city before booking.')
    }
    if (pendingPayment) return verifyPayment(pendingPayment)
    setBusy(true)
    try {
      if (!event.registrationFee) {
        const { data } = await api.post('/registrations', { eventId: event._id, slotId: selectedSlot._id, attendeeDetails: details })
        toast.success('You’re on the list! Your ticket is ready.')
        navigate('/dashboard', { state: { ticket: data.registration } })
        return
      }
      await loadRazorpay()
      const { data } = await api.post('/registrations/payment/order', { eventId: event._id, slotId: selectedSlot._id, attendeeDetails: details })
      let verificationStarted = false
      const checkout = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'EventEase',
        description: event.title,
        order_id: data.orderId,
        handler: (response) => {
          verificationStarted = true
          const payment = { registrationId: data.registrationId, response }
          setPendingPayment(payment)
          verifyPayment(payment)
        },
        modal: {
          ondismiss: () => {
            if (!verificationStarted) cancelPaymentReservation(data.registrationId)
            setBusy(false)
          },
        },
        theme: { color: '#1b2019' },
      })
      checkout.on('payment.failed', (response) => {
        cancelPaymentReservation(data.registrationId)
        toast.error(response.error?.description || 'Payment failed. Please try again.')
        setBusy(false)
      })
      checkout.open()
    } catch (error) {
      console.error('Unable to start registration checkout:', error)
      toast.error(error.response?.data?.message || error.message || 'Could not start checkout.')
      setBusy(false)
    }
  }
  const toggleSaved = async () => {
    if (!user) return navigate(`/login?next=${encodeURIComponent(`/events/${event._id}`)}`)
    if (user.role !== 'attendee') return toast.info('Saved events are available for attendee accounts.')
    try {
      if (saved) await api.delete(`/registrations/saved/${event._id}`)
      else await api.post(`/registrations/saved/${event._id}`)
      setSaved(!saved)
      toast.success(saved ? 'Removed from saved events.' : 'Added to saved events.')
    } catch (error) {
      console.error('Unable to update saved event:', error)
      toast.error(error.response?.data?.message || 'Could not update saved event.')
    }
  }
  const date = eventDate(event.date)
  return <main className="event-detail"><div className="detail-banner"><img src={event.banner || fallbackEvents[0].banner} alt="" /><span>{event.category}</span></div><div className="detail-layout"><article><p className="eyebrow dark-eyebrow">{event.eventType} EVENT · {event.city}</p><h1>{event.title}</h1><p className="detail-description">{event.description || 'A good event is more than what’s on the schedule. It’s the people you meet, the ideas you take home, and the stories you’ll tell afterward.'}</p><div className="detail-host"><div className="host-avatar">{(event.organizer?.name || 'E').slice(0, 1)}</div><div><small>HOSTED BY</small><b>{event.organizer?.name || 'EventEase community'}</b></div></div><div className="detail-facts"><div><CalendarDays /><span><b>{Number.isNaN(date.getTime()) ? 'Date to be announced' : date.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</b><small>{event.startTime || 'Time TBA'}{event.endTime ? ` – ${event.endTime}` : ''}</small></span></div><div><MapPin /><span><b>{event.venue || event.city}</b><small>{event.city}</small></span></div><div><Users /><span><b>{event.capacity - event.registeredCount} spots remaining</b><small>Across all dates</small></span></div></div></article><aside className="ticket-panel"><div className="ticket-panel-top"><span className="ticket-panel-label">CHOOSE YOUR DATE & PLACE</span><strong>{formatFee(event.registrationFee)}</strong></div><label className="booking-slot-label" htmlFor="booking-slot">Available sessions</label><select className="booking-slot-select" id="booking-slot" value={selectedSlot?._id || ''} onChange={(e) => setSelectedSlotId(e.target.value)}>{bookingSlots.map((slot) => { const past = eventDate(slot.date) < todayAtStart; const full = slot.registeredCount >= slot.capacity; return <option key={slot._id} value={slot._id} disabled={past || full}>{formatEventDate(slot.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · {slot.startTime} · {slot.city} · {Math.max(slot.capacity - slot.registeredCount, 0)} spots left{full ? ' · Full' : past ? ' · Past' : ''}</option> })}</select>{selectedSlot && <div className="selected-slot-summary"><CalendarDays size={15} /><span><b>{formatEventDate(selectedSlot.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</b><small>{selectedSlot.startTime}{selectedSlot.endTime ? ` – ${selectedSlot.endTime}` : ''}</small></span><MapPin size={15} /><span><b>{selectedSlot.venue}</b><small>{selectedSlot.city}</small></span></div>}
    <div className="attendee-details-form"><h3>Your booking details</h3><div className="attendee-detail-row"><label>Full name<input value={attendeeDetails.name} onChange={(e) => setAttendeeDetails((current) => ({ ...current, name: e.target.value }))} autoComplete="name" required minLength="2" maxLength="80" /></label><label>Email<input type="email" value={attendeeDetails.email} onChange={(e) => setAttendeeDetails((current) => ({ ...current, email: e.target.value }))} autoComplete="email" required /></label></div><div className="attendee-detail-row"><label>Phone<input type="tel" value={attendeeDetails.phone} onChange={(e) => setAttendeeDetails((current) => ({ ...current, phone: e.target.value }))} autoComplete="tel" required minLength="7" maxLength="30" /></label><label>City / location<input value={attendeeDetails.city} onChange={(e) => setAttendeeDetails((current) => ({ ...current, city: e.target.value }))} autoComplete="address-level2" required maxLength="100" /></label></div><label>Note for the organizer <span className="optional-field">(optional)</span><textarea value={attendeeDetails.note} onChange={(e) => setAttendeeDetails((current) => ({ ...current, note: e.target.value }))} rows="2" maxLength="500" placeholder="Anything the organizer should know?" /></label></div>
    <p>One good plan. One very easy ticket.</p><button className="button button-lime button-wide" onClick={register} disabled={busy || !selectedSlot || selectedSlot.registeredCount >= selectedSlot.capacity || eventDate(selectedSlot.date) < todayAtStart}>{busy ? 'Saving your spot…' : pendingPayment ? 'Retry payment verification' : !selectedSlot || selectedSlot.registeredCount >= selectedSlot.capacity ? 'This date is full' : 'Book this date'} <ArrowRight size={17} /></button><button className="save-event-button" onClick={toggleSaved}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />{saved ? 'Saved for later' : 'Save this event'}</button><div className="secure-note"><ShieldCheck size={15} /> {event.registrationFee ? 'Secure Razorpay checkout · instant ticket after payment' : 'Secure registration · instant confirmation'}</div><div className="panel-divider" /><div className="panel-note"><Clock3 size={16} /><span>Booking status and your selected date appear on your dashboard.</span></div></aside></div></main>
}

function AuthPage({ mode }) {
  const isRegister = mode === 'register'
  const [params] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()
  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    const form = Object.fromEntries(new FormData(e.currentTarget))
    try {
      if (isRegister) await api.post('/auth/register', { ...form, role: form.role || 'attendee' })
      const { data } = await api.post('/auth/login', { email: form.email, password: form.password })
      login(data.user); toast.success(isRegister ? 'Welcome to the good stuff.' : 'Welcome back.'); navigate(params.get('next') || '/dashboard')
    } catch (e) { setError(e.response?.data?.message || 'Something went wrong. Please try again.') }
    finally { setLoading(false) }
  }
  return <main className="auth-page"><div className="auth-art"><img src="https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1100&q=85" alt="Friends sharing a meal" /><div><p className="eyebrow">GOOD THINGS HAPPEN TOGETHER</p><h2>Go where the<br />good stuff happens.</h2><p>Find a room full of people who get it.</p></div></div><div className="auth-form-wrap"><Link to="/" className="brand auth-brand"><span className="brand-mark"><Sparkles size={17} fill="currentColor" /></span> eventease<span className="brand-dot">.</span></Link><div className="auth-form-content"><p className="eyebrow dark-eyebrow">{isRegister ? 'A GOOD THING STARTS HERE' : 'GOOD TO HAVE YOU BACK'}</p><h1>{isRegister ? 'Come on in.' : 'Welcome back.'}</h1><p className="auth-subtitle">{isRegister ? 'Make an account and find your people.' : 'Your next good plan is waiting.'}</p>{error && <div className="form-error">{error}</div>}<form onSubmit={submit} className="auth-form">
      {isRegister && <><label>Your name<input name="name" required minLength="2" placeholder="How should we call you?" /></label><label>I’m here to<select name="role"><option value="attendee">Find and attend events</option><option value="organizer">Host events</option></select></label></>}
      <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label><label>Password<input name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} minLength="8" required placeholder="At least 8 characters" /></label>
      {!isRegister && <Link className="forgot-password-link" to="/forgot-password">Forgot your password?</Link>}<button className="button button-dark button-wide" disabled={loading}>{loading ? 'One moment…' : isRegister ? 'Create my account' : 'Log in'} <ArrowRight size={16} /></button></form><p className="auth-switch">{isRegister ? 'Already have an account?' : 'New around here?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Log in' : 'Join EventEase'}</Link></p><p className="auth-legal">By continuing, you agree to our Terms of Service and Privacy Policy.</p></div></div></main>
}

function Dashboard() {
  const { user, ready } = useAuth()
  const location = useLocation()
  const [search] = useSearchParams()
  const [registrations, setRegistrations] = useState([])
  const [myEvents, setMyEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [ticket, setTicket] = useState(location.state?.ticket || null)
  useEffect(() => {
    if (!user) return
    const requests = user.role === 'organizer' ? api.get('/events/mine') : api.get('/registrations/my')
    requests.then(({ data }) => user.role === 'organizer' ? setMyEvents(data.events || []) : setRegistrations(data.registrations || [])).catch((e) => toast.error(e.response?.data?.message || 'Could not load your dashboard.')).finally(() => setLoading(false))
  }, [user])
  if (!ready) return <main className="loading-state page-empty">Restoring your session…</main>
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(search.get('next') || '/dashboard')}`} replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  const isOrganizer = user.role === 'organizer' || user.role === 'admin'
  const items = isOrganizer ? myEvents : registrations
  const create = () => window.location.assign('/create-event')
  const cancel = async (registrationId) => { const registration = registrations.find((item) => item._id === registrationId); if (registration?.paymentStatus === 'paid') return toast.info('Paid ticket refunds are not automated yet. Contact the event organizer.'); try { await api.delete(`/registrations/${registrationId}`); setRegistrations((items) => items.filter((r) => r._id !== registrationId)); toast.success('Registration cancelled.') } catch (e) { toast.error(e.response?.data?.message || 'Could not cancel registration.') } }
  return <main className="dashboard-page"><div className="dashboard-head"><div><p className="eyebrow dark-eyebrow">{isOrganizer ? 'YOUR COMMUNITY, YOUR CALL' : 'YOUR GOOD PLANS, ALL IN ONE PLACE'}</p><h1>Hey, {user.name?.split(' ')[0]}<span>.</span></h1><p>{isOrganizer ? 'Here’s what’s happening with your events.' : 'A little something to look forward to.'}</p></div>{isOrganizer && <button className="button button-dark" onClick={create}>Create an event <ArrowRight size={16} /></button>}</div>
    {ticket && <div className="success-banner"><Check /> You’re registered! Your ticket ID is <b>{ticket.registrationId}</b><button onClick={() => setTicket(null)} aria-label="Dismiss">×</button></div>}
    <div className="dashboard-stats"><Stat icon={<Ticket />} label={isOrganizer ? 'Total events' : 'Bookings'} value={loading ? '—' : items.length} /><Stat icon={<CalendarDays />} label="Upcoming" value={loading ? '—' : items.filter((item) => eventDate(item.bookingSlot?.date || item.event?.date || item.date) >= todayAtStart && item.status !== 'cancelled').length} /><Stat icon={<Users />} label={isOrganizer ? 'Total attendees' : 'Your role'} value={loading ? '—' : isOrganizer ? items.reduce((sum, e) => sum + (e.registeredCount || 0), 0) : 'Attendee'} /></div>
    <div className="dashboard-list-head"><div><p className="eyebrow dark-eyebrow">{isOrganizer ? 'WHAT YOU’RE PUTTING OUT THERE' : 'ON YOUR CALENDAR'}</p><h2>{isOrganizer ? 'Your events' : 'Your registrations'}</h2></div>{!isOrganizer && <Link className="text-link" to="/events">Find more events <ArrowRight size={16} /></Link>}</div>
    {loading ? <div className="loading-state">Getting your good plans…</div> : !items.length ? <div className="empty-state dash-empty"><span>✳</span><h2>No plans on the calendar yet.</h2><p>{isOrganizer ? 'Your next event starts with an idea.' : 'Your next favorite thing is out there.'}</p><Link className="button button-dark" to={isOrganizer ? '/create-event' : '/events'}>{isOrganizer ? 'Create an event' : 'Explore events'} <ArrowRight size={16} /></Link></div> : <div className="dashboard-event-list">{items.map((item) => { const event = isOrganizer ? item : item.event; if (!event) return null; const date = isOrganizer ? event.date : item.bookingSlot?.date || event.date; const startTime = isOrganizer ? event.startTime : item.bookingSlot?.startTime || event.startTime; const venue = isOrganizer ? event.venue : item.bookingSlot?.venue || event.venue; const city = isOrganizer ? event.city : item.bookingSlot?.city || event.city; const status = isOrganizer ? event.approvalStatus || event.status : item.paymentStatus === 'pending' ? 'Payment pending' : item.status; return <div className="dashboard-event" key={item._id}><img src={event.banner || fallbackEvents[0].banner} alt="" /><div className="dashboard-event-main"><span className={`status-pill status-${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</span><Link to={`/events/${event._id}`}><h3>{event.title}</h3></Link><p><CalendarDays size={14} /> {formatEventDate(date, { month: 'short', day: 'numeric', year: 'numeric' })} · {startTime} <span>·</span> <MapPin size={14} /> {venue}, {city}</p></div><div className="dashboard-event-action">{isOrganizer ? <span>{event.registeredCount || 0} going</span> : <><b>{item.registrationId}</b>{item.status === 'registered' && <button className="cancel-link" onClick={() => setTicket(item)}>View ticket</button>}{item.status === 'registered' && <button className="cancel-link" onClick={() => cancel(item._id)}>Cancel</button>}</>}</div></div> })}</div>}
    {ticket && <TicketModal ticket={ticket} onClose={() => setTicket(null)} />}
  </main>
}
function Stat({ icon, label, value }) { return <div className="stat-card"><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div> }

function TicketModal({ ticket, onClose }) {
  const event = ticket.event
  const slot = ticket.bookingSlot || event
  return <div className="modal-backdrop" role="presentation" onClick={onClose}><section className="ticket-modal" role="dialog" aria-modal="true" aria-labelledby="ticket-heading" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close ticket"><X size={18} /></button><span className="ticket-modal-mark"><Sparkles size={16} fill="currentColor" /></span><p className="eyebrow dark-eyebrow">YOUR SPOT IS SAVED</p><h2 id="ticket-heading">{event?.title || 'Your EventEase ticket'}</h2><p>{slot?.date ? eventDate(slot.date).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' }) : ''} {slot?.startTime ? `· ${slot.startTime}` : ''}</p><p>{slot?.venue}{slot?.city ? `, ${slot.city}` : ''}</p>{ticket.qrCode && <img className="ticket-qr" src={ticket.qrCode} alt={`QR ticket ${ticket.registrationId}`} />}<div className="ticket-id">{ticket.registrationId}</div><p className="ticket-attendee">{ticket.attendeeDetails?.name || ticket.user?.name || 'Show this QR code at the door'}</p>{ticket.attendeeDetails?.email && <p className="ticket-contact">{ticket.attendeeDetails.email} · {ticket.attendeeDetails.phone}</p>}{ticket.qrCode && <a className="button button-dark button-wide" href={ticket.qrCode} download={`${ticket.registrationId}.png`}>Download ticket QR</a>}</section></div>
}

function CreateEvent() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [extraSlots, setExtraSlots] = useState([])
  if (!user) return <Navigate to="/login" replace />
  if (!['organizer', 'admin'].includes(user.role)) return <main className="empty-state page-empty"><h2>This space is for event hosts.</h2><Link className="button button-dark" to="/dashboard">Back to dashboard</Link></main>
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const formData = new FormData(e.currentTarget)
    const body = Object.fromEntries(formData)
    body.registrationFee = Number(body.registrationFee || 0)
    body.slots = [
      { date: body.date, startTime: body.startTime, endTime: body.endTime, venue: body.venue, city: body.city, capacity: Number(body.capacity) },
      ...extraSlots.map(({ key }) => ({
        date: formData.get(`extra-date-${key}`),
        startTime: formData.get(`extra-start-${key}`),
        endTime: formData.get(`extra-end-${key}`) || '',
        venue: formData.get(`extra-venue-${key}`),
        city: formData.get(`extra-city-${key}`),
        capacity: Number(formData.get(`extra-capacity-${key}`)),
      })),
    ]
    try {
      await api.post('/events', body)
      toast.success('Your event and booking slots are submitted for review.')
      navigate('/dashboard')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not create your event.')
    } finally {
      setBusy(false)
    }
  }
  return <main className="create-page"><div className="create-intro"><p className="eyebrow dark-eyebrow">PUT SOMETHING GOOD ON THE CALENDAR</p><h1>Make a little<br /><span>magic happen.</span></h1><p>Tell us what you’re planning. Give attendees a choice of dates and places.</p></div><form className="create-form" onSubmit={submit}>
    <div className="form-section-title"><span>01</span><div><h2>The basics</h2><p>Give people a reason to show up.</p></div></div>
    <label>Event name<input name="title" required minLength="3" maxLength="120" placeholder="Give it a name people will remember" /></label>
    <label>Description<textarea name="description" rows="5" required minLength="20" placeholder="What’s happening? Who’s it for? What should people expect?" /></label>
    <div className="form-row"><label>Category<select name="category" required>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label>Event format<select name="eventType"><option>Offline</option><option>Online</option><option>Hybrid</option></select></label></div>
    <div className="form-section-title form-section-spaced"><span>02</span><div><h2>Booking dates & places</h2><p>Attendees choose one slot; each slot has its own capacity.</p></div></div>
    <fieldset className="slot-editor"><legend>Booking option 1</legend><div className="form-row"><label>Date<input name="date" type="date" required min={earliestEventDate} /></label><label>Start time<input name="startTime" type="time" required /></label></div>
      <div className="form-row"><label>End time<input name="endTime" type="time" /></label><label>Available spots<input name="capacity" type="number" min="1" max="100000" required defaultValue="50" /></label></div>
      <div className="form-row"><label>City<input name="city" required placeholder="Where is it happening?" /></label><label>Venue<input name="venue" required placeholder="Venue or online location" /></label></div>
    </fieldset>
    {extraSlots.map(({ key }, index) => <fieldset className="slot-editor" key={key}><legend>Booking option {index + 2}</legend><button type="button" className="slot-remove" onClick={() => setExtraSlots((items) => items.filter((slot) => slot.key !== key))} aria-label={`Remove booking option ${index + 2}`}><X size={15} /></button>
      <div className="form-row"><label>Date<input name={`extra-date-${key}`} type="date" required min={earliestEventDate} /></label><label>Start time<input name={`extra-start-${key}`} type="time" required /></label></div>
      <div className="form-row"><label>End time<input name={`extra-end-${key}`} type="time" /></label><label>Available spots<input name={`extra-capacity-${key}`} type="number" min="1" max="100000" required defaultValue="50" /></label></div>
      <div className="form-row"><label>City<input name={`extra-city-${key}`} required placeholder="Where is it happening?" /></label><label>Venue<input name={`extra-venue-${key}`} required placeholder="Venue or online location" /></label></div>
    </fieldset>)}
    {extraSlots.length < 29 && <button className="add-slot-button" type="button" onClick={() => setExtraSlots((items) => [...items, { key: crypto.randomUUID() }])}><CalendarDays size={16} /> Add another date & place</button>}
    <div className="form-section-title form-section-spaced"><span>03</span><div><h2>Tickets & details</h2><p>One price applies to every booking option.</p></div></div>
    <label>Ticket price (INR)<input name="registrationFee" type="number" min="0" step="0.01" defaultValue="0" /></label>
    <label>Banner image URL<input name="banner" type="url" placeholder="https://…" /></label>
    <button className="button button-dark button-wide create-submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit for approval'} <ArrowRight size={16} /></button>
    <p className="form-footnote">Every slot is reviewed together with your event before publishing.</p>
  </form></main>
}

function Footer() { return <footer className="site-footer"><Link className="brand footer-brand" to="/"><span className="brand-mark"><Sparkles size={17} fill="currentColor" /></span> eventease<span className="brand-dot">.</span></Link><p>Life happens when you show up.</p><div><Link to="/events">Explore</Link><Link to="/register">Host with us</Link><a href="mailto:hello@eventease.example">Say hello</a></div><small>© 2026 EventEase. Made for getting together.</small></footer> }

export default App
