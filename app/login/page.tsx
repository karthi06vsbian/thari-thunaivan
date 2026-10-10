"use client";

import { useState } from "react";
import Link from "next/link";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { demoClientLogin, requestLoginCode, verifyLoginCode } from "@/lib/auth/phone-actions";
import { useSignIn } from "@/lib/auth/use-sign-in";
import { clientAuth } from "@/lib/firebase/client";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";
import { CLIENTS } from "@/lib/whatsapp/numbers";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}

type Method = "phone" | "email";
type Mode = "login" | "register";

// The mill's registered client number, used for the 1-click demo sign in.
const DEMO_CLIENT_PHONE = CLIENTS[0]?.phone ?? "";

export default function ClientLoginPage() {
  const { busy, error, setError, finish } = useSignIn();
  const [method, setMethod] = useState<Method>("phone");
  const [mode, setMode] = useState<Mode>("login");
  const [phone, setPhone] = useState(DEMO_CLIENT_PHONE);
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");

  function reset() {
    setError("");
    setNotice("");
  }

  /** Signs in with a token the server issued for a verified phone number. */
  function signInWithToken(getToken: () => Promise<{ ok: true; token: string } | { ok: false; error: string }>) {
    reset();
    void finish(async () => {
      const result = await getToken();
      if (!result.ok) throw new Error(result.error);
      return signInWithCustomToken(clientAuth(), result.token);
    });
  }

  async function sendCode() {
    reset();
    setSending(true);
    const result = await requestLoginCode(phone);
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCodeSent(true);
    setCode(result.devCode ?? "");
    setNotice(
      result.devCode
        ? `Test mode: your code is ${result.devCode}.`
        : "We sent a 6-digit code to your WhatsApp. Enter it below.",
    );
  }

  function onEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    if (mode === "login") {
      void finish(() => signInWithEmailAndPassword(clientAuth(), email, password));
      return;
    }
    void finish(async () => {
      const credential = await createUserWithEmailAndPassword(clientAuth(), email, password);
      await updateProfile(credential.user, { displayName: name.trim() });
      return credential;
    }, name);
  }

  async function forgotPassword() {
    reset();
    if (!email) {
      setError("Type your email above first, then click “Forgot?”.");
      return;
    }
    try {
      await sendPasswordResetEmail(clientAuth(), email);
    } catch {
      // Same message either way, so this cannot be used to check who has an account.
    }
    setNotice("If that email has an account, a password reset link is on its way.");
  }

  const working = busy || sending;

  return (
    <main className="hero-weave relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div aria-hidden="true" className="blob absolute -top-24 right-[-6rem] size-96 rounded-full bg-teal/30 blur-3xl" />
      <div aria-hidden="true" className="blob absolute bottom-[-8rem] left-[-4rem] size-80 rounded-full bg-white/10 blur-3xl [animation-delay:-4s]" />
      <div className="rise relative grid w-full max-w-md gap-4">
        <Card className="shadow-2xl shadow-black/30">
          <CardHeader className="pb-3 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight text-brand">{SITE.name}</CardTitle>
            <p className="text-xs font-medium text-muted-foreground">தறி துணைவன் · Client login</p>
          </CardHeader>

          <CardContent className="grid gap-4">
            <div className="rounded-lg border border-teal/30 bg-teal-soft px-3 py-2 text-xs">
              <p className="font-semibold text-foreground">🛒 Customer &amp; Buyer Portal</p>
              <p className="mt-1 leading-relaxed text-muted-foreground">
                Sign in with your mobile number to order fabric and track weaving progress.
              </p>
            </div>

            {DEMO_CLIENT_PHONE && (
              <Button
                type="button"
                size="lg"
                disabled={working}
                onClick={() => signInWithToken(demoClientLogin)}
                className="btn-shine w-full font-semibold shadow"
              >
                ⚡ 1-Click Sign In as Client (+{DEMO_CLIENT_PHONE})
              </Button>
            )}

            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Sign-in method">
              {(["phone", "email"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={method === m}
                  onClick={() => {
                    setMethod(m);
                    reset();
                  }}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200",
                    method === m ? "bg-brand text-white shadow-sm" : "text-muted-foreground hover:text-brand",
                  )}
                >
                  {m === "phone" ? "Mobile number" : "Email"}
                </button>
              ))}
            </div>

            {method === "phone" ? (
              <form
                className="grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (codeSent) signInWithToken(() => verifyLoginCode(phone, code));
                  else void sendCode();
                }}
              >
                <div className="grid gap-1.5">
                  <Label htmlFor="phone" className="text-xs">Mobile / WhatsApp number (with country code)</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    required
                    autoComplete="tel"
                    placeholder="91 98765 43210"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setCodeSent(false);
                      setCode("");
                    }}
                  />
                </div>
                {codeSent && (
                  <div className="rise grid gap-1.5">
                    <Label htmlFor="code" className="text-xs">6-digit code from WhatsApp</Label>
                    <Input
                      id="code"
                      name="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      maxLength={6}
                      pattern="\d{6}"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      className="text-center text-lg tracking-[0.5em]"
                    />
                  </div>
                )}
                <Button type="submit" variant="secondary" disabled={working} className="w-full">
                  {working ? "Please wait…" : codeSent ? "Verify & Sign In" : "Send code on WhatsApp"}
                </Button>
                {codeSent && (
                  <button type="button" disabled={working} onClick={() => void sendCode()} className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                    Send a new code
                  </button>
                )}
              </form>
            ) : (
              <form onSubmit={onEmailSubmit} className="grid gap-3">
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                  {(["login", "register"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMode(m);
                        reset();
                      }}
                      className={cn(
                        "rounded-md px-3 py-1 text-xs font-medium",
                        mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                      )}
                    >
                      {m === "login" ? "Sign In" : "Register New Account"}
                    </button>
                  ))}
                </div>
                {mode === "register" && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="name" className="text-xs">Your Name</Label>
                    <Input id="name" name="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter full name" />
                  </div>
                )}
                <div className="grid gap-1.5">
                  <Label htmlFor="email" className="text-xs">Email</Label>
                  <Input id="email" name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs">Password</Label>
                    {mode === "login" && (
                      <button type="button" onClick={() => void forgotPassword()} className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                        Forgot?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="secondary" disabled={working} className="w-full">
                  {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Customer Account"}
                </Button>
              </form>
            )}

            {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}
            {notice && <p role="status" className="text-xs text-emerald-700">{notice}</p>}

            <div className="border-t pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={working}
                onClick={() => void finish(() => signInWithPopup(clientAuth(), new GoogleAuthProvider()))}
                className="w-full text-xs"
              >
                <GoogleMark /> Continue with Google
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-white/80">
          <Link href="/" className="underline-offset-4 hover:underline">← Back to Mill Website</Link>
        </p>
      </div>
    </main>
  );
}
