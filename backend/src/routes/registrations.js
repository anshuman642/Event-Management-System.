import { Router } from 'express'
import crypto from 'node:crypto'
import QRCode from 'qrcode'
import Registration from '../models/Registration.js'
import Event from '../models/Event.js'
import SavedEvent from '../models/SavedEvent.js'
import { allowRoles, requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { notify } from '../utils/notifications.js'
import { sendEmail } from '../utils/email.js'
import { getBookingSlots, releaseBookingSlot, reserveBookingSlot } from '../utils/eventSlots.js'
import { z } from 'zod'
import {
  captureRazorpayPayment,
  createRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpayKeyId,
  toMinorUnits,
  verifyCheckoutSignature,
} from '../utils/razorpay.js'

const router = Router()
router.use(requireAuth)

const attendeeDetailsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(7).max(30),
  city: z.string().trim().min(1).max(100),
  note: z.string().trim().max(500).optional().default(''),
})

export async function releaseExpiredPaymentReservations(now = new Date()) {
  const expired = await Registration.find({ status: 'pending', paymentExpiresAt: { $lte: now } }).select('_id event slotId')
  let released = 0
  for (const item of expired) {
    const registration = await Registration.findOneAndUpdate(
      { _id: item._id, status: 'pending', paymentExpiresAt: { $lte: now } },
      { $set: { status: 'cancelled', paymentStatus: 'failed' } },
    )
    if (!registration) continue
    await releaseBookingSlot(item.event, item.slotId)
    released += 1
  }
  return released
}

router.post('/', allowRoles('attendee'), asyncHandler(async (req, res) => {
  const parsedDetails = attendeeDetailsSchema.safeParse(req.body.attendeeDetails)
  if (!parsedDetails.success) return res.status(400).json({ message: 'Enter a valid name, email, phone number, and city before booking.' })
  const { eventId, slotId = 'default' } = req.body
  if (typeof eventId !== 'string' || !/^[a-f\d]{24}$/i.test(eventId)) return res.status(400).json({ message: 'Provide a valid event.' })
  if (typeof slotId !== 'string' || !slotId || slotId.length > 64) return res.status(400).json({ message: 'Choose a valid booking date and location.' })
  const requestedEvent = await Event.findOne({ _id: eventId, status: 'published', approvalStatus: 'approved' })
  if (requestedEvent?.registrationFee > 0) return res.status(400).json({ message: 'Paid events must use the secure checkout flow.' })
  const existing = await Registration.findOne({ user: req.user._id, event: eventId })
  if (existing && existing.status !== 'cancelled') return res.status(409).json({ message: 'You already have an active registration for this event.' })
  if (!requestedEvent) return res.status(404).json({ message: 'That event is not available.' })
  const selectedSlot = getBookingSlots(requestedEvent).find((slot) => slot._id === slotId)
  if (!selectedSlot) return res.status(404).json({ message: 'That booking date and location are no longer available.' })
  const reservation = await reserveBookingSlot(eventId, slotId)
  if (!reservation) return res.status(409).json({ message: 'That booking slot is full, has ended, or is no longer available.' })
  const { event, slot } = reservation
  const registrationId = `EE-${crypto.randomBytes(12).toString('hex').toUpperCase()}`
  const ticketId = crypto.randomUUID()
  let registration
  try {
    const qrCode = await QRCode.toDataURL(ticketId, { width: 240, margin: 1 })
    if (existing) {
      registration = await Registration.findOneAndUpdate(
        { _id: existing._id, status: 'cancelled' },
        { $set: { registrationId, ticketId, status: 'registered', paymentStatus: 'not_required', paymentAmount: 0, paymentOrderId: '', paymentId: '', paymentExpiresAt: null, checkedIn: false, qrCode, slotId, bookingSlot: slotSnapshot(slot), attendeeDetails: parsedDetails.data, registeredAt: new Date() } },
        { new: true, runValidators: true },
      )
      if (!registration) {
        await releaseBookingSlot(event._id, slotId)
        return res.status(409).json({ message: 'Your registration changed while booking. Please try again.' })
      }
    } else {
      registration = await Registration.create({
        user: req.user._id, event: event._id, registrationId,
        ticketId, paymentStatus: 'not_required', qrCode, slotId, bookingSlot: slotSnapshot(slot), attendeeDetails: parsedDetails.data,
      })
    }
  } catch (error) {
    await releaseBookingSlot(event._id, slotId)
    if (error.code === 11000) return res.status(409).json({ message: 'You are already registered for this event.' })
    throw error
  }
  await notify(req.user._id, 'You’re registered!', `Your spot for ${event.title} is confirmed. Your ticket ID is ${registrationId}.`, 'registration')
  try {
    const delivered = await sendEmail({
      to: parsedDetails.data.email,
      subject: `Your ticket for ${event.title}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h1>You’re on the list, ${escapeHtml(parsedDetails.data.name)}!</h1><p><strong>${escapeHtml(event.title)}</strong></p><p>${slot.date.toLocaleDateString()} · ${escapeHtml(slot.startTime)} · ${escapeHtml(slot.venue)}, ${escapeHtml(slot.city)}</p><p>Ticket ID: <strong>${registrationId}</strong></p></div>`,
    })
    if (!delivered) console.warn('Registration confirmation email was not sent because email is not configured.')
  } catch (error) {
    console.error('Registration confirmation email could not be delivered:', error)
  }
  await registration.populate('event')
  res.status(201).json({ registration })
}))

