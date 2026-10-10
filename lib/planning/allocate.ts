import { addDays, isWorkingDay, shiftHours, workingDaysBetween } from "./calendar";
import type {
  AllocationResult,
  DayPlan,
  IsoDate,
  Machine,
  MachinePlan,
  PlanContext,
  PlanInputs,
  PlanKey,
  PlanOption,
} from "./types";

const DEFAULT_OVERTIME_HOURS = 4;
/** How far past the deadline we search for the earliest possible finish date. */
const MAX_HORIZON_DAYS = 730;
const SCORE_WEIGHTS = { rate: 0.5, energy: 0.3, breakdown: 0.2 };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Meters per hour the machine actually delivers. */
export function effectiveRate(m: Machine): number {
  return m.ratedOutputPerHour * (m.efficiencyPercent / 100);
}

/** kWh drawn per meter produced. */
export function energyPerMeter(m: Machine): number {
  const rate = effectiveRate(m);
  return rate > 0 ? (m.powerKw * m.loadFactor) / rate : Infinity;
}

/** Machines needed when every machine runs at the average rate for the same hours. */
export function machinesNeededEstimate(
  meters: number,
  avgEffectiveRate: number,
  availableHoursPerMachine: number,
): number {
  if (meters <= 0) return 0;
  if (avgEffectiveRate <= 0 || availableHoursPerMachine <= 0) return Infinity;
  const requiredMachineHours = meters / avgEffectiveRate;
  return Math.ceil(requiredMachineHours / availableHoursPerMachine - 1e-9);
}

export function eligibleMachines(inputs: PlanInputs, machines: Machine[]): Machine[] {
  return machines.filter(
    (m) =>
      m.active &&
      m.status !== "maintenance" &&
      m.status !== "breakdown" &&
      m.supportedFabricTypes.includes(inputs.fabricType) &&
      m.maxWidthInches >= inputs.widthInches &&
      effectiveRate(m) > 0 &&
      !(m.maintenanceDueAt && m.maintenanceDueAt <= inputs.deadline),
  );
}

/** Best first: fast, low energy per meter, few recent breakdowns. */
export function rankMachines(machines: Machine[]): Machine[] {
  const normalise = (values: number[]) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    return values.map((v) => (max === min ? 1 : (v - min) / (max - min)));
  };
  const rate = normalise(machines.map(effectiveRate));
  const energy = normalise(machines.map(energyPerMeter));
  const breakdown = normalise(machines.map((m) => m.recentBreakdownHours ?? 0));
  return machines
    .map((machine, i) => ({
      machine,
      score:
        SCORE_WEIGHTS.rate * rate[i]! +
        SCORE_WEIGHTS.energy * (1 - energy[i]!) +
        SCORE_WEIGHTS.breakdown * (1 - breakdown[i]!),
    }))
    .sort((a, b) => b.score - a.score || a.machine.machineNo.localeCompare(b.machine.machineNo))
    .map((s) => s.machine);
}

/** Takes machines in the given order until their combined capacity covers the order. */
export function pickGreedy(
  ordered: Machine[],
  meters: number,
  capacityOf: (m: Machine) => number,
): Machine[] {
  const chosen: Machine[] = [];
  let capacity = 0;
  for (const m of ordered) {
    if (capacity >= meters) break;
    const c = capacityOf(m);
    if (c <= 0) continue;
    chosen.push(m);
    capacity += c;
  }
  return chosen;
}

