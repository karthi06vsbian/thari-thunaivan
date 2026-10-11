import { Kpi, PageHeader } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACCESS, requireRole } from "@/lib/auth/session";
import { formatDate, todayIso } from "@/lib/dates";
import { formatINR, formatNumber } from "@/lib/money";
import { calcPay, isMonth, JOB_ROLES, monthEnd, monthLabel, serviceLabel } from "@/lib/payroll";
import { getShipments } from "@/lib/transport/data";
import { getMonthPay, getPayRules, getWorkers, tripsByDriver } from "@/lib/workers/data";
import { AddWorkerForm, ManageWorker, PayRulesForm, type WorkerRow } from "./worker-forms";

const inr = (paise: number) => formatINR(paise, { whole: true });
const Tag = ({ children, tone }: { children: React.ReactNode; tone: "teal" | "brand" | "muted" }) => (
  <span
    className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
      tone === "teal" ? "bg-teal-soft text-teal" : tone === "brand" ? "bg-brand-soft text-brand" : "bg-muted text-muted-foreground"
    }`}
  >
    {children}
  </span>
);

export default async function WorkersPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireRole(ACCESS.workers);
  const params = await searchParams;
  const today = todayIso();
  const thisMonth = today.slice(0, 7);
  const month = isMonth(params.month) && params.month <= thisMonth ? params.month : thisMonth;
  // Service and increments are counted up to the end of the month being paid.
  const asOf = month === thisMonth ? today : monthEnd(month);

  const [workers, monthPay, rules, shipments] = await Promise.all([getWorkers(), getMonthPay(month), getPayRules(), getShipments()]);
  const trips = tripsByDriver(shipments, month);
  const all: WorkerRow[] = workers
    .filter((w) => w.joinedOn <= monthEnd(month))
    .map((worker) => {
      const pay = monthPay.get(worker.id) ?? null;
      const trip = trips.get(worker.id);
      return { worker, pay, trips: trip?.trips ?? 0, slip: calcPay(worker, pay ?? undefined, trip?.paise ?? 0, rules, asOf) };
    });
  // Someone who has left still counts for a month they were paid in.
  const rows = all.filter((r) => r.worker.active || r.pay);

  const net = (r: WorkerRow) => r.pay?.paidNetPaise ?? r.slip.netPaise;
  const total = rows.reduce((sum, r) => sum + net(r), 0);
  const paid = rows.filter((r) => r.pay?.paidAt);
  const newJoiners = rows.filter((r) => r.slip.isNewJoiner);
  const due = rows.filter((r) => r.slip.incrementDue);
  const noHours = rows.filter((r) => !r.pay);

  return (
    <>
      <PageHeader title="👷 Workers & salary" description="Every worker's details, hours, service, bonus and increments, and what each is paid for the month.">
        <form className="flex items-end gap-2">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Salary month
            <Input type="month" name="month" defaultValue={month} max={thisMonth} required />
          </label>
          <Button type="submit" variant="outline">Show</Button>
        </form>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Workers" value={String(rows.length)} hint={`${rows.filter((r) => r.worker.jobRole === "driver").length} drivers`} />
        <Kpi label={`Salary for ${monthLabel(month)}`} value={inr(total)} hint={`${paid.length} of ${rows.length} paid${noHours.length ? ` · ${noHours.length} without hours` : ""}`} />
        <Kpi label="New to the job" value={String(newJoiners.length)} hint={`joined in the last ${rules.newJoinerMonths} months`} />
        <Kpi label="Increment due" value={String(due.length)} hint={`${rules.incrementEveryMonths} months or more since the last one`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>💰 Salary for {monthLabel(month)}</CardTitle>
          <CardDescription>
            Pay = hours × hourly rate (monthly salary ÷ {rules.hoursPerMonth} h) + overtime at {rules.overtimeMultiplier}× + service allowance
            ({rules.servicePercentPerYear}% for each completed year, up to {rules.serviceMaxPercent}%) + trip pay + bonus − deductions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {all.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workers yet. Add the first one below.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead className="text-right">Salary / month</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Hours pay</TableHead>
                  <TableHead className="text-right">Overtime</TableHead>
                  <TableHead className="text-right">Service</TableHead>
                  <TableHead className="text-right">Trips</TableHead>
                  <TableHead className="text-right">Bonus</TableHead>
                  <TableHead className="text-right">Deduction</TableHead>
                  <TableHead className="text-right">Net pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {all.map((r) => {
                  const { worker: w, slip, pay } = r;
                  return (
                    <TableRow key={w.id} className={w.active ? "" : "opacity-60"}>
                      <TableCell>
                        <p className="font-medium">
                          {w.name}
                          {slip.isNewJoiner && <Tag tone="teal">New</Tag>}
                          {slip.incrementDue && <Tag tone="brand">Increment due</Tag>}
                          {!w.active && <Tag tone="muted">Left</Tag>}
                        </p>
                        <p className="text-xs text-muted-foreground">{w.workerNo} · {JOB_ROLES[w.jobRole]}{w.phone ? ` · ${w.phone}` : ""}</p>
                      </TableCell>
                      <TableCell>
                        {serviceLabel(slip.serviceMonths)}
                        <span className="block text-xs text-muted-foreground">since {formatDate(w.joinedOn, true)}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{inr(w.monthlyPaise)}</TableCell>
                      <TableCell className="text-right tabular-nums">{pay ? formatNumber(pay.hoursWorked) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr(slip.basePaise)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {slip.overtimeHours > 0 ? inr(slip.overtimePaise) : "—"}
                        {slip.overtimeHours > 0 && <span className="block text-xs text-muted-foreground">{formatNumber(slip.overtimeHours)} h</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {slip.servicePercent > 0 ? inr(slip.servicePaise) : "—"}
                        {slip.servicePercent > 0 && <span className="block text-xs text-muted-foreground">{slip.servicePercent}%</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.trips > 0 ? inr(slip.tripPaise) : "—"}
                        {r.trips > 0 && <span className="block text-xs text-muted-foreground">{r.trips} trip{r.trips === 1 ? "" : "s"}</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {slip.bonusPaise > 0 ? inr(slip.bonusPaise) : "—"}
                        {pay?.bonusNote && <span className="block text-xs text-muted-foreground">{pay.bonusNote}</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {slip.deductionPaise > 0 ? inr(slip.deductionPaise) : "—"}
                        {pay?.deductionNote && <span className="block text-xs text-muted-foreground">{pay.deductionNote}</span>}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{inr(net(r))}</TableCell>
                      <TableCell>
                        {pay?.paidAt ? <span className="font-medium text-teal">Paid</span> : pay ? "To pay" : <span className="text-muted-foreground">{w.active ? "Hours not entered" : "—"}</span>}
                      </TableCell>
                      <TableCell><ManageWorker row={r} month={month} rules={rules} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>➕ Add a worker</CardTitle>
          <CardDescription>The salary is for a full month of {rules.hoursPerMonth} hours.</CardDescription>
        </CardHeader>
        <CardContent><AddWorkerForm today={today} /></CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>⚙️ Pay rules</CardTitle>
          <CardDescription>How hours, years of service and the new-joiner period turn into pay. Changes apply to every month that is not yet paid.</CardDescription>
        </CardHeader>
        <CardContent><PayRulesForm rules={rules} canEdit={user.role === "owner"} /></CardContent>
      </Card>
    </>
  );
}
