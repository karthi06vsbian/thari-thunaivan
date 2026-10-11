"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NativeSelect } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { JOB_ROLES, monthLabel, type PaySlip } from "@/lib/payroll";
import type { JobRole, PayRules, Worker, WorkerPay } from "@/lib/types";
import { addWorker, giveIncrement, saveMonthPay, savePayRules, setPaid, updateWorker } from "./actions";

function useAct() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const act = (action: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message ?? "Saved");
        after?.();
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed");
      }
    });
  return { pending, act };
}

function Field({ label, className = "", ...props }: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <label className={`grid gap-1 text-xs text-muted-foreground ${className}`}>
      {label}
      <Input {...props} />
    </label>
  );
}

function RoleSelect({ defaultValue }: { defaultValue?: JobRole }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      Job
      <NativeSelect name="jobRole" required defaultValue={defaultValue ?? "operator"}>
        {Object.entries(JOB_ROLES).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </NativeSelect>
    </label>
  );
}

const text = (f: FormData, key: string) => String(f.get(key) ?? "");
const num = (f: FormData, key: string) => Number(f.get(key) || 0);

export function AddWorkerForm({ today }: { today: string }) {
  const { pending, act } = useAct();
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        act(
          () =>
            addWorker({
              name: text(f, "name"), phone: text(f, "phone"), jobRole: text(f, "jobRole") as JobRole,
              joinedOn: text(f, "joinedOn"), monthlyRupees: num(f, "monthlyRupees"),
            }),
          () => form.reset(),
        );
      }}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Field label="Name" name="name" required maxLength={60} />
        <Field label="Phone" name="phone" type="tel" maxLength={20} />
        <RoleSelect />
        <Field label="Joined on" name="joinedOn" type="date" required max={today} defaultValue={today} />
        <Field label="Monthly salary (₹)" name="monthlyRupees" type="number" required min={1} step="1" />
      </div>
      <p className="text-xs text-muted-foreground">Drivers can also be added from the Transport page, with their licence and vehicle.</p>
      <Button type="submit" disabled={pending} className="justify-self-start">{pending ? "Adding…" : "Add worker"}</Button>
    </form>
  );
}

export interface WorkerRow {
  worker: Worker;
  pay: WorkerPay | null;
  slip: PaySlip;
  trips: number;
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "border-t pt-1 font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

/** Everything a manager does for one worker: the month's hours and bonus, payment, increments and details. */
export function ManageWorker({ row, month, rules }: { row: WorkerRow; month: string; rules: PayRules }) {
  const { worker, pay, slip, trips } = row;
  const { pending, act } = useAct();
  const [open, setOpen] = useState(false);
  const paid = !!pay?.paidAt;
  const inr = (paise: number) => formatINR(paise, { whole: true });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Manage</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{worker.name} · {worker.workerNo}</DialogTitle>
          <DialogDescription>
            {JOB_ROLES[worker.jobRole]} · joined {formatDate(worker.joinedOn, true)} · {inr(worker.monthlyPaise)} a month ({inr(slip.hourlyPaise)} an hour)
          </DialogDescription>
        </DialogHeader>

        <section className="grid gap-3 sm:grid-cols-2">
          <form
            key={`${month}-${pay?.hoursWorked}-${pay?.bonusPaise}-${pay?.deductionPaise}`}
            className="grid content-start gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              act(() =>
                saveMonthPay(worker.id, {
                  month, hoursWorked: num(f, "hoursWorked"),
                  bonusRupees: num(f, "bonusRupees"), bonusNote: text(f, "bonusNote"),
                  deductionRupees: num(f, "deductionRupees"), deductionNote: text(f, "deductionNote"),
                }),
              );
            }}
          >
            <h3 className="font-semibold">{monthLabel(month)}</h3>
            <fieldset disabled={paid || pending} className="grid gap-3">
              <Field label={`Hours worked (standard ${rules.hoursPerMonth})`} name="hoursWorked" type="number" required min={0} max={744} step="0.5" defaultValue={pay?.hoursWorked ?? ""} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bonus (₹)" name="bonusRupees" type="number" min={0} step="1" defaultValue={pay?.bonusPaise ? pay.bonusPaise / 100 : ""} />
                <Field label="Bonus for" name="bonusNote" maxLength={120} placeholder="e.g. Deepavali" defaultValue={pay?.bonusNote ?? ""} />
                <Field label="Deduction (₹)" name="deductionRupees" type="number" min={0} step="1" defaultValue={pay?.deductionPaise ? pay.deductionPaise / 100 : ""} />
                <Field label="Deduction for" name="deductionNote" maxLength={120} placeholder="e.g. Advance" defaultValue={pay?.deductionNote ?? ""} />
              </div>
              <Button type="submit" className="justify-self-start">Save month</Button>
            </fieldset>
          </form>

          <div className="grid content-start gap-3 rounded-xl border p-3">
            <dl className="grid gap-1 text-sm">
              <Line label={`${slip.regularHours} h at ${inr(slip.hourlyPaise)}`} value={inr(slip.basePaise)} />
              <Line label={`Overtime ${slip.overtimeHours} h × ${rules.overtimeMultiplier}`} value={inr(slip.overtimePaise)} />
              <Line label={`Service allowance ${slip.servicePercent}%`} value={inr(slip.servicePaise)} />
              {worker.jobRole === "driver" && <Line label={`Trip pay · ${trips} trip${trips === 1 ? "" : "s"}`} value={inr(slip.tripPaise)} />}
              <Line label={pay?.bonusNote ? `Bonus · ${pay.bonusNote}` : "Bonus"} value={inr(slip.bonusPaise)} />
              <Line label={pay?.deductionNote ? `Deduction · ${pay.deductionNote}` : "Deduction"} value={`− ${inr(slip.deductionPaise)}`} />
              <Line label={paid ? "Paid" : "Net pay"} value={inr(pay?.paidNetPaise ?? slip.netPaise)} strong />
            </dl>
            {slip.isNewJoiner && rules.newJoinerPayPercent < 100 && (
              <p className="text-xs text-muted-foreground">New joiner: paid {rules.newJoinerPayPercent}% for the first {rules.newJoinerMonths} months.</p>
            )}
            {paid ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                Paid by {pay!.paidBy}
                <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => act(() => setPaid(worker.id, month, false))}>Undo payment</Button>
              </div>
            ) : (
              <Button type="button" disabled={pending || !pay} onClick={() => act(() => setPaid(worker.id, month, true))}>
                {pay ? "Mark as paid" : "Save the hours first"}
              </Button>
            )}
          </div>
        </section>

        <section className="grid gap-3 border-t pt-4">
          <h3 className="font-semibold">Increment</h3>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              act(() => giveIncrement(worker.id, { monthlyRupees: num(f, "monthlyRupees"), note: text(f, "note") }), () => form.reset());
            }}
          >
            <Field label="New monthly salary (₹)" name="monthlyRupees" type="number" required min={1} step="1" placeholder={String(worker.monthlyPaise / 100)} />
            <Field label="Reason" name="note" maxLength={120} placeholder="e.g. Yearly increment" className="flex-1" />
            <Button type="submit" variant="outline" disabled={pending}>Change salary</Button>
          </form>
          {worker.increments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No increments yet. {slip.monthsSinceIncrement} month{slip.monthsSinceIncrement === 1 ? "" : "s"} since joining.</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {[...worker.increments].sort((a, b) => b.on.localeCompare(a.on)).map((i, n) => (
                <li key={i.on + n}>
                  {formatDate(i.on, true)}: {inr(i.fromPaise)} → <span className="font-medium">{inr(i.toPaise)}</span>
                  <span className="text-muted-foreground">{i.note ? ` · ${i.note}` : ""} · {i.by}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-3 border-t pt-4">
          <h3 className="font-semibold">Details</h3>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              act(() =>
                updateWorker(worker.id, {
                  name: text(f, "name"), phone: text(f, "phone"), jobRole: text(f, "jobRole") as JobRole,
                  joinedOn: text(f, "joinedOn"), licenceNo: text(f, "licenceNo"), vehicleNo: text(f, "vehicleNo"),
                  active: f.get("active") === "on",
                }),
              );
            }}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Name" name="name" required maxLength={60} defaultValue={worker.name} />
              <Field label="Phone" name="phone" type="tel" maxLength={20} defaultValue={worker.phone ?? ""} />
              <RoleSelect defaultValue={worker.jobRole} />
              <Field label="Joined on" name="joinedOn" type="date" required defaultValue={worker.joinedOn} />
              <Field label="Licence no. (drivers)" name="licenceNo" maxLength={30} defaultValue={worker.licenceNo ?? ""} />
              <Field label="Vehicle no. (drivers)" name="vehicleNo" maxLength={20} defaultValue={worker.vehicleNo ?? ""} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={worker.active} /> Working at the mill now
            </label>
            <Button type="submit" variant="outline" disabled={pending} className="justify-self-start">Save details</Button>
          </form>
        </section>
      </DialogContent>
    </Dialog>
  );
}

