"use server";

import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { ACCESS, assertRole } from "@/lib/auth/session";
import { getStockOrder } from "@/lib/data";
import { isIsoDate, todayIso } from "@/lib/dates";
import { db } from "@/lib/firebase/admin";
import { formatNumber, rupeesToPaise } from "@/lib/money";
import { isOpenStockOrder, nextStockStep, STOCK_FABRICS, trackingIdFrom } from "@/lib/stock";
import type { Material, StockOrder, StockOrderEvent } from "@/lib/types";

const quantity = z.number().min(0).max(100_000_000);
const materialSchema = z.object({
  name: z.string().trim().min(2, "Enter the material's name").max(60),
  unit: z.string().trim().min(1, "Enter the unit, e.g. kg").max(12),
  fabricType: z.string().refine((f) => f === "" || STOCK_FABRICS.includes(f), "Choose a fabric"),
  stock: quantity,
  minStock: quantity,
  usePerMeter: z.number().min(0).max(1_000),
});

/** Adds a material, or updates one when its id is given. */
export async function saveMaterial(materialId: string | null, input: z.infer<typeof materialSchema>) {
  return run(async () => {
    const user = await assertRole(ACCESS.stock);
    const parsed = materialSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Please check the form");
    const d = parsed.data;
    const data: Omit<Material, "id"> = {
      name: d.name, unit: d.unit, fabricType: d.fabricType || null,
      stock: d.stock, minStock: d.minStock, usePerMeter: d.usePerMeter,
      updatedAt: new Date().toISOString(), updatedBy: user.name,
    };
    const materials = db().collection("materials");
    if (materialId) {
      if (!(await materials.doc(materialId).get()).exists) throw new Error("Material not found");
      await materials.doc(materialId).set(data);
    } else {
      materialId = (await materials.add(data)).id;
    }
    await writeAudit(user, "stock-update", "material", d.name, `${d.stock} ${d.unit} in stock`);
    revalidatePath("/admin", "layout");
    return { message: `${d.name}: ${d.stock} ${d.unit} in stock` };
  });
}

export async function removeMaterial(materialId: string) {
  return run(async () => {
    const user = await assertRole(ACCESS.stock);
    const ref = db().collection("materials").doc(materialId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Material not found");
    await ref.delete();
    await writeAudit(user, "stock-remove", "material", String(snap.get("name")));
    revalidatePath("/admin", "layout");
    return { message: `${snap.get("name")} removed from the stock list` };
  });
}

const orderSchema = z.object({
  materialId: z.string().min(1),
  quantity: z.number().positive("Enter the quantity to order").max(100_000_000),
  supplier: z.string().trim().min(2, "Enter the supplier's name").max(80),
  rateRupees: z.number().min(0).max(10_000_000),
  expectedOn: z.string().refine((d) => isIsoDate(d) && d >= todayIso(), "Pick the date the delivery is expected"),
});

/** Buys a material from a supplier and returns the tracking ID that follows it to the store. */
export async function placeStockOrder(input: z.infer<typeof orderSchema>) {
  return run<{ trackingId: string }>(async () => {
    const user = await assertRole(ACCESS.stock);
    const parsed = orderSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Please check the form");
    const d = parsed.data;
    const snap = await db().collection("materials").doc(d.materialId).get();
    if (!snap.exists) throw new Error("Material not found");
    const material = snap.data() as Omit<Material, "id">;

    const trackingId = trackingIdFrom(randomBytes(8));
    const now = new Date().toISOString();
    const order: Omit<StockOrder, "id"> = {
      trackingId, materialId: d.materialId, materialName: material.name, unit: material.unit,
      quantity: d.quantity, supplier: d.supplier, ratePaise: rupeesToPaise(d.rateRupees), expectedOn: d.expectedOn,
      status: "ordered", orderedAt: now, orderedBy: user.name, receivedAt: null,
      events: [{ status: "ordered", at: now, by: user.name, note: "" }],
    };
    // create() fails rather than overwriting in the unlikely case the ID is already taken.
    await db().collection("stockOrders").doc(trackingId).create(order);
    await writeAudit(user, "stock-order", "stockOrder", trackingId, `${formatNumber(d.quantity)} ${material.unit} ${material.name} from ${d.supplier}`);
    revalidatePath("/admin", "layout");
    return { data: { trackingId }, message: `Order placed. Tracking ID ${trackingId}` };
  });
}

const noteOf = (text: string) => text.trim().slice(0, 200);

/** Moves a stock order to its next stage. Receiving it adds the quantity to the store. */
export async function advanceStockOrder(trackingId: string, note: string) {
  return run(async () => {
    const user = await assertRole(ACCESS.stock);
    const ref = db().collection("stockOrders").doc(trackingId);
    const done = await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("Stock order not found");
      const order = snap.data() as Omit<StockOrder, "id">;
      const next = nextStockStep(order.status);
      if (!next) throw new Error("This order is already closed");
      const now = new Date().toISOString();
      const event: StockOrderEvent = { status: next.status, at: now, by: user.name, note: noteOf(note) };
      if (next.status !== "received") {
        tx.update(ref, { status: next.status, events: FieldValue.arrayUnion(event) });
        return { order, next, stocked: false };
      }
      const materialRef = db().collection("materials").doc(order.materialId);
      const stocked = (await tx.get(materialRef)).exists;
      if (stocked) tx.update(materialRef, { stock: FieldValue.increment(order.quantity), updatedAt: now, updatedBy: user.name });
      tx.update(ref, { status: next.status, receivedAt: now, events: FieldValue.arrayUnion(event) });
      return { order, next, stocked };
    });
    const { order, next, stocked } = done;
    await writeAudit(user, `stock-order-${next.status}`, "stockOrder", trackingId, `${formatNumber(order.quantity)} ${order.unit} ${order.materialName}`);
    revalidatePath("/admin", "layout");
    if (next.status !== "received") return { message: `${trackingId}: ${next.label.toLowerCase()}` };
    return {
      message: stocked
        ? `${formatNumber(order.quantity)} ${order.unit} of ${order.materialName} added to stock`
        : `${trackingId} received. ${order.materialName} is no longer on the stock list, so nothing was added.`,
    };
  });
}

export async function addStockOrderNote(trackingId: string, note: string) {
  return run(async () => {
    const user = await assertRole(ACCESS.stock);
    const text = noteOf(note);
    if (text.length < 3) throw new Error("Type the note first");
    const order = await getStockOrder(trackingId);
    if (!order) throw new Error("Stock order not found");
    const event: StockOrderEvent = { status: order.status, at: new Date().toISOString(), by: user.name, note: text };
    await db().collection("stockOrders").doc(trackingId).update({ events: FieldValue.arrayUnion(event) });
    revalidatePath("/admin/stock", "layout");
    return { message: "Note added" };
  });
}

export async function cancelStockOrder(trackingId: string, note: string) {
  return run(async () => {
    const user = await assertRole(ACCESS.stock);
    const order = await getStockOrder(trackingId);
    if (!order) throw new Error("Stock order not found");
    if (!isOpenStockOrder(order)) throw new Error("This order is already closed");
    const event: StockOrderEvent = { status: "cancelled", at: new Date().toISOString(), by: user.name, note: noteOf(note) };
    await db().collection("stockOrders").doc(trackingId).update({ status: "cancelled", events: FieldValue.arrayUnion(event) });
    await writeAudit(user, "stock-order-cancelled", "stockOrder", trackingId, `${formatNumber(order.quantity)} ${order.unit} ${order.materialName}`);
    revalidatePath("/admin", "layout");
    return { message: `${trackingId} cancelled` };
  });
}
