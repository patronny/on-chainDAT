import Script from "next/script";

// GA4 for on-chaindat.com (property 544432985). Consent Mode v2 with everything
// denied by default, so GA runs cookieless (no cookies set) and stays GDPR-safe
// without a consent banner. Vercel Web Analytics (also cookieless) runs alongside
// this in the root layout.
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
