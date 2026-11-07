import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, maxlength: 120 },
  message: { type: String, required: true, maxlength: 1000 },
  type: { type: String, enum: ['registration', 'approval', 'rejection', 'cancellation', 'reminder', 'update', 'system'], default: 'system' },
  isRead: { type: Boolean, default: false },
}, { timestamps: true })

export default mongoose.model('Notification', notificationSchema)
