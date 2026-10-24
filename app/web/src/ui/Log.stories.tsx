import type { Meta, StoryObj } from '@storybook/react-vite'
import type { LogSentence } from '../model/activity'
import { Frames, States } from '../stories/Frames'
import { LogLine, LogMore } from './Log'

const meta: Meta = { title: 'Components/Side/Log lines' }
export default meta
type Story = StoryObj

const on = { item() {}, input() {} }
const s = (who: string, parts: LogSentence['parts'], session = ''): LogSentence => ({ key: '#1', who, session, parts, time: '10-23 14:30' })

/** A change as a sentence (its codes are links), with an agent's session, with its time; the end of what is loaded. */
export const Lines: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={520} height={250}>
      {() => (
        <States
          items={[
            ['yours', <p className="px-4 py-2 text-sm"><LogLine s={s('You', [{ n: 12, code: 'F12' }, ' Open → Done'])} on={on} /></p>],
            ['an agent, its session', <p className="px-4 py-2 text-sm"><LogLine s={s('Claude Code', ['progress: ', { n: 12, code: 'F12' }, ' the list is in'], 'taska rewrite')} on={on} /></p>],
            ['with its time', <p className="px-4 py-2 text-sm"><LogLine s={s('Organizer', ['filed ', { id: 'r315', code: '#315' }, ': made F12'])} withTime on={on} /></p>],
            ['the end', <LogMore end cls="px-4 py-3" onNear={() => {}} />],
          ]}
        />
      )}
    </Frames>
  ),
}
