"use client";

import { useState } from "react";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ON_EMULATOR, useSignIn } from "@/lib/auth/use-sign-in";
import { clientAuth } from "@/lib/firebase/client";

// One-click logins for the seeded test users. Only offered on the local emulators.
const DEMO_PASSWORD = ON_EMULATOR ? process.env.NEXT_PUBLIC_DEMO_PASSWORD : undefined;
const DEMO_USERS = [
  { role: "Owner", email: "owner@textileflow.test" },
  { role: "Manager", email: "manager@textileflow.test" },
  { role: "Production", email: "production@textileflow.test" },
  { role: "Accounts", email: "accounts@textileflow.test" },
];

export default function StaffLoginPage() {
  const { busy, error, finish } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const signIn = (e: string, p: string) => finish(() => signInWithEmailAndPassword(clientAuth(), e, p));

  function demoLogin(demoEmail: string) {
    if (!DEMO_PASSWORD) return;
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    void signIn(demoEmail, DEMO_PASSWORD);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="grid w-full max-w-sm gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">TextileFlow · Mill staff</CardTitle>
            <CardDescription>Sign in to manage machines, planning and electricity.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void signIn(email, password);
              }}
            >
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
            </form>
            {DEMO_PASSWORD && (
              <div className="mt-5 grid gap-2 border-t pt-4">
                <p className="text-xs text-muted-foreground">Demo logins — click to fill in and sign in</p>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_USERS.map((u) => (
                    <Button key={u.email} type="button" variant="outline" disabled={busy} onClick={() => demoLogin(u.email)}>
                      {u.role}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/" className="underline-offset-4 hover:underline">← Back to website</Link>
        </p>
      </div>
    </main>
  );
}
