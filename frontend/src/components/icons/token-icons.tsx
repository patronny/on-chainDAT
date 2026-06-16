import { SVGProps } from "react";

/**
 * Inline SVG token / network icons used in the strategy header and swap card.
 *
 *   <LdatIcon /> - $LDAT brand mark (the chosen "launch-trail coin"):
 *                       deep disc, neon gradient rim, three neon orbit dots
 *                       (pink/green/cyan) and a dashed launch trail to the pink
 *                       dot, with the LDAT wordmark. Source of truth:
 *                       brand/ldat/ldat-icon.svg (t02-launch-pink-dashed).
 *                       Used as the header/app logo (renders large).
 *
 *   <LdatMarkIcon />  - same $LDAT coin, trimmed for small inline use (no star
 *                       dust, no launch trail) so it stays clean at 20-32px in
 *                       the swap card and amount rows.
 *
 *   <LineaIcon />     - LINEA L2 network badge: cyan circle + black L. KEPT
 *                       (network badge is allowed). Used inline next to chain
 *                       name text.
 *
 *   <EthIcon />       - classic Ethereum multi-tone diamond.
 *
 * Export names are intentionally unchanged from the pre-rebrand version so the
 * many import sites keep working; they are renamed in the name-gated sweep.
 * All accept standard <svg> props; size via className (w-5 h-5 ...) or width/height.
 */

const NEON_CYAN = "hsl(180 100% 50%)";
const NEON_PINK = "#ff33cc";
const INK = "#0a0a0f";

export function LdatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
      <filter id="sq-soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="sq-pglow" x="-300%" y="-300%" width="700%" height="700%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="sq-rimglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <radialGradient id="sq-disc" cx="50%" cy="44%" r="62%"><stop offset="0" stopColor="#0b0b16"/><stop offset="0.7" stopColor="#070709"/><stop offset="1" stopColor="#040406"/></radialGradient>
      <linearGradient id="sq-rim" x1="8%" y1="2%" x2="92%" y2="98%"><stop offset="0" stopColor="#ff33cc"/><stop offset="0.5" stopColor="#9b6cff"/><stop offset="1" stopColor="#00ffff"/></linearGradient>
      <linearGradient id="sq-txt" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0" stopColor="#ff33cc"/><stop offset="1" stopColor="#00ffff"/></linearGradient>
      </defs>
      <circle cx="256" cy="256" r="252" fill="#040406"/>
      <circle cx="256" cy="256" r="238" fill="url(#sq-disc)"/>
      <g className="stars"><circle cx="328.5" cy="122.9" r="1.90" fill="#ffffff" opacity="0.20"/><circle cx="265.7" cy="356.9" r="1.13" fill="#bfefff" opacity="0.45"/><circle cx="140.2" cy="306.3" r="1.85" fill="#bfefff" opacity="0.41"/><circle cx="95.1" cy="234.7" r="1.02" fill="#ffffff" opacity="0.33"/><circle cx="350.9" cy="348.4" r="0.75" fill="#ff33cc" opacity="0.21"/><circle cx="388.1" cy="209.8" r="1.08" fill="#bfefff" opacity="0.42"/><circle cx="337.9" cy="223.4" r="0.61" fill="#00ffff" opacity="0.18"/><circle cx="404.5" cy="171.2" r="0.93" fill="#ff33cc" opacity="0.14"/><circle cx="297.3" cy="363.3" r="1.29" fill="#ff33cc" opacity="0.30"/><circle cx="261.2" cy="360.0" r="0.66" fill="#ff33cc" opacity="0.19"/><circle cx="361.2" cy="264.0" r="0.75" fill="#ff33cc" opacity="0.24"/><circle cx="185.0" cy="315.6" r="1.47" fill="#00ffff" opacity="0.14"/><circle cx="247.9" cy="98.5" r="1.82" fill="#ffffff" opacity="0.45"/><circle cx="317.8" cy="299.5" r="1.17" fill="#ff33cc" opacity="0.32"/><circle cx="259.7" cy="382.1" r="1.58" fill="#ff33cc" opacity="0.35"/><circle cx="295.5" cy="136.0" r="1.37" fill="#ffffff" opacity="0.18"/><circle cx="243.7" cy="342.5" r="0.71" fill="#00ffff" opacity="0.32"/><circle cx="458.8" cy="271.4" r="1.34" fill="#ffffff" opacity="0.24"/><circle cx="334.2" cy="311.0" r="1.28" fill="#ff33cc" opacity="0.18"/><circle cx="238.4" cy="107.1" r="0.89" fill="#bfefff" opacity="0.33"/><circle cx="132.1" cy="209.1" r="1.77" fill="#bfefff" opacity="0.29"/><circle cx="387.4" cy="232.9" r="2.03" fill="#ffffff" opacity="0.41"/><circle cx="236.2" cy="125.0" r="1.54" fill="#ffffff" opacity="0.25"/><circle cx="69.7" cy="286.6" r="1.20" fill="#00ffff" opacity="0.21"/><circle cx="181.5" cy="397.1" r="1.06" fill="#bfefff" opacity="0.47"/><circle cx="219.5" cy="171.1" r="0.75" fill="#ff33cc" opacity="0.19"/></g>
      <circle cx="256" cy="256" r="246" fill="none" stroke="url(#sq-rim)" strokeWidth="2" opacity="0.30"/>
      <circle cx="256" cy="256" r="238" fill="none" stroke="url(#sq-rim)" strokeWidth="7" filter="url(#sq-rimglow)"/>
      <circle cx="256" cy="256" r="229" fill="none" stroke="url(#sq-rim)" strokeWidth="1.5" opacity="0.25"/>
      <g filter="url(#sq-soft)">
      <linearGradient id="sq-ptrail" x1="165" y1="210" x2="129.9" y2="54.2" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ff33cc" stopOpacity="0"/><stop offset="0.45" stopColor="#ff33cc" stopOpacity="0.35"/><stop offset="1" stopColor="#ff33cc" stopOpacity="1"/></linearGradient>
      <path d="M165 210 Q108 150 129.9 54.2" fill="none" stroke="url(#sq-ptrail)" strokeWidth="9" strokeLinecap="round" opacity="0.30"/>
      <path d="M165 210 Q108 150 129.9 54.2" fill="none" stroke="url(#sq-ptrail)" strokeWidth="4.5" strokeLinecap="round" strokeDasharray="2 12 4 11 7 10 11 9 16 8" strokeDashoffset="0"/>
      <circle cx="129.9" cy="54.2" r="6" fill="#ff33cc"/>
      </g>
      <circle cx="129.9" cy="54.2" r="11" fill="#ff33cc" filter="url(#sq-pglow)"/>
      <circle cx="486.9" cy="198.4" r="8" fill="#39ff14" filter="url(#sq-pglow)"/>
      <circle cx="174.6" cy="479.6" r="6" fill="#00ffff" filter="url(#sq-pglow)"/>
      <text x="256" y="258" textAnchor="middle" dominantBaseline="central" fontFamily="Futura, Avenir Next, Arial Black, Arial, sans-serif" fontWeight="800" fontSize="104" letterSpacing="5" fill="url(#sq-txt)" filter="url(#sq-soft)">LDAT</text>
    </svg>
  );
}

