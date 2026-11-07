import { Router } from 'express'
import { z } from 'zod'
import Event from '../models/Event.js'
import SavedEvent from '../models/SavedEvent.js'
import { allowRoles, requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { notify } from '../utils/notifications.js'

const router = Router()
const eventInput = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().min(20).max(10000),
  category: z.string().trim().min(1).max(60),
  banner: z.string().url().or(z.literal('')).optional(),
  date: z.coerce.date(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  venue: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  eventType: z.enum(['Online', 'Offline', 'Hybrid']),
  capacity: z.coerce.number().int().min(1).max(100000),
  registrationFee: z.coerce.number().min(0).max(1000000).default(0),
  slots: z.array(z.object({
    date: z.coerce.date(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
    venue: z.string().trim().min(1).max(200),
    city: z.string().trim().min(1).max(100),
    capacity: z.coerce.number().int().min(1).max(100000),
  })).min(1).max(30).optional(),
})

router.get('/mine', requireAuth, allowRoles('organizer', 'admin'), asyncHandler(async (req, res) => {
  const query = req.user.role === 'admin' ? {} : { organizer: req.user._id }
  const events = await Event.find(query).sort({ createdAt: -1 }).populate('organizer', 'name')
  res.json({ events })
}))

router.get('/admin/pending', requireAuth, allowRoles('admin'), asyncHandler(async (_req, res) => {
  const events = await Event.find({ approvalStatus: 'pending' }).populate('organizer', 'name email').sort({ createdAt: 1 })
  res.json({ events })
}))

router.get('/', asyncHandler(async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1)
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 30, 1), 100)
  const today = new Date(new Date().setHours(0, 0, 0, 0))
  const filter = { status: 'published', approvalStatus: 'approved', $and: [{ $or: [{ date: { $gte: today } }, { slots: { $elemMatch: { date: { $gte: today } } } }] }] }
  if (typeof req.query.category === 'string' && req.query.category) filter.category = req.query.category
  if (typeof req.query.eventType === 'string' && ['Online', 'Offline', 'Hybrid'].includes(req.query.eventType)) filter.eventType = req.query.eventType
  if (req.query.free === 'true') filter.registrationFee = 0
  if (req.query.available === 'true') filter.$expr = { $lt: ['$registeredCount', '$capacity'] }
  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    const expression = new RegExp(escapeRegex(req.query.search.trim().slice(0, 80)), 'i')
    filter.$and.push({ $or: [{ title: expression }, { city: expression }, { venue: expression }, { 'slots.city': expression }, { 'slots.venue': expression }] })
  }
  const sort = req.query.sort === 'newest' ? { createdAt: -1 } : req.query.sort === 'price-low' ? { registrationFee: 1 } : req.query.sort === 'price-high' ? { registrationFee: -1 } : { date: 1, startTime: 1 }
  const [events, total] = await Promise.all([
    Event.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).populate('organizer', 'name'),
    Event.countDocuments(filter),
  ])
  res.json({ events, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, status: 'published', approvalStatus: 'approved' }).populate('organizer', 'name bio profileImage')
  if (!event) return res.status(404).json({ message: 'That event is not available.' })
  res.json({ event })
}))

router.post('/', requireAuth, allowRoles('organizer', 'admin'), asyncHandler(async (req, res) => {
  const parsed = eventInput.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message })
  const data = normalizeSlots(parsed.data)
  if (data.capacity > 100000) return res.status(400).json({ message: 'Combined capacity across all booking options cannot exceed 100,000.' })
  if (data.slots.some((slot) => slot.date < new Date(new Date().setHours(0, 0, 0, 0)))) return res.status(400).json({ message: 'Every booking date must be today or later.' })
  const event = await Event.create({ ...data, organizer: req.user._id, status: 'pending', approvalStatus: 'pending' })
  res.status(201).json({ event })
}))

