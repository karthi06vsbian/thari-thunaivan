import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays, formatDate } from "@/lib/dates";
import { formatNumber } from "@/lib/money";
import { isOpenStockOrder, STOCK_ORDER_LABEL, type StockAdvice, type StockLevel } from "@/lib/stock";
import type { StockOrder, StockOrderStatus } from "@/lib/types";
import { MaterialDialog, OrderStockDialog } from "./stock-forms";

// Colours are always shown together with the words they stand for.
const TINT: Record<StockLevel, string> = {
  out: "border-l-red-600 bg-red-50",
  low: "border-l-red-600 bg-red-50",
  short: "border-l-amber-500 bg-amber-50",
  ok: "border-l-teal",
};
const PILL: Record<StockLevel, string> = {
  out: "bg-red-600 text-white",
  low: "bg-red-600 text-white",
  short: "bg-amber-500 text-white",
  ok: "bg-teal text-white",
};
const LABEL: Record<StockLevel, string> = {
  out: "Out of stock",
  low: "Low stock",
  short: "Not enough for open orders",
  ok: "Enough",
};
export const STOCK_ORDER_PILL: Record<StockOrderStatus, string> = {
  ordered: "bg-zinc-500 text-white",
  confirmed: "bg-indigo-600 text-white",
  dispatched: "bg-amber-500 text-white",
  received: "bg-teal text-white",
  cancelled: "bg-zinc-200 text-zinc-800",
};

export function StockOrderPill({ status }: { status: StockOrderStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STOCK_ORDER_PILL[status]}`}>{STOCK_ORDER_LABEL[status]}</span>;
}

export function TrackingLink({ trackingId }: { trackingId: string }) {
  return <Link href={`/admin/stock/${trackingId}`} className="font-mono font-semibold text-brand underline underline-offset-4">{trackingId}</Link>;
}

export function StockBox({
  advice,
  stockOrders,
  today,
  linkToOrders = false,
}: {
  advice: StockAdvice[];
  stockOrders: StockOrder[];
  today: string;
  /** Shows a link to the full stock orders page; left off on that page itself. */
  linkToOrders?: boolean;
}) {
  const toOrder = advice.filter((a) => a.orderQty > 0);
  const defaultExpected = addDays(today, 3);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>
              📦 Material stock
              {toOrder.length > 0 && <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">{toOrder.length} to order</span>}
            </CardTitle>
            <CardDescription>What is in the store, what the open orders still need, and what to buy.</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {linkToOrders && <Link href="/admin/stock" className="text-sm underline underline-offset-4">Stock orders & tracking →</Link>}
            <MaterialDialog />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {advice.length === 0 ? (
          <p className="text-sm text-muted-foreground">No materials listed yet. Add the yarns and other materials you keep in stock.</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {advice.map(({ material: m, needed, level, onOrder, orderQty }) => {
              // Newest first, so the first one is also the last supplier used.
              const own = stockOrders.filter((s) => s.materialId === m.id);
              const coming = own.filter(isOpenStockOrder);
              const last = own[0];
              return (
                <li key={m.id} className={`grid gap-1 rounded-xl border border-l-4 p-3 text-sm ${TINT[level]}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                      {m.name}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${PILL[level]}`}>{LABEL[level]}</span>
                    </p>
                    <div className="flex shrink-0 gap-2">
                      <OrderStockDialog
                        material={m}
                        suggested={orderQty}
                        today={today}
                        defaultExpected={defaultExpected}
                        last={last && { supplier: last.supplier, rateRupees: last.ratePaise / 100 }}
                      />
                      <MaterialDialog material={m} />
                    </div>
                  </div>
                  <p>
                    <span className="text-lg font-bold tabular-nums">{formatNumber(m.stock)} {m.unit}</span> in stock
                    <span className="text-muted-foreground"> · low below {formatNumber(m.minStock)} {m.unit} · open orders need {formatNumber(needed)} {m.unit}</span>
                  </p>
                  {coming.map((s) => (
                    <p key={s.id}>
                      🚚 {formatNumber(s.quantity)} {s.unit} on order · <TrackingLink trackingId={s.trackingId} /> · {STOCK_ORDER_LABEL[s.status].toLowerCase()} ·{" "}
                      {s.expectedOn < today ? <span className="font-medium text-red-700">was due {formatDate(s.expectedOn)}</span> : `expected ${formatDate(s.expectedOn)}`}
                    </p>
                  ))}
                  {orderQty > 0 ? (
                    <p className="font-medium">
                      🛒 Order {formatNumber(orderQty)} {m.unit}{onOrder > 0 ? " more" : ""} to finish the open orders and stay above the low-stock level.
                    </p>
                  ) : (
                    <p className="text-muted-foreground">{onOrder > 0 && level !== "ok" ? "Enough is on order. No need to buy more now." : "No need to order now."}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
