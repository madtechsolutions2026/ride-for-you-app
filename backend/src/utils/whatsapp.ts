import { way2chatsConfig } from '../config/way2chats';

/**
 * Clean phone number to E.164 without leading plus (e.g. 917095682464)
 */
function cleanPhoneNumber(to: string): string {
  let cleaned = to.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) cleaned = '91' + cleaned;
  return cleaned;
}

/**
 * Generic Way2Chats API caller using native fetch
 */
async function sendWay2ChatsPayload(payload: any): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(way2chatsConfig.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${way2chatsConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn(`[WHATSAPP NOTICE] ${res.status} error from Way2Chats:`, data);
      return false;
    }

    console.log(`✅ [WHATSAPP] Sent successfully:`, data?.id || 'OK');
    return true;
  } catch (error: any) {
    console.warn(`[WHATSAPP NOTICE] Request failed:`, error?.message);
    return false;
  }
}

/**
 * 1. Send Login OTP via WhatsApp (Using your approved 'otp' template)
 */
export async function sendWhatsAppOtp(phone: string, otp: string): Promise<boolean> {
  const to = cleanPhoneNumber(phone);
  const payload = {
    to,
    phoneNoId: way2chatsConfig.phoneId,
    type: 'template',
    name: 'otp',
    language: 'en',
    bodyParams: [otp],
    buttons: [
      {
        type: 'button',
        sub_type: 'url',
        text: otp,
      },
    ],
  };

  console.log(`📡 [WHATSAPP-OTP] Dispatching OTP [${otp}] via 'otp' template to ${to}...`);
  return sendWay2ChatsPayload(payload);
}

/**
 * 2. Send KYC Approval Notification via WhatsApp
 */
export async function sendKycApprovalWhatsApp(phone: string, fullName: string): Promise<boolean> {
  const to = cleanPhoneNumber(phone);
  const payload = {
    to,
    phoneNoId: way2chatsConfig.phoneId,
    type: 'template',
    name: 'kyc_approved_v1',
    language: 'en',
    bodyParams: [fullName || 'Rider', 'Kondapur Main Hub'],
  };

  console.log(`📡 [WHATSAPP-KYC] Dispatching approval alert to ${to}...`);
  return sendWay2ChatsPayload(payload);
}

/**
 * 3. Send Booking Confirmed Receipt via WhatsApp
 */
export async function sendBookingConfirmationWhatsApp(
  phone: string,
  fullName: string,
  reference: string,
  modelName: string,
  hubName: string
): Promise<boolean> {
  const to = cleanPhoneNumber(phone);
  const payload = {
    to,
    phoneNoId: way2chatsConfig.phoneId,
    type: 'template',
    name: 'booking_confirmed_v1',
    language: 'en',
    bodyParams: [fullName || 'Rider', reference, modelName, hubName],
  };

  console.log(`📡 [WHATSAPP-BOOKING] Dispatching booking receipt for ${reference} to ${to}...`);
  return sendWay2ChatsPayload(payload);
}

/**
 * 4. Weekly rent due tomorrow.
 * Template `rent_due_v1` — body params: name, amount, week number, due date.
 */
export async function sendRentDueWhatsApp(
  phone: string,
  fullName: string,
  amount: number,
  weekNumber: number,
  dueDate: string
): Promise<boolean> {
  const to = cleanPhoneNumber(phone);
  return sendWay2ChatsPayload({
    to,
    phoneNoId: way2chatsConfig.phoneId,
    type: 'template',
    name: 'rent_due_v1',
    language: 'en',
    bodyParams: [fullName || 'Rider', String(amount), String(weekNumber), dueDate],
  });
}

/**
 * 5. Weekly rent overdue.
 * Template `rent_overdue_v1` — body params: name, amount, days late.
 */
export async function sendRentOverdueWhatsApp(
  phone: string,
  fullName: string,
  amount: number,
  daysLate: number
): Promise<boolean> {
  const to = cleanPhoneNumber(phone);
  return sendWay2ChatsPayload({
    to,
    phoneNoId: way2chatsConfig.phoneId,
    type: 'template',
    name: 'rent_overdue_v1',
    language: 'en',
    bodyParams: [fullName || 'Rider', String(amount), String(daysLate)],
  });
}

/**
 * 6. Payment receipt (weekly rent settled).
 * Template `payment_received_v1` — body params: name, amount, what it covered.
 */
export async function sendPaymentReceiptWhatsApp(
  phone: string,
  fullName: string,
  amount: number,
  covers: string
): Promise<boolean> {
  const to = cleanPhoneNumber(phone);
  return sendWay2ChatsPayload({
    to,
    phoneNoId: way2chatsConfig.phoneId,
    type: 'template',
    name: 'payment_received_v1',
    language: 'en',
    bodyParams: [fullName || 'Rider', String(amount), covers],
  });
}