router.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id)
  if (!event) return res.status(404).json({ message: 'Event not found.' })
  if (req.user.role !== 'admin' && !event.organizer.equals(req.user._id)) return res.status(403).json({ message: 'You can only edit your own events.' })
  const parsed = eventInput.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message })
  const scheduleFields = ['date', 'startTime', 'endTime', 'venue', 'city', 'capacity', 'slots']
  const legacyScheduleFields = ['date', 'startTime', 'endTime', 'venue', 'city', 'capacity']
  if (event.registeredCount > 0 && scheduleFields.some((field) => parsed.data[field] !== undefined)) {
    return res.status(400).json({ message: 'Dates, locations, and capacities cannot be changed after attendees have booked.' })
  }
  if (!parsed.data.slots && event.slots.length > 1 && legacyScheduleFields.some((field) => parsed.data[field] !== undefined)) {
    return res.status(400).json({ message: 'Provide the complete slots list when changing a multi-date event schedule.' })
  }
  if (!parsed.data.slots && event.slots.length === 1 && legacyScheduleFields.some((field) => parsed.data[field] !== undefined)) {
    const current = event.slots[0].toObject()
    parsed.data.slots = [{
      date: parsed.data.date ?? current.date,
      startTime: parsed.data.startTime ?? current.startTime,
      endTime: parsed.data.endTime ?? current.endTime,
      venue: parsed.data.venue ?? current.venue,
      city: parsed.data.city ?? current.city,
      capacity: parsed.data.capacity ?? current.capacity,
    }]
  }
  if (parsed.data.capacity !== undefined && parsed.data.capacity < event.registeredCount) return res.status(400).json({ message: 'Capacity cannot be lower than the current registration count.' })
  if (parsed.data.slots && event.registeredCount > 0) return res.status(400).json({ message: 'Booking slots cannot be changed after registrations have been made.' })
  const data = parsed.data.slots || scheduleFields.some((field) => parsed.data[field] !== undefined)
    ? normalizeSlots({ ...event.toObject(), ...parsed.data })
    : parsed.data
  if (data.capacity > 100000) return res.status(400).json({ message: 'Combined capacity across all booking options cannot exceed 100,000.' })
  if (data.slots?.some((slot) => slot.date < new Date(new Date().setHours(0, 0, 0, 0)))) return res.status(400).json({ message: 'Every booking date must be today or later.' })
  Object.assign(event, data)
  if (req.user.role !== 'admin') {
    event.status = 'pending'
    event.approvalStatus = 'pending'
    event.rejectionReason = ''
  }
  await event.save()
  res.json({ event })
}))

router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id)
  if (!event) return res.status(404).json({ message: 'Event not found.' })
  if (req.user.role !== 'admin' && !event.organizer.equals(req.user._id)) return res.status(403).json({ message: 'You can only delete your own events.' })
  event.status = 'cancelled'
  await event.save()
  res.json({ message: 'Event cancelled.' })
}))

router.patch('/:id/status', requireAuth, asyncHandler(async (req, res) => {
  const parsed = z.object({ status: z.enum(['draft', 'pending', 'published', 'cancelled']) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Choose a valid event status.' })
  const event = await Event.findById(req.params.id)
  if (!event) return res.status(404).json({ message: 'Event not found.' })
  if (req.user.role !== 'admin' && !event.organizer.equals(req.user._id)) return res.status(403).json({ message: 'You can only manage your own events.' })
  if (parsed.data.status === 'published' && event.approvalStatus !== 'approved') return res.status(400).json({ message: 'An event must be approved before it can be published.' })
  event.status = parsed.data.status
  await event.save()
  res.json({ event })
}))

router.patch('/:id/approval', requireAuth, allowRoles('admin'), asyncHandler(async (req, res) => {
  const parsed = z.object({ approvalStatus: z.enum(['approved', 'rejected']), rejectionReason: z.string().max(500).optional() }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Choose approved or rejected.' })
  const event = await Event.findById(req.params.id)
  if (!event) return res.status(404).json({ message: 'Event not found.' })
  event.approvalStatus = parsed.data.approvalStatus
  event.status = parsed.data.approvalStatus === 'approved' ? 'published' : 'draft'
  event.rejectionReason = parsed.data.approvalStatus === 'rejected' ? (parsed.data.rejectionReason || '') : ''
  await event.save()
  await notify(event.organizer, `Event ${parsed.data.approvalStatus}`, parsed.data.approvalStatus === 'approved' ? `${event.title} is approved and published.` : `${event.title} needs changes. ${event.rejectionReason}`, parsed.data.approvalStatus === 'approved' ? 'approval' : 'rejection')
  res.json({ event })
}))

router.post('/:id/save', requireAuth, asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, status: 'published', approvalStatus: 'approved' })
  if (!event) return res.status(404).json({ message: 'Event not found.' })
  await SavedEvent.findOneAndUpdate({ user: req.user._id, event: event._id }, { $setOnInsert: { user: req.user._id, event: event._id } }, { upsert: true })
  res.json({ message: 'Event saved.' })
}))

router.delete('/:id/save', requireAuth, asyncHandler(async (req, res) => {
  await SavedEvent.deleteOne({ user: req.user._id, event: req.params.id })
  res.json({ message: 'Saved event removed.' })
}))

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeSlots(data) {
  const slots = (data.slots?.length ? data.slots : [{
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime || '',
    venue: data.venue,
    city: data.city,
    capacity: data.capacity,
  }]).sort((a, b) => new Date(a.date) - new Date(b.date) || a.startTime.localeCompare(b.startTime))
  return {
    ...data,
    date: slots[0].date,
    startTime: slots[0].startTime,
    endTime: slots[0].endTime || '',
    venue: slots[0].venue,
    city: slots[0].city,
    capacity: slots.reduce((total, slot) => total + Number(slot.capacity), 0),
    slots,
  }
}

export default router
