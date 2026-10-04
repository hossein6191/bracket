// The Bracket mark and wordmark.
// The mark is a pair of square brackets with one dot between them: the tiers of a rate card on
// either side, and the single price a brief lands on. It is drawn in the site's blue-to-cyan
// accent and stays legible in a single colour at favicon size.
import * as React from "react";

export const BRAND_FROM = "#2F6BFF";
export const BRAND_TO = "#22D3EE";

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  const id = React.useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="10" y1="56" x2="54" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={BRAND_FROM} />
          <stop offset="1" stopColor={BRAND_TO} />
        </linearGradient>
      </defs>
      <path d="M25 11H14V53H25" fill="none" stroke={`url(#${id})`} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M39 11H50V53H39" fill="none" stroke={`url(#${id})`} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="5.5" fill={BRAND_TO} />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 9, lineHeight: 1 }}>
      <LogoMark />
      <span style={{ fontWeight: 700, fontSize: "1.05rem", letterSpacing: "-0.02em", color: "currentColor" }}>Bracket</span>
    </span>
  );
}
