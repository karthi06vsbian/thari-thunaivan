"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/action-result";
import { assertRole } from "@/lib/auth/session";
import { formatDate, isIsoDate, todayIso } from "@/lib/dates";
import { db } from "@/lib/firebase/admin";
import { nextOrderNumbers } from "@/lib/services/orders";
import { SITE } from "@/lib/site";
import type { Order } from "@/lib/types";
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
});

/** A client's order request. It becomes a real order only when staff accept it. */
export async function placeOrder(input: z.infer<typeof schema>) {
  return run(async () => {
    const user = await assertRole(["client"]);
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Please check the form");
    const o = parsed.data;
    if (o.deadline <= todayIso()) throw new Error("The delivery date must be in the future");

    const open = await db().collection("orders").where("clientUid", "==", user.uid).get();
    if (open.docs.filter((d) => d.data().status === "requested").length >= MAX_OPEN_REQUESTS) {
      throw new Error("You already have several requests waiting. We will confirm those first.");
    }

    const { orderNo } = await nextOrderNumbers();
    const order: Omit<Order, "id"> = {
      orderNo,
      customerName: o.company,
      fabricType: o.fabricType,
      widthInches: o.widthInches,
      meters: o.meters,
      deadline: o.deadline,
      status: "requested",
      ratePerMeterPaise: 0,
      clientUid: user.uid,
      clientPhone: o.phone,
      notes: o.notes,
      requestedAt: new Date().toISOString(),
    };
    await db().collection("orders").doc(orderNo).set(order);
    await db().collection("users").doc(user.uid).update({ company: o.company, phone: o.phone });
    await sendToOwners(
      [
        `*New order request ${orderNo}*`,
        `${o.company} · ${o.phone}`,
        `${o.meters.toLocaleString("en-IN")} m ${o.fabricType} at ${o.widthInches}" · needed by ${formatDate(o.deadline, true)}`,
        o.notes,
        "Open Orders in the app to accept or decline.",
      ]
        .filter(Boolean)
        .join("\n"),
      "order-request",
    );
    revalidatePath("/portal");
    revalidatePath("/admin", "layout");
    return { message: `Order ${orderNo} sent. We will confirm the price and delivery date shortly.` };
  });
}
