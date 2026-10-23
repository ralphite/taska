// T457 (#6481): no connection: what you send and change waits in the page and goes by itself when Taska is back.
// Each demo is its steps (./demo.tsx).
import type { Meta } from '@storybook/react-vite'
import { demo, send, tap, write } from './demo'
import { W } from './words'

export default { title: 'Demo/Sync and errors' } satisfies Meta

const away = { say: 'No connection (the underground)', online: false }
const back = { say: 'The connection is back: it goes by itself', online: true }

export const SendWithNoConnection = demo({
  steps: [
    away,
    write('Write anyway', W.offline),
    send,
    { say: 'It waits in the page, kept even if you close it' },
    back,
  ],
  done: 'Sent, without you doing anything',
})

export const ChangeThingsWithNoConnection = demo({
  steps: [
    away,
    tap('Tap the idea the agent proposed', 'I4'),
    tap('Tap Approve: it shows at once', 'approve'),
    { say: 'Saved later: it keeps trying' },
    back,
  ],
  done: 'Saved once Taska answered',
})
