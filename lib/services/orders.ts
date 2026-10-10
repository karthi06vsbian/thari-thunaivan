import { db } from "@/lib/firebase/admin";
import type { Batch, Order } from "@/lib/types";

const FIRST_ORDER_NUMBER = 1007;

/** Batch number that goes with an order number: ORD-1007 -> B-2007. */
export function batchNoFor(orderNo: string): string {
  return `B-${Number(orderNo.replace(/\D/g, "")) + 1000}`;
}

/** Next order number, e.g. "ORD-1007". */
export async function nextOrderNumbers(): Promise<{ orderNo: string }> {
  const ref = db().collection("counters").doc("orders");
  const n = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = snap.exists ? (snap.data()!.next as number) : FIRST_ORDER_NUMBER;
    tx.set(ref, { next: next + 1 });
    return next;
  });
  return { orderNo: `ORD-${n}` };
}

/** The empty batch that makes a confirmed order show up in Planning. */
export function newBatchFor(order: Order): Omit<Batch, "id"> {
  return {
    batchNo: batchNoFor(order.orderNo), orderId: order.id, orderNo: order.orderNo,
    fabricType: order.fabricType, widthInches: order.widthInches,
    meters: order.meters, producedMeters: 0, status: "pending",
    machineIds: [], startDate: null, endDate: null, hoursPerDay: null, planId: null,
    materialCostPaise: 0, labourCostPaise: 0, overheadCostPaise: 0, powerCostPaise: 0,
  };
}
