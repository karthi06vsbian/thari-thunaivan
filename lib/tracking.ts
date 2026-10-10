import type { Batch, Bundle, Order, Shipment } from "@/lib/types";

export type StageKey = "placed" | "confirmed" | "production" | "quality" | "dispatched" | "delivered";
export type StageState = "done" | "current" | "upcoming";

export interface Stage {
  key: StageKey;
  label: string;
  state: StageState;
  /** One line telling the client what is happening at this stage. */
  detail: string;
}

export interface OrderTracking {
  stages: Stage[];
  /** The stage the order is at now; null when everything is done or the order was declined. */
  current: Stage | null;
  declined: boolean;
  progressPercent: number;
}

const LABELS: Record<StageKey, string> = {
  placed: "Order placed",
  confirmed: "Confirmed",
  production: "Weaving",
  quality: "Quality check",
  dispatched: "On the way",
  delivered: "Delivered",
};

export const STAGE_EMOJI: Record<StageKey, string> = {
  placed: "📝",
  confirmed: "✅",
  production: "🧵",
  quality: "🔍",
  dispatched: "🚚",
  delivered: "📦",
};

/** Works out where a client's order is, from its batch, checked bundles and shipment. */
export function trackOrder(
  order: Order,
  batch: Batch | null,
  bundles: Pick<Bundle, "status">[],
  shipment: Pick<Shipment, "status" | "vehicleNo"> | null,
): OrderTracking {
  const confirmed = order.status === "confirmed" || order.status === "in_production" || order.status === "completed";
  const woven = !!batch && batch.meters > 0 ? Math.min(100, Math.round((batch.producedMeters / batch.meters) * 100)) : 0;
  const weavingDone = order.status === "completed" || batch?.status === "completed" || !!shipment;
  const checked = bundles.filter((b) => b.status !== "pending").length;
  const passed = bundles.filter((b) => b.status === "pass").length;
  const qualityDone = !!shipment || (weavingDone && bundles.length > 0 && checked === bundles.length);
  const delivered = shipment?.status === "delivered";

  const done: Record<StageKey, boolean> = {
    placed: true,
    confirmed,
    production: confirmed && weavingDone,
    quality: confirmed && qualityDone,
    dispatched: delivered,
    delivered,
  };
  const detail: Record<StageKey, string> = {
    placed: "We have your order.",
    confirmed: confirmed
      ? order.paymentStatus === "paid"
        ? "Advance received and order confirmed."
        : "Order confirmed by the mill."
      : order.confirmMode === "prepaid"
        ? "Waiting for your advance payment."
        : order.appointment
          ? "Waiting for your visit to confirm."
          : "Waiting for the mill to confirm.",
    production: weavingDone
      ? "Weaving finished."
      : batch?.status === "in_progress"
        ? `${woven}% woven on ${batch.machineIds.length} loom${batch.machineIds.length === 1 ? "" : "s"}.`
        : "Looms are being scheduled.",
    quality: bundles.length > 0 ? `${checked} of ${bundles.length} bundles checked, ${passed} passed.` : "Each bundle is measured and inspected.",
    dispatched: shipment ? (delivered ? "Reached you." : `On truck ${shipment.vehicleNo}.`) : "A truck is booked once quality is cleared.",
    delivered: delivered ? "Delivered and unloaded." : "Not delivered yet.",
  };

  const declined = order.status === "rejected";
  const keys = Object.keys(LABELS) as StageKey[];
  // "On the way" is the current stage from the moment a truck leaves until it is delivered.
  const currentKey = declined ? null : (keys.find((k) => !done[k]) ?? null);
  const stages = keys.map((key): Stage => ({
    key,
    label: LABELS[key],
    state: done[key] ? "done" : key === currentKey ? "current" : "upcoming",
    detail: detail[key],
  }));
  const doneCount = stages.filter((s) => s.state === "done").length;
  return {
    stages,
    current: stages.find((s) => s.state === "current") ?? null,
    declined,
    progressPercent: Math.round((doneCount / stages.length) * 100),
  };
}

export interface TrackingEvent {
  at: string;
  title: string;
  text?: string;
}

/** Everything that has happened to the order, newest first. */
export function orderEvents(
  order: Order,
  batch: Batch | null,
  bundles: Pick<Bundle, "bundleNo" | "status" | "checkedAt" | "qualityScore">[],
  shipment: Pick<Shipment, "updates"> | null,
): TrackingEvent[] {
  const events: TrackingEvent[] = [];
  if (order.requestedAt) {
    events.push({
      at: order.requestedAt,
      title: "Order placed",
      text: order.appointment
        ? `Visit booked for ${order.appointment.date}, ${order.appointment.slot}.`
        : order.confirmMode === "prepaid"
          ? "Advance payment requested."
          : undefined,
    });
  }
  if (order.paidAt) events.push({ at: order.paidAt, title: "Advance payment received", text: "Your order is confirmed." });
  if (batch?.startDate) events.push({ at: `${batch.startDate}T03:30:00.000Z`, title: "Weaving started", text: `${batch.machineIds.length} looms assigned.` });
  for (const b of bundles) {
    if (!b.checkedAt) continue;
    events.push({
      at: b.checkedAt,
      title: `Bundle ${b.bundleNo} quality checked`,
      text: `${b.status === "pass" ? "Passed" : b.status === "rework" ? "Sent for rework" : "Rejected"}${typeof b.qualityScore === "number" ? ` · score ${b.qualityScore}/100` : ""}`,
    });
  }
  for (const u of shipment?.updates ?? []) events.push({ at: u.at, title: "Transport update", text: u.text });
  return events.sort((a, b) => b.at.localeCompare(a.at));
}
