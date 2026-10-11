import { db } from "@/lib/firebase/admin";
import type { Shipment } from "@/lib/types";

export async function getShipments(): Promise<Shipment[]> {
  const snap = await db().collection("shipments").get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Shipment)
    .sort((a, b) => b.dispatchedAt.localeCompare(a.dispatchedAt));
}

export async function getShipment(id: string): Promise<Shipment | null> {
  const snap = await db().collection("shipments").doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as Shipment) : null;
}

/** Three demo shipments: two on the road (replayed in a loop) and one delivered. */
export function sampleShipments(nowMs: number): Shipment[] {
  const iso = (hoursAgo: number) => new Date(nowMs - hoursAgo * 3_600_000).toISOString();
  return [
    {
      id: "ORD-1001", orderNo: "ORD-1001", customerName: "Sri Lakshmi Textiles", clientPhone: null,
      meters: 38_000, fabricType: "cotton", routeId: "chennai", vehicleNo: "TN 33 AB 4821", driverName: "Murugan", driverId: "W-001", tripPayPaise: 350_000,
      status: "in_transit", dispatchedAt: iso(14), deliveredAt: null, sample: true, demoCycleSeconds: 300,
      updates: [
        { at: iso(15), text: "380 bundles loaded and sealed at the mill.", by: "Transport" },
        { at: iso(14), text: "Truck left the mill for Chennai.", by: "Transport" },
        { at: iso(9), text: "Driver rest stop near Salem. All good.", by: "Murugan (driver)" },
      ],
    },
    {
      id: "ORD-1002", orderNo: "ORD-1002", customerName: "Kovai Fabrics", clientPhone: null,
      meters: 26_000, fabricType: "polyester", routeId: "coimbatore", vehicleNo: "TN 37 CK 1907", driverName: "Selvam", driverId: "W-002", tripPayPaise: 120_000,
      status: "in_transit", dispatchedAt: iso(1.5), deliveredAt: null, sample: true, demoCycleSeconds: 180,
      updates: [
        { at: iso(2), text: "260 bundles loaded. Weighbridge slip attached to the invoice.", by: "Transport" },
        { at: iso(1.5), text: "Truck left the mill for Coimbatore.", by: "Transport" },
      ],
    },
    {
      id: "ORD-0998", orderNo: "ORD-0998", customerName: "Meenakshi Weaves", clientPhone: null,
      meters: 12_000, fabricType: "cotton", routeId: "madurai", vehicleNo: "TN 33 AB 4821", driverName: "Murugan", driverId: "W-001", tripPayPaise: 180_000,
      status: "delivered", dispatchedAt: iso(54), deliveredAt: iso(46), sample: true, demoCycleSeconds: null,
      updates: [
        { at: iso(54), text: "Truck left the mill for Madurai.", by: "Transport" },
        { at: iso(46), text: "Delivered and unloaded. Receipt signed by the customer.", by: "Murugan (driver)" },
      ],
    },
  ];
}
