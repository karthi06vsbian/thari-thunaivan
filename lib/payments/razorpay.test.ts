import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { advanceFor, isValidPaymentSignature } from "./razorpay";

describe("razorpay", () => {
  const secret = "test-secret";
  const sign = (order: string, payment: string) =>
    createHmac("sha256", secret).update(`${order}|${payment}`).digest("hex");

  it("accepts a signature made with the key secret", () => {
    expect(isValidPaymentSignature("order_1", "pay_1", sign("order_1", "pay_1"), secret)).toBe(true);
  });

  it("rejects a forged signature or one for a different order", () => {
    expect(isValidPaymentSignature("order_1", "pay_1", "0".repeat(64), secret)).toBe(false);
    expect(isValidPaymentSignature("order_2", "pay_1", sign("order_1", "pay_1"), secret)).toBe(false);
    expect(isValidPaymentSignature("order_1", "pay_1", "short", secret)).toBe(false);
  });

  it("works out the advance in paise", () => {
    // 4,000 m x Rs 92 = Rs 3,68,000; 10% = Rs 36,800
    expect(advanceFor(4_000, 92, 10)).toBe(3_680_000);
    expect(advanceFor(1, 0.5, 10)).toBe(100);
  });
});
