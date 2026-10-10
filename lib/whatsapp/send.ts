import { db } from "@/lib/firebase/admin";
import { getOwners } from "@/lib/data";

const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * Sends a WhatsApp text through the Cloud API. Every message is also recorded in
 * whatsappOutbox; without WHATSAPP_TOKEN it is only recorded, which is how local
 * development works.
 */
export async function sendWhatsApp(to: string, body: string, kind: string): Promise<void> {
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
}

export async function sendToOwners(body: string, kind: string): Promise<number> {
  const owners = (await getOwners()).filter((o) => o.phone);
  await Promise.all(owners.map((o) => sendWhatsApp(o.phone!, body, kind)));
  return owners.length;
}
