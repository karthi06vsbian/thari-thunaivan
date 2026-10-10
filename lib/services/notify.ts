import { db } from "@/lib/firebase/admin";
import type { IsoDate } from "@/lib/planning/types";
import { buildAlerts, dailySummaryText, getAtRiskOrders } from "@/lib/reports";
import { formatDate, todayIso } from "@/lib/dates";
import { formatNumber } from "@/lib/money";
import { sendToClient, sendToOwners } from "@/lib/whatsapp/send";
import { CLIENTS } from "@/lib/whatsapp/numbers";

export async function sendDailySummary(today: IsoDate): Promise<number> {
  return sendToOwners(await dailySummaryText(today), "daily-summary");
}

/** Sends only alerts not already sent today, so an hourly check does not repeat itself. */
export async function sendNewAlerts(today: IsoDate): Promise<string[]> {
  const ref = db().collection("alertState").doc(today);
  const sent = new Set<string>(((await ref.get()).data()?.sent as string[] | undefined) ?? []);
  const fresh = (await buildAlerts(today)).filter((a) => !sent.has(a));
  if (fresh.length === 0) return [];
  await sendToOwners(["*TextileFlow alerts*", ...fresh.map((a) => `• ${a}`)].join("\n"), "alert");
  await ref.set({ sent: [...sent, ...fresh] });
  return fresh;
}

/**
 * Sends a WhatsApp alert to the owner AND all registered clients when an order is completed.
 * Owner gets internal costing details; clients get a clean delivery confirmation.
 */
export async function sendOrderCompletedAlert(params: {
  orderNo: string;
  customerName: string;
  fabricType: string;
  meters: number;
}): Promise<void> {
  const { orderNo, customerName, fabricType, meters } = params;

  // Owner message — includes customer details
  const ownerMsg = [
    `✅ *Order Completed: ${orderNo}*`,
    `Customer: ${customerName}`,
    `Fabric: ${fabricType} · ${formatNumber(meters)} m`,
    `Completed on: ${formatDate(todayIso(), true)}`,
  ].join("\n");
  await sendToOwners(ownerMsg, "order-completed");

  // Client message — clean delivery confirmation, no internal data
  const clientMsg = [
    `✅ *Your order ${orderNo} is ready!*`,
    `Fabric: ${fabricType} · ${formatNumber(meters)} m`,
    `Completed on: ${formatDate(todayIso(), true)}`,
    ``,
    `Please contact us to arrange delivery. Thank you for your order!`,
  ].join("\n");
  await Promise.all(CLIENTS.map((c) => sendToClient(c.phone, clientMsg, "order-completed-client")));
}

/**
 * Checks all at-risk orders and sends an immediate WhatsApp alert.
 * Useful after a breakdown or batch update to instantly notify owners.
 */
export async function sendAtRiskAlert(today: IsoDate): Promise<number> {
  const atRisk = await getAtRiskOrders(today);
  if (atRisk.length === 0) return 0;
  const lines = [
    `⚠️ *${atRisk.length} order(s) at risk of missing deadline*`,
    ...atRisk.map(
      (o) =>
        `• ${o.orderNo} – due ${formatDate(o.deadline)}, projected ${
          o.projectedFinish ? formatDate(o.projectedFinish) : "no working machines"
        } (${formatNumber(o.remainingMeters)} m left)`,
    ),
  ];
  await sendToOwners(lines.join("\n"), "at-risk-alert");
  return atRisk.length;
}
