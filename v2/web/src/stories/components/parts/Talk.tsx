// T457, T522 (R531): an item's talk in every state it has: a message as an agent writes it, as you write it, a question
// in the talk, a comment on one of its documents, the whole talk, and the parts a message is made of. Each story draws
// the page's own components (components/Talk.tsx) on the demo's data, with the item open as on the page; a story changes
// only data (the item's thread, what is on its way, the page's player), or takes the page's own action (R519).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, type ReactElement, type ReactNode } from 'react'
import { DocCard, FileRows, Rich, Talk, Thumbs, VoiceLine, docNotes } from '../../../components/Talk'
import { NeedsCard } from '../../../components/Detail'
import { Tip } from '../../../components/Shell'
import { ACT } from '../../../lib/actions'
import { AUD } from '../../../lib/audio'
import { tipShow } from '../../../lib/events'
import { CHOICE } from '../../../lib/markdown'
import { U, byN, byR, code, ctx, model, parseRef, type DraftFile, type Job } from '../../../lib/state'
import type { FileRef, Input, Item, Msg } from '../../../lib/types'
import { Pane, type Setup } from '../../lib/demo'

// what this part of Storybook shows (T512: its stories are in the folders beside this file)
export const area: Meta = {
  parameters: {
    covers: [
      'MsgView',
      'MsgText',
      'KindTag',
      'Answered',
      'TakeBack',
      'Pending',
      'PlayIcon',
      'VoiceTime',
      'WordsBar',
      'KeepBtn',
      'SendAnswerBtn',
      'NeedFrame',
      'FromInput',
    ],
  },
}
export type Story = StoryObj
type Which = (x: Msg) => boolean

const it = (ref: string) => byN.get(parseRef(ref) as number) as Item
const msg = (ref: string, ok: Which) => {
  const x = it(ref).thread.find(ok)
  if (!x) throw new Error(`no such message on ${ref}`)
  return x
}
const ms = (t: string, plus: number) => new Date(Date.parse(t) + plus).toISOString()
/** The pictures and voice notes of the demo's inputs. */
const pictures = () => model.S.inputs.flatMap((r) => r.files).filter((f) => f.mime?.startsWith('image/'))
const voices = () => model.S.inputs.flatMap((r) => r.files).filter((f) => f.mime?.startsWith('audio/'))
/** A question's choices, as the page reads them (lib/actions.ts ask-modify). */
const labels = (x: Msg) => x.text.split('\n').flatMap((l) => (CHOICE.test(l) ? [l.replace(CHOICE, '').trim()] : []))
/** Your words added to an item's talk after its message `after`, as Taska adds them. */
const reply = (i: Item, after: Msg, text: string, id: number, src = ''): Msg => {
  const t = ms(after.t, 600000)
  if (!src) {
    // what you write to an item is an input of yours first (rN), and its message says so
    const r: Input = {
      id: 'r' + id,
      t,
      by: 'you',
      text,
      scope: i.n,
      files: [],
      acked: true,
      touched: [i.n],
      org: null,
      seq: id,
    }
    model.S.inputs.push(r)
    byR.set(r.id, r)
    src = r.id
  }
  const x: Msg = { id, by: 'you', kind: 'say', text, t, src, files: [] }
  i.thread.splice(i.thread.indexOf(after) + 1, 0, x)
  return x
}
/** An answer to a question, ticks as the page sends them (lib/outbox.ts): Taska has it, so the item no longer waits. */
const answer = (i: Item, q: Msg, picks: string[]) => {
  reply(i, q, picks.map((l) => '\u2713 ' + l).join('\n'), 9001)
  i.wait = null
}
/** Something you sent that is on its way to this item (lib/outbox.ts outboxPush); just sent, it can be taken back. */
const going = (ref: string, x: Partial<Job>): Job => ({
  id: 'q1',
  q: 'q1',
  t: Date.now(),
  text: '',
  files: [],
  scope: code(it(ref).n),
  p: ctx.P,
  undo: async () => {},
  ...x,
})

/** The room the item page gives its talk (components/Detail.tsx, #itemTalk): its column, centred in the item pane, on
 * the desktop; the page's sides on the phone. `room` leaves space below for a tip that opens under it. */
