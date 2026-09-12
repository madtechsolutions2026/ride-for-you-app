/**
 * Module: Gateway order creation (GW-001 .. GW-012)
 *
 * No credentials and no network: the HTTP call is injected, so every branch —
 * success, rejection, malformed reply — is exercised against a fake provider.
 * What these lock down is the part that is fixed by each provider's spec and
 * cannot be checked by reading the code twice: paise conversion, the
 * correlation id surviving the round trip, and the PhonePe checksum.
 */
import crypto from 'crypto';
import {
  createGatewayOrder,
  GatewayError,
  toPaise,
  type Fetcher,
} from '../../src/services/gateways';

/** A fetch stand-in that records the call and replies with `body`. */
function fakeFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const calls: { url: string; options: any }[] = [];

  const fn = (async (url: any, options: any) => {
    calls.push({ url: String(url), options });
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => body,
    };
  }) as unknown as Fetcher;

  return { fn, calls };
}

const ORDER = {
  orderId: 'RFY_1757650000000_a1b2c3d4',
  amount: 1645,
  userId: 'usr_test',
  phone: '+919900011122',
  label: 'Week 2 rent',
};

describe('Amount conversion', () => {
  it('GW-001 converts rupees to paise, rounding fractions away', () => {
    expect(toPaise(1645)).toBe(164500);
    expect(toPaise(1)).toBe(100);
    expect(toPaise(0.5)).toBe(50);
    // A stray float must not produce fractional paise, which gateways reject.
    expect(Number.isInteger(toPaise(1645.004))).toBe(true);
  });
});

describe('Razorpay', () => {
  const ORIGINAL = { ...process.env };

  beforeEach(() => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
    process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it('GW-002 sends the amount in paise, not rupees', async () => {
    const { fn, calls } = fakeFetch({ id: 'order_XYZ', amount: 164500, currency: 'INR' });

    await createGatewayOrder('RAZORPAY', ORDER, fn);

    const body = JSON.parse(calls[0].options.body);
    expect(body.amount).toBe(164500);
    expect(body.currency).toBe('INR');
  });

  it('GW-003 carries our order id where the webhook parser reads it', async () => {
    const { fn, calls } = fakeFetch({ id: 'order_XYZ', amount: 164500 });

    const result = await createGatewayOrder('RAZORPAY', ORDER, fn);

    const body = JSON.parse(calls[0].options.body);
    // parseEvent() reads entity.notes.rfyOrderId — this is the link home.
    expect(body.notes.rfyOrderId).toBe(ORDER.orderId);
    expect(body.receipt).toBe(ORDER.orderId);
    expect(result.gatewayOrderId).toBe('order_XYZ');
  });

  it('GW-004 authenticates with basic auth over key id and secret', async () => {
    const { fn, calls } = fakeFetch({ id: 'order_XYZ' });

    await createGatewayOrder('RAZORPAY', ORDER, fn);

    const header = String(calls[0].options.headers.Authorization);
    expect(header.startsWith('Basic ')).toBe(true);
    expect(Buffer.from(header.slice(6), 'base64').toString()).toBe(
      'rzp_test_key:rzp_test_secret',
    );
  });

  it('GW-005 never returns the key secret to the client', async () => {
    const { fn } = fakeFetch({ id: 'order_XYZ', amount: 164500 });

    const result = await createGatewayOrder('RAZORPAY', ORDER, fn);

    expect(JSON.stringify(result.checkout)).not.toContain('rzp_test_secret');
    expect(result.checkout.key).toBe('rzp_test_key');
  });

  it('GW-006 surfaces the provider’s own rejection message', async () => {
    const { fn } = fakeFetch(
      { error: { description: 'Order amount less than minimum' } },
      { ok: false, status: 400 },
    );

    await expect(createGatewayOrder('RAZORPAY', ORDER, fn)).rejects.toThrow(
      /Order amount less than minimum/,
    );
  });

  it('GW-007 treats a 200 with no order id as a failure', async () => {
    const { fn } = fakeFetch({ something: 'unexpected' });

    await expect(createGatewayOrder('RAZORPAY', ORDER, fn)).rejects.toBeInstanceOf(GatewayError);
  });

  it('GW-008 refuses to call out with no credentials configured', async () => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    const { fn, calls } = fakeFetch({ id: 'order_XYZ' });

    await expect(createGatewayOrder('RAZORPAY', ORDER, fn)).rejects.toThrow(/not configured/i);
    expect(calls).toHaveLength(0);
  });
});

describe('PhonePe', () => {
  const ORIGINAL = { ...process.env };

  const okReply = {
    success: true,
    data: {
      merchantTransactionId: ORDER.orderId,
      instrumentResponse: { redirectInfo: { url: 'https://pay.phonepe.com/x/abc' } },
    },
  };

  beforeEach(() => {
    process.env.PHONEPE_MERCHANT_ID = 'MERCHANTTEST';
    process.env.PHONEPE_SALT_KEY = 'salt-abc-123';
    process.env.PHONEPE_SALT_INDEX = '1';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it('GW-009 signs base64(payload) + path + salt, exactly as PhonePe verifies it', async () => {
    const { fn, calls } = fakeFetch(okReply);

    await createGatewayOrder('PHONEPE', ORDER, fn);

    const sent = JSON.parse(calls[0].options.body);
    const expected = `${crypto
      .createHash('sha256')
      .update(sent.request + '/pg/v1/pay' + 'salt-abc-123')
      .digest('hex')}###1`;

    expect(calls[0].options.headers['X-VERIFY']).toBe(expected);
  });

  it('GW-010 puts our order id in merchantTransactionId and the amount in paise', async () => {
    const { fn, calls } = fakeFetch(okReply);

    await createGatewayOrder('PHONEPE', ORDER, fn);

    const sent = JSON.parse(calls[0].options.body);
    const payload = JSON.parse(Buffer.from(sent.request, 'base64').toString());

    expect(payload.merchantTransactionId).toBe(ORDER.orderId);
    expect(payload.amount).toBe(164500);
    // PhonePe wants a bare 10-digit number, not +91-prefixed.
    expect(payload.mobileNumber).toBe('9900011122');
  });

  it('GW-011 returns the hosted checkout URL', async () => {
    const { fn } = fakeFetch(okReply);

    const result = await createGatewayOrder('PHONEPE', ORDER, fn);

    expect(result.checkout.redirectUrl).toBe('https://pay.phonepe.com/x/abc');
  });

  it('GW-012 fails when success is true but no redirect URL came back', async () => {
    const { fn } = fakeFetch({ success: true, data: {} });

    await expect(createGatewayOrder('PHONEPE', ORDER, fn)).rejects.toBeInstanceOf(GatewayError);
  });

  it('GW-013 rejects a non-positive amount before any network call', async () => {
    const { fn, calls } = fakeFetch(okReply);

    await expect(
      createGatewayOrder('PHONEPE', { ...ORDER, amount: 0 }, fn),
    ).rejects.toThrow(/positive/i);
    expect(calls).toHaveLength(0);
  });
});
