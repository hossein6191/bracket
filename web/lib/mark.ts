// The Bracket mark as an SVG string, for the generated images (app/opengraph-image.tsx and
// app/apple-icon.tsx). The same drawing as public/brand/mark.svg and components/brand/logo.tsx.

export const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="256" height="256"><defs><linearGradient id="g" x1="10" y1="56" x2="54" y2="8" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2F6BFF"/><stop offset="1" stop-color="#22D3EE"/></linearGradient></defs><path d="M25 11H14V53H25" fill="none" stroke="url(#g)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M39 11H50V53H39" fill="none" stroke="url(#g)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="32" r="5.5" fill="#22D3EE"/></svg>`;

export const markDataUri = (): string => "data:image/svg+xml;base64," + Buffer.from(MARK_SVG).toString("base64");
