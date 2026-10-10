import { todayIso } from "@/lib/dates";
import { dailySummaryText, electricityTodayText, machineStatusText, planOrderText } from "@/lib/reports";
import { sendAtRiskAlert } from "@/lib/services/notify";

export const OWNER_MENU = [
  "*TextileFlow – owner menu*",
  "1. Machine status",
  "2. Electricity today",
  "3. Plan order <orderNo>  (e.g. Plan order ORD-1005)",
  "4. Summary",
  "5. At-risk orders",
  "",
  "Reply with the number or the text.",
].join("\n");

/** Turns an incoming owner message into the reply text. */
export async function handleOwnerMessage(text: string): Promise<string> {
  const message = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (message === "1" || message.startsWith("machine status")) return machineStatusText();
  if (message === "2" || message.startsWith("electricity")) return electricityTodayText(todayIso());
  const plan = message.match(/^(?:3 |plan order )\s*([a-z0-9-]+)$/);
  if (plan) return planOrderText(plan[1]!, todayIso());
  if (message === "3" || message === "plan order") return "Send: Plan order <orderNo>, e.g. Plan order ORD-1005";
  if (message === "4" || message.startsWith("summary")) return dailySummaryText(todayIso());
  if (message === "5" || message.startsWith("at-risk") || message.startsWith("at risk")) {
    const count = await sendAtRiskAlert(todayIso());
    return count === 0
      ? "✅ No orders are currently at risk of missing their deadline."
      : `⚠️ ${count} at-risk order alert(s) sent to all owners.`;
  }
  return OWNER_MENU;
}