function TalkRoom({ children, room = false }: { children: ReactNode; room?: boolean }) {
  return (
    <Pane w="item">
      <div className="flex flex-col gap-6 px-5 py-5 lg:mx-auto lg:w-full lg:max-w-[46rem] lg:px-8 lg:py-6">
        {children}
      </div>
      {room ? <div className="h-48" /> : null}
    </Pane>
  )
}
/** These messages of an item, drawn by its talk as the page draws them (Talk works out what each shows: answered,
 * taken back, an earlier version, read by, what is on its way), with the item open; `setup` changes the data first. */
const talk = (ref: string, ok: Which, setup?: (x: Setup) => unknown, room = false): Story => ({
  parameters: {
    taska: {
      setup: async (x: Setup) => {
        U.open = x.it(ref).n
        await setup?.(x)
      },
    },
  },
  render: () => (
    <TalkRoom room={room}>
      <Talk it={it(ref)} list={it(ref).thread.filter(ok)} gid="story" />
    </TalkRoom>
  ),
})
/** The first message of the item that fits. */
const ofKind =
  (ref: string, ok: Which): Which =>
  (x) =>
    x === msg(ref, ok)

// a state seen only under the pointer, drawn without one (storybook-addon-pseudo-states; in the globals too, so the
// addon has nothing to change and the story draws once); the desktop only, as the phone has no pointer (T522 r731)
const pointed = (s: Story, hover: string[]): Story => ({
  ...s,
  parameters: { ...s.parameters, platform: 'desktop', pseudo: { hover } },
  globals: { pseudo: { hover } },
})
/** The page's tip, shown for what `sel` finds as pointing at it shows it (lib/events.ts tipShow): a code's card, or
 * the words of a title. The desktop only. */
function TipOn({ sel }: { sel: string }) {
  useEffect(() => {
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(sel)
      if (el) tipShow(el, true)
    }, 400)
    return () => clearTimeout(t)
  }, [sel])
  return <Tip />
}
const tipped = (s: Story, sel: string): Story => ({
  ...s,
  parameters: { ...s.parameters, platform: 'desktop' },
  render: (...a) => (
    <>
      {s.render?.(...a)}
      <TipOn sel={sel} />
    </>
  ),
})
/** Pressed: what the page marks while a finger or the mouse is down on it (lib/events.ts press: data-pressed). */
function PressOn({ sel }: { sel: string }) {
  useEffect(() => {
    const t = setTimeout(() => document.querySelector(sel)?.setAttribute('data-pressed', ''), 300)
    return () => clearTimeout(t)
  }, [sel])
  return null
}
const pressed = (s: Story, sel: string): Story => ({
  ...s,
  render: (...a) => (
    <>
      {s.render?.(...a)}
      <PressOn sel={sel} />
    </>
  ),
})
/** The page's one player (lib/audio.ts) on this voice note, as Play leaves it: playing, or stopped at `at` seconds. A
 * browser plays sound only after a click, and only muted video before one, so here the note plays muted in a hidden
 * video element (the same media API the player reads); in the page, so app-shim.js gives it the saved file as it gives
 * every address of the page. Its address is the page's own rule (components/Talk.tsx fileUrl). */
async function player(f: FileRef, at: number | null) {
  const src = `${ctx.P}f/${encodeURIComponent(f.f)}`
  document.getElementById('storyPlayer')?.remove()
  const a = Object.assign(document.createElement('video'), { id: 'storyPlayer', hidden: true, muted: true, loop: true })
  a.src = src
  document.body.append(a)
  await new Promise((ok) => setTimeout(ok, 50)) // app-shim.js has moved its address
  AUD.el = a as unknown as HTMLAudioElement
  AUD.src = src
  try {
    await a.play()
    if (at !== null) {
      a.pause()
      a.currentTime = at
      await new Promise((ok) => a.addEventListener('seeked', ok, { once: true }))
    }
  } catch {
    /* a browser that does not play: the note shows as it does before Play */
  }
}

// ---------------------------------------------------------------- from an agent

