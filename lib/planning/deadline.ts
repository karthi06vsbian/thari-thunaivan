import { effectiveRate } from "./allocate";
import { workingDaysBetween } from "./calendar";
import { projectFinishDate } from "./risk";
import type { IsoDate, Machine, ShiftSettings } from "./types";

export type DeadlineLevel = "overdue" | "late" | "not_started" | "on_track";

export interface DeadlineAlert {
  orderNo: string;
  customerName: string;
  deadline: IsoDate;
  /** Calendar days to the deadline; negative once it has passed. */
  daysLeft: number;
  /** Working days left, counting today and the deadline. */
  workingDaysLeft: number;
  orderMeters: number;
  producedMeters: number;
  balanceMeters: number;
  /** Meters that must come off the looms every working day to finish on time. */
  neededPerDay: number;
  /** Meters a day the order's working machines make now; 0 if nothing is running for it. */
  currentPerDay: number;
  projectedFinish: IsoDate | null;
  level: DeadlineLevel;
}

interface OrderLike {
  id: string;
  orderNo: string;
  customerName: string;
  meters: number;
  deadline: IsoDate;
  status: string;
}
interface BatchLike {
  orderId: string;
  status: string;
  producedMeters: number;
  machineIds: string[];
  hoursPerDay: number | null;
}

const DAY_MS = 86_400_000;
const daysBetween = (from: IsoDate, to: IsoDate) =>
  Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / DAY_MS);

/**
 * Open orders that still have fabric to produce and either fall due within `withinDays`
 * or will not finish by their deadline at the current rate. Most urgent first.
 */
export function deadlineAlerts(
  orders: OrderLike[],
  batches: BatchLike[],
  machines: Machine[],
  settings: ShiftSettings,
  today: IsoDate,
  withinDays: number,
): DeadlineAlert[] {
  const alerts: DeadlineAlert[] = [];
  for (const order of orders) {
    if (order.status !== "confirmed" && order.status !== "in_production") continue;
    const own = batches.filter((b) => b.orderId === order.id);
    const producedMeters = own.reduce((sum, b) => sum + b.producedMeters, 0);
    const balanceMeters = Math.round(order.meters - producedMeters);
    if (balanceMeters <= 0) continue;

    const running = own.filter((b) => b.status === "in_progress");
    const machineIds = new Set(running.flatMap((b) => b.machineIds));
    const hoursPerDay = Math.max(0, ...running.map((b) => b.hoursPerDay ?? 16));
    const working = machines.filter(
      (m) => machineIds.has(m.id) && m.active && m.status !== "breakdown" && m.status !== "maintenance",
    );
    const currentPerDay = Math.round(working.reduce((sum, m) => sum + effectiveRate(m) * hoursPerDay, 0));
    const projectedFinish = running.length > 0 ? projectFinishDate(balanceMeters, working, hoursPerDay, today, settings) : null;

    const daysLeft = daysBetween(today, order.deadline);
    const workingDaysLeft = daysLeft < 0 ? 0 : workingDaysBetween(today, order.deadline, settings).length;
    const level: DeadlineLevel =
      daysLeft < 0 ? "overdue"
      : running.length === 0 ? "not_started"
      : !projectedFinish || projectedFinish > order.deadline ? "late"
      : "on_track";
    if (daysLeft > withinDays && level !== "late") continue;

    alerts.push({
      orderNo: order.orderNo, customerName: order.customerName, deadline: order.deadline,
      daysLeft, workingDaysLeft, orderMeters: order.meters, producedMeters: Math.round(producedMeters), balanceMeters,
      neededPerDay: Math.ceil(balanceMeters / Math.max(1, workingDaysLeft)),
      currentPerDay, projectedFinish, level,
    });
  }
  return alerts.sort((a, b) => a.deadline.localeCompare(b.deadline));
}
