/**
 * schema.org structured data (JSON-LD).
 *
 * Scope is deliberately small. Markup only earns a place here if some consumer
 * actually reads it:
 *
 *   - Organization + WebSite (root layout) - the entity anchor. This is what
 *     Google's Knowledge Graph and the "site name" SERP feature resolve against,
 *     and what an AI assistant reads to answer "who is on-chainDAT". Highest
 *     value of the three.
 *   - FAQPage (/docs/faq) - Google dropped FAQ rich results for non-authoritative
 *     sites in Aug 2023, so this buys nothing on the Google SERP. It stays for
 *     two narrower reasons: Bing still renders FAQ rich results, and the Q/A pairs
 *     give AI crawlers a pre-parsed extraction surface. Weakest of the three.
 *   - BreadcrumbList lives in docs-breadcrumb-jsonld.tsx (it needs the live
 *     pathname, so it has to be a client component).
 *
 * Deliberately NOT here:
 *   - SearchAction / sitelinks searchbox - Google removed that rich result in 2024.
 *   - aggregateRating, review - we have no ratings, and inventing them is both a
 *     policy violation and a lie.
 *   - founder, legalName, address, foundingDate - the repo documents no legal
 *     entity, and /contacts lists @patron4eg as a personal account, not an org
 *     profile. Nothing to assert, so nothing is asserted.
 *
 * Rule for this file: every value must already be true and visible on the live
 * site. sameAs is limited to accounts linked from /contacts or the footer.
 */

type Json = Record<string, unknown>;

const SITE = "https://www.on-chaindat.com";
const ORG_ID = `${SITE}/#organization`;

export function JsonLd({ data }: { data: Json }) {
  return (
    <script
      type="application/ld+json"
      // Data here is static and hand-written. Escaping "<" keeps a future edit
      // from breaking out of the script tag.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/**
 * Organization + WebSite, linked by @id so consumers read them as one entity
 * rather than two unrelated nodes.
 *
 * Note: Google only reads WebSite on the homepage (it drives the site-name
 * feature). Emitting it site-wide from the root layout costs ~120 bytes a page
 * and keeps this to one mount point, which is the better trade.
 */
export function SiteJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": ORG_ID,
            name: "on-chainDAT",
            url: SITE,
            logo: `${SITE}/onchaindat-mark.svg`,
            description:
              "on-chainDAT builds autonomous smart-contract digital asset treasuries (DATs): no company, no shares, no dilution. LDAT, its first and anchor DAT, runs on Linea L2.",
            email: "support@on-chaindat.com",
            // Every entry is linked from /contacts or the site footer.
            // @patron4eg is intentionally absent: /contacts documents it as the
            // founder's personal account, not an on-chainDAT profile.
            sameAs: [
              "https://x.com/PaTRoN4egLabs",
              "https://t.me/onchainDAT",
              "https://t.me/onchainDAT_chat",
              "https://github.com/patronny/on-chainDAT",
            ],
          },
          {
            "@type": "WebSite",
            "@id": `${SITE}/#website`,
            url: SITE,
            name: "on-chainDAT",
            publisher: { "@id": ORG_ID },
          },
        ],
      }}
    />
  );
}

/**
 * The 14 questions on /docs/faq, in page order.
 *
 * KEEP IN SYNC with the prose in src/app/docs/faq/page.tsx. Answers here are the
 * page's own answers as plain text, minus the trailing "See <link>" pointers
 * (navigation, not answer). If you change an answer on the page, change it here
 * too - a FAQPage that contradicts the visible page is worse than no FAQPage,
 * and several of these answers (audit status, upgradeability) are risk copy.
 */
