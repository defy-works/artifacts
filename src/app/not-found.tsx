import NextLink from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-8 text-center">
      <div className="num-stamp mb-3">404</div>
      <h1 className="font-display text-4xl font-bold tracking-tight">Nothing here.</h1>
      <p className="mt-3 max-w-sm text-sm text-white/60">
        This artifact does not exist, or you do not have access to it. If someone shared a link, make sure you are
        signed in with the invited email.
      </p>
      <div className="mt-8 flex gap-3">
        <NextLink href="/">
          <Button variant="secondary">Gallery</Button>
        </NextLink>
        <NextLink href="/login">
          <Button>Sign in</Button>
        </NextLink>
      </div>
    </div>
  );
}
