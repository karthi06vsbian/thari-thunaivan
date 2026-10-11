"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { databaseStatus, type DbStatus } from "@/lib/db-status";

/** Shown in place of a page that could not load its data. */
export function DataError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // In production the real message is hidden from the browser, so the server is asked what is wrong.
  const [status, setStatus] = useState<DbStatus | "checking">(/quota/i.test(error.message) ? "quota" : "checking");
  useEffect(() => {
    if (status !== "checking") return;
    databaseStatus().then(setStatus, () => setStatus("error"));
  }, [status]);

  return (
    <div role="alert" className="mx-auto mt-10 grid max-w-xl gap-3 rounded-2xl border bg-card p-6 text-sm">
      {status === "quota" ? (
        <>
          <h1 className="text-xl font-bold text-brand">Today&apos;s database limit is used up</h1>
          <p>
            The free Firebase plan allows a fixed number of database reads each day, and today&apos;s have all been used.
            Nothing is lost: your data is safe, but pages cannot load it until the limit resets.
          </p>
          <ul className="grid list-disc gap-1 pl-5">
            <li>The limit resets by itself every day at about 12:30 pm Indian time (1:30 pm from November to March).</li>
            <li>To remove the limit, move the Firebase project to the Blaze (pay as you go) plan in the Firebase console.</li>
          </ul>
        </>
      ) : (
        <>
          <h1 className="text-xl font-bold text-brand">This page could not load</h1>
          <p>
            {status === "checking"
              ? "Checking the database…"
              : status === "ok"
                ? "The database is working, so this was probably a brief hiccup. Try again."
                : "The database could not be reached. Check the internet connection and try again."}
          </p>
        </>
      )}
      <div>
        <Button type="button" variant="outline" onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
