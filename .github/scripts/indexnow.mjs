#!/usr/bin/env node
// IndexNow: notify Bing/Yandex (and other IndexNow-participating engines) that our URL set changed.
// Google does not participate in IndexNow - for Google the sitemap in Search Console is the channel.
//
// The key is PUBLIC by design: IndexNow proves ownership by fetching the key file over HTTP, so
// committing it is fine. Key file lives at frontend/public/<key>.txt and is served from the site root.
//
// Reads the LIVE sitemap rather than the local sitemap.ts, so the ping can never claim a URL that
// production does not actually serve. Set INDEXNOW_DRY=1 to build and print the payload without
// submitting.

const KEY = '8152797bdb756f9c95f5ad2505b1a19b';
const HOST = 'www.on-chaindat.com';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const SITEMAP = `https://${HOST}/sitemap.xml`;

const res = await fetch(SITEMAP);
if (!res.ok) {
  console.log(`IndexNow: sitemap fetch failed (HTTP ${res.status}), skipping`);
  process.exit(0);
}
const urls = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urls.length) {
  console.log('IndexNow: no URLs in sitemap, skipping');
  process.exit(0);
}

const body = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls };

if (process.env.INDEXNOW_DRY) {
  console.log(`IndexNow DRY: would submit ${urls.length} urls (host=${HOST}, keyLocation=${KEY_LOCATION})`);
  urls.forEach((u) => console.log('  ', u));
  process.exit(0);
}

async function submit() {
  const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  return r.status;
}

try {
  let status = await submit();
  // Right after a deploy the key file may not have reached the CDN edge yet, so IndexNow's
  // key-validation fetch returns 403/404. Wait once and retry so the ping is not silently lost.
  if (status === 403 || status === 404) {
    await new Promise((r) => setTimeout(r, 15000));
    status = await submit();
  }
  console.log(`IndexNow: HTTP ${status} for ${urls.length} urls (200/202 = accepted).`);
} catch (e) {
  console.log('IndexNow: submission failed (non-fatal):', e.message);
}
