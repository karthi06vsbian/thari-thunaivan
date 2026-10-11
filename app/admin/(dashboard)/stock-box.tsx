import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/money";
import type { StockAdvice, StockLevel } from "@/lib/stock";
import { MaterialDialog } from "./stock-forms";

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

export function StockBox({ advice }: { advice: StockAdvice[] }) {
  const toOrder = advice.filter((a) => a.orderQty > 0);
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
          <MaterialDialog />
        </div>
      </CardHeader>
      <CardContent>
        {advice.length === 0 ? (
          <p className="text-sm text-muted-foreground">No materials listed yet. Add the yarns and other materials you keep in stock.</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {advice.map(({ material: m, needed, level, orderQty }) => (
              <li key={m.id} className={`grid gap-1 rounded-xl border border-l-4 p-3 text-sm ${TINT[level]}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">
                    {m.name}
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${PILL[level]}`}>{LABEL[level]}</span>
                  </p>
                  <MaterialDialog material={m} />
                </div>
                <p>
                  <span className="text-lg font-bold tabular-nums">{formatNumber(m.stock)} {m.unit}</span> in stock
                  <span className="text-muted-foreground"> · low below {formatNumber(m.minStock)} {m.unit} · open orders need {formatNumber(needed)} {m.unit}</span>
                </p>
                {orderQty > 0 ? (
                  <p className="font-medium">🛒 Order {formatNumber(orderQty)} {m.unit} to finish the open orders and stay above the low-stock level.</p>
                ) : (
                  <p className="text-muted-foreground">No need to order now.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
