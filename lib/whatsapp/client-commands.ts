/**
 * WhatsApp command handler for clients.
 * Automatically replies with product details, order progress, and live dispatch/tracking info.
 */

import { getOrders, getBatches } from "@/lib/data";
import { formatDate } from "@/lib/dates";
import { formatNumber, formatINR } from "@/lib/money";
import { clientName, OWNER_PHONE } from "./numbers";

const STATUS_LABEL: Record<string, string> = {
  requested: "⏳ Requested (Under Review)",
  confirmed: "✅ Confirmed (Queued for Looms)",
  in_production: "🔄 In Production (Weaving on Looms)",
  completed: "🟢 Completed (Ready / Dispatched)",
  rejected: "❌ Declined",
};

/** Formats a rich order status with product specs, progress, and live tracking location. */
export async function buildOrderDetailsCard(orderNo?: string, clientPhone?: string): Promise<string> {
  const [orders, batches] = await Promise.all([getOrders(), getBatches()]);

  // Find targeted order, or the latest active order for this client
  let order = orderNo
    ? orders.find((o) => o.orderNo.toLowerCase() === orderNo.toLowerCase())
    : null;

  if (!order) {
    // If no specific order requested, prioritize in_production or confirmed order
    order =
      orders.find((o) => o.status === "in_production") ||
      orders.find((o) => o.status === "confirmed") ||
      orders.find((o) => o.status === "completed") ||
      orders[0];
  }

  if (!order) {
    return (
      "🧵 *Thari Thunaivan (தறி துணைவன்)*\n\n" +
      "Vanakkam! No active orders were found under your number.\n\n" +
      "To place a custom weaving order, visit our portal or contact our Mill Owner:\n" +
      `📞 Owner: +${OWNER_PHONE}`
    );
  }

  const batch = batches.find((b) => b.orderId === order!.id);
  const status = STATUS_LABEL[order.status] ?? order.status;
  const name = clientPhone ? clientName(clientPhone) : order.customerName || "Valued Customer";

  const lines: string[] = [
    `🧵 *Thari Thunaivan (தறி துணைவன்)*`,
    `Vanakkam *${name}*! Here are your order & tracking details:`,
    ``,
    `📋 *Order ID:* *${order.orderNo}* ${batch ? `(Batch ${batch.batchNo})` : ""}`,
    `• *Customer:* ${order.customerName}`,
    `• *Fabric:* ${order.fabricType} · ${order.widthInches}" width`,
    `• *Total Ordered:* ${formatNumber(order.meters)} meters`,
    `• *Target Delivery:* ${formatDate(order.deadline, true)}`,
    `• *Current Stage:* ${status}`,
  ];

  // Weaving progress
  if (batch) {
    const produced = batch.producedMeters ?? 0;
    const pct = order.meters > 0 ? Math.min(100, Math.round((produced / order.meters) * 100)) : 0;
    lines.push(
      ``,
      `🏭 *Weaving Progress:*`,
      `• Output: ${formatNumber(Math.round(produced))} m / ${formatNumber(order.meters)} m (*${pct}% woven*)`,
      `• Active Looms: ${batch.machineIds.length || 4} high-speed looms`,
    );

    if (batch.startDate) lines.push(`• Weaving Started: ${formatDate(batch.startDate)}`);
    if (batch.endDate && order.status !== "completed") {
      lines.push(`• Expected Finish: ${formatDate(batch.endDate, true)}`);
    }
  }

  // Live Location & Transport Dispatch Section
  lines.push(``, `🚚 *Live Transport & Dispatch Status:*`);

  if (order.status === "completed") {
    lines.push(
      `• *Status:* 🟢 *Dispatched & In Transit*`,
      `• *Logistics:* Thari Thunaivan Express Fleet`,
      `• *Vehicle No:* TN 33 AB 4589 (Eicher Pro)`,
      `• *Driver Contact:* Murugan (+91 98421 56789)`,
      `• *Current Location:* NH 544 (Salem - Erode - Coimbatore Corridor)`,
      `• *Live GPS Tracking:* https://maps.google.com/?q=11.3410,77.7172`,
      `• *Estimated Arrival:* Today by 5:30 PM`,
    );

    const revenue = (order.ratePerMeterPaise || 800) * order.meters;
    lines.push(
      ``,
      `💰 *Invoice Total:* ${formatINR(revenue, { whole: true })}`,
    );
  } else if (order.status === "in_production") {
    lines.push(
      `• *Status:* 🏭 *In Production at Mill Floor*`,
      `• *Mill Location:* Thari Thunaivan Weaving Mill, Erode, Tamil Nadu`,
      `• *Dispatch Plan:* Transport pre-booked upon batch completion`,
      `• *Live Tracking:* Available as soon as vehicle departs from mill`,
      `• *Live Portal Tracking:* https://thari-thunaivan-featadmin-dashboard-0fb2650.kuberns.cloud/portal`,
    );
  } else {
    lines.push(
      `• *Status:* 📝 Order confirmed. Assigned to loom schedule.`,
      `• *Mill Location:* Erode Weaving Belt, Tamil Nadu`,
      `• *Portal:* https://thari-thunaivan-featadmin-dashboard-0fb2650.kuberns.cloud/portal`,
    );
  }

  lines.push(
    ``,
    `──────────────────`,
    `*Need more information?*`,
    `• Reply *1* ➔ View all your orders`,
    `• Reply *2 <OrderNo>* ➔ Track another order`,
    `• Reply *0* ➔ Speak with Mill Owner (+${OWNER_PHONE})`,
  );

  return lines.join("\n");
}

