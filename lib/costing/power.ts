export interface LogHours {
  logId: string;
  machineId: string;
  runningHours: number;
}

export interface MachineDayEnergy {
  machineId: string;
  units: number;
  costPaise: number;
}

/**
 * Splits each machine's energy for the day across its logs by running hours, so a batch
 * only carries the power used during the hours logged against it.
 */
export function splitEnergyAcrossLogs(
  logs: LogHours[],
  energy: MachineDayEnergy[],
): Map<string, { units: number; costPaise: number }> {
  const hours = new Map<string, number>();
  for (const l of logs) hours.set(l.machineId, (hours.get(l.machineId) ?? 0) + l.runningHours);
  const byMachine = new Map(energy.map((e) => [e.machineId, e]));
  const out = new Map<string, { units: number; costPaise: number }>();
  for (const l of logs) {
    const total = hours.get(l.machineId) ?? 0;
    const e = byMachine.get(l.machineId);
    const share = e && total > 0 ? l.runningHours / total : 0;
    out.set(l.logId, {
      units: Math.round((e?.units ?? 0) * share * 100) / 100,
      costPaise: Math.round((e?.costPaise ?? 0) * share),
    });
  }
  return out;
}

export interface BatchCosts {
  meters: number;
  producedMeters: number;
  materialCostPaise: number;
  labourCostPaise: number;
  overheadCostPaise: number;
  powerCostPaise: number;
}

/** Cost per meter and profit for a batch; power cost comes from the machine energy logs. */
export function batchCosting(batch: BatchCosts, ratePerMeterPaise: number) {
  const totalCostPaise =
    batch.materialCostPaise + batch.labourCostPaise + batch.overheadCostPaise + batch.powerCostPaise;
  const basis = batch.producedMeters > 0 ? batch.producedMeters : batch.meters;
  const costPerMeterPaise = basis > 0 ? Math.round(totalCostPaise / basis) : 0;
  const revenuePaise = Math.round(basis * ratePerMeterPaise);
  return { totalCostPaise, costPerMeterPaise, revenuePaise, profitPaise: revenuePaise - totalCostPaise };
}
