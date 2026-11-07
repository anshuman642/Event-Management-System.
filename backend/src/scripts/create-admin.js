import 'dotenv/config'
import mongoose from 'mongoose'
import User from '../models/User.js'

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const name = process.env.ADMIN_NAME?.trim()
const password = process.env.ADMIN_PASSWORD

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || !password || password.length < 12) {
  console.error('Set a valid ADMIN_EMAIL, ADMIN_NAME, and an ADMIN_PASSWORD of at least 12 characters in backend/.env.')
  process.exit(1)
}

try {
  await mongoose.connect(process.env.MONGO_URI)
  const existing = await User.findOne({ email })
  if (existing) {
    if (existing.role !== 'admin') {
      throw new Error('That email already belongs to a non-admin account. Choose a separate admin email.')
    }
    console.log(`Admin account ${email} already exists; no changes made.`)
  } else {
    await User.create({ email, name, password, role: 'admin' })
    console.log(`Admin account ${email} created.`)
  }
} catch (error) {
  console.error('Could not provision admin account:', error.message)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
