import type { Material } from "@/lib/types";

export const STOCK_FABRICS = ["cotton", "polyester", "blend", "silk"];

export type StockLevel = "out" | "low" | "short" | "ok";

export interface StockAdvice {
  material: Material;
  /** Quantity the open orders still need. */
  needed: number;
  level: StockLevel;
  /** Quantity to buy to cover the open orders and stay above the reorder level; 0 if none. */
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

/**
 * For each material: how much the confirmed and running orders still need, and how much to
 * order so that work can finish with the reorder level still in the store. Most urgent first.
 */
export function stockAdvice(materials: Material[], orders: OrderLike[], batches: BatchLike[]): StockAdvice[] {
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
      const orderQty = Math.max(0, Math.ceil(needed + material.minStock - material.stock));
      const level: StockLevel =
        material.stock <= 0 ? "out" : material.stock < material.minStock ? "low" : orderQty > 0 ? "short" : "ok";
      return { material, needed, level, orderQty };
    })
    .sort((a, b) => URGENCY[a.level] - URGENCY[b.level] || a.material.name.localeCompare(b.material.name));
}
