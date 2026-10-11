import { describe, expect, it } from "vitest";
import {
  effectiveRate,
  machinesNeededEstimate,
  pickGreedy,
  recommendAllocation,
} from "./allocate";
import { workingDaysBetween } from "./calendar";
import { dailyElectricityCost, scaleEnergyToMainMeter } from "./energy";
import type { Machine, PlanContext, PlanInputs, ShiftSettings } from "./types";

const shiftSettings: ShiftSettings = {
  shifts: [
    { name: "Day", start: "06:00", end: "14:00", hours: 8 },
    { name: "Evening", start: "14:00", end: "22:00", hours: 8 },
    { name: "Night", start: "22:00", end: "06:00", hours: 8 },
  ],
  workingDays: [1, 2, 3, 4, 5, 6],
  holidays: [],
};

function machine(n: number, overrides: Partial<Machine> = {}): Machine {
  const no = `M-${String(n).padStart(2, "0")}`;
  return {
    id: no,
    machineNo: no,
    name: `Loom ${n}`,
    type: "loom",
    supportedFabricTypes: ["cotton"],
    maxWidthInches: 63,
    ratedOutputPerHour: 10,
    efficiencyPercent: 100,
    powerKw: 5,
    loadFactor: 0.75,
    status: "idle",
    maintenanceDueAt: null,
    active: true,
    recentBreakdownHours: 0,
    ...overrides,
  };
}

/** 50 looms, speeds 8-15 m/hr and 3-7.5 kW, like the seed data. */
function mill(): Machine[] {
  return Array.from({ length: 50 }, (_, i) =>
    machine(i + 1, {
      ratedOutputPerHour: 8 + (i % 8),
      powerKw: 3 + (i % 10) * 0.5,
      efficiencyPercent: 80 + (i % 5) * 4,
    }),
  );
}

// 2026-10-12 is a Monday.
const inputs: PlanInputs = {
  meters: 10_000,
  fabricType: "cotton",
  widthInches: 60,
  startDate: "2026-10-12",
  deadline: "2026-10-17",
  shiftsPerDay: 2,
  allowOvertime: false,
};

const ctx = (machines: Machine[], extra: Partial<PlanContext> = {}): PlanContext => ({
  machines,
  allocations: [],
  shiftSettings,
  ratePerUnitPaise: 800,
  ...extra,
});

describe("machines needed", () => {
  it("rounds required machine-hours up to whole machines", () => {
    // 10,000 m at 10 m/hr = 1,000 machine-hours; 160 hrs each -> 6.25 -> 7
    expect(machinesNeededEstimate(10_000, 10, 160)).toBe(7);
    expect(machinesNeededEstimate(1_600, 10, 160)).toBe(1);
    expect(machinesNeededEstimate(0, 10, 160)).toBe(0);
  });

  it("matches the estimate when all machines are identical", () => {
    // 6 working days x 16 hrs x 10 m/hr = 960 m per machine -> 11 machines for 10,000 m
    const machines = Array.from({ length: 50 }, (_, i) => machine(i + 1));
    const result = recommendAllocation(inputs, ctx(machines));
    expect(result.recommended.machinesNeeded).toBe(machinesNeededEstimate(10_000, 10, 96));
    expect(result.recommended.machinesNeeded).toBe(11);
    expect(result.recommended.feasible).toBe(true);
    expect(result.totalMachines).toBe(50);
  });

  it("plans a 50-machine mill with power units and cost", () => {
    const result = recommendAllocation(inputs, ctx(mill()));
    const plan = result.recommended;
    expect(plan.feasible).toBe(true);
    expect(plan.machinesNeeded).toBeLessThan(50);
    expect(plan.perMachine.reduce((s, p) => s + p.plannedMeters, 0)).toBeCloseTo(10_000, 0);
    expect(plan.daily.reduce((s, d) => s + d.meters, 0)).toBeCloseTo(10_000, 0);
    expect(plan.estimatedPowerCostPaise).toBe(plan.daily.reduce((s, d) => s + d.costPaise, 0));
    expect(plan.estimatedPowerCostPaise).toBeCloseTo(plan.estimatedUnits * 800, -2);

    const fastest = result.alternatives.find((a) => a.key === "fastest")!;
    const minimum = result.alternatives.find((a) => a.key === "min-machines")!;
    expect(fastest.machinesNeeded).toBe(50);
    expect(fastest.estimatedFinishDate! <= plan.estimatedFinishDate!).toBe(true);
    expect(minimum.machinesNeeded).toBeLessThanOrEqual(plan.machinesNeeded);
    expect(minimum.feasible).toBe(true);
  });
});

