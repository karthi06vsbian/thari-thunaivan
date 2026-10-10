export default function Loading() {
  return (
    <div className="min-h-screen bg-brand-soft/40" aria-busy="true" aria-label="Loading">
      <div className="hero-weave h-14" />
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-brand/15" />
        <div className="h-96 animate-pulse rounded-xl border bg-card" />
        <div className="h-40 animate-pulse rounded-xl border bg-card" />
      </div>
    </div>
  );
}
