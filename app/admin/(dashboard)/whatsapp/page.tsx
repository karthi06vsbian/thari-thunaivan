import { PageHeader } from "@/components/kpi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ACCESS, requireRole } from "@/lib/auth/session";
import { db } from "@/lib/firebase/admin";
import { Simulator } from "./simulator";
import { SendClientMessageForm } from "./send-client-form";

interface OutboxMessage {
  id: string;
  to: string;
  body: string;
  kind: string;
  status: string;
  at: string;
}

export default async function WhatsAppPage() {
  await requireRole(ACCESS.whatsapp);
  const snap = await db().collection("whatsappOutbox").orderBy("at", "desc").limit(10).get();
  const outbox = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OutboxMessage);
  const configured = !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID;

  return (
    <>
      <PageHeader title="WhatsApp" description="Owner bot menu, client direct messaging, automated alerts & outbox." />
      {!configured && (
        <p className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
          WhatsApp is not connected (no WHATSAPP_TOKEN). Messages are recorded below instead of being sent.
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Send WhatsApp to Client</CardTitle>
              <CardDescription>Send direct updates, order status, or delivery notifications to any client number.</CardDescription>
            </CardHeader>
            <CardContent>
              <SendClientMessageForm defaultPhone="917904348506" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Try the Owner Bot Menu</CardTitle>
              <CardDescription>Replies are generated from live data, exactly as the webhook sends them to the owner.</CardDescription>
            </CardHeader>
            <CardContent><Simulator /></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>WhatsApp Outbox</CardTitle>
            <CardDescription>Live log of alerts, summaries, client messages, and bot replies.</CardDescription>
          </CardHeader>
          <CardContent>
            {outbox.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
            ) : (
              <ul className="grid gap-3">
                {outbox.map((m) => (
                  <li key={m.id} className="rounded-lg border p-3 text-sm">
                    <p className="mb-1 text-xs text-muted-foreground font-mono">
                      <span className="font-semibold text-foreground">{m.kind}</span> · to {m.to} ·{" "}
                      <span className={m.status === "sent" ? "text-emerald-600 font-semibold" : ""}>{m.status.replace("_", " ")}</span> ·{" "}
                      {new Date(m.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                    </p>
                    <p className="whitespace-pre-wrap text-xs">{m.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
