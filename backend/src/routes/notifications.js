import { Router } from 'express'
import Notification from '../models/Notification.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()
router.use(requireAuth)

router.get('/', asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100)
  res.json({ notifications })
}))

router.patch('/:id/read', asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { isRead: true }, { new: true })
  if (!notification) return res.status(404).json({ message: 'Notification not found.' })
  res.json({ notification })
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await Notification.deleteOne({ _id: req.params.id, user: req.user._id })
  if (!result.deletedCount) return res.status(404).json({ message: 'Notification not found.' })
  res.json({ message: 'Notification deleted.' })
}))

export default router
