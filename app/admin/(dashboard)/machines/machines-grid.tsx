"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { MachineStatus } from "@/lib/planning/types";
import { scheduleMaintenance, updateMachineStatus } from "./actions";

export interface MachineCard {
  id: string;
  machineNo: string;
  name: string;
  type: string;
  status: MachineStatus;
  currentBatchId: string | null;
  /** The plan holding this machine; it cannot go into another until that plan is completed. */
  plan: { batchNo: string; orderNo: string; startDate: string; endDate: string; started: boolean; overdue: boolean } | null;
  /** Further plans the machine is also in. */
  morePlans: number;
  todayOutput: number;
  todayHours: number;
  efficiencyPercent: number;
  ratedOutputPerHour: number;
  powerKw: number;
  maintenanceDueAt: string | null;
  maintenanceSoon: boolean;
}

const STATUSES: MachineStatus[] = ["running", "idle", "maintenance", "breakdown"];

// Status colours are always paired with the status word, never used alone.
const STATUS_STYLE: Record<MachineStatus, { card: string; dot: string }> = {
  running: { card: "border-l-emerald-600", dot: "bg-emerald-600" },
  idle: { card: "border-l-zinc-400", dot: "bg-zinc-400" },
  maintenance: { card: "border-l-amber-500", dot: "bg-amber-500" },
  breakdown: { card: "border-l-red-600 bg-red-50", dot: "bg-red-600" },
};

export function MachinesGrid({ machines }: { machines: MachineCard[] }) {
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [planned, setPlanned] = useState("all");
  const [pending, startTransition] = useTransition();
  const types = useMemo(() => [...new Set(machines.map((m) => m.type))], [machines]);
  const shown = machines.filter(
    (m) =>
      (type === "all" || m.type === type) &&
      (status === "all" || m.status === status) &&
      (planned === "all" || (planned === "in" ? !!m.plan : !m.plan)),
  );
  const inPlan = machines.filter((m) => m.plan).length;

  function act(action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message ?? "Saved");
      else toast.error(result.error ?? "Failed");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Type
          <NativeSelect value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex items-center gap-2 text-sm">
          Status
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex items-center gap-2 text-sm">
          Plan
          <NativeSelect value={planned} onChange={(e) => setPlanned(e.target.value)}>
            <option value="all">All machines</option>
            <option value="in">In a plan</option>
            <option value="free">Not in a plan</option>
          </NativeSelect>
        </label>
        <p className="text-sm text-muted-foreground">
          Showing {shown.length} of {machines.length} · {inPlan} in a plan, {machines.length - inPlan} not in a plan
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {shown.map((m) => (
          <div
            key={m.id}
            className={cn("grid gap-2 rounded-xl border border-l-4 bg-card p-3 text-sm", STATUS_STYLE[m.status].card)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{m.machineNo}</p>
                <p className="truncate text-xs text-muted-foreground">{m.name}</p>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-medium capitalize">
                <span className={cn("size-2 rounded-full", STATUS_STYLE[m.status].dot)} />
                {m.status}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="text-right font-medium">
                {m.plan ? `${m.plan.batchNo} · ${m.plan.orderNo}` : "Not in a plan"}
                {m.plan && !m.plan.started && <span className="block font-normal text-muted-foreground">not started yet</span>}
              </dd>
              <dt className="text-muted-foreground">Start date</dt>
              <dd className="text-right font-medium">{m.plan ? formatDate(m.plan.startDate, true) : "—"}</dd>
              <dt className="text-muted-foreground">End date</dt>
              <dd className={cn("text-right font-medium", m.plan?.overdue && "text-red-700")}>
                {m.plan ? formatDate(m.plan.endDate, true) : "—"}
                {m.plan?.overdue && <span className="block font-normal">overdue</span>}
              </dd>
              {m.morePlans > 0 && (
                <dd className="col-span-2 text-right text-muted-foreground">also in {m.morePlans} more plan{m.morePlans === 1 ? "" : "s"}</dd>
              )}
              <dt className="text-muted-foreground">Output today</dt>
              <dd className="text-right font-medium tabular-nums">
                {m.todayHours > 0 ? `${Math.round(m.todayOutput).toLocaleString("en-IN")} m` : "—"}
              </dd>
              <dt className="text-muted-foreground">Efficiency</dt>
              <dd className="text-right font-medium tabular-nums">{m.efficiencyPercent}%</dd>
              <dt className="text-muted-foreground">Rated</dt>
              <dd className="text-right tabular-nums">{m.ratedOutputPerHour} m/hr · {m.powerKw} kW</dd>
            </dl>
            <div className="grid gap-2 border-t pt-2">
              <NativeSelect
                aria-label={`Status of ${m.machineNo}`}
                value={m.status}
                disabled={pending}
                onChange={(e) => act(() => updateMachineStatus(m.id, e.target.value))}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </NativeSelect>
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const due = String(new FormData(e.currentTarget).get("due") ?? "");
                  act(() => scheduleMaintenance(m.id, due));
                }}
              >
                <Input
                  name="due"
                  type="date"
                  aria-label={`Maintenance due date for ${m.machineNo}`}
                  defaultValue={m.maintenanceDueAt ?? ""}
                  className="h-7 min-w-0 flex-1 text-xs"
                />
                <Button type="submit" size="sm" variant="outline" disabled={pending}>Set</Button>
              </form>
              <p className={cn("text-xs text-muted-foreground", m.maintenanceSoon && "font-medium text-amber-700")}>
                {m.maintenanceSoon ? "Maintenance due within 7 days" : "Maintenance due date"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
