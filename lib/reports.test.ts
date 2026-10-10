import { describe, expect, it } from "vitest";
import { electricityAlerts } from "./reports";
import type { DailyStats } from "./types";

const day = (overrides: Partial<DailyStats>): DailyStats => ({
  date: "2026-10-10", totalMachines: 50, machinesRunning: 34, utilizationPercent: 68,
  outputMeters: 5_000, runningHours: 500, breakdownHours: 0, units: 2_000, costPaise: 1_600_000,
  costPerMeterPaise: 320, peakUnits: null, offPeakUnits: null, estimated: false,
  ...overrides,
});

describe("electricity alerts", () => {
  it("stays quiet on a normal day", () => {
    expect(electricityAlerts({ today: day({}), yesterday: null, avgCostPerMeterPaise: 310 })).toEqual([]);
  });

  it("flags utilization below 60%", () => {
    const alerts = electricityAlerts({
      today: day({ machinesRunning: 25, utilizationPercent: 50 }),
      yesterday: null,
      avgCostPerMeterPaise: 310,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain("25 of 50");
  });

  it("flags cost per meter more than 15% above the 30-day average", () => {
    const at15 = electricityAlerts({ today: day({ costPerMeterPaise: 345 }), yesterday: null, avgCostPerMeterPaise: 300 });
    const above = electricityAlerts({ today: day({ costPerMeterPaise: 360 }), yesterday: null, avgCostPerMeterPaise: 300 });
    expect(at15).toEqual([]);
    expect(above[0]).toContain("20% above");
  });

  it("ignores days with no production", () => {
    expect(
      electricityAlerts({ today: day({ runningHours: 0, utilizationPercent: 0 }), yesterday: null, avgCostPerMeterPaise: 300 }),
    ).toEqual([]);
  });
});
