import { describe, expect, it } from "vitest";
import { maxOrderMeters, nextStockStep, normalizeTrackingId, stockAdvice, trackingIdFrom } from "./stock";
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

  it("counts what is already on its way from suppliers", () => {
    const onWay = (quantity: number, status: "ordered" | "received" | "cancelled" = "ordered") =>
      stockAdvice([material({ stock: 150 })], orders, batches, [{ materialId: "m", quantity, status }])[0]!;
    expect(onWay(400)).toMatchObject({ level: "low", onOrder: 400, orderQty: 250 });
    expect(onWay(700)).toMatchObject({ level: "low", onOrder: 700, orderQty: 0 });
    expect(onWay(700, "received")).toMatchObject({ onOrder: 0, orderQty: 650 });
    expect(onWay(700, "cancelled")).toMatchObject({ onOrder: 0, orderQty: 650 });
  });

  it("lists the most urgent first", () => {
    const list = stockAdvice(
      [material({ id: "a", name: "A", stock: 900 }), material({ id: "b", name: "B", stock: 0 }), material({ id: "c", name: "C", stock: 100 })],
      orders, batches,
    );
    expect(list.map((x) => x.material.name)).toEqual(["B", "C", "A"]);
  });
});

describe("largest order the stock allows", () => {
  // Open cotton balance: 6,000 m running + 50,000 m requested = 56,000 m. Silk: 2,000 m.
  const max = (fabric: string, materials: Material[]) => maxOrderMeters(fabric, materials, orders, batches);

  it("has no limit when no material is listed for the fabric", () => {
    expect(max("polyester", [material({})])).toBeNull();
    expect(max("cotton", [material({ usePerMeter: 0 })])).toBeNull();
  });

  it("is the free stock after open and requested orders", () => {
    expect(max("cotton", [material({ stock: 6_000 })])).toBe(4_000);
    expect(max("cotton", [material({ stock: 5_000 })])).toBe(0);
  });

  it("takes the tightest material, counting ones every fabric uses", () => {
    const sizing = material({ id: "s", name: "Sizing", fabricType: null, stock: 600, usePerMeter: 0.01 });
    expect(max("silk", [material({ fabricType: "silk", stock: 1_000 }), sizing])).toBe(2_000);
  });
});

describe("stock order tracking", () => {
  it("moves through the stages and stops at received or cancelled", () => {
    expect(nextStockStep("ordered")?.status).toBe("confirmed");
    expect(nextStockStep("confirmed")?.status).toBe("dispatched");
    expect(nextStockStep("dispatched")?.status).toBe("received");
    expect(nextStockStep("received")).toBeNull();
    expect(nextStockStep("cancelled")).toBeNull();
  });

  it("makes tracking IDs that are easy to read out", () => {
    expect(trackingIdFrom(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]))).toBe("TRK-ABCDEFGH");
    expect(trackingIdFrom(new Uint8Array([255, 254, 31, 32, 8, 9, 30, 29]))).toMatch(/^TRK-[A-HJ-NP-Z2-9]{8}$/);
  });

  it("tidies a typed tracking ID", () => {
    expect(normalizeTrackingId(" trk 7f3k-9q2a ")).toBe("TRK-7F3K9Q2A");
    expect(normalizeTrackingId("7F3K9Q2A")).toBe("TRK-7F3K9Q2A");
  });
});