router.post('/payment/order', allowRoles('attendee'), asyncHandler(async (req, res) => {
  const parsedDetails = attendeeDetailsSchema.safeParse(req.body.attendeeDetails)
  if (!parsedDetails.success) return res.status(400).json({ message: 'Enter a valid name, email, phone number, and city before booking.' })
  const { eventId, slotId = 'default' } = req.body
  if (typeof eventId !== 'string' || !/^[a-f\d]{24}$/i.test(eventId)) return res.status(400).json({ message: 'Provide a valid event.' })
  if (typeof slotId !== 'string' || !slotId || slotId.length > 64) return res.status(400).json({ message: 'Choose a valid booking date and location.' })
  const event = await Event.findOne({ _id: eventId, status: 'published', approvalStatus: 'approved' })
  if (!event) return res.status(404).json({ message: 'That event is not available.' })
  if (!event.registrationFee) return res.status(400).json({ message: 'This event does not require payment.' })
  const slot = getBookingSlots(event).find((item) => item._id === slotId)
  if (!slot) return res.status(404).json({ message: 'That booking date and location are no longer available.' })
  const existing = await Registration.findOne({ user: req.user._id, event: event._id }).select('+paymentOrderId')
  if (existing && existing.status !== 'cancelled') return res.status(409).json({ message: 'You already have an active registration for this event.' })

  const amount = toMinorUnits(event.registrationFee)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)
  const reservation = await reserveBookingSlot(event._id, slotId)
  if (!reservation) return res.status(409).json({ message: 'That booking slot is full, has ended, or is no longer available.' })
  const reservedSlot = reservation.slot

  const registrationId = `EE-${crypto.randomBytes(12).toString('hex').toUpperCase()}`
  const ticketId = crypto.randomUUID()
  let registration
  try {
    if (existing) {
      registration = await Registration.findOneAndUpdate(
        { _id: existing._id, status: 'cancelled' },
        { $set: { registrationId, ticketId, status: 'pending', paymentStatus: 'pending', paymentAmount: amount, paymentOrderId: '', paymentId: '', paymentExpiresAt: expiresAt, checkedIn: false, qrCode: '', slotId, bookingSlot: slotSnapshot(reservedSlot), attendeeDetails: parsedDetails.data, registeredAt: new Date() } },
        { new: true, runValidators: true },
      )
      if (!registration) {
        await releaseBookingSlot(event._id, slotId)
        return res.status(409).json({ message: 'Your registration changed while booking. Please try again.' })
      }
    } else {
      registration = await Registration.create({
        user: req.user._id,
        event: event._id,
        registrationId,
        ticketId,
        status: 'pending',
        paymentStatus: 'pending',
        paymentAmount: amount,
        paymentExpiresAt: expiresAt,
        slotId,
        bookingSlot: slotSnapshot(reservedSlot),
        attendeeDetails: parsedDetails.data,
      })
    }
    const order = await createRazorpayOrder({
      amount,
      receipt: registrationId,
      notes: { registrationId: registration.id, eventId: event.id },
    })
    registration.paymentOrderId = order.id
    await registration.save()
    return res.status(201).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: getRazorpayKeyId(),
      registrationId: registration.id,
      expiresAt,
    })
  } catch (error) {
    if (registration) {
      registration.status = 'cancelled'
      registration.paymentStatus = 'failed'
      registration.paymentOrderId = ''
      await registration.save()
    }
    await releaseBookingSlot(event._id, slotId)
    throw error
  }
}))

