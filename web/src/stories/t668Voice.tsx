// T668, a prototype: your voice note inside your own blue bubble. Every state Yadong asked to see, drawn by the page's
// own talk (ItemTalk) with the look being tried (TalkEnv.voiceLook; unset is today's page). Each option's stories
// and its walk through come from here; the designs are Gemini's (three options, it recommends the first).
import type { StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { LayoutProvider, type Layout } from '../app/context'
import { Tooltip } from '../app/Tooltip'
import type { TalkEnv } from '../features/item/talkEnv'
import type { Comment, FileRef, Message } from '../model/types'
import type { BubbleVoiceLook, PlayState } from '../ui/Files'
import { After } from './Frames'
import { T, input, item, message } from './fixtures'
import { comment, doc } from './itemFixtures'
import { talkOf, type PageOpts } from './itemPage'

type Story = StoryObj

export interface Option {
  look?: BubbleVoiceLook
  /** its name and what it is, one line */
  name: string
  line: string
}
export const TODAY: Option = { name: 'Today', line: 'The voice note under the bubble, in the grey line with the time; nothing heard: "Voice note" in the bubble.' }
export const OPTIONS: Record<1 | 2 | 3, Option> = {
  1: { look: 'pill', name: 'Option 1 · Nested pill', line: 'A soft pill inside the bubble: a white play disc and its time. Nothing heard: the bubble is the pill. (Gemini recommends this one.)' },
  2: { look: 'shelf', name: 'Option 2 · Docked shelf', line: 'A strip docked at the bubble’s foot: play, a track for how far it got, its time. Nothing heard: the bubble is the bar.' },
  3: { look: 'disc', name: 'Option 3 · Bare disc', line: 'A white play disc and its time right on the blue, dots for how far it got. Nothing heard: the bubble shrinks to a round capsule.' },
}

const later = (min: number) => new Date(Date.parse(T) + min * 60_000).toISOString()
const WORDS = 'The export should keep the filter I set.'
const note = (len: string, f: Partial<FileRef> = {}): FileRef => ({ f: `f-voice_${len}.webm`, name: `voice_${len}.webm`, mime: 'audio/webm', ...f })
const v12 = note('0-12', { tr: WORDS, heard: 'um the export should uh keep the filter I set' })
const v03 = note('0-03')
const v41 = note('0-41')
const v05 = note('0-05')
const v437 = note('4-37')
const shot: FileRef = { f: 'f3-shot.png', name: 'shot.png', mime: 'image/png' }
const LONG =
  'http://127.0.0.1:7340/p/demo/D2 Sync it to its three subpages. Keep every filter and sort when the page is opened again, and say which ones were kept at the top of the export, so whoever reads it knows what they are looking at.'
const TWO = 'The first note is the export bug, the second how to make it happen again.'

const play =
  (t: number | null, playing = false) =>
  (): PlayState => ({ playing, t })

/** one message of yours, from input r4: its words and its files */
const said = (text: string, files: FileRef[], o: { env?: Partial<TalkEnv>; trWait?: boolean } = {}) => ({
  thread: [message({ id: 1, by: 'you', kind: 'say', text, src: 'r4' }) as Message],
  o: { inputs: [input({ id: 'r4', text, files, trWait: o.trWait })], env: o.env } as PageOpts,
})
/** one comment of yours on D1 */
const commented = (c: Partial<Comment>) => ({
  thread: [] as Message[],
  o: { docs: [doc({ d: 1, n: 12, title: 'Plan: the export keeps the filter', blocks: [{ key: 'k1', kind: 'para', text: 'The export keeps the filter.', comments: [comment({ id: 9, t: later(1), quote: 'keeps the filter', ...c })] }], whole: [] })] } as PageOpts,
})

export interface State {
  name: string
  data: { thread: Message[]; o: PageOpts }
  /** drawn on the desktop only, with the pointer on its play button */
  pointer?: boolean
}
export const STATES: State[] = [
  { name: 'Words heard', data: said(WORDS, [v12]) },
  { name: 'Nothing heard', data: said('', [v03]) },
  { name: 'Playing', data: said(WORDS, [v12], { env: { play: play(4000, true) } }) },
  { name: 'Paused partway', data: said(WORDS, [v12], { env: { play: play(7000) } }) },
  { name: 'Its words being written out', data: said('', [v12], { trWait: true }) },
  {
    name: 'Sending',
    // (the talk draws what is on its way under a message: an agent's before it)
    data: { thread: [message({ id: 1, by: 'claude-code', kind: 'say', text: 'Which filter should the export keep?' })], o: { t: { outgoing: [{ q: 'q1', text: WORDS, state: 'Sending…', bad: false, voices: [v12] }] } } },
  },
  { name: 'A long voice note', data: said(LONG, [v437]) },
  { name: 'Two voice notes', data: said(TWO, [v12, v41]) },
  { name: 'Voice and a picture', data: said(WORDS, [v12, shot]) },
  { name: 'Comment by voice, nothing heard', data: commented({ text: '', files: [v03] }) },
  { name: 'Comment by voice, with words', data: commented({ text: 'And the sort too?', files: [v05] }) },
  { name: 'Pointer on it', data: said(WORDS, [v12]), pointer: true },
]

const talk = (s: State, look: BubbleVoiceLook | undefined, layout: Layout) =>
  talkOf(item({ n: 12, thread: s.data.thread }), layout === 'desk', { ...s.data.o, env: { ...s.data.o.env, voiceLook: look } })

/** a frame as tall as what is in it (the phone's 393, the desktop's talk 720) */
function Pane({ layout, children }: { layout: Layout; children: ReactNode }) {
  return (
    <div data-layout={layout} className={`@container/frame shrink-0 bg-white text-zinc-900 antialiased ring-1 ring-zinc-300 dark:bg-zinc-950 dark:text-zinc-100 ${layout === 'phone' ? 'w-[393px]' : 'w-[720px]'}`}>
      <LayoutProvider layout={layout}>{children}</LayoutProvider>
    </div>
  )
}

/** the pointer on the play button: the page's own tooltip with its original words */
const pointAt = (root: HTMLElement) => root.querySelector('[data-pointer] [data-heard]')?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))

