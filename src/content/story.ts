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
    headline: ['Seven years of work ', { em: 'adds up.' }],
    body: 'Thirty-two client products across ten industries, and one designer on every one of them.',
  },
  {
    id: 'contact',
    num: '04',
    frame: 'Say Hello',
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
  clients: '32 client products',
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
  { n: 32, suf: '', label: 'client products', tone: 'lime' },
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
  /** intrinsic size of the first screen */
  w: number
  h: number
  /** public/work/<video>.mp4: a screen recording that plays in the frame
   *  (the first file is its poster and the still for reduced motion) */
  video?: string
  /** how the screens change: 'theme' reveals the next one as a circle growing
   *  from `origin` (fractions of the screen), like flipping light/dark mode */
  nav?: 'theme'
  origin?: readonly [number, number]
}
export interface WorkProject {
  id: string
  name: string
  /** the project's own colour: the strip washes faintly in it while it's in view */
  tint: string
  body: string
  meta: readonly (readonly [string, string])[]
  link?: { label: string; href: string }
  media: readonly WorkMedia[]
}
const m = (kind: WorkKind, w: number, h: number, ...screens: [file: string, alt: string][]): WorkMedia => ({
  kind,
  w,
  h,
  files: screens.map((x) => x[0]),
  alts: screens.map((x) => x[1]),
})
export const WORK: readonly WorkProject[] = [
  {
    id: 'dazn',
    tint: '#f4c400',
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
        ['dazn-1', 'DAZN on mobile: home'],
        ['dazn-5', 'DAZN on mobile: profile'],
        ['dazn-1', 'DAZN on mobile: home'],
        ['dazn-2', 'DAZN on mobile: football scores'],
        ['dazn-3', 'DAZN on mobile: schedule'],
        ['dazn-4', 'DAZN on mobile: search'],
      ),
    ],
  },
  {
    id: 'toeic',
    tint: '#8ed11a',
    name: 'toeic.pal',
    body: 'Spoken-English practice with a personal AI tutor: everyday conversations, or official ETS preparation for the TOEIC® Speaking test, with instant feedback.',
    meta: [['Platforms', 'Website, mobile app']],
    link: { label: 'toeicpal.com', href: 'https://toeicpal.com/' },
    media: [
      { ...m('web', 1280, 800, ['toeic-0', 'The toeic.pal website: Master spoken English with your personal AI tutor']), video: 'toeic-web' },
      { ...m('phone', 640, 1386, ['toeic-1', 'The toeic.pal app: home, the learning-stage map and an AI speaking dialog']), video: 'toeic-phone' },
    ],
  },
  {
    id: 'nota',
    tint: '#0e8a96',
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
    tint: '#20b07a',
    name: 'Roomistry',
    body: 'An AI roommate-matching app for students and young adults. Calm, friendly and illustrated, so finding someone to live with feels safe.',
    meta: [
      ['Role', 'Lead UX/UI Designer, Forcoda'],
      ['Platform', 'Mobile app'],
    ],
    media: [
      m(
        'phone',
        640,
        1374,
        ['roomistry-0', 'Roomistry: the splash screen'],
        ['roomistry-1', 'Roomistry: welcome to Roomistry'],
        ['roomistry-2', 'Roomistry: the questionnaire, cleanliness'],
        ['roomistry-3', 'Roomistry: the questionnaire, passions'],
        ['roomistry-4', 'Roomistry: four roommates that match'],
        ['roomistry-5', 'Roomistry: a roommate profile'],
        ['roomistry-6', 'Roomistry: messaging a roommate'],
      ),
    ],
  },
  {
    id: 'hello-audio',
    tint: '#ff4d4d',
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
    tint: '#ff9b2f',
    name: 'Studious',
    body: 'Study preparation with AI coaching: daily questions, lessons and progress, on the web and on the phone.',
    meta: [
      ['Role', 'Lead UX/UI Designer, Forcoda'],
      ['Platforms', 'Web, mobile'],
    ],
    media: [
      m('web', 1600, 921, ['studious-0', 'The Studious dashboard: daily questions and progress']),
      m(
        'phone',
        640,
        1386,
        ['studious-1', 'Studious on mobile: the splash screen'],
        ['studious-2', 'Studious on mobile: welcome to Studious'],
        ['studious-3', 'Studious on mobile: create an account'],
      ),
    ],
  },
  {
    id: 'growthoptix',
    tint: '#7b5cff',
    name: 'GrowthOptix',
    body: 'A growth dashboard: clicks, leads, sales and traffic sources at a glance, in light and in dark.',
    meta: [['Platform', 'Web app']],
    media: [
      // light and dark: the theme flips from the sun/moon switch in the sidebar
      { ...m('web', 1600, 1138, ['growthoptix-0', 'The GrowthOptix overview, light'], ['growthoptix-1', 'The GrowthOptix overview, dark']), nav: 'theme', origin: [0.021, 0.765] },
    ],
  },
  {
    id: 'wedo',
    tint: '#ff6fcf',
    name: 'WeDo',
    body: 'Shared lists for groceries, trips and baby gear, kept in one clean spot.',
    meta: [['Platform', 'Mobile app']],
    media: [
      m(
        'phone',
        640,
        1387,
        ['wedo-0', 'WeDo onboarding: We do together'],
        ['wedo-1', 'WeDo onboarding: always in sync'],
        ['wedo-2', 'WeDo onboarding: for everything'],
        ['wedo-3', 'WeDo: one step away from shared lists, sign in'],
        ['wedo-4', 'WeDo: no list yet'],
        ['wedo-5', 'WeDo: a new list'],
        ['wedo-6', 'WeDo: Grocery and Baby items lists, shared'],
      ),
    ],
  },
]

