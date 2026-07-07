// Analytics cookie consent, shared by the GA loader (google-analytics.tsx) and
// the consent banner (cookie-consent.tsx). GA runs cookieless (Consent Mode v2
// analytics_storage: denied) until the visitor opts in here.

export const CONSENT_KEY = "cc-consent"; // stored value: 'granted' | 'denied'

export type ConsentValue = "granted" | "denied";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function readConsent(): ConsentValue | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

// Persist the choice and reflect it into GA Consent Mode v2. Only analytics
// storage is ever granted; ad storage stays denied (no ads on the site).
export function writeConsent(value: ConsentValue): void {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Persistence can fail (private mode, storage disabled) - still update the
    // live consent state so the current session behaves as chosen.
  }
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("consent", "update", {
      analytics_storage: value === "granted" ? "granted" : "denied",
    });
  }
}
