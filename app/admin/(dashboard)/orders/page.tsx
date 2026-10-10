import Link from "next/link";
import { AlertTriangle, Clock, Package, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/kpi";
import { ACCESS, requireRole } from "@/lib/auth/session";
import { batchCosting } from "@/lib/costing/power";
import { getBatches, getOrders } from "@/lib/data";
import { formatDate, todayIso } from "@/lib/dates";
import { formatINR, formatNumber } from "@/lib/money";
import type { Batch } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RequestActions } from "./request-actions";

const DUE_SOON_DAYS = 3;

const daysUntil = (date: string, today: string) =>
  Math.round((new Date(`${date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000);

type Urgency = "overdue" | "soon" | "ok" | "done";

/** How pressing a deadline is. Finished work is never urgent. */
function urgencyOf(deadline: string | undefined, today: string, finished: boolean): { level: Urgency; days: number } {
  if (!deadline) return { level: "ok", days: 0 };
  const days = daysUntil(deadline, today);
  if (finished) return { level: "done", days };
  return { level: days < 0 ? "overdue" : days <= DUE_SOON_DAYS ? "soon" : "ok", days };
}

// Urgency and status colours are always shown together with the words they stand for.
const DEADLINE_PILL: Record<Urgency, string> = {
  overdue: "bg-red-600 text-white",
  soon: "bg-amber-500 text-white",
  ok: "bg-teal text-white",
  done: "bg-zinc-200 text-zinc-800",
};
const ROW_TINT: Record<Urgency, string> = {
  overdue: "border-l-4 border-l-red-600 bg-red-50",
  soon: "border-l-4 border-l-amber-500 bg-amber-50",
  ok: "border-l-4 border-l-transparent",
  done: "border-l-4 border-l-transparent",
};
const STATUS_PILL: Record<Batch["status"], string> = {
  pending: "bg-zinc-500 text-white",
  planned: "bg-indigo-600 text-white",
  in_progress: "bg-teal text-white",
  completed: "bg-emerald-600 text-white",
};
const STATUS_BAR: Record<Batch["status"], string> = {
  pending: "bg-zinc-400",
  planned: "bg-indigo-600",
  in_progress: "bg-indigo-600",
  completed: "bg-emerald-600",
};

function deadlineText(deadline: string | undefined, u: { level: Urgency; days: number }): string {
  const date = formatDate(deadline, true);
  if (u.level === "done") return date;
  if (u.level === "overdue") return `${date} (${-u.days}d over)`;
  return `${date} (${u.days === 0 ? "today" : `${u.days}d`})`;
}

function Tile({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Package; tone: "violet" | "teal" | "green" | "red" }) {
  const tones = {
    violet: { card: "border-violet-300 bg-violet-100", icon: "bg-violet-600", text: "text-violet-800" },
    teal: { card: "border-teal/40 bg-teal-soft", icon: "bg-teal", text: "text-teal" },
    green: { card: "border-emerald-300 bg-emerald-100", icon: "bg-emerald-600", text: "text-emerald-800" },
    red: { card: "border-red-300 bg-red-100", icon: "bg-red-600", text: "text-red-700" },
  }[tone];
  return (
    <div className={cn("lift flex items-center justify-between gap-3 rounded-2xl border p-4", tones.card)}>
      <span className={cn("grid size-14 place-items-center rounded-xl text-white shadow-sm", tones.icon)}>
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <div className="text-right">
        <p className={cn("text-4xl leading-none font-bold tabular-nums", tones.text)}>{value}</p>
        <p className="mt-1 text-sm font-medium">{label}</p>
      </div>
    </div>
  );
}

export default async function OrdersPage() {
  const user = await requireRole(ACCESS.orders);
  const [orders, batches] = await Promise.all([getOrders(), getBatches()]);
  const today = todayIso();
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const canPlan = ACCESS.planning.includes(user.role);
  const requests = orders
    .filter((o) => o.status === "requested")
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  const live = orders.filter((o) => o.status !== "rejected");
  const inProduction = batches.filter((b) => b.status === "in_progress").length;
  const completed = live.filter((o) => o.status === "completed").length;
  const overdue = live.filter((o) => o.status !== "completed" && o.deadline < today).length;

  return (
    <>
      <PageHeader
        title="📦 Orders & costing"
        description="Manage orders, monitor production status, and view costing and profitability."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Total orders" value={live.length} icon={Package} tone="violet" />
        <Tile label="In production" value={inProduction} icon={Clock} tone="teal" />
        <Tile label="Completed" value={completed} icon={TrendingUp} tone="green" />
        <Tile label="Overdue" value={overdue} icon={AlertTriangle} tone="red" />
      </div>

      {requests.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-amber-300 bg-amber-50">
          <h2 className="flex items-center gap-2 border-b border-amber-200 bg-amber-100 px-4 py-3 font-semibold">
            <span aria-hidden="true">🔔</span> New order requests from clients
            <span className="grid min-w-6 place-items-center rounded-full bg-amber-500 px-1.5 text-sm text-white">{requests.length}</span>
          </h2>
          <ul className="divide-y divide-amber-200">
            {requests.map((o) => {
              const u = urgencyOf(o.deadline, today, false);
              return (
                <li
                  key={o.id}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 border-l-4 px-4 py-3 text-sm",
                    u.level === "overdue" ? "border-l-red-600" : u.level === "soon" ? "border-l-amber-500" : "border-l-transparent",
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-semibold">
                      #{o.orderNo} · {o.customerName}
                      {o.clientPhone && (
                        <a className="ml-2 font-normal underline" href={`tel:${o.clientPhone}`}>{o.clientPhone}</a>
                      )}
                    </p>
                    <p>
                      {formatNumber(o.meters)} m <span className="capitalize">{o.fabricType}</span> {o.widthInches}&quot; · needed by{" "}
                      {formatDate(o.deadline, true)} ·{" "}
                      {u.level === "overdue" ? (
                        <span className="font-semibold text-red-700"><span aria-hidden="true">⚠ </span>{-u.days}d overdue!</span>
                      ) : (
                        <span className={cn("font-medium", u.level === "soon" ? "text-amber-700" : "text-teal")}>
                          {u.days === 0 ? "due today" : `${u.days}d left`}
                        </span>
                      )}
                    </p>
                    {o.deliveryAddress && <p className="mt-1"><span className="text-muted-foreground">Deliver to: </span>{o.deliveryAddress}</p>}
                    {o.confirmMode === "prepaid" && (
                      <p className="mt-1 font-medium text-amber-800">
                        💳 Prepaid · waiting for the client to pay {formatINR(o.advancePaise ?? 0, { whole: true })} advance online
                      </p>
                    )}
                    {o.appointment && (
                      <p className="mt-1 font-medium text-teal">
                        🤝 Cash on confirmation · visit booked {formatDate(o.appointment.date, true)}, {o.appointment.slot}
                      </p>
                    )}
                    {o.notes && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{o.notes}</p>}
                  </div>
                  {canPlan && <RequestActions orderId={o.id} />}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Batches</h2>
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted text-left">
              <tr>
                {["Order", "Customer", "Fabric", "Deadline", "Status", "Machines", "Produced / ordered", "Cost/m", "Profit", ""].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const order = orderById.get(b.orderId);
                // Material, labour and overhead are budgeted for the whole batch; scale them to what is made so far.
                const done = b.meters > 0 ? Math.min(1, b.producedMeters / b.meters) : 0;
                const costing = batchCosting(
                  {
                    ...b,
                    materialCostPaise: Math.round(b.materialCostPaise * done),
                    labourCostPaise: Math.round(b.labourCostPaise * done),
                    overheadCostPaise: Math.round(b.overheadCostPaise * done),
                  },
                  order?.ratePerMeterPaise ?? 0,
                );
                const started = b.producedMeters > 0;
                const u = urgencyOf(order?.deadline, today, b.status === "completed");
                const percent = Math.round(done * 100);
                return (
                  <tr key={b.id} className={cn("border-t", ROW_TINT[u.level])}>
                    <td className="px-3 py-3 font-medium">
                      {b.orderNo}
                      <span className="block text-xs font-normal text-muted-foreground">{b.batchNo}</span>
                    </td>
                    <td className="px-3 py-3">{order?.customerName}</td>
                    <td className="px-3 py-3 capitalize">{b.fabricType} · {b.widthInches}&quot;</td>
                    <td className="px-3 py-3">
                      <span className={cn("inline-block rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap", DEADLINE_PILL[u.level])}>
                        {deadlineText(order?.deadline, u)}
                        {u.level === "overdue" && <span aria-hidden="true"> ⚠</span>}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("inline-block rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap", STATUS_PILL[b.status])}>
                        {b.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{b.machineIds.length || "—"}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-between gap-2 text-xs tabular-nums">
                        <span className="text-muted-foreground">{formatNumber(Math.round(b.producedMeters))} / {formatNumber(b.meters)} m</span>
                        <span className="font-medium">{percent}%</span>
                      </div>
                      <div className="mt-1 h-2 w-36 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full", STATUS_BAR[b.status])} style={{ width: `${percent}%` }} />
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{started ? formatINR(costing.costPerMeterPaise) : "—"}</td>
                    <td className={cn("px-3 py-3 font-medium tabular-nums", started && (costing.profitPaise >= 0 ? "text-emerald-700" : "text-red-700"))}>
                      {started ? formatINR(costing.profitPaise, { whole: true }) : "—"}
                      {started && <span className="block text-xs font-normal text-muted-foreground">power {formatINR(b.powerCostPaise, { whole: true })}</span>}
                    </td>
                    <td className="px-3 py-3">
                      {canPlan && b.status !== "completed" && (
                        <Link
                          href={`/admin/planning?batch=${b.id}`}
                          className="inline-block rounded-lg bg-brand px-3 py-1.5 text-xs font-medium whitespace-nowrap text-white transition-colors hover:bg-brand-dark"
                        >
                          {b.status === "pending" ? "Plan" : "Re-plan"}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
