// T457: every sheet and menu, opened where the page opens it (R509): a sheet from the bottom on the phone; on the
// desktop a menu under the button it came from (B358), at the pointer for a right-click, or a dialog in the middle.
// Each stands over the real part it is opened from: the item's page, the list, the sidebar, the project's bar.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Dialog } from '../../../components/Sheets'
import { Drawer, ProjBar } from '../../../components/Shell'
import { ACT, itemMenuDesk, projectMenu, type Data } from '../../../lib/actions'
import { OV, U, desk, model, parseRef, rcode, type DialogOpts } from '../../../lib/state'
import { confirmClick, popAt } from '../../../lib/dialog'
import { FAILED } from '../../../lib/toast'
import { VW_STATE } from '../../../lib/views'
import { Pane, type Setup } from '../../lib/demo'
import { Column, ListColumn, drawerPlace } from '../../lib/column'

// what this part of Storybook shows (T512: its stories are in the folders beside this file)
export const area: Meta = {
  parameters: {
    covers: [
      'Dialog',
      'CloseX',
      'SegCtl',
      'StatIcon',
      'ItemHeadLine',
      'FilterControls',
      'Switcher',
      'Palette',
      'Picker',
      'MoveInputBody',
      'Armed',
    ],
  },
}
export type Story = StoryObj

// ---------------------------------------------------------------- what Yadong does, the page's way

/** One thing done on the drawn page; a story's steps run once it has drawn (the item's talk has scrolled to its end). */
type Step = (doc: Document) => void | Promise<void>
const pick = (doc: Document, sel: string | ((doc: Document) => Element | null | undefined)) =>
  (typeof sel === 'string' ? doc.querySelector(sel) : sel(doc)) as HTMLElement | null
/** A click, as the page takes it (lib/events.ts): what it opens goes under what was clicked (B358), then its action
 * runs with the button's data. `act` runs another action of the page instead (a menu row's own, when the row's click
 * would first close a sheet, which on the phone steps the page's history back). */
const click =
  (sel: string | ((doc: Document) => Element | null | undefined), act?: string): Step =>
  (doc) => {
    const b = pick(doc, sel)
    if (!b) return
    b.scrollIntoView({ block: 'nearest' })
    const r = b.getBoundingClientRect()
    OV.anchor = { r: [r.left, r.top, r.right, r.bottom], t: Date.now() }
    ACT[act || b.dataset.act || '']?.({ ...b.dataset } as Data)
  }
/** Words typed into a field (the page's own handlers take them, as from the keyboard). */
const type =
  (sel: string, text: string): Step =>
  (doc) => {
    const f = doc.querySelector<HTMLInputElement>(sel)
    if (!f) return
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(f, text)
    f.dispatchEvent(new Event('input', { bubbles: true }))
  }
/** A right-click on what `sel` finds, then what the page does on it (lib/events.ts: an item's or a project's menu at
 * the pointer). */
const rightClick =
  (sel: string, then: (x: number, y: number, el: HTMLElement) => void): Step =>
  (doc) => {
    const el = doc.querySelector<HTMLElement>(sel)
    if (!el) return
    const r = el.getBoundingClientRect()
    then(r.left + Math.min(r.width * 0.6, 220), r.top + r.height / 2, el)
  }
const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms))
async function run(doc: Document, steps: Step[]) {
  // only in the frame that draws the story (the two side by side are drawn in frames of their own)
  if (!doc.querySelector('#overlay')) return
  await wait(1200) // the item opens at its latest message (Column), then the page is still
  for (const s of steps) {
    await s(doc)
    await wait(300)
  }
}

// ---------------------------------------------------------------- where it opens from

/** The real part of the page the sheet is opened from. */
const FROM = {
  /** the item's page (the item pane on the desktop) */
  item: () => <Column />,
  /** the list column */
  list: () => (
    <>
      <ListColumn />
      <Dialog />
    </>
  ),
  /** the project's bar over the list (desktop), the list's head on the phone */
  bar: () => (
    <>
      {desk() ? (
        <Pane w="wide">
          <ProjBar hidden={false} />
        </Pane>
      ) : null}
      <ListColumn />
      <Dialog />
    </>
  ),
  /** the sidebar (desktop) */
  sidebar: () => (
    <>
      <Drawer hidden={false} place={drawerPlace()} />
      <Dialog />
    </>
  ),
}
interface Way {
  from: keyof typeof FROM
  /** what is so before (an item open, a view kept...) */
  setup?: (x: Setup) => void
  /** the sheet set straight, as the page opens it (when nothing about where it was asked for shows) */
  sheet?: (x: Setup) => [string, Record<string, unknown>, DialogOpts?]
  /** what Yadong does after the page has drawn: what opens the sheet, or what he does in it */
  steps?: Step[]
  /** the steps open the sheet on the desktop only (under what was clicked); on the phone it is set straight, a sheet
   * from the bottom wherever it was asked for */
  deskSteps?: boolean
}
const opens = (w: Way): Story => {
  const stepsHere = () => !!w.steps && (!w.deskSteps || desk())
  return {
    parameters: {
      taska: {
        setup: (x) => {
          w.setup?.(x)
          if (w.sheet && !(w.deskSteps && desk())) {
            const [kind, props, opts] = w.sheet(x)
            OV.spec = { focus: false, ...opts, kind, props }
          }
        },
      },
    },
    render: FROM[w.from],
    ...(w.steps
      ? { play: ({ canvasElement }) => (stepsHere() ? run(canvasElement.ownerDocument, w.steps!) : undefined) }
      : {}),
  }
}
const N = (ref: string) => parseRef(ref) as number
/** This item open (the item's page on the phone, the item pane on the desktop). */
const open = (ref: string) => () => (U.open = N(ref))

