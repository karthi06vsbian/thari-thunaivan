/** Shown instantly while a page's data loads, so clicking a menu item never feels stuck. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-brand/15" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border bg-card" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border bg-card" />
      <div className="h-40 animate-pulse rounded-xl border bg-card" />
    </div>
  );
}
