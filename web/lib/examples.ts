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
    {
      label: "A 900-word article, no rush",
      brief: "Please translate my 900-word blog article about urban cycling from English into Spanish. I need it in about two weeks.",
      covers: [2],
    },
    {
      label: "A wedding speech in two days",
      brief: "I need my 400-word wedding speech translated from English to Spanish by the day after tomorrow, in about 40 hours.",
      covers: [4],
    },
    {
      label: "A website of 40 pages (outside the card)",
      brief: "Translate our whole online shop into Spanish: about 40 pages and 25,000 words, plus every product description.",
      covers: [],
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
    {
      label: "A product description",
      brief: "Write the copy for one product page: a stainless steel water bottle, with a headline and three short sections.",
      covers: [1, 2],
    },
    {
      label: "Three welcome emails",
      brief: "Write a series of three welcome emails for new subscribers to our cooking newsletter.",
      covers: [3],
    },
    {
      label: "A radio advert (outside the card)",
      brief: "Write and record a 30-second radio advert for our bakery.",
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
    {
      label: "Two lessons before an exam",
      brief: "My son has his algebra exam in ten days. Could he have two 45-minute online lessons on simultaneous equations?",
      covers: [2, 3],
    },
    {
      label: "A weekly lesson all term",
      brief: "Please give my daughter one 45-minute online algebra lesson every week this term, eleven in all, and mark her homework.",
      covers: [3],
    },
    {
      label: "A vague request",
      brief: "Can you help my kid with maths sometime?",
      covers: "?",
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
    {
      label: "A spot drawing for a cookbook",
      brief: "I need one small black and white drawing, about 6 cm wide, to open a chapter of a cookbook.",
      covers: [1],
    },
    {
      label: "A children's book (outside the card)",
      brief: "Illustrate a whole 32-page picture book for children, every page in full colour.",
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
    {
      label: "Fix the grammar in a cover letter",
      brief: "Please check the grammar and punctuation of my one-page cover letter. Do not rewrite it.",
      covers: [1, 2, 3],
    },
    {
      label: "Translate a report (outside the card)",
      brief: "Translate our 3,000-word report from English into German.",
      covers: [],
    },
  ],
};

export const PHOTOGRAPHER: ExampleCard = {
  key: "photographer",
  who: "A photographer",
  title: "Portrait and event photography",
  ladder: false,
  bond: "1",
  note: "Three tiers by length of the shoot, meant not to overlap.",
  tiers: [
    { text: "A portrait session of up to one hour at one location, with 10 edited photos delivered within a week.", price: "0.8" },
    { text: "A half-day shoot of two to four hours, such as a small event or a product set, with 40 edited photos.", price: "2" },
    { text: "A full-day shoot of five to ten hours, such as a wedding or a conference, with 150 edited photos.", price: "4.5" },
  ],
  briefs: [
    { label: "A headshot for LinkedIn", brief: "I need a 30-minute headshot session in a park near my office and five or so good edited photos.", covers: [1] },
    { label: "A three-hour birthday party", brief: "Please photograph my mother's 70th birthday party, about three hours on a Saturday afternoon.", covers: [2] },
    { label: "A whole wedding day", brief: "We need our wedding photographed from the morning preparations to the first dance, about nine hours.", covers: [3] },
    { label: "A drone video (outside the card)", brief: "Film our farm from the air with a drone and edit a two-minute video.", covers: [] },
  ],
};

export const DEVELOPER: ExampleCard = {
  key: "developer",
  who: "A web developer",
  title: "Small website builds",
  ladder: true,
  bond: "2",
  note: "A ladder: each tier contains the one before it, so a brief is priced at the narrowest tier that covers it.",
  tiers: [
    { text: "A one-page website from your text and photos, mobile friendly, with a contact form.", price: "1" },
    { text: "A website of up to five pages from your text and photos, mobile friendly, with a contact form and a simple blog.", price: "2.5" },
    { text: "A website of up to fifteen pages, mobile friendly, with a blog, a booking calendar and a small online shop of up to 20 products.", price: "6" },
  ],
  briefs: [
    { label: "A single landing page", brief: "Build me a one-page site for my yoga classes, with the timetable and a contact form. I will send the text and photos.", covers: [1, 2, 3] },
    { label: "A four-page site with a blog", brief: "I need a four-page website for my plumbing business, with a blog for tips, built from my own words and photos.", covers: [2, 3] },
    { label: "A shop of 12 products", brief: "Make a ten-page website for my ceramics studio, with a booking calendar for classes and a shop for 12 pieces.", covers: [3] },
    { label: "A mobile app (outside the card)", brief: "Build an iPhone and Android app for ordering from my cafe.", covers: [] },
  ],
};

export const VOICE: ExampleCard = {
  key: "voice",
  who: "A voice-over artist",
  title: "English voice-over recording",
  ladder: false,
  bond: "1",
  note: "Three tiers by the length of the finished audio, meant not to overlap.",
  tiers: [
    { text: "A recorded English voice-over of up to 60 seconds of finished audio, such as an advert or a voicemail greeting.", price: "0.6" },
    { text: "A recorded English voice-over of one to ten minutes of finished audio, such as an explainer video or a course lesson.", price: "1.8" },
    { text: "A recorded English voice-over of ten to sixty minutes of finished audio, such as an audiobook chapter or a training course.", price: "5" },
  ],
  briefs: [
    { label: "A 30-second advert", brief: "Record a 30-second voice-over for our coffee shop's online advert, warm and friendly.", covers: [1] },
    { label: "A five-minute explainer", brief: "We need a five-minute voice-over for an explainer video about our budgeting app.", covers: [2] },
    { label: "A 40-minute audiobook chapter", brief: "Please record chapter one of my novel, about 40 minutes of finished audio.", covers: [3] },
    { label: "Singing a jingle (outside the card)", brief: "Sing and record a 15-second jingle for our radio advert.", covers: [] },
  ],
};

/** The cards the publish page offers as starting points. */
export const EXAMPLE_CARDS: ExampleCard[] = [TRANSLATOR, ILLUSTRATOR, TUTOR, COPY_EDITOR, COPYWRITER, PHOTOGRAPHER, DEVELOPER, VOICE];

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

/** The briefs to offer under the box on one card's page: the example's own, else a set built from the card's tiers. */
export function briefsFor(tierTexts: string[]): { label: string; value: string }[] {
  const found = exampleFor(tierTexts);
  if (found) return found.briefs.map((b) => ({ label: b.label, value: b.brief }));
  const n = Math.min(tierTexts.length, 4);
  const out = tierTexts.slice(0, 4).map((text, i) => ({ label: `Ask for tier ${i + 1}`, value: askFor(text) }));
  if (n >= 2)
    out.push({
      label: "Tiers 1 and 2 at once",
      value: `I need two things together: ${tierTexts[0]} And also: ${tierTexts[1]}`.slice(0, 1200),
    });
  out.push(
    {
      label: "More than the dearest tier",
      value: `I need ten times what your largest offer covers: ${tierTexts[n - 1]} Ten of these, all at once.`.slice(0, 1200),
    },
    {
      label: "Something outside the card",
      value: "I need a three-tier wedding cake for 120 guests, lemon and elderflower, delivered on a Saturday in June.",
    },
    { label: "A vague request", value: "Can you help me with something soon? I am not sure yet how big it is." },
  );
  return out;
}