export function recommendAllocation(inputs: PlanInputs, ctx: PlanContext): AllocationResult {
  const { shiftSettings, allocations, ratePerUnitPaise } = ctx;
  const baseHours = shiftHours(shiftSettings, inputs.shiftsPerDay);
  const overtimeHours = baseHours + (inputs.overtimeHoursPerDay ?? DEFAULT_OVERTIME_HOURS);
  const windowDays = workingDaysBetween(inputs.startDate, inputs.deadline, shiftSettings);

  const busy = new Map<string, { startDate: IsoDate; endDate: IsoDate; batchId: string }[]>();
  for (const a of allocations) {
    const list = busy.get(a.machineId) ?? [];
    list.push(a);
    busy.set(a.machineId, list);
  }
  // Maintenance takes the machine out for the day it falls due.
  const isFree = (m: Machine, day: IsoDate) =>
    m.maintenanceDueAt !== day &&
    !(busy.get(m.id) ?? []).some((a) => a.startDate <= day && day <= a.endDate);

  const freeDays = (m: Machine) => windowDays.filter((d) => isFree(m, d)).length;
  const capacity = (hoursPerDay: number) => (m: Machine) =>
    effectiveRate(m) * hoursPerDay * freeDays(m);

  const eligible = eligibleMachines(inputs, ctx.machines);
  const usable = eligible.filter((m) => freeDays(m) > 0);
  const ranked = rankMachines(usable);
  const totalCapacity = (hoursPerDay: number) =>
    usable.reduce((sum, m) => sum + capacity(hoursPerDay)(m), 0);

  const simulate = (key: PlanKey, label: string, machines: Machine[], hoursPerDay: number): PlanOption => {
    const perMachine = new Map<string, MachinePlan>(
      machines.map((m) => [
        m.id,
        {
          machineId: m.id,
          machineNo: m.machineNo,
          metersPerDay: round2(effectiveRate(m) * hoursPerDay),
          plannedMeters: 0,
          runningHours: 0,
          units: 0,
        },
      ]),
    );
    const daily: DayPlan[] = [];
    let remaining = inputs.meters;
    let finish: IsoDate | null = null;
    const horizon = addDays(inputs.deadline, MAX_HORIZON_DAYS);

    for (let day = inputs.startDate; remaining > 0 && day <= horizon; day = addDays(day, 1)) {
      if (!isWorkingDay(day, shiftSettings)) continue;
      const running = machines.filter((m) => isFree(m, day));
      const dayCapacity = running.reduce((sum, m) => sum + effectiveRate(m) * hoursPerDay, 0);
      if (dayCapacity <= 0) continue;
      // The last day is a partial run: every machine stops once the order is complete.
      const fraction = Math.min(1, remaining / dayCapacity);
      let dayUnits = 0;
      for (const m of running) {
        const hours = hoursPerDay * fraction;
        const units = m.powerKw * m.loadFactor * hours;
        const plan = perMachine.get(m.id)!;
        plan.runningHours += hours;
        plan.plannedMeters += effectiveRate(m) * hours;
        plan.units += units;
        dayUnits += units;
      }
      daily.push({
        date: day,
        machinesRunning: running.length,
        meters: round2(dayCapacity * fraction),
        units: round2(dayUnits),
        costPaise: Math.round(dayUnits * ratePerUnitPaise),
      });
      remaining = fraction < 1 ? 0 : remaining - dayCapacity;
      if (remaining <= 1e-9) {
        remaining = 0;
        finish = day;
      }
    }

    const plans = [...perMachine.values()].map((p) => ({
      ...p,
      plannedMeters: round2(p.plannedMeters),
      runningHours: round2(p.runningHours),
      units: round2(p.units),
    }));
    const costPaise = daily.reduce((sum, d) => sum + d.costPaise, 0);
    return {
      key,
      label,
      feasible: finish !== null && finish <= inputs.deadline,
      hoursPerDay,
      machineIds: machines.map((m) => m.id),
      machinesNeeded: machines.length,
      perMachine: plans,
      daily,
      estimatedFinishDate: finish,
      estimatedUnits: round2(plans.reduce((sum, p) => sum + p.units, 0)),
      estimatedPowerCostPaise: costPaise,
      powerCostPerMeterPaise: inputs.meters > 0 ? round2(costPaise / inputs.meters) : 0,
    };
  };

  const warnings: string[] = [];
  const alternatives: PlanOption[] = [];
  const feasibleAt = (hoursPerDay: number) => totalCapacity(hoursPerDay) >= inputs.meters;
  let recommended: PlanOption;
  let shortfallMeters = 0;
  let earliestPossibleDate: IsoDate | null = null;

  if (feasibleAt(baseHours)) {
    recommended = simulate(
      "recommended",
      "Recommended",
      pickGreedy(ranked, inputs.meters, capacity(baseHours)),
      baseHours,
    );
    const byCapacity = [...usable].sort((a, b) => capacity(baseHours)(b) - capacity(baseHours)(a));
    alternatives.push(
      simulate(
        "min-machines",
        "Minimum machines",
        pickGreedy(byCapacity, inputs.meters, capacity(baseHours)),
        baseHours,
      ),
      simulate("fastest", "Fastest finish (all free machines)", usable, baseHours),
    );
    if (inputs.allowOvertime) {
      alternatives.push(
        simulate(
          "overtime",
          "With overtime shift",
          pickGreedy(ranked, inputs.meters, capacity(overtimeHours)),
          overtimeHours,
        ),
      );
    }
  } else if (inputs.allowOvertime && feasibleAt(overtimeHours)) {
    // Only reachable with overtime, so the overtime plan is the recommendation.
    recommended = simulate(
      "overtime",
      "With overtime shift",
      pickGreedy(ranked, inputs.meters, capacity(overtimeHours)),
      overtimeHours,
    );
    warnings.push("Deadline can only be met with the overtime shift.");
    alternatives.push(simulate("fastest", "Fastest finish without overtime", usable, baseHours));
  } else {
    const bestHours = inputs.allowOvertime ? overtimeHours : baseHours;
    // Includes machines with no free day before the deadline: they can still help after it.
    recommended = simulate("fastest", "Fastest finish (all free machines)", rankMachines(eligible), bestHours);
    shortfallMeters = round2(inputs.meters - totalCapacity(bestHours));
    const short = Math.round(shortfallMeters).toLocaleString("en-IN");
    earliestPossibleDate = recommended.estimatedFinishDate;
    warnings.push(
      earliestPossibleDate
        ? `Deadline cannot be met: ${short} m short. Earliest possible finish is ${earliestPossibleDate}.`
        : `Deadline cannot be met: ${short} m short and no eligible machine capacity was found.`,
    );
    const blocking = new Set<string>();
    for (const m of eligible) {
      for (const a of busy.get(m.id) ?? []) {
        if (a.startDate <= inputs.deadline && a.endDate >= inputs.startDate) blocking.add(a.batchId);
      }
    }
    if (blocking.size > 0) {
      warnings.push(
        `Suitable machines are held by ${[...blocking].sort().join(", ")} before the deadline; ` +
          "moving them to this order would delay those orders.",
      );
    }
  }

  return {
    totalMachines: ctx.machines.filter((m) => m.active).length,
    eligibleCount: eligible.length,
    recommended,
    alternatives,
    shortfallMeters,
    earliestPossibleDate,
    warnings,
  };
}
