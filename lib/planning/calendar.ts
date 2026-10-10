import type { IsoDate, ShiftSettings } from "./types";

const DAY_MS = 86_400_000;

function toUtc(date: IsoDate): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export function isWorkingDay(date: IsoDate, settings: ShiftSettings): boolean {
  const weekday = new Date(toUtc(date)).getUTCDay();
  return settings.workingDays.includes(weekday) && !settings.holidays.includes(date);
}

/** Working days from start to end, both inclusive, skipping weekly offs and holidays. */
export function workingDaysBetween(start: IsoDate, end: IsoDate, settings: ShiftSettings): IsoDate[] {
  const days: IsoDate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (isWorkingDay(d, settings)) days.push(d);
  }
  return days;
}

/** Hours worked per day when running the first `shiftsPerDay` shifts. */
export function shiftHours(settings: ShiftSettings, shiftsPerDay: number): number {
  return settings.shifts.slice(0, shiftsPerDay).reduce((sum, s) => sum + s.hours, 0);
}
