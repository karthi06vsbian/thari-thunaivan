import { Kpi, PageHeader } from "@/components/kpi";
import { TruckScene } from "@/components/truck-scene";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACCESS, requireRole } from "@/lib/auth/session";
import { getBatches, getOrders } from "@/lib/data";
import { addDays, formatDate, todayIso } from "@/lib/dates";
import { formatNumber } from "@/lib/money";
import { getShipments } from "@/lib/transport/data";
import { routeById, routeKm, ROUTES } from "@/lib/transport/routes";
import { LiveMap, type LiveTruck } from "./live-map";
import { DispatchForm, ShipmentControls } from "./transport-forms";

const DAY_MS = 86_400_000;
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const daysBetween = (from: string, to: string) =>
  Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / DAY_MS);

export default async function TransportPage() {
  await requireRole(ACCESS.transport);
  const today = todayIso();
  const [shipments, orders, batches] = await Promise.all([getShipments(), getOrders(), getBatches()]);
  const onRoad = shipments.filter((s) => s.status === "in_transit");
  const delivered = shipments.filter((s) => s.status === "delivered");
  const shipped = new Set(shipments.map((s) => s.orderNo));
  const ready = orders.filter((o) => o.status === "completed" && !shipped.has(o.orderNo));
  const inProduction = batches.filter((b) => b.status === "in_progress" && b.endDate);
  const goingOut = onRoad.length + ready.length;

  const deliveryDays = delivered
    .filter((s) => s.deliveredAt)
    .map((s) => (new Date(s.deliveredAt!).getTime() - new Date(s.dispatchedAt).getTime()) / DAY_MS);
  const avgDays = deliveryDays.length ? deliveryDays.reduce((a, b) => a + b, 0) / deliveryDays.length : null;

  const trucks: LiveTruck[] = onRoad.map((s) => ({
    id: s.id, orderNo: s.orderNo, customerName: s.customerName, routeId: s.routeId,
    vehicleNo: s.vehicleNo, driverName: s.driverName, dispatchedAt: s.dispatchedAt,
    demoCycleSeconds: s.demoCycleSeconds ?? null, sample: !!s.sample, deliveryAddress: s.deliveryAddress ?? null,
  }));
  const routeOptions = ROUTES.map((r) => ({ id: r.id, label: `${r.destination} · ${Math.round(routeKm(r))} km · ${r.days} day${r.days > 1 ? "s" : ""}` }));

  return (
    <>
      <PageHeader title="🚚 Transport" description="Orders going out, where each truck is, and how long each delivery takes." />

      <div className="relative overflow-hidden rounded-2xl border">
        <TruckScene className="block h-40 w-full sm:h-48" />
        <div className="absolute inset-0 flex items-center bg-gradient-to-r from-black/45 via-black/10 to-transparent p-6 text-white">
          <div>
            <p className="text-sm font-medium tracking-widest text-white/80 uppercase">Going out now</p>
            <p className="text-4xl font-bold tabular-nums">{goingOut} order{goingOut === 1 ? "" : "s"}</p>
            <p className="text-sm text-white/85">{onRoad.length} on the road · {ready.length} ready to load</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Orders going out" value={String(goingOut)} hint={`${onRoad.length} on the road, ${ready.length} ready to load`} />
        <Kpi label="Trucks on the road" value={String(new Set(onRoad.map((s) => s.vehicleNo)).size)} hint={`${formatNumber(onRoad.reduce((sum, s) => sum + s.meters, 0))} m on board`} />
        <Kpi label="Delivered" value={String(delivered.length)} hint={avgDays === null ? undefined : `${avgDays.toFixed(1)} days on average`} />
        <Kpi label="Finishing soon" value={String(inProduction.length)} hint="orders still on the looms" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>🗺️ Live truck location</CardTitle>
          <CardDescription>Click a truck to zoom to it.</CardDescription>
        </CardHeader>
        <CardContent><LiveMap trucks={trucks} /></CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>🛣️ On the road</CardTitle>
          <CardDescription>Days to complete each delivery, with the latest updates from the route.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {onRoad.length === 0 && <p className="text-sm text-muted-foreground">Nothing is on the road.</p>}
          {onRoad.map((s) => {
            const route = routeById(s.routeId);
            const days = route?.days ?? 1;
            const dispatchDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(s.dispatchedAt));
            const eta = addDays(dispatchDate, days);
            const dayNo = Math.min(days, daysBetween(dispatchDate, today) + 1);
            const left = Math.max(0, daysBetween(today, eta));
            return (
              <div key={s.id} className="grid gap-3 rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {s.orderNo} · {s.customerName}
                      {s.sample && <span className="ml-2 rounded-full bg-teal-soft px-2 py-0.5 text-xs font-medium text-teal">Sample</span>}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatNumber(s.meters)} m <span className="capitalize">{s.fabricType}</span> · Erode → {route?.destination ?? s.routeId} ·{" "}
                      {route ? `${Math.round(routeKm(route))} km` : ""} · truck {s.vehicleNo} · driver {s.driverName}
                    </p>
                    {s.deliveryAddress && <p className="text-sm"><span className="text-muted-foreground">Deliver to: </span>{s.deliveryAddress}</p>}
                  </div>
                  <dl className="flex gap-6 text-right text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Delivery time</dt>
                      <dd className="font-semibold">Day {dayNo} of {days}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Expected</dt>
                      <dd className="font-semibold">{formatDate(eta)} · {left === 0 ? "today" : `${left} day${left > 1 ? "s" : ""} left`}</dd>
                    </div>
                  </dl>
                </div>
                <ol className="grid gap-2 border-l-2 border-brand/30 pl-4 text-sm">
                  {[...s.updates].sort((a, b) => b.at.localeCompare(a.at)).map((u, i) => (
                    <li key={u.at + i} className="relative">
                      <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-brand ring-2 ring-background" />
                      {u.text}
                      <span className="block text-xs text-muted-foreground">{when(u.at)} · {u.by}</span>
                    </li>
                  ))}
                </ol>
                <ShipmentControls shipmentId={s.id} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>📦 Ready to load</CardTitle>
            <CardDescription>Finished orders waiting for a truck.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {ready.length === 0 && <p className="text-sm text-muted-foreground">No finished orders are waiting.</p>}
            {ready.map((o) => (
              <div key={o.id} className="grid gap-2 rounded-xl border p-3 text-sm">
                <p>
                  <span className="font-semibold">{o.orderNo}</span> · {o.customerName} · {formatNumber(o.meters)} m{" "}
                  <span className="capitalize">{o.fabricType}</span>
                </p>
                <DispatchForm orderId={o.id} routes={routeOptions} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>🧵 Coming off the looms</CardTitle>
            <CardDescription>Days until each order is finished and ready for a truck.</CardDescription>
          </CardHeader>
          <CardContent>
            {inProduction.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders are in production.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Meters</TableHead>
                    <TableHead className="text-right">Done</TableHead>
                    <TableHead>Finishes</TableHead>
                    <TableHead className="text-right">Days left</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inProduction.map((b) => {
                    const left = daysBetween(today, b.endDate!);
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.orderNo}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(b.meters)}</TableCell>
                        <TableCell className="text-right tabular-nums">{b.meters > 0 ? Math.min(100, Math.round((b.producedMeters / b.meters) * 100)) : 0}%</TableCell>
                        <TableCell>{formatDate(b.endDate, true)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{left <= 0 ? "Due" : left}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>✅ Delivered</CardTitle></CardHeader>
        <CardContent>
          {delivered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deliveries recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Truck</TableHead>
                  <TableHead>Dispatched</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead className="text-right">Days taken</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {delivered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.orderNo}{s.sample && <span className="ml-2 text-xs font-normal text-teal">Sample</span>}</TableCell>
                    <TableCell>{s.customerName}</TableCell>
                    <TableCell>{routeById(s.routeId)?.destination ?? s.routeId}</TableCell>
                    <TableCell>{s.vehicleNo}</TableCell>
                    <TableCell>{when(s.dispatchedAt)}</TableCell>
                    <TableCell>{s.deliveredAt ? when(s.deliveredAt) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.deliveredAt ? ((new Date(s.deliveredAt).getTime() - new Date(s.dispatchedAt).getTime()) / DAY_MS).toFixed(1) : "—"}
                    </TableCell>
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
