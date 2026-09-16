import { hasGoogle } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-6">
      <div className="rise-in w-full max-w-sm">
        <img src="/logo/artifacts-mark.svg" alt="" aria-hidden className="mx-auto mb-6 h-20 w-20 rounded-[18px]" />
        <div className="num-stamp mb-3 text-center">Artifacts · 아티팩트</div>
        <h1 className="mb-2 text-center font-display text-4xl font-bold tracking-tight">defy.works</h1>
        <p className="mb-8 text-center text-sm text-white/65">
          Sign in to publish, share and edit interactive pages.
        </p>
        <LoginForm google={hasGoogle} />
        <p className="mt-6 text-center text-[11px] text-white/40">
          By signing in you agree to the{" "}
          <a href="/terms" className="text-indigo-300/80 hover:underline">terms</a> and{" "}
          <a href="/privacy" className="text-indigo-300/80 hover:underline">privacy policy</a>.
        </p>
      </div>
    </div>
  );
}
