"use server";

import { createHash, randomInt } from "node:crypto";
import { adminAuth, db } from "@/lib/firebase/admin";
import { SITE } from "@/lib/site";
import { CLIENTS, clientName } from "@/lib/whatsapp/numbers";
import { sendWhatsApp } from "@/lib/whatsapp/send";

const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_AFTER_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

type CodeResult = { ok: true; devCode?: string } | { ok: false; error: string };
type TokenResult = { ok: true; token: string } | { ok: false; error: string };

/** Digits only with country code; a bare 10-digit number is taken as Indian (+91). */
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  const full = digits.length === 10 ? `91${digits}` : digits;
  return full.length >= 11 && full.length <= 15 ? full : null;
}

const hashCode = (phone: string, code: string) => createHash("sha256").update(`${phone}:${code}`).digest("hex");

/** One account per phone number. Creates the client profile the first time. */
async function tokenForPhone(phone: string): Promise<string> {
  const uid = `wa${phone}`;
  const ref = db().collection("users").doc(uid);
  if (!(await ref.get()).exists) {
    const known = clientName(phone);
    await ref.set({
      email: "",
      name: known === "Customer" ? `Customer ${phone.slice(-4)}` : known,
      role: "client",
      phone,
      company: null,
      createdAt: new Date().toISOString(),
    });
  }
  return adminAuth().createCustomToken(uid);
}

/** Step 1: sends a 6-digit login code to the number on WhatsApp. */
export async function requestLoginCode(rawPhone: string): Promise<CodeResult> {
  try {
    const phone = normalisePhone(rawPhone);
    if (!phone) return { ok: false, error: "Enter your mobile number with country code, e.g. 91 98765 43210." };

    const ref = db().collection("loginCodes").doc(phone);
    const existing = (await ref.get()).data();
    if (existing && Date.now() - existing.sentAt < RESEND_AFTER_MS) {
      return { ok: false, error: "A code was just sent. Wait a minute before asking for another." };
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await ref.set({ hash: hashCode(phone, code), sentAt: Date.now(), expiresAt: Date.now() + CODE_TTL_MS, attempts: 0 });
    // On the local emulators nothing is sent; the code is shown on screen instead.
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST) return { ok: true, devCode: code };

    const status = await sendWhatsApp(
      phone,
      `*${SITE.name}* login code: *${code}*\nValid for 5 minutes. Do not share it with anyone.`,
      "login-code",
    );
    if (status !== "sent") {
      await ref.delete();
      return {
        ok: false,
        error: "We could not send a WhatsApp message to this number. Send “Hi” to our WhatsApp number first, then try again.",
      };
    }
    return { ok: true };
  } catch (err) {
    console.error("requestLoginCode error:", err);
    return { ok: false, error: "Could not send the code. Try again." };
  }
}

/** Step 2: checks the code and returns a sign-in token for that phone number. */
export async function verifyLoginCode(rawPhone: string, code: string): Promise<TokenResult> {
  try {
    const phone = normalisePhone(rawPhone);
    if (!phone || !/^\d{6}$/.test(code.trim())) return { ok: false, error: "Enter the 6-digit code." };

    const ref = db().collection("loginCodes").doc(phone);
    const saved = (await ref.get()).data();
    if (!saved || saved.expiresAt < Date.now()) return { ok: false, error: "That code has expired. Ask for a new one." };
    if (saved.attempts >= MAX_ATTEMPTS) {
      await ref.delete();
      return { ok: false, error: "Too many wrong tries. Ask for a new code." };
    }
    if (saved.hash !== hashCode(phone, code.trim())) {
      await ref.update({ attempts: saved.attempts + 1 });
      return { ok: false, error: "Wrong code. Check the WhatsApp message and try again." };
    }
    await ref.delete();
    return { ok: true, token: await tokenForPhone(phone) };
  } catch (err) {
    console.error("verifyLoginCode error:", err);
    return { ok: false, error: "Could not verify the code. Try again." };
  }
}

/**
 * Demo: signs in as the mill's registered client number without a code, like the
 * 1-click staff logins. Set DEMO_LOGIN=off in the environment to switch it off.
 */
export async function demoClientLogin(): Promise<TokenResult> {
  try {
    const client = CLIENTS[0];
    if (process.env.DEMO_LOGIN === "off" || !client) return { ok: false, error: "Demo login is switched off." };
    return { ok: true, token: await tokenForPhone(client.phone) };
  } catch (err) {
    console.error("demoClientLogin error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Demo login failed. Try again." };
  }
}
