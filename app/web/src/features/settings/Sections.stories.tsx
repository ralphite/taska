import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { PROJECT_TONES } from '../../ui/tones'
import { AgentsBody, NotificationsBody, OrganizerBody, PhoneBody, PhonePushBody, ProjectsBody, SpellingsBody, type ProjectsFacts } from './Sections'

const meta: Meta = { title: 'Components/Settings/Sections' }
export default meta
type Story = StoryObj

const no = () => {}
const page = (body: React.ReactNode, height = 760) => (
  <Frames height={height} deskWidth={760}>
    {() => <div className="h-full overflow-y-auto px-6 pt-4">{body}</div>}
  </Frames>
)

/** Who is here and what is queued, who has been here, how to connect one more, what the agent reads. */
export const Agents: Story = {
  render: () =>
    page(
      <AgentsBody
        f={{ tone: 'ok', line: 'Claude Code is connected and picks up new work right away.', queue: 4, later: 2, seen: [{ name: 'claude-code', who: 'Claude Code', when: 'waiting for work', known: true }, { name: 'codex', who: 'Codex', when: '3 h ago', known: true }], cmd: 'curl -s http://localhost:7340/p/taska/connect | sh', far: '', ask: 'This project tracks work in Taska. Run `curl -s http://localhost:7340/p/taska/agent` to learn the interface.', guide: 'You work on Taska items…' }}
        onCopy={no}
      />,
    ),
}

const projects: ProjectsFacts = {
  live: [
    { name: 'taska', title: 'taska', tone: PROJECT_TONES[4], open: 32, here: true },
    { name: 'home', title: 'Home', tone: PROJECT_TONES[0], open: 13, here: false },
  ],
  gone: [{ name: 'old', title: 'Old notes', when: 'Oct 20', items: 4 }],
  file: '~/.taska/taska/taska.db',
  pNew: false,
  pNewText: '',
  pErr: '',
  renaming: null,
  purging: new Set(['old']),
  menu: null,
}
const pOn = { newProject: no, create: no, rename: no, saveRename: no, remove: no, restore: no, purge: no, menu: no, open: no }

/** Projects: new, rename, delete; a deleted one restored or (asking) deleted forever; renaming one; a new one named. */
export const Projects: Story = { render: () => page(<ProjectsBody f={projects} on={pOn} />) }
export const Renaming: Story = { render: () => page(<ProjectsBody f={{ ...projects, renaming: 'home', pNew: true, pErr: 'A project with that address exists' }} on={pOn} />, 420) }

/** The link and the key; Notifications; the phone not on the Home Screen yet; the Organizer. */
export const Others: Story = {
  render: () =>
    page(
      <>
        <PhoneBody link="https://taska.example/k/abc/p/taska/" keyText="abc-def" asking={false} desk on={{ copy: no, newKey: no }} />
        <NotificationsBody state="On" quiet on={{ turnOn: no, quiet: no }} />
        <PhonePushBody standalone={false} onPhone={no} />
        <OrganizerBody on model="gemini-flash-latest" />
      </>,
      1100,
    ),
}

/** Voice spellings with the transcription preferences, tidying, and the words. */
export const Spellings: Story = {
  render: () =>
    page(
      <SpellingsBody
        fixes={[{ wrong: 'task a', right: 'Taska' }, { right: 'Needs you' }]}
        prefs={{ text: 'Write Chinese with English technical words as said.', default: false, tidy: true }}
        editing={false}
        on={{ editPrefs: no, toggleTidy: no, addWord: async () => true, forget: no }}
      />,
    ),
}
