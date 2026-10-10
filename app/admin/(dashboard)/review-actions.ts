"use server";

import { revalidatePath } from "next/cache";
import { run } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { ACCESS, assertRole } from "@/lib/auth/session";
import { db } from "@/lib/firebase/admin";
import { getReview } from "@/lib/reviews";

/** Shows or hides a client's review on the public website. */
export async function setReviewApproved(orderNo: string, approved: boolean) {
  return run(async () => {
    const user = await assertRole(ACCESS.planning);
    const review = await getReview(orderNo);
    if (!review) throw new Error("Review not found");
    await db().collection("reviews").doc(orderNo).update({ approved });
    await writeAudit(user, approved ? "approve-review" : "hide-review", "review", orderNo, `${review.rating} stars from ${review.name}`);
    revalidatePath("/");
    revalidatePath("/admin", "layout");
    return { message: approved ? "Review is now shown on the website" : "Review hidden from the website" };
  });
}
