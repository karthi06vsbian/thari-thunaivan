"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitReview } from "./actions";

export function ReviewForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const text = String(new FormData(e.currentTarget).get("text") ?? "");
        startTransition(async () => {
          const res = await submitReview({ orderId, rating, text });
          setResult(res.ok ? { ok: true, text: res.message ?? "Thank you!" } : { ok: false, text: res.error });
          if (res.ok) router.refresh();
        });
      }}
    >
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Your rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              aria-pressed={rating === n}
              onClick={() => setRating(n)}
              className="rounded p-0.5 text-3xl leading-none transition-transform hover:scale-125"
              style={{ color: n <= rating ? "#f5a623" : "#c9c7c1" }}
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>
      <Textarea name="text" required minLength={10} maxLength={400} rows={3} aria-label="Your review" placeholder="How was the fabric, the delivery and dealing with us?" />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send review"}</Button>
        {result && <p role="status" className={`text-sm ${result.ok ? "text-emerald-700" : "text-destructive"}`}>{result.text}</p>}
      </div>
    </form>
  );
}
