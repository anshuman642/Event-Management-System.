import mongoose from 'mongoose'

const bookingSlotSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, default: '' },
  venue: { type: String, required: true, trim: true, maxlength: 200 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  capacity: { type: Number, required: true, min: 1, max: 100000 },
  registeredCount: { type: Number, default: 0, min: 0 },
})

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
  description: { type: String, required: true, minlength: 20, maxlength: 10000 },
  category: { type: String, required: true, trim: true, maxlength: 60 },
  banner: { type: String, default: '' },
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, default: '' },
  venue: { type: String, required: true, trim: true, maxlength: 200 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  eventType: { type: String, enum: ['Online', 'Offline', 'Hybrid'], default: 'Offline' },
  capacity: { type: Number, required: true, min: 1, max: 100000 },
  registeredCount: { type: Number, default: 0, min: 0 },
  registrationFee: { type: Number, default: 0, min: 0 },
  slots: { type: [bookingSlotSchema], default: [] },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['draft', 'pending', 'published', 'cancelled'], default: 'pending', index: true },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  rejectionReason: { type: String, default: '' },
}, { timestamps: true })

eventSchema.index({ title: 'text', city: 'text', venue: 'text', description: 'text' })
eventSchema.index({ date: 1, status: 1, approvalStatus: 1 })

export default mongoose.model('Event', eventSchema)
