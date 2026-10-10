import { NativeSelect, PageHeader } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ACCESS, requireRole } from "@/lib/auth/session";
import { allocationsFromBatches, getBatches, getMachines, getOrders, getPlans, getShiftSettings } from "@/lib/data";
import { addDays, formatDate, isIsoDate, todayIso } from "@/lib/dates";
import { formatINR, formatNumber } from "@/lib/money";
import type { PlanOption } from "@/lib/planning/types";
import { computePlan } from "@/lib/services/planning";
import { PlanButtons } from "./plan-buttons";
import { Timeline } from "./timeline";

function OptionDetails({ option }: { option: PlanOption }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-medium">Each day: machines used and electricity</h3>
        <div className="max-h-80 overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Machines</TableHead>
                <TableHead className="text-right">Meters</TableHead>
                <TableHead className="text-right">kWh</TableHead>
                <TableHead className="text-right">Power cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {option.daily.slice(0, 60).map((d) => (
                <TableRow key={d.date}>
                  <TableCell>{formatDate(d.date)}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.machinesRunning}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(Math.round(d.meters))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(Math.round(d.units))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(d.costPaise, { whole: true })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {option.daily.length > 60 && (
          <p className="mt-1 text-xs text-muted-foreground">Showing the first 60 of {option.daily.length} days.</p>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">Chosen machines</h3>
        <div className="max-h-80 overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Machine</TableHead>
                <TableHead className="text-right">m / day</TableHead>
                <TableHead className="text-right">Meters</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">kWh</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {option.perMachine.map((m) => (
                <TableRow key={m.machineId}>
                  <TableCell className="font-medium">{m.machineNo}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(Math.round(m.metersPerDay))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(Math.round(m.plannedMeters))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(Math.round(m.runningHours))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(Math.round(m.units))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string; start?: string; shifts?: string; overtime?: string }>;
}) {
  await requireRole(ACCESS.planning);
  const params = await searchParams;
  const today = todayIso();
  const [batches, orders, machines, shiftSettings, plans] = await Promise.all([
    getBatches(),
    getOrders(),
    getMachines(),
    getShiftSettings(),
    getPlans(8),
  ]);
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const open = batches.filter((b) => b.status !== "completed");
  const startDate = isIsoDate(params.start) && params.start >= today ? params.start : today;
  const shiftsPerDay = Math.min(Math.max(1, Number(params.shifts) || 2), shiftSettings.shifts.length);
  const allowOvertime = params.overtime === "on";
  const selected = open.find((b) => b.id === params.batch);

  const plan = selected
    ? await computePlan({ batchId: selected.id, startDate, shiftsPerDay, allowOvertime })
    : null;
  const options = plan ? [plan.result.recommended, ...plan.result.alternatives] : [];
  const rec = plan?.result.recommended;

  const allocations = allocationsFromBatches(batches, selected?.id);
  const lastEnd = allocations.reduce((max, a) => (a.endDate > max ? a.endDate : max), addDays(today, 14));
  const timelineTo = [lastEnd, plan?.order.deadline, rec?.estimatedFinishDate]
    .filter((d): d is string => !!d)
    .reduce((max, d) => (d > max ? d : max));

  return (
    <>
      <PageHeader
        title="Planning"
        description="Pick an order to see how many machines it needs, when it will finish and what the power will cost."
      />
      <Card>
        <CardHeader><CardTitle>Plan an order</CardTitle></CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs text-muted-foreground">
              Order / batch
              <NativeSelect name="batch" defaultValue={selected?.id ?? ""} required className="min-w-72">
                <option value="" disabled>Select an order…</option>
                {open.map((b) => {
                  const o = orderById.get(b.orderId);
                  return (
                    <option key={b.id} value={b.id}>
                      {b.orderNo} · {b.batchNo} · {formatNumber(b.meters)} m {b.fabricType} · due {formatDate(o?.deadline)} · {b.status.replace("_", " ")}
                    </option>
                  );
                })}
              </NativeSelect>
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Start date
              <Input type="date" name="start" defaultValue={startDate} min={today} className="w-40" />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Shifts per day
              <NativeSelect name="shifts" defaultValue={String(shiftsPerDay)}>
                {shiftSettings.shifts.map((_, i) => (
                  <option key={i} value={i + 1}>{i + 1}</option>
                ))}
              </NativeSelect>
            </label>
            <label className="flex h-8 items-center gap-2 text-sm">
              <input type="checkbox" name="overtime" defaultChecked={allowOvertime} className="size-4" />
              Allow overtime
            </label>
            <Button type="submit">Recommend</Button>
          </form>
        </CardContent>
      </Card>

      {plan && rec && (
        <Card>
          <CardHeader>
            <CardDescription>
              {plan.order.orderNo} · {plan.order.customerName} · {formatNumber(plan.inputs.meters)} m{" "}
              {plan.inputs.fabricType} at {plan.inputs.widthInches}&quot; · due {formatDate(plan.order.deadline, true)}
              {plan.batch.producedMeters > 0 && ` · ${formatNumber(Math.round(plan.batch.producedMeters))} m already made`}
            </CardDescription>
            <CardTitle className="text-xl leading-snug">
              {rec.machinesNeeded} of {plan.result.totalMachines} machines needed,{" "}
              {rec.estimatedFinishDate ? `finishes ${formatDate(rec.estimatedFinishDate)}` : "cannot be finished"}, est.{" "}
              {formatNumber(Math.round(rec.estimatedUnits))} kWh ≈ {formatINR(rec.estimatedPowerCostPaise, { whole: true })}
            </CardTitle>
            <CardDescription>
              {plan.result.eligibleCount} machines can run this fabric and width · power cost{" "}
              {formatINR(rec.powerCostPerMeterPaise)} per meter · {rec.hoursPerDay} hours a day
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {plan.result.warnings.map((w) => (
              <p key={w} role="alert" className="rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm">
                {w}
              </p>
            ))}
            <Tabs defaultValue={rec.key + "-0"}>
              <TabsList className="h-auto flex-wrap">
                {options.map((o, i) => (
                  <TabsTrigger key={o.key + i} value={`${o.key}-${i}`}>
                    {i === 0 && o.key !== "recommended" ? `Recommended: ${o.label}` : o.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {options.map((o, i) => (
                <TabsContent key={o.key + i} value={`${o.key}-${i}`} className="space-y-4 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm">
                      <span className="font-medium">{o.machinesNeeded} machines</span> ·{" "}
                      {o.estimatedFinishDate ? `finishes ${formatDate(o.estimatedFinishDate, true)}` : "no finish date"}
                      {o.feasible ? "" : " (after the deadline)"} · {formatNumber(Math.round(o.estimatedUnits))} kWh ·{" "}
                      {formatINR(o.estimatedPowerCostPaise, { whole: true })} · {formatINR(o.powerCostPerMeterPaise)} / m ·{" "}
                      {o.hoursPerDay} hrs/day
                    </p>
                    <PlanButtons
                      canApply={o.machinesNeeded > 0 && !!o.estimatedFinishDate}
                      input={{ batchId: plan.batch.id, startDate, shiftsPerDay, allowOvertime, planKey: o.key }}
                    />
                  </div>
                  <OptionDetails option={o} />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Machine timeline</CardTitle>
          <CardDescription>Every machine against the coming days, with all current allocations.</CardDescription>
        </CardHeader>
        <CardContent>
          <Timeline
            machines={machines.filter((m) => m.active)}
            allocations={allocations}
            proposed={
              plan && rec?.estimatedFinishDate
                ? { label: plan.batch.batchNo, machineIds: rec.machineIds, startDate, endDate: rec.estimatedFinishDate }
                : null
            }
            from={today}
            to={timelineTo}
            shiftSettings={shiftSettings}
            today={today}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent plans</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Machines</TableHead>
                <TableHead>Finish</TableHead>
                <TableHead className="text-right">Est. power</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.batchId}</TableCell>
                  <TableCell className="capitalize">{p.status}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.machinesNeeded}</TableCell>
                  <TableCell>{formatDate(p.estimatedFinishDate, true)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(Math.round(p.estimatedUnits))} kWh · {formatINR(p.estimatedPowerCostPaise, { whole: true })}
                  </TableCell>
                  <TableCell>{p.createdBy}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
