"use server";

import { revalidatePath } from "next/cache";
import { run } from "@/lib/action-result";
import { ACCESS, assertRole } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { sendAtRiskAlert, sendDailySummary, sendNewAlerts } from "@/lib/services/notify";
import { handleOwnerMessage } from "@/lib/whatsapp/commands";

export async function simulateMessage(text: string) {
  return run(async () => {
    await assertRole(ACCESS.whatsapp);
    return { data: await handleOwnerMessage(text.slice(0, 200)) };
  });
}

export async function triggerDailySummary() {
  return run(async () => {
    await assertRole(ACCESS.whatsapp);
    const count = await sendDailySummary(todayIso());
    revalidatePath("/admin/whatsapp");
    return { message: `Daily summary queued for ${count} owner number(s)` };
  });
}

export async function triggerAlerts() {
  return run(async () => {
    await assertRole(ACCESS.whatsapp);
    const fresh = await sendNewAlerts(todayIso());
    revalidatePath("/admin/whatsapp");
    return { message: fresh.length ? `${fresh.length} new alert(s) queued` : "No new alerts" };
  });
}

export async function triggerAtRisk() {
  return run(async () => {
    await assertRole(ACCESS.whatsapp);
    const count = await sendAtRiskAlert(todayIso());
    revalidatePath("/admin/whatsapp");
    return {
      message: count === 0 ? "No orders are currently at risk" : `At-risk alert sent for ${count} order(s)`,
    };
  });
}
