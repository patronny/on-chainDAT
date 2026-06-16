import type { Metadata } from "next";
import { headers } from "next/headers";
import { DocsShell } from "@/components/docs-shell";

export const metadata: Metadata = {
  title: { default: "LDAT Docs", template: "%s - LDAT Docs" },
  description:
    "Technical and operational documentation for LDAT - the perpetual, automated digital asset treasury (DAT) on Linea L2.",
};

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // When the request lands on the `docs.` subdomain we render the sidebar /
  // brand / prev-next links with bare paths (e.g. `/quickstart`) instead of
  // `/docs/quickstart`, so the browser address bar stays clean. Inline page
  // Links pointing at `/docs/*` are normalized to clean URLs by middleware.
  const headersList = await headers();
  const host = (headersList.get("host") || "").toLowerCase();
  const isSubdomain = host.startsWith("docs.");

  return <DocsShell isSubdomain={isSubdomain}>{children}</DocsShell>;
}
