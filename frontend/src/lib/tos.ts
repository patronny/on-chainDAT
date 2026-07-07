// Shared knowledge about the blocking Terms-of-Service gate (terms-gate.tsx),
// used by the cookie-consent banner so the two never overlap. The consent
// banner must not surface while the TOS modal is up: its focusable buttons
// would sit (still tab-reachable) behind the modal backdrop.

// Must match the STORAGE_KEY in terms-gate.tsx.
export const TOS_KEY = "ldat-tos-accepted-v1";

export function tosAccepted(): boolean {
  try {
    return !!localStorage.getItem(TOS_KEY);
  } catch {
    return false;
  }
}

// Routes/hosts where terms-gate.tsx intentionally does NOT show the blocking
// gate (mirror of its skip conditions). On these the consent banner is free to
// appear immediately because no modal is covering it.
export function isTosSkipped(pathname: string, hostname: string): boolean {
  if (pathname === "/terms" || pathname === "/docs" || pathname.startsWith("/docs/")) {
    return true;
  }
  return hostname.toLowerCase().startsWith("docs.");
}
