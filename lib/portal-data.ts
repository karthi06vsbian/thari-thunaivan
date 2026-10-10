import { db } from "@/lib/firebase/admin";
import type { Batch, Bundle, Order, Shipment } from "@/lib/types";

export interface ClientOrder {
  order: Order;
  batch: Batch | null;
  bundles: Bundle[];
  shipment: Shipment | null;
}

/** Everything the tracker needs for one order. */
async function withTracking(order: Order): Promise<ClientOrder> {
  const [batchSnap, shipmentSnap] = await Promise.all([
    db().collection("batches").where("orderId", "==", order.id).limit(1).get(),
    db().collection("shipments").doc(order.orderNo).get(),
  ]);
  const batchDoc = batchSnap.docs[0];
  const batch = batchDoc ? ({ id: batchDoc.id, ...batchDoc.data() } as Batch) : null;
  const bundleSnap = batch ? await db().collection("bundles").where("batchId", "==", batch.id).get() : null;
  return {
    order,
    batch,
    bundles: (bundleSnap?.docs ?? [])
      .map((d) => ({ id: d.id, ...d.data() }) as Bundle)
      .sort((a, b) => a.bundleNo.localeCompare(b.bundleNo)),
    shipment: shipmentSnap.exists ? ({ id: shipmentSnap.id, ...shipmentSnap.data() } as Shipment) : null,
  };
}

/** Only ever returns orders that belong to this client. */
export async function getClientOrders(clientUid: string): Promise<ClientOrder[]> {
  const snap = await db().collection("orders").where("clientUid", "==", clientUid).get();
  const orders = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Order)
    .sort((a, b) => (b.requestedAt ?? "").localeCompare(a.requestedAt ?? ""));
  return Promise.all(orders.map(withTracking));
}

export async function getClientOrder(clientUid: string, orderId: string): Promise<ClientOrder | null> {
  const snap = await db().collection("orders").doc(orderId).get();
  if (!snap.exists) return null;
  const order = { id: snap.id, ...snap.data() } as Order;
  return order.clientUid === clientUid ? withTracking(order) : null;
}
