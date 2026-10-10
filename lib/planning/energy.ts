const round2 = (n: number) => Math.round(n * 100) / 100;

/** Estimated kWh for a machine without its own energy meter. */
export function estimateUnits(powerKw: number, runningHours: number, loadFactor: number): number {
  return powerKw * runningHours * loadFactor;
}

export interface MachineUnits {
  machineId: string;
  units: number;
  /** True when read from the machine's own energy meter; measured units are never scaled. */
  measured: boolean;
}

export interface ScaledEnergy {
  machines: { machineId: string; units: number; costPaise: number }[];
  /** Lighting, compressors, AC etc. Booked under overheads. */
  commonLoadUnits: number;
  commonLoadCostPaise: number;
  scaleFactor: number;
}

/**
 * Reconciles per-machine units with the main meter. If the estimates add up to more than
 * the meter shows they are scaled down proportionally; if they add up to less, the
 * remainder is the mill's common load.
 */
export function scaleEnergyToMainMeter(
  entries: MachineUnits[],
  mainMeterUnits: number,
  ratePerUnitPaise: number,
): ScaledEnergy {
  const measured = entries.filter((e) => e.measured).reduce((sum, e) => sum + e.units, 0);
  const estimated = entries.filter((e) => !e.measured).reduce((sum, e) => sum + e.units, 0);
  const roomForEstimates = Math.max(0, mainMeterUnits - measured);
  const scaleFactor = estimated > roomForEstimates ? roomForEstimates / estimated : 1;

  const machines = entries.map((e) => {
    const units = round2(e.measured ? e.units : e.units * scaleFactor);
    return { machineId: e.machineId, units, costPaise: Math.round(units * ratePerUnitPaise) };
  });
  const commonLoadUnits = round2(Math.max(0, mainMeterUnits - measured - estimated * scaleFactor));
  return {
    machines,
    commonLoadUnits,
    commonLoadCostPaise: Math.round(commonLoadUnits * ratePerUnitPaise),
    scaleFactor,
  };
}

export interface DailyReading {
  mainMeterStartKwh: number;
  mainMeterEndKwh: number;
  /** Flat rate, paise per kWh. Used when no peak/off-peak split is entered. */
  ratePerUnitPaise: number;
  peakUnits?: number;
  offPeakUnits?: number;
  peakRatePaise?: number;
  offPeakRatePaise?: number;
  fixedChargesPaise?: number;
}

/** Units and total cost (paise) for one day's main meter reading. */
export function dailyElectricityCost(r: DailyReading): { unitsConsumed: number; totalCostPaise: number } {
  const unitsConsumed = round2(r.mainMeterEndKwh - r.mainMeterStartKwh);
  const hasSplit = r.peakUnits !== undefined && r.offPeakUnits !== undefined;
  const energyCost = hasSplit
    ? r.peakUnits! * (r.peakRatePaise ?? r.ratePerUnitPaise) +
      r.offPeakUnits! * (r.offPeakRatePaise ?? r.ratePerUnitPaise)
    : unitsConsumed * r.ratePerUnitPaise;
  return { unitsConsumed, totalCostPaise: Math.round(energyCost + (r.fixedChargesPaise ?? 0)) };
}

/** Share of machines that ran today, 0-100. */
export function utilizationPercent(machinesRunning: number, totalMachines: number): number {
  return totalMachines > 0 ? round2((machinesRunning / totalMachines) * 100) : 0;
}