export function PayRulesForm({ rules, canEdit }: { rules: PayRules; canEdit: boolean }) {
  const { pending, act } = useAct();
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        act(() =>
          savePayRules({
            hoursPerMonth: num(f, "hoursPerMonth"), overtimeMultiplier: num(f, "overtimeMultiplier"),
            servicePercentPerYear: num(f, "servicePercentPerYear"), serviceMaxPercent: num(f, "serviceMaxPercent"),
            newJoinerMonths: num(f, "newJoinerMonths"), newJoinerPayPercent: num(f, "newJoinerPayPercent"),
            incrementEveryMonths: num(f, "incrementEveryMonths"),
          }),
        );
      }}
    >
      <fieldset disabled={!canEdit || pending} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Field label="Standard hours a month" name="hoursPerMonth" type="number" required min={1} max={744} step="1" defaultValue={rules.hoursPerMonth} />
        <Field label="Overtime rate (× hourly)" name="overtimeMultiplier" type="number" required min={1} max={3} step="0.05" defaultValue={rules.overtimeMultiplier} />
        <Field label="Service allowance (% per year)" name="servicePercentPerYear" type="number" required min={0} max={20} step="0.5" defaultValue={rules.servicePercentPerYear} />
        <Field label="Service allowance limit (%)" name="serviceMaxPercent" type="number" required min={0} max={100} step="1" defaultValue={rules.serviceMaxPercent} />
        <Field label="New joiner period (months)" name="newJoinerMonths" type="number" required min={0} max={24} step="1" defaultValue={rules.newJoinerMonths} />
        <Field label="New joiner pay (% of salary)" name="newJoinerPayPercent" type="number" required min={50} max={100} step="1" defaultValue={rules.newJoinerPayPercent} />
        <Field label="Increment due every (months)" name="incrementEveryMonths" type="number" required min={1} max={60} step="1" defaultValue={rules.incrementEveryMonths} />
      </fieldset>
      {canEdit ? (
        <Button type="submit" variant="outline" disabled={pending} className="justify-self-start">{pending ? "Saving…" : "Update pay rules"}</Button>
      ) : (
        <p className="text-xs text-muted-foreground">Only the owner can change the pay rules.</p>
      )}
    </form>
  );
}
