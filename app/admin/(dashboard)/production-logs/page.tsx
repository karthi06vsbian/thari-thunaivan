import { NativeSelect, PageHeader } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACCESS, requireRole } from "@/lib/auth/session";
import { getBatches, getLogsByDate, getMachines, getShiftSettings } from "@/lib/data";
import { addDays, isIsoDate, todayIso } from "@/lib/dates";
import { LogGrid, type GridRow } from "./log-grid";

export default async function ProductionLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; shift?: string }>;
}) {
  await requireRole(ACCESS.productionLogs);
  const params = await searchParams;
  const today = todayIso();
  const date = isIsoDate(params.date) && params.date <= today ? params.date : today;
  const settings = await getShiftSettings();
  const shift = settings.shifts.find((s) => s.name === params.shift) ?? settings.shifts[0]!;

  const [machines, logs, previous, batches] = await Promise.all([
    getMachines(),
    getLogsByDate(date),
    getLogsByDate(addDays(date, -1)),
    getBatches(),
  ]);
  const existing = new Map(logs.filter((l) => l.shift === shift.name).map((l) => [l.machineId, l]));
  const openBatches = batches.filter((b) => b.status === "in_progress" || b.status === "planned");
  const openIds = new Set(openBatches.map((b) => b.id));

  const rows: GridRow[] = machines
    .filter((m) => m.active)
    .map((m) => {
      const log = existing.get(m.id);
      return {
        machineId: m.id,
        machineNo: m.machineNo,
        name: m.name,
        status: m.status,
        batchId: log ? (log.batchId ?? "") : m.currentBatchId && openIds.has(m.currentBatchId) ? m.currentBatchId : "",
        runningHours: log ? String(log.runningHours) : "",
        outputMeters: log ? String(log.outputMeters) : "",
        breakdownHours: log ? String(log.breakdownHours) : "",
        notes: log?.notes ?? "",
      };
    });

  const yesterday = Object.fromEntries(
    previous
      .filter((l) => l.shift === shift.name)
      .map((l) => [
        l.machineId,
        {
          // A batch that has since closed is not carried forward.
          batchId: l.batchId && openIds.has(l.batchId) ? l.batchId : "",
          runningHours: String(l.runningHours),
          outputMeters: String(l.outputMeters),
          breakdownHours: String(l.breakdownHours),
        },
      ]),
  );
  // Batches already on saved rows stay selectable even after they close.
  const usedIds = new Set(rows.map((r) => r.batchId).filter(Boolean));
  const batchOptions = batches
    .filter((b) => openIds.has(b.id) || usedIds.has(b.id))
    .map((b) => ({ id: b.id, label: `${b.batchNo} · ${b.orderNo}` }));

  return (
    <>
      <PageHeader title="Production logs" description="Enter running hours and output for every machine, shift by shift.">
        <form className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Date
            <Input type="date" name="date" defaultValue={date} max={today} className="w-40" />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Shift
            <NativeSelect name="shift" defaultValue={shift.name}>
              {settings.shifts.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} ({s.start}–{s.end})
                </option>
              ))}
            </NativeSelect>
          </label>
          <Button type="submit" variant="outline">Load</Button>
        </form>
      </PageHeader>
      <LogGrid
        key={`${date}_${shift.name}_${logs.length}`}
        date={date}
        shift={shift.name}
        shiftHours={shift.hours}
        initialRows={rows}
        yesterday={yesterday}
        batches={batchOptions}
      />
    </>
  );
}