// ---------------------------------------------------------------- the item's menu (its ⋯, its chips)

const MENU = '#itemMenuBtn'
/** An item's menu from its ⋯: a sheet of tiles and its type, priority and status on the phone, a menu with each
 * action's key under the button on the desktop. */
const itemMenu = (ref: string, ...more: Step[]) =>
  opens({ from: 'item', setup: open(ref), steps: [click(MENU), ...more] })
export const ItemInProgress = itemMenu('F1')
/** Done, Won't do: Archive, no Later. */
export const ItemDone = itemMenu('B10')
/** For later: Back to now. */
export const ItemLater = itemMenu('F8')
/** A subitem: Put under… says where it is now. */
export const Subitem = itemMenu('T15')
/** Archived: Unarchive. */
export const ItemArchived = itemMenu('B21')
/** A rule: no priority, no Later, no New doc, Add subitem or Put under (on the phone as on the desktop). */
export const Rule = itemMenu('R16')
/** A chip in the item's head opens just its choices: under it on the desktop, a sheet of them on the phone (B358). */
const chip = (arm: string) =>
  opens({ from: 'item', setup: open('F1'), steps: [click(`[data-act="item-menu"][data-arm="${arm}"]`)] })
export const Status = chip('s')
export const Priority = chip('p')
export const Type = chip('t')
/** Delete asks again, in its own words: a second click within 3 seconds deletes (lib/dialog.ts confirmClick). Asked
 * again each time it would go back, so the question stays to be seen. */
export const DeleteAsks = itemMenu('F1', async (doc) => {
  const key = 'item-delete ' + N('F1')
  const ask = () => {
    if (!doc.defaultView || !doc.querySelector('#dlg')) return
    confirmClick(key) // the page's first click on Delete (ACT['item-delete'])
    setTimeout(ask, 3020) // after the 3 seconds are over, so it never counts as the second click
  }
  ask()
})
/** A right-click on a row opens that item and its menu at the pointer (desktop). */
export const RightClickOnARow = opens({
  from: 'list',
  setup: open('F1'),
  steps: [
    rightClick(`#list [data-act="open"][data-n="${N('F1')}"]`, (x, y) => {
      itemMenuDesk(N('F1'))
      popAt(x, y)
    }),
  ],
})

// ---------------------------------------------------------------- other menus

/** A message's ⋯ in the item's talk. */
export const MessageMenu = opens({
  from: 'item',
  setup: open('F1'),
  steps: [click((doc) => [...doc.querySelectorAll('[data-act="msg-menu"]')].at(-1))],
})
/** The ⋯ of what you said, in the item's talk: a note said aloud, put with F01 (its original words, Put with another
 * item). */
const SAID = 'r4'
export const InputMenu = opens({
  from: 'item',
  setup: open('F1'),
  steps: [click(`[data-act="input-more"][data-id="${SAID}"]`)],
})
/** A project's menu, right-clicked in the sidebar (desktop): this project's, and another one's. */
const projMenu = (slug: string) =>
  opens({
    from: 'sidebar',
    steps: [rightClick(`#drawerList a[data-slug="${slug}"]`, (x, y) => projectMenu(slug, [x, y]))],
  })
export const ProjectMenu = projMenu('shop')
export const OtherProjectMenu = projMenu('mobile-app')
/** One of your views, right-clicked (held on the phone): rename, update, delete. */
export const ViewMenu = opens({
  from: 'list',
  setup: () => {
    VW_STATE.list = [
      { name: 'P0 bugs', q: '', type: 'bug', when: 'all', status: 'all', pri: 'P0', sort: 'all' },
    ] as unknown as typeof VW_STATE.list
  },
  steps: [
    (doc) => {
      // the chip's own handler (List.tsx): a right-click, or a hold on the phone
      const b = doc.querySelector<HTMLElement>('[data-act="view-use"][data-i="0"]')
      b?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) // the row of views scrolls sideways to it
      const r = b?.getBoundingClientRect()
      if (b && r)
        b.dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 12, clientY: r.bottom }),
        )
    },
  ],
})

