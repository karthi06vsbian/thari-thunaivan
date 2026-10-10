import { createHmac, timingSafeEqual } from "node:crypto";

/** Public key id (safe in the browser). The secret must only ever be in the server environment. */
export const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "rzp_test_TmD7N99LY4lgKL";

export function razorpayConfigured(): boolean {
  return !!process.env.RAZORPAY_KEY_SECRET;
}

/** Creates a Razorpay order for `amountPaise`; returns its id for Checkout. */
export async function createRazorpayOrder(amountPaise: number, receipt: string): Promise<string> {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error("Online payment is not set up yet (RAZORPAY_KEY_SECRET is missing).");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${secret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt, notes: { orderNo: receipt } }),
  });
  const json = (await res.json()) as { id?: string; error?: { description?: string } };
  if (!res.ok || !json.id) {
    throw new Error(`Could not start the payment: ${json.error?.description ?? `Razorpay answered ${res.status}`}`);
  }
  return json.id;
}

/**
 * Razorpay signs "<order_id>|<payment_id>" with the key secret. A payment only counts
 * when this matches, so a browser cannot claim a payment that did not happen.
 */
export function isValidPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
  secret: string,
): boolean {
  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex"),
  );
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Advance in paise for an order, never below Razorpay's 1 rupee minimum. */
export function advanceFor(meters: number, ratePerMeterRupees: number, advancePercent: number): number {
  return Math.max(100, Math.round(meters * ratePerMeterRupees * advancePercent));
}
