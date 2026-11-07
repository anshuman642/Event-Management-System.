import { Router } from 'express'
import { z } from 'zod'
import User from '../models/User.js'
import Event from '../models/Event.js'
import Registration from '../models/Registration.js'
import { allowRoles, requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()
router.use(requireAuth)

router.get('/stats', allowRoles('admin'), asyncHandler(async (_req, res) => {
  const [users, organizers, events, registrations, activeEvents, completedEvents] = await Promise.all([
    User.countDocuments({ role: 'attendee' }),
    User.countDocuments({ role: 'organizer' }),
    Event.countDocuments(),
    Registration.countDocuments({ status: 'registered' }),
    Event.countDocuments({ status: 'published', date: { $gte: new Date() } }),
    Event.countDocuments({ date: { $lt: new Date() } }),
  ])
  res.json({ stats: { users, organizers, events, registrations, activeEvents, completedEvents } })
}))

router.get('/', allowRoles('admin'), asyncHandler(async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : ''
  const query = search ? { $or: [{ name: new RegExp(escapeRegex(search), 'i') }, { email: new RegExp(escapeRegex(search), 'i') }] } : {}
  const users = await User.find(query).select('name email phone bio location profileImage role isBlocked createdAt updatedAt').sort({ createdAt: -1 }).limit(200)
  res.json({ users })
}))

router.get('/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.id !== req.params.id) return res.status(403).json({ message: 'You can only view your own profile.' })
  const user = await User.findById(req.params.id)
  if (!user) return res.status(404).json({ message: 'User not found.' })
  res.json({ user })
}))

router.put('/me', asyncHandler(async (req, res) => {
  const parsed = z.object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: z.string().max(30).optional(),
    bio: z.string().max(500).optional(),
    location: z.string().max(100).optional(),
    profileImage: z.string().url().or(z.literal('')).optional(),
  }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message })
  Object.assign(req.user, parsed.data)
  await req.user.save()
  res.json({ user: req.user })
}))

router.patch('/:id/status', allowRoles('admin'), asyncHandler(async (req, res) => {
  const parsed = z.object({ isBlocked: z.boolean() }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'isBlocked must be true or false.' })
  const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: parsed.data.isBlocked }, { new: true })
  if (!user) return res.status(404).json({ message: 'User not found.' })
  res.json({ user })
}))

router.delete('/:id', allowRoles('admin'), asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) return res.status(404).json({ message: 'User not found.' })
  if (user.role === 'admin') return res.status(400).json({ message: 'Admin accounts cannot be deleted here.' })
  await Promise.all([
    User.deleteOne({ _id: user._id }),
    Registration.deleteMany({ user: user._id }),
    Event.updateMany({ organizer: user._id }, { status: 'cancelled' }),
  ])
  res.json({ message: 'User deleted.' })
}))

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default router
