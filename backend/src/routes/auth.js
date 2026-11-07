import { Router } from 'express'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import User from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendEmail } from '../utils/email.js'

const router = Router()
const registrationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  role: z.enum(['attendee', 'organizer']).optional(),
})
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) })
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
})

router.post('/register', asyncHandler(async (req, res) => {
  const parsed = registrationSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message })
  const { name, email, password, role = 'attendee' } = parsed.data
  if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ message: 'An account with this email already exists.' })
  const user = await User.create({ name, email, password, role })
  try {
    const delivered = await sendEmail({
      to: user.email,
      subject: 'Welcome to EventEase',
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h1>Welcome, ${escapeHtml(user.name)}!</h1><p>Your next good plan starts here. Explore events and find your people.</p></div>`,
    })
    if (!delivered) console.warn('Welcome email was not sent because email is not configured.')
  } catch (error) {
    console.error('Welcome email could not be delivered:', error)
  }
  return res.status(201).json({ user })
}))

router.post('/login', asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Enter a valid email and password.' })
  const user = await User.findOne({ email: parsed.data.email.toLowerCase() }).select('+password')
  if (!user || !(await user.comparePassword(parsed.data.password))) return res.status(401).json({ message: 'Email or password is incorrect.' })
  if (user.isBlocked) return res.status(403).json({ message: 'This account has been blocked. Contact support for help.' })
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' })
  res.cookie('eventease_token', token, cookieOptions())
  return res.json({ user })
}))

router.post('/logout', (_req, res) => {
  res.clearCookie('eventease_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' })
  res.json({ message: 'You have been logged out.' })
})

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }))

router.post('/forgot-password', asyncHandler(async (req, res) => {
  const email = z.string().email().safeParse(req.body.email)
  if (!email.success) return res.status(400).json({ message: 'Enter a valid email address.' })
  const user = await User.findOne({ email: email.data.toLowerCase() })
  if (user) {
    const token = crypto.randomBytes(32).toString('hex')
    user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex')
    user.resetPasswordExpires = Date.now() + 30 * 60 * 1000
    await user.save()
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`
    try {
      const delivered = await sendEmail({
        to: user.email,
        subject: 'Reset your EventEase password',
        html: `<div style="font-family:Arial,sans-serif"><p>Use this link within 30 minutes to reset your password:</p><a href="${resetUrl}">Reset password</a></div>`,
      })
      if (!delivered) console.warn('Password reset requested but email delivery is not configured.')
    } catch (error) {
      console.error('Password reset email could not be delivered:', error)
    }
  }
  res.json({ message: 'If that email is registered, a password reset link will be sent.' })
}))

router.post('/reset-password', asyncHandler(async (req, res) => {
  const parsed = z.object({ token: z.string().min(1), password: z.string().min(8).max(128) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Provide a valid reset token and a password of at least 8 characters.' })
  const hashed = crypto.createHash('sha256').update(parsed.data.token).digest('hex')
  const user = await User.findOne({ resetPasswordToken: hashed, resetPasswordExpires: { $gt: Date.now() } }).select('+resetPasswordToken +resetPasswordExpires')
  if (!user) return res.status(400).json({ message: 'This password reset link is invalid or has expired.' })
  user.password = parsed.data.password
  user.resetPasswordToken = undefined
  user.resetPasswordExpires = undefined
  await user.save()
  res.json({ message: 'Your password has been updated. You can now log in.' })
}))

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
}

export default router
