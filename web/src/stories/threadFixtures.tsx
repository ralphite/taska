// The helpers Thread's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import type { Doc } from '../model/types'
import { Frames } from './Frames'
import { comment, doc } from './docFixtures'
import { T } from './fixtures'
import { docAt, type DocHere } from './docPage'

type Story = StoryObj

export const PLAN = doc()
export const at = (min: number) => new Date(Date.parse(T) - min * 60_000).toISOString()
export const one = (h: DocHere, d: Doc = PLAN, height = 760): Story => ({ render: () => <Frames height={height} deskWidth={900} phoneWidth={393}>{(layout) => docAt(d, layout === 'desk', h)}</Frames> })
export const VOICE = { f: 'f8-voice_0-07.webm', name: 'voice_0-07.webm', mime: 'audio/webm', tr: 'Like this, with the filter kept.', heard: 'Like this, um, with the filter kept.' }
export const SHOT = { f: 'f9-filter.png', name: 'filter.png', mime: 'image/png' }
export const withFiles = doc({ blocks: PLAN.blocks.map((b) => (b.key === 'p1' ? { ...b, comments: [...b.comments, comment({ id: 7, key: 'p1', th: 1, quote: 'stays in use', text: 'Like this, with the filter kept.', by: 'you', t: at(5), files: [SHOT, VOICE] })] } : b)) })

/** The words it was on were changed since: under Original text changed, the old words struck through (the phone's
 * sheet scrolled to its end, where they are). */
export const toEnd = (root: HTMLElement) => {
  for (const el of root.querySelectorAll<HTMLElement>('*')) if (el.scrollHeight > el.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(el).overflowY)) el.scrollTop = el.scrollHeight
}
// ---- more states (B636)
export const mapP1 = (f: (c: ReturnType<typeof comment>[]) => ReturnType<typeof comment>[]) => doc({ blocks: PLAN.blocks.map((b) => (b.key === 'p1' ? { ...b, comments: f(b.comments) } : b)) })
export const edited = mapP1((cs) => cs.map((c, i) => (i === 0 ? { ...c, edited: at(20) } : c)))
export const twoThreads = mapP1((cs) => [...cs, comment({ id: 8, key: 'p1', th: 8, quote: 'written from scratch', text: 'From scratch, really?', by: 'you', t: at(15) })])
export const wholeDoc = doc({ whole: [comment({ id: 11, key: 'doc', th: 11, text: 'Looks good as a whole.', by: 'you', t: at(25) }), comment({ id: 12, key: 'doc', th: 12, text: 'Thanks.', t: at(20) })] })
