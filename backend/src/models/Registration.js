import mongoose from 'mongoose'

const registrationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  slotId: { type: String, default: 'default' },
  bookingSlot: {
    date: { type: Date, default: null },
    startTime: { type: String, default: '' },
    endTime: { type: String, default: '' },
    venue: { type: String, default: '' },
    city: { type: String, default: '' },
  },
  attendeeDetails: {
    name: { type: String, trim: true, maxlength: 80, default: '' },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
    phone: { type: String, trim: true, maxlength: 30, default: '' },
    city: { type: String, trim: true, maxlength: 100, default: '' },
    note: { type: String, trim: true, maxlength: 500, default: '' },
  },
  registrationId: { type: String, required: true, unique: true },
  ticketId: { type: String, required: true, unique: true },
  qrCode: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'registered', 'cancelled'], default: 'registered', index: true },
  paymentStatus: { type: String, enum: ['not_required', 'pending', 'paid', 'failed', 'refunded'], default: 'not_required' },
  paymentOrderId: { type: String, default: '', select: false },
  paymentId: { type: String, default: '' },
  paymentAmount: { type: Number, default: 0 },
  paymentExpiresAt: { type: Date, default: null, index: true },
  checkedIn: { type: Boolean, default: false },
  registeredAt: { type: Date, default: Date.now },
}, { timestamps: true })

registrationSchema.index({ user: 1, event: 1 }, { unique: true })

export default mongoose.model('Registration', registrationSchema)
