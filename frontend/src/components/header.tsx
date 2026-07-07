"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { WalletMenu } from "./wallet-menu";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);

  // Close the mobile menu on click-outside / Esc (mirrors WalletMenu's pattern).
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (!mobileNavRef.current) return;
      if (!mobileNavRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container flex h-14 sm:h-16 items-center justify-between gap-3 sm:gap-4">
        {/* Logo */}
        <Link href="/" aria-label="on-chainDAT home" className="flex items-center gap-2 flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/onchaindat-mark.svg"
            alt=""
            width={32}
            height={32}
            className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0"
          />
          <span className="text-base sm:text-lg md:text-xl font-display font-bold tracking-tight whitespace-nowrap">
            on-chain<span className="text-primary">DAT</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            Home
          </Link>
          <Link href="/portfolio" className="text-muted-foreground hover:text-foreground transition-colors">
            Portfolio
          </Link>
          <Link href="/dats" className="text-muted-foreground hover:text-foreground transition-colors">
            DATs
          </Link>
          <Link href="/transfer" className="text-muted-foreground hover:text-foreground transition-colors">
            Transfer
          </Link>
          <Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors">
            About
          </Link>
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <WalletMenu />

          {/* Mobile nav: hamburger + dropdown (desktop nav is hidden below md). */}
          <div ref={mobileNavRef} className="relative md:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Toggle navigation menu"
              className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-border bg-card hover:border-primary/40 transition-colors focus-visible:ring-2 focus-visible:ring-primary"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {menuOpen ? (
              <nav
                role="menu"
                className="absolute right-0 top-full mt-2 w-44 rounded-md border border-border bg-card overflow-hidden z-50"
                style={{
                  boxShadow:
                    "0 0 0 1px hsl(var(--primary) / 0.15), 0 18px 40px -8px hsl(var(--primary) / 0.25)",
                }}
              >
                <Link role="menuitem" href="/" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors">
                  Home
                </Link>
                <Link role="menuitem" href="/portfolio" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors">
                  Portfolio
                </Link>
                <Link role="menuitem" href="/dats" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors">
                  DATs
                </Link>
                <Link role="menuitem" href="/transfer" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors">
                  Transfer
                </Link>
                <Link role="menuitem" href="/about" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors">
                  About
                </Link>
              </nav>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