describe("greedy selection with mixed speeds", () => {
  it("adds machines until capacity covers the order", () => {
    const machines = [machine(1, { ratedOutputPerHour: 15 }), machine(2), machine(3, { ratedOutputPerHour: 8 })];
    const capacity = (m: Machine) => effectiveRate(m) * 96;
    // 15 + 10 = 25 m/hr x 96 = 2,400 m
    expect(pickGreedy(machines, 2_400, capacity).map((m) => m.id)).toEqual(["M-01", "M-02"]);
    expect(pickGreedy(machines, 2_401, capacity)).toHaveLength(3);
  });

  it("prefers faster, more efficient and more reliable machines", () => {
    const machines = [
      machine(1, { ratedOutputPerHour: 8 }),
      machine(2, { ratedOutputPerHour: 15, recentBreakdownHours: 40 }),
      machine(3, { ratedOutputPerHour: 15 }),
      machine(4, { ratedOutputPerHour: 15, powerKw: 7.5 }),
    ];
    const result = recommendAllocation({ ...inputs, meters: 1_400 }, ctx(machines));
    expect(result.recommended.machineIds).toEqual(["M-03"]);
  });

  it("skips machines that cannot run the order", () => {
    const machines = [
      machine(1, { status: "breakdown" }),
      machine(2, { status: "maintenance" }),
      machine(3, { supportedFabricTypes: ["silk"] }),
      machine(4, { maxWidthInches: 48 }),
      machine(5, { maintenanceDueAt: "2026-10-15" }),
      machine(6, { active: false }),
      machine(7),
    ];
    const result = recommendAllocation({ ...inputs, meters: 500 }, ctx(machines));
    expect(result.eligibleCount).toBe(1);
    expect(result.recommended.machineIds).toEqual(["M-07"]);
  });

  it("never picks a machine that is in another plan", () => {
    const machines = [machine(1), machine(2)];
    const allocations = [
      { machineId: "M-01", batchId: "B-100", startDate: "2026-10-12", endDate: "2026-10-15" },
    ];
    // M-01 would have 2 days left after B-100's dates, but it stays with B-100 until that is completed.
    const result = recommendAllocation({ ...inputs, meters: 900 }, ctx(machines, { allocations }));
    expect(result.recommended.machineIds).toEqual(["M-02"]);
    expect(result.alternatives.every((o) => !o.machineIds.includes("M-01"))).toBe(true);
    expect(result.eligibleCount).toBe(2);
    expect(result.freeCount).toBe(1);
    expect(result.held).toEqual([{ batchId: "B-100", machines: 1, endDate: "2026-10-15" }]);
  });

  it("keeps a machine locked even when the other plan's dates do not overlap", () => {
    const machines = [machine(1), machine(2)];
    const before = [{ machineId: "M-01", batchId: "B-100", startDate: "2026-10-01", endDate: "2026-10-08" }];
    const after = [{ machineId: "M-01", batchId: "B-101", startDate: "2026-11-02", endDate: "2026-11-10" }];
    for (const allocations of [before, after]) {
      const result = recommendAllocation({ ...inputs, meters: 900 }, ctx(machines, { allocations }));
      expect(result.recommended.machineIds).toEqual(["M-02"]);
    }
  });

  it("offers the machine again once the other batch is completed", () => {
    // A completed batch is no longer in the allocations.
    const result = recommendAllocation({ ...inputs, meters: 1_200 }, ctx([machine(1), machine(2)]));
    expect(result.recommended.machineIds).toEqual(["M-01", "M-02"]);
    expect(result.held).toEqual([]);
  });
});

