"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendClientWhatsApp } from "./actions";

const PRESETS = [
  { label: "In Production", text: "🧵 Thari Thunaivan: Your fabric order is currently in production on our looms and proceeding on schedule." },
  { label: "Ready & Dispatched", text: "🚚 Thari Thunaivan: Your woven fabric order is ready and dispatched for delivery. Our transport team will contact you shortly." },
  { label: "Inspection Passed", text: "✅ Thari Thunaivan: Your order has completed weaving and passed quality inspection. Packing in progress." },
];

export function SendClientMessageForm({ defaultPhone = "917904348506" }: { defaultPhone?: string }) {
  const [phone, setPhone] = useState(defaultPhone);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error("Please enter a phone number");
      return;
    }
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }
    startTransition(async () => {
      const res = await sendClientWhatsApp(phone, message);
      if (res.ok) {
        toast.success(res.message ?? "Message sent to client!");
        setMessage("");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSend} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="client-phone" className="text-xs font-medium">Client WhatsApp Number</Label>
        <Input
          id="client-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. 917904348506"
          disabled={pending}
          className="text-xs font-mono"
        />
        <p className="text-[11px] text-muted-foreground">Includes country code without + (e.g. 91 for India).</p>
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="client-message" className="text-xs font-medium">Message Body</Label>
          <span className="text-[11px] text-muted-foreground">Quick templates:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setMessage(p.text)}
              className="text-[11px] h-7 px-2"
            >
              {p.label}
            </Button>
          ))}
        </div>
        <Textarea
          id="client-message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type update message for client..."
          disabled={pending}
          className="text-xs"
        />
      </div>

      <Button type="submit" disabled={pending} className="w-full font-medium">
        {pending ? "Sending to Client…" : "💬 Send WhatsApp to Client"}
      </Button>
    </form>
  );
}
