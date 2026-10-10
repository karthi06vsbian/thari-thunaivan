import {
  allocationsFromBatches,
  getBatches,
  getDailyStats,
  getDailyStatsSince,
  getElectricitySettings,
  getMachines,
  getOrders,
  getShiftSettings,
} from "@/lib/data";
import { addDays, formatDate } from "@/lib/dates";
import { formatINR, formatNumber } from "@/lib/money";
import { recommendAllocation } from "@/lib/planning/allocate";
import { projectFinishDate } from "@/lib/planning/risk";
import type { IsoDate } from "@/lib/planning/types";
import type { DailyStats, MachineDoc } from "@/lib/types";

export const UTILIZATION_ALERT_BELOW = 60;
export const COST_PER_METER_ALERT_ABOVE = 1.15;

export interface StatusCounts {
  running: number;
  idle: number;
  maintenance: number;
  breakdown: number;
  total: number;
  breakdowns: MachineDoc[];
}

export function countStatuses(machines: MachineDoc[]): StatusCounts {
  const active = machines.filter((m) => m.active);
  const count = (s: MachineDoc["status"]) => active.filter((m) => m.status === s).length;
  return {
    running: count("running"),
    idle: count("idle"),
    maintenance: count("maintenance"),
    breakdown: count("breakdown"),
    total: active.length,
    breakdowns: active.filter((m) => m.status === "breakdown"),
  };
}

export interface AtRiskOrder {
  orderNo: string;
  batchNo: string;
  deadline: IsoDate;
  projectedFinish: IsoDate | null;
  remainingMeters: number;
}

/** Running batches whose projected finish at current machine rates is past the deadline. */
export async function getAtRiskOrders(today: IsoDate): Promise<AtRiskOrder[]> {
  const [batches, orders, machines, shifts] = await Promise.all([
    getBatches(),
    getOrders(),
    getMachines(),
    getShiftSettings(),
  ]);
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const atRisk: AtRiskOrder[] = [];
  for (const b of batches) {
    if (b.status !== "in_progress") continue;
    const order = orderById.get(b.orderId);
    if (!order) continue;
    const remaining = Math.max(0, b.meters - b.producedMeters);
    const projected = projectFinishDate(
      remaining,
      machines.filter((m) => b.machineIds.includes(m.id)),
      b.hoursPerDay ?? 16,
      today,
      shifts,
    );
    if (remaining > 0 && (!projected || projected > order.deadline)) {
      atRisk.push({
        orderNo: order.orderNo,
        batchNo: b.batchNo,
        deadline: order.deadline,
        projectedFinish: projected,
        remainingMeters: Math.round(remaining),
      });
    }
  }
  return atRisk;
}

export interface ElectricitySnapshot {
  today: DailyStats | null;
  yesterday: DailyStats | null;
  /** Average cost per meter (paise) over the 30 days before today, production days only. */
  avgCostPerMeterPaise: number;
}

export async function getElectricitySnapshot(today: IsoDate): Promise<ElectricitySnapshot> {
  const stats = await getDailyStatsSince(addDays(today, -30));
  const before = stats.filter((s) => s.date < today && s.outputMeters > 0);
  const cost = before.reduce((sum, s) => sum + s.costPaise, 0);
  const meters = before.reduce((sum, s) => sum + s.outputMeters, 0);
  return {
    today: stats.find((s) => s.date === today) ?? null,
    yesterday: stats.find((s) => s.date === addDays(today, -1)) ?? null,
    avgCostPerMeterPaise: meters > 0 ? cost / meters : 0,
  };
}

/** Pure so the thresholds can be unit tested. */
export function electricityAlerts(snapshot: ElectricitySnapshot): string[] {
  const alerts: string[] = [];
  const t = snapshot.today;
  if (!t || t.runningHours === 0) return alerts;
  if (t.utilizationPercent < UTILIZATION_ALERT_BELOW) {
    alerts.push(
      `Low utilization: ${t.machinesRunning} of ${t.totalMachines} machines ran today (${t.utilizationPercent}%).`,
    );
  }
  const avg = snapshot.avgCostPerMeterPaise;
  if (avg > 0 && t.costPerMeterPaise > avg * COST_PER_METER_ALERT_ABOVE) {
    const pct = Math.round((t.costPerMeterPaise / avg - 1) * 100);
    alerts.push(
      `Electricity cost per meter is ${formatINR(t.costPerMeterPaise)}, ${pct}% above the 30-day average (${formatINR(avg)}).`,
    );
  }
  return alerts;
}

export async function buildAlerts(today: IsoDate): Promise<string[]> {
  const [snapshot, atRisk, machines] = await Promise.all([
    getElectricitySnapshot(today),
    getAtRiskOrders(today),
    getMachines(),
  ]);
  const alerts = electricityAlerts(snapshot);
  for (const m of countStatuses(machines).breakdowns) {
    alerts.push(`Breakdown: ${m.machineNo} ${m.name}${m.currentBatchId ? ` (batch ${m.currentBatchId})` : ""}.`);
  }
  for (const o of atRisk) {
    alerts.push(
      `Order ${o.orderNo} at risk: due ${formatDate(o.deadline)}, projected ${
        o.projectedFinish ? formatDate(o.projectedFinish) : "no working machines"
      } (${formatNumber(o.remainingMeters)} m left).`,
    );
  }
  return alerts;
}

