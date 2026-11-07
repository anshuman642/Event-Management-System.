import Notification from '../models/Notification.js'

export async function notify(user, title, message, type) {
  return Notification.create({ user, title, message, type })
}
