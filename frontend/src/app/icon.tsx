import { ImageResponse } from "next/og";

// Browser tab icon for the on-chainDAT site.
// Spec: rounded black square with bold "DAT" in the brand magenta -> cyan gradient
// (#ff33cc -> #00ffff), matching the $LINEADAT "L" mark and the site logo.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          borderRadius: 6,
          boxSizing: "border-box",
          // Asymmetric grey outline: top/left dashed, right/bottom solid.
          borderTop: "2px dashed #888",
          borderLeft: "2px dashed #888",
          borderRight: "2px solid #888",
          borderBottom: "2px solid #888",
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontWeight: 900,
            fontSize: 16,
            letterSpacing: -1.5,
            // Gradient text via background-clip (satori-supported). The black
            // square bg lives on the parent so it isn't clipped to the glyphs.
            backgroundImage: "linear-gradient(135deg, #ff33cc 0%, #00ffff 100%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            color: "transparent",
          }}
        >
          DAT
        </div>
      </div>
    ),
    { ...size },
  );
}
