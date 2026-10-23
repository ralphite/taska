// T457: one message of an item's talk, in each kind an agent or you write, and the parts a message is made of.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { DocCard, FileRows, MsgView, Rich, Talk, Thumbs, VoiceLine } from '../../../components/Talk'
import { byN, byR, model, parseRef } from '../../../lib/state'
import type { Item, Msg } from '../../../lib/types'
import { Pane } from '../../lib/demo'

// what this part of Storybook shows (T512: its stories are in the folders beside this file)
export const area: Meta = {
  parameters: {
    covers: [
      'MsgView',
      'MsgText',
      'KindTag',
      'Answered',
      'YOU',
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

const it = (ref: string) => byN.get(parseRef(ref) as number) as Item
/** A message of the demo: in that item, the first that fits. */
const find = (ref: string, ok: (x: Msg) => boolean) => {
  const x = it(ref).thread.find(ok)
  if (!x) throw new Error(`no such message on ${ref}`)
  return x
}
const msg = (ref: string, ok: (x: Msg) => boolean, extra: Partial<Parameters<typeof MsgView>[0]> = {}): Story => ({
  render: () => (
    <Pane w="item">
      <div className="flex flex-col gap-4 px-4 py-6 lg:px-8">
        <MsgView x={find(ref, ok)} gid="story" {...extra} />
      </div>
    </Pane>
  ),
})

export const Progress = msg('F1', (x) => x.kind === 'progress')
export const Say = msg('F1', (x) => x.kind === 'say' && x.by !== 'you')
/** What you said: your words on the right; a voice note under them. */
export const YourWords = msg('F1', (x) => x.by === 'you' && !byR.get(x.src || '')?.files.length)
export const YourVoiceNote = msg('F1', (x) => x.by === 'you' && !!byR.get(x.src || '')?.files.length)
export const Question = msg('T7', (x) => x.kind === 'ask')
/** A question you answered: your pick ticked, Submitted, Modify to pick again. */
export const QuestionAnswered = msg('T7', (x) => x.kind === 'ask', {
  done: ['CSV\uff08\u52a0 BOM\uff0cExcel \u6253\u5f00\u4e0d\u4e71\u7801\uff09'],
})
export const ChecklistAnswered = msg('T9', (x) => x.kind === 'ask', {
  done: ['\u5546\u54c1\u9875', '\u7ed3\u8d26\u6d41\u7a0b'],
})
export const Blocked = msg('B2', (x) => x.kind === 'block')
export const Proposal = msg('F37', (x) => x.kind === 'propose')
export const Decision = msg('F37', (x) => x.kind === 'decide')
export const Withdrawn = msg('T38', (x) => x.kind === 'ask', { withdrawn: true })
export const TakesBack = msg('T38', (x) => x.kind === 'withdraw')
/** A finished report with a list: long, so it shows its first part until you open it. */
export const LongReport = msg('B21', (x) => x.text.length > 150)
export const DoneReport = msg('B6', (x) => x.text.includes('**'))
/** What the organizer added from something you said: where it comes from. */
export const FromTheOrganizer = msg('B36', (x) => x.by === 'org')
export const FromCodex = msg('T13', (x) => x.by === 'codex')
/** Read by the agent after your words, no answer yet. */
export const ReadByAgent: Story = {
  render: () => {
    const i = it('F37'),
      x = [...i.thread].reverse().find((m) => m.by === 'you')!
    return (
      <Pane w="item">
        <div className="flex flex-col gap-4 px-4 py-6 lg:px-8">
          <MsgView x={x} gid="story" read={{ id: x.id, names: ['Claude Code'], t: Date.now() - 120000 }} />
        </div>
      </Pane>
    )
  },
}

/** A whole talk: every message of F1 in order, with its document card. */
export const WholeTalk: Story = {
  render: () => (
    <Pane w="item">
      <div className="flex flex-col gap-4 px-4 py-6 lg:px-8">
        <Talk it={it('F1')} list={it('F1').thread} gid="story" />
      </div>
    </Pane>
  ),
}

// ---------------------------------------------------------------- parts

export const Markdown: Story = {
  render: () => (
    <Pane w="item">
      <div className="px-4 py-6 lg:px-8">
        <Rich
          gid="story"
          text={
            model.S.docs.find((d) => d.md.includes('|'))!.md +
            '\n\n`inline code` · https://example.com/orders?status=paid&from=2026-10-01&to=2026-10-31&columns=amount,date,customer'
          }
        />
      </div>
    </Pane>
  ),
}
export const Pictures: Story = {
  render: () => (
    <div className="flex gap-2 p-6">
      <Thumbs files={model.S.inputs.flatMap((r) => r.files).filter((f) => f.mime?.startsWith('image/'))} gid="story" />
    </div>
  ),
}
/** Pictures in a row you can slide, voice notes in a row of their own. */
export const FilesAndVoice: Story = {
  render: () => (
    <Pane w="item">
      <div className="p-6">
        <FileRows files={model.S.inputs.flatMap((r) => r.files)} gid="story" />
      </div>
    </Pane>
  ),
}
export const VoiceNoteLine: Story = {
  render: () => (
    <div className="p-6">
      <VoiceLine files={model.S.inputs.flatMap((r) => r.files).filter((f) => f.mime?.startsWith('audio/'))} />
    </div>
  ),
}
export const DocumentCard: Story = {
  render: () => (
    <Pane w="item">
      <div className="flex flex-col gap-2 p-6">
        {model.S.docs.map((d) => (
          <DocCard key={d.d} d={d} />
        ))}
      </div>
    </Pane>
  ),
}
