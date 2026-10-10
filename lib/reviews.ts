import { db } from "@/lib/firebase/admin";

export interface Review {
  id: string;
  orderNo: string;
  clientUid: string;
  name: string;
  /** What they ordered, e.g. "4,000 m cotton". */
  about: string;
  rating: number;
  text: string;
  at: string;
  /** Only approved reviews are shown on the public website. */
  approved: boolean;
}

/** Reviews shown on the website need at least this many stars. */
export const PUBLIC_MIN_RATING = 4;

/**
 * Stand-in reviews for demonstrations. They are shown, clearly marked as samples, only
 * until the first real client review has been approved.
 */
export const SAMPLE_REVIEWS: Pick<Review, "id" | "name" | "about" | "rating" | "text">[] = [
  { id: "s1", name: "Garment exporter", about: "Cotton shirting, repeat orders", rating: 5, text: "The delivery date they gave is the date the truck arrived. Width and shade were consistent across every bundle." },
  { id: "s2", name: "Fabric trader", about: "Poly-cotton blend", rating: 4, text: "Good quality and fair pricing. Being able to watch the order move from weaving to dispatch saved me a lot of phone calls." },
  { id: "s3", name: "Boutique owner", about: "Silk, small lot", rating: 5, text: "They took a small silk order seriously. Each bundle came with its length and quality score." },
  { id: "s4", name: "Uniform maker", about: "Polyester, bulk", rating: 5, text: "Paid the advance online and the order was confirmed in a minute. Tracking the truck on the map was a nice touch." },
  { id: "s5", name: "Home textile brand", about: "Wide-width cotton sheeting", rating: 4, text: "One bundle needed rework and they told us before we asked. Honest people to deal with." },
  { id: "s6", name: "Wholesale buyer", about: "Cotton grey fabric", rating: 5, text: "Clear quote, clear dates, no surprises on the bill. We have moved our regular orders here." },
];

/** Approved 4 and 5 star reviews for the website. Never throws: the page still renders without them. */
export async function getPublicReviews(limit = 12): Promise<Review[]> {
  try {
    const snap = await db().collection("reviews").where("approved", "==", true).get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Review)
      .filter((r) => r.rating >= PUBLIC_MIN_RATING)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, limit);
  } catch (err) {
    console.error("getPublicReviews error:", err);
    return [];
  }
}

export async function getAllReviews(limit = 20): Promise<Review[]> {
  const snap = await db().collection("reviews").orderBy("at", "desc").limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Review);
}

export async function getReview(orderNo: string): Promise<Review | null> {
  const snap = await db().collection("reviews").doc(orderNo).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as Review) : null;
}
