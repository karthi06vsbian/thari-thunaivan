"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/action-result";
import { assertRole } from "@/lib/auth/session";
import { getOrder } from "@/lib/data";
import { formatDate, isIsoDate, todayIso } from "@/lib/dates";
import { db } from "@/lib/firebase/admin";
import { formatINR, rupeesToPaise } from "@/lib/money";
import {
  advanceFor,
  createRazorpayOrder,
  isValidPaymentSignature,
  RAZORPAY_KEY_ID,
  razorpayConfigured,
} from "@/lib/payments/razorpay";
import { newBatchFor, nextOrderNumbers } from "@/lib/services/orders";
import { SITE } from "@/lib/site";
import type { AppUser, Order } from "@/lib/types";
import { sendToOwners } from "@/lib/whatsapp/send";

const MAX_OPEN_REQUESTS = 5;

const schema = z.object({
  company: z.string().trim().min(2, "Enter your name or company").max(120),
  phone: z.string().trim().regex(/^[0-9+ ()-]{7,20}$/, "Enter a valid phone number"),
  fabricType: z.string().refine((v) => SITE.fabrics.some((f) => f.value === v), "Choose a fabric"),
  widthInches: z.number().min(20, "Width must be at least 20 inches").max(140, "Width must be 140 inches or less"),
  meters: z.number().min(100, "Minimum order is 100 meters").max(1_000_000),
  deadline: z.string().refine(isIsoDate, "Choose the date you need it by"),
  notes: z.string().trim().max(1000),
  deliveryAddress: z.string().trim().min(10, "Enter the full delivery address").max(300),
  confirmMode: z.enum(["prepaid", "cash"]),
  appointmentDate: z.string(),
  appointmentSlot: z.string(),
});

/** What the browser needs to open Razorpay Checkout for an order. */
export interface CheckoutInfo {
  orderId: string;
  keyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  customerName: string;
  contact: string;
  email: string;
}

function checkoutInfo(order: Order, user: AppUser): CheckoutInfo {
  return {
    orderId: order.id,
    keyId: RAZORPAY_KEY_ID,
    razorpayOrderId: order.razorpayOrderId!,
    amountPaise: order.advancePaise!,
    customerName: order.customerName,
    contact: order.clientPhone ?? "",
    email: user.email,
  };
}

/**
 * A client's order. Prepaid orders are confirmed as soon as the advance is paid;
 * cash orders book a visit and are confirmed by staff.
 */
export async function placeOrder(input: z.infer<typeof schema>) {
  return run<{ orderId: string; checkout?: CheckoutInfo }>(async () => {
    const user = await assertRole(["client"]);
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Please check the form");
    const o = parsed.data;
    const today = todayIso();
    if (o.deadline <= today) throw new Error("The delivery date must be in the future");

    const prepaid = o.confirmMode === "prepaid";
    if (prepaid && !razorpayConfigured()) {
      throw new Error("Online payment is not set up yet. Please choose cash on confirmation.");
    }
    if (!prepaid) {
      if (!isIsoDate(o.appointmentDate) || o.appointmentDate <= today) throw new Error("Choose a visit date from tomorrow onwards");
      if (new Date(`${o.appointmentDate}T00:00:00Z`).getUTCDay() === 0) throw new Error("The mill is closed on Sundays. Choose another visit date.");
      if (o.appointmentDate >= o.deadline) throw new Error("The visit must be before the date you need the fabric");
      if (!SITE.visitSlots.includes(o.appointmentSlot)) throw new Error("Choose a visit time");
    }

    const open = await db().collection("orders").where("clientUid", "==", user.uid).get();
    if (open.docs.filter((d) => d.data().status === "requested").length >= MAX_OPEN_REQUESTS) {
      throw new Error("You already have several requests waiting. We will confirm those first.");
    }

    const fabric = SITE.fabrics.find((f) => f.value === o.fabricType)!;
    const { orderNo } = await nextOrderNumbers();
    const advancePaise = advanceFor(o.meters, fabric.ratePerMeter, SITE.advancePercent);
    const order: Order = {
      id: orderNo,
      orderNo,
      customerName: o.company,
      fabricType: o.fabricType,
      widthInches: o.widthInches,
      meters: o.meters,
      deadline: o.deadline,
      status: "requested",
      // Prepaid orders are priced from the published rate; cash orders are priced by staff.
      ratePerMeterPaise: prepaid ? rupeesToPaise(fabric.ratePerMeter) : 0,
      clientUid: user.uid,
      clientPhone: o.phone,
      notes: o.notes,
      deliveryAddress: o.deliveryAddress,
      requestedAt: new Date().toISOString(),
      confirmMode: o.confirmMode,
      paymentStatus: "pending",
      advancePaise: prepaid ? advancePaise : 0,
      razorpayOrderId: prepaid ? await createRazorpayOrder(advancePaise, orderNo) : null,
      razorpayPaymentId: null,
      paidAt: null,
      appointment: prepaid ? null : { date: o.appointmentDate, slot: o.appointmentSlot },
    };
    const { id, ...data } = order;
    await db().collection("orders").doc(id).set(data);
    await db().collection("users").doc(user.uid).update({ company: o.company, phone: o.phone, address: o.deliveryAddress });

    // The owner hears about prepaid orders once the money is in, not before.
    if (!prepaid) {
      await sendToOwners(
        [
          `*New order request ${orderNo}* (cash on confirmation)`,
          `${o.company} · ${o.phone}`,
          `${o.meters.toLocaleString("en-IN")} m ${o.fabricType} at ${o.widthInches}" · needed by ${formatDate(o.deadline, true)}`,
          `Deliver to: ${o.deliveryAddress}`,
          `Visit booked: ${formatDate(o.appointmentDate, true)}, ${o.appointmentSlot}`,
          o.notes,
          "Open Orders in the app to accept or decline after the visit.",
        ]
          .filter(Boolean)
          .join("\n"),
        "order-request",
      );
    }
    revalidatePath("/portal");
    revalidatePath("/admin", "layout");
    return prepaid
      ? { data: { orderId: orderNo, checkout: checkoutInfo(order, user) }, message: `Order ${orderNo} created. Complete the payment to confirm it.` }
      : {
          data: { orderId: orderNo },
          message: `Order ${orderNo} booked. Visit us on ${formatDate(o.appointmentDate, true)}, ${o.appointmentSlot} to confirm it.`,
        };
  });
}

