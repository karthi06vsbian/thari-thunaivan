import { describe, expect, it } from "vitest";
import { projectFinishDate } from "@/lib/planning/risk";
import type { Machine, ShiftSettings } from "@/lib/planning/types";
import { batchCosting, splitEnergyAcrossLogs } from "./power";

describe("batch power cost", () => {
  it("splits a machine's daily energy across batches by running hours", () => {
    const shares = splitEnergyAcrossLogs(
      [
        { logId: "day", machineId: "M-01", runningHours: 6 },
        { logId: "evening", machineId: "M-01", runningHours: 2 },
        { logId: "other", machineId: "M-02", runningHours: 8 },
      ],
      [
        { machineId: "M-01", units: 40, costPaise: 32_000 },
        { machineId: "M-02", units: 30, costPaise: 24_000 },
      ],
    );
    expect(shares.get("day")).toEqual({ units: 30, costPaise: 24_000 });
    expect(shares.get("evening")).toEqual({ units: 10, costPaise: 8_000 });
    expect(shares.get("other")).toEqual({ units: 30, costPaise: 24_000 });
  });

  it("gives nothing to a log with no running hours", () => {
    const shares = splitEnergyAcrossLogs(
      [{ logId: "a", machineId: "M-01", runningHours: 0 }],
      [{ machineId: "M-01", units: 0, costPaise: 0 }],
    );
    expect(shares.get("a")).toEqual({ units: 0, costPaise: 0 });
  });

  it("feeds power cost into cost per meter and profit", () => {
    const costing = batchCosting(
      {
        meters: 1_000,
        producedMeters: 1_000,
        materialCostPaise: 4_800_000,
        labourCostPaise: 900_000,
        overheadCostPaise: 400_000,
        powerCostPaise: 260_000,
      },
      9_200,
    );
    expect(costing.costPerMeterPaise).toBe(6_360);
    expect(costing.profitPaise).toBe(9_200_000 - 6_360_000);
  });
});

describe("order at risk", () => {
  const settings: ShiftSettings = {
    shifts: [{ name: "Day", start: "06:00", end: "14:00", hours: 8 }],
    workingDays: [1, 2, 3, 4, 5, 6],
    holidays: [],
  };
  const machine = (status: Machine["status"]): Machine => ({
    id: "M-01", machineNo: "M-01", name: "Loom", type: "loom", supportedFabricTypes: ["cotton"],
    maxWidthInches: 63, ratedOutputPerHour: 10, efficiencyPercent: 100, powerKw: 5, loadFactor: 0.75,
    status, active: true,
  });

  it("projects the finish date from the machines still working", () => {
    // 160 m/day from Monday 12 Oct 2026; 400 m needs 3 days.
    expect(projectFinishDate(400, [machine("running")], 16, "2026-10-12", settings)).toBe("2026-10-14");
  });

  it("has no finish date when every machine is down", () => {
    expect(projectFinishDate(400, [machine("breakdown")], 16, "2026-10-12", settings)).toBeNull();
  });
});
