import crypto from 'crypto';
import Razorpay from 'razorpay';
import { config } from '../config/env.js';

export const isRazorpayConfigured = Boolean(
  config.razorpay.keyId &&
  config.razorpay.keySecret &&
  !config.razorpay.keyId.includes('your_key_id')
);

const razorpayInstance = isRazorpayConfigured
  ? new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    })
  : null;

export async function createGatewayOrder({ amountInInr, receiptNumber, notes = {} }) {
  const amountPaise = Math.round(Number(amountInInr) * 100);

  if (razorpayInstance) {
    const order = await razorpayInstance.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: receiptNumber,
      notes,
    });
    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: config.razorpay.keyId,
      mode: 'RAZORPAY',
    };
  }

  if (config.isProduction || !config.allowSandboxPayments) {
    const err = new Error('Razorpay payment gateway credentials are not configured for production.');
    err.statusCode = 503;
    throw err;
  }

  // Non-production local development sandbox mode ONLY
  const sandboxOrderId = `order_test_${crypto.randomBytes(6).toString('hex')}`;
  return {
    orderId: sandboxOrderId,
    amount: amountPaise,
    currency: 'INR',
    keyId: 'rzp_test_sandbox',
    mode: 'SANDBOX_TEST',
  };
}

export function verifyRazorpaySignature({ orderId, paymentId, signature, gatewayMode }) {
  if (gatewayMode === 'SANDBOX_TEST') {
    if (config.isProduction || !config.allowSandboxPayments || isRazorpayConfigured) {
      return false;
    }
    const expectedSandboxSig = createSandboxSignature({ orderId, paymentId });
    const a = Buffer.from(expectedSandboxSig);
    const b = Buffer.from(String(signature || ''));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  if (!config.razorpay.keySecret) return false;

  const expected = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createSandboxSignature({ orderId, paymentId }) {
  if (config.isProduction || !config.allowSandboxPayments) {
    throw new Error('Sandbox signature generation is disabled in production.');
  }
  return crypto
    .createHmac('sha256', config.jwt.accessSecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

export function verifyWebhookSignature(rawBody, receivedSignature) {
  if (!config.razorpay.webhookSecret || !receivedSignature) return false;
  const expected = crypto
    .createHmac('sha256', config.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(receivedSignature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
