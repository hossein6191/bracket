// Whole rate cards and briefs to start from. The publish page fills its form from a card here,
// and a card's page offers the briefs that fit that card. Mock mode seeds its demo from the same
// content and reads each brief's scripted answer from `covers`, so the demo plays the outcomes
// these sentences were written to show. On the chain nothing here is consulted: the validators
// read the card and the brief themselves.

export type ExampleTier = { text: string; price: string };

export type ExampleBrief = {
  /** the button's words */
  label: string;
  brief: string;
  /** mock mode only: the tiers (counted from 1) that cover the whole brief, or "?" when two askings would differ */
  covers: number[] | "?";
};

export type ExampleCard = {
  key: string;
  /** the button's words on the publish page */
  who: string;
  title: string;
  /** true when the tiers are nested from narrowest to broadest in the order given */
  ladder: boolean;
  /** the ambiguity bond, in GEN */
  bond: string;
  tiers: ExampleTier[];
  briefs: ExampleBrief[];
  /** one line about what the card shows */
  note: string;
};

export const TRANSLATOR: ExampleCard = {
  key: "translator",
  who: "A translator",
  title: "English to Spanish translation",
  ladder: false,
  bond: "2",
  note: "Four tiers that are meant not to overlap: three by length, and a rush tier that only a short deadline reaches.",
  tiers: [
    { text: "A single page of plain text, up to 300 words, English to Spanish, with no deadline shorter than five working days.", price: "0.5" },
    { text: "A document of 301 to 2,000 words, English to Spanish, with no deadline shorter than five working days.", price: "1.5" },
    {
      text: "A full document of 2,001 to 10,000 words, English to Spanish, with a bilingual glossary of its terms, with no deadline shorter than ten working days.",
      price: "4",
    },
    {
      text: "Rush: any text of up to 2,000 words, English to Spanish, for a brief that names a deadline shorter than five working days, down to 24 hours.",
      price: "2.5",
    },
  ],
  briefs: [
    {
      label: "A one-page cover letter",
      brief:
        "Please translate my cover letter for a job in Madrid from English to Spanish. It is one page, about 250 words of plain text, and there is no hurry: any time in the next two weeks is fine.",
      covers: [1],
    },
    {
      label: "A 1,500-word contract by tomorrow",
      brief:
        "I have a 1,500-word rental contract in English that I must hand to my landlord in Spanish by tomorrow evening. It is plain text with no tables.",
      covers: [4],
    },
    {
      label: "A 6,000-word manual with a glossary",
      brief:
        "Translate the user manual of our coffee grinder from English to Spanish. It is about 6,000 words and uses the same forty technical terms throughout, so we need a glossary of them too. We can wait three weeks.",
      covers: [3],
    },
    {
      label: "A whole novel (outside the card)",
      brief:
        "I wrote a 90,000-word novel in English and want the whole book translated into Spanish, chapter by chapter over the next six months.",
      covers: [],
    },
    {
      label: "A vague request",
      brief:
        "Can you translate some things for me soon? There are a few texts, I am not sure how long they are yet, and one of them might be urgent.",
      covers: "?",
    },
  ],
};

export const COPYWRITER: ExampleCard = {
  key: "copywriter",
  who: "A copywriter (with a flaw)",
  title: "Website and launch copy",
  ladder: false,
  bond: "2",
  note: "Declared as not overlapping, yet a one-page landing page is also a website of up to five pages. A brief for one landing page is covered twice.",
  tiers: [
    { text: "Landing page copy, one page: a headline, three short sections and a call to action, up to 400 words.", price: "1" },
    { text: "Website copy up to five pages, such as home, about, services and contact, up to 2,000 words in total.", price: "3" },
    { text: "A launch email sequence: five emails for one product, up to 250 words each.", price: "2" },
  ],
  briefs: [
    {
      label: "One landing page (the card covers it twice)",
      brief:
        "I need the copy for a single landing page for my bakery's new sourdough subscription: a headline, three short sections and a call to action, around 350 words.",
      covers: [1, 2],
    },
    {
      label: "A four-page website",
      brief:
        "Write the copy for a four-page website for my bicycle repair shop: home, about, services and contact, about 1,600 words in all.",
      covers: [2],
    },
    {
      label: "Five launch emails",
      brief:
        "We launch a note-taking app next month and need a sequence of five emails for it, each about 200 words, sent one a day in launch week.",
      covers: [3],
    },
    {
      label: "A printed brochure (outside the card)",
      brief:
        "Write the text of a twelve-page printed brochure for a furniture trade fair, about 5,000 words, with captions for forty product photographs.",
      covers: [],
    },
  ],
};

export const TUTOR: ExampleCard = {
  key: "tutor",
  who: "A tutor",
  title: "School algebra tutoring",
  ladder: true,
  bond: "1",
  note: "A ladder: each tier contains the one before it, so a brief is priced at the narrowest tier that covers it.",
  tiers: [
    { text: "One 45-minute online lesson on a single topic of school algebra.", price: "0.4" },
    { text: "Up to four 45-minute online lessons on school algebra, covering one unit of the course.", price: "1.4" },
    { text: "Up to twelve 45-minute online lessons on school algebra across a term, with written feedback on homework.", price: "3.6" },
  ],
  briefs: [
    {
      label: "One lesson on quadratics",
      brief: "My daughter needs one 45-minute online lesson on factorising quadratic equations before her test on Friday.",
      covers: [1, 2, 3],
    },
    {
      label: "Four lessons on one unit",
      brief: "I would like four online lessons of 45 minutes for my son on the linear equations unit, one a week this month.",
      covers: [2, 3],
    },
    {
      label: "A term with homework feedback",
      brief:
        "Please take my daughter through the whole term of algebra: ten 45-minute online lessons, with written feedback on the homework she hands in each week.",
      covers: [3],
    },
    {
      label: "University statistics (outside the card)",
      brief: "I am a second-year university student and need help with a statistics course: hypothesis testing and regression, six sessions.",
      covers: [],
    },
  ],
};

