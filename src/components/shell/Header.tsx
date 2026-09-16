"use client";

import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

const NAV = [
  { num: "01", label: "Gallery", href: "/" },
  { num: "02", label: "API tokens", href: "/settings/tokens" },
];

/**
 * Editorial top chrome, same grammar as defy.works: wordmark left, indexed
 * nav, account on the right, hairline below.
 */
export function Header() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [scrolled, setScrolled] = useState(false);

  // Transparent at rest so the ambient grid runs behind it (same as
  // site_v2); ink + blur only once content scrolls underneath.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,backdrop-filter,border-color] duration-[var(--duration-normal)]",
        scrolled ? "border-white/10 bg-ink/55 backdrop-blur-md" : "border-transparent bg-transparent",
      )}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-3 sm:px-8">
        <NextLink href="/" className="group flex items-center gap-2.5 justify-self-start whitespace-nowrap">
          <img
            src="/logo/artifacts-mark.svg"
            alt=""
            aria-hidden="true"
            className="h-7 w-7 shrink-0 transition-transform duration-[var(--duration-normal)] ease-[var(--ease-out-soft)] group-hover:rotate-[8deg]"
          />
          <span className="flex items-baseline gap-2 text-[12px] sm:text-[13px]">
            <span className="font-display font-bold tracking-tight">defy.works</span>
            <span className="text-white/30" aria-hidden>
              /
            </span>
            <span className="tracking-tight text-white/60">artifacts</span>
          </span>
        </NextLink>

        <nav aria-label="Primary" className="hidden items-center gap-8 justify-self-center md:flex">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <NextLink
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-1.5 text-[13px] transition-colors duration-[var(--duration-fast)]",
                  active ? "text-white" : "text-white/65 hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "font-mono text-[9px] tracking-[0.18em]",
                    active ? "text-indigo-300" : "text-white/35 group-hover:text-indigo-300/80",
                  )}
                >
                  {item.num}
                </span>
                <span className="tracking-[0.02em]">{item.label}</span>
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-x-0 -bottom-1.5 h-[1.5px] origin-left transition-transform duration-[var(--duration-normal)] ease-[var(--ease-out-soft)]",
                    active ? "scale-x-100 bg-indigo-400" : "scale-x-0 bg-indigo-400/70 group-hover:scale-x-100",
                  )}
                />
              </NextLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 justify-self-end">
          {isPending ? null : session ? (
            <>
              <span className="hidden text-xs text-white/60 sm:inline">{session.user.email}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await authClient.signOut();
                  router.push("/login");
                  router.refresh();
                }}
              >
                Sign out
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => router.push("/login")}>
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