// ---------------------------------------------------------------- move and pick

/** Put under…, from the item's menu: the items to put it under, the one it is under marked; No parent. */
export const MoveItem = itemMenu('T15', click('[data-act="reparent"]'))
/** Nothing matches what was typed. */
export const MoveItemNothingMatches = itemMenu('T15', click('[data-act="reparent"]'), type('#dlgBody input', 'zzzz'))
/** Move to project…, from the item's menu. */
export const MoveToProject = itemMenu('B36', click('[data-act="item-move-proj"]'))
/** Put with another item…, from the ⋯ of what you said. */
export const PickAnItem = opens({
  from: 'item',
  setup: open('F1'),
  steps: [click(`[data-act="input-more"][data-id="${SAID}"]`), click('[data-pick="rescope-pick"]', 'rescope-pick')],
  deskSteps: true,
  sheet: () => [
    'pick',
    {
      head: `Put ${rcode(SAID)} with…`,
      act: 'rescope-to',
      data: { id: SAID },
      skip: [model.S.inputs.find((r) => r.id === SAID)?.scope].filter(Boolean),
    },
    { pop: true },
  ],
})
/** Move to…, from the ⋯ of what you said: what moves with it, and what stays. */
export const MoveInput = opens({
  from: 'item',
  setup: open('F1'),
  steps: [click(`[data-act="input-more"][data-id="${SAID}"]`), click('[data-pick="move-input"]', 'move-input')],
})
/** A document's comment, moved to another part of it (or the whole document). */
export const MoveComment = opens({
  from: 'item',
  setup: ({ S }) => {
    const d = S.docs.find((d) => d.comments.some((c) => c.key !== 'doc'))!
    U.open = d.n
    U.doc = d.d
  },
  sheet: ({ S }) => {
    const d = S.docs.find((d) => d.comments.some((c) => c.key !== 'doc'))!
    return ['dc-move', { d: d.d, id: d.comments.find((c) => c.key !== 'doc')!.id }]
  },
})

// ---------------------------------------------------------------- the keys (desktop)

/** Go to or do (Cmd-K), on the list: the page's commands, each with its keys. */
export const CommandPalette = opens({ from: 'list', sheet: () => ['palette', {}] })
/** With an item open: its own commands first, each naming it. */
export const CommandPaletteOnAnItem = opens({ from: 'item', setup: open('F1'), sheet: () => ['palette', {}] })
/** Words typed: the commands and the items they find. */
export const CommandPaletteFinding = opens({
  from: 'list',
  sheet: () => ['palette', {}],
  steps: [type('#cpFilter', 'csv')],
})
export const CommandPaletteNothingMatches = opens({
  from: 'list',
  sheet: () => ['palette', {}],
  steps: [type('#cpFilter', 'zzzz')],
})
/** G P: another project, by typing. */
export const SwitchProject = opens({ from: 'list', sheet: () => ['switch', {}] })
export const SwitchProjectNothingMatches = opens({
  from: 'list',
  sheet: () => ['switch', {}],
  steps: [type('#projFilter', 'zzzz')],
})
/** ?: every key. */
export const Keys = opens({ from: 'list', sheet: () => ['keys', {}] })

// ---------------------------------------------------------------- under the pointer, from the keys, pressed
// T522 (r731, r762): a row of a menu as the pointer, Tab or a press leaves it, drawn without them: the page's own
// :hover and :focus-visible rules turned on for that row the way storybook-addon-pseudo-states does (../../lib/states),
// once the menu is open; a press is the page's data-pressed (lib/events.ts press). The desktop only for the pointer.
const looksAt =
  (sel: string, state: 'hover' | 'focus-visible' | 'pressed'): Step =>
  (doc) => {
    const el = doc.querySelector(sel)
    if (!el) return
    if (state === 'pressed') el.setAttribute('data-pressed', '')
    else el.classList.add(`pseudo-${state}`)
  }
