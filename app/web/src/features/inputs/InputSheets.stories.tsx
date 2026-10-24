import type { Meta, StoryObj } from '@storybook/react-vite'
import { input, modelOf } from '../../stories/fixtures'
import { talkEnv } from '../../stories/itemFixtures'
import { SheetFrames, no } from '../../stories/sheetFixtures'
import { asSaidSheet, historySheet, inputMenuSheet, messageMenuSheet, sourcesSheet } from './InputSheets'

const meta: Meta = { title: 'Components/Sheets/Inputs' }
export default meta
type Story = StoryObj

const r = input({ id: 'r12', scope: 4, files: [{ f: 'f2-voice_0-12.webm', name: 'voice_0-12.webm', mime: 'audio/webm' }, { f: 'f3-shot.png', name: 'shot.png', mime: 'image/png' }], history: [{ text: 'The export should keep it.', t: '2026-10-23T14:00:00-07:00', mode: 'edit' }] })
const on = { edit: no, append: no, asSaid: no, undo: no, move: no, history: no, rescope: no, takeOff: no, remove: no }

/** An input's menu: every row, a file's Take off asking. */
export const Menu: Story = {
  render: () => <SheetFrames parts={() => inputMenuSheet({ r, tidy: true, undo: { tip: '#12: created F012' }, move: true, history: true, scope: 'F004', asking: 'f3-shot.png', deleteTip: 'Delete #12 and F012' }, on)} />,
}

/** Its versions; what an item came from; a voice note's original words; a message's menu. */
export const Others: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <SheetFrames height={420} parts={() => historySheet(r, Date.parse('2026-10-23T15:00:00-07:00'))} />
      <SheetFrames height={420} parts={() => sourcesSheet({ code: 'F012', inputs: [r], world: talkEnv(modelOf([]), true).world, now: 0, files: () => null }, no)} />
      <SheetFrames height={320} parts={() => asSaidSheet('', 'Keep the filter, um, in the export.')} />
      <SheetFrames height={260} parts={() => messageMenuSheet(no)} />
    </div>
  ),
}
