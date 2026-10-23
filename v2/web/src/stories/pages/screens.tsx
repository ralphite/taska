// T457 (r625): every page of Taska as it really is: each story runs the real page (the same build) on the demo
// project's saved answers (.storybook/public/fixtures, made by v2/tools/story_fixtures.py). Nothing is drawn
// separately, so a page story can never drift from the page. The same screens on the desktop (1440x900) and the
// phone (393x852); light or dark from the toolbar.
import type { StoryObj } from '@storybook/react-vite'

export type Step = (doc: Document, win: Window) => void | Promise<void>
export interface Screen {
  path: string
  steps?: Step[]
  note?: string
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** The page inside, once it has drawn. */
export async function pageIn(canvas: HTMLElement) {
  const f = canvas.querySelector('iframe')
  for (let i = 0; i < 100 && !f?.contentDocument?.querySelector('#app, #home, #root > *'); i++) await wait(100)
  await wait(600)
  return f
}
/** Waits until the page inside has drawn, then does the story's steps there (a click, a key, words in the box). */
async function play(canvas: HTMLElement, steps: Step[] = []) {
  const f = await pageIn(canvas)
  if (!f?.contentDocument) return
  for (const s of steps) {
    await s(f.contentDocument, f.contentWindow!)
    await wait(500)
  }
}
export const click =
  (sel: string): Step =>
  (doc) =>
    doc.querySelector<HTMLElement>(sel)?.click()
export const key =
  (k: string, o: KeyboardEventInit = {}): Step =>
  (doc) => {
    doc.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...o }))
  }
export const type =
  (text: string): Step =>
  (doc) => {
    const t = doc.querySelector<HTMLTextAreaElement>('#text')
    if (!t) return
    t.focus()
    t.value = text
    t.dispatchEvent(new Event('input', { bubbles: true }))
  }

/** The real page at this address. */
export function App({ path, scheme }: { path: string; scheme: string }) {
  const theme = scheme === 'dark' ? 'dark' : 'light'
  return (
    <iframe
      title="Taska"
      src={`/storybook/app.html#path=${encodeURIComponent(path)}&theme=${theme}`}
      className="block h-screen w-full border-0"
    />
  )
}

const P = '/p/shop/'
export const SCREENS: Record<string, Screen> = {
  // the front door and the project
  Home: { path: '/' },
  NewInput: { path: P + 'new' },
  NewInputWriting: {
    path: P + 'new',
    steps: [
      type(
        '\u8d2d\u7269\u8f66\u91cc\u540c\u65f6\u7528\u4f18\u60e0\u5238\u548c\u793c\u54c1\u5361\uff0c\u603b\u4ef7\u7b97\u9519\u4e86',
      ),
    ],
  },
  // the item list, every view
  ItemsActive: { path: P },
  ItemsAll: { path: P + '?status=every' },
  ItemsNeedsYou: { path: P + '?status=wait' },
  ItemsQueue: { path: P + '?status=queued' },
  ItemsLater: { path: P + '?status=later' },
  ItemsFinished: { path: P + '?status=closed' },
  ItemsSearch: { path: P + '?q=%E5%AF%BC%E5%87%BA' },
  ItemsFilters: { path: P + '?type=bug' },
  Inputs: { path: P + 'inputs' },
  Rules: { path: P + 'rules' },
  Archive: { path: P + 'archive' },
  // one item in each state
  ItemInProgressWithTalk: { path: P + 'F1' },
  ItemBlocked: { path: P + 'B2' },
  ItemQuestion: { path: P + 'T7' },
  ItemChecklistQuestion: { path: P + 'T9' },
  ItemProposed: { path: P + 'I4' },
  ItemWaitsForReview: { path: P + 'B6' },
  ItemDone: { path: P + 'B10' },
  ItemWontDo: { path: P + 'T5' },
  ItemOpen: { path: P + 'T3' },
  ItemSubitem: { path: P + 'T13' },
  ItemLongTalk: { path: P + 'B35' },
  // B495: full width (O) on a wide screen: the item and its talk side by side, one line between them to the bottom
  ItemTwoColumns: { path: P + 'B35', steps: [key('o')] },
  RuleProposed: { path: P + 'R17' },
  ItemReplying: { path: P + 'F1', steps: [type('\u5148\u505a\u624b\u673a\u4e0a\u7684\u3002')] },
  ItemMenu: { path: P + 'F1', steps: [key('.')] },
  ItemMenuPhone: { path: P + 'F1', steps: [click('[data-act="item-menu"]')] },
  MessageMenu: { path: P + 'F1', steps: [click('[data-act="msg-menu"]')] },
  // documents
  DocumentWithComments: { path: P + 'D1' },
  DocumentWebPage: { path: P + 'D2' },
  DocumentLong: { path: P + 'D3' },
  DocumentWithChoices: { path: P + 'D4' },
  DocumentEditing: { path: P + 'D1', steps: [click('[data-act="doc-edit"]')] },
  // the project's own pages
  Settings: { path: P + 'settings' },
  Agents: { path: P + 'agents' },
  Documents: { path: P + 'docs' },
  Activity: { path: P + 'log' },
  Deleted: { path: P + 'deleted' },
  Projects: { path: P + 'projects' },
  UseOnYourPhone: { path: P + 'phone' },
  Notifications: { path: P + 'notifications' },
  VoiceSpellings: { path: P + 'spellings' },
  Organizer: { path: P + 'organizer' },
  // other projects, sheets
  SmallProject: { path: '/p/mobile-app/' },
  EmptyProject: { path: '/p/website/' },
  KeyboardShortcuts: { path: P, steps: [key('?')] },
  CommandPalette: { path: P, steps: [key('k', { metaKey: true })] },
  Drawer: { path: P, steps: [click('#projBtn')] },
  GoThrough: { path: P + '?status=wait', steps: [click('[data-act="go-through"]')] },
  ArchivedToast: { path: P + 'B10', steps: [key('e')] },
}

export const screen = (name: string, phone: boolean): StoryObj => {
  const s = SCREENS[name]
  return {
    globals: { viewport: { value: phone ? 'phone' : 'desktop', isRotated: false } },
    render: (_, { globals }) => <App path={s.path} scheme={String(globals.scheme)} />,
    play: async ({ canvasElement }) => play(canvasElement, s.steps),
  }
}
