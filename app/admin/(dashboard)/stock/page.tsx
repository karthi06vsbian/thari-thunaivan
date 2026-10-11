import { redirect } from "next/navigation";
import { Kpi, PageHeader } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACCESS, requireRole } from "@/lib/auth/session";
import { getBatches, getMaterials, getOrders, getStockOrder, getStockOrders } from "@/lib/data";
import { formatDate, todayIso } from "@/lib/dates";
import { formatINR, formatNumber } from "@/lib/money";
import { isOpenStockOrder, normalizeTrackingId, stockAdvice } from "@/lib/stock";
import { StockBox, StockOrderPill, TrackingLink } from "../stock-box";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });

export default async function StockPage({ searchParams }: { searchParams: Promise<{ track?: string }> }) {
  await requireRole(ACCESS.stock);
  const { track } = await searchParams;
  const typed = track?.trim() ? normalizeTrackingId(track) : null;
  if (typed && (await getStockOrder(typed))) redirect(`/admin/stock/${typed}`);

  const today = todayIso();
  const [materials, orders, batches, stockOrders] = await Promise.all([getMaterials(), getOrders(), getBatches(), getStockOrders()]);
  const advice = stockAdvice(materials, orders, batches, stockOrders);
  const open = stockOrders.filter(isOpenStockOrder).sort((a, b) => a.expectedOn.localeCompare(b.expectedOn));
  const closed = stockOrders.filter((s) => !isOpenStockOrder(s));
  const late = open.filter((s) => s.expectedOn < today);
  const openValue = open.reduce((sum, s) => sum + s.quantity * s.ratePaise, 0);

  return (
    <>
      <PageHeader title="📦 Stock & orders" description="Order materials from suppliers and follow each delivery by its tracking ID.">
        <form className="flex items-end gap-2">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Track a stock order
            <Input name="track" required defaultValue={track ?? ""} placeholder="TRK-7F3K9Q2A" className="w-44 font-mono" />
          </label>
          <Button type="submit" variant="outline">Track</Button>
        </form>
      </PageHeader>
      {typed && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
          No stock order has the tracking ID <span className="font-mono font-semibold">{typed}</span>. Check the ID and try again.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Materials to order" value={String(advice.filter((a) => a.orderQty > 0).length)} hint={`of ${materials.length} on the stock list`} />
        <Kpi label="Orders on the way" value={String(open.length)} hint={openValue > 0 ? `${formatINR(openValue, { whole: true })} of material` : undefined} />
        <Kpi label="Running late" value={String(late.length)} hint="past the expected delivery date" />
        <Kpi label="Received" value={String(closed.filter((s) => s.status === "received").length)} hint="stock orders completed" />
      </div>

      <StockBox advice={advice} stockOrders={stockOrders} today={today} />

      <Card>
        <CardHeader>
          <CardTitle>🚚 Stock on the way</CardTitle>
          <CardDescription>Open a tracking ID to see where the delivery is and to move it to the next step.</CardDescription>
        </CardHeader>
        <CardContent>
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing is on order. Use the Order button on a material above.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking ID</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ordered</TableHead>
                  <TableHead>Expected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {open.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell><TrackingLink trackingId={s.trackingId} /></TableCell>
                    <TableCell className="font-medium">{s.materialName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(s.quantity)} {s.unit}</TableCell>
                    <TableCell>{s.supplier}</TableCell>
                    <TableCell><StockOrderPill status={s.status} /></TableCell>
                    <TableCell>{day(s.orderedAt)}</TableCell>
                    <TableCell>
                      {formatDate(s.expectedOn)}
                      {s.expectedOn < today && <span className="ml-2 font-medium text-red-700">late</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>✅ Received and cancelled</CardTitle></CardHeader>
        <CardContent>
          {closed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stock order has been completed yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking ID</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ordered</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closed.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell><TrackingLink trackingId={s.trackingId} /></TableCell>
                    <TableCell className="font-medium">{s.materialName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(s.quantity)} {s.unit}</TableCell>
                    <TableCell>{s.supplier}</TableCell>
                    <TableCell><StockOrderPill status={s.status} /></TableCell>
                    <TableCell>{day(s.orderedAt)}</TableCell>
                    <TableCell>{s.receivedAt ? day(s.receivedAt) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.ratePaise > 0 ? formatINR(s.quantity * s.ratePaise, { whole: true }) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
