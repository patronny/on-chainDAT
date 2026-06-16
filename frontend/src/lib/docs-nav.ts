/**
 * Single source of truth for the /docs sidebar navigation. Order matters -
 * items render in the order declared here, and prev/next page links at the
 * bottom of each doc derive their order from a flattened walk over this
 * structure (parent first, then its children, then the next top-level item).
 */
export type DocItem = {
  title: string;
  href: string;
  children?: DocItem[];
};

export const docsNav: DocItem[] = [
  { title: "Overview", href: "/docs" },
  { title: "LDAT", href: "/docs/ldat" },
  { title: "Tokenomics", href: "/docs/tokenomics" },
  { title: "Transfer", href: "/docs/transfer" },
  { title: "New Launches", href: "/docs/new-launches" },
  {
    title: "DAT Types",
    href: "/docs/dat-types",
    children: [
      { title: "Classic DATs", href: "/docs/dat-types/classic" },
      { title: "Yield DATs (coming soon)", href: "/docs/dat-types/yield" },
    ],
  },
  { title: "FAQ", href: "/docs/faq" },
];

function flatten(items: DocItem[]): DocItem[] {
  const out: DocItem[] = [];
  for (const it of items) {
    out.push(it);
    if (it.children) out.push(...flatten(it.children));
  }
  return out;
}

export const flatDocs: DocItem[] = flatten(docsNav);

export function getAdjacent(href: string): { prev?: DocItem; next?: DocItem } {
  const i = flatDocs.findIndex((d) => d.href === href);
  if (i === -1) return {};
  return { prev: flatDocs[i - 1], next: flatDocs[i + 1] };
}

// Returns the children of `href` if that path is a parent section with
// subsections in the nav tree. Walks the tree (not just top-level) so future
// nested sections work too. Empty array when the path is a leaf.
export function getChildren(href: string): DocItem[] {
  function walk(items: DocItem[]): DocItem[] | null {
    for (const it of items) {
      if (it.href === href) return it.children ?? [];
      if (it.children) {
        const r = walk(it.children);
        if (r) return r;
      }
    }
    return null;
  }
  return walk(docsNav) ?? [];
}