router.post('/payment/verify', allowRoles('attendee'), asyncHandler(async (req, res) => {
  const parsed = z.object({
    registrationId: z.string().regex(/^[a-f\d]{24}$/i),
    razorpay_order_id: z.string().min(1).max(64),
    razorpay_payment_id: z.string().min(1).max(64),
    razorpay_signature: z.string().regex(/^[a-f\d]{64}$/i),
  }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Payment verification details are invalid.' })

  const { registrationId, razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = parsed.data
  const registration = await Registration.findOne({ _id: registrationId, user: req.user._id }).select('+paymentOrderId')
  if (!registration) return res.status(404).json({ message: 'Registration not found.' })
  if (registration.status === 'registered' && registration.paymentId === paymentId) return res.json({ registration })
  if (registration.status !== 'pending' || registration.paymentOrderId !== orderId || registration.paymentExpiresAt <= new Date()) {
    return res.status(409).json({ message: 'This payment session has expired. Start checkout again.' })
  }
  if (!verifyCheckoutSignature(orderId, paymentId, signature)) return res.status(400).json({ message: 'Payment signature could not be verified.' })

  const expectedAmount = registration.paymentAmount
  let payment = await fetchRazorpayPayment(paymentId)
  if (payment.order_id !== orderId || payment.amount !== expectedAmount || payment.currency !== 'INR') {
    return res.status(400).json({ message: 'The payment details do not match this event.' })
  }
  if (payment.status === 'authorized') {
    payment = await captureRazorpayPayment(paymentId, expectedAmount)
  }
  if (payment.status !== 'captured') return res.status(409).json({ message: 'Payment is not captured yet. Please try verifying again.' })

  const updated = await Registration.findOneAndUpdate(
    { _id: registration._id, user: req.user._id, status: 'pending', paymentExpiresAt: { $gt: new Date() } },
    { $set: { status: 'registered', paymentStatus: 'paid', paymentId, qrCode: await QRCode.toDataURL(registration.ticketId, { width: 240, margin: 1 }) } },
    { new: true },
  ).populate('event')
  if (!updated) {
    return res.status(409).json({ message: 'The reserved spot expired before confirmation. Contact support with payment ID ' + paymentId + '.' })
  }
  await notify(req.user._id, 'You’re registered!', `Your payment is confirmed and your spot for ${updated.event.title} is saved.`, 'registration')
  try {
    const delivered = await sendEmail({
      to: updated.attendeeDetails.email,
      subject: `Your ticket for ${updated.event.title}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h1>You’re on the list, ${escapeHtml(updated.attendeeDetails.name)}!</h1><p><strong>${escapeHtml(updated.event.title)}</strong></p><p>${updated.bookingSlot.date.toLocaleDateString()} · ${escapeHtml(updated.bookingSlot.startTime)} · ${escapeHtml(updated.bookingSlot.venue)}, ${escapeHtml(updated.bookingSlot.city)}</p><p>Ticket ID: <strong>${registration.registrationId}</strong></p></div>`,
    })
    if (!delivered) console.warn('Paid registration confirmation email was not sent because email is not configured.')
  } catch (error) {
    console.error('Paid registration confirmation email could not be delivered:', error)
  }
  res.json({ registration: updated })
}))

router.post('/payment/cancel', allowRoles('attendee'), asyncHandler(async (req, res) => {
  const parsed = z.object({ registrationId: z.string().regex(/^[a-f\d]{24}$/i) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Provide a valid registration.' })
  const registration = await Registration.findOneAndUpdate(
    { _id: parsed.data.registrationId, user: req.user._id, status: 'pending' },
    { $set: { status: 'cancelled', paymentStatus: 'failed' } },
    { new: true },
  )
  if (registration) await releaseBookingSlot(registration.event, registration.slotId)
  res.json({ message: 'Payment reservation released.' })
}))

router.get('/my', asyncHandler(async (req, res) => {
  const registrations = await Registration.find({ user: req.user._id }).sort({ registeredAt: -1 }).populate({ path: 'event', populate: { path: 'organizer', select: 'name' } })
  res.json({ registrations })
}))

router.get('/admin', allowRoles('admin'), asyncHandler(async (req, res) => {
  const registrations = await Registration.find().sort({ registeredAt: -1 }).limit(200).populate('user', 'name email phone bio location profileImage role createdAt isBlocked').populate('event', 'title date organizer')
  res.json({ registrations })
}))

router.get('/saved', asyncHandler(async (req, res) => {
  const savedEvents = await SavedEvent.find({ user: req.user._id }).sort({ createdAt: -1 }).populate('event')
  res.json({ savedEvents })
}))

router.post('/saved/:eventId', allowRoles('attendee'), asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.eventId, status: 'published', approvalStatus: 'approved' })
  if (!event) return res.status(404).json({ message: 'Event not found.' })
  const savedEvent = await SavedEvent.findOneAndUpdate(
    { user: req.user._id, event: event._id },
    { $setOnInsert: { user: req.user._id, event: event._id } },
    { upsert: true, new: true },
  )
  res.status(201).json({ savedEvent })
}))

