import { describe, expect, it } from "vitest";
import { stockAdvice } from "./stock";
import type { Material } from "./types";

const material = (overrides: Partial<Material>): Material => ({
  id: "m", name: "Cotton yarn", unit: "kg", fabricType: "cotton", stock: 1_000, minStock: 200, usePerMeter: 0.1,
  updatedAt: "", updatedBy: "", ...overrides,
});
const orders = [
  { id: "O1", fabricType: "cotton", meters: 10_000, status: "in_production" },
  { id: "O2", fabricType: "silk", meters: 2_000, status: "confirmed" },
  { id: "O3", fabricType: "cotton", meters: 50_000, status: "completed" },
  { id: "O4", fabricType: "cotton", meters: 50_000, status: "requested" },
];
const batches = [{ orderId: "O1", producedMeters: 4_000 }];
const advise = (m: Partial<Material>) => stockAdvice([material(m)], orders, batches)[0]!;

describe("stock advice", () => {
  it("needs only the balance of open orders for its fabric", () => {
    expect(advise({}).needed).toBe(600);
    expect(advise({ fabricType: "silk" }).needed).toBe(200);
    expect(advise({ fabricType: null }).needed).toBe(800);
  });

  it("is fine when stock covers the orders and the reorder level", () => {
    expect(advise({ stock: 800 })).toMatchObject({ level: "ok", orderQty: 0 });
  });

  it("recommends enough to finish the orders and keep the reorder level", () => {
    expect(advise({ stock: 500 })).toMatchObject({ level: "short", orderQty: 300 });
    expect(advise({ stock: 150 })).toMatchObject({ level: "low", orderQty: 650 });
    expect(advise({ stock: 0 })).toMatchObject({ level: "out", orderQty: 800 });
  });

  it("lists the most urgent first", () => {
    const list = stockAdvice(
      [material({ id: "a", name: "A", stock: 900 }), material({ id: "b", name: "B", stock: 0 }), material({ id: "c", name: "C", stock: 100 })],
      orders, batches,
    );
    expect(list.map((x) => x.material.name)).toEqual(["B", "C", "A"]);
  });
});
