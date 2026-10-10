/** Sample delivery routes from the mill (Erode) along the main highways. Coordinates are approximate. */
export interface RoutePoint {
  lat: number;
  lng: number;
  /** Named points are towns the truck passes; they become tracking checkpoints. */
  name?: string;
}

export interface TransportRoute {
  id: string;
  destination: string;
  /** Typical door-to-door time including loading, rest stops and unloading. */
  days: number;
  /** Driving hours used to estimate where the truck is. */
  hours: number;
  points: RoutePoint[];
}

export const MILL: RoutePoint = { lat: 11.341, lng: 77.7172, name: "Mill, Erode" };

export const ROUTES: TransportRoute[] = [
  {
    id: "coimbatore", destination: "Coimbatore", days: 1, hours: 3,
    points: [MILL, { lat: 11.2756, lng: 77.587, name: "Perundurai" }, { lat: 11.193, lng: 77.269, name: "Avinashi" }, { lat: 11.0168, lng: 76.9558, name: "Coimbatore" }],
  },
  {
    id: "tiruppur", destination: "Tiruppur", days: 1, hours: 1.5,
    points: [MILL, { lat: 11.2756, lng: 77.587, name: "Perundurai" }, { lat: 11.17, lng: 77.45 }, { lat: 11.1085, lng: 77.3411, name: "Tiruppur" }],
  },
  {
    id: "salem", destination: "Salem", days: 1, hours: 2,
    points: [MILL, { lat: 11.475, lng: 77.869, name: "Sankagiri" }, { lat: 11.6643, lng: 78.146, name: "Salem" }],
  },
  {
    id: "madurai", destination: "Madurai", days: 1, hours: 5,
    points: [MILL, { lat: 10.9601, lng: 78.0766, name: "Karur" }, { lat: 10.3673, lng: 77.9803, name: "Dindigul" }, { lat: 9.9252, lng: 78.1198, name: "Madurai" }],
  },
  {
    id: "bengaluru", destination: "Bengaluru", days: 2, hours: 7,
    points: [MILL, { lat: 11.475, lng: 77.869, name: "Sankagiri" }, { lat: 11.6643, lng: 78.146, name: "Salem" }, { lat: 12.1211, lng: 78.1582, name: "Dharmapuri" }, { lat: 12.5266, lng: 78.215, name: "Krishnagiri" }, { lat: 12.7409, lng: 77.8253, name: "Hosur" }, { lat: 12.9716, lng: 77.5946, name: "Bengaluru" }],
  },
  {
    id: "chennai", destination: "Chennai", days: 2, hours: 9,
    points: [MILL, { lat: 11.475, lng: 77.869, name: "Sankagiri" }, { lat: 11.6643, lng: 78.146, name: "Salem" }, { lat: 11.594, lng: 78.601, name: "Attur" }, { lat: 11.738, lng: 78.962, name: "Kallakurichi" }, { lat: 11.69, lng: 79.29, name: "Ulundurpet" }, { lat: 11.9401, lng: 79.4861, name: "Villupuram" }, { lat: 12.234, lng: 79.655, name: "Tindivanam" }, { lat: 12.6921, lng: 79.9766, name: "Chengalpattu" }, { lat: 13.0827, lng: 80.2707, name: "Chennai" }],
  },
];

export function routeById(id: string): TransportRoute | undefined {
  return ROUTES.find((r) => r.id === id);
}

function km(a: RoutePoint, b: RoutePoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function routeKm(route: TransportRoute): number {
  return route.points.slice(1).reduce((sum, p, i) => sum + km(route.points[i]!, p), 0);
}

export interface TruckPosition {
  lat: number;
  lng: number;
  /** Index of the route point just behind the truck. */
  segment: number;
  kmDone: number;
  kmTotal: number;
  lastPlace: string;
  nextPlace: string;
}

/** Where a truck is after covering `progress` (0-1) of the route by distance. */
export function positionAt(route: TransportRoute, progress: number): TruckPosition {
  const total = routeKm(route);
  const target = Math.min(1, Math.max(0, progress)) * total;
  const named = (from: number, step: 1 | -1) => {
    for (let i = from; i >= 0 && i < route.points.length; i += step) {
      if (route.points[i]!.name) return route.points[i]!.name!;
    }
    return route.destination;
  };
  let done = 0;
  for (let i = 0; i < route.points.length - 1; i++) {
    const a = route.points[i]!;
    const b = route.points[i + 1]!;
    const leg = km(a, b);
    if (done + leg >= target || i === route.points.length - 2) {
      const t = leg > 0 ? Math.min(1, (target - done) / leg) : 1;
      return {
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
        segment: i,
        kmDone: target,
        kmTotal: total,
        lastPlace: named(i, -1),
        nextPlace: t >= 1 ? route.destination : named(i + 1, 1),
      };
    }
    done += leg;
  }
  const end = route.points[route.points.length - 1]!;
  return { ...end, segment: route.points.length - 2, kmDone: total, kmTotal: total, lastPlace: route.destination, nextPlace: route.destination };
}

export interface TripTiming {
  dispatchedAt: string;
  /** Sample trips replay in a loop this many seconds long so the demo always shows a moving truck. */
  demoCycleSeconds?: number | null;
}

/** Share of the trip completed, estimated from time since dispatch (there is no GPS device yet). */
export function tripProgress(trip: TripTiming, route: TransportRoute, nowMs: number): number {
  const elapsed = Math.max(0, nowMs - new Date(trip.dispatchedAt).getTime());
  if (trip.demoCycleSeconds) {
    const cycle = trip.demoCycleSeconds * 1000;
    return (elapsed % cycle) / cycle;
  }
  return Math.min(1, elapsed / (route.hours * 3_600_000));
}