/** 03 Proof, first part: the running total. Every one of the 32 client products
 *  lands on the grid (six as cards, the rest as chips), the counters add up, then
 *  it all folds into one orbit around "your product", with one designer below. */
export const TALLY = {
  kicker: 'the running total',
  /** thirteen stickers: six client products (they count) and seven facts about her.
   *  `at` is the grid cell on wide boards; narrow boards pack them 3 across, in
   *  this order (the third sits under the waiting bubble for a while). */
  cards: [
    { kind: 'me', id: 'ai', at: [2, 0], big: 'AI', name: 'I design with AI', line: 'and use it like a pro', bg: '#7ef0d2', fg: '#141413', mk: '#141413' },
    { kind: 'work', id: 'dazn', at: [0, 0], name: 'DAZN', line: 'Sport streaming in 200+ countries', tag: 'Media', shape: 'ball', bg: '#f7e733', fg: '#141413', mk: '#141413' },
    { kind: 'me', id: 'home', at: [2, 3], big: '', name: 'Based in Alicante', line: 'Spain', bg: '#ff6b5a', fg: '#141413', mk: '#ffd23f' },
    { kind: 'me', id: 'certs', at: [1, 0], big: '7', name: 'Google UX certificates', line: 'via Coursera', bg: '#ffffff', fg: '#141413', mk: '#1a73e8' },
    { kind: 'work', id: 'nota', at: [3, 0], name: 'Nota by M&T Bank', line: 'Banking for law firms', tag: 'Banking', shape: 'safe', bg: '#0e6f78', fg: '#ffffff', mk: '#ffd84d' },
    { kind: 'work', id: 'toeic', at: [1, 1], name: 'toeic.pal', line: 'AI English speaking tutor', tag: 'EdTech', shape: 'bubble', bg: '#b9f23a', fg: '#141413', mk: '#0f7a3d' },
    { kind: 'me', id: 'years', at: [2, 1], big: '7+', name: 'years designing products', line: 'web, mobile and TV', bg: '#141413', fg: '#ffffff', mk: '#c6f135' },
    { kind: 'work', id: 'pronto', at: [3, 1], name: 'Pronto', line: 'Nurse staffing', tag: 'Healthcare', shape: 'cross', bg: '#ff8fd8', fg: '#141413', mk: '#c4006f' },
    { kind: 'work', id: 'realoffer', at: [0, 2], name: 'Realoffer.ge', line: 'Real estate listings', tag: 'PropTech', shape: 'house', bg: '#5cc8ff', fg: '#141413', mk: '#0b3d91' },
    { kind: 'work', id: 'moneymarket', at: [2, 2], name: 'Moneymarket.ge', line: 'Loan marketplace', tag: 'Loans', shape: 'coin', bg: '#ff7a3d', fg: '#141413', mk: '#ffe14d' },
    { kind: 'me', id: 'teach', at: [3, 2], big: 'UX', name: 'I teach it, too', line: 'Lecturer at Qwerty', bg: '#c9b8ff', fg: '#141413', mk: '#141413' },
    { kind: 'me', id: 'hello', at: [0, 3], big: 'Hi!', name: 'English and Georgian', line: 'გამარჯობა means hello', bg: '#5b4bff', fg: '#ffffff', mk: '#ffffff' },
    { kind: 'me', id: 'tools', at: [1, 3], big: '', name: 'Figma, Illustrator, XD', line: 'the tools I think in', bg: '#fff3d6', fg: '#141413', mk: '#141413' },
  ],
  chips: [
    'NFT Marketplace',
    'Startup Mentor AI',
    'Avocados and Coconuts',
    'Collect',
    'Hello Audio',
    'Founder Corner',
    'Refresh Miami',
    'Graft',
    'Studious',
    'Bizzy Planners',
    'CPS Visit Service',
    'Build Wise',
    'Xpresso Labs',
    'Sonispark',
    'Roomistry',
    'Qwerty',
    'Burq',
    'NadaPay',
    'Visit Planner',
    'Trusted Managed Services',
    'Driving License',
    'Covid Pass',
    'AntiJarima',
    'Dinespace',
    'GrowthOptix',
    'WeDo',
  ],
  industries: 10,
  typed: 'one designer on every one',
  orbit: ['Research', 'Flows', 'Wireframes', 'Prototype', 'UI', 'Design system'],
  centre: 'Your product',
  me: { name: 'Monika Adeishvili', line: 'All of the above', big: '1', unit: '/designer' },
  flank: ['From a blank Figma file,', 'to a product people use.'],
} as const

export const EMAIL = 'monikaadeishvili@gmail.com'
export const LINKS = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/monika-adeishvili/' },
  { label: 'Instagram', href: 'https://www.instagram.com/monikaadeishvili/' },
]
export const FOOTER = '© 2026 Monika Adeishvili'

export const segText = (segs: Seg[]) => segs.map((s) => (typeof s === 'string' ? s : s.em)).join('')

/** 06 After hours: the trip below the contact section */
export const AFTER = {
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
