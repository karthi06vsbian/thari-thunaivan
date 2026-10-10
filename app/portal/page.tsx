import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, PackagePlus } from "lucide-react";
import { LazyLiveMap as LiveMap } from "@/components/lazy-live-map";
import { OrderTracker } from "@/components/order-tracker";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { formatINR, formatNumber } from "@/lib/money";
import { getClientOrders } from "@/lib/portal-data";
import { SITE } from "@/lib/site";
import { STAGE_EMOJI, trackOrder } from "@/lib/tracking";
import { cn } from "@/lib/utils";
import { PayNowButton } from "./pay-now-button";
import { PortalShell } from "./portal-shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `My orders – ${SITE.name}` };

export default async function PortalPage() {
  const user = await requireRole(["client"]);
  const orders = await getClientOrders(user.uid);
  const tracked = orders.map((o) => ({ ...o, tracking: trackOrder(o.order, o.batch, o.bundles, o.shipment) }));
  const active = tracked.filter((t) => !t.tracking.declined && t.tracking.current).length;

  return (
    <PortalShell user={user}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand">Welcome, {user.name} <span aria-hidden="true">👋</span></h1>
          <p className="text-sm text-muted-foreground">
            {orders.length === 0
              ? "You have no orders yet. Place your first one to get started."
              : `${active} order${active === 1 ? "" : "s"} in progress · ${orders.length} in total`}
          </p>
        </div>
        <Link href="/portal/new" className={cn(buttonVariants({ size: "lg" }), "btn-shine")}>
          <PackagePlus /> Place new order
        </Link>
      </div>

      {tracked.length === 0 && (
        <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed bg-card p-10 text-center">
          <PackagePlus className="size-10 text-brand" aria-hidden="true" />
          <p className="font-semibold"><span aria-hidden="true">🧺</span> No orders yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Choose a fabric, width and quantity. You can pay an advance online or book a visit to confirm.
          </p>
          <Link href="/portal/new" className={buttonVariants({ size: "lg" })}>Place an order</Link>
        </div>
      )}

      {tracked.map(({ order: o, shipment, tracking }) => {
        const waitingForPayment = o.confirmMode === "prepaid" && o.paymentStatus !== "paid" && o.status === "requested";
        return (
          <article key={o.id} className="lift grid gap-4 rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {o.orderNo}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {formatNumber(o.meters)} m <span className="capitalize">{o.fabricType}</span> · {o.widthInches}&quot;
                  </span>
                </h2>
                <p className="text-sm text-muted-foreground">
                  Needed by {formatDate(o.deadline, true)}
                  {o.ratePerMeterPaise > 0 && ` · ${formatINR(o.ratePerMeterPaise)} per meter`}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  tracking.declined ? "bg-destructive/10 text-destructive" : tracking.current ? "bg-teal-soft text-teal" : "bg-emerald-100 text-emerald-800",
                )}
              >
                {tracking.declined ? "❌ Declined" : tracking.current ? `${STAGE_EMOJI[tracking.current.key]} ${tracking.current.label}` : "📦 Delivered"}
              </span>
            </div>

            <OrderTracker tracking={tracking} compact />

            {shipment?.status === "in_transit" && (
              <div className="grid gap-2 rounded-xl border bg-brand-soft/40 p-3">
                <p className="text-sm font-semibold text-brand"><span aria-hidden="true">🚚</span> Out for delivery – live tracking</p>
                <LiveMap
                  compact
                  trucks={[{
                    id: shipment.id, orderNo: shipment.orderNo, customerName: shipment.customerName, routeId: shipment.routeId,
                    vehicleNo: shipment.vehicleNo, driverName: shipment.driverName, dispatchedAt: shipment.dispatchedAt,
                    demoCycleSeconds: shipment.demoCycleSeconds ?? null, sample: !!shipment.sample,
                    deliveryAddress: o.deliveryAddress ?? shipment.deliveryAddress ?? null,
                  }]}
                />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <p className="text-sm">
                <span className="font-medium"><span aria-hidden="true">🔔</span> Latest: </span>
                {tracking.declined
                  ? "Declined by the mill."
                  : shipment?.updates.length
                    ? [...shipment.updates].sort((a, b) => b.at.localeCompare(a.at))[0]!.text
                    : (tracking.current?.detail ?? "Delivered and unloaded.")}
              </p>
              <div className="flex items-center gap-2">
                {waitingForPayment && <PayNowButton orderId={o.id} companyName={SITE.name} />}
                <Link href={`/portal/orders/${o.id}`} className={cn(buttonVariants({ variant: "outline" }), "group")}>
                  Track order <ArrowRight className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </article>
        );
      })}
    </PortalShell>
  );
}