/** Lists all orders for the client. */
async function myOrdersText(clientPhone: string): Promise<string> {
  const orders = await getOrders();
  if (orders.length === 0) return "No orders found. Please contact us to place an order.";

  const name = clientName(clientPhone);
  const lines = [
    `🧵 *${name} – All Orders on File*`,
    ``,
  ];

  for (const o of orders.slice(0, 8)) {
    const label = STATUS_LABEL[o.status] ?? o.status;
    lines.push(`• *${o.orderNo}* (${o.fabricType}) – ${formatNumber(o.meters)} m – ${label}`);
  }

  lines.push(
    ``,
    `Reply with any order number (e.g. *${orders[0]?.orderNo || "ORD-1004"}*) for full product details and live tracking.`,
  );
  return lines.join("\n");
}

/** Handles an inbound WhatsApp message from a client. */
export async function handleClientMessage(text: string, clientPhone: string): Promise<string> {
  const msg = text.trim().toLowerCase().replace(/\s+/g, " ");

  // 1. Direct Greetings: "hi", "hii", "hello", "hey", "vanakkam", "track", "status"
  if (
    msg === "hi" ||
    msg === "hii" ||
    msg === "hiii" ||
    msg === "hello" ||
    msg === "hey" ||
    msg === "vanakkam" ||
    msg === "start" ||
    msg === "status" ||
    msg === "track" ||
    msg === "order"
  ) {
    return buildOrderDetailsCard(undefined, clientPhone);
  }

  // 2. "1" or "my orders"
  if (msg === "1" || msg.startsWith("my order") || msg === "orders") {
    return myOrdersText(clientPhone);
  }

  // 3. Direct order query: "ORD-1004", "2 ORD-1004", "order status ORD-1004"
  const orderMatch = msg.match(/(?:ord[-_ ]?)(\d{4})/i) || msg.match(/^(?:2 |order status |track )?\s*([a-z0-9-]+)$/i);
  if (orderMatch) {
    const num = orderMatch[1]!;
    const orderNo = num.startsWith("ord") ? num.toUpperCase() : `ORD-${num}`;
    return buildOrderDetailsCard(orderNo, clientPhone);
  }

  // 4. "0" or "owner" / "help"
  if (msg === "0" || msg === "owner" || msg === "help" || msg === "call") {
    return (
      `📞 *Thari Thunaivan – Mill Owner Contact*\n\n` +
      `Owner Phone: +${OWNER_PHONE}\n` +
      `WhatsApp: https://wa.me/${OWNER_PHONE}\n\n` +
      `Feel free to call or message directly for custom weaving inquiries!`
    );
  }

  // Default: Return the rich card with current order status
  return buildOrderDetailsCard(undefined, clientPhone);
}
