import { db } from "@/lib/firebase/admin";
import { splitEnergyAcrossLogs } from "@/lib/costing/power";
import { addDays } from "@/lib/planning/calendar";
import { estimateUnits, scaleEnergyToMainMeter, utilizationPercent } from "@/lib/planning/energy";
import type { IsoDate } from "@/lib/planning/types";
import {
  getElectricitySettings,
  getLogsByBatch,
  getLogsByDate,
  getLogsSince,
  getMachines,
  getReading,
} from "@/lib/data";
import type { DailyStats, MachineDoc } from "@/lib/types";

const round2 = (n: number) => Math.round(n * 100) / 100;
const BATCH_LIMIT = 400;

type Write = (batch: FirebaseFirestore.WriteBatch) => void;

export async function commitInChunks(writes: Write[]): Promise<void> {
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db().batch();
    for (const write of writes.slice(i, i + BATCH_LIMIT)) write(batch);
    await batch.commit();
  }
}

/**
 * Rebuilds everything derived from one day's logs and meter reading: per-machine energy,
 * each log's share of it, the day's common load and the dailyStats row.
 * Returns the batches whose power cost is affected.
 */
export async function recomputeDay(date: IsoDate, machinesIn?: MachineDoc[]): Promise<string[]> {
  const [machines, logs, reading, settings] = await Promise.all([
    machinesIn ?? getMachines(),
    getLogsByDate(date),
    getReading(date),
    getElectricitySettings(),
  ]);
  const active = machines.filter((m) => m.active);
  const byId = new Map(machines.map((m) => [m.id, m]));

  const hours = new Map<string, number>();
  for (const l of logs) hours.set(l.machineId, (hours.get(l.machineId) ?? 0) + l.runningHours);

  // No per-machine meter readings are captured yet, so every machine is estimated.
  const estimates = [...hours.entries()].map(([machineId, h]) => {
    const m = byId.get(machineId);
    return { machineId, units: m ? estimateUnits(m.powerKw, h, m.loadFactor) : 0, measured: false };
  });

  // Energy rate for the day excludes fixed charges, which are not driven by machine hours.
  const energyRate =
    reading && reading.unitsConsumed > 0
      ? (reading.totalCostPaise - reading.fixedChargesPaise) / reading.unitsConsumed
      : settings.ratePerUnitPaise;
  const estimatedTotal = estimates.reduce((sum, e) => sum + e.units, 0);
  const scaled = scaleEnergyToMainMeter(estimates, reading ? reading.unitsConsumed : estimatedTotal, energyRate);
  const logShares = splitEnergyAcrossLogs(
    logs.map((l) => ({ logId: l.id, machineId: l.machineId, runningHours: l.runningHours })),
    scaled.machines,
  );

  const outputMeters = round2(logs.reduce((sum, l) => sum + l.outputMeters, 0));
  const machinesRunning = [...hours.values()].filter((h) => h > 0).length;
  const units = reading ? reading.unitsConsumed : round2(estimatedTotal);
  const costPaise = reading
    ? reading.totalCostPaise
    : scaled.machines.reduce((sum, m) => sum + m.costPaise, 0);
  const stats: DailyStats = {
    date,
    totalMachines: active.length,
    machinesRunning,
    utilizationPercent: utilizationPercent(machinesRunning, active.length),
    outputMeters,
    runningHours: round2(logs.reduce((sum, l) => sum + l.runningHours, 0)),
    breakdownHours: round2(logs.reduce((sum, l) => sum + l.breakdownHours, 0)),
    units,
    costPaise,
    costPerMeterPaise: outputMeters > 0 ? round2(costPaise / outputMeters) : 0,
    peakUnits: reading?.peakUnits ?? null,
    offPeakUnits: reading?.offPeakUnits ?? null,
    estimated: !reading,
  };

  const writes: Write[] = [];
  for (const m of scaled.machines) {
    const ref = db().collection("machineEnergy").doc(`${date}_${m.machineId}`);
    writes.push((b) => b.set(ref, { ...m, date, estimated: true }));
  }
  for (const l of logs) {
    const share = logShares.get(l.id)!;
    const ref = db().collection("machineLogs").doc(l.id);
    writes.push((b) => b.update(ref, { units: share.units, powerCostPaise: share.costPaise }));
  }
  writes.push((b) => b.set(db().collection("dailyStats").doc(date), stats));
  if (reading) {
    const ref = db().collection("electricityReadings").doc(date);
    writes.push((b) =>
      b.update(ref, {
        commonLoadUnits: scaled.commonLoadUnits,
        commonLoadCostPaise: scaled.commonLoadCostPaise,
      }),
    );
  }
  await commitInChunks(writes);

  return [...new Set(logs.map((l) => l.batchId).filter((id): id is string => !!id))];
}

/** Batch power cost = energy cost of its machines for the hours logged against it. */
export async function recomputeBatchPower(batchId: string): Promise<void> {
  const logs = await getLogsByBatch(batchId);
  const ref = db().collection("batches").doc(batchId);
  if (!(await ref.get()).exists) return;
  await ref.update({
    powerCostPaise: logs.reduce((sum, l) => sum + (l.powerCostPaise ?? 0), 0),
    producedMeters: round2(logs.reduce((sum, l) => sum + l.outputMeters, 0)),
  });
}

/** Rolling 30-day efficiency, breakdown hours and energy per meter for every machine. */
export async function recomputeRolling(today: IsoDate, machinesIn?: MachineDoc[]): Promise<void> {
  const [machines, logs] = await Promise.all([
    machinesIn ?? getMachines(),
    getLogsSince(addDays(today, -29)),
  ]);
  const totals = new Map<string, { output: number; hours: number; breakdown: number; units: number }>();
  for (const l of logs) {
    const t = totals.get(l.machineId) ?? { output: 0, hours: 0, breakdown: 0, units: 0 };
    t.output += l.outputMeters;
    t.hours += l.runningHours;
    t.breakdown += l.breakdownHours;
    t.units += l.units ?? 0;
    totals.set(l.machineId, t);
  }
  const writes: Write[] = [];
  for (const m of machines) {
    const t = totals.get(m.id);
    if (!t) continue;
    const rated = m.ratedOutputPerHour * t.hours;
    const ref = db().collection("machines").doc(m.id);
    writes.push((b) =>
      b.update(ref, {
        // Machines with no running hours in the window keep their last known efficiency.
        ...(rated > 0
          ? { efficiencyPercent: Math.min(100, round2((t.output / rated) * 100)) }
          : {}),
        recentBreakdownHours: round2(t.breakdown),
        energyPerMeter30d: t.output > 0 ? Math.round((t.units / t.output) * 1000) / 1000 : 0,
      }),
    );
  }
  await commitInChunks(writes);
}

/** Run after any change to a day's logs or meter reading. */
export async function recomputeAll(date: IsoDate, today: IsoDate): Promise<void> {
  const machines = await getMachines();
  const batchIds = await recomputeDay(date, machines);
  await recomputeRolling(today, machines);
  await Promise.all(batchIds.map(recomputeBatchPower));
}
