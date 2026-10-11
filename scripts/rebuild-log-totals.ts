/**
 * Rebuilds the per-day log totals from the production logs. The app does this by itself the
 * first time it needs them; run it by hand only if batch or machine figures look wrong after
 * logs were changed outside the app.
 *
 *   npm run rebuild:totals
 */
import { projectId } from "@/lib/firebase/admin";
import { rebuildLogTotals } from "@/lib/services/recompute";

rebuildLogTotals().then(
  (days) => {
    console.log(`Rebuilt log totals for ${days} days on ${projectId}. Save any shift's logs to refresh the batch and machine figures.`);
    process.exit(0);
  },
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
