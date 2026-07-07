"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { readConsent, writeConsent } from "@/lib/consent";
import { isTosSkipped, tosAccepted } from "@/lib/tos";

// Bottom-anchored, non-blocking analytics consent banner. GA is cookieless by
// default; this only offers to upgrade to cookie-based analytics. Shown once,
// until a choice is stored, and never while the blocking TOS gate is up (so its
// buttons are never tab-reachable behind that modal's backdrop).
export function CookieConsent() {
  const pathname = usePathname();
  // Start hidden so SSR markup matches the first client paint; reveal in an
  // effect only when there is no stored choice AND no TOS gate covering it.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (readConsent() !== null) return;
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    // The TOS gate blocks only when TOS is unaccepted on a non-skipped route.
    // Once accepted (or on a skip route like /docs) we can show right away;
    // otherwise we stay hidden and re-check on navigation, after the user has
    // dealt with the gate.
    if (tosAccepted() || isTosSkipped(pathname, host)) setOpen(true);
  }, [pathname]);

  if (!open) return null;

  function choose(value: "granted" | "denied") {
    writeConsent(value);
    setOpen(false);
  }

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[90] p-3 sm:p-4"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div
        className="mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-border bg-card/95 p-4 shadow-2xl ring-1 ring-primary/10 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5"
        style={{ boxShadow: "0 0 0 1px hsl(var(--primary) / 0.12), 0 16px 48px -12px hsl(var(--primary) / 0.2)" }}
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          We use cookieless analytics by default. Allow{" "}
          <span className="text-foreground font-medium">analytics cookies</span> to help us
          measure traffic more accurately and improve on-chaindat.com. See our{" "}
          <Link
            href="/terms"
            className="text-primary underline underline-offset-4 hover:no-underline"
          >
            Terms
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => choose("denied")}
            className="min-h-11 flex-1 sm:min-h-0 sm:flex-none"
            aria-label="Decline analytics cookies"
          >
            Decline
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => choose("granted")}
            className="min-h-11 flex-1 sm:min-h-0 sm:flex-none"
            aria-label="Accept analytics cookies"
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
