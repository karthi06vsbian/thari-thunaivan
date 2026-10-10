import { Check } from "lucide-react";
import { STAGE_EMOJI, type OrderTracking } from "@/lib/tracking";
import { cn } from "@/lib/utils";

/** The stage-by-stage tracker shown to clients. `compact` hides the per-stage detail lines. */
export function OrderTracker({ tracking, compact = false }: { tracking: OrderTracking; compact?: boolean }) {
  if (tracking.declined) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
        This order was declined by the mill. Contact us if you would like to change and resend it.
      </p>
    );
  }
  return (
    <ol className={cn("grid gap-0", compact ? "grid-cols-6" : "sm:grid-cols-6")}>
      {tracking.stages.map((stage, i) => (
        <li key={stage.key} className={cn("relative grid gap-1", compact ? "justify-items-center text-center" : "grid-cols-[auto_1fr] items-start gap-x-3 pb-5 sm:grid-cols-1 sm:justify-items-center sm:pb-0 sm:text-center")}>
          {/* Connector to the next stage */}
          {i < tracking.stages.length - 1 && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute bg-border",
                compact ? "top-3 left-1/2 h-0.5 w-full" : "top-7 left-3.5 h-full w-0.5 sm:top-3.5 sm:left-1/2 sm:h-0.5 sm:w-full",
                stage.state === "done" && "bg-brand",
              )}
            />
          )}
          <span
            className={cn(
              "relative z-10 grid place-items-center rounded-full border-2 text-xs font-bold",
              compact ? "size-6" : "size-7",
              stage.state === "done" && "border-brand bg-brand text-white",
              stage.state === "current" && "pulse-dot border-teal bg-white text-teal",
              stage.state === "upcoming" && "border-border bg-white text-muted-foreground",
            )}
          >
            {stage.state === "done" ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
          </span>
          <div className={cn(!compact && "sm:mt-1")}>
            <p className={cn("font-medium", compact ? "text-[11px] leading-tight" : "text-sm", stage.state === "upcoming" && "text-muted-foreground", stage.state === "current" && "text-teal")}>
              <span aria-hidden="true">{STAGE_EMOJI[stage.key]} </span>
              {stage.label}
              <span className="sr-only"> – {stage.state}</span>
            </p>
            {!compact && <p className="text-xs text-muted-foreground">{stage.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
