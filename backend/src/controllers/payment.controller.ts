import crypto from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { notify } from '../utils/notifications';
import { sendPaymentReceiptWhatsApp } from '../utils/whatsapp';

/**
 * Payment gateway layer.
 *
 * Two halves:
 *   1. createIntent  — the app asks for an order; we record an INITIATED
 *      Payment and hand back whatever the gateway needs to open its sheet.
 *   2. handleWebhook — the gateway tells us what happened. This is the only
 *      thing that may move money-affecting state.
 *
 * IDEMPOTENCY is the whole point. Gateways retry webhooks — the same event
 * will arrive two, three, five times. Every settlement here keys off the
 * provider's own payment id, so a repeat is a no-op instead of a second
 * credit. `Payment.providerPaymentId` carries that key.
 *
 * No live credentials are wired yet. Set the env vars below and flip
 * PAYMENTS_MODE=live; until then everything runs in `stub` mode, which is the
 * behaviour the app already ships with.
 */

type Provider = 'PHONEPE' | 'RAZORPAY' | 'CASHFREE';

const MODE = (process.env.PAYMENTS_MODE || 'stub').toLowerCase(); // 'stub' | 'live'

const GATEWAY = {
  RAZORPAY: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  PHONEPE: {
    merchantId: process.env.PHONEPE_MERCHANT_ID || '',
    saltKey: process.env.PHONEPE_SALT_KEY || '',
    saltIndex: process.env.PHONEPE_SALT_INDEX || '1',
  },
};

export function isGatewayLive(provider: Provider): boolean {
  if (MODE !== 'live') return false;
  if (provider === 'RAZORPAY') return !!(GATEWAY.RAZORPAY.keyId && GATEWAY.RAZORPAY.keySecret);
  if (provider === 'PHONEPE') return !!(GATEWAY.PHONEPE.merchantId && GATEWAY.PHONEPE.saltKey);
  return false;
}

/* -------------------------------------------------------------------------- */
/* Signature verification                                                      */
/* -------------------------------------------------------------------------- */

/** Razorpay signs the raw body with the webhook secret (HMAC-SHA256 hex). */
function verifyRazorpay(rawBody: string, signature: string): boolean {
  const secret = GATEWAY.RAZORPAY.webhookSecret;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false; // length mismatch
  }
}

