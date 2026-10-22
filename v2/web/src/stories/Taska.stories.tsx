// T457 (r625): every page and state of Taska as it really is: each story runs the real page (the same build) on a
// demo project's saved answers (.storybook/public/fixtures, made by v2/tools/story_fixtures.py). Nothing is drawn
// separately, so a story can never drift from the page. Desktop 1440x900 and phone 393x852; light or dark from the
// toolbar's Scheme.
import type { Meta, StoryObj } from '@storybook/react-vite'

type Step = (doc: Document, win: Window) => void | Promise<void>
interface Screen {
  path: string
  steps?: Step[]
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Waits until the page inside has drawn, then does the story's steps there (a click, a key, words in the box). */
async function play(canvas: HTMLElement, steps: Step[] = []) {
  const f = canvas.querySelector('iframe')
  if (!f) return
  for (let i = 0; i < 100 && !f.contentDocument?.querySelector('#app, #home, #root > *'); i++) await wait(100)
  await wait(600)
  for (const s of steps) {
    await s(f.contentDocument!, f.contentWindow!)
    await wait(500)
  }
}
const click =
  (sel: string): Step =>
  (doc) =>
    doc.querySelector<HTMLElement>(sel)?.click()
const key =
  (k: string, o: KeyboardEventInit = {}): Step =>
  (doc) => {
    doc.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...o }))
  }
const type =
  (text: string): Step =>
  (doc) => {
    const t = doc.querySelector<HTMLTextAreaElement>('#text')
    if (!t) return
    t.focus()
    t.value = text
    t.dispatchEvent(new Event('input', { bubbles: true }))
  }

function App({ path, scheme }: { path: string; scheme: string }) {
  const theme = scheme === 'dark' ? 'dark' : 'light'
  return (
    <iframe
      title="Taska"
      src={`/storybook/app.html#path=${encodeURIComponent(path)}&theme=${theme}`}
      className="block h-screen w-full border-0"
    />
  )
}

const SCREENS: Record<string, Screen> = {
  // the front door and the project
  Home: { path: '/' },
  NewInput: { path: '/p/shop/new' },
  NewInputWriting: {
    path: '/p/shop/new',
    steps: [type('The cart total is wrong when a coupon and a gift card are both used')],
  },
  // the item list, every view
  ItemsActive: { path: '/p/shop/' },
  ItemsNeedsYou: { path: '/p/shop/?status=wait' },
  ItemsAll: { path: '/p/shop/?status=all' },
  ItemsQueue: { path: '/p/shop/?status=queued' },
  ItemsFinished: { path: '/p/shop/?status=closed' },
  ItemsSearch: { path: '/p/shop/?q=export' },
  ItemsFilters: { path: '/p/shop/?type=bug' },
  Inputs: { path: '/p/shop/inputs' },
  Rules: { path: '/p/shop/rules' },
  Archive: { path: '/p/shop/archive' },
  // one item in each state
  ItemWorkingOnWithThread: { path: '/p/shop/F1' },
  ItemBlocked: { path: '/p/shop/B2' },
  ItemQuestion: { path: '/p/shop/T7' },
  ItemChecklistQuestion: { path: '/p/shop/T9' },
  ItemProposed: { path: '/p/shop/I4' },
  ItemFinishedToAccept: { path: '/p/shop/B6' },
  ItemDone: { path: '/p/shop/B10' },
  ItemWontDo: { path: '/p/shop/T5' },
  ItemOpen: { path: '/p/shop/T3' },
  ItemSubitem: { path: '/p/shop/T13' },
  RuleProposed: { path: '/p/shop/R17' },
  ItemReplying: { path: '/p/shop/F1', steps: [type('Ship A today, then B.')] },
  ItemMenu: { path: '/p/shop/F1', steps: [key('.')] },
  // documents
  DocumentWithComments: { path: '/p/shop/D1' },
  DocumentWithChoices: { path: '/p/shop/D2' },
  // the project's own pages
  Settings: { path: '/p/shop/settings' },
  Agents: { path: '/p/shop/agents' },
  Documents: { path: '/p/shop/docs' },
  Activity: { path: '/p/shop/log' },
  Deleted: { path: '/p/shop/deleted' },
  Projects: { path: '/p/shop/projects' },
  UseOnYourPhone: { path: '/p/shop/phone' },
  Notifications: { path: '/p/shop/notifications' },
  VoiceSpellings: { path: '/p/shop/spellings' },
  Organizer: { path: '/p/shop/organizer' },
  // other projects, sheets
  SmallProject: { path: '/p/mobile-app/' },
  EmptyProject: { path: '/p/website/' },
  KeyboardShortcuts: { path: '/p/shop/', steps: [key('?')] },
  CommandPalette: { path: '/p/shop/', steps: [key('k', { metaKey: true })] },
  Drawer: { path: '/p/shop/', steps: [click('#projBtn')] },
  // more states: going through what needs you, a toast with Undo, a document being edited or a paragraph picked
  GoThrough: { path: '/p/shop/?status=wait', steps: [click('[data-act="go-through"]')] },
  ArchivedToast: { path: '/p/shop/B10', steps: [key('e')] },
  DocumentEditing: { path: '/p/shop/D1', steps: [click('[data-act="doc-edit"]')] },
  DocumentParagraphPicked: {
    path: '/p/shop/D1',
    steps: [click('section[data-key] [data-act="doc-pick"][data-pick-btn], section[data-key]:nth-of-type(2)')],
  },
  ItemMenuPhone: { path: '/p/shop/F1', steps: [click('[data-act="item-menu"]')] },
  MessageMenu: { path: '/p/shop/F1', steps: [click('[data-act="msg-menu"]')] },
}

