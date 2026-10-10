"use client";

import { useState } from "react";
import Link from "next/link";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ON_EMULATOR, useSignIn } from "@/lib/auth/use-sign-in";
import { clientAuth } from "@/lib/firebase/client";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

// The Auth emulator accepts a made-up Google identity, which gives a one-click test client.
const DEMO_CLIENT = JSON.stringify({
  sub: "demo-client",
  email: "client@textileflow.test",
  email_verified: true,
  name: "Demo Client",
});

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

type Mode = "login" | "register";

export default function CustomerLoginPage() {
  const { busy, error, setError, finish } = useSignIn();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
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
    setError("");
    setNotice("");
    if (!email) {
      setError("Type your email above first, then click “Forgot password?”.");
      return;
    }
    try {
      await sendPasswordResetEmail(clientAuth(), email);
    } catch {
      // Same message either way, so this cannot be used to check who has an account.
    }
    setNotice("If that email has an account, a password reset link is on its way.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="grid w-full max-w-sm gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{SITE.name}</CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Log in to place an order and follow its progress."
                : "Create a customer account to place orders with us."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Customer account">
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground",
                    mode === m && "bg-background text-foreground shadow-sm",
                  )}
                >
                  {m === "login" ? "Log in" : "Register"}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} className="grid gap-4">
              {mode === "register" && (
                <div className="grid gap-2">
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" name="name" required maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "login" && (
                    <button type="button" onClick={() => void forgotPassword()} className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                      Forgot password?
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
                {mode === "register" && <p className="text-xs text-muted-foreground">At least 6 characters.</p>}
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
              <Button type="submit" size="lg" disabled={busy}>
                {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
              </Button>
            </form>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={busy}
              onClick={() => void finish(() => signInWithPopup(clientAuth(), new GoogleAuthProvider()))}
            >
              <GoogleMark /> Continue with Google
            </Button>
            {ON_EMULATOR && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void finish(() => signInWithCredential(clientAuth(), GoogleAuthProvider.credential(DEMO_CLIENT)))}
              >
                Demo client (test only)
              </Button>
            )}
          </CardContent>
        </Card>
        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>
            Mill staff or owner?{" "}
            <Link href="/admin/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              Staff login →
            </Link>
          </p>
          <p>
            <Link href="/" className="underline-offset-4 hover:underline">← Back to website</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
