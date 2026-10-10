"use client";

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: "INR";
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; contact: string; email: string };
  theme: { color: string };
  handler: (response: RazorpayResponse) => void;
  modal: { ondismiss: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void; on: (event: string, cb: () => void) => void };
  }
}

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the payment window. Check your connection and try again."));
    document.body.appendChild(script);
  });
}

export interface CheckoutRequest {
  keyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  customerName: string;
  contact: string;
  email: string;
  companyName: string;
  description: string;
}

/** Opens Razorpay Checkout. Resolves with the payment details, or null if the window was closed. */
export async function openCheckout(request: CheckoutRequest): Promise<RazorpayResponse | null> {
  await loadCheckoutScript();
  return new Promise((resolve) => {
    const checkout = new window.Razorpay!({
      key: request.keyId,
      amount: request.amountPaise,
      currency: "INR",
      name: request.companyName,
      description: request.description,
      order_id: request.razorpayOrderId,
      prefill: { name: request.customerName, contact: request.contact, email: request.email },
      theme: { color: "#714b67" },
      handler: (response) => resolve(response),
      modal: { ondismiss: () => resolve(null) },
    });
    checkout.open();
  });
}