const ROW2 = '#dlgBody button[data-act]:nth-of-type(2)'
/** The item's menu, the pointer on its second row. */
export const ItemMenuPointed = itemMenu('F1', looksAt(ROW2, 'hover'))
/** The item's menu, Tab on its second row. */
export const ItemMenuKeys = itemMenu('F1', looksAt(ROW2, 'focus-visible'))
/** The item's menu, its second row pressed. */
export const ItemMenuPressed = itemMenu('F1', looksAt(ROW2, 'pressed'))
/** The status's choices, the pointer on one not picked. */
export const StatusPointed = opens({
  from: 'item',
  setup: open('F1'),
  steps: [click('[data-act="item-menu"][data-arm="s"]'), looksAt('#dlgBody [aria-pressed="false"]', 'hover')],
})
/** The status's choices, the pointer on the one picked (ticked). */
export const StatusPointedOnPicked = opens({
  from: 'item',
  setup: open('F1'),
  steps: [click('[data-act="item-menu"][data-arm="s"]'), looksAt('#dlgBody [aria-pressed="true"]', 'hover')],
})
/** Cmd-K: the row the arrow keys are on, and the pointer on another. */
export const CommandPalettePointed = opens({
  from: 'list',
  sheet: () => ['palette', {}],
  steps: [looksAt('#dlgBody [aria-selected="false"]:nth-child(3)', 'hover')],
})
/** G P: the project the arrow keys are on, and the pointer on another. */
export const SwitchProjectPointed = opens({
  from: 'list',
  sheet: () => ['switch', {}],
  steps: [looksAt('#dlgBody [aria-selected="false"]', 'hover')],
})

// ---------------------------------------------------------------- sheets

/** Filters (phone; the desktop has them over the list): one set, so Clear all shows. */
export const Filters = opens({ from: 'list', setup: () => (U.type = 'bug'), sheet: () => ['filters', {}] })
/** Answer on a row opens its card above the box (phone). */
export const Peek = opens({ from: 'list', sheet: () => ['peek', { n: N('T7') }, { aboveComposer: true, card: true }] })
/** Where an item came from: what you said that made it (its chip in the item's head). */
export const Sources = opens({ from: 'item', setup: open('F1'), steps: [click('[data-act="sources"]')] })
/** A voice note's words as said, beside the note on the desktop: before they were tidied. */
const asSaid = (tidied: boolean) =>
  opens({
    from: 'item',
    setup: open('F1'),
    sheet: () => {
      const f = model.S.inputs.flatMap((r) => r.files).find((f) => f.tr)!
      // the page asks Taska for them (api/transcript); the note's own words stand in for that answer here
      return ['as-said', { heard: tidied ? f.tr : '', tr: f.tr }, { pop: true }]
    },
    // on the desktop it floats beside the note, where its Original words is (Talk.tsx WordsBar, F364)
    steps: [
      (doc) => {
        const note = doc.querySelector<HTMLElement>('#detailView .group\\/voice')
        if (!note || !desk()) return
        note.scrollIntoView({ block: 'nearest' })
        const r = note.getBoundingClientRect()
        popAt(r.left, r.top)
      },
    ],
  })
export const AsSaid = asSaid(true)
/** A note nothing was tidied in: its words are as said. */
export const AsSaidNothingTidied = asSaid(false)
/** The versions of what you said, after you changed it. */
export const InputHistory = opens({
  from: 'item',
  setup: ({ S }) => {
    U.open = N('F1')
    const r = S.inputs.find((r) => r.id === 'r3')!
    r.history = [{ text: r.text.slice(0, 14), t: r.t, mode: 'edit' }]
  },
  sheet: () => ['history', { id: 'r3' }],
})
/** Changes that did not go in, from the red count on the bar: each to retry or let go, what it was as a link to where
 * it belongs, the words it carried (B527), and its project when it is another one. */
const notSaved = (all: boolean) =>
  opens({
    from: 'bar',
    setup: () => {
      FAILED.push(
        {
          id: 1,
          sid: 'a',
          what: 'T03 done',
          why: 'Taska said no',
          at: Date.now() - 60000,
          retry: () => {},
          p: '/p/shop/',
          go: '/p/shop/T3',
        },
        ...(all
          ? [
              {
                id: 2,
                sid: 'b',
                what: 'your comment on D1',
                why: 'Not reachable',
                at: Date.now() - 300000,
                retry: () => {},
                p: '/p/shop/',
                go: '/p/shop/D1',
                said: 'Who signs the plan off before Friday?',
              },
              {
                id: 3,
                sid: 'c',
                what: 'what you added to #4',
                why: 'unknown input r4',
                at: Date.now() - 900000,
                retry: null,
                p: '/p/website/',
                go: '/p/website/inputs',
                said: 'This is a task of its own.',
              },
            ]
          : []),
      )
    },
    steps: [click('[data-act="failed-open"]')],
  })
export const NotSaved = notSaved(true)
/** One change: no Clear all or Retry all under it. */
export const NotSavedOne = notSaved(false)
/** Taska's key, asked for from outside this computer's network. */
export const SignIn = opens({ from: 'list', sheet: () => ['sign-in', {}, { focus: true }] })
