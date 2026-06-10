import Link from "next/link";
import { DEFAULT_CHAIN_ID } from "@/lib/wagmi";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/30 mt-12 sm:mt-20">
      <div className="container py-8 sm:py-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
          <div className="col-span-2 sm:col-span-1">
            <h3 className="text-lg font-display font-bold mb-2">
              <Link href="/" aria-label="on-chainDAT home" className="hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary rounded-sm">
                on-chain<span className="text-primary">DAT</span>
              </Link>
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Perpetual, automated digital asset treasury on Linea. Buy bags, sell bags, watch supply burn.
            </p>
            <div className="inline-flex items-center gap-2 mt-4 flex-wrap">
              <span className="text-sm text-muted-foreground">Created by</span>
              <a
                href="https://x.com/PaTRoN4egLabs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 group focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                aria-label="PaTRoNLabs on X (Twitter)"
                title="@PaTRoN4egLabs"
              >
                <span className="font-display font-bold text-sm uppercase tracking-wider">
                  <span className="text-secondary">PaTRoN</span>
                  <span
                    className="text-primary ml-1"
                    style={{ textShadow: "0 0 6px hsl(var(--primary) / 0.9), 0 0 14px hsl(var(--primary) / 0.55)" }}
                  >
                    Labs
                  </span>
                </span>
                <span className="relative inline-block w-7 h-7 rounded-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/patronlabs.png"
                    alt="PaTRoNLabs"
                    width={28}
                    height={28}
                    className="absolute inset-0 w-full h-full object-cover scale-125"
                  />
                </span>
              </a>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Protocol</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/" className="hover:text-foreground">Home</Link></li>
              <li><Link href="/dats" className="hover:text-foreground">All DATs</Link></li>
              <li><Link href="/portfolio" className="hover:text-foreground">Portfolio</Link></li>
              <li><Link href="/transfer" className="hover:text-foreground">Transfer</Link></li>
              <li><Link href="/about" className="hover:text-foreground">About</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="https://docs.on-chaindat.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Docs</a></li>
              <li><Link href="/status" className="hover:text-foreground">Status</Link></li>
              <li><a href="https://github.com/patronny/LineaDAT" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">GitHub</a></li>
              <li><a href="https://t.me/onchainDAT" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Telegram</a></li>
              <li><Link href="/contacts" className="hover:text-foreground">Contacts</Link></li>
              <li><Link href="/terms" className="hover:text-foreground">Terms of Service</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Network</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {DEFAULT_CHAIN_ID === 59144 ? (
                <>
                  <li>Linea</li>
                  <li>Base (coming soon)</li>
                </>
              ) : (
                <>
                  <li>Base Sepolia (testnet)</li>
                  <li>Linea (coming soon)</li>
                  <li>Base (coming soon)</li>
                </>
              )}
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-border text-xs text-muted-foreground text-center space-y-2">
          <div>© 2026 on-chainDAT. Forked from TokenWorks ERC20Strategy v3 (MIT). Open source.</div>
          <div>LINEADAT is a community project and is not affiliated with, endorsed by, or sponsored by Linea or ConsenSys.</div>
        </div>
      </div>
    </footer>
  );
}
