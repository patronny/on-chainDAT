import { ImageResponse } from "next/og";

// iOS Safari touch icon (also used by Safari "Add to Home Screen", iPadOS
// search-suggestion grid, and the favicon iOS shows in tab switcher).
// Ships the same gradient "DAT" mark used in the browser tab favicon at the
// 180×180 size Apple recommends.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          // Slightly tighter corners than iOS's own mask so the colored
          // crop stays inside the system rounded-rect.
          borderRadius: 36,
          boxSizing: "border-box",
          borderTop: "10px dashed #888",
          borderLeft: "10px dashed #888",
          borderRight: "10px solid #888",
          borderBottom: "10px solid #888",
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontWeight: 900,
            fontSize: 84,
            letterSpacing: -4,
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
