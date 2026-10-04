// Site settings. One place for the contract address, the name and the tagline.
//
// DEMO_CONTRACT is the deployed copy the site reads when NEXT_PUBLIC_CONTRACT is unset. With it
// empty every page says "no contract configured yet" and offers /deploy, and the site still
// works in full with NEXT_PUBLIC_MOCK=1.
export const DEMO_CONTRACT: string = "0x8B694ddc287Dd1E3a644960A4891d55B6992d62C";

export const SITE_NAME = "Bracket";
export const SITE_TAGLINE = "A binding price for your brief, read off the maker's own rate card, in one transaction.";

/** The public source repository; the footer link is hidden while this is empty. */
export const REPO_URL: string = "https://github.com/hossein6191/bracket";
