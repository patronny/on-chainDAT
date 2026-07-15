"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchDocs, type DocSearchEntry } from "@/lib/docs-search";

/**
 * Cyberpunk-themed docs search - trigger button on the subnav and a modal
 * with ⌘K (Ctrl+K on non-Mac) global shortcut. No external deps; substring
 * matching against the static `docsSearch` index.
 */
export function DocsSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [shortcut, setShortcut] = useState("⌘K");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = useMemo(() => searchDocs(query), [query]);

  const navTo = useCallback(
    (href: string) => {
      router.push(href as never);
    },
    [router]
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIdx(0);
  }, []);

  // Detect Mac for shortcut hint (client-only - avoids hydration drift).
  useEffect(() => {
    const isMac =
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    setShortcut(isMac ? "⌘K" : "Ctrl+K");
  }, []);

  // ⌘K / Ctrl+K opens; Esc closes; ↑/↓/Enter navigate within modal.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        const target = results[activeIdx];
        if (target) {
          e.preventDefault();
          navTo(target.href);
          close();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, activeIdx, router, close]);

  // Reset highlighted result when query changes.
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // Lock body scroll + focus input when opening.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Trigger - full input-look on md+, icon-only on mobile */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search docs"
        className="group flex items-center gap-2 h-8 rounded-md border border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/40 transition-colors text-muted-foreground px-2 sm:px-3 w-8 sm:w-auto sm:min-w-[14rem] md:min-w-[18rem]"
      >
        <SearchIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden sm:inline text-xs sm:text-sm flex-1 text-left">
          Search docs
        </span>
        <span className="hidden sm:inline-flex items-center gap-0.5 text-[0.65rem] font-mono px-1.5 py-0.5 rounded border border-border/70 bg-background/50">
          {shortcut}
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search documentation"
          className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[10vh] sm:pt-[14vh] bg-background/85 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="w-full max-w-xl rounded-xl border border-border bg-card overflow-hidden"
            style={{
              boxShadow:
                "0 0 0 1px hsl(var(--primary) / 0.15), 0 24px 60px -10px hsl(var(--primary) / 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input row */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <SearchIcon className="h-4 w-4 text-primary shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search docs..."
                className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
              />
              <kbd className="text-[0.65rem] font-mono px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {results.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No results for{" "}
                  <span className="text-foreground font-mono">
                    &quot;{query}&quot;
                  </span>
                </div>
              ) : (
                <ul className="py-1">
                  {results.map((r, i) => (
                    <SearchResult
                      key={r.href}
                      entry={r}
                      active={i === activeIdx}
                      onHover={() => setActiveIdx(i)}
                      onClick={() => {
                        navTo(r.href);
                        close();
                      }}
                    />
                  ))}
                </ul>
              )}
            </div>

            {/* Footer keyboard hints */}
            <div className="px-4 py-2 border-t border-border flex items-center justify-end gap-3 text-[0.65rem] text-muted-foreground">
              <Hint label="↑↓" caption="navigate" />
              <Hint label="↵" caption="open" />
              <Hint label="esc" caption="close" />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SearchResult({
  entry,
  active,
  onHover,
  onClick,
}: {
  entry: DocSearchEntry;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onMouseEnter={onHover}
        onClick={onClick}
        className={
          "w-full text-left px-4 py-2.5 transition-colors flex items-start gap-3 border-l-2 " +
          (active
            ? "bg-primary/5 border-primary"
            : "border-transparent hover:bg-muted/40")
        }
      >
        <span
          className={
            "text-[0.6rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5 " +
            (active
              ? "bg-primary/15 text-primary"
              : "bg-muted/40 text-muted-foreground")
          }
        >
          {entry.group}
        </span>
        <span className="flex-1 min-w-0">
          <span
            className={
              "block text-sm font-semibold " +
              (active ? "text-primary" : "text-foreground")
            }
            style={
              active
                ? { textShadow: "0 0 6px hsl(var(--primary) / 0.5)" }
                : undefined
            }
          >
            {entry.title}
          </span>
          <span className="block text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {entry.summary}
          </span>
        </span>
      </button>
    </li>
  );
}

function Hint({ label, caption }: { label: string; caption: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="font-mono px-1 py-0.5 rounded border border-border bg-muted/40 text-foreground/70 leading-none">
        {label}
      </kbd>
      <span>{caption}</span>
    </span>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
