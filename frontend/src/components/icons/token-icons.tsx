import { SVGProps } from "react";

/**
 * Inline SVG token / network icons used in the strategy header and swap card.
 *
 *   <LineastrIcon />  - LineaDAT token mark: black disc with magenta L (same
 *                       geometry as <LineaIcon>, but pink instead of cyan).
 *                       Pink mirrors the project's --primary token and the
 *                       browser-tab favicon.
 *
 *   <LineaIcon />     - LINEA L2 network badge: cyan circle + black L. Used
 *                       inline next to chain-name text.
 *
 *   <EthIcon />       - classic Ethereum multi-tone diamond.
 *
 * All three accept any standard <svg> prop, so callers control size via
 * className (`w-5 h-5`, `w-12 h-12`, …) or width/height. None of them
 * carry their own background - they are pure marks meant to sit on top
 * of arbitrary card surfaces.
 */

const NEON_CYAN = "hsl(180 100% 50%)";
const NEON_PINK = "#ff33cc";
const INK = "#0a0a0f";

export function LineastrIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="32" cy="32" r="30" fill={INK} />
      <circle cx="32" cy="32" r="29" fill="none" stroke={NEON_PINK} strokeWidth="0.8" opacity="0.5" />
      {/* L stroke - left vertical + bottom horizontal */}
      <path
        d="M 20 14 L 20 48 L 42 48"
        stroke={NEON_PINK}
        strokeWidth="8"
        fill="none"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      {/* dot at the top-right of the L */}
      <circle cx="40" cy="16" r="3.5" fill={NEON_PINK} />
    </svg>
  );
}

/**
 *   <LineaDatSquareIcon /> - LineaDAT app/token mark: the "orbit-L" logo - a
 *                       gradient "L" (magenta -> cyan) with a tilted orbital
 *                       ring + glowing dot, on a dark radial disc inside a
 *                       rounded square with a thin gradient rim. Canonical
 *                       $LINEADAT brand mark (matches brand/linea-hub/
 *                       icon-l-orbit-square.svg). Used for the strategy header
 *                       logo, the token badge in the swap card, portfolio rows,
 *                       etc. Gradient/filter ids are fixed but the defs are
 *                       identical across every instance, so duplicate-id reuse
 *                       renders correctly.
 */
export function LineaDatSquareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="lo-sq-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff33cc" />
          <stop offset="1" stopColor="#00ffff" />
        </linearGradient>
        <radialGradient id="lo-sq-disc" cx="0.38" cy="0.32" r="0.85">
          <stop offset="0" stopColor="#1a0b2e" />
          <stop offset="0.55" stopColor="#0a0a0f" />
          <stop offset="1" stopColor="#050509" />
        </radialGradient>
        <linearGradient id="lo-sq-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff33cc" />
          <stop offset="0.5" stopColor="#7a4bd6" />
          <stop offset="1" stopColor="#00ffff" />
        </linearGradient>
        <radialGradient id="lo-sq-sheen" cx="0.5" cy="0.18" r="0.7">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id="lo-sq-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="lo-sq-dotglow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="lo-sq-clip">
          <rect x="4" y="4" width="504" height="504" rx="108" ry="108" />
        </clipPath>
      </defs>
      <rect x="4" y="4" width="504" height="504" rx="108" ry="108" fill="url(#lo-sq-disc)" />
      <g clipPath="url(#lo-sq-clip)">
        <g fill="#ff33cc" opacity="0.05">
          <circle cx="150" cy="150" r="2" /><circle cx="200" cy="150" r="2" /><circle cx="250" cy="150" r="2" /><circle cx="300" cy="150" r="2" /><circle cx="350" cy="150" r="2" />
          <circle cx="150" cy="200" r="2" /><circle cx="350" cy="200" r="2" />
          <circle cx="150" cy="300" r="2" /><circle cx="350" cy="300" r="2" />
          <circle cx="150" cy="360" r="2" /><circle cx="200" cy="360" r="2" /><circle cx="250" cy="360" r="2" /><circle cx="300" cy="360" r="2" /><circle cx="350" cy="360" r="2" />
        </g>
        <rect x="4" y="4" width="504" height="504" fill="url(#lo-sq-sheen)" />
        {/* Orbit ring + dot are deliberately THICKER than brand/linea-hub/
            icon-l-orbit-square.svg (stroke 2.5): this component renders at
            20-64px, where a 2.5px stroke on a 512 viewBox shrinks to ~0.3px
            and vanishes. Thicker keeps the orbit legible small; the Hub PNG
            (always shown large) keeps the thin elegant ring. */}
        <g transform="rotate(-24 256 256)">
          <ellipse cx="256" cy="256" rx="196" ry="92" fill="none" stroke="#00ffff" strokeWidth="12" opacity="0.7" />
          <circle cx="452" cy="256" r="16" fill="url(#lo-sq-g)" filter="url(#lo-sq-dotglow)" />
        </g>
        <g filter="url(#lo-sq-glow)" transform="translate(256 256) scale(3.45) translate(-40 -39)">
          <path d="M27 20 L27 58 L54 58" fill="none" stroke="url(#lo-sq-g)" strokeWidth="9" strokeLinecap="square" />
          <circle cx="51" cy="22" r="4.2" fill="url(#lo-sq-g)" />
        </g>
      </g>
      <rect x="5.5" y="5.5" width="501" height="501" rx="106.5" ry="106.5" fill="none" stroke="url(#lo-sq-rim)" strokeWidth="3" opacity="0.9" />
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
