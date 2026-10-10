"use server";

import { revalidatePath } from "next/cache";
import { run } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { ACCESS, assertRole } from "@/lib/auth/session";
import { getOrder } from "@/lib/data";
import { db } from "@/lib/firebase/admin";
import { rupeesToPaise } from "@/lib/money";
import { batchNoFor } from "@/lib/services/orders";
import type { Batch } from "@/lib/types";

/** Accepts a client's request at the given price and creates its batch, ready for Planning. */
export async function acceptOrder(orderId: string, ratePerMeterRupees: number) {
  return run(async () => {
    const user = await assertRole(ACCESS.planning);
    if (!Number.isFinite(ratePerMeterRupees) || ratePerMeterRupees <= 0 || ratePerMeterRupees > 100_000) {
      throw new Error("Enter the price per meter");
    }
    const order = await getOrder(orderId);
    if (!order || order.status !== "requested") throw new Error("This request has already been handled");

    const batchNo = batchNoFor(order.orderNo);
    // Material, labour and overhead costs are entered later; there is no screen for them yet.
    const batch: Omit<Batch, "id"> = {
      batchNo, orderId: order.id, orderNo: order.orderNo,
      fabricType: order.fabricType, widthInches: order.widthInches,
      meters: order.meters, producedMeters: 0, status: "pending",
      machineIds: [], startDate: null, endDate: null, hoursPerDay: null, planId: null,
      materialCostPaise: 0, labourCostPaise: 0, overheadCostPaise: 0, powerCostPaise: 0,
    };
    const write = db().batch();
    write.update(db().collection("orders").doc(order.id), {
      status: "confirmed",
      ratePerMeterPaise: rupeesToPaise(ratePerMeterRupees),
    });
    write.set(db().collection("batches").doc(batchNo), batch);
    await write.commit();
    await writeAudit(user, "accept-order", "order", order.orderNo, `₹${ratePerMeterRupees}/m, batch ${batchNo}`);
    revalidatePath("/admin", "layout");
    revalidatePath("/portal");
    return { message: `${order.orderNo} accepted. Plan it from the Planning page.` };
  });
}

export async function rejectOrder(orderId: string) {
  return run(async () => {
    const user = await assertRole(ACCESS.planning);
    const order = await getOrder(orderId);
    if (!order || order.status !== "requested") throw new Error("This request has already been handled");
    await db().collection("orders").doc(order.id).update({ status: "rejected" });
    await writeAudit(user, "decline-order", "order", order.orderNo);
    revalidatePath("/admin", "layout");
    revalidatePath("/portal");
    return { message: `${order.orderNo} declined` };
  });
}