// F1: the agent's messages on the export feature; B2 (blocked), B10 (done), B21, I4, F37, T13 (Codex), B36 (organizer)
export const AgentProgress = talk(
  'F1',
  ofKind('F1', (x) => x.kind === 'progress'),
)
export const AgentReply = talk(
  'F1',
  ofKind('F1', (x) => x.kind === 'say' && x.by !== 'you' && !x.to?.length),
)
/** F450: written to another session of the agent (@worker): its name after the arrow. */
export const AgentToSession = talk(
  'F1',
  ofKind('F1', (x) => !!x.to?.length),
)
/** Pointing at it: its More button (Hide) shows; the phone has it always. */
export const AgentPointed = pointed(AgentProgress, ['.group\\/msg'])
/** Long and not the latest: on the desktop its first part and Show all; on the phone its first line and Show more. */
export const AgentLong = talk(
  'B2',
  ofKind('B2', (x) => x.kind === 'progress'),
)
/** Opened with Show all / Show more: whole, and Show less. */
export const AgentLongOpened = talk(
  'B2',
  ofKind('B2', (x) => x.kind === 'progress'),
  ({ it }) => ACT['more-msg']({ id: String(msg('B2', (x) => x.kind === 'progress').id), n: String(it('B2').n) }),
)
/** Pressed: the part you tap to open it dims while your finger is on it. */
export const AgentLongPressed = pressed(AgentLong, '[data-expand]')
/** The latest message of the open item is whole, however long (B360). */
export const AgentLatestWhole = talk(
  'B21',
  ofKind('B21', (x) => x.kind === 'progress'),
)
/** A finished report: its sections in bold. */
export const AgentReport = talk(
  'B10',
  ofKind('B10', (x) => x.kind === 'progress'),
)
export const AgentWithPictures = talk(
  'F1',
  ofKind('F1', (x) => x.kind === 'say' && x.by !== 'you' && !x.to?.length),
  ({ it }) => {
    const x = it('F1').thread.find((m) => m.kind === 'say' && m.by !== 'you' && !m.to?.length)
    if (x) x.files = pictures()
  },
)
/** Blocked: once you answered it, the card is gone and the message keeps its tag. */
export const AgentBlocked = talk(
  'B2',
  ofKind('B2', (x) => x.kind === 'block'),
)
export const AgentProposal = talk(
  'I4',
  ofKind('I4', (x) => x.kind === 'propose'),
)
export const AgentDecision = talk(
  'F37',
  ofKind('F37', (x) => x.kind === 'decide'),
)
export const AgentCodex = talk(
  'T13',
  ofKind('T13', (x) => x.by === 'codex'),
)
/** What the organizer added from something you said, and where it comes from. */
export const AgentOrganizer = talk(
  'B36',
  ofKind('B36', (x) => x.by === 'org'),
)
/** Hidden from its More menu: one line, Show opens it. */
export const AgentHidden = talk(
  'F1',
  ofKind('F1', (x) => x.kind === 'progress'),
  ({ it }) => {
    const x = it('F1').thread.find((m) => m.kind === 'progress')
    if (x) x.hidden = true
  },
)
/** A hidden message opened with Show: whole, with Show again in place of its More button. */
export const AgentHiddenShown = talk(
  'F1',
  ofKind('F1', (x) => x.kind === 'progress'),
  ({ it }) => {
    const x = it('F1').thread.find((m) => m.kind === 'progress')
    if (x) {
      x.hidden = true
      ACT['msg-peek']({ id: String(x.id) })
    }
  },
)
/** A document's code in a message: pointing at it shows the document's card (F297). */
export const AgentDocCodePointed = tipped(
  talk(
    'F1',
    ofKind('F1', (x) => x.kind === 'progress'),
    undefined,
    true,
  ),
  '[data-ref^="D"]',
)

// ---------------------------------------------------------------- from you

