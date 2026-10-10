import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Webhook verification handshake from Meta. */
export function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const expected = process.env.WHATSAPP_VERIFY_TOKEN || "thari-thunaivan-whatsapp-2026";
    const mode = params.get("hub.mode");
    const token = params.get("hub.verify_token");
    const challenge = params.get("hub.challenge");

    if (mode === "subscribe" && token === expected) {
      return new NextResponse(challenge ?? "", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    return new NextResponse("Forbidden", { status: 403 });
  } catch (err) {
    return new NextResponse("Webhook verification error", { status: 500 });
  }
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
  const raw = await request.text();

  // If secret is configured, verify HMAC signature
  if (secret && !validSignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw) as WebhookPayload;
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const messages = (payload.entry ?? []).flatMap((e) =>
    (e.changes ?? []).flatMap((c) => c.value?.messages ?? []),
  );

  const { isOwner, isClient } = await import("@/lib/whatsapp/numbers");
  const { sendWhatsApp } = await import("@/lib/whatsapp/send");

  for (const m of messages) {
    if (m.type !== "text" || !m.text) continue;

    if (isOwner(m.from)) {
      const { handleOwnerMessage } = await import("@/lib/whatsapp/commands");
      const reply = await handleOwnerMessage(m.text.body);
      await sendWhatsApp(m.from, reply, "owner-reply");
    } else if (isClient(m.from)) {
      const { handleClientMessage } = await import("@/lib/whatsapp/client-commands");
      const reply = await handleClientMessage(m.text.body, m.from);
      await sendWhatsApp(m.from, reply, "client-reply");
    }
  }

  return NextResponse.json({ ok: true });
}
