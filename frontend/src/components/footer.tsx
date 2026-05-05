import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/30 mt-12 sm:mt-20">
      <div className="container py-8 sm:py-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
          <div className="col-span-2 sm:col-span-1">
            <h3 className="text-lg font-display font-bold mb-2">
              Linea<span className="text-primary">DAT</span>
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Perpetual, automated digital asset treasury on Linea. Buy bags, sell bags, watch supply burn.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Protocol</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/strategies" className="hover:text-foreground">All strategies</Link></li>
              <li><Link href="/launch" className="hover:text-foreground">Launch</Link></li>
              <li><Link href="/about" className="hover:text-foreground">About</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="https://github.com/patronny/LineaDAT/tree/main/docs" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Docs</a></li>
              <li><a href="https://github.com/patronny/LineaDAT" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">GitHub</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Network</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Base Sepolia (testnet)</li>
              <li>Linea (coming soon)</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-border text-xs text-muted-foreground text-center">
          © 2026 LineaDAT. Forked from TokenWorks ERC20Strategy v3 (MIT). Open source.
        </div>
      </div>
    </footer>
  );
}
