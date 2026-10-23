// T457: every sheet and menu: a sheet from the bottom on the phone, a popover or a dialog on the desktop. Each opens
// over the list, as on the page.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Dialog } from '../../../components/Sheets'
import { OV, U, byN, desk, type DialogOpts } from '../../../lib/state'
import { confirmClick } from '../../../lib/dialog'
import { FAILED } from '../../../lib/toast'
import { VW_STATE } from '../../../lib/views'
import { type Setup } from '../../lib/demo'
import { ListColumn } from '../../lib/column'

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

/** The sheet of that kind, open over the list; `xy` is where a desktop menu opens (under its button). */
const sheet = (
  kind: string,
  props: (x: Setup) => Record<string, unknown> = () => ({}),
  opts: DialogOpts = {},
  setup?: (x: Setup) => void,
  xy: [number, number] = [380, 120],
): Story => ({
  parameters: {
    taska: {
      setup: (x) => {
        setup?.(x)
        OV.spec = { focus: false, ...opts, kind, props: props(x) }
        if (opts.pop && desk()) OV.popXY = xy
      },
    },
  },
  render: () => (
    <>
      <ListColumn />
      <Dialog />
    </>
  ),
})
const n = (ref: string) => (x: Setup) => ({ n: x.it(ref).n })
const pop = { pop: true }

/** An item's actions: a sheet on the phone. */
export const ItemMenuPhone = sheet(
  'menu',
  (x) => ({ n: x.it('F1').n, arm: '' }),
  {},
  ({ it }) => (U.menuFor = it('F1').n),
)
/** Its priority picked from the menu (phone). */
export const ItemMenuPriority = sheet('menu', (x) => ({ n: x.it('F1').n, arm: 'p' }))
/** An item's actions: a popover with each action's key (desktop). */
export const ItemMenuDesktop = sheet('menu-desk', n('F1'), pop, ({ it }) => (U.menuFor = it('F1').n))
/** Delete asks for a second click, in its own words, for 3 seconds (the page's own confirmClick, then it goes back). */
export const ItemMenuDeleteAsks: Story = {
  ...sheet('menu-desk', n('F1'), pop, ({ it }) => (U.menuFor = it('F1').n)),
  play: () => {
    confirmClick('item-delete ' + byN.get(U.menuFor as number)!.n)
  },
}
/** One field's list (status) from the item's head (desktop). */
export const ItemMenuStatus = sheet('menu-desk', n('F1'), { pop: true, narrow: true }, ({ it }) => {
  U.menuFor = it('F1').n
  U.menuArm = 's'
})
/** A message's actions. */
export const MessageMenu = sheet('msg-menu', (x) => ({ n: x.it('F1').n, id: x.it('F1').thread[1].id }), pop)
/** An input's actions. */
export const InputMenu = sheet('input-menu', (x) => ({ id: x.S.inputs.find((r) => !r.acked)!.id }), pop)
/** A project's actions. */
export const ProjectMenu = sheet('proj-menu', () => ({ slug: 'shop' }), pop)
/** One of your views: rename, update, delete. */
export const ViewMenu = sheet(
  'view-menu',
  () => ({ i: 0 }),
  pop,
  () => {
    VW_STATE.list = [
      { name: 'P0 bugs', q: '', type: 'bug', when: 'all', status: 'all', pri: 'P0', sort: 'all' },
    ] as unknown as typeof VW_STATE.list
  },
)
/** Move an item (before or after another, under a parent). */
export const MoveItem = sheet('move', n('T15'), pop)
/** Put an input with an item. */
export const PickAnItem = sheet(
  'pick',
  (x) => ({
    head: 'Put #18 with…',
    act: 'rescope-to',
    data: { id: x.S.inputs.find((r) => !r.acked)!.id },
    skip: [],
  }),
  pop,
)
/** Move an item to another project. */
export const MoveToProject = sheet('item-move-proj', n('B36'))
/** Move an input to another project. */
export const MoveInput = sheet('move-input', (x) => ({ id: x.S.inputs.find((r) => !r.acked)!.id }))
/** Move a document comment to another paragraph. */
export const MoveComment = sheet('dc-move', (x) => {
  const d = x.S.docs.find((d) => d.comments.length)!
  return { d: d.d, id: d.comments.find((c) => c.key !== 'doc')!.id }
})
/** Filters (phone). */
export const Filters = sheet(
  'filters',
  () => ({}),
  {},
  () => (U.type = 'bug'),
)
/** The keys. */
export const Keys = sheet('keys')
/** Switch project. */
export const SwitchProject = sheet('switch')
/** Go to or do: the command palette. */
export const CommandPalette = sheet('palette')
/** A quick look at an item, above the box. */
export const Peek = sheet('peek', n('T7'), { aboveComposer: true, card: true })
/** Going through what needs you, one card at a time (phone). */
export const PeekGoingThrough = sheet('peek', n('B2'), { aboveComposer: true, card: true, walk: true }, ({ it }) => {
  const list = ['B2', 'T7', 'T9'].map((c) => it(c).n)
  U.go = { list, done: new Set(), how: {}, undo: {}, at: list[0], hidden: 0, by: 'list' }
})
/** The versions of an input you changed. */
export const InputHistory = sheet('history', (x) => {
  const r = x.S.inputs.find((r) => r.acked && r.scope)!
  r.history = [{ text: r.text.slice(0, 14), t: r.t, mode: 'edit' }]
  return { id: r.id }
})
/** Where an item came from: the inputs it was made from. */
export const Sources = sheet('sources', n('F1'))
/** The words as you said them, and as heard. */
export const AsSaid = sheet('as-said', (x) => {
  const f = x.S.inputs.flatMap((r) => r.files).find((f) => f.tr)!
  return { heard: f.tr, tr: f.tr }
})
/** Changes that did not go in, each to retry or let go. */
export const NotSaved = sheet(
  'failed',
  () => ({}),
  {},
  () => {
    FAILED.push(
      {
        id: 1,
        sid: 'a',
        what: 'T03 done',
        why: 'Taska said no',
        at: Date.now() - 60000,
        retry: () => {},
        p: '/p/shop/',
      },
      {
        id: 2,
        sid: 'b',
        what: 'Comment on D1',
        why: 'Not reachable',
        at: Date.now() - 300000,
        retry: () => {},
        p: '/p/shop/',
      },
    )
  },
)
/** Taska's key, asked for from outside this computer's network. */
export const SignIn = sheet('sign-in')
