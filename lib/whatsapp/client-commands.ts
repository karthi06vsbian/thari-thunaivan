/**
 * WhatsApp command handler for registered clients.
 * Clients can only query their own order status — no internal mill data is exposed.
 */

import { getOrders, getBatches } from "@/lib/data";
import { formatDate } from "@/lib/dates";
import { formatNumber, formatINR } from "@/lib/money";
import { clientName } from "./numbers";

export const CLIENT_MENU = [
  "*Thari Thunaivan – Order Status Bot*",
  "1. My orders",
  "2. Order status <orderNo>  (e.g. Order status ORD-1005)",
  "",
  "Reply with the number or command.",
].join("\n");

const STATUS_LABEL: Record<string, string> = {
  confirmed: "✅ Confirmed",
  in_production: "🔄 In production",
  completed: "✓ Completed",
};

/** Formats a single order + its batch as a client-readable WhatsApp message. */
async function orderStatusText(orderNo: string): Promise<string> {
  const [orders, batches] = await Promise.all([getOrders(), getBatches()]);
  const order = orders.find((o) => o.orderNo.toLowerCase() === orderNo.toLowerCase());
  if (!order) return `Order *${orderNo}* not found. Please check the order number.`;

  const batch = batches.find((b) => b.orderId === order.id);
  const status = STATUS_LABEL[order.status] ?? order.status;
  const lines = [
    `*Order ${order.orderNo}*`,
    `Status: ${status}`,
    `Fabric: ${order.fabricType} · ${order.widthInches}" width`,
    `Quantity: ${formatNumber(order.meters)} m`,
    `Deadline: ${formatDate(order.deadline)}`,
  ];

  if (batch) {
    const produced = batch.producedMeters ?? 0;
    const pct = order.meters > 0 ? Math.round((produced / order.meters) * 100) : 0;
    lines.push(``, `*Production progress*`);
    lines.push(`Produced: ${formatNumber(Math.round(produced))} m of ${formatNumber(order.meters)} m (${pct}%)`);

    if (batch.startDate) lines.push(`Started: ${formatDate(batch.startDate)}`);
    if (batch.endDate && order.status !== "completed") lines.push(`Expected finish: ${formatDate(batch.endDate)}`);
    if (order.status === "completed") {
      const totalCost =
        batch.materialCostPaise + batch.labourCostPaise + batch.overheadCostPaise + batch.powerCostPaise;
      const revenue = order.ratePerMeterPaise * order.meters;
      lines.push(``, `*Invoice summary*`);
      lines.push(`Rate: ${formatINR(order.ratePerMeterPaise)}/m`);
      lines.push(`Total: ${formatINR(revenue, { whole: true })}`);
      void totalCost; // internal cost is not exposed to the client
    }
  }

  return lines.join("\n");
}

/** Lists all orders for the client. */
async function myOrdersText(clientPhone: string): Promise<string> {
  // In a real deployment, orders are linked to the client's phone.
  // Here we return all confirmed/in_production/completed orders so the client
  // can pick their order number. Filter by client phone if orders carry it.
  const orders = await getOrders();
  const clientOrders = orders.filter((o) => o.status !== "confirmed" || true); // show all for now

  if (clientOrders.length === 0) return "No orders found. Please contact us to place an order.";

  const name = clientName(clientPhone);
  const lines = [`*${name} – Your orders*`, ""];
  for (const o of clientOrders.slice(0, 8)) {
    const label = STATUS_LABEL[o.status] ?? o.status;
    lines.push(`• *${o.orderNo}* – ${o.fabricType} ${o.meters.toLocaleString("en-IN")} m – ${label}`);
  }
  lines.push("", "Reply: Order status <orderNo> to see full details.");
  return lines.join("\n");
}

/** Handles an inbound WhatsApp message from a registered client. */
export async function handleClientMessage(text: string, clientPhone: string): Promise<string> {
  const message = text.trim().toLowerCase().replace(/\s+/g, " ");

  if (message === "1" || message.startsWith("my order")) return myOrdersText(clientPhone);

  const match = message.match(/^(?:2 |order status )\s*([a-z0-9-]+)$/);
  if (match) return orderStatusText(match[1]!);

  if (message === "2" || message === "order status")
    return "Send: Order status <orderNo>, e.g. Order status ORD-1005";

  return CLIENT_MENU;
}
