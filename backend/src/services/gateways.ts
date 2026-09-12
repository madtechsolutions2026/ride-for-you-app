import crypto from 'crypto';

/**
 * Gateway order creation.
 *
 * The webhook half of payments was already built — signatures verified,
 * settlement keyed on the provider's payment id so retries are no-ops. The
 * outbound half returned 501 "not implemented", which is what kept
 * PAYMENTS_MODE stuck on `stub`.
 *
 * This is that half. Nothing here needs credentials to be *correct* — the
 * request shapes, amount units and signature construction are fixed by each
 * provider's spec — so it is written and tested now, against a fake provider,
 * and starts working the moment real keys land in the environment.
 *
 * Two things that bite everyone, handled here once:
 *   - Both providers take amounts in PAISE. Our whole codebase stores rupees.
 *     The conversion happens here and nowhere else.
 *   - Our own order id has to survive the round trip so the webhook can find
 *     the Payment row. Razorpay carries it in `notes`, PhonePe in
 *     `merchantTransactionId`.
 */

export type Provider = 'PHONEPE' | 'RAZORPAY';

export interface OrderRequest {
  /** Our correlation id — comes back on the webhook. */
  orderId: string;
  /** Rupees. Converted to paise on the way out. */
  amount: number;
  userId: string;
  phone?: string | null;
  /** Human label, shown on the gateway's own sheet where supported. */
  label: string;
}

export interface OrderResult {
  provider: Provider;
  /** The gateway's id for this order. */
  gatewayOrderId: string;
  /** Everything the app needs to open the payment sheet. */
  checkout: Record<string, unknown>;
}

export class GatewayError extends Error {
  constructor(
    message: string,
    readonly provider: Provider,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

const RAZORPAY_ORDERS_URL = 'https://api.razorpay.com/v1/orders';
const PHONEPE_PAY_PATH = '/pg/v1/pay';

const phonePeBase = () =>
  process.env.PHONEPE_BASE_URL || 'https://api.phonepe.com/apis/hermes';

/** Rupees -> paise. Both gateways reject fractional paise, so round. */
export const toPaise = (rupees: number): number => Math.round(rupees * 100);

/**
 * The HTTP call, injectable so tests can drive every branch without a network
 * or credentials. Production passes nothing and gets global fetch.
 */
export type Fetcher = typeof fetch;

export async function createGatewayOrder(
  provider: Provider,
  req: OrderRequest,
  fetcher: Fetcher = fetch,
): Promise<OrderResult> {
  if (req.amount <= 0) {
    throw new GatewayError('Order amount must be positive', provider);
  }

  return provider === 'RAZORPAY'
    ? createRazorpayOrder(req, fetcher)
    : createPhonePeOrder(req, fetcher);
}

/* -------------------------------------------------------------------------- */
/* Razorpay                                                                    */
/* -------------------------------------------------------------------------- */

async function createRazorpayOrder(req: OrderRequest, fetcher: Fetcher): Promise<OrderResult> {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';

  if (!keyId || !keySecret) {
    throw new GatewayError('Razorpay credentials are not configured', 'RAZORPAY');
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const res = await fetcher(RAZORPAY_ORDERS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: toPaise(req.amount),
      currency: 'INR',
      // Razorpay's own idempotency handle: the same receipt will not create a
      // second order, which matters when the app retries a flaky intent call.
      receipt: req.orderId,
      // parseEvent() reads notes.rfyOrderId off the webhook, so this is the
      // link back to our Payment row. Do not rename it without changing that.
      notes: { rfyOrderId: req.orderId, label: req.label },
    }),
  });

  const json: any = await res.json().catch(() => ({}));

  if (!res.ok || !json?.id) {
    throw new GatewayError(
      json?.error?.description || `Razorpay rejected the order (${res.status})`,
      'RAZORPAY',
      res.status,
    );
  }

  return {
    provider: 'RAZORPAY',
    gatewayOrderId: String(json.id),
    checkout: {
      // The publishable key only. The secret never leaves the server.
      key: keyId,
      orderId: json.id,
      amount: json.amount,
      currency: json.currency ?? 'INR',
      name: 'Ride For You',
      description: req.label,
      prefill: req.phone ? { contact: req.phone } : undefined,
      notes: { rfyOrderId: req.orderId },
    },
  };
}

/* -------------------------------------------------------------------------- */
/* PhonePe                                                                     */
/* -------------------------------------------------------------------------- */

async function createPhonePeOrder(req: OrderRequest, fetcher: Fetcher): Promise<OrderResult> {
  const merchantId = process.env.PHONEPE_MERCHANT_ID || '';
  const saltKey = process.env.PHONEPE_SALT_KEY || '';
  const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';

  if (!merchantId || !saltKey) {
    throw new GatewayError('PhonePe credentials are not configured', 'PHONEPE');
  }

  const payload = {
    merchantId,
    // Comes back as `merchantTransactionId` on the callback, which is what
    // parseEvent() uses as the order id.
    merchantTransactionId: req.orderId,
    merchantUserId: req.userId,
    amount: toPaise(req.amount),
    redirectUrl: `${process.env.PUBLIC_BASE_URL || ''}/payments/return/${req.orderId}`,
    redirectMode: 'POST',
    callbackUrl: `${process.env.PUBLIC_BASE_URL || ''}/payments/webhook/phonepe`,
    ...(req.phone ? { mobileNumber: req.phone.replace(/^\+91/, '') } : {}),
    paymentInstrument: { type: 'PAY_PAGE' },
  };

  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');

  // PhonePe signs base64(payload) + the endpoint path + the salt.
  const checksum = `${crypto
    .createHash('sha256')
    .update(base64Payload + PHONEPE_PAY_PATH + saltKey)
    .digest('hex')}###${saltIndex}`;

  const res = await fetcher(`${phonePeBase()}${PHONEPE_PAY_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/json',
      'X-VERIFY': checksum,
    },
    body: JSON.stringify({ request: base64Payload }),
  });

  const json: any = await res.json().catch(() => ({}));
  const redirect = json?.data?.instrumentResponse?.redirectInfo?.url;

  if (!res.ok || json?.success !== true || !redirect) {
    throw new GatewayError(
      json?.message || `PhonePe rejected the order (${res.status})`,
      'PHONEPE',
      res.status,
    );
  }

  return {
    provider: 'PHONEPE',
    gatewayOrderId: String(json?.data?.merchantTransactionId ?? req.orderId),
    checkout: {
      // PhonePe is a hosted page — the app opens this URL in a web view.
      redirectUrl: redirect,
      merchantTransactionId: req.orderId,
      amount: toPaise(req.amount),
    },
  };
}
