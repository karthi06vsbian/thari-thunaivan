import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getOwners } from "@/lib/data";
import { handleOwnerMessage } from "@/lib/whatsapp/commands";
import { sendWhatsApp } from "@/lib/whatsapp/send";

/** Webhook verification handshake from Meta. */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (expected && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === expected) {
    return new NextResponse(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

function validSignature(body: string, header: string | null, secret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"));
  const given = Buffer.from(header.slice(7));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

interface WebhookPayload {
  entry?: { changes?: { value?: { messages?: { from: string; type: string; text?: { body: string } }[] } }[] }[];
}

export async function POST(request: NextRequest) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  // Without the app secret we cannot tell Meta's calls from anyone else's, so refuse.
  if (!secret) return new NextResponse("WhatsApp webhook is not configured", { status: 503 });
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(raw) as WebhookPayload;
  const messages = (payload.entry ?? []).flatMap((e) => (e.changes ?? []).flatMap((c) => c.value?.messages ?? []));
  const ownerPhones = new Set((await getOwners()).map((o) => o.phone).filter(Boolean));
  for (const m of messages) {
    // The menu exposes mill data, so only registered owner numbers get replies.
    if (m.type !== "text" || !m.text || !ownerPhones.has(m.from)) continue;
    await sendWhatsApp(m.from, await handleOwnerMessage(m.text.body), "reply");
  }
  return NextResponse.json({ ok: true });
}
