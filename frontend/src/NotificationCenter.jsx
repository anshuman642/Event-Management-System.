import { useEffect, useState } from 'react'
import { Bell, Check, X } from 'lucide-react'
import { toast } from 'react-toastify'
import api from './api'

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)

  const loadNotifications = () => api.get('/notifications')
    .then(({ data }) => setNotifications(data.notifications || []))
    .catch((error) => {
      console.error('Unable to load notifications:', error)
      toast.error('Could not load notifications.')
    })

  useEffect(() => {
    api.get('/notifications')
      .then(({ data }) => setNotifications(data.notifications || []))
      .catch((error) => {
        console.error('Unable to load notifications:', error)
        toast.error('Could not load notifications.')
      })
  }, [])

  const markRead = async (id) => {
    try {
      const { data } = await api.patch(`/notifications/${id}/read`)
      setNotifications((items) => items.map((item) => item._id === id ? data.notification : item))
    } catch (error) {
      console.error('Unable to mark notification as read:', error)
      toast.error('Could not update notification.')
    }
  }

  const remove = async (id) => {
    try {
      await api.delete(`/notifications/${id}`)
      setNotifications((items) => items.filter((item) => item._id !== id))
    } catch (error) {
      console.error('Unable to delete notification:', error)
      toast.error('Could not remove notification.')
    }
  }

  const unreadCount = notifications.filter((item) => !item.isRead).length
  return <div className="notification-center">
    <button className="notification-toggle" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={open} onClick={() => { setOpen((value) => !value); if (!open) loadNotifications() }}>
      <Bell size={18} />{unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
    </button>
    {open && <section className="notification-popover" aria-label="Notifications">
      <div className="notification-popover-head"><strong>Notifications</strong><button onClick={() => setOpen(false)} aria-label="Close notifications"><X size={16} /></button></div>
      {notifications.length ? <div className="notification-items">{notifications.map((item) => <article className={`notification-item ${item.isRead ? '' : 'notification-unread'}`} key={item._id}>
        <div><strong>{item.title}</strong><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString()}</small></div>
        <div className="notification-item-actions">{!item.isRead && <button onClick={() => markRead(item._id)} aria-label="Mark as read"><Check size={15} /></button>}<button onClick={() => remove(item._id)} aria-label="Delete notification"><X size={15} /></button></div>
      </article>)}</div> : <p className="notification-empty">You’re all caught up.</p>}
    </section>}
  </div>
}
