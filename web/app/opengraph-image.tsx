import { ImageResponse } from "next/og";

import { SITE_NAME } from "@/lib/config";
import { markDataUri } from "@/lib/mark";

export const alt = "Bracket: a binding price for your brief, read off the maker's own rate card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The card shared links show: the mark, the name, and the one sentence the site is about, on the
// graphite plate with the site's blue-to-cyan accent behind it.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundColor: "#161618",
          backgroundImage:
            "radial-gradient(circle at 88% 8%, rgba(34,211,238,0.32), transparent 46%), radial-gradient(circle at 8% 100%, rgba(74,158,255,0.38), transparent 52%)",
          color: "#F2F4F6",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <img src={markDataUri()} width={96} height={96} alt="" />
          <div style={{ marginLeft: 24, fontSize: 64, fontWeight: 700, letterSpacing: -2 }}>{SITE_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 62, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 1000 }}>
            Type a brief. Pay the tier that covers it, and nothing more.
          </div>
          <div style={{ marginTop: 28, fontSize: 30, color: "#C9CFD6", maxWidth: 980 }}>
            A maker publishes a rate card once. Validators on GenLayer agree which tier covers a stranger&apos;s brief, and
            the rest of the payment comes back in the same transaction.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#98A2AE" }}>
          <div>GenLayer Studio · chain 61999</div>
          <div>Test network, test GEN only</div>
        </div>
      </div>
    ),
    size,
  );
}
