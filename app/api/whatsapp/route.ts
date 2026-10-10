import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { handleClientMessage } from "@/lib/whatsapp/client-commands";
import { handleOwnerMessage } from "@/lib/whatsapp/commands";
import { isClient, isOwner } from "@/lib/whatsapp/numbers";
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
  const messages = (payload.entry ?? []).flatMap((e) =>
    (e.changes ?? []).flatMap((c) => c.value?.messages ?? []),
  );

  for (const m of messages) {
    if (m.type !== "text" || !m.text) continue;

    if (isOwner(m.from)) {
      // Owner gets full mill data: machines, electricity, planning, at-risk, summaries.
      const reply = await handleOwnerMessage(m.text.body);
      await sendWhatsApp(m.from, reply, "owner-reply");
    } else if (isClient(m.from)) {
      // Client gets order status only — no internal mill data is exposed.
      const reply = await handleClientMessage(m.text.body, m.from);
      await sendWhatsApp(m.from, reply, "client-reply");
    }
    // Unknown numbers are silently ignored — no data is ever sent to unregistered phones.
  }

  return NextResponse.json({ ok: true });
}
