import Link from "next/link";
import { PageHeader } from "@/components/kpi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACCESS, requireRole } from "@/lib/auth/session";
import { batchCosting } from "@/lib/costing/power";
import { getBatches, getOrders } from "@/lib/data";
import { formatDate } from "@/lib/dates";
import { formatINR, formatNumber } from "@/lib/money";
import { RequestActions } from "./request-actions";

export default async function OrdersPage() {
  const user = await requireRole(ACCESS.orders);
  const [orders, batches] = await Promise.all([getOrders(), getBatches()]);
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const canPlan = ACCESS.planning.includes(user.role);
  const requests = orders.filter((o) => o.status === "requested");

  return (
    <>
      <PageHeader
        title="📦 Orders & costing"
        description="Each batch with its machines, progress and cost per meter. Power cost comes from the machine energy logged against the batch."
      />
      {requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>New order requests from clients</CardTitle>
            <CardDescription>
              Accepting sets the price and makes the order ready to plan. Check Planning first if the date looks tight.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {requests.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <div>
                  <p>
                    <span className="font-medium">{o.orderNo}</span> · {o.customerName}
                    {o.clientPhone && <> · <a className="underline" href={`tel:${o.clientPhone}`}>{o.clientPhone}</a></>}
                  </p>
                  <p className="text-muted-foreground">
                    {formatNumber(o.meters)} m <span className="capitalize">{o.fabricType}</span> at {o.widthInches}&quot; · needed by{" "}
                    {formatDate(o.deadline, true)}
                  </p>
                  {o.deliveryAddress && <p className="mt-1"><span className="text-muted-foreground">Deliver to: </span>{o.deliveryAddress}</p>}
                  {o.confirmMode === "prepaid" && (
                    <p className="mt-1 font-medium text-amber-700">
                      Prepaid · waiting for the client to pay {formatINR(o.advancePaise ?? 0, { whole: true })} advance online
                    </p>
                  )}
                  {o.appointment && (
                    <p className="mt-1 font-medium text-teal">
                      Cash on confirmation · visit booked {formatDate(o.appointment.date, true)}, {o.appointment.slot}
                    </p>
                  )}
                  {o.notes && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{o.notes}</p>}
                </div>
                {canPlan && <RequestActions orderId={o.id} />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Fabric</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Machines</TableHead>
                <TableHead className="text-right">Produced / ordered (m)</TableHead>
                <TableHead className="text-right">Power cost</TableHead>
                <TableHead className="text-right">Cost / m</TableHead>
                <TableHead className="text-right">Profit so far</TableHead>
                {canPlan && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
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
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">
                      {b.orderNo}
                      <span className="block text-xs font-normal text-muted-foreground">{b.batchNo}</span>
                    </TableCell>
                    <TableCell>{order?.customerName}</TableCell>
                    <TableCell className="capitalize">{b.fabricType} · {b.widthInches}&quot;</TableCell>
                    <TableCell>{formatDate(order?.deadline, true)}</TableCell>
                    <TableCell className="capitalize">{b.status.replace("_", " ")}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.machineIds.length || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(Math.round(b.producedMeters))} / {formatNumber(b.meters)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{started ? formatINR(b.powerCostPaise, { whole: true }) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{started ? formatINR(costing.costPerMeterPaise) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{started ? formatINR(costing.profitPaise, { whole: true }) : "—"}</TableCell>
                    {canPlan && (
                      <TableCell>
                        {b.status !== "completed" && (
                          <Link className="text-sm underline" href={`/admin/planning?batch=${b.id}`}>
                            {b.status === "pending" ? "Plan" : "Re-plan"}
                          </Link>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
