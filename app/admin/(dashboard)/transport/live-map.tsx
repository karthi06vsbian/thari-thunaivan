"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker, Polyline } from "leaflet";
import { MILL, positionAt, routeById, tripProgress, type TransportRoute } from "@/lib/transport/routes";
import { cn } from "@/lib/utils";

export interface LiveTruck {
  id: string;
  orderNo: string;
  customerName: string;
  routeId: string;
  vehicleNo: string;
  driverName: string;
  dispatchedAt: string;
  demoCycleSeconds: number | null;
  sample: boolean;
}

// One colour per truck, in a fixed order, so a truck keeps its colour on the map and in the list.
const TRUCK_COLOURS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];
const pin = (emoji: string, ring: string) =>
  `<div style="display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#fff;border:3px solid ${ring};box-shadow:0 2px 8px rgba(0,0,0,.35);font-size:17px">${emoji}</div>`;

/** Null until the page is running in the browser, so server and browser render the same first frame. */
function useNow(intervalMs: number): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function LiveMap({ trucks }: { trucks: LiveTruck[] }) {
  const container = useRef<HTMLDivElement>(null);
  const layers = useRef<{ map: LeafletMap; items: Map<string, { marker: Marker; done: Polyline; route: TransportRoute }> } | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const now = useNow(1000);

  // Build the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !container.current || layers.current) return;
      const map = L.map(container.current, { scrollWheelZoom: false }).setView([MILL.lat, MILL.lng], 7);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      L.marker([MILL.lat, MILL.lng], { icon: L.divIcon({ html: pin("🏭", "#714b67"), className: "", iconSize: [34, 34], iconAnchor: [17, 17] }) })
        .addTo(map)
        .bindTooltip("Mill, Erode");

      const items = new Map<string, { marker: Marker; done: Polyline; route: TransportRoute }>();
      const bounds = L.latLngBounds([[MILL.lat, MILL.lng]]);
      trucks.forEach((truck, i) => {
        const route = routeById(truck.routeId);
        if (!route) return;
        const colour = TRUCK_COLOURS[i % TRUCK_COLOURS.length]!;
        const path = route.points.map((p) => [p.lat, p.lng] as [number, number]);
        L.polyline(path, { color: colour, weight: 4, opacity: 0.35, dashArray: "6 8" }).addTo(map);
        const done = L.polyline([], { color: colour, weight: 5 }).addTo(map);
        const end = route.points[route.points.length - 1]!;
        L.marker([end.lat, end.lng], { icon: L.divIcon({ html: pin("📍", colour), className: "", iconSize: [34, 34], iconAnchor: [17, 17] }) })
          .addTo(map)
          .bindTooltip(`${route.destination} · ${truck.customerName}`);
        const marker = L.marker([MILL.lat, MILL.lng], {
          icon: L.divIcon({ html: pin("🚚", colour), className: "", iconSize: [34, 34], iconAnchor: [17, 17] }),
          zIndexOffset: 1000,
        })
          .addTo(map)
          .bindTooltip(`${truck.vehicleNo} · ${truck.orderNo}`);
        items.set(truck.id, { marker, done, route });
        path.forEach((p) => bounds.extend(p));
      });
      map.fitBounds(bounds, { padding: [30, 30] });
      layers.current = { map, items };
    })();
    return () => {
      cancelled = true;
      layers.current?.map.remove();
      layers.current = null;
    };
  }, [trucks]);

  // Move the trucks.
  const live = trucks.flatMap((truck, i) => {
    const route = routeById(truck.routeId);
    if (!route || now === null) return [];
    const progress = tripProgress(truck, route, now);
    return [{ truck, route, progress, position: positionAt(route, progress), colour: TRUCK_COLOURS[i % TRUCK_COLOURS.length]! }];
  });
  useEffect(() => {
    if (!layers.current) return;
    for (const { truck, route, position } of live) {
      const item = layers.current.items.get(truck.id);
      if (!item) continue;
      item.marker.setLatLng([position.lat, position.lng]);
      item.done.setLatLngs([
        ...route.points.slice(0, position.segment + 1).map((p) => [p.lat, p.lng] as [number, number]),
        [position.lat, position.lng],
      ]);
    }
  });

  function focusOn(id: string) {
    setFocus(id);
    const item = layers.current?.items.get(id);
    if (item) layers.current!.map.flyTo(item.marker.getLatLng(), 10, { duration: 0.8 });
  }

  if (trucks.length === 0) {
    return <p className="text-sm text-muted-foreground">No trucks are on the road right now.</p>;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <div ref={container} className="z-0 h-[420px] overflow-hidden rounded-xl border" aria-label="Map of trucks on the road" />
      <ul className="grid content-start gap-3">
        {live.map(({ truck, route, progress, position, colour }) => {
          const arrived = progress >= 1;
          const hoursLeft = route.hours * (1 - progress);
          return (
            <li key={truck.id}>
              <button
                type="button"
                onClick={() => focusOn(truck.id)}
                className={cn("lift grid w-full gap-2 rounded-xl border bg-card p-3 text-left text-sm", focus === truck.id && "ring-2 ring-brand")}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="size-3 rounded-full" style={{ background: colour }} />
                    {truck.vehicleNo}
                  </span>
                  <span className="text-xs text-muted-foreground">{truck.orderNo} → {route.destination}</span>
                </span>
                <span className="text-muted-foreground">
                  {arrived ? `Arrived at ${route.destination}` : `Between ${position.lastPlace} and ${position.nextPlace}`}
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full transition-[width] duration-1000 ease-linear" style={{ width: `${Math.round(progress * 100)}%`, background: colour }} />
                </span>
                <span className="flex justify-between text-xs tabular-nums">
                  <span>{Math.round(position.kmDone)} of {Math.round(position.kmTotal)} km · {Math.round(progress * 100)}%</span>
                  <span>{arrived ? "Waiting to unload" : hoursLeft < 1 ? `${Math.max(1, Math.round(hoursLeft * 60))} min to go` : `${hoursLeft.toFixed(1)} hrs to go`}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  Driver {truck.driverName} · {truck.customerName}
                  {truck.sample && " · sample trip, replayed fast"}
                </span>
              </button>
            </li>
          );
        })}
        {now === null && <li className="text-sm text-muted-foreground">Locating trucks…</li>}
        <li className="text-xs text-muted-foreground">
          Positions are estimated from the time since dispatch along the planned route. No GPS device is connected yet.
        </li>
      </ul>
    </div>
  );
}
