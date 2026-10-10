"use client";

import { openCheckout } from "@/lib/payments/checkout";
import { confirmPayment, type CheckoutInfo } from "./actions";

/** Runs Checkout for an order and confirms the payment with the server. */
export async function payForOrder(info: CheckoutInfo, companyName: string): Promise<{ ok: boolean; text: string }> {
  const response = await openCheckout({
    ...info,
    companyName,
    description: `Advance for order ${info.orderId}`,
  });
  if (!response) {
    return { ok: false, text: `Payment not completed. Order ${info.orderId} is saved – use “Pay now” under My orders to confirm it.` };
  }
  const result = await confirmPayment({
    orderId: info.orderId,
    razorpayOrderId: response.razorpay_order_id,
    razorpayPaymentId: response.razorpay_payment_id,
    signature: response.razorpay_signature,
  });
  return result.ok ? { ok: true, text: result.message ?? "Payment received." } : { ok: false, text: result.error };
}