export const ILLUSTRATOR: ExampleCard = {
  key: "illustrator",
  who: "An illustrator",
  title: "Illustration for books and posters",
  ladder: false,
  bond: "2",
  note: "Three kinds of picture that are told apart by what they are for, so no brief should fall under two of them.",
  tiers: [
    { text: "One black-and-white spot illustration, up to 10 cm wide, for the inside pages of a book or a magazine.", price: "0.8" },
    { text: "One full-colour cover illustration for a book or an album, front cover only.", price: "3" },
    { text: "One full-colour poster illustration up to A2 size for an event, not a book cover or an album cover.", price: "2.5" },
  ],
  briefs: [
    {
      label: "A spot drawing for a chapter",
      brief: "I need one small black-and-white drawing of a lighthouse, about 8 cm wide, to open chapter three of my novel.",
      covers: [1],
    },
    {
      label: "A cover for a poetry book",
      brief: "I am publishing a poetry collection and need a full-colour illustration for the front cover: a heron at dusk over reeds.",
      covers: [2],
    },
    {
      label: "A festival poster",
      brief: "Our town's jazz festival needs a full-colour A2 poster illustration with a trumpet player and the river in the background.",
      covers: [3],
    },
    {
      label: "An animated logo (outside the card)",
      brief: "Please animate our company logo as a five-second video to play at the start of our webinars.",
      covers: [],
    },
  ],
};

/** The illustrator's earlier card, kept for the demo: its last tier swallows the cover tier. */
export const ILLUSTRATOR_FLAWED: ExampleCard = {
  key: "illustrator-flawed",
  who: "An illustrator (earlier card)",
  title: "Illustration, line and colour",
  ladder: false,
  bond: "2",
  note: "The third tier says any subject, so a book cover is covered by it and by the second tier.",
  tiers: [
    { text: "One black-and-white spot illustration, up to 10 cm wide, for the inside pages of a book or a magazine.", price: "0.8" },
    { text: "One full-colour cover illustration for a book or an album, front cover only.", price: "3" },
    { text: "One full-colour illustration for print, any subject, up to A2 size.", price: "2.5" },
  ],
  briefs: [
    {
      label: "A spot drawing for a chapter",
      brief: "I need one small black-and-white drawing of a lighthouse, about 8 cm wide, to open chapter three of my novel.",
      covers: [1],
    },
  ],
};

export const COPY_EDITOR: ExampleCard = {
  key: "copy-editor",
  who: "A copy editor",
  title: "Editing for articles and reports",
  ladder: true,
  bond: "1",
  note: "A ladder by depth and length: proofreading, then copy editing, then structural editing.",
  tiers: [
    { text: "Proofreading of a text of up to 1,000 words: spelling, grammar and punctuation only.", price: "0.5" },
    {
      text: "Proofreading or copy editing of a text of up to 5,000 words: spelling, grammar, punctuation, word choice and sentence flow.",
      price: "2",
    },
    {
      text: "Proofreading, copy editing or structural editing of a text of up to 20,000 words, with a summary of the changes.",
      price: "5",
    },
  ],
  briefs: [
    {
      label: "Proofread a blog post",
      brief: "Please proofread my 800-word blog post about urban beekeeping for spelling, grammar and punctuation. Do not change my wording.",
      covers: [1, 2, 3],
    },
    {
      label: "Copy edit a report",
      brief: "Our 4,000-word annual report needs a copy edit: tighten the sentences and fix the word choice as well as the grammar.",
      covers: [2, 3],
    },
    {
      label: "Restructure a thesis chapter",
      brief:
        "My 15,000-word thesis chapter needs a structural edit: reorder the sections where the argument jumps, and tell me what you changed.",
      covers: [3],
    },
    {
      label: "Write a new article (outside the card)",
      brief: "Write a new 1,200-word article about electric buses for our newsletter from my bullet points.",
      covers: [],
    },
  ],
};

/** The cards the publish page offers as starting points. */
export const EXAMPLE_CARDS: ExampleCard[] = [TRANSLATOR, ILLUSTRATOR, TUTOR, COPY_EDITOR, COPYWRITER];

/** Every card that carries briefs, the demo-only one included. */
const ALL_CARDS: ExampleCard[] = [...EXAMPLE_CARDS, ILLUSTRATOR_FLAWED];

const squash = (text: string) => text.toLowerCase().split(/\s+/).filter(Boolean).join(" ");

/** The example whose tiers are word for word the tiers given, or null. */
export function exampleFor(tierTexts: string[]): ExampleCard | null {
  const want = tierTexts.map(squash);
  return ALL_CARDS.find((c) => c.tiers.length === want.length && c.tiers.every((t, i) => squash(t.text) === want[i])) ?? null;
}

/** A brief that asks for exactly what one tier says, for a card no example matches. */
const askFor = (text: string) => `I need exactly this, nothing more and nothing less: ${text}`.slice(0, 1200);

/** The briefs to offer under the box on one card's page: the example's own, else one per tier and one outside. */
export function briefsFor(tierTexts: string[]): { label: string; value: string }[] {
  const found = exampleFor(tierTexts);
  if (found) return found.briefs.map((b) => ({ label: b.label, value: b.brief }));
  return [
    ...tierTexts.slice(0, 4).map((text, i) => ({ label: `Ask for tier ${i + 1}`, value: askFor(text) })),
    {
      label: "Something outside the card",
      value: "I need a three-tier wedding cake for 120 guests, lemon and elderflower, delivered on a Saturday in June.",
    },
  ];
}