router.delete('/saved/:eventId', allowRoles('attendee'), asyncHandler(async (req, res) => {
  const result = await SavedEvent.deleteOne({ user: req.user._id, event: req.params.eventId })
  if (!result.deletedCount) return res.status(404).json({ message: 'Saved event not found.' })
  res.json({ message: 'Saved event removed.' })
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const registration = await Registration.findById(req.params.id).populate('user', 'name email').populate('event')
  if (!registration) return res.status(404).json({ message: 'Registration not found.' })
  const owns = registration.user._id.equals(req.user._id)
  const eventOwner = registration.event.organizer.equals(req.user._id)
  if (!owns && !eventOwner && req.user.role !== 'admin') return res.status(403).json({ message: 'You cannot view this ticket.' })
  res.json({ registration })
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  const registration = await Registration.findById(req.params.id).populate('event')
  if (!registration) return res.status(404).json({ message: 'Registration not found.' })
  if (!registration.user.equals(req.user._id) && req.user.role !== 'admin') return res.status(403).json({ message: 'You can only cancel your own registration.' })
  if (registration.status === 'cancelled') return res.status(409).json({ message: 'This registration has already been cancelled.' })
  if (registration.paymentStatus === 'paid') return res.status(409).json({ message: 'Paid ticket refunds are not automated yet. Contact the event organizer before cancelling.' })
  const cancelled = await Registration.findOneAndUpdate(
    { _id: registration._id, status: { $ne: 'cancelled' }, paymentStatus: { $ne: 'paid' } },
    { $set: { status: 'cancelled', paymentStatus: registration.paymentStatus === 'pending' ? 'failed' : registration.paymentStatus } },
    { new: true },
  )
  if (!cancelled) return res.status(409).json({ message: 'This registration has already been cancelled or paid.' })
  await releaseBookingSlot(registration.event._id, registration.slotId)
  await notify(req.user._id, 'Registration cancelled', `Your registration for ${registration.event.title} has been cancelled.`, 'cancellation')
  res.json({ message: 'Registration cancelled.' })
}))

router.patch('/:id/checkin', allowRoles('organizer', 'admin'), asyncHandler(async (req, res) => {
  const { registrationId } = req.body
  if (typeof registrationId !== 'string' || !registrationId.trim()) return res.status(400).json({ message: 'Provide a ticket registration ID.' })
  const ticketCode = registrationId.trim()
  const registration = await Registration.findOne({
    $or: [{ registrationId: ticketCode.toUpperCase() }, { ticketId: ticketCode }],
  }).populate('event')
  if (!registration) return res.status(404).json({ message: 'Ticket not found.' })
  if (req.user.role !== 'admin' && !registration.event.organizer.equals(req.user._id)) return res.status(403).json({ message: 'You cannot check in attendees for this event.' })
  if (registration.status !== 'registered') return res.status(409).json({ message: 'This registration is no longer active.' })
  if (registration.checkedIn) return res.status(409).json({ message: 'This ticket has already been checked in.' })
  registration.checkedIn = true
  await registration.save()
  res.json({ registration })
}))

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
}

function slotSnapshot(slot) {
  return {
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    venue: slot.venue,
    city: slot.city,
  }
}

export default router
