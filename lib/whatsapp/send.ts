import { db } from "@/lib/firebase/admin";
import { OWNER_PHONE } from "./numbers";

const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * Sends a WhatsApp text through the Meta Cloud API.
 * Every message is also recorded in whatsappOutbox so you can inspect
 * what was sent from the admin panel. Without WHATSAPP_TOKEN the
 * message is only recorded (this is how local development works).
 */
export async function sendWhatsApp(to: string, body: string, kind: string): Promise<string> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  let status = "not_configured";
  if (token && phoneId) {
    try {
      const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
      });
      status = res.ok ? "sent" : `failed_${res.status}`;
    } catch {
      status = "failed_network";
    }
  }
  await db().collection("whatsappOutbox").add({ to, body, kind, status, at: new Date().toISOString() });
  return status;
}

/**
 * Sends to the registered owner (918778606059).
 * The owner number comes from lib/whatsapp/numbers.ts — edit it there.
 */
export async function sendToOwners(body: string, kind: string): Promise<number> {
  await sendWhatsApp(OWNER_PHONE, body, kind);
  return 1;
}

/**
 * Sends an order status update directly to a specific client number.
 */
export async function sendToClient(clientPhone: string, body: string, kind: string): Promise<void> {
  await sendWhatsApp(clientPhone, body, kind);
}