async function ownOrder(orderId: string, user: AppUser): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order || order.clientUid !== user.uid) throw new Error("Order not found");
  return order;
}

/** Re-opens the payment for a prepaid order that was not paid the first time. */
export async function resumePayment(orderId: string) {
  return run<{ checkout: CheckoutInfo }>(async () => {
    const user = await assertRole(["client"]);
    const order = await ownOrder(orderId, user);
    if (order.confirmMode !== "prepaid" || order.status !== "requested" || order.paymentStatus === "paid" || !order.razorpayOrderId) {
      throw new Error("This order is not waiting for a payment");
    }
    return { data: { checkout: checkoutInfo(order, user) } };
  });
}

const paymentSchema = z.object({
  orderId: z.string().min(1),
  razorpayOrderId: z.string().min(1).max(100),
  razorpayPaymentId: z.string().min(1).max(100),
  signature: z.string().min(1).max(200),
});

/** Called after Checkout succeeds. The order is confirmed only if Razorpay's signature checks out. */
export async function confirmPayment(input: z.infer<typeof paymentSchema>) {
  return run(async () => {
    const user = await assertRole(["client"]);
    const p = paymentSchema.parse(input);
    const order = await ownOrder(p.orderId, user);
    if (order.paymentStatus === "paid") return { message: `Order ${order.orderNo} is already confirmed.` };
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (
      !secret ||
      order.razorpayOrderId !== p.razorpayOrderId ||
      !isValidPaymentSignature(p.razorpayOrderId, p.razorpayPaymentId, p.signature, secret)
    ) {
      throw new Error("We could not verify this payment. If money was deducted, contact us with your order number.");
    }
    if (order.status !== "requested") throw new Error("This order is no longer waiting for a payment");

    const write = db().batch();
    write.update(db().collection("orders").doc(order.id), {
      status: "confirmed",
      paymentStatus: "paid",
      razorpayPaymentId: p.razorpayPaymentId,
      paidAt: new Date().toISOString(),
    });
    const batch = newBatchFor(order);
    write.set(db().collection("batches").doc(batch.batchNo), batch);
    await write.commit();

    await sendToOwners(
      [
        `*Order ${order.orderNo} confirmed – advance paid*`,
        `${order.customerName} · ${order.clientPhone ?? ""}`,
        `${order.meters.toLocaleString("en-IN")} m ${order.fabricType} at ${order.widthInches}" · needed by ${formatDate(order.deadline, true)}`,
        order.deliveryAddress ? `Deliver to: ${order.deliveryAddress}` : "",
        `Advance received: ${formatINR(order.advancePaise ?? 0)} (Razorpay ${p.razorpayPaymentId})`,
        "It is ready to plan in the app.",
      ]
        .filter(Boolean)
        .join("\n"),
      "order-paid",
    );
    revalidatePath("/portal");
    revalidatePath("/admin", "layout");
    return { message: `Payment received. Order ${order.orderNo} is confirmed.` };
  });
}

const reviewSchema = z.object({
  orderId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(10, "Write at least a sentence about your order").max(400),
});

/** A client's review of a delivered order. It appears on the website only after staff approve it. */
export async function submitReview(input: z.infer<typeof reviewSchema>) {
  return run(async () => {
    const user = await assertRole(["client"]);
    const parsed = reviewSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Please check the form");
    const r = parsed.data;
    const order = await ownOrder(r.orderId, user);
    const shipment = await db().collection("shipments").doc(order.orderNo).get();
    if (shipment.data()?.status !== "delivered") throw new Error("You can review an order once it has been delivered");

    await db().collection("reviews").doc(order.orderNo).set({
      orderNo: order.orderNo,
      clientUid: user.uid,
      name: order.customerName,
      about: `${order.meters.toLocaleString("en-IN")} m ${order.fabricType}`,
      rating: r.rating,
      text: r.text,
      at: new Date().toISOString(),
      approved: false,
    });
    await sendToOwners(
      `*New client review – ${order.orderNo}*\n${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)} from ${order.customerName}\n“${r.text}”\nApprove it on the Overview page to show it on the website.`,
      "review",
    );
    revalidatePath("/portal", "layout");
    revalidatePath("/admin", "layout");
    return { message: "Thank you! Your review will appear on our website once we have approved it." };
  });
}