describe("impossible deadline", () => {
  it("reports the shortfall and the earliest possible date", () => {
    const machines = [machine(1), machine(2)];
    const allocations = [
      { machineId: "M-02", batchId: "B-200", startDate: "2026-10-12", endDate: "2026-10-14" },
    ];
    // M-02 is in B-200's plan, so only M-01 can be used: 960 m of 3,000 m by the deadline.
    const result = recommendAllocation({ ...inputs, meters: 3_000 }, ctx(machines, { allocations }));
    expect(result.recommended.feasible).toBe(false);
    expect(result.recommended.machineIds).toEqual(["M-01"]);
    expect(result.shortfallMeters).toBe(2_040);
    // 160 m a day, six days a week: 3,000 m takes 19 working days -> Monday 2 November
    expect(result.earliestPossibleDate).toBe("2026-11-02");
    expect(result.warnings.some((w) => w.includes("B-200") && w.includes("completed"))).toBe(true);
  });

  it("recommends overtime when that is the only way to meet the deadline", () => {
    const machines = [machine(1)];
    // 960 m without overtime, 1,200 m with 4 extra hours a day
    const result = recommendAllocation(
      { ...inputs, meters: 1_100, allowOvertime: true },
      ctx(machines),
    );
    expect(result.recommended.key).toBe("overtime");
    expect(result.recommended.feasible).toBe(true);
    expect(result.recommended.hoursPerDay).toBe(20);
    expect(result.shortfallMeters).toBe(0);
  });
});

describe("holidays", () => {
  it("excludes weekly offs and holidays from working days", () => {
    const settings = { ...shiftSettings, holidays: ["2026-10-14"] };
    // Mon 12th to Sun 18th: Sunday off, Wednesday holiday
    expect(workingDaysBetween("2026-10-12", "2026-10-18", settings)).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
    ]);
  });

  it("needs more machines when a holiday falls before the deadline", () => {
    const machines = Array.from({ length: 50 }, (_, i) => machine(i + 1));
    const withHoliday = ctx(machines, {
      shiftSettings: { ...shiftSettings, holidays: ["2026-10-14"] },
    });
    // 5 days x 16 hrs x 10 m/hr = 800 m per machine -> 13 machines
    const plan = recommendAllocation(inputs, withHoliday).recommended;
    expect(plan.machinesNeeded).toBe(13);
    expect(plan.daily.map((d) => d.date)).not.toContain("2026-10-14");
  });
});

describe("electricity", () => {
  it("scales estimates down to the main meter", () => {
    const result = scaleEnergyToMainMeter(
      [
        { machineId: "M-01", units: 60, measured: false },
        { machineId: "M-02", units: 40, measured: false },
        { machineId: "M-03", units: 20, measured: true },
      ],
      100,
      800,
    );
    // 20 measured stays; 100 estimated is squeezed into the remaining 80
    expect(result.machines.map((m) => m.units)).toEqual([48, 32, 20]);
    expect(result.commonLoadUnits).toBe(0);
    expect(result.machines[0]!.costPaise).toBe(38_400);
  });

  it("books the remainder as common load when the meter reads higher", () => {
    const result = scaleEnergyToMainMeter(
      [
        { machineId: "M-01", units: 60, measured: false },
        { machineId: "M-02", units: 40, measured: false },
      ],
      130,
      800,
    );
    expect(result.scaleFactor).toBe(1);
    expect(result.commonLoadUnits).toBe(30);
    expect(result.commonLoadCostPaise).toBe(24_000);
  });

  it("costs a day's reading with peak and off-peak rates", () => {
    expect(
      dailyElectricityCost({ mainMeterStartKwh: 1_000, mainMeterEndKwh: 1_500, ratePerUnitPaise: 800 }),
    ).toEqual({ unitsConsumed: 500, totalCostPaise: 400_000 });
    expect(
      dailyElectricityCost({
        mainMeterStartKwh: 1_000,
        mainMeterEndKwh: 1_500,
        ratePerUnitPaise: 800,
        peakUnits: 200,
        offPeakUnits: 300,
        peakRatePaise: 950,
        offPeakRatePaise: 700,
        fixedChargesPaise: 50_000,
      }),
    ).toEqual({ unitsConsumed: 500, totalCostPaise: 450_000 });
  });
});
