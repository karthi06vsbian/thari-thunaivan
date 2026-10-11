import { Kpi, PageHeader } from "@/components/kpi";
import { ACCESS, requireRole } from "@/lib/auth/session";
import { getBatches, getLogsByDate, getMachines } from "@/lib/data";
import { addDays, todayIso } from "@/lib/dates";
import { countStatuses } from "@/lib/reports";
import { MachinesGrid, type MachineCard } from "./machines-grid";

export default async function MachinesPage() {
  await requireRole(ACCESS.machines);
  const today = todayIso();
  const [machines, logs, batches] = await Promise.all([getMachines(), getLogsByDate(today), getBatches()]);
  // Plans that still hold their machines, earliest first.
  const plans = batches
    .filter((b) => (b.status === "planned" || b.status === "in_progress") && b.startDate && b.endDate)
    .sort((a, b) => a.startDate!.localeCompare(b.startDate!));
  const counts = countStatuses(machines);
  const soon = addDays(today, 7);

  const cards: MachineCard[] = machines
    .filter((m) => m.active)
    .map((m) => {
      const mine = logs.filter((l) => l.machineId === m.id);
      const held = plans.filter((b) => b.machineIds.includes(m.id));
      // The plan the machine is on today, or else the next one.
      const plan = held.find((b) => b.id === m.currentBatchId) ?? held[0];
      return {
        id: m.id,
        machineNo: m.machineNo,
        name: m.name,
        type: m.type,
        status: m.status,
        currentBatchId: m.currentBatchId,
        plan: plan
          ? { batchNo: plan.batchNo, orderNo: plan.orderNo, startDate: plan.startDate!, endDate: plan.endDate!, started: plan.status === "in_progress", overdue: plan.endDate! < today }
          : null,
        morePlans: Math.max(0, held.length - 1),
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
      <PageHeader title="🏭 Machines" description="Live status of every machine on the floor, with the start and end date of the plan it is in." />
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