// F1's r3 (words), r4 (with a voice note); B6's r21 (your words after its report)
const words = ofKind('F1', (x) => x.src === 'r3')
const voiced = ofKind('F1', (x) => x.src === 'r4')
export const YouWords = talk('F1', words)
export const YouVoiceNote = talk('F1', voiced)
/** Your voice note playing (muted here): pause, and how far it got. */
export const YouVoicePlaying = talk('F1', voiced, () => player(byR.get('r4')!.files[0], null))
/** Stopped partway: where it stopped, of how long. */
export const YouVoiceStopped = talk('F1', voiced, () => player(byR.get('r4')!.files[0], 6))
/** Sent with a voice note whose words are still being worked out. */
export const YouTranscribing = talk('F1', voiced, () => {
  byR.get('r4')!.tr_wait = true
})
export const YouWithPictures = talk('F1', words, () => {
  byR.get('r3')!.files = pictures()
})
/** Long: on the desktop its first part and Show all; the phone shows your words whole. */
export const YouLong = talk('F1', words, ({ it }) => {
  const x = it('F1').thread.find((m) => m.src === 'r3')
  if (x)
    x.text = model.S.inputs
      .filter((r) => r.scope === it('B35').n)
      .map((r) => r.text)
      .join('\n')
})
/** Edited after Taska had it: when, and the earlier words a tap away. */
export const YouEdited = talk('F1', words, ({ it }) => {
  const x = it('F1').thread.find((m) => m.src === 'r3'),
    r = byR.get('r3')
  if (!x || !r) return
  x.edited = ms(x.t, 900000)
  r.history = [{ text: r.text, t: x.t, mode: 'edit' }]
})
/** Changed after the agent read it: the earlier version, faded, above the words as they are now. */
export const YouEarlierVersion = talk(
  'F1',
  (x) => x.src === 'r3',
  ({ it }) => {
    const i = it('F1'),
      x = i.thread.find((m) => m.src === 'r3')
    if (x) reply(i, x, x.text.replace('\u7b2c\u4e8c\u5217', '\u7b2c\u4e00\u5217'), 9002, 'r3')
  },
)
/** Details added to what you said: only what was added, under the first words. */
export const YouAddedDetails = talk(
  'F1',
  (x) => x.src === 'r3',
  ({ it }) => {
    const i = it('F1'),
      x = i.thread.find((m) => m.src === 'r3')
    if (x) reply(i, x, x.text + '\n\u65e5\u671f\u5217\u4e5f\u4e00\u6837\u3002', 9002, 'r3')
  },
)
/** Your last words, read by the agent, no answer yet. */
const readBy = ({ it }: Setup) => {
  const i = it('B6'),
    x = i.thread.at(-1)
  if (x) i.read = { 'claude-code': Date.parse(x.t) + 120000 }
}
export const YouReadByAgent = talk('B6', (x) => x.by === 'you', readBy)
/** Pointing at Read by: who read it, and when. */
export const YouReadByPointed = tipped(
  talk('B6', (x) => x.by === 'you', readBy, true),
  '[data-src] span[title]',
)
/** An item's code in your words: pointing at it shows the item's card (r368). */
export const YouItemCodePointed = tipped(
  talk('B6', (x) => x.by === 'you', undefined, true),
  '[data-ref^="B"]',
)
/** Just sent and in: Undo takes it back for a few seconds. */
export const YouJustSent = talk(
  'B6',
  (x) => x.by === 'you',
  () => {
    U.sentJobs = [going('B6', { rid: 'r21', text: byR.get('r21')!.text, sending: true })]
  },
)
/** Its input moved to another project: no More button of its own, and the voice note keeps Original words. */
export const YouMoved = talk('F1', voiced, () => {
  byR.get('r4')!.moved = { to: 'mobile-app', as: 'r9' }
})
/** The pointer on its voice note: Original words floats above it (F364). */
export const YouMovedVoicePointed = pointed(YouMoved, ['.group\\/voice'])
// what you sent to this item and Taska does not have yet (B440), under the item's latest message (T13: Codex's)
const latest =
  (ref: string): Which =>
  (x) =>
    x.id === it(ref).thread.at(-1)?.id