function Row({ s, look }: { s: State; look: BubbleVoiceLook | undefined }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="font-sans text-xs font-medium text-zinc-600 dark:text-zinc-300">{s.name}</h3>
      <div className="flex flex-wrap items-start gap-6">
        {s.pointer ? null : <Pane layout="phone">{talk(s, look, 'phone')}</Pane>}
        <div {...(s.pointer ? { 'data-pointer': '' } : {})}>
          <Pane layout="desk">{talk(s, look, 'desk')}</Pane>
        </div>
      </div>
    </section>
  )
}

const POINTER = { pseudo: { hover: ['[data-pointer] .group'] } }

function Sheet({ opt, states, head = true }: { opt: Option; states: State[]; head?: boolean }) {
  // the tooltip is the window's, placed once where the button is: only in the story of that one state
  const pointer = states.length === 1 && states[0].pointer
  const rows = (
    <div className="flex min-h-screen flex-col gap-6 bg-zinc-200 p-6 dark:bg-zinc-800">
      {head ? (
        <header className="max-w-[1140px] font-sans">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{opt.name}</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-300">{opt.line}</p>
        </header>
      ) : null}
      {states.map((s) => (
        <Row key={s.name} s={s} look={opt.look} />
      ))}
    </div>
  )
  return pointer ? (
    <>
      <After run={pointAt}>{rows}</After>
      <Tooltip card={() => null} />
    </>
  ) : (
    rows
  )
}

/** every state, one under another (the story names itself: Walk through) */
export const walk = (opt: Option): Story => ({ parameters: POINTER, render: () => <Sheet opt={opt} states={STATES} /> })
/** one state, by its name (the story's name is the state's) */
export const one = (opt: Option, s: { name: string }): Story => {
  const st = STATES.find((x) => x.name === s.name)
  if (!st) throw new Error(`no state ${s.name}`)
  return { name: s.name, ...(st.pointer ? { parameters: POINTER } : {}), render: () => <Sheet opt={opt} states={[st]} head={false} /> }
}
