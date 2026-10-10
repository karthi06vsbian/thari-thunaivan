"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserCredential } from "firebase/auth";
import type { StaffRole } from "@/lib/types";
import { createSession } from "./actions";

const MESSAGES: Record<string, string> = {
  "auth/popup-blocked": "Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.",
  "auth/operation-not-allowed": "This sign-in method is not enabled yet.",
  "auth/email-already-in-use": "An account with this email already exists. Log in instead.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/unauthorized-domain": "Google sign-in is not allowed from this web address yet. Add it under Authorized domains in Firebase.",
  "auth/network-request-failed": "Network problem. Check your connection and try again.",
  "auth/account-exists-with-different-credential": "This email is already registered. Log in with the method you used before.",
};

/** Shared by the customer and staff login pages: Firebase sign-in, then a server session. */
export function useSignIn() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  /**
   * `staffPage` is where a staff member lands after signing in; clients always go to their portal.
   * `expectedRole` makes the sign-in fail unless the account holds that staff role.
   */
  async function finish(
    signIn: () => Promise<UserCredential>,
    displayName?: string,
    staffPage?: string,
    expectedRole?: StaffRole,
  ) {
    setBusy(true);
    setError("");
    try {
      const credential = await signIn();
      const result = await createSession(await credential.user.getIdToken(), displayName, expectedRole);
      if (!result.ok) throw new Error(result.error);
      const toStaffPage = staffPage?.startsWith("/admin") && result.home.startsWith("/admin");
      router.replace(toStaffPage ? staffPage! : result.home);
      router.refresh();
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setError("");
      } else if (code.startsWith("auth/")) {
        const wrongLogin = ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(code);
        // Unknown codes are shown as-is so a setup problem is never mistaken for a bad password.
        setError(MESSAGES[code] ?? (wrongLogin ? "Wrong email or password." : `Sign-in failed (${code}).`));
      } else {
        setError(e instanceof Error ? e.message : "Sign-in failed.");
      }
      setBusy(false);
    }
  }

  return { busy, error, setError, finish };
}

export const ON_EMULATOR = !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