const meta: Meta = {
  title: 'Taska',
  parameters: { layout: 'fullscreen' },
}
export default meta

const story = (s: Screen, phone: boolean): StoryObj => ({
  globals: { viewport: { value: phone ? 'phone' : 'desktop', isRotated: false } },
  render: (_, { globals }) => <App path={s.path} scheme={String(globals.scheme)} />,
  play: async ({ canvasElement }) => play(canvasElement, s.steps),
})
const desk = (name: string) => story(SCREENS[name], false)
const phone = (name: string) => story(SCREENS[name], true)

export const DesktopHome = desk('Home')
export const DesktopNewInput = desk('NewInput')
export const DesktopNewInputWriting = desk('NewInputWriting')
export const DesktopItemsActive = desk('ItemsActive')
export const DesktopItemsNeedsYou = desk('ItemsNeedsYou')
export const DesktopItemsAll = desk('ItemsAll')
export const DesktopItemsQueue = desk('ItemsQueue')
export const DesktopItemsFinished = desk('ItemsFinished')
export const DesktopItemsSearch = desk('ItemsSearch')
export const DesktopItemsFilters = desk('ItemsFilters')
export const DesktopInputs = desk('Inputs')
export const DesktopRules = desk('Rules')
export const DesktopArchive = desk('Archive')
export const DesktopItemWorkingOnWithThread = desk('ItemWorkingOnWithThread')
export const DesktopItemBlocked = desk('ItemBlocked')
export const DesktopItemQuestion = desk('ItemQuestion')
export const DesktopItemChecklistQuestion = desk('ItemChecklistQuestion')
export const DesktopItemProposed = desk('ItemProposed')
export const DesktopItemFinishedToAccept = desk('ItemFinishedToAccept')
export const DesktopItemDone = desk('ItemDone')
export const DesktopItemWontDo = desk('ItemWontDo')
export const DesktopItemOpen = desk('ItemOpen')
export const DesktopItemSubitem = desk('ItemSubitem')
export const DesktopRuleProposed = desk('RuleProposed')
export const DesktopItemReplying = desk('ItemReplying')
export const DesktopItemMenu = desk('ItemMenu')
export const DesktopDocumentWithComments = desk('DocumentWithComments')
export const DesktopDocumentWithChoices = desk('DocumentWithChoices')
export const DesktopSettings = desk('Settings')
export const DesktopAgents = desk('Agents')
export const DesktopDocuments = desk('Documents')
export const DesktopActivity = desk('Activity')
export const DesktopDeleted = desk('Deleted')
export const DesktopProjects = desk('Projects')
export const DesktopUseOnYourPhone = desk('UseOnYourPhone')
export const DesktopNotifications = desk('Notifications')
export const DesktopVoiceSpellings = desk('VoiceSpellings')
export const DesktopOrganizer = desk('Organizer')
export const DesktopSmallProject = desk('SmallProject')
export const DesktopEmptyProject = desk('EmptyProject')
export const DesktopKeyboardShortcuts = desk('KeyboardShortcuts')
export const DesktopCommandPalette = desk('CommandPalette')
export const DesktopGoThrough = desk('GoThrough')
export const DesktopArchivedToast = desk('ArchivedToast')
export const DesktopDocumentEditing = desk('DocumentEditing')
export const DesktopDocumentParagraphPicked = desk('DocumentParagraphPicked')
export const DesktopMessageMenu = desk('MessageMenu')

