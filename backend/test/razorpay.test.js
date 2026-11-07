import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { toMinorUnits, verifyCheckoutSignature } from '../src/utils/razorpay.js'

test('Razorpay amounts are converted to paise without accepting invalid values', () => {
  assert.equal(toMinorUnits(125), 12500)
  assert.equal(toMinorUnits(19.99), 1999)
  assert.throws(() => toMinorUnits(0), RangeError)
  assert.throws(() => toMinorUnits(Number.NaN), RangeError)
})

test('Razorpay checkout signatures are validated with constant-time-sized comparisons', () => {
  const orderId = 'order_example'
  const paymentId = 'pay_example'
  const secret = 'test-secret'
  const signature = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
  const tamperedSignature = `${signature[0] === '0' ? '1' : '0'}${signature.slice(1)}`

  assert.equal(verifyCheckoutSignature(orderId, paymentId, signature, secret), true)
  assert.equal(verifyCheckoutSignature(orderId, paymentId, tamperedSignature, secret), false)
  assert.equal(verifyCheckoutSignature(orderId, paymentId, 'invalid', secret), false)
  assert.equal(verifyCheckoutSignature('', paymentId, signature, secret), false)
})
