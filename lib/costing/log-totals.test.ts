import { describe, expect, it } from "vitest";
import { dayLogTotals, sumBatchTotals, sumMachineTotals } from "./log-totals";

const log = (machineId: string, batchId: string | null, outputMeters: number, runningHours = 8, extra = {}) => ({
  machineId, batchId, outputMeters, runningHours, breakdownHours: 0, units: 20, powerCostPaise: 16_000, ...extra,
});

const monday = dayLogTotals("2026-10-12", [
  log("M-01", "B-1", 100),
  log("M-01", "B-1", 90, 7, { breakdownHours: 1 }),
  log("M-02", "B-2", 80),
  log("M-03", null, 50),
]);
const tuesday = dayLogTotals("2026-10-13", [log("M-01", "B-2", 110), log("M-02", "B-2", 70, 6, { units: undefined, powerCostPaise: undefined })]);

describe("day log totals", () => {
  it("adds a day up by machine", () => {
    expect(monday.machines["M-01"]).toEqual({ output: 190, hours: 15, breakdown: 1, units: 40 });
    expect(monday.machines["M-03"]).toEqual({ output: 50, hours: 8, breakdown: 0, units: 20 });
  });

  it("adds a day up by batch and leaves out logs with no batch", () => {
    expect(monday.batches).toEqual({ "B-1": { output: 190, costPaise: 32_000 }, "B-2": { output: 80, costPaise: 16_000 } });
    expect(monday.batchIds).toEqual(["B-1", "B-2"]);
  });

  it("treats logs not yet costed as zero energy", () => {
    expect(tuesday.machines["M-02"]).toEqual({ output: 70, hours: 6, breakdown: 0, units: 0 });
    expect(tuesday.batches["B-2"]).toEqual({ output: 180, costPaise: 16_000 });
  });

  it("is empty for a day without logs", () => {
    expect(dayLogTotals("2026-10-18", [])).toEqual({ date: "2026-10-18", machines: {}, batches: {}, batchIds: [] });
  });
});

describe("totals over several days", () => {
  it("sums each machine", () => {
    const totals = sumMachineTotals([monday, tuesday]);
    expect(totals.get("M-01")).toEqual({ output: 300, hours: 23, breakdown: 1, units: 60 });
    expect(totals.get("M-02")).toEqual({ output: 150, hours: 14, breakdown: 0, units: 20 });
    expect(totals.has("M-09")).toBe(false);
  });

  it("sums one batch", () => {
    expect(sumBatchTotals([monday, tuesday], "B-2")).toEqual({ output: 260, costPaise: 32_000 });
    expect(sumBatchTotals([monday, tuesday], "B-9")).toEqual({ output: 0, costPaise: 0 });
  });
});
