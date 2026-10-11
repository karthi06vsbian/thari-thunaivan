import type { IsoDate } from "@/lib/planning/types";
import type { DayLogTotals, MachineLog } from "@/lib/types";

type LogFigures = Pick<MachineLog, "machineId" | "batchId" | "runningHours" | "breakdownHours" | "outputMeters" | "units" | "powerCostPaise">;
export type MachineTotals = DayLogTotals["machines"][string];
export type BatchTotals = DayLogTotals["batches"][string];

/** Adds up one day's logs by machine and by batch. */
export function dayLogTotals(date: IsoDate, logs: LogFigures[]): DayLogTotals {
  const machines: DayLogTotals["machines"] = {};
  const batches: DayLogTotals["batches"] = {};
  for (const l of logs) {
    const m = (machines[l.machineId] ??= { output: 0, hours: 0, breakdown: 0, units: 0 });
    m.output += l.outputMeters;
    m.hours += l.runningHours;
    m.breakdown += l.breakdownHours;
    m.units += l.units ?? 0;
    if (!l.batchId) continue;
    const b = (batches[l.batchId] ??= { output: 0, costPaise: 0 });
    b.output += l.outputMeters;
    b.costPaise += l.powerCostPaise ?? 0;
  }
  return { date, machines, batches, batchIds: Object.keys(batches).sort() };
}

/** Each machine's totals over a set of days. */
export function sumMachineTotals(days: DayLogTotals[]): Map<string, MachineTotals> {
  const totals = new Map<string, MachineTotals>();
  for (const day of days) {
    for (const [machineId, m] of Object.entries(day.machines)) {
      const t = totals.get(machineId) ?? { output: 0, hours: 0, breakdown: 0, units: 0 };
      totals.set(machineId, {
        output: t.output + m.output, hours: t.hours + m.hours,
        breakdown: t.breakdown + m.breakdown, units: t.units + m.units,
      });
    }
  }
  return totals;
}

/** One batch's output and power cost over a set of days. */
export function sumBatchTotals(days: DayLogTotals[], batchId: string): BatchTotals {
  return days.reduce<BatchTotals>(
    (t, day) => ({
      output: t.output + (day.batches[batchId]?.output ?? 0),
      costPaise: t.costPaise + (day.batches[batchId]?.costPaise ?? 0),
    }),
    { output: 0, costPaise: 0 },
  );
}
