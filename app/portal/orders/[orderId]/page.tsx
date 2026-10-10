import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LazyLiveMap as LiveMap } from "@/components/lazy-live-map";
import { OrderTracker } from "@/components/order-tracker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { addDays, formatDate } from "@/lib/dates";
import { formatINR, formatNumber } from "@/lib/money";
import { Stars } from "@/components/stars";
import { getClientOrder } from "@/lib/portal-data";
import { getReview } from "@/lib/reviews";
import { SITE } from "@/lib/site";
import { orderEvents, STAGE_EMOJI, trackOrder } from "@/lib/tracking";
import { routeById, routeKm } from "@/lib/transport/routes";
import { PayNowButton } from "../../pay-now-button";
import { ReviewForm } from "../../review-form";
import { PortalShell } from "../../portal-shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Track order – ${SITE.name}` };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

export default async function OrderTrackingPage({ params }: { params: Promise<{ orderId: string }> }) {
  const user = await requireRole(["client"]);
  const { orderId } = await params;
  // Returns nothing for an order that belongs to someone else.
  const found = await getClientOrder(user.uid, orderId.toUpperCase());
  if (!found) notFound();
  const { order: o, batch, bundles, shipment } = found;
  const tracking = trackOrder(o, batch, bundles, shipment);
  const events = orderEvents(o, batch, bundles, shipment);
  const delivered = shipment?.status === "delivered";
  const review = delivered ? await getReview(o.orderNo) : null;

  const woven = batch && batch.meters > 0 ? Math.min(100, Math.round((batch.producedMeters / batch.meters) * 100)) : 0;
  const checked = bundles.filter((b) => b.status !== "pending");
  const scores = checked.filter((b) => typeof b.qualityScore === "number").map((b) => b.qualityScore!);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const route = shipment ? routeById(shipment.routeId) : undefined;
  const eta = shipment && route
    ? addDays(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(shipment.dispatchedAt)), route.days)
    : null;
  const waitingForPayment = o.confirmMode === "prepaid" && o.paymentStatus !== "paid" && o.status === "requested";
  const address = o.deliveryAddress ?? shipment?.deliveryAddress ?? null;
  const orderValue = o.ratePerMeterPaise > 0 ? o.meters * o.ratePerMeterPaise : null;

  return (
    <PortalShell user={user}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/portal" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← My orders</Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand">Order {o.orderNo}</h1>
          <p className="text-sm text-muted-foreground">
            {formatNumber(o.meters)} m <span className="capitalize">{o.fabricType}</span> · {o.widthInches}&quot; wide
          </p>
        </div>
        {waitingForPayment && <PayNowButton orderId={o.id} companyName={SITE.name} />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {tracking.declined ? "❌ Order declined" : tracking.current ? `${STAGE_EMOJI[tracking.current.key]} Now: ${tracking.current.label}` : "📦 Delivered"}
          </CardTitle>
          {tracking.current && <CardDescription>{tracking.current.detail}</CardDescription>}
        </CardHeader>
        <CardContent><OrderTracker tracking={tracking} /></CardContent>
      </Card>

      {shipment?.status === "in_transit" && route && (
        <Card>
          <CardHeader>
            <CardTitle><span aria-hidden="true">🚚</span> Your order is on the way</CardTitle>
            <CardDescription>
              Truck {shipment.vehicleNo} · driver {shipment.driverName} · Erode → {route.destination} ({Math.round(routeKm(route))} km) ·
              expected {formatDate(eta, true)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LiveMap
              trucks={[{
                id: shipment.id, orderNo: shipment.orderNo, customerName: shipment.customerName, routeId: shipment.routeId,
                vehicleNo: shipment.vehicleNo, driverName: shipment.driverName, dispatchedAt: shipment.dispatchedAt,
                demoCycleSeconds: shipment.demoCycleSeconds ?? null, sample: !!shipment.sample, deliveryAddress: address,
              }]}
            />
          </CardContent>
        </Card>
      )}

      {delivered && (
        <Card>
          <CardHeader>
            <CardTitle><span aria-hidden="true">⭐</span> Rate this order</CardTitle>
            <CardDescription>
              {review ? "Thank you for your review." : "Your order has been delivered. Tell us how it went."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {review ? (
              <div className="grid gap-2 text-sm">
                <Stars rating={review.rating} />
                <p>“{review.text}”</p>
                <p className="text-xs text-muted-foreground">
                  {review.approved ? "Shown on our website." : "Waiting for the mill to approve it for the website."}
                </p>
              </div>
            ) : (
              <ReviewForm orderId={o.id} />
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle><span aria-hidden="true">📋</span> Order details</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Detail label="Fabric"><span className="capitalize">{o.fabricType}</span></Detail>
              <Detail label="Width">{o.widthInches} inches</Detail>
              <Detail label="Quantity">{formatNumber(o.meters)} m</Detail>
              <Detail label="Needed by">{formatDate(o.deadline, true)}</Detail>
              <Detail label="Ordered on">{o.requestedAt ? when(o.requestedAt) : "—"}</Detail>
              <Detail label="Ordered by">{o.customerName}</Detail>
              <Detail label="Price">{o.ratePerMeterPaise > 0 ? `${formatINR(o.ratePerMeterPaise)} per meter` : "To be confirmed"}</Detail>
              <Detail label="Order value">{orderValue !== null ? formatINR(orderValue, { whole: true }) : "To be confirmed"}</Detail>
              <Detail label="Confirmation">
                {o.confirmMode === "prepaid"
                  ? o.paymentStatus === "paid"
                    ? `Advance paid · ${formatINR(o.advancePaise ?? 0, { whole: true })}`
                    : `Advance due · ${formatINR(o.advancePaise ?? 0, { whole: true })}`
                  : o.appointment
                    ? `Visit ${formatDate(o.appointment.date, true)}, ${o.appointment.slot}`
                    : "Confirmed by the mill"}
              </Detail>
              <Detail label="Contact number">{o.clientPhone ?? "—"}</Detail>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground"><span aria-hidden="true">📍</span> Delivery address</dt>
                <dd className="font-medium whitespace-pre-wrap">{address ?? "Not given yet"}</dd>
              </div>
              {o.notes && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Your notes</dt>
                  <dd className="whitespace-pre-wrap">{o.notes}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle><span aria-hidden="true">🏭</span> Production and quality</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm">
            {batch ? (
              <>
                <div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Woven so far</span>
                    <span className="font-medium tabular-nums">
                      {formatNumber(Math.round(Math.min(batch.producedMeters, batch.meters)))} of {formatNumber(batch.meters)} m · {woven}%
                    </span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${woven}%` }} />
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-4">
                  <Detail label="Looms on your order">{batch.machineIds.length || "Being scheduled"}</Detail>
                  <Detail label="Expected to finish weaving">{formatDate(batch.endDate, true)}</Detail>
                  <Detail label="Bundles checked">{bundles.length ? `${checked.length} of ${bundles.length}` : "Not started"}</Detail>
                  <Detail label="Average quality score">{avgScore !== null ? `${avgScore} / 100` : "—"}</Detail>
                </dl>
                {checked.length > 0 && (
                  <ul className="grid gap-1 border-t pt-3">
                    {checked.map((b) => (
                      <li key={b.id} className="flex justify-between gap-3">
                        <span>{b.bundleNo} · {b.lengthMeters} m × {b.widthInches}&quot; · grade {b.grade}</span>
                        <span className="font-medium">
                          {b.status === "pass" ? "Passed" : b.status === "rework" ? "Rework" : "Rejected"}
                          {typeof b.qualityScore === "number" && ` · ${b.qualityScore}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Production details appear here once the order is confirmed.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle><span aria-hidden="true">🔔</span> Updates</CardTitle>
          <CardDescription>Everything that has happened to this order, newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No updates yet.</p>
          ) : (
            <ol className="grid gap-3 border-l-2 border-brand/30 pl-4 text-sm">
              {events.map((e, i) => (
                <li key={e.at + i} className="relative">
                  <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-brand ring-2 ring-background" />
                  <p className="font-medium">{e.title}</p>
                  {e.text && <p className="text-muted-foreground">{e.text}</p>}
                  <p className="text-xs text-muted-foreground">{when(e.at)}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </PortalShell>
  );
}
