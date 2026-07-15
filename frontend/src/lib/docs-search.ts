/**
 * Static search index for the /docs site. Hand-curated to keep bundle size
 * minimal - no FlexSearch / Fuse / Lunr. Substring + keyword matching is
 * sufficient at this size.
 *
 * To add a page: append an entry here and ensure the `href` matches a route
 * registered in `docs-nav.ts`. Keep the summary < 140 chars.
 */
export type DocSearchEntry = {
  title: string;
  href: string;
  group: string;
  summary: string;
  keywords: string[];
};

export const docsSearch: DocSearchEntry[] = [
  {
    title: "Overview",
    href: "/docs",
    group: "Docs",
    summary: "",
    keywords: ["overview", "intro", "introduction", "start"],
  },
  {
    title: "What is an on-chain DAT?",
    href: "/docs/what-is-an-onchain-dat",
    group: "Docs",
    summary:
      "DAT names three things: a listed company holding crypto, a token carrying that company's share rights, and a smart contract holding a treasury.",
    keywords: [
      "dat",
      "datco",
      "onchain dat",
      "on-chain dat",
      "digital asset treasury",
      "mnav",
      "strategy token",
      "tokenized equity",
      "definition",
      "what is",
    ],
  },
  {
    title: "LDAT",
    href: "/docs/ldat",
    group: "Docs",
    summary: "",
    keywords: ["ldat", "anchor", "linea"],
  },
  {
    title: "Tokenomics",
    href: "/docs/tokenomics",
    group: "Docs",
    summary: "",
    keywords: ["tokenomics", "supply", "fee", "split", "burn"],
  },
  {
    title: "Transfer",
    href: "/docs/transfer",
    group: "Docs",
    summary: "",
    keywords: ["transfer", "send", "wallet"],
  },
  {
    title: "New Launches",
    href: "/docs/new-launches",
    group: "Docs",
    summary: "",
    keywords: ["launches", "new", "upcoming"],
  },
  {
    title: "DAT Types",
    href: "/docs/dat-types",
    group: "Docs",
    summary: "",
    keywords: ["dat", "types", "classic", "yield"],
  },
  {
    title: "Classic DATs",
    href: "/docs/dat-types/classic",
    group: "DAT Types",
    summary: "",
    keywords: ["classic", "dat", "types"],
  },
  {
    title: "Yield DATs (coming soon)",
    href: "/docs/dat-types/yield",
    group: "DAT Types",
    summary: "",
    keywords: ["yield", "dat", "types", "coming soon"],
  },
  {
    title: "FAQ",
    href: "/docs/faq",
    group: "Docs",
    summary: "",
    keywords: ["faq", "questions", "help"],
  },
];

/**
 * Case-insensitive substring search across title / summary / keywords. Empty
 * query returns the full list.
 */
export function searchDocs(query: string): DocSearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return docsSearch;
  return docsSearch.filter((d) => {
    if (d.title.toLowerCase().includes(q)) return true;
    if (d.summary.toLowerCase().includes(q)) return true;
    if (d.group.toLowerCase().includes(q)) return true;
    return d.keywords.some((k) => k.toLowerCase().includes(q));
  });
}
