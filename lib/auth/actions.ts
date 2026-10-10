"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, db } from "@/lib/firebase/admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/auth/session";
import type { Role } from "@/lib/types";

type SessionResult = { ok: true; home: string } | { ok: false; error: string };

/** `displayName` is only used when a brand-new client registers with email and password. */
export async function createSession(idToken: string, displayName?: string): Promise<SessionResult> {
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    const ref = db().collection("users").doc(decoded.uid);
    const snap = await ref.get();
    let role = snap.exists ? (snap.data()!.role as Role) : null;

    if (!role) {
      // Anyone who registers or signs in for the first time becomes a client. Staff roles
      // are only ever granted by "npm run create-user", never here.
      role = "client";
      const name = displayName?.trim().slice(0, 80) || (decoded.name as string | undefined) || decoded.email || "Customer";
      await ref.set({
        email: decoded.email ?? "",
        name,
        role,
        phone: null,
        company: null,
        createdAt: new Date().toISOString(),
      });
    }

    const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
    (await cookies()).set(SESSION_COOKIE, cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });
    return { ok: true, home: role === "client" ? "/portal" : "/admin" };
  } catch {
    return { ok: false, error: "Could not start a session. Try signing in again." };
  }
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/");
}
