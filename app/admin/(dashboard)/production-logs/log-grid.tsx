"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NativeSelect } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveLogs, type LogRowInput } from "./actions";

export interface GridRow {
  machineId: string;
  machineNo: string;
  name: string;
  status: string;
  batchId: string;
  runningHours: string;
  outputMeters: string;
  breakdownHours: string;
  notes: string;
}

type Previous = Record<string, Pick<GridRow, "batchId" | "runningHours" | "outputMeters" | "breakdownHours">>;

const FIELDS = [
  { field: "runningHours", label: "Running hours" },
  { field: "outputMeters", label: "Output meters" },
  { field: "breakdownHours", label: "Breakdown hours" },
] as const;

const isBlank = (r: GridRow) => r.runningHours === "" && r.outputMeters === "" && r.breakdownHours === "";

export function LogGrid({
  date,
  shift,
  shiftHours,
  initialRows,
  yesterday,
  batches,
}: {
  date: string;
  shift: string;
  shiftHours: number;
  initialRows: GridRow[];
  yesterday: Previous;
  batches: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [pending, startTransition] = useTransition();

  const update = (machineId: string, patch: Partial<GridRow>) =>
    setRows((current) => current.map((r) => (r.machineId === machineId ? { ...r, ...patch } : r)));

  function copyYesterday() {
    const available = Object.keys(yesterday).length;
    if (available === 0) {
      toast.error("No logs were entered for this shift yesterday");
      return;
    }
    // Only fills empty rows so anything already typed today is kept.
    setRows((current) => current.map((r) => (isBlank(r) && yesterday[r.machineId] ? { ...r, ...yesterday[r.machineId] } : r)));
    toast.success(`Copied yesterday's ${shift} shift into the empty rows`);
  }

  function save() {
    const filled = rows.filter((r) => !isBlank(r));
    if (filled.length === 0) {
      toast.error("Enter at least one machine");
      return;
    }
    const payload: LogRowInput[] = filled.map((r) => ({
      machineId: r.machineId,
      batchId: r.batchId || null,
      runningHours: Number(r.runningHours || 0),
      breakdownHours: Number(r.breakdownHours || 0),
      outputMeters: Number(r.outputMeters || 0),
      notes: r.notes,
    }));
    if (payload.some((r) => [r.runningHours, r.breakdownHours, r.outputMeters].some((n) => !Number.isFinite(n)))) {
      toast.error("Hours and meters must be numbers");
      return;
    }
    startTransition(async () => {
      const result = await saveLogs(date, shift, payload);
      if (result.ok) {
        toast.success(result.message ?? "Saved");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const filled = rows.filter((r) => Number(r.runningHours) > 0);
  const totalOutput = filled.reduce((sum, r) => sum + Number(r.outputMeters || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {filled.length} of {rows.length} machines running · {Math.round(totalOutput).toLocaleString("en-IN")} m ·
          shift is {shiftHours} hours (idle time is worked out automatically)
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={copyYesterday} disabled={pending}>
            Copy yesterday
          </Button>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save logs"}
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Machine</th>
              <th className="px-2 py-2 font-medium">Batch</th>
              <th className="px-2 py-2 font-medium">Running hrs</th>
              <th className="px-2 py-2 font-medium">Output (m)</th>
              <th className="px-2 py-2 font-medium">Breakdown hrs</th>
              <th className="px-2 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.machineId} className="border-t">
                <td className="px-3 py-1.5 whitespace-nowrap">
                  <span className="font-medium">{r.machineNo}</span>{" "}
                  <span className="text-xs text-muted-foreground">
                    {r.name}
                    {r.status !== "running" && r.status !== "idle" ? ` · ${r.status}` : ""}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <NativeSelect
                    aria-label={`Batch for ${r.machineNo}`}
                    value={r.batchId}
                    onChange={(e) => update(r.machineId, { batchId: e.target.value })}
                    className="h-7 w-36 text-xs"
                  >
                    <option value="">No batch (stock)</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>{b.label}</option>
                    ))}
                  </NativeSelect>
                </td>
                {FIELDS.map(({ field, label }) => (
                  <td key={field} className="px-2 py-1.5">
                    <Input
                      aria-label={`${label} for ${r.machineNo}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={field === "outputMeters" ? undefined : shiftHours}
                      step="0.01"
                      value={r[field]}
                      onChange={(e) => update(r.machineId, { [field]: e.target.value })}
                      className="h-7 w-24 text-right tabular-nums"
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5">
                  <Input
                    aria-label={`Notes for ${r.machineNo}`}
                    value={r.notes}
                    onChange={(e) => update(r.machineId, { notes: e.target.value })}
                    className="h-7 min-w-40"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
