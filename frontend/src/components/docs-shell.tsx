"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { docsNav, getAdjacent, getChildren, type DocItem } from "@/lib/docs-nav";
import { DocsSearch } from "@/components/docs-search";

/**
 * Docs layout shell - left sidebar (sticky on desktop, drawer on mobile) +
 * main content column. Mirrors the Mintlify reference (docs.etherex.finance)
 * but rendered in our cyberpunk palette.
 */
export function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const [mobileOpen, setMobileOpen] = useState(false);

  const adj = getAdjacent(pathname);
  const childSections = getChildren(pathname);

  return (
    <>
      {/* Top docs subnav bar - sticks to viewport top since /docs has no main Header */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2 text-sm shrink-0">
            <Link
              href="/docs"
              className="font-display font-bold tracking-tight text-foreground hover:opacity-90"
            >
              on-chain<span className="text-primary">DAT</span>{" "}
              <span className="text-muted-foreground font-normal">/ docs</span>
            </Link>
          </div>

          {/* Center: search */}
          <div className="flex-1 flex justify-center px-2 sm:px-4">
            <DocsSearch />
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://www.on-chaindat.com"
              className="hidden sm:inline-flex text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to app
            </a>
            <button
              type="button"
              aria-label="Open docs menu"
              className="md:hidden inline-flex items-center justify-center h-8 w-8 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
              onClick={() => setMobileOpen((v) => !v)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="container grid grid-cols-1 md:grid-cols-[14rem_1fr] lg:grid-cols-[16rem_1fr_3rem] gap-6 lg:gap-10 py-6 sm:py-10">
        {/* Sidebar - desktop */}
        <aside className="hidden md:block">
          <div className="sticky top-[4rem] max-h-[calc(100vh-4.5rem)] overflow-y-auto pr-2">
            <Sidebar pathname={pathname} />
          </div>
        </aside>

        {/* Sidebar - mobile drawer */}
        {mobileOpen ? (
          <div
            className="md:hidden fixed inset-0 z-50 bg-background/85 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          >
            <div
              className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-card border-r border-border p-4 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="mb-3 text-xs text-muted-foreground hover:text-foreground"
              >
                Close ✕
              </button>
              <Sidebar
                pathname={pathname}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </div>
        ) : null}

        {/* Main content */}
        <main className="min-w-0">
          <article className="docs-prose">{children}</article>

          {/* Subsection cards - shown when the current path is a parent
              section in the nav tree (e.g. /docs/dat-types surfaces
              "Classic DATs" and "Yield DATs"). Mirrors the Mintlify
              reference where each child renders as a clickable card with
              a chevron, two per row on >= sm. */}
          {childSections.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
              {childSections.map((c) => (
                <Link
                  key={c.href}
                  href={c.href as never}
                  className="group flex items-center justify-between gap-3 rounded-md border border-border bg-card/40 px-4 py-3 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {c.title}
                  </span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-muted-foreground group-hover:text-primary transition-colors shrink-0"
                    aria-hidden
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              ))}
            </div>
          ) : null}

          {/* Prev / Next */}
          {(adj.prev || adj.next) ? (
            <nav className="mt-12 pt-6 border-t border-border grid grid-cols-2 gap-4">
              <div>
                {adj.prev ? (
                  <Link
                    href={adj.prev.href as never}
                    className="block rounded-md border border-border p-4 hover:border-primary/40 transition-colors group"
                  >
                    <div className="text-xs text-muted-foreground mb-1">← Previous</div>
                    <div className="text-sm font-semibold text-foreground group-hover:text-primary">
                      {adj.prev.title}
                    </div>
                  </Link>
                ) : null}
              </div>
              <div className="text-right">
                {adj.next ? (
                  <Link
                    href={adj.next.href as never}
                    className="block rounded-md border border-border p-4 hover:border-primary/40 transition-colors group"
                  >
                    <div className="text-xs text-muted-foreground mb-1">Next →</div>
                    <div className="text-sm font-semibold text-foreground group-hover:text-primary">
                      {adj.next.title}
                    </div>
                  </Link>
                ) : null}
              </div>
            </nav>
          ) : null}
        </main>

        {/* Spacer column on lg+ to balance the layout */}
        <div className="hidden lg:block" />
      </div>
    </>
  );
}

function Sidebar({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="text-sm">
      <ul className="space-y-0.5">
        {docsNav.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            pathname={pathname}
            depth={0}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </nav>
  );
}

function SidebarLink({
  item,
  pathname,
  depth,
  onNavigate,
}: {
  item: DocItem;
  pathname: string;
  depth: number;
  onNavigate?: () => void;
}) {
  const active = pathname === item.href;
  // First-level items get a slightly heavier visual weight; nested children
  // sit indented under their parent.
  const padLeft = depth === 0 ? "pl-3" : "pl-7";
  const weight = depth === 0 ? "font-medium" : "font-normal";
  return (
    <li>
      <Link
        href={item.href as never}
        onClick={onNavigate}
        className={
          "group block rounded-md pr-3 py-1.5 transition-colors border-l-2 " +
          padLeft +
          " " +
          weight +
          " " +
          (active
            ? "text-primary border-primary bg-primary/5"
            : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40")
        }
        style={
          active
            ? { textShadow: "0 0 8px hsl(var(--primary) / 0.55)" }
            : undefined
        }
      >
        {item.title}
      </Link>
      {item.children && item.children.length > 0 ? (
        <ul className="mt-0.5 space-y-0.5">
          {item.children.map((child) => (
            <SidebarLink
              key={child.href}
              item={child}
              pathname={pathname}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
