"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "ldat-tos-accepted-v1";

export function TermsGate() {
  const pathname = usePathname();
  // Start hidden so SSR markup matches first client paint; reveal in effect
  // only when localStorage confirms the user has not yet accepted.
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const checkboxRef = useRef<HTMLInputElement>(null);
  const checkboxId = useId();

  useEffect(() => {
    // Never block the /terms route itself - users must be able to read the
    // agreement before accepting (and the inline link inside the modal opens
    // /terms in a new tab; the gate would otherwise re-cover that tab).
    if (pathname === "/terms") return;
    // Never block /docs/* either - public reading material, no swap/funding
    // interactions originate here so the TOS gate is unnecessary friction.
    if (pathname === "/docs" || pathname.startsWith("/docs/")) return;
    // Never block on the docs subdomain. Note: middleware rewrites
    // docs.on-chaindat.com/* to internal /docs/*, but `usePathname()` returns
    // the visible URL (e.g. "/quickstart"), so the path-based skip above
    // wouldn't catch docs.on-chaindat.com pages - we have to look at host.
    try {
      const host = window.location.hostname.toLowerCase();
      if (host.startsWith("docs.")) return;
    } catch {
      // ignore - fall through to gate logic
    }
    try {
      const accepted = window.localStorage.getItem(STORAGE_KEY);
      if (!accepted) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the dialog for screen readers / keyboard users.
    queueMicrotask(() => checkboxRef.current?.focus());
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  function accept() {
    if (!checked) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ acceptedAt: new Date().toISOString(), version: 1 }),
      );
    } catch {
      // Even if persistence fails, dismiss for the session - better UX than
      // trapping the user behind an immovable modal.
    }
    setOpen(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tos-gate-title"
      aria-describedby="tos-gate-desc"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-background/85 backdrop-blur-sm"
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl ring-1 ring-primary/10"
        style={{ boxShadow: "0 0 0 1px hsl(var(--primary) / 0.15), 0 20px 60px -10px hsl(var(--primary) / 0.25)" }}
      >
        <div className="p-5 sm:p-6 space-y-4">
          <h2
            id="tos-gate-title"
            className="text-xl sm:text-2xl font-display font-bold text-foreground"
          >
            Terms of Service
          </h2>
          <p id="tos-gate-desc" className="text-sm text-muted-foreground leading-relaxed">
            Before using this site please accept our Terms of Service. LDAT is an experimental,
            non-custodial protocol - interactions are final and at your own risk.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/40 pl-3">
            <span className="text-foreground font-semibold">on-chaindat.com</span> and the{" "}
            <span className="text-foreground font-semibold">LDAT</span> token are an independent,
            community-driven project. We are <span className="text-foreground">not affiliated with,
            endorsed by, or sponsored by</span> Linea, ConsenSys, Base, Coinbase, Uniswap, TokenWorks
            or any other company. Brand and network names are used nominatively for descriptive
            purposes only.
          </p>

          <label
            htmlFor={checkboxId}
            className="flex items-start gap-3 cursor-pointer select-none rounded-md border border-border/70 bg-background/50 p-3 hover:border-primary/40 transition-colors"
          >
            <input
              ref={checkboxRef}
              id={checkboxId}
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
            />
            <span className="text-sm text-foreground leading-snug">
              I have read and accept the{" "}
              <Link
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:no-underline"
              >
                Terms of Service
              </Link>
              .
            </span>
          </label>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              size="md"
              variant="default"
              disabled={!checked}
              onClick={accept}
              aria-label="Accept Terms of Service"
            >
              Accept
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
