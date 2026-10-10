"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { simulateMessage, triggerAlerts, triggerDailySummary } from "./actions";

const QUICK = ["Menu", "Machine status", "Electricity today", "Plan order ORD-1005", "Summary"];

export function Simulator() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [chat, setChat] = useState<{ from: "owner" | "bot"; body: string }[]>([]);
  const [pending, startTransition] = useTransition();

  function send(message: string) {
    if (!message.trim()) return;
    setText("");
    setChat((c) => [...c, { from: "owner", body: message }]);
    startTransition(async () => {
      const result = await simulateMessage(message);
      setChat((c) => [...c, { from: "bot", body: result.ok ? (result.data ?? "") : result.error }]);
    });
  }

  function trigger(action: typeof triggerAlerts) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message ?? "Done");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <Button key={q} type="button" size="sm" variant="outline" disabled={pending} onClick={() => send(q)}>
            {q}
          </Button>
        ))}
      </div>
      <div className="grid min-h-40 content-start gap-2 rounded-xl border bg-muted/30 p-3" aria-live="polite">
        {chat.length === 0 && <p className="text-sm text-muted-foreground">Send a message to see the reply the owner would get.</p>}
        {chat.map((m, i) => (
          <p
            key={i}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
              m.from === "owner" ? "justify-self-end bg-primary text-primary-foreground" : "justify-self-start border bg-background"
            }`}
          >
            {m.body}
          </p>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <Input aria-label="Message" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message, e.g. Plan order ORD-1006" />
        <Button type="submit" disabled={pending}>Send</Button>
      </form>
      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button type="button" variant="outline" disabled={pending} onClick={() => trigger(triggerDailySummary)}>
          Send 8 PM summary now
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => trigger(triggerAlerts)}>
          Run alert check now
        </Button>
      </div>
    </div>
  );
}
