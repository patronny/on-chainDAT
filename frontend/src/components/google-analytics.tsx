import Script from "next/script";
import { CONSENT_KEY } from "@/lib/consent";

// GA4 for on-chaindat.com (property 544432985). Consent Mode v2 starts with
// everything denied, so GA runs cookieless (no cookies) and stays GDPR-safe.
// A returning visitor who previously opted in (localStorage cc-consent=granted)
// is upgraded to cookie-based analytics on the very first hit; the consent
// banner (cookie-consent.tsx) captures the choice for new visitors. Vercel Web
// Analytics (also cookieless) runs alongside this in the root layout.
const GA_ID = "G-FE3G03SSJ8";

export function GoogleAnalytics() {
  return (
    <>
      <Script id="ga-consent-default" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied',
            wait_for_update: 500
          });
          try {
            if (localStorage.getItem('${CONSENT_KEY}') === 'granted') {
              gtag('consent', 'update', { analytics_storage: 'granted' });
            }
          } catch (e) {}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
    </>
  );
}
