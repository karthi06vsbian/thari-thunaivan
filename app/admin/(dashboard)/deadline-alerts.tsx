import Link from "next/link";
import { NativeSelect } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { formatNumber } from "@/lib/money";
import type { DeadlineAlert, DeadlineLevel } from "@/lib/planning/deadline";

export const DUE_WINDOWS = [3, 7, 14, 30];

// Colours are always shown together with the words they stand for.
const TINT: Record<DeadlineLevel, string> = {
  overdue: "border-l-red-600 bg-red-50",
  late: "border-l-red-600 bg-red-50",
  not_started: "border-l-amber-500 bg-amber-50",
  on_track: "border-l-teal",
};
const PILL: Record<DeadlineLevel, string> = {
  overdue: "bg-red-600 text-white",
  late: "bg-red-600 text-white",
  not_started: "bg-amber-500 text-white",
  on_track: "bg-teal text-white",
};
const LABEL: Record<DeadlineLevel, string> = {
  overdue: "Overdue",
  late: "Will miss the deadline",
  not_started: "Not on the looms yet",
  on_track: "On track",
};

function dueText(days: number): string {
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} overdue`;
  if (days === 0) return "due today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

function advice(a: DeadlineAlert): string {
  const need = `${formatNumber(a.neededPerDay)} m a day`;
  if (a.level === "overdue") return `Deadline has passed with ${formatNumber(a.balanceMeters)} m still to produce.`;
  if (a.level === "not_started") return `Needs ${need} for ${a.workingDaysLeft} working day${a.workingDaysLeft === 1 ? "" : "s"}, and no loom is running it yet.`;
  if (a.level === "late") {
    return a.currentPerDay === 0
      ? `Needs ${need}, but none of its machines are working.`
      : `Needs ${need}; the looms are making ${formatNumber(a.currentPerDay)} m a day, so it finishes ${a.projectedFinish ? formatDate(a.projectedFinish) : "late"}.`;
  }
  return `Needs ${need}; the looms are making ${formatNumber(a.currentPerDay)} m a day, finishing ${formatDate(a.projectedFinish)}.`;
}

export function DeadlineAlerts({ alerts, within }: { alerts: DeadlineAlert[]; within: number }) {
  const urgent = alerts.filter((a) => a.level !== "on_track").length;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>⏰ Deadline alerts{urgent > 0 && <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">{urgent} need action</span>}</CardTitle>
            <CardDescription>Orders due soon that still have fabric to produce, and any order that will finish late.</CardDescription>
          </div>
          <form className="flex items-end gap-2">
            <label className="grid gap-1 text-xs text-muted-foreground">
              Alert me when due within
              <NativeSelect name="due" defaultValue={String(within)}>
                {DUE_WINDOWS.map((d) => (
                  <option key={d} value={d}>{d} days</option>
                ))}
              </NativeSelect>
            </label>
            <Button type="submit" variant="outline">Show</Button>
          </form>
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">✅ No order with a balance is due in the next {within} days.</p>
        ) : (
          <ul className="grid gap-3">
            {alerts.map((a) => {
              const percent = Math.min(100, Math.round((a.producedMeters / a.orderMeters) * 100));
              return (
                <li key={a.orderNo} className={`grid gap-2 rounded-xl border border-l-4 p-3 text-sm ${TINT[a.level]}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="font-semibold">
                      {a.orderNo} · {a.customerName}
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${PILL[a.level]}`}>{LABEL[a.level]}</span>
                    </p>
                    <p className="text-right">
                      <span className="font-semibold">Due {formatDate(a.deadline, true)}</span>
                      <span className="block text-xs text-muted-foreground">{dueText(a.daysLeft)}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                    <p>
                      <span className="text-lg font-bold tabular-nums">{formatNumber(a.balanceMeters)} m</span> still to produce
                      <span className="text-muted-foreground"> · {formatNumber(a.producedMeters)} of {formatNumber(a.orderMeters)} m done ({percent}%)</span>
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/10" role="img" aria-label={`${percent}% produced`}>
                    <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
                  </div>
                  <p>{advice(a)}</p>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Add machines or overtime in <Link className="underline" href="/admin/planning">Planning</Link>.
        </p>
      </CardContent>
    </Card>
  );
}
