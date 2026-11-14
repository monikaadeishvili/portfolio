/**
 * The story, told chapter by chapter. Headlines are arrays of segments so the
 * emphasis words can be set in Instrument Serif italic violet.
 */

export type Seg = string | { em: string }

export interface Chapter {
  id: 'hello' | 'craft' | 'proof' | 'contact'
  num: string
  frame: string
  ruler: string
  headline: Seg[]
  body: string
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'hello',
    num: '01',
    frame: 'Hello',
    ruler: 'HELLO',
    headline: ['Everyone has the same tools now. ', { em: 'Not the same taste.' }],
    body: 'Taste comes with experience. I have 7+ years of it.',
  },
  {
    id: 'craft',
    num: '02',
    frame: 'Craft',
    ruler: 'HOW I THINK',
    headline: ['I think in ', { em: 'components.' }],
    body: 'Every product I design is built from the same small parts. Scroll sideways and watch one kit become five things.',
  },
  {
    id: 'proof',
    num: '03',
    frame: 'Proof',
    ruler: 'PROOF',
    headline: ['Seven years, one question: ', { em: 'who is this for?' }],
    body: 'Sports streaming across TV, phone and desktop at DAZN. Business banking for law firms at NOTA by M&T Bank. Eighteen client products at Forcoda. And classrooms, too — I teach UX, because explaining design makes you better at it.',
  },
  {
    id: 'contact',
    num: '04',
    frame: 'Contact',
    ruler: 'SAY HELLO',
    headline: ["Let's build something people ", { em: "won't ignore." }],
    body: 'Open to new work — product design, design systems, and teams that care.',
  },
]

/** 01 Hello — client-approved copy */
export const HELLO = {
  badge: 'Open to new work',
  line1: 'Everyone has the same tools now.',
  line2: 'Not the same taste.',
  support: ['Taste comes with experience. I have ', '7+ years', ' of it.'] as const,
  intro: "Hi, I'm Monika, a product designer.",
  marquee: { lead: 'FROM A ', empty: 'BLANK FIGMA FILE', mid: ' TO ', full: 'A PRODUCT PEOPLE USE', tail: ' — ' },
  /** companies and named client products from the resume (the Worked with marquee) */
  workedWith: ['DAZN', 'Nota by M&T Bank', 'Contrast', 'Forcoda', 'Studious', 'Hello Audio', 'Roomistry', 'Startup Mentor AI', '4twiggers', 'Realoffer', 'Moneymarket', 'Xpresso', 'Refresh Miami', 'Graft', 'Bizzy', 'Burq', 'Dinespace'],
  clients: '18 client products',
  hint: ['This page builds itself.', "Your product won't."] as const,
  primary: 'See how I work',
  ghost: 'Say hello',
}

export const PRINCIPLES = ['Research first, pixels second.', 'Systems over screens.', 'Calm beats clever.']

/** 03 How I think — the five stops of the sideways pan (one kit, five shapes) */
export const PROCESS = [
  { back: 'Research', verb: 'Ask.', sub: 'Research first.', body: 'Interviews, competitor audits, journey maps. I find out who it is for before I draw anything.', makes: ['Personas', 'Journey maps', 'Audits'], tray: 'Notes' },
  { back: 'Flows', verb: 'Map.', sub: 'Flows before screens.', body: 'User flows and wireframes come next. Every screen gets a reason to exist.', makes: ['User flows', 'IA', 'Wireframes'], tray: 'Flow' },
  { back: 'Systems', verb: 'Systemise.', sub: 'One kit, every screen.', body: 'Type, colour, spacing and components, defined once. The product stays consistent on web, mobile and TV.', makes: ['Tokens', 'Components', 'Patterns'], tray: 'Tokens' },
  { back: 'Handoff', verb: 'Hand off.', sub: 'Nothing left to guess.', body: 'Clickable Figma prototypes, documented patterns, every state covered. Developers build it without guessing.', makes: ['Prototype', 'Specs', 'Docs'], tray: 'Spec' },
  { back: 'Launch', verb: 'Launch.', sub: 'A product people use.', body: 'Tested with real users, then refined. From a blank Figma file to a product people use.', makes: ['Usability tests', 'Iteration'], tray: 'Live' },
] as const

/** 03 How I think — the three rules (the close) */
export const RULES = [
  { big: 'Research first, pixels second.', line: 'I ask who it is for before I open Figma.' },
  { big: 'Systems over screens.', line: 'One decision, made once, used everywhere.' },
  { big: 'Calm beats clever.', line: 'If it needs explaining, it is not finished.' },
] as const

export const QUOTE = { text: 'People ignore design that ignores people.', by: 'Frank Chimero' }

export const STATS = [
  { n: 7, suf: '+', label: 'years designing', tone: 'yellow' },
  { n: 18, suf: '', label: 'client products at one agency', tone: 'lime' },
  { n: 9, suf: '', label: 'industries', tone: 'sky' },
] as const

export const COMPANIES = [
  { name: 'DAZN', role: 'Senior UX Designer', tone: 'yellow', mark: 'DA' },
  { name: 'NOTA by M&T Bank', role: 'Senior UX/UI Designer', tone: 'mint', mark: 'NO' },
  { name: 'Contrast', role: 'Product Designer', tone: 'pink', mark: 'Co' },
  { name: 'Forcoda', role: 'Lead UX/UI Designer', tone: 'sky', mark: 'Fo' },
] as const

export const TIMELINE = [
  { year: '2020', name: 'Dinespace' },
  { year: '2020', name: 'Burq' },
  { year: '2021', name: '4twiggers' },
  { year: '2021', name: 'Forcoda' },
  { year: '2021', name: 'NOTA' },
  { year: '2024', name: 'DAZN' },
  { year: '2024', name: 'Contrast' },
] as const

export const EMAIL = 'monikaadeishvili@gmail.com'
export const LINKS = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/monika-adeishvili-5a84b11b6' },
  { label: 'Behance', href: 'https://www.behance.net/monikaadeishv' },
  { label: 'Dribbble', href: 'https://dribbble.com/monikaadeishvili' },
]
export const FOOTER = 'Designed in momo. Built from components. Alicante, 2026.'

export const segText = (segs: Seg[]) => segs.map((s) => (typeof s === 'string' ? s : s.em)).join('')

/** 06 After hours: the trip below the contact section */
export const AFTER = {
  hint: 'psst… it keeps going',
  caps: [
    { text: 'Wait. You scrolled past the end?', at: [0.004, 0.105], pos: 'top' },
    { text: 'Nobody scrolls this far. Here’s a treat.', at: [0.11, 0.25], pos: 'bottom' },
    { text: 'My tools, on their day off.', at: [0.33, 0.53], pos: 'top' },
    { text: 'Every file ends up here eventually.', at: [0.63, 0.8], pos: 'bottom' },
  ],
  poke: 'Click anywhere. It reacts.',
  pokeTouch: 'Tap anywhere. It reacts.',
  end: 'Okay. Back to work?',
  top: 'Rewind to the top',
  hello: 'Say hello',
} as const