export function LdatMarkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
      <filter id="tk-soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="tk-pglow" x="-300%" y="-300%" width="700%" height="700%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="tk-rimglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <radialGradient id="tk-disc" cx="50%" cy="44%" r="62%"><stop offset="0" stopColor="#0b0b16"/><stop offset="0.7" stopColor="#070709"/><stop offset="1" stopColor="#040406"/></radialGradient>
      <linearGradient id="tk-rim" x1="8%" y1="2%" x2="92%" y2="98%"><stop offset="0" stopColor="#ff33cc"/><stop offset="0.5" stopColor="#9b6cff"/><stop offset="1" stopColor="#00ffff"/></linearGradient>
      <linearGradient id="tk-txt" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0" stopColor="#ff33cc"/><stop offset="1" stopColor="#00ffff"/></linearGradient>
      </defs>
      <circle cx="256" cy="256" r="252" fill="#040406"/>
      <circle cx="256" cy="256" r="238" fill="url(#tk-disc)"/>
      <circle cx="256" cy="256" r="246" fill="none" stroke="url(#tk-rim)" strokeWidth="2" opacity="0.30"/>
      <circle cx="256" cy="256" r="238" fill="none" stroke="url(#tk-rim)" strokeWidth="7" filter="url(#tk-rimglow)"/>
      <circle cx="256" cy="256" r="229" fill="none" stroke="url(#tk-rim)" strokeWidth="1.5" opacity="0.25"/>
      <g filter="url(#tk-soft)">
      <linearGradient id="tk-ptrail" x1="165" y1="210" x2="129.9" y2="54.2" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ff33cc" stopOpacity="0"/><stop offset="0.45" stopColor="#ff33cc" stopOpacity="0.35"/><stop offset="1" stopColor="#ff33cc" stopOpacity="1"/></linearGradient>
      <path d="M165 210 Q108 150 129.9 54.2" fill="none" stroke="url(#tk-ptrail)" strokeWidth="9" strokeLinecap="round" opacity="0.30"/>
      <path d="M165 210 Q108 150 129.9 54.2" fill="none" stroke="url(#tk-ptrail)" strokeWidth="4.5" strokeLinecap="round" strokeDasharray="2 12 4 11 7 10 11 9 16 8" strokeDashoffset="0"/>
      <circle cx="129.9" cy="54.2" r="6" fill="#ff33cc"/>
      </g>
      <circle cx="129.9" cy="54.2" r="11" fill="#ff33cc" filter="url(#tk-pglow)"/>
      <circle cx="486.9" cy="198.4" r="8" fill="#39ff14" filter="url(#tk-pglow)"/>
      <circle cx="174.6" cy="479.6" r="6" fill="#00ffff" filter="url(#tk-pglow)"/>
      <text x="256" y="258" textAnchor="middle" dominantBaseline="central" fontFamily="Futura, Avenir Next, Arial Black, Arial, sans-serif" fontWeight="800" fontSize="104" letterSpacing="5" fill="url(#tk-txt)" filter="url(#tk-soft)">LDAT</text>
    </svg>
  );
}

export function LineaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="32" cy="32" r="30" fill={NEON_CYAN} />
      <path
        d="M 20 14 L 20 48 L 42 48"
        stroke="#0a0a0f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <circle cx="40" cy="16" r="3.5" fill="#0a0a0f" />
    </svg>
  );
}

export function EthIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 256 417" xmlns="http://www.w3.org/2000/svg" {...props}>
      <polygon fill="#343434" points="127.9,0 125.2,9.5 125.2,285.2 127.9,287.9 255.8,212.3" />
      <polygon fill="#8C8C8C" points="127.9,0 0,212.3 127.9,287.9 127.9,154.2" />
      <polygon fill="#3C3C3B" points="127.9,312.2 126.4,314 126.4,412.2 127.9,416.9 255.9,236.6" />
      <polygon fill="#8C8C8C" points="127.9,416.9 127.9,312.2 0,236.6" />
      <polygon fill="#141414" points="127.9,287.9 255.8,212.3 127.9,154.2" />
      <polygon fill="#393939" points="0,212.3 127.9,287.9 127.9,154.2" />
    </svg>
  );
}
