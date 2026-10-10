import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { addDays, todayIso } from "@/lib/dates";
import { razorpayConfigured } from "@/lib/payments/razorpay";
import { SITE } from "@/lib/site";
import { OrderForm } from "../order-form";
import { PortalShell } from "../portal-shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `New order – ${SITE.name}` };

export default async function NewOrderPage() {
  const user = await requireRole(["client"]);
  return (
    <PortalShell user={user}>
      <div>
        <Link href="/portal" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← My orders</Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand"><span aria-hidden="true">🛒</span> Place a new order</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Four quick steps</CardTitle>
          <CardDescription>
            Pick the fabric, give the size and quantity, tell us where and when, then confirm.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrderForm
            fabrics={SITE.fabrics.map(({ name, value, ratePerMeter, image, detail }) => ({ name, value, ratePerMeter, image, detail }))}
            today={todayIso()}
            minDate={addDays(todayIso(), 1)}
            defaults={{ company: user.company ?? user.name, phone: user.phone ?? "", address: user.address ?? "" }}
            advancePercent={SITE.advancePercent}
            visitSlots={SITE.visitSlots}
            onlinePayment={razorpayConfigured()}
            companyName={SITE.name}
          />
        </CardContent>
      </Card>
    </PortalShell>
  );
}
