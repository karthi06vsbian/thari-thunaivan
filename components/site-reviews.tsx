import { Reveal } from "@/components/reveal";
import { Stars } from "@/components/stars";
import { getPublicReviews, SAMPLE_REVIEWS } from "@/lib/reviews";

interface Shown {
  id: string;
  name: string;
  about: string;
  rating: number;
  text: string;
}

function Row({ reviews, reverse }: { reviews: Shown[]; reverse?: boolean }) {
  // The list is doubled so the strip can loop without a gap; the copy is hidden from screen readers.
  return (
    <div className="overflow-hidden">
      <ul className={`${reverse ? "marquee-reverse" : "marquee marquee-slow"} flex w-max gap-4 py-2`}>
        {[...reviews, ...reviews].map((r, i) => (
          <li
            key={`${r.id}-${i}`}
            aria-hidden={i >= reviews.length ? true : undefined}
            className="lift grid w-80 shrink-0 content-start gap-2 rounded-2xl border bg-card p-5"
          >
            <Stars rating={r.rating} />
            <p className="text-sm">“{r.text}”</p>
            <p className="text-sm font-semibold">
              {r.name}
              <span className="block text-xs font-normal text-muted-foreground">{r.about}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Moving strip of 4 and 5 star client reviews. Samples are shown, labelled, until real ones exist. */
export async function SiteReviews() {
  const real = await getPublicReviews();
  const samples = real.length === 0;
  const reviews: Shown[] = samples ? SAMPLE_REVIEWS : real;
  // With only a few reviews one row is enough.
  const half = Math.ceil(reviews.length / 2);
  const rows = reviews.length >= 6 ? [reviews.slice(0, half), reviews.slice(half)] : [reviews];
  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <section id="reviews" className="scroll-mt-16 border-t bg-brand-soft/60">
      <div className="mx-auto max-w-6xl px-4 pt-16">
        <Reveal>
          <p className="text-sm font-semibold tracking-widest text-teal uppercase"><span aria-hidden="true">⭐</span> Reviews</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">What our clients say</h2>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-muted-foreground">
            <Stars rating={Math.round(average)} />
            {average.toFixed(1)} out of 5 from {reviews.length} review{reviews.length === 1 ? "" : "s"}
          </p>
          {samples && (
            <p className="mt-3 inline-block rounded-full bg-teal-soft px-3 py-1 text-xs font-medium text-teal">
              Sample reviews for demonstration – real client reviews appear here once approved
            </p>
          )}
        </Reveal>
      </div>
      <div className="grid gap-2 py-10">
        {rows.map((row, i) => (
          <Row key={i} reviews={row} reverse={i % 2 === 1} />
        ))}
      </div>
    </section>
  );
}
