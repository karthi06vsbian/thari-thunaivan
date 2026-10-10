import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { addDays, formatDate, todayIso } from "@/lib/dates";
import { db } from "@/lib/firebase/admin";
import { formatINR, formatNumber } from "@/lib/money";
import { SITE } from "@/lib/site";
import type { Batch, Order } from "@/lib/types";
import { signOut } from "@/lib/auth/actions";
import { OrderForm } from "./order-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `My orders – ${SITE.name}` };

const STATUS_LABEL: Record<Order["status"], string> = {
  requested: "Waiting for confirmation",
  rejected: "Declined",
  confirmed: "Confirmed",
  in_production: "In production",
  completed: "Completed",
};

export default async function PortalPage() {
  const user = await requireRole(["client"]);
  // Only this client's orders are ever read here.
  const orderSnap = await db().collection("orders").where("clientUid", "==", user.uid).get();
  const orders = orderSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Order)
    .sort((a, b) => (b.requestedAt ?? "").localeCompare(a.requestedAt ?? ""));
  const batches = new Map<string, Batch>();
  await Promise.all(
    orders
      .filter((o) => o.status === "confirmed" || o.status === "in_production" || o.status === "completed")
      .map(async (o) => {
        const snap = await db().collection("batches").where("orderId", "==", o.id).limit(1).get();
        const doc = snap.docs[0];
        if (doc) batches.set(o.id, { id: doc.id, ...doc.data() } as Batch);
      }),
  );

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="text-lg font-semibold tracking-tight">{SITE.name}</Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm"><LogOut /> Sign out</Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.name}</h1>
          <p className="text-sm text-muted-foreground">Place a new order or check on the ones you have with us.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Place an order</CardTitle>
            <CardDescription>
              We check loom availability and confirm the price and delivery date before weaving starts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrderForm
              fabrics={SITE.fabrics.map(({ name, value }) => ({ name, value }))}
              minDate={addDays(todayIso(), 1)}
              defaults={{ company: user.company ?? user.name, phone: user.phone ?? "" }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>My orders</CardTitle></CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">You have not placed any orders yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Fabric</TableHead>
                    <TableHead className="text-right">Meters</TableHead>
                    <TableHead>Needed by</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                    <TableHead>Expected finish</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => {
                    const batch = batches.get(o.id);
                    const progress = batch && batch.meters > 0 ? Math.min(100, Math.round((batch.producedMeters / batch.meters) * 100)) : null;
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{o.orderNo}</TableCell>
                        <TableCell className="capitalize">{o.fabricType} · {o.widthInches}&quot;</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(o.meters)}</TableCell>
                        <TableCell>{formatDate(o.deadline, true)}</TableCell>
                        <TableCell>{STATUS_LABEL[o.status]}</TableCell>
                        <TableCell className="text-right tabular-nums">{progress !== null && o.status !== "confirmed" ? `${progress}%` : "—"}</TableCell>
                        <TableCell>{batch?.endDate ? formatDate(batch.endDate, true) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{o.ratePerMeterPaise > 0 ? `${formatINR(o.ratePerMeterPaise)} / m` : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
