import type { Material, StockOrder, StockOrderStatus } from "@/lib/types";

export const STOCK_FABRICS = ["cotton", "polyester", "blend", "silk"];

export type StockLevel = "out" | "low" | "short" | "ok";

export interface StockAdvice {
  material: Material;
  /** Quantity the open orders still need. */
  needed: number;
  level: StockLevel;
  /** Quantity already bought from suppliers and not yet in the store. */
  onOrder: number;
  /** Quantity still to buy to cover the open orders and stay above the reorder level; 0 if none. */
  orderQty: number;
}

interface OrderLike {
  id: string;
  fabricType: string;
  meters: number;
  status: string;
}
interface BatchLike {
  orderId: string;
  producedMeters: number;
}

const URGENCY: Record<StockLevel, number> = { out: 0, low: 1, short: 2, ok: 3 };

/** The stages a stock order moves through. `action` is the button that moves it into that stage. */
export const STOCK_ORDER_STEPS: { status: StockOrderStatus; label: string; action: string }[] = [
  { status: "ordered", label: "Order placed", action: "" },
  { status: "confirmed", label: "Supplier confirmed", action: "Supplier has confirmed" },
  { status: "dispatched", label: "On the way", action: "Supplier has dispatched" },
  { status: "received", label: "Received at the mill", action: "Received – add to stock" },
];

export const STOCK_ORDER_LABEL: Record<StockOrderStatus, string> = {
  ...(Object.fromEntries(STOCK_ORDER_STEPS.map((s) => [s.status, s.label])) as Record<Exclude<StockOrderStatus, "cancelled">, string>),
  cancelled: "Cancelled",
};

/** The stage after this one, or null when the order is received or cancelled. */
export function nextStockStep(status: StockOrderStatus) {
  const i = STOCK_ORDER_STEPS.findIndex((s) => s.status === status);
  return i >= 0 && i < STOCK_ORDER_STEPS.length - 1 ? STOCK_ORDER_STEPS[i + 1]! : null;
}

export function isOpenStockOrder(order: Pick<StockOrder, "status">): boolean {
  return order.status !== "received" && order.status !== "cancelled";
}

// No 0, 1, I or O, so an ID read out over the phone is not mistaken.
const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A tracking ID such as TRK-7F3K9Q2A from eight random bytes. */
export function trackingIdFrom(bytes: Uint8Array): string {
  return `TRK-${Array.from(bytes.slice(0, 8), (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("")}`;
}

/** Tidies a typed tracking ID: "trk 7f3k-9q2a" becomes "TRK-7F3K9Q2A". */
export function normalizeTrackingId(typed: string): string {
  const code = typed.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^TRK/, "");
  return `TRK-${code}`;
}

/**
 * For each material: how much the confirmed and running orders still need, and how much to
 * order so that work can finish with the reorder level still in the store, after counting what
 * is already on its way from suppliers. Most urgent first.
 */
export function stockAdvice(
  materials: Material[],
  orders: OrderLike[],
  batches: BatchLike[],
  stockOrders: Pick<StockOrder, "materialId" | "quantity" | "status">[] = [],
): StockAdvice[] {
  const balanceByFabric = new Map<string, number>();
  for (const o of orders) {
    if (o.status !== "confirmed" && o.status !== "in_production") continue;
    const produced = batches.filter((b) => b.orderId === o.id).reduce((sum, b) => sum + b.producedMeters, 0);
    const fabric = o.fabricType.toLowerCase();
    balanceByFabric.set(fabric, (balanceByFabric.get(fabric) ?? 0) + Math.max(0, o.meters - produced));
  }
  const allMeters = [...balanceByFabric.values()].reduce((a, b) => a + b, 0);

  return materials
    .map((material) => {
      const meters = material.fabricType ? (balanceByFabric.get(material.fabricType.toLowerCase()) ?? 0) : allMeters;
      const needed = Math.ceil(meters * material.usePerMeter);
      const onOrder = stockOrders.filter((s) => s.materialId === material.id && isOpenStockOrder(s)).reduce((sum, s) => sum + s.quantity, 0);
      // The gap is judged on stock in hand; what is on its way only reduces how much more to buy.
      const gap = needed + material.minStock - material.stock;
      const orderQty = Math.max(0, Math.ceil(gap - onOrder));
      const level: StockLevel =
        material.stock <= 0 ? "out" : material.stock < material.minStock ? "low" : gap > 0 ? "short" : "ok";
      return { material, needed, level, onOrder, orderQty };
    })
    .sort((a, b) => URGENCY[a.level] - URGENCY[b.level] || a.material.name.localeCompare(b.material.name));
}

/** Smallest order the portal accepts. */
export const MIN_ORDER_METERS = 100;

/**
 * The largest new order the store room can supply for a fabric, in meters: what is in stock
 * less what every requested, confirmed and running order still needs. Null means no listed
 * material limits that fabric.
 */
export function maxOrderMeters(fabricType: string, materials: Material[], orders: OrderLike[], batches: BatchLike[]): number | null {
  const fabric = fabricType.toLowerCase();
  const committed = new Map<string, number>();
  for (const o of orders) {
    if (o.status !== "requested" && o.status !== "confirmed" && o.status !== "in_production") continue;
    const produced = batches.filter((b) => b.orderId === o.id).reduce((sum, b) => sum + b.producedMeters, 0);
    const key = o.fabricType.toLowerCase();
    committed.set(key, (committed.get(key) ?? 0) + Math.max(0, o.meters - produced));
  }
  const allCommitted = [...committed.values()].reduce((a, b) => a + b, 0);

  let max: number | null = null;
  for (const m of materials) {
    if (m.usePerMeter <= 0) continue;
    const own = m.fabricType?.toLowerCase() ?? null;
    if (own && own !== fabric) continue;
    const free = m.stock - (own ? (committed.get(fabric) ?? 0) : allCommitted) * m.usePerMeter;
    const meters = Math.max(0, Math.floor(free / m.usePerMeter));
    max = max === null ? meters : Math.min(max, meters);
  }
  return max;
}
