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
    frame: 'How I Think',
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
  support: ['Taste comes with experience.', 'I have ', '7+ years', ' of it.'] as const,
  intro: "Hi, I'm Monika, a product designer.",
  /** the annotation on her shoulder, set on two lines */
  introLines: [["Hi, I'm ", 'Monika', ','], ['a product designer.']] as const,
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

/** 02 How I think — the quote beside the intro, one sticker per word */
export const QUOTE = { rows: [['People', 'ignore'], ['design', 'that'], ['ignores', 'people.']], by: 'Frank Chimero' } as const

/** 02 How I think — the three rules (the close) */
export const RULES = [
  { big: 'Research first, pixels second.', line: 'I ask who it is for before I open Figma.' },
  { big: 'Systems over screens.', line: 'One decision, made once, used everywhere.' },
  { big: 'Calm beats clever.', line: 'If it needs explaining, it is not finished.' },
] as const

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

/** 03 Proof — the work strip. Facts only: from her resume, portfolio and the
 *  project files (Projects/ in the momo design folder). Images: public/work,
 *  built by scripts/work/build.mjs. */
export type WorkKind = 'web' | 'tv' | 'phone'
/** one device frame; with several screens it changes page from one to the next */
export interface WorkMedia {
  kind: WorkKind
  /** public/work/<file>.webp, one per screen (a file may come back later in the loop) */
  files: readonly string[]
  alts: readonly string[]
  /** where a finger taps to reach each screen (fractions of the screen), or null */
  taps: readonly (readonly [number, number] | null)[]
  /** intrinsic size of the first screen */
  w: number
  h: number
}
export interface WorkProject {
  id: string
  name: string
  body: string
  meta: readonly (readonly [string, string])[]
  link?: { label: string; href: string }
  media: readonly WorkMedia[]
}
type Tap = readonly [x: number, y: number]
const m = (kind: WorkKind, w: number, h: number, ...screens: [file: string, alt: string, tap?: Tap][]): WorkMedia => ({
  kind,
  w,
  h,
  files: screens.map((x) => x[0]),
  alts: screens.map((x) => x[1]),
  taps: screens.map((x) => x[2] ?? null),
})
/** DAZN's tab bar and header, as fractions of the phone screen */
const DZ = { home: [0.115, 0.915], scores: [0.305, 0.915], schedule: [0.69, 0.915], search: [0.88, 0.915], avatar: [0.903, 0.087], back: [0.07, 0.087] } as const
export const WORK: readonly WorkProject[] = [
  {
    id: 'dazn',
    name: 'DAZN',
    body: 'A global sports-streaming platform, live and on demand in over 200 countries. I designed for TV, mobile and desktop: wireframes, prototypes, a competitor audit and one consistent experience.',
    meta: [
      ['Year', '2024'],
      ['Role', 'Senior UX Designer'],
      ['Platforms', 'TV, mobile, desktop'],
    ],
    media: [
      m('tv', 1600, 894, ['dazn-0', 'DAZN on TV: the home screen with live football']),
      // a short session: Home, the profile and back, then Scores, Schedule and Search along the tab bar
      m(
        'phone',
        640,
        1382,
        ['dazn-1', 'DAZN on mobile: home', DZ.home],
        ['dazn-5', 'DAZN on mobile: profile', DZ.avatar],
        ['dazn-1', 'DAZN on mobile: home', DZ.back],
        ['dazn-2', 'DAZN on mobile: football scores', DZ.scores],
        ['dazn-3', 'DAZN on mobile: schedule', DZ.schedule],
        ['dazn-4', 'DAZN on mobile: search', DZ.search],
      ),
    ],
  },
  {
    id: 'toeic',
    name: 'toeic.pal',
    body: 'Spoken-English practice with a personal AI tutor: everyday conversations, or official ETS preparation for the TOEIC® Speaking test, with instant feedback.',
    meta: [['Platforms', 'Website, mobile app']],
    link: { label: 'toeicpal.com', href: 'https://toeicpal.com/' },
    media: [
      m('web', 1600, 1000, ['toeic-0', 'The toeic.pal website: Master spoken English with your personal AI tutor']),
      m('phone', 640, 1385, ['toeic-1', 'The toeic.pal website on a phone'], ['toeic-2', 'toeic.pal on a phone: speak English']),
    ],
  },
  {
    id: 'nota',
    name: 'Nota',
    body: 'Cloud business banking for solo and small law firms, by M&T Bank: checking, trust accounts and 3-way reconciliation, built into the way a firm already works.',
    meta: [
      ['Years', '2021–2023'],
      ['Role', 'Senior UX/UI Designer'],
      ['Platforms', 'Web, mobile'],
    ],
    media: [
      m('web', 1600, 1000, ['nota-0', 'The Nota dashboard: untagged transactions']),
      m('phone', 640, 1379, ['nota-1', 'Nota on mobile: business checking']),
    ],
  },
  {
    id: 'roomistry',
    name: 'Roomistry',
    body: 'An AI roommate-matching app for students and young adults. Calm, friendly and illustrated, so finding someone to live with feels safe.',
    meta: [
      ['Role', 'Lead UX/UI Designer, Forcoda'],
      ['Platform', 'Mobile app'],
    ],
    media: [
      m('phone', 640, 1374, ['roomistry-0', 'Roomistry: welcome'], ['roomistry-1', 'Roomistry: matched roommates'], ['roomistry-2', 'Roomistry: a roommate profile']),
    ],
  },
  {
    id: 'hello-audio',
    name: 'Hello Audio',
    body: 'A home for podcast and audio creators: upload episodes, organise and publish feeds, add listeners. Designed step by step, from empathy to testing.',
    meta: [
      ['Role', 'Lead UX/UI Designer, Forcoda'],
      ['Platforms', 'Web, mobile'],
    ],
    media: [
      m('web', 1600, 1000, ['hello-audio-0', 'Hello Audio: managing a private feed']),
      m('phone', 640, 1387, ['hello-audio-1', 'Hello Audio on mobile: the feed']),
    ],
  },
  {
    id: 'studious',
    name: 'Studious',
    body: 'Study preparation with AI coaching: daily questions, lessons and progress, on the web and on the phone.',
    meta: [
      ['Role', 'Lead UX/UI Designer, Forcoda'],
      ['Platforms', 'Web, mobile'],
    ],
    media: [
      m('web', 1600, 921, ['studious-0', 'The Studious dashboard: daily questions and progress']),
      m('phone', 640, 1386, ['studious-1', 'Studious on mobile: create an account']),
    ],
  },
  {
    id: 'growthoptix',
    name: 'GrowthOptix',
    body: 'A growth dashboard: clicks, leads, sales and traffic sources at a glance, in light and in dark.',
    meta: [['Platform', 'Web app']],
    media: [
      m('web', 1600, 1000, ['growthoptix-0', 'The GrowthOptix overview, light'], ['growthoptix-1', 'The GrowthOptix overview, dark']),
    ],
  },
  {
    id: 'wedo',
    name: 'WeDo',
    body: 'Shared lists for groceries, trips and baby gear, kept in one clean spot.',
    meta: [['Platform', 'Mobile app']],
    media: [
      m('phone', 640, 1387, ['wedo-0', 'WeDo: We do together'], ['wedo-1', 'WeDo: a shared grocery list'], ['wedo-2', 'WeDo: for everything']),
    ],
  },
]

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