const pending = '\u624b\u673a\u4e0a\u7684\u95ee\u9898\u4f18\u5148\u5904\u7406'
export const YouSending = talk('T13', latest('T13'), () => {
  U.outbox = [going('T13', { text: pending, sending: true })]
})
export const YouUploading = talk('T13', latest('T13'), () => {
  const shot: DraftFile = { name: 'shot.png', mime: 'image/png', done: new Promise(() => {}) }
  U.outbox = [going('T13', { text: pending, files: [shot], sending: true })]
})
/** Taska out of reach: it goes by itself when Taska answers. */
export const YouWaitingForTaska = talk('T13', latest('T13'), () => {
  U.outbox = [going('T13', { text: pending, failed: true, net: true, undo: undefined })]
})
/** Taska said no: Retry, or Edit to take it back into the box. */
export const YouNotSent = talk('T13', latest('T13'), () => {
  U.outbox = [going('T13', { text: pending, failed: true, undo: undefined })]
})

// ---------------------------------------------------------------- a question in the talk

// T7: one answer; T9: several (a checklist); T38: a question with no choices, and one taken back
const asked = (ref: string): Which => ofKind(ref, (x) => x.kind === 'ask')
const ask = (ref: string) => msg(ref, (x) => x.kind === 'ask')
/** Answered: your pick ticked, Submitted where the buttons were; on the desktop Modify shows under the pointer. */
export const AskAnswered = talk('T7', asked('T7'), ({ it }) =>
  answer(it('T7'), ask('T7'), labels(ask('T7')).slice(0, 1)),
)
export const AskAnsweredPointed = pointed(AskAnswered, ['.group\\/form'])
export const AskChecklistAnswered = talk('T9', asked('T9'), ({ it }) =>
  answer(it('T9'), ask('T9'), labels(ask('T9')).slice(0, 2)),
)
/** You wrote back instead of picking: Skipped, and Answer to pick after all. */
export const AskSkipped = talk(
  'T7',
  (x) => x.kind === 'ask' || x.by === 'you',
  ({ it }) => {
    reply(it('T7'), ask('T7'), '\u4e24\u79cd\u90fd\u8981\uff0c\u5bfc\u51fa\u65f6\u8ba9\u6211\u9009\u3002', 9001)
    it('T7').wait = null
  },
)
/** Modify: the card asks again, your pick still ticked, Cancel or Send answer. */
export const AskModifying = talk('T7', asked('T7'), ({ it }) => {
  answer(it('T7'), ask('T7'), labels(ask('T7')).slice(0, 1))
  ACT['ask-modify']({ n: String(it('T7').n), id: String(ask('T7').id) })
})
/** A changed answer on its way: the new pick ticked, Sending where the time was, until Taska has it. */
export const AskAnswerGoing = talk('T7', asked('T7'), ({ it }) => {
  answer(it('T7'), ask('T7'), labels(ask('T7')).slice(0, 1))
  U.outbox = [going('T7', { kind: 'answer', text: '\u2713 ' + labels(ask('T7'))[1], sending: true })]
})
/** The question of a proposal, answered: Approve waits quietly beside Submitted (B485). */
export const AskAnsweredApprove = talk('T7', asked('T7'), ({ it }) => {
  answer(it('T7'), ask('T7'), labels(ask('T7')).slice(0, 1))
  it('T7').status = 'proposed'
  it('T7').decided = null
})
/** Approve under the pointer: a button again. */
export const AskAnsweredApprovePointed = pointed(AskAnsweredApprove, ['[data-act="status"]'])
/** Not answered, asked again later: the older one stays a message, tagged Question. */
export const AskNotAnswered = talk('T7', asked('T7'), ({ it }) => {
  const i = it('T7'),
    q = ask('T7'),
    again: Msg = { ...q, id: 9003, t: ms(q.t, 3600000) }
  i.thread.push(again)
  if (i.wait) i.wait.id = again.id
})
/** A question with no choices, answered by your words: Submitted on it. */
export const AskPlainAnswered = talk(
  'T38',
  (x) => x.kind === 'ask' || x.by === 'you',
  ({ it }) => {
    const i = it('T38')
    i.thread = i.thread.filter((x) => x.kind !== 'withdraw')
    reply(i, ask('T38'), '\u6309\u56fd\u5bb6\u81ea\u52a8\u5207\u6362\u3002', 9001)
  },
)
/** Taken back by the agent: the question struck through, and the line that says so. */
export const AskTakenBack = talk('T38', () => true)

