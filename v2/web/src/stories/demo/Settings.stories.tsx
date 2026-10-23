// T457 (#6481): settings: connecting an agent, using Taska on your phone, notifications, voice spellings, the
// organizer. Each demo is its steps (./demo.tsx).
import type { Meta } from '@storybook/react-vite'
import { demo, menu, tap, write } from './demo'
import { W } from './words'

export default { title: 'Demo/Settings' } satisfies Meta

const settings = [menu, tap('Tap Settings', 'settings')]
const page = (name: string, say: string) => [...settings, tap(`Tap ${name}`, 'section', name), { say }]

export const ConnectAnAgent = demo({
  steps: [
    ...page('Agents', 'Who works here, and how to connect one more'),
    tap('Tap Copy: paste it to the agent', 'copy', 2),
  ],
  done: 'Copied: the agent learns Taska from it',
})

export const UseTaskaOnYourPhone = demo({
  steps: page('Use on your phone', 'Scan it with the phone, or copy the key'),
  done: 'The phone opens this Taska',
})

export const Notifications = demo({
  steps: page('Notifications', 'A push to the phone when something needs you'),
  done: 'Turn on, and the phone hears of what needs you',
})

export const TeachItAWord = demo({
  steps: [
    ...page('Voice spellings', 'Names and terms the speech model should spell your way'),
    write('Type one', W.spelling, 'spellingField'),
    tap('Tap Add', 'spellingAdd'),
  ],
  done: 'From now on a voice note spells it this way',
})

export const TheOrganizer = demo({
  steps: page('Organizer', 'What files your inputs into items, and how it did'),
  done: 'Off: your inputs wait for your coding agent',
})
