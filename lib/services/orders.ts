import { db } from "@/lib/firebase/admin";

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
