import QRCode from 'qrcode';

/**
 * UPI collect links for weekly rent.
 *
 * A rider paying rent at midnight does not want to open a gateway sheet and
 * type an amount — they want to point their UPI app at a QR, or tap a link
 * that opens it pre-filled. Both are the same payload: a `upi://pay` URI.
 *
 * This works with no gateway at all, which matters while PAYMENTS_MODE is
 * `stub`: money genuinely arrives in the company VPA. What it cannot do is
 * tell us that it arrived — UPI intent has no callback. So a QR payment is
 * reconciled either by the rider confirming in the app or by staff marking the
 * invoice paid, and the invoice text says so rather than implying it is
 * instant. When a real gateway is configured, its own link supersedes this.
 */

export interface RentPaymentHandles {
  /** `upi://pay?...` — opens any UPI app with the amount pre-filled. */
  upiUri: string;
  /** A QR of that URI, as a self-contained SVG data URI. */
  qrDataUri: string;
  /** Deep link into the app's own payment screen. */
  appLink: string;
  /** True when a company VPA is configured; false means QR is unavailable. */
  configured: boolean;
}

const vpa = () => process.env.UPI_VPA || '';
const payeeName = () => process.env.UPI_PAYEE_NAME || 'Ride For You';
const appScheme = () => process.env.APP_DEEP_LINK_SCHEME || 'rideforyou';

/**
 * UPI transaction refs must be alphanumeric and short. Invoice ids are UUIDs
 * with hyphens, which some PSP apps silently reject, so strip and clamp.
 */
const txnRef = (invoiceId: string) =>
  `RFY${invoiceId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20).toUpperCase()}`;

/**
 * Build the URI, the QR and the app link for one week's rent.
 *
 * Amount is in rupees and rendered with two decimals — the UPI spec wants a
 * plain decimal, and several apps reject an integer with no fractional part.
 */
export async function buildRentPaymentHandles(args: {
  invoiceId: string;
  amount: number;
  weekNumber: number;
}): Promise<RentPaymentHandles> {
  const appLink = `${appScheme()}://rental?payInvoiceId=${args.invoiceId}`;

  if (!vpa()) {
    // No VPA configured: the app link still works, the QR does not exist.
    // Returning an empty string beats returning a QR of a broken URI.
    return { upiUri: '', qrDataUri: '', appLink, configured: false };
  }

  const params = new URLSearchParams({
    pa: vpa(),
    pn: payeeName(),
    am: args.amount.toFixed(2),
    cu: 'INR',
    tn: `Week ${args.weekNumber} rent`,
    tr: txnRef(args.invoiceId),
  });

  const upiUri = `upi://pay?${params.toString()}`;

  let qrDataUri = '';
  try {
    const svg = await QRCode.toString(upiUri, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
    });
    qrDataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  } catch (e: any) {
    // A missing QR must not stop the invoice going out — the link still pays.
    console.warn('[upi] QR generation failed:', e?.message);
  }

  return { upiUri, qrDataUri, appLink, configured: true };
}

/** Re-render a QR from a stored URI, for screens that only hold the URI. */
export async function qrFromUri(uri: string): Promise<string> {
  if (!uri) return '';
  try {
    const svg = await QRCode.toString(uri, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
    });
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  } catch {
    return '';
  }
}
