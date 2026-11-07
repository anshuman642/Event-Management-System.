import 'dotenv/config'
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import authRoutes from './routes/auth.js'
import eventRoutes from './routes/events.js'
import registrationRoutes from './routes/registrations.js'
import userRoutes from './routes/users.js'
import notificationRoutes from './routes/notifications.js'
import { releaseExpiredPaymentReservations } from './routes/registrations.js'
import { errorHandler, notFound } from './middleware/errors.js'

const required = ['MONGO_URI', 'JWT_SECRET']
const missing = required.filter((name) => !process.env[name])
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`)
  process.exit(1)
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters long.')
  process.exit(1)
}

const app = express()
app.disable('x-powered-by')
app.use(helmet())
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }))

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
app.use('/api/auth', authRoutes)
app.use('/api/events', eventRoutes)
app.use('/api/registrations', registrationRoutes)
app.use('/api/users', userRoutes)
app.use('/api/notifications', notificationRoutes)
app.use(notFound)
app.use(errorHandler)

const port = Number(process.env.PORT || 5000)
try {
  await mongoose.connect(process.env.MONGO_URI)
  const reservationCleanup = setInterval(() => {
    releaseExpiredPaymentReservations().catch((error) => console.error('Could not release expired payment reservations:', error))
  }, 60 * 1000)
  reservationCleanup.unref()
  app.listen(port, () => console.log(`EventEase API listening on port ${port}`))
} catch (error) {
  console.error('Could not connect to MongoDB:', error.message)
  process.exit(1)
}