/** PhonePe signs base64(response) + endpoint with the salt (SHA256 ### index). */
function verifyPhonePe(base64Response: string, header: string): boolean {
  const { saltKey, saltIndex } = GATEWAY.PHONEPE;
  if (!saltKey || !header) return false;
  const digest = crypto.createHash('sha256').update(base64Response + saltKey).digest('hex');
  const expected = `${digest}###${saltIndex}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header));
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* POST /payments/intent                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Body: { bookingId? , invoiceId? , provider? }
 * Exactly one of bookingId / invoiceId. Returns the INITIATED payment and,
 * in live mode, the gateway order the app should open.
 */
export async function createIntent(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { bookingId, invoiceId } = req.body ?? {};
    const provider = (String(req.body?.provider || 'RAZORPAY').toUpperCase() as Provider);

    if (!!bookingId === !!invoiceId) {
      return res.status(400).json({ error: 'Pass exactly one of bookingId or invoiceId' });
    }

    let amount = 0;
    let purpose = 'RENT';
    let label = '';

    if (bookingId) {
      const booking = await prisma.booking.findFirst({ where: { id: bookingId, userId } });
      if (!booking) return res.status(404).json({ error: 'Booking not found' });
      if (booking.status !== 'PENDING')
        return res.status(409).json({ error: `Booking is ${booking.status}, nothing to pay` });
      amount = booking.totalAmount;
      purpose = 'RENT';
      label = `Booking ${booking.reference}`;
    } else {
      const inv = await prisma.weeklyInvoice.findUnique({
        where: { id: invoiceId },
        include: { rental: { select: { userId: true } } },
      });
      if (!inv || inv.rental.userId !== userId)
        return res.status(404).json({ error: 'Invoice not found' });
      if (inv.status === 'PAID') return res.status(409).json({ error: 'Already paid' });
      amount = inv.amount;
      purpose = 'WEEKLY_RENT';
      label = `Week ${inv.weekNumber} rent`;
    }

    // A local order id we can correlate on, whatever the gateway calls it.
    const orderId = `RFY_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const payment = await prisma.payment.create({
      data: {
        userId,
        bookingId: bookingId || null,
        weeklyInvoiceId: invoiceId || null,
        purpose,
        amount,
        provider,
        providerOrderId: orderId,
        status: 'INITIATED',
        note: label,
      },
    });

    if (!isGatewayLive(provider)) {
      return res.json({
        mode: 'stub',
        message: 'No live gateway configured — settle through the stub pay endpoint.',
        payment: { id: payment.id, amount, orderId },
      });
    }

    // Live mode: the gateway order is created here and its handle returned.
    // Deliberately not implemented until real credentials exist — returning a
    // fake order would look like it worked and fail at the sheet.
    return res.status(501).json({
      error: `${provider} order creation is not implemented yet`,
      code: 'GATEWAY_NOT_IMPLEMENTED',
      payment: { id: payment.id, amount, orderId },
    });
  } catch (error: any) {
    console.error('createIntent:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* -------------------------------------------------------------------------- */
/* POST /payments/webhook/:provider                                            */
/* -------------------------------------------------------------------------- */

/**
 * The gateway's callback. Mounted with a raw-body parser so the signature can
 * be checked against the exact bytes that were signed.
 */
export async function handleWebhook(req: Request, res: Response) {
  const provider = String(req.params.provider || '').toUpperCase() as Provider;

  try {
    const raw = (req as any).rawBody as string | undefined;
    const body = req.body ?? {};

    /* -- 1. authenticate the caller ------------------------------------- */
    let verified = false;
    if (provider === 'RAZORPAY') {
      verified = verifyRazorpay(raw ?? JSON.stringify(body), String(req.headers['x-razorpay-signature'] || ''));
    } else if (provider === 'PHONEPE') {
      verified = verifyPhonePe(String(body?.response || ''), String(req.headers['x-verify'] || ''));
    }

    if (!verified) {
      // Never reveal why. An unsigned webhook is an attacker, not a bug.
      console.warn(`[webhook] rejected unsigned ${provider} callback`);
      return res.status(401).json({ error: 'Invalid signature' });
    }

    /* -- 2. pull out the bits we care about ------------------------------ */
    const parsed = parseEvent(provider, body);
    if (!parsed) return res.status(200).json({ received: true, ignored: true });

    const { providerPaymentId, orderId, succeeded } = parsed;

    /* -- 3. idempotency -------------------------------------------------- */
    // The provider's payment id is the natural key. If we've already recorded
    // a terminal state against it, this is a retry — acknowledge and stop.
    const existing = await prisma.payment.findFirst({
      where: { providerPaymentId },
      select: { id: true, status: true },
    });
    if (existing && existing.status !== 'INITIATED') {
      return res.status(200).json({ received: true, duplicate: true, paymentId: existing.id });
    }

    const payment = existing
      ? await prisma.payment.findUnique({ where: { id: existing.id } })
      : await prisma.payment.findFirst({ where: { providerOrderId: orderId, status: 'INITIATED' } });

    if (!payment) {
      console.warn(`[webhook] no INITIATED payment for order ${orderId}`);
      return res.status(200).json({ received: true, unmatched: true });
    }

    /* -- 4. settle ------------------------------------------------------- */
    if (!succeeded) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', providerPaymentId, rawWebhook: body },
      });
      return res.status(200).json({ received: true, status: 'FAILED' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCESS', providerPaymentId, rawWebhook: body },
      });

      if (payment.bookingId) {
        await tx.booking.updateMany({
          where: { id: payment.bookingId, status: 'PENDING' },
          data: { status: 'CONFIRMED', expiresAt: null },
        });
      }

      if (payment.weeklyInvoiceId) {
        await tx.weeklyInvoice.updateMany({
          where: { id: payment.weeklyInvoiceId, status: { in: ['PENDING', 'OVERDUE'] } },
          data: { status: 'PAID', paidAt: new Date() },
        });
      }
    });

    // Receipts are best-effort and must never fail the webhook — a non-200
    // makes the gateway retry a payment we've already banked.
    void notifyReceipt(payment.userId, payment.amount, payment.note || 'your payment');

    return res.status(200).json({ received: true, status: 'SUCCESS', paymentId: payment.id });
  } catch (error: any) {
    console.error('handleWebhook:', error);
    // 200 on our own bug too: a retry storm won't fix a crash, and the
    // gateway dashboard is where the operator will look anyway.
    return res.status(200).json({ received: true, error: 'handler_error' });
  }
}

async function notifyReceipt(userId: string, amount: number, covers: string) {
  try {
    void notify.paymentReceived(userId, amount, covers);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, fullName: true },
    });
    if (user?.phone) {
      void sendPaymentReceiptWhatsApp(user.phone, user.fullName || 'Rider', amount, covers);
    }
  } catch {
    /* best effort */
  }
}

/** Normalise each gateway's payload into the three fields we act on. */
function parseEvent(
  provider: Provider,
  body: any
): { providerPaymentId: string; orderId: string; succeeded: boolean } | null {
  if (provider === 'RAZORPAY') {
    const entity = body?.payload?.payment?.entity;
    if (!entity?.id) return null;
    return {
      providerPaymentId: String(entity.id),
      orderId: String(entity.notes?.rfyOrderId || entity.order_id || ''),
      succeeded: body?.event === 'payment.captured' || entity.status === 'captured',
    };
  }

  if (provider === 'PHONEPE') {
    // PhonePe posts { response: base64(json) }
    try {
      const decoded = JSON.parse(Buffer.from(String(body?.response || ''), 'base64').toString());
      const d = decoded?.data;
      if (!d?.transactionId) return null;
      return {
        providerPaymentId: String(d.transactionId),
        orderId: String(d.merchantTransactionId || ''),
        succeeded: decoded?.code === 'PAYMENT_SUCCESS',
      };
    } catch {
      return null;
    }
  }

  return null;
}
