import { addDays, formatDate } from "@/lib/dates";
import { isWorkingDay } from "@/lib/planning/calendar";
import type { ExistingAllocation, IsoDate, ShiftSettings } from "@/lib/planning/types";

// Categorical slots in fixed order; a batch keeps its colour for as long as it is on the chart.
const SLOTS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const OTHER = "#8a8a86";
const PROPOSED =
  "repeating-linear-gradient(45deg, #0b0b0b 0 2px, transparent 2px 5px)";

export function Timeline({
  machines,
  allocations,
  proposed,
  from,
  to,
  shiftSettings,
  today,
}: {
  machines: { id: string; machineNo: string; status: string }[];
  allocations: ExistingAllocation[];
  proposed: { label: string; machineIds: string[]; startDate: IsoDate; endDate: IsoDate } | null;
  from: IsoDate;
  to: IsoDate;
  shiftSettings: ShiftSettings;
  today: IsoDate;
}) {
  const days: IsoDate[] = [];
  for (let d = from; d <= to && days.length < 42; d = addDays(d, 1)) days.push(d);
  const batchNos = [...new Set(allocations.map((a) => a.batchId))].sort();
  const colour = (batchNo: string) => SLOTS[batchNos.indexOf(batchNo)] ?? OTHER;
  const proposedIds = new Set(proposed?.machineIds ?? []);

  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {batchNos.map((b) => (
          <li key={b} className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ background: colour(b) }} />
            {b}
          </li>
        ))}
        {proposed && (
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm border border-foreground" style={{ background: PROPOSED }} />
            {proposed.label} (proposed)
          </li>
        )}
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-muted ring-1 ring-border" />
          Holiday / weekly off
        </li>
      </ul>
      <div className="overflow-x-auto rounded-xl border">
        <table className="border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-background px-2 py-1 text-left font-medium">Machine</th>
              {days.map((d) => (
                <th
                  key={d}
                  className={`min-w-7 px-0.5 py-1 text-center font-normal text-muted-foreground ${d === today ? "font-semibold text-foreground" : ""}`}
                  title={formatDate(d, true)}
                >
                  {Number(d.slice(8))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.id}>
                <th className="sticky left-0 z-10 bg-background px-2 py-0.5 text-left font-medium whitespace-nowrap">
                  {m.machineNo}
                  {(m.status === "breakdown" || m.status === "maintenance") && (
                    <span className="ml-1 font-normal text-muted-foreground">({m.status})</span>
                  )}
                </th>
                {days.map((d) => {
                  const booked = allocations.find(
                    (a) => a.machineId === m.id && a.startDate <= d && d <= a.endDate,
                  );
                  const off = !isWorkingDay(d, shiftSettings);
                  const isProposed =
                    !booked && !off && proposed && proposedIds.has(m.id) && proposed.startDate <= d && d <= proposed.endDate;
                  const label = booked ? booked.batchId : isProposed ? "proposed" : off ? "off" : "free";
                  return (
                    <td key={d} className="p-px" title={`${m.machineNo} · ${formatDate(d)} · ${label}`}>
                      <div
                        className={`h-4 rounded-[3px] ${off ? "bg-muted" : ""} ${isProposed ? "border border-foreground" : ""}`}
                        style={
                          booked && !off
                            ? { background: colour(booked.batchId) }
                            : isProposed
                              ? { background: PROPOSED }
                              : undefined
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
