// The voice message's states as a tree to step through (F731), made from the state machine (model/voiceStates): the
// root is where a message starts, each node's children the states its steps go to, labelled by the step's event. The
// normal way is each node's first child (the overview's sections say which way is normal: stories/voiceWorkflowFixtures;
// a step is no more normal than the state it leaves), so Next from the root walks the normal path. Each state is
// opened once, where it is fewest branches (then fewest steps) from the root; anywhere else it is a link to that one,
// so a loop never opens again. A step that stays in its state is left out. Pure.

import { VOICE_STATE_LIST, VOICE_STEPS, type VoiceEvent, type VoiceState, type VoiceStep } from '../../model/voiceStates'
import { SECTIONS, rowFor } from '../voiceWorkflowFixtures'

export interface StateNode {
  /** the step into it: one per node */
  id: string
  state: VoiceState
  from: VoiceState | null
  on: VoiceEvent
  /** opened elsewhere: this node only names it */
  link: boolean
  children: StateNode[]
  parent: StateNode | null
}

export interface StateTree {
  root: StateNode
  byId: Map<string, StateNode>
  /** where each state is opened */
  opened: Map<VoiceState, StateNode>
}

const SECTION_ORDER = Object.keys(SECTIONS)
const sectionOf = (row: { section: string }) => SECTION_ORDER.indexOf(row.section)
/** how far from the normal way a step is: its row's section, or the state it leaves', whichever is further */
const rank = (s: VoiceStep) => Math.max(sectionOf(rowFor(s.to, s)), s.from ? sectionOf(rowFor(s.from)) : 0)

/** The steps out of `from` to another state, the normal way first. */
function stepsOut(from: VoiceState): VoiceStep[] {
  return VOICE_STEPS.map((s, i) => ({ s, i }))
    .filter(({ s }) => s.from === from && s.to !== from)
    .sort((a, b) => rank(a.s) - rank(b.s) || VOICE_STATE_LIST.indexOf(a.s.to) - VOICE_STATE_LIST.indexOf(b.s.to) || a.i - b.i)
    .map(({ s }) => s)
}

export function voiceTree(): StateTree {
  const start = VOICE_STEPS.find((s) => s.from === null)
  if (!start) throw new Error('no step starts a voice message')
  // where each state is opened: the step into it fewest branches (a step that is not its state's first), then
  // fewest steps, from the start
  const best = new Map<VoiceState, { b: number; d: number; step: VoiceStep }>([[start.to, { b: 0, d: 0, step: start }]])
  const done = new Set<VoiceState>()
  for (;;) {
    let at: VoiceState | null = null
    for (const [s, c] of best) {
      const a = at && best.get(at)
      if (!done.has(s) && (!a || c.b < a.b || (c.b === a.b && c.d < a.d))) at = s
    }
    if (!at) break
    done.add(at)
    const here = best.get(at)!
    stepsOut(at).forEach((s, k) => {
      const c = { b: here.b + (k ? 1 : 0), d: here.d + 1, step: s }
      const o = best.get(s.to)
      if (!done.has(s.to) && (!o || c.b < o.b || (c.b === o.b && c.d < o.d))) best.set(s.to, c)
    })
  }
  const byId = new Map<string, StateNode>()
  const opened = new Map<VoiceState, StateNode>()
  const make = (step: VoiceStep, parent: StateNode | null): StateNode => {
    const node: StateNode = { id: `${step.from ?? 'start'} ${step.on} ${step.to}`, state: step.to, from: step.from, on: step.on, link: best.get(step.to)?.step !== step, children: [], parent }
    byId.set(node.id, node)
    if (!node.link) {
      opened.set(node.state, node)
      node.children = stepsOut(node.state).map((s) => make(s, node))
    }
    return node
  }
  return { root: make(start, null), byId, opened }
}

/** The ways on from a node: its children, or, for a link, those of the node it names. */
export const waysOn = (t: StateTree, n: StateNode): StateNode[] => (n.link ? (t.opened.get(n.state)?.children ?? []) : n.children)

/** Where Next goes: the first way on (the normal way) to a state not yet `seen` on the way here; null at an end. */
export const nextOf = (t: StateTree, n: StateNode, seen: ReadonlySet<VoiceState>): StateNode | null => waysOn(t, n).find((c) => !seen.has(c.state)) ?? null