export const PhoneHome = phone('Home')
export const PhoneItemsActive = phone('ItemsActive')
export const PhoneItemsNeedsYou = phone('ItemsNeedsYou')
export const PhoneItemsAll = phone('ItemsAll')
export const PhoneItemsQueue = phone('ItemsQueue')
export const PhoneItemsFinished = phone('ItemsFinished')
export const PhoneItemsSearch = phone('ItemsSearch')
export const PhoneInputs = phone('Inputs')
export const PhoneRules = phone('Rules')
export const PhoneArchive = phone('Archive')
export const PhoneDrawer = phone('Drawer')
export const PhoneNewInputWriting = phone('NewInputWriting')
export const PhoneItemWorkingOnWithThread = phone('ItemWorkingOnWithThread')
export const PhoneItemBlocked = phone('ItemBlocked')
export const PhoneItemQuestion = phone('ItemQuestion')
export const PhoneItemChecklistQuestion = phone('ItemChecklistQuestion')
export const PhoneItemProposed = phone('ItemProposed')
export const PhoneItemFinishedToAccept = phone('ItemFinishedToAccept')
export const PhoneItemDone = phone('ItemDone')
export const PhoneItemWontDo = phone('ItemWontDo')
export const PhoneItemOpen = phone('ItemOpen')
export const PhoneItemSubitem = phone('ItemSubitem')
export const PhoneRuleProposed = phone('RuleProposed')
export const PhoneItemReplying = phone('ItemReplying')
export const PhoneDocumentWithComments = phone('DocumentWithComments')
export const PhoneDocumentWithChoices = phone('DocumentWithChoices')
export const PhoneSettings = phone('Settings')
export const PhoneAgents = phone('Agents')
export const PhoneDocuments = phone('Documents')
export const PhoneActivity = phone('Activity')
export const PhoneDeleted = phone('Deleted')
export const PhoneProjects = phone('Projects')
export const PhoneUseOnYourPhone = phone('UseOnYourPhone')
export const PhoneNotifications = phone('Notifications')
export const PhoneVoiceSpellings = phone('VoiceSpellings')
export const PhoneOrganizer = phone('Organizer')
export const PhoneSmallProject = phone('SmallProject')
export const PhoneEmptyProject = phone('EmptyProject')
export const PhoneGoThrough = phone('GoThrough')
export const PhoneItemMenu = phone('ItemMenuPhone')
export const PhoneMessageMenu = phone('MessageMenu')
export const PhoneDocumentEditing = phone('DocumentEditing')
export const PhoneDocumentParagraphPicked = phone('DocumentParagraphPicked')
