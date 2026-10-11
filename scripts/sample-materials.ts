import { addDays } from "@/lib/dates";
import type { Material, StockOrder, StockOrderStatus } from "@/lib/types";

// Raw materials: some low on purpose so the stock box has something to recommend.
const MATERIALS: [string, string, string | null, number, number, number][] = [
  ["Cotton yarn 40s", "kg", "cotton", 6_500, 2_000, 0.14],
  ["Polyester yarn 150D", "kg", "polyester", 3_200, 1_000, 0.11],
  ["Blended yarn PC 45s", "kg", "blend", 600, 800, 0.12],
  ["Silk yarn 20/22D", "kg", "silk", 0, 150, 0.08],
  ["Sizing chemical", "kg", null, 900, 300, 0.008],
  ["Packing rolls", "rolls", null, 120, 100, 0.001],
];

export function sampleMaterials(updatedBy: string): Material[] {
  const updatedAt = new Date().toISOString();
  return MATERIALS.map(([name, unit, fabricType, stock, minStock, usePerMeter]) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name, unit, fabricType, stock, minStock, usePerMeter, updatedAt, updatedBy,
  }));
}

// Made-up purchases: [tracking ID, material, quantity, supplier, rate in rupees, stage, days since ordered, days until expected].
const STOCK_ORDERS: [string, string, number, string, number, StockOrderStatus, number, number][] = [
  ["TRK-SLK7Q2MD", "Silk yarn 20/22D", 630, "Kanchi Silk Traders", 4_200, "dispatched", 3, 1],
  ["TRK-BLD4X8KP", "Blended yarn PC 45s", 1_400, "Erode Yarn Syndicate", 245, "confirmed", 1, 4],
  ["TRK-CTN9H3WT", "Cotton yarn 40s", 2_000, "Sri Venkateswara Spinning Mills", 310, "ordered", 0, 5],
  // Past its expected date, to show a late delivery.
  ["TRK-PKR5T8NC", "Packing rolls", 100, "Tiruppur Packaging Co", 180, "dispatched", 6, -1],
  ["TRK-SZG2M6RB", "Sizing chemical", 500, "Salem Chem Supplies", 95, "received", 10, -6],
];
const STAGES: StockOrderStatus[] = ["ordered", "confirmed", "dispatched", "received"];
const STAGE_NOTE: Partial<Record<StockOrderStatus, string>> = {
  confirmed: "Supplier confirmed the rate and quantity by phone.",
  dispatched: "Loaded at the supplier's godown. Lorry receipt shared on WhatsApp.",
  received: "Weighed and checked at the gate. Quantity matches the invoice.",
};

/** Five sample stock orders at different stages. The received one is history only: stock is not changed. */
export function sampleStockOrders(today: string, by: string): StockOrder[] {
  const materials = sampleMaterials(by);
  return STOCK_ORDERS.map(([trackingId, materialName, quantity, supplier, rupees, status, daysAgo, dueIn]) => {
    const material = materials.find((m) => m.name === materialName)!;
    const reached = STAGES.slice(0, STAGES.indexOf(status) + 1);
    // Stages are spread evenly between the order date and today (or the delivery date).
    const lastDay = status === "received" ? daysAgo + dueIn : daysAgo;
    const now = new Date().toISOString();
    const events = reached.map((stage, i) => {
      // Early morning at the mill, and never later than the moment the data is loaded.
      const at = `${addDays(today, -daysAgo + Math.round((lastDay * i) / Math.max(1, reached.length - 1)))}T0${i}:30:00.000Z`;
      return { status: stage, at: at < now ? at : now, by, note: STAGE_NOTE[stage] ?? "" };
    });
    return {
      id: trackingId, trackingId, materialId: material.id, materialName, unit: material.unit, quantity, supplier,
      ratePaise: rupees * 100, expectedOn: addDays(today, dueIn), status,
      orderedAt: events[0]!.at, orderedBy: by, receivedAt: status === "received" ? events.at(-1)!.at : null, events,
    };
  });
}
