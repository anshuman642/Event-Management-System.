import test from 'node:test'
import assert from 'node:assert/strict'
import Event from '../src/models/Event.js'
import { getBookingSlots } from '../src/utils/eventSlots.js'

test('booking options keep their own date, venue, and remaining capacity', () => {
  const event = new Event({
    title: 'Choose a session',
    description: 'Choose which date and place works best for you.',
    category: 'Community',
    date: new Date('2027-05-01'),
    startTime: '10:00',
    venue: 'Main Hall',
    city: 'Delhi',
    capacity: 8,
    registeredCount: 3,
    organizer: '507f1f77bcf86cd799439011',
    slots: [
      { date: new Date('2027-05-01'), startTime: '10:00', venue: 'Main Hall', city: 'Delhi', capacity: 5, registeredCount: 2 },
      { date: new Date('2027-05-02'), startTime: '14:00', venue: 'Online', city: 'Online', capacity: 3, registeredCount: 1 },
    ],
  })
  const slots = getBookingSlots(event)

  assert.equal(slots.length, 2)
  assert.equal(slots[0].venue, 'Main Hall')
  assert.equal(slots[0].capacity - slots[0].registeredCount, 3)
  assert.equal(slots[1].city, 'Online')
})

test('legacy events without slots remain bookable as one default option', () => {
  const event = new Event({
    title: 'Single date gathering',
    description: 'Older events remain available as one date and place.',
    category: 'Community',
    date: new Date('2027-05-01'),
    startTime: '10:00',
    venue: 'Main Hall',
    city: 'Delhi',
    capacity: 8,
    registeredCount: 3,
    organizer: '507f1f77bcf86cd799439011',
  })
  const [slot] = getBookingSlots(event)

  assert.equal(slot._id, 'default')
  assert.equal(slot.venue, 'Main Hall')
  assert.equal(slot.registeredCount, 3)
})
