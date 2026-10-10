export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

/** Runs a server action body and turns thrown errors into a result the client can toast. */
export async function run<T>(fn: () => Promise<{ data?: T; message?: string } | void>): Promise<ActionResult<T>> {
  try {
    const out = await fn();
    return { ok: true, ...(out ?? {}) };
  } catch (e) {
    // Next.js redirects are thrown and must pass through.
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) {
      throw e;
    }
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}
