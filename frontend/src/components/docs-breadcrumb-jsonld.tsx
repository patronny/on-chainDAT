"use client";

import { usePathname } from "next/navigation";
import { docsNav, type DocItem } from "@/lib/docs-nav";
import { JsonLd } from "@/components/json-ld";

/**
 * BreadcrumbList for the /docs tree.
 *
 * Breadcrumb rich results are one of the few structured data types Google still
 * renders, and the trail is derived from docsNav - the same source the sidebar
 * and the prev/next links read - so the markup cannot drift away from the real
 * navigation.
 *
 * Client component only because it needs the live pathname; it still renders
 * into the SSR HTML, which is the only thing a crawler sees.
 */

const SITE = "https://www.on-chaindat.com";

/** Trail from the top of docsNav down to `href`, or [] if the path is not in the tree. */
function trail(href: string): DocItem[] {
  function walk(items: DocItem[], acc: DocItem[]): DocItem[] | null {
    for (const it of items) {
      const next = [...acc, it];
      if (it.href === href) return next;
      if (it.children) {
        const hit = walk(it.children, next);
        if (hit) return hit;
      }
    }
    return null;
  }
  return walk(docsNav, []) ?? [];
}

export function DocsBreadcrumbJsonLd() {
  const pathname = usePathname() || "";

  // /docs is its own nav entry ("Overview"), and it is already the second crumb
  // below, so drop it from the derived trail to avoid "Docs > Overview".
  const rest = trail(pathname).filter((d) => d.href !== "/docs");

  // A path that is not in docsNav gets no breadcrumb at all, rather than one
  // that misdescribes where the page sits.
  if (pathname !== "/docs" && rest.length === 0) return null;

  const crumbs = [
    { name: "Home", url: `${SITE}/` },
    { name: "Docs", url: `${SITE}/docs` },
    ...rest.map((d) => ({ name: d.title, url: `${SITE}${d.href}` })),
  ];

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.name,
          item: c.url,
        })),
      }}
    />
  );
}
