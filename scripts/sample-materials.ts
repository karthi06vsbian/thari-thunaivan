import type { Material } from "@/lib/types";

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
