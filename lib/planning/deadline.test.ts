import { describe, expect, it } from "vitest";
import { deadlineAlerts } from "./deadline";
import type { Machine, ShiftSettings } from "./types";

const settings: ShiftSettings = {
  shifts: [{ name: "Day", start: "06:00", end: "14:00", hours: 8 }],
  workingDays: [0, 1, 2, 3, 4, 5, 6],
  holidays: [],
};
// 10 m an hour at 100% efficiency: 100 m in a 10-hour day.
const machine = (id: string, status: Machine["status"] = "running"): Machine => ({
  id, machineNo: id, name: id, type: "loom", supportedFabricTypes: ["cotton"], maxWidthInches: 63,
  ratedOutputPerHour: 10, efficiencyPercent: 100, powerKw: 5, loadFactor: 0.75, status, active: true,
});
const order = (deadline: string, status = "in_production") => ({ id: "O1", orderNo: "ORD-1", customerName: "Kovai Fabrics", meters: 1_000, deadline, status });
const batch = (producedMeters: number, status = "in_progress") => ({ orderId: "O1", status, producedMeters, machineIds: ["M1"], hoursPerDay: 10 });
const TODAY = "2026-10-11";
const run = (o: ReturnType<typeof order>, b: ReturnType<typeof batch>[], machines = [machine("M1")], within = 7) =>
  deadlineAlerts([o], b, machines, settings, TODAY, within);

describe("deadline alerts", () => {
  it("shows the balance and the meters needed each day", () => {
    const [a] = run(order("2026-10-14"), [batch(400)]);
    expect(a).toMatchObject({ balanceMeters: 600, daysLeft: 3, workingDaysLeft: 4, neededPerDay: 150, currentPerDay: 100 });
    expect(a!.level).toBe("late");
    expect(a!.projectedFinish).toBe("2026-10-16");
  });

  it("is on track when the current rate finishes in time", () => {
    expect(run(order("2026-10-14"), [batch(700)])[0]!.level).toBe("on_track");
  });

  it("leaves out far-off orders unless they will be late", () => {
    expect(run(order("2026-10-30"), [batch(400)])).toEqual([]);
    expect(run(order("2026-10-30"), [batch(400)], [machine("M1", "breakdown")])[0]!.level).toBe("late");
  });

  it("flags overdue orders and ones not yet on a loom", () => {
    expect(run(order("2026-10-09"), [batch(400)])[0]).toMatchObject({ level: "overdue", daysLeft: -2 });
    expect(run(order("2026-10-14", "confirmed"), [batch(0, "planned")])[0]).toMatchObject({ level: "not_started", balanceMeters: 1_000 });
  });

  it("ignores finished and unconfirmed orders", () => {
    expect(run(order("2026-10-12"), [batch(1_000)])).toEqual([]);
    expect(run(order("2026-10-12", "completed"), [batch(400)])).toEqual([]);
    expect(run(order("2026-10-12", "requested"), [])).toEqual([]);
  });
});