// ---------------------------------------------------------------- a comment on a document, in the talk

/** One comment of F1's document (D1), as the talk shows it among the messages (T274 #4, B436, B477). */
const note = (id: number, setup?: (x: Setup) => unknown): Story => ({
  parameters: {
    taska: {
      setup: async (x: Setup) => {
        U.open = x.it('F1').n
        await setup?.(x)
      },
    },
  },
  render: () => (
    <TalkRoom>{docNotes(it('F1').n).find((x) => (x.node as ReactElement).key === `dn1-${id}`)?.node}</TalkRoom>
  ),
})
const d1 = () => model.S.docs.find((d) => d.d === 1)!
/** Yours: what it is about, quoted at its top (it opens that place), and where. */
export const CommentYours = note(23)
export const CommentAgent = note(24)
/** On the whole document: no quote. */
export const CommentWholeDoc = note(27)
/** About a table: the quote reads as words. */
export const CommentOnTable = note(28)
/** A voice comment whose words are still to come. */
export const CommentVoice = note(29, () => {
  const c = d1()
    .blocks.flatMap((b) => b.comments)
    .find((x) => x.id === 29)
  if (c) Object.assign(c, { text: '', files: voices().slice(0, 1) })
})

// ---------------------------------------------------------------- the whole talk

/** F1: every message, its document's comments among them in time (T274 #4), as the page shows them. */
export const WholeTalk: Story = {
  parameters: { taska: { setup: ({ it }: Setup) => void (U.open = it('F1').n) } },
  render: () => (
    <TalkRoom>
      <Talk it={it('F1')} list={it('F1').thread} notes={docNotes(it('F1').n)} gid="story" />
    </TalkRoom>
  ),
}
/** B35: a long back-and-forth. */
export const LongTalk = talk('B35', () => true)
/** T7: what waits on you is its card, in the place of its message (T438 #12). */
export const WithItsCard: Story = {
  parameters: { taska: { setup: ({ it }: Setup) => void (U.open = it('T7').n) } },
  render: () => {
    const i = it('T7')
    return (
      <TalkRoom>
        <Talk it={i} list={i.thread} card={i.wait ? { id: i.wait.id, node: <NeedsCard it={i} /> } : undefined} />
      </TalkRoom>
    )
  },
}

// ---------------------------------------------------------------- parts

export const Markdown: Story = {
  render: () => (
    <TalkRoom>
      <Rich
        gid="story"
        text={
          model.S.docs.find((d) => d.md.includes('|'))!.md +
          '\n\n`inline code` \u00b7 https://example.com/orders?status=paid&from=2026-10-01&to=2026-10-31&columns=amount,date,customer'
        }
      />
    </TalkRoom>
  ),
}
export const Pictures: Story = {
  render: () => (
    <TalkRoom>
      <div className="flex gap-2">
        <Thumbs files={pictures()} gid="story" />
      </div>
    </TalkRoom>
  ),
}
/** Pictures in a row you can slide, voice notes in a row of their own. */
export const FilesAndVoice: Story = {
  render: () => (
    <TalkRoom>
      <FileRows files={model.S.inputs.flatMap((r) => r.files)} gid="story" />
    </TalkRoom>
  ),
}
/** The pointer on the first voice note: Original words floats above it (F364). */
export const VoiceChipPointed = pointed(FilesAndVoice, ['.group\\/voice:first-child'])
/** Your voice note under your words: play, its length, and on the phone Original words (in the line under your words,
 * components/Talk.tsx MsgView). */
export const VoiceNoteLine: Story = {
  render: () => (
    <TalkRoom>
      <div className="flex flex-wrap items-center justify-end gap-x-1">
        <VoiceLine files={voices()} />
      </div>
    </TalkRoom>
  ),
}
/** The item's documents: a document, and a web page. */
export const DocumentCard: Story = {
  render: () => (
    <TalkRoom>
      <div className="flex flex-col gap-2">
        {model.S.docs.map((d) => (
          <DocCard key={d.d} d={d} />
        ))}
      </div>
    </TalkRoom>
  ),
}
export const DocumentCardPointed = pointed(DocumentCard, ['[data-act="doc-open"]:first-child'])
