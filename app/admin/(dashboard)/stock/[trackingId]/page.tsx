import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/kpi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ACCESS, requireRole } from "@/lib/auth/session";
import { getStockOrder } from "@/lib/data";
import { formatDate, todayIso } from "@/lib/dates";
import { formatINR, formatNumber } from "@/lib/money";
import { isOpenStockOrder, nextStockStep, normalizeTrackingId, STOCK_ORDER_LABEL, STOCK_ORDER_STEPS } from "@/lib/stock";
import { StockOrderPill } from "../../stock-box";
import { StockOrderControls } from "../../stock-forms";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Where one stock order is, from the supplier to the store room. */
export default async function StockOrderPage({ params }: { params: Promise<{ trackingId: string }> }) {
  await requireRole(ACCESS.stock);
  const order = await getStockOrder(normalizeTrackingId((await params).trackingId));
  if (!order) notFound();

  const today = todayIso();
  const open = isOpenStockOrder(order);
  const next = nextStockStep(order.status);
  // The first time each stage was reached.
  const reachedAt = new Map<string, string>();
  for (const e of order.events) if (!reachedAt.has(e.status)) reachedAt.set(e.status, e.at);
  const stageNo = STOCK_ORDER_STEPS.findIndex((s) => s.status === order.status);
  const late = open && order.expectedOn < today;
  const facts: [string, string][] = [
    ["Material", order.materialName],
    ["Quantity", `${formatNumber(order.quantity)} ${order.unit}`],
    ["Supplier", order.supplier],
    ["Rate", order.ratePaise > 0 ? `${formatINR(order.ratePaise)} per ${order.unit}` : "Not entered"],
    ["Order value", order.ratePaise > 0 ? formatINR(order.quantity * order.ratePaise, { whole: true }) : "—"],
    ["Ordered", `${when(order.orderedAt)} by ${order.orderedBy}`],
  ];

  return (
    <>
      <PageHeader title={`🚚 ${order.trackingId}`} description={`${formatNumber(order.quantity)} ${order.unit} of ${order.materialName} from ${order.supplier}`}>
        <Link href="/admin/stock" className="text-sm underline">← All stock orders</Link>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">Tracking <StockOrderPill status={order.status} /></CardTitle>
          <CardDescription>
            {order.status === "received" && order.receivedAt
              ? `Received on ${when(order.receivedAt)}. ${formatNumber(order.quantity)} ${order.unit} was added to the stock.`
              : order.status === "cancelled"
                ? "This order was cancelled. Nothing was added to the stock."
                : late
                  ? `Was expected on ${formatDate(order.expectedOn, true)} and has not arrived yet.`
                  : `Expected on ${formatDate(order.expectedOn, true)}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <ol className="grid gap-4 sm:grid-cols-4">
            {STOCK_ORDER_STEPS.map((step, i) => {
              const at = reachedAt.get(step.status);
              const done = order.status !== "cancelled" ? i <= stageNo : !!at;
              return (
                <li key={step.status} className={`grid gap-1 rounded-xl border p-3 text-sm ${done ? "border-teal bg-teal-soft/50" : "border-dashed text-muted-foreground"}`}>
                  <span className={`grid size-7 place-items-center rounded-full text-xs font-bold ${done ? "bg-teal text-white" : "bg-muted"}`}>
                    {done ? <Check className="size-4" aria-hidden="true" /> : i + 1}
                  </span>
                  <span className="font-semibold">{step.label}</span>
                  <span className="text-xs">{at ? when(at) : done ? "" : "Waiting"}</span>
                </li>
              );
            })}
          </ol>
          {open && next && <StockOrderControls trackingId={order.trackingId} nextAction={next.action} />}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Order details</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b pb-2 last:border-b-0">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>History</CardTitle></CardHeader>
          <CardContent>
            <ol className="grid gap-2 border-l-2 border-brand/30 pl-4 text-sm">
              {[...order.events].sort((a, b) => b.at.localeCompare(a.at)).map((e, i) => (
                <li key={e.at + i} className="relative">
                  <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-brand ring-2 ring-background" />
                  {/* A note added without a change of stage shows only its text. */}
                  {reachedAt.get(e.status) === e.at ? <span className="font-medium">{STOCK_ORDER_LABEL[e.status]}</span> : null}
                  {e.note && <span>{reachedAt.get(e.status) === e.at ? " — " : ""}{e.note}</span>}
                  <span className="block text-xs text-muted-foreground">{when(e.at)} · {e.by}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
