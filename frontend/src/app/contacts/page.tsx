import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Contacts - LineaDAT",
  description:
    "All contact channels for the on-chainDAT / LineaDAT team: founder, legal, security, support, and partnerships.",
};

interface ContactRow {
  label: string;
  href: string;
  display: string;
  description: string;
  external?: boolean;
}

const founder: ContactRow = {
  label: "Founder",
  href: "https://x.com/patron4eg",
  display: "@patron4eg on X",
  description: "Direct line to the founder for personal questions, ideas, and community.",
  external: true,
};

const team: ContactRow = {
  label: "Team / brand",
  href: "https://x.com/PaTRoN4egLabs",
  display: "@PaTRoN4egLabs on X",
  description: "Public announcements, releases, and ecosystem updates from PaTRoNLabs.",
  external: true,
};

const telegramChannel: ContactRow = {
  label: "Telegram channel",
  href: "https://t.me/onchainDAT",
  display: "@onchainDAT on Telegram",
  description: "Official announcements: launches, burns, and protocol updates.",
  external: true,
};

const telegramChat: ContactRow = {
  label: "Telegram community chat",
  href: "https://t.me/onchainDAT_chat",
  display: "@onchainDAT_chat on Telegram",
  description: "Community discussion: questions, trading talk, and feedback.",
  external: true,
};

const emails: ContactRow[] = [
  {
    label: "General support",
    href: "mailto:support@on-chaindat.com",
    display: "support@on-chaindat.com",
    description: "User questions, bug reports, frontend issues, account recovery flows.",
  },
  {
    label: "Partnerships",
    href: "mailto:partner@on-chaindat.com",
    display: "partner@on-chaindat.com",
    description:
      "Integrations, co-marketing, ecosystem grants, listings, and any partnership proposal.",
  },
  {
    label: "Legal",
    href: "mailto:legal@on-chaindat.com",
    display: "legal@on-chaindat.com",
    description:
      "Questions about the Terms of Service, compliance, and formal correspondence.",
  },
  {
    label: "Security disclosures",
    href: "mailto:security@on-chaindat.com",
    display: "security@on-chaindat.com",
    description:
      "Responsible disclosure of vulnerabilities in contracts, frontend, infra, or keeper.",
  },
];

export default function ContactsPage() {
  return (
    <>
      <Header />
      <main className="container py-10 sm:py-16 min-h-[calc(100vh-3.5rem)] max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-display font-bold mb-3">Contacts</h1>
        <p className="text-base text-muted-foreground mb-8 leading-relaxed">
          Everything you need to reach the on-chainDAT / LineaDAT team. Pick the channel that fits
          your question - we route partnership and security mail separately, so the right address
          gets you a faster reply.
        </p>

        <section className="space-y-3 mb-10">
          <h2 className="text-xl font-display font-semibold mb-2">Public channels</h2>
          <ContactCard row={founder} />
          <ContactCard row={team} />
          <ContactCard row={telegramChannel} />
          <ContactCard row={telegramChat} />
        </section>

        <section className="space-y-3 mb-10">
          <h2 className="text-xl font-display font-semibold mb-2">Direct email</h2>
          {emails.map((row) => (
            <ContactCard key={row.label} row={row} />
          ))}
        </section>

        <section className="rounded-md border border-border bg-secondary/20 p-4 sm:p-5 text-sm text-muted-foreground leading-relaxed">
          <h2 className="text-base font-display font-semibold text-foreground mb-2">
            Pick the right address
          </h2>
          <ul className="space-y-1 list-disc pl-5">
            <li>
              Stuck with a swap, faucet, or wallet flow on the testnet UI -{" "}
              <strong className="text-foreground">support@</strong>.
            </li>
            <li>
              Want to integrate, list, co-market, or grant -{" "}
              <strong className="text-foreground">partner@</strong>.
            </li>
            <li>
              Found a bug that could lose user funds -{" "}
              <strong className="text-foreground">security@</strong>. Please do not post on X
              before we acknowledge.
            </li>
            <li>
              Anything tied to the Terms of Service -{" "}
              <strong className="text-foreground">legal@</strong>.
            </li>
            <li>
              Anything else, or a general &quot;hi&quot; -{" "}
              <strong className="text-foreground">@patron4eg on X</strong> is the fastest path to
              the founder.
            </li>
          </ul>
        </section>
      </main>
      <Footer />
    </>
  );
}

function ContactCard({ row }: { row: ContactRow }) {
  return (
    <a
      href={row.href}
      target={row.external ? "_blank" : undefined}
      rel={row.external ? "noopener noreferrer" : undefined}
      className="block rounded-md border border-border bg-card hover:border-primary/60 hover:bg-card/80 transition-colors p-4 sm:p-5 focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          {row.label}
        </span>
        <span className="text-xs text-primary font-mono">
          {row.external ? "↗" : "→"}
        </span>
      </div>
      <div className="text-base font-mono font-semibold text-foreground break-all">
        {row.display}
      </div>
      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{row.description}</p>
    </a>
  );
}
