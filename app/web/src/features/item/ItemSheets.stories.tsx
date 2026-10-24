import type { Meta, StoryObj } from '@storybook/react-vite'
import { input, modelOf } from '../../stories/fixtures'
import { talkEnv } from '../../stories/itemFixtures'
import { SheetFrames, no } from '../../stories/sheetFixtures'
import { messageMenuSheet, sourcesSheet } from './ItemSheets'

const meta: Meta = { title: 'Components/Sheets/Item talk' }
export default meta
type Story = StoryObj

const r = input({ id: 'r12', scope: 4, files: [{ f: 'f2-voice_0-12.webm', name: 'voice_0-12.webm', mime: 'audio/webm' }, { f: 'f3-shot.png', name: 'shot.png', mime: 'image/png' }] })

/** What an item came from; a message's menu. */
export const Sheets: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <SheetFrames height={420} parts={() => sourcesSheet({ code: 'F012', inputs: [r], world: talkEnv(modelOf([]), true).world, now: 0, files: () => null }, no)} />
      <SheetFrames height={260} parts={() => messageMenuSheet(no)} />
    </div>
  ),
}
