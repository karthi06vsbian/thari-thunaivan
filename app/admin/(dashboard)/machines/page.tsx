import { Kpi, PageHeader } from "@/components/kpi";
import { ACCESS, requireRole } from "@/lib/auth/session";
import { getLogsByDate, getMachines } from "@/lib/data";
import { addDays, todayIso } from "@/lib/dates";
import { countStatuses } from "@/lib/reports";
import { MachinesGrid, type MachineCard } from "./machines-grid";

export default async function MachinesPage() {
  await requireRole(ACCESS.machines);
  const today = todayIso();
  const [machines, logs] = await Promise.all([getMachines(), getLogsByDate(today)]);
  const counts = countStatuses(machines);
  const soon = addDays(today, 7);

  const cards: MachineCard[] = machines
    .filter((m) => m.active)
    .map((m) => {
      const mine = logs.filter((l) => l.machineId === m.id);
      return {
        id: m.id,
        machineNo: m.machineNo,
        name: m.name,
        type: m.type,
        status: m.status,
        currentBatchId: m.currentBatchId,
        todayOutput: mine.reduce((sum, l) => sum + l.outputMeters, 0),
        todayHours: mine.reduce((sum, l) => sum + l.runningHours, 0),
        efficiencyPercent: Math.round(m.efficiencyPercent),
        ratedOutputPerHour: m.ratedOutputPerHour,
        powerKw: m.powerKw,
        maintenanceDueAt: m.maintenanceDueAt ?? null,
        maintenanceSoon: !!m.maintenanceDueAt && m.maintenanceDueAt <= soon,
      };
    });

  return (
    <>
      <PageHeader title="🏭 Machines" description="Live status of every machine on the floor." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Running" value={`${counts.running} / ${counts.total}`} />
        <Kpi label="Idle" value={String(counts.idle)} />
        <Kpi label="Maintenance" value={String(counts.maintenance)} />
        <Kpi label="Breakdown" value={String(counts.breakdown)} />
      </div>
      <MachinesGrid machines={cards} />
    </>
  );
}
