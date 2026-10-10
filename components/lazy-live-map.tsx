"use client";

import dynamic from "next/dynamic";

/** The map library is large, so it is only downloaded on pages that actually show a map. */
export const LazyLiveMap = dynamic(() => import("@/app/admin/(dashboard)/transport/live-map").then((m) => m.LiveMap), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-xl border bg-muted" aria-label="Loading map" />,
});
