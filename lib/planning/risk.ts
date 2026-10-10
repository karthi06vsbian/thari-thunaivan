import { addDays, isWorkingDay } from "./calendar";
import { effectiveRate } from "./allocate";
import type { IsoDate, Machine, ShiftSettings } from "./types";

/**
 * Date a running batch will finish at its machines' current rate, or null if it has no
 * working machine. Used to flag orders at risk of missing their deadline.
 */
export function projectFinishDate(
  remainingMeters: number,
  machines: Machine[],
  hoursPerDay: number,
  from: IsoDate,
  settings: ShiftSettings,
): IsoDate | null {
  if (remainingMeters <= 0) return from;
  const perDay = machines
    .filter((m) => m.active && m.status !== "breakdown" && m.status !== "maintenance")
    .reduce((sum, m) => sum + effectiveRate(m) * hoursPerDay, 0);
  if (perDay <= 0) return null;
  let remaining = remainingMeters;
  for (let day = from, i = 0; i < 730; day = addDays(day, 1), i++) {
    if (!isWorkingDay(day, settings)) continue;
    remaining -= perDay;
    if (remaining <= 1e-9) return day;
  }
  return null;
}
