// What each section of the site is for and what a visitor can do there, step by step: the
// stepper at the top of every page except the landing page.

export type Guide = { key: string; title: string; what: string; steps: [string, string][]; note?: string };

export const GUIDES: { href: string; match: (path: string) => boolean; guide: Guide }[] = [
  {
    match: (p) => p === "/cards" || p.startsWith("/cards/"),
    href: "/cards",
    guide: {
      key: "cards",
      title: "Rate cards",
      what: "Every rate card anybody has published. A card is a maker's price list in their own words: two to four numbered tiers, each with a price, and a bond the maker put up against writing tiers that overlap.",
      steps: [
        ["Read a card", "Each card shows its tiers, the price of each, and the bond behind it."],
        ["Check its standing", "Clean means no brief has ever been covered by two of its tiers. Frozen means one was, and the card prices nothing until its maker revises it."],
        ["Open one", "Press a card to type your own brief and get a binding price from it."],
        ["Or publish your own", "The Publish page takes a card of yours in one signature."],
      ],
    },
  },
  {
    match: (p) => p.startsWith("/card/"),
    href: "/cards",
    guide: {
      key: "card",
      title: "One card",
      what: "One maker's rate card, and the box where you ask it for a price. You say what you need in your own words; the contract tells you which tier covers it and keeps exactly that tier's price.",
      steps: [
        ["Read the tiers", "They are the maker's own words. The price you can be charged is never more than the dearest tier."],
        ["Type your brief", "Say what you need, in 20 to 1,200 characters, or press a suggestion written for this card."],
        ["Read what can happen to your money", "The four outcomes are listed before you sign. In every one of them the part that is not a price comes back in the same transaction."],
        ["Press Get a binding price", "You send the dearest tier's price. One signature, and one to two minutes while the validators read the card."],
        ["Read the result", "The tier, the price kept in escrow, what came back, and the sentence the contract wrote."],
      ],
      note: "You cannot ask your own card for a price, and the same brief is answered once per card.",
    },
  },
  {
    match: (p) => p.startsWith("/order/"),
    href: "/orders",
    guide: {
      key: "order",
      title: "One order",
      what: "Everything about one brief that was asked: the words, which tiers covered them, where the money went, and what can still be done.",
      steps: [
        ["Read the brief and the result", "The brief is stored exactly as it was sent, with the tier marks the validators agreed on."],
        ["Follow the money", "What was sent, what the tier costs, what came back, and anything paid from the maker's bond."],
        ["If you are the buyer", "While the order is booked you may cancel it and take the price back from escrow."],
        ["If you are the maker", "Accept a booked order to be paid from escrow, or decline it to send the price back."],
      ],
    },
  },
  {
    match: (p) => p.startsWith("/publish"),
    href: "/publish",
    guide: {
      key: "publish",
      title: "Publish a card",
      what: "Put your own rate card on the chain. You write the tiers once; after that every stranger's brief is priced from your words without you being there.",
      steps: [
        ["Start from an example", "Press a whole example card to fill the form, then change it until it is yours."],
        ["Write two to four tiers", "One sentence each, with a price. Say what is included plainly: a brief must fit a tier whole."],
        ["Say how the tiers relate", "A ladder runs from the narrowest tier to the broadest, each containing the last. Otherwise the tiers are meant not to overlap."],
        ["Put up the bond", "At least 1 GEN. It is yours again when you close the card, less a slice for each brief your card covered twice."],
        ["Publish", "One signature and under a minute. Your card gets the next number, for example C5."],
        ["Look after it", "Further down are your own cards: revise one that froze, or close one and take the bond back."],
      ],
    },
  },
  {
    match: (p) => p.startsWith("/orders"),
    href: "/orders",
    guide: {
      key: "orders",
      title: "Your orders",
      what: "The orders that concern the connected wallet: the briefs you asked as a buyer, and the orders on the cards you published.",
      steps: [
        ["Connect a wallet", "This page lists by address, so it needs to know yours. Reading still costs nothing."],
        ["Read your own briefs", "Each row shows the outcome, the price and what came back. A booked one can be cancelled from its page."],
        ["Read your cards' orders", "If you published a card, the booked orders on it wait for you to accept or decline."],
        ["Open an order", "Press a row for the whole story and the buttons that apply to you."],
      ],
    },
  },
  {
    match: (p) => p.startsWith("/ledger"),
    href: "/ledger",
    guide: {
      key: "ledger",
      title: "Ledger",
      what: "The public record: every order on every card, newest first, with the contract's own counters. Nothing here needs a wallet.",
      steps: [
        ["Read the counters", "How many cards and orders there are, and how the outcomes divide."],
        ["Read the orders", "Each row is one brief: its card, its outcome, the price and the sentence the contract wrote."],
        ["Filter by outcome", "Show only the briefs a card covered twice, for example, to see which cards were caught."],
        ["Read the rule", "At the bottom is the agreement rule in the contract's own words."],
      ],
    },
  },
  {
    match: (p) => p.startsWith("/deploy"),
    href: "/deploy",
    guide: {
      key: "deploy",
      title: "Deploy",
      what: "Run a copy of the contract of your own from the same source. Most visitors never need this page.",
      steps: [
        ["Check the source", "The page shows the contract file and its fingerprint, so you know what you are deploying."],
        ["Deploy", "One signature. It takes about a minute, and a minute more before the network answers reads."],
        ["Use it", "Your browser then reads your own copy. A button brings you back to the site's own."],
      ],
    },
  },
];
