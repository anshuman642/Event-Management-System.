import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, Bookmark, MapPin, X } from 'lucide-react'
import { toast } from 'react-toastify'
import api from './api'
import { useAuth } from './useAuth'

export default function SavedEventsPage() {
  const { user, ready } = useAuth()
  const [savedEvents, setSavedEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    api.get('/registrations/saved')
      .then(({ data }) => setSavedEvents(data.savedEvents || []))
      .catch((error) => { console.error('Unable to load saved events:', error); toast.error('Could not load saved events.') })
      .finally(() => setLoading(false))
  }, [user])

  if (!ready) return <main className="loading-state page-empty">Restoring your session…</main>
  if (!user) return <Navigate to="/login?next=%2Fsaved" replace />
  if (user.role !== 'attendee') return <main className="empty-state page-empty"><h2>Saved events are for attendees.</h2><Link className="button button-dark" to="/events">Explore events</Link></main>

  const remove = async (eventId) => {
    try {
      await api.delete(`/registrations/saved/${eventId}`)
      setSavedEvents((items) => items.filter((item) => item.event?._id !== eventId))
      toast.success('Removed from your saved events.')
    } catch (error) {
      console.error('Unable to remove saved event:', error)
      toast.error(error.response?.data?.message || 'Could not remove saved event.')
    }
  }

  return <main className="saved-page">
    <div className="saved-heading"><p className="eyebrow dark-eyebrow">YOUR SHORTLIST</p><h1>Good plans,<br /><span>saved for later.</span></h1><p>Keep the events you’re excited about close by.</p></div>
    {loading ? <div className="loading-state">Finding your saved events…</div> : savedEvents.length ? <div className="saved-grid">{savedEvents.filter((item) => item.event).map(({ event }) => <article className="saved-card" key={event._id}>
      <Link to={`/events/${event._id}`} className="saved-card-image"><img src={event.banner} alt="" /><span>{event.category}</span></Link>
      <div className="saved-card-body"><div className="saved-card-title"><Link to={`/events/${event._id}`}><h2>{event.title}</h2></Link><button onClick={() => remove(event._id)} aria-label={`Remove ${event.title} from saved events`}><X size={17} /></button></div><p><MapPin size={14} /> {event.city || event.venue}</p><Link className="text-link" to={`/events/${event._id}`}>See event <ArrowRight size={15} /></Link></div>
    </article>)}</div> : <section className="saved-empty"><Bookmark size={25} /><h2>Your shortlist is ready.</h2><p>Save an event you like and it’ll show up here.</p><Link className="button button-dark" to="/events">Explore events <ArrowRight size={16} /></Link></section>}
  </main>
}
