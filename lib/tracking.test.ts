import { describe, expect, it } from "vitest";
import { orderEvents, trackOrder } from "./tracking";
import type { Batch, Order } from "./types";

const order = (o: Partial<Order> = {}): Order => ({
  id: "ORD-1", orderNo: "ORD-1", customerName: "Test", fabricType: "cotton", widthInches: 60, meters: 1000,
  deadline: "2026-11-01", status: "requested", ratePerMeterPaise: 0, requestedAt: "2026-10-10T05:00:00.000Z", ...o,
});
const batch = (b: Partial<Batch> = {}): Batch => ({
  id: "B-1", batchNo: "B-1", orderId: "ORD-1", orderNo: "ORD-1", fabricType: "cotton", widthInches: 60, meters: 1000,
  producedMeters: 0, status: "pending", machineIds: [], startDate: null, endDate: null, hoursPerDay: null, planId: null,
  materialCostPaise: 0, labourCostPaise: 0, overheadCostPaise: 0, powerCostPaise: 0, ...b,
});
const current = (t: ReturnType<typeof trackOrder>) => t.current?.key ?? null;

describe("order tracking", () => {
  it("waits for confirmation after the order is placed", () => {
    const t = trackOrder(order({ confirmMode: "prepaid" }), null, [], null);
    expect(current(t)).toBe("confirmed");
    expect(t.current!.detail).toContain("advance payment");
    expect(t.stages[0]!.state).toBe("done");
  });

  it("shows weaving progress", () => {
    const t = trackOrder(order({ status: "in_production" }), batch({ status: "in_progress", producedMeters: 400, machineIds: ["M-01", "M-02"] }), [], null);
    expect(current(t)).toBe("production");
    expect(t.current!.detail).toBe("40% woven on 2 looms.");
  });

  it("moves to quality check when weaving is finished", () => {
    const t = trackOrder(order({ status: "completed" }), batch({ status: "completed", producedMeters: 1000 }), [{ status: "pass" }, { status: "pending" }], null);
    expect(current(t)).toBe("quality");
    expect(t.current!.detail).toBe("1 of 2 bundles checked, 1 passed.");
  });

  it("is on the way once a truck has left, and finished when delivered", () => {
    const b = batch({ status: "completed", producedMeters: 1000 });
    const onRoad = trackOrder(order({ status: "completed" }), b, [], { status: "in_transit", vehicleNo: "TN 33 AB 1" });
    expect(current(onRoad)).toBe("dispatched");
    expect(onRoad.current!.detail).toBe("On truck TN 33 AB 1.");
    const done = trackOrder(order({ status: "completed" }), b, [], { status: "delivered", vehicleNo: "TN 33 AB 1" });
    expect(done.current).toBeNull();
    expect(done.progressPercent).toBe(100);
  });

  it("marks a declined order", () => {
    const t = trackOrder(order({ status: "rejected" }), null, [], null);
    expect(t.declined).toBe(true);
    expect(t.current).toBeNull();
  });

  it("lists events newest first", () => {
    const events = orderEvents(
      order({ paidAt: "2026-10-10T06:00:00.000Z" }),
      null,
      [],
      { updates: [{ at: "2026-10-12T04:00:00.000Z", text: "Truck left the mill.", by: "Transport" }] },
    );
    expect(events.map((e) => e.title)).toEqual(["Transport update", "Advance payment received", "Order placed"]);
  });
});
