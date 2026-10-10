"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { ACCESS, assertRole } from "@/lib/auth/session";
import { getOrder } from "@/lib/data";
import { db } from "@/lib/firebase/admin";
import { getShipment } from "@/lib/transport/data";
import { routeById } from "@/lib/transport/routes";
import type { Shipment } from "@/lib/types";
import { sendToClient, sendToOwners } from "@/lib/whatsapp/send";

const dispatchSchema = z.object({
  orderId: z.string().min(1),
  routeId: z.string().refine((id) => !!routeById(id), "Choose a route"),
  vehicleNo: z.string().trim().min(4, "Enter the vehicle number").max(20),
  driverName: z.string().trim().min(2, "Enter the driver's name").max(60),
});

/** Sends a finished order out on a truck and starts its tracking. */
export async function dispatchOrder(input: z.infer<typeof dispatchSchema>) {
  return run(async () => {
    const user = await assertRole(ACCESS.transport);
    const parsed = dispatchSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Please check the form");
    const d = parsed.data;
    const order = await getOrder(d.orderId);
    if (!order) throw new Error("Order not found");
    if (order.status !== "completed") throw new Error("Only completed orders can be dispatched");
    if (await getShipment(order.orderNo)) throw new Error("This order has already been dispatched");
    const route = routeById(d.routeId)!;

    const now = new Date().toISOString();
    const shipment: Omit<Shipment, "id"> = {
      orderNo: order.orderNo, customerName: order.customerName, clientPhone: order.clientPhone ?? null,
      meters: order.meters, fabricType: order.fabricType, routeId: route.id,
      vehicleNo: d.vehicleNo.toUpperCase(), driverName: d.driverName,
      status: "in_transit", dispatchedAt: now, deliveredAt: null,
      updates: [{ at: now, text: `Truck left the mill for ${route.destination}.`, by: user.name }],
    };
    await db().collection("shipments").doc(order.orderNo).set(shipment);
    await writeAudit(user, "dispatch", "order", order.orderNo, `${shipment.vehicleNo} to ${route.destination}`);

    const text = [
      `*Order ${order.orderNo} dispatched* 🚚`,
      `${order.meters.toLocaleString("en-IN")} m ${order.fabricType} for ${order.customerName}`,
      `Truck ${shipment.vehicleNo} · driver ${shipment.driverName}`,
      `Route: Erode → ${route.destination} · about ${route.days} day(s)`,
    ].join("\n");
    await sendToOwners(text, "dispatch");
    if (order.clientPhone) await sendToClient(order.clientPhone.replace(/\D/g, ""), text, "dispatch");
    revalidatePath("/admin", "layout");
    return { message: `${order.orderNo} dispatched to ${route.destination}` };
  });
}

export async function addShipmentUpdate(shipmentId: string, text: string) {
  return run(async () => {
    const user = await assertRole(ACCESS.transport);
    const note = text.trim().slice(0, 300);
    if (note.length < 3) throw new Error("Type the update first");
    const shipment = await getShipment(shipmentId);
    if (!shipment) throw new Error("Shipment not found");
    await db().collection("shipments").doc(shipment.id).update({
      updates: FieldValue.arrayUnion({ at: new Date().toISOString(), text: note, by: user.name }),
    });
    await writeAudit(user, "transport-update", "shipment", shipment.orderNo, note);
    revalidatePath("/admin/transport");
    return { message: "Update added" };
  });
}

export async function markDelivered(shipmentId: string) {
  return run(async () => {
    const user = await assertRole(ACCESS.transport);
    const shipment = await getShipment(shipmentId);
    if (!shipment || shipment.status === "delivered") throw new Error("This shipment is not on the road");
    const now = new Date().toISOString();
    await db().collection("shipments").doc(shipment.id).update({
      status: "delivered",
      deliveredAt: now,
      demoCycleSeconds: null,
      updates: FieldValue.arrayUnion({ at: now, text: "Delivered and unloaded at the customer.", by: user.name }),
    });
    await writeAudit(user, "delivered", "shipment", shipment.orderNo, shipment.vehicleNo);
    const text = `*Order ${shipment.orderNo} delivered* ✅\n${shipment.meters.toLocaleString("en-IN")} m ${shipment.fabricType} reached ${shipment.customerName}.`;
    await sendToOwners(text, "delivered");
    if (shipment.clientPhone) await sendToClient(shipment.clientPhone.replace(/\D/g, ""), text, "delivered");
    revalidatePath("/admin", "layout");
    return { message: `${shipment.orderNo} marked as delivered` };
  });
}
