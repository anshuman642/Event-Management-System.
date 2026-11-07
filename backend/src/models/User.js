import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  password: { type: String, required: true, minlength: 8, select: false },
  role: { type: String, enum: ['attendee', 'organizer', 'admin'], default: 'attendee' },
  profileImage: { type: String, default: '' },
  bio: { type: String, maxlength: 500, default: '' },
  location: { type: String, maxlength: 100, default: '' },
  isVerified: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false },
  resetPasswordToken: { type: String, select: false },
  resetPasswordExpires: { type: Date, select: false },
}, { timestamps: true })

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return
  this.password = await bcrypt.hash(this.password, 12)
})

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.password)
}

userSchema.set('toJSON', {
  transform(_document, value) {
    delete value.password
    delete value.resetPasswordToken
    delete value.resetPasswordExpires
    delete value.__v
    return value
  },
})

export default mongoose.model('User', userSchema)