const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "What is a DAT token?",
    a: "DAT stands for Digital Asset Treasury. A DAT token is launched on top of an already existing token: if a token $XXX exists, a $XXXDAT can be launched on top of it. The DAT charges a tax on its own buys and sells, then routes those fees into a treasury that supports its strategy and the underlying asset.",
  },
  {
    q: "Is a DAT token the same as a digital asset treasury company?",
    a: "No, and the acronym collides. In equities, a DAT (or DATCO) is a public company that holds crypto on its balance sheet, and you buy shares in that company. A DAT token here is protocol-native: there is no company, no shares and no filings. The treasury is a smart contract, its holdings are readable on-chain at any block, and there is no board to vote on what it does next.",
  },
  {
    q: "What is $LDAT?",
    a: "$LDAT is the core ecosystem token of on-chainDAT on Linea L2, built on top of the network's base asset, $LINEA. It launched on 2026-06-09 on Linea (chain 59144). Every other DAT launched on this network routes 1% of its trading volume into buying and burning $LDAT.",
  },
  {
    q: "What is the $LDAT trading fee, and where does it go?",
    a: "Every $LDAT buy or sell pays a 10% fee, charged inside the pool's own Uniswap v4 hook. The hook has no address-based branch, so no swap through the pool is exempt from it. (There is a separate owner-controlled whitelist, but it governs transfers rather than the fee.) Of that fee, 8% accumulates $LINEA in the treasury and 2% funds the project. The fee is not extracted from the ecosystem: it stays inside the token's own mechanics.",
  },
  {
    q: "What is the maximum supply?",
    a: "1,000,000,000 tokens for any token launched through on-chainDAT, including $LDAT. The supply is fixed at launch and never increases, while buybacks and transfer fees burn against it.",
  },
  {
    q: "Can the team pull the liquidity?",
    a: "No. At launch the entire supply is sent into the Uniswap v4 pool against $ETH (1,000,000,000 $XXXDAT / 0 $ETH) and the LP position is burned. The position cannot be recovered, so nobody, including the token creator, can withdraw liquidity from the pool. The token stays tradable for as long as the chain runs.",
  },
  {
    q: "Why was the launch fee 99%?",
    a: "To protect the launch from bots and snipers. The initial buy fee starts at 99% and decays to the base fee of that DAT, which for $LDAT is 10%. The high initial fee is not extracted: like every other fee it stays inside the token's own economy.",
  },
  {
    q: "Why can't I send $LDAT straight to another wallet?",
    a: "Because ordinary wallet-to-wallet transfers are disabled by design. If tokens moved freely, they could be paired into a secondary pool on another DEX and traded there without the protocol fee, starving the treasury and the burn. Every token launched through on-chainDAT is therefore non-transferable by default.",
  },
  {
    q: "So how do I move my tokens to another wallet?",
    a: "Through the official relay at on-chaindat.com/transfer. You connect your wallet, enter an amount and a recipient, approve the contract for exactly that amount, and send. The relay is the only sanctioned path, and the approach mirrors how $veAERO positions move on Aerodrome.",
  },
  {
    q: "What does a transfer cost?",
    a: "1% of the amount, on top of gas. The fee is taken in the token itself and burned to the dead address, so the recipient receives 99%. That burn permanently reduces circulating supply and shows up in the protocol's burn total like any buy-and-burn.",
  },
  {
    q: "What is the $LDAT contract address?",
    a: "0x02F289E429655d0C0D713A7dFD26850A81f7cFC5 on Linea mainnet (chain 59144). Always verify the address on Lineascan before trading, and reach the swap through this site rather than through a link someone sent you.",
  },
  {
    q: "Is the $LDAT contract immutable?",
    a: "No. The contract is currently upgradeable and its ownership sits behind a 2-of-3 multisig, so a bug can be fixed quickly during the first months of mainnet, and so the logic can be replaced. The intention is to revoke upgradeability once post-launch testing completes, after which nobody, including the creator, could change a single symbol in it. No date has been committed to, so treat the code as changeable until it happens.",
  },
  {
    q: "Has the protocol been audited?",
    a: "No, there is no third-party audit. on-chainDAT is an experimental DeFi protocol: the contracts are open source and verified on Lineascan, and the treasury is readable on-chain, but nothing here has been reviewed by an external auditor. Trade only what you can afford to lose, and read the Terms of Service.",
  },
  {
    q: "Does the protocol need oracles or a market maker?",
    a: "No. Every DAT launched through on-chainDAT operates autonomously on-chain, with no oracles, no centralized market makers and no manual trade management. Once launched, a DAT keeps operating for as long as the blockchain it sits on remains functional.",
  },
];

export function FaqJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "@id": `${SITE}/docs/faq#faq`,
        mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      }}
    />
  );
}