export async function machineStatusText(): Promise<string> {
  const c = countStatuses(await getMachines());
  const lines = [
    `*Machine status*`,
    `${c.running} running, ${c.idle} idle, ${c.maintenance} maintenance, ${c.breakdown} breakdown (of ${c.total})`,
  ];
  if (c.breakdowns.length > 0) {
    lines.push("", "Breakdowns:");
    for (const m of c.breakdowns) lines.push(`• ${m.machineNo} ${m.name}`);
  }
  return lines.join("\n");
}

function compare(now: number, before: number | undefined): string {
  if (!before) return "";
  const pct = Math.round((now / before - 1) * 100);
  return pct === 0 ? " (same as yesterday)" : ` (${pct > 0 ? "+" : ""}${pct}% vs yesterday)`;
}

export async function electricityTodayText(today: IsoDate): Promise<string> {
  const { today: t, yesterday: y } = await getElectricitySnapshot(today);
  if (!t) return `*Electricity today*\nNo production logs or meter reading entered yet for ${formatDate(today)}.`;
  return [
    `*Electricity today* (${formatDate(today)})${t.estimated ? " – estimated, no meter reading yet" : ""}`,
    `Units: ${formatNumber(t.units)} kWh${compare(t.units, y?.units)}`,
    `Cost: ${formatINR(t.costPaise, { whole: true })}${compare(t.costPaise, y?.costPaise)}`,
    `Cost per meter: ${formatINR(t.costPerMeterPaise)}${compare(t.costPerMeterPaise, y?.costPerMeterPaise)}`,
    `Machines: ${t.machinesRunning} / ${t.totalMachines} running (${t.utilizationPercent}%)`,
  ].join("\n");
}

export async function planOrderText(orderNo: string, today: IsoDate): Promise<string> {
  const [orders, batches, machines, shiftSettings, tariff] = await Promise.all([
    getOrders(),
    getBatches(),
    getMachines(),
    getShiftSettings(),
    getElectricitySettings(),
  ]);
  const order = orders.find((o) => o.orderNo.toLowerCase() === orderNo.toLowerCase());
  if (!order) return `Order ${orderNo} not found.`;
  const batch = batches.find((b) => b.orderId === order.id);
  const remaining = Math.max(0, order.meters - (batch?.producedMeters ?? 0));
  if (order.status === "completed" || remaining === 0) return `Order ${order.orderNo} is already completed.`;
  const result = recommendAllocation(
    {
      meters: remaining,
      fabricType: order.fabricType,
      widthInches: order.widthInches,
      startDate: today,
      deadline: order.deadline,
      shiftsPerDay: 2,
      allowOvertime: false,
    },
    {
      machines,
      allocations: allocationsFromBatches(batches, batch?.id),
      shiftSettings,
      ratePerUnitPaise: tariff.ratePerUnitPaise,
    },
  );
  const p = result.recommended;
  const lines = [
    `*Plan for ${order.orderNo}* – ${formatNumber(remaining)} m ${order.fabricType}, due ${formatDate(order.deadline)}`,
    `Machines needed: ${p.machinesNeeded} of ${result.totalMachines}`,
    `Estimated finish: ${p.estimatedFinishDate ? formatDate(p.estimatedFinishDate) : "not possible"}`,
    `Power: ${formatNumber(Math.round(p.estimatedUnits))} kWh ≈ ${formatINR(p.estimatedPowerCostPaise, { whole: true })}`,
    ...result.warnings.map((w) => `⚠ ${w}`),
    "",
    "Open Planning in the app to apply this plan.",
  ];
  return lines.join("\n");
}

export async function dailySummaryText(today: IsoDate): Promise<string> {
  const [stats, machines, alerts] = await Promise.all([
    getDailyStats(today),
    getMachines(),
    buildAlerts(today),
  ]);
  const c = countStatuses(machines);
  const lines = [`*Daily summary – ${formatDate(today, true)}*`];
  if (stats) {
    lines.push(
      `Production: ${formatNumber(Math.round(stats.outputMeters))} m`,
      `Utilization: ${stats.machinesRunning} / ${stats.totalMachines} machines (${stats.utilizationPercent}%)`,
      `Electricity: ${formatNumber(stats.units)} kWh, ${formatINR(stats.costPaise, { whole: true })} (${formatINR(stats.costPerMeterPaise)} per meter)${stats.estimated ? " – estimated" : ""}`,
    );
  } else {
    lines.push("No production logs entered today.");
  }
  lines.push(`Machines now: ${c.running} running, ${c.idle} idle, ${c.maintenance} maintenance, ${c.breakdown} breakdown`);
  if (alerts.length > 0) lines.push("", "Alerts:", ...alerts.map((a) => `• ${a}`));
  return lines.join("\n");
}
