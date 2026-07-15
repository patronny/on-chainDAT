import type { Metadata } from "next";
import { DocsShell } from "@/components/docs-shell";
import { DocsBreadcrumbJsonLd } from "@/components/docs-breadcrumb-jsonld";

export const metadata: Metadata = {
  title: { default: "LDAT Docs", template: "%s - LDAT Docs" },
  description:
    "Technical and operational documentation for LDAT - the perpetual, automated digital asset treasury (DAT) on Linea L2.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DocsBreadcrumbJsonLd />
      <DocsShell>{children}</DocsShell>
    </>
  );
}
