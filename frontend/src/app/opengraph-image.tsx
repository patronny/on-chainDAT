import { ImageResponse } from "next/og";

// Social share card for on-chaindat.com. Build-time generated, so it carries no
// dependency on an image file in public/ and no aspect-ratio risk.
// Visual language matches icon.tsx: black field, brand magenta -> cyan gradient.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "LDAT - perpetual, automated digital asset treasury on Linea L2";

const MONO = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#0a0a0a",
          padding: "0 96px",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", fontFamily: MONO, fontSize: 25, letterSpacing: 7, color: "#8a8a8a" }}>
          ON-CHAINDAT.COM
        </div>

        {/* alignSelf shrinks the box to the glyph run: as a stretched column child it
            spans the full 1008px content width, so the gradient would run out of
            magenta before the "T" and never reach cyan. */}
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            fontFamily: MONO,
            fontWeight: 900,
            fontSize: 150,
            letterSpacing: -4,
            marginTop: 26,
            backgroundImage: "linear-gradient(90deg, #ff33cc 0%, #a855f7 45%, #00ffff 100%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            color: "transparent",
            lineHeight: 1.1,
          }}
        >
          $LDAT
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 22 }}>
          <div style={{ display: "flex", fontFamily: MONO, fontSize: 41, color: "#f2f2f2", lineHeight: 1.32 }}>
            Perpetual, automated digital asset
          </div>
          <div style={{ display: "flex", fontFamily: MONO, fontSize: 41, color: "#f2f2f2", lineHeight: 1.32 }}>
            treasury on Linea L2
          </div>
        </div>

        <div style={{ display: "flex", fontFamily: MONO, fontSize: 25, color: "#8a8a8a", marginTop: 32 }}>
          Every cycle buys and burns $LDAT
        </div>

        {/* Real element, not border-image: satori does not render border-image. */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: 1200,
            height: 10,
            backgroundImage: "linear-gradient(90deg, #ff33cc 0%, #a855f7 50%, #00ffff 100%)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
