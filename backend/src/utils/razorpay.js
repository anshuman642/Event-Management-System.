import crypto from 'node:crypto'

const apiBase = 'https://api.razorpay.com/v1'

function credentials() {
  const { RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: keySecret } = process.env
  if (!keyId || !keySecret) {
    const error = new Error('Razorpay checkout is not configured.')
    error.status = 503
    throw error
  }
  return { keyId, keySecret }
}

async function request(path, method, body) {
  const { keyId, keySecret } = credentials()
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const result = await response.json()
  if (!response.ok) {
    const error = new Error(result.error?.description || 'Razorpay could not process the payment request.')
    error.status = response.status >= 500 ? 502 : 400
    throw error
  }
  return result
}

export function getRazorpayKeyId() {
  return credentials().keyId
}

export function toMinorUnits(amount) {
  if (!Number.isFinite(amount) || amount <= 0) throw new RangeError('Payment amount must be positive.')
  return Math.round((amount + Number.EPSILON) * 100)
}

export function verifyCheckoutSignature(orderId, paymentId, signature, secret = process.env.RAZORPAY_KEY_SECRET) {
  if (![orderId, paymentId, signature, secret].every((value) => typeof value === 'string' && value.length > 0)) return false
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest()
  let actual
  try {
    actual = Buffer.from(signature, 'hex')
  } catch {
    return false
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

export function createRazorpayOrder({ amount, receipt, notes }) {
  return request('/orders', 'POST', { amount, currency: 'INR', receipt, notes })
}

export function fetchRazorpayPayment(paymentId) {
  return request(`/payments/${encodeURIComponent(paymentId)}`, 'GET')
}

export function captureRazorpayPayment(paymentId, amount) {
  return request(`/payments/${encodeURIComponent(paymentId)}/capture`, 'POST', { amount, currency: 'INR' })
}
