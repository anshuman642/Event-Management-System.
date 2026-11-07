import test from 'node:test'
import assert from 'node:assert/strict'
import Event from '../src/models/Event.js'
import Registration from '../src/models/Registration.js'
import User from '../src/models/User.js'

test('new events require valid capacity and default to admin review', async () => {
  const event = new Event({
    title: 'A good gathering',
    description: 'A detailed description long enough to pass validation.',
    category: 'Community',
    date: new Date('2027-01-15'),
    startTime: '18:00',
    venue: 'The Hall',
    city: 'Brooklyn',
    capacity: 25,
    organizer: '507f1f77bcf86cd799439011',
  })

  assert.equal(event.status, 'pending')
  assert.equal(event.approvalStatus, 'pending')
  assert.equal(event.registeredCount, 0)
  await event.validate()

  event.capacity = 0
  await assert.rejects(event.validate(), (error) => {
    assert.equal(error.errors.capacity.kind, 'min')
    return true
  })
})

test('registration records require unique ticket identifiers', async () => {
  const registration = new Registration({
    user: '507f1f77bcf86cd799439011',
    event: '507f1f77bcf86cd799439012',
    registrationId: 'EE-123456',
    ticketId: 'ticket-token',
  })

  assert.equal(registration.status, 'registered')
  assert.equal(registration.paymentStatus, 'not_required')
  assert.equal(registration.slotId, 'default')
  assert.equal(registration.bookingSlot.startTime, '')
  assert.equal(registration.checkedIn, false)
  await registration.validate()
  const indexes = Registration.schema.indexes()
  assert.deepEqual(indexes.find(([keys]) => keys.user && keys.event), [{ user: 1, event: 1 }, { unique: true }])
  assert.ok(indexes.some(([keys, options]) => keys.registrationId === 1 && options.unique))
  assert.ok(indexes.some(([keys, options]) => keys.ticketId === 1 && options.unique))
})

test('registration records retain attendee booking contact details', async () => {
  const registration = new Registration({
    user: '507f1f77bcf86cd799439011',
    event: '507f1f77bcf86cd799439012',
    registrationId: 'EE-ATTENDEE',
    ticketId: 'attendee-ticket',
    attendeeDetails: {
      name: 'Jordan Example',
      email: 'JORDAN@example.com',
      phone: '+1 555 010 2020',
      city: 'Brooklyn',
      note: 'Vegetarian meal, please.',
    },
  })

  await registration.validate()
  assert.deepEqual(registration.attendeeDetails.toObject(), {
    name: 'Jordan Example',
    email: 'jordan@example.com',
    phone: '+1 555 010 2020',
    city: 'Brooklyn',
    note: 'Vegetarian meal, please.',
  })
})

test('event booking slots validate independent capacities and locations', async () => {
  const event = new Event({
    title: 'Choose your session',
    description: 'Attendees can choose a date and location for this event.',
    category: 'Community',
    date: new Date('2027-01-15'),
    startTime: '10:00',
    venue: 'North Hall',
    city: 'Brooklyn',
    capacity: 12,
    organizer: '507f1f77bcf86cd799439011',
    slots: [
      { date: new Date('2027-01-15'), startTime: '10:00', venue: 'North Hall', city: 'Brooklyn', capacity: 7 },
      { date: new Date('2027-01-20'), startTime: '14:00', venue: 'Online', city: 'Online', capacity: 5 },
    ],
  })

  await event.validate()
  assert.equal(event.slots.length, 2)
  assert.equal(event.slots[0].registeredCount, 0)
  event.slots[0].capacity = 0
  await assert.rejects(event.validate(), (error) => {
    assert.equal(error.errors['slots.0.capacity'].kind, 'min')
    return true
  })
})

test('user serialization never exposes password reset or password fields', () => {
  const user = new User({
    name: 'Test User',
    email: 'test@example.com',
    password: 'a-strong-password',
    resetPasswordToken: 'secret-reset-token',
    resetPasswordExpires: new Date(),
  })
  const serialized = user.toJSON()

  assert.equal(serialized.password, undefined)
  assert.equal(serialized.resetPasswordToken, undefined)
  assert.equal(serialized.resetPasswordExpires, undefined)
  assert.equal(serialized.role, 'attendee')
})
