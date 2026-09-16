"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Spinner } from "@/components/ui/Spinner";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.9h5.35c-.25 1.4-1.6 4.1-5.35 4.1-3.2 0-5.85-2.65-5.85-5.9S8.8 6.3 12 6.3c1.85 0 3.05.8 3.75 1.45l2.55-2.45C16.7 3.8 14.55 2.9 12 2.9 6.95 2.9 2.9 6.95 2.9 12s4.05 9.1 9.1 9.1c5.25 0 8.75-3.7 8.75-8.9 0-.6-.05-1.05-.4-1.1z"
      />
    </svg>
  );
}

/** Magic link only (plus Google when configured). No passwords anywhere. */
function Inner({ google }: { google: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session, isPending } = useSession();
  const from = params?.get("from") ?? "/";
  const error = params?.get("error");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && session) router.replace(from);
  }, [isPending, session, from, router]);

  useEffect(() => {
    if (error) toast.error("That sign-in link is invalid or has expired. Request a new one.");
  }, [error]);

  async function send() {
    setBusy(true);
    try {
      const r = await authClient.signIn.magicLink({ email, callbackURL: window.location.origin + from });
      if (r.error) toast.error(r.error.message ?? "Could not send the link");
      else setSentTo(email);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    send();
  }

  if (isPending) {
    return (
      <div className="glass flex items-center justify-center p-10">
        <Spinner />
      </div>
    );
  }

  if (sentTo) {
    return (
      <div className="glass p-6">
        <div className="num-stamp mb-2">Check your inbox</div>
        <h2 className="font-display text-xl font-bold tracking-tight">We emailed you a sign-in link</h2>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          Open the link we sent to <span className="text-white">{sentTo}</span>. It works once and expires in 10
          minutes. First time here? The link creates your account.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSentTo(null)}>
            Use a different email
          </Button>
          <Button variant="secondary" size="sm" onClick={send} disabled={busy}>
            Resend
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-6">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="email" className="mb-1.5">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@company.com"
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? <Spinner className="border-t-white" /> : "Email me a sign-in link"}
        </Button>
        <p className="text-center text-[11px] leading-relaxed text-white/45">
          No password. We send a one-time link; opening it signs you in or creates your account.
        </p>
      </form>

      {google && (
        <>
          <div className="my-5 flex items-center gap-3">
            <span className="hairline flex-1" />
            <span className="num-stamp">or</span>
            <span className="hairline flex-1" />
          </div>
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => authClient.signIn.social({ provider: "google", callbackURL: window.location.origin + from })}
          >
            <GoogleIcon />
            Continue with Google
          </Button>
        </>
      )}
    </div>
  );
}

export function LoginForm({ google }: { google: boolean }) {
  return (
    <Suspense fallback={null}>
      <Inner google={google} />
    </Suspense>
  );
}
