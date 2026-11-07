import mongoose from 'mongoose'
import Event from '../models/Event.js'

export function getBookingSlots(event) {
  if (event.slots?.length) {
    return event.slots.map((slot) => ({
      _id: slot._id.toString(),
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      venue: slot.venue,
      city: slot.city,
      capacity: slot.capacity,
      registeredCount: slot.registeredCount,
    }))
  }
  return [{
    _id: 'default',
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    venue: event.venue,
    city: event.city,
    capacity: event.capacity,
    registeredCount: event.registeredCount || 0,
  }]
}

export async function reserveBookingSlot(eventId, slotId, now = new Date()) {
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  if (slotId === 'default') {
    const event = await Event.findOneAndUpdate(
      { _id: eventId, $or: [{ slots: { $size: 0 } }, { slots: { $exists: false } }], status: 'published', approvalStatus: 'approved', date: { $gte: startOfToday }, $expr: { $lt: ['$registeredCount', '$capacity'] } },
      { $inc: { registeredCount: 1 } },
      { new: true },
    )
    return event ? { event, slot: getBookingSlots(event)[0] } : null
  }
  if (!mongoose.isValidObjectId(slotId)) return null

  const slotObjectId = new mongoose.Types.ObjectId(slotId)
  const matchingAvailableFutureSlot = {
    $filter: {
      input: '$slots',
      as: 'slot',
      cond: {
        $and: [
          { $eq: ['$$slot._id', slotObjectId] },
          { $lt: ['$$slot.registeredCount', '$$slot.capacity'] },
          { $gte: ['$$slot.date', startOfToday] },
        ],
      },
    },
  }
  const event = await Event.findOneAndUpdate(
    {
      _id: eventId,
      status: 'published',
      approvalStatus: 'approved',
      'slots._id': slotObjectId,
      $expr: { $gt: [{ $size: matchingAvailableFutureSlot }, 0] },
    },
    { $inc: { registeredCount: 1, 'slots.$.registeredCount': 1 } },
    { new: true },
  )
  if (!event) return null
  const slot = getBookingSlots(event).find((item) => item._id === slotId)
  return slot ? { event, slot } : null
}

export async function releaseBookingSlot(eventId, slotId = 'default') {
  const filter = { _id: eventId, registeredCount: { $gt: 0 } }
  const increments = { registeredCount: -1 }
  if (slotId !== 'default' && mongoose.isValidObjectId(slotId)) {
    filter.slots = { $elemMatch: { _id: new mongoose.Types.ObjectId(slotId), registeredCount: { $gt: 0 } } }
    increments['slots.$.registeredCount'] = -1
  }
  return Event.updateOne(filter, { $inc: increments })
}
