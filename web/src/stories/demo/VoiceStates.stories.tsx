// Demo (F731): every state of a voice message, one click to the next. On the left the tree of its states, made from
// the state machine (model/voiceStates, through voiceTree.ts): a new state or step shows in it by itself. On the right
// the state chosen, drawn by the product's own parts in the four places it shows (stories/voiceWorkflowFixtures, as
// the overview draws them). Next (→) goes the normal way; where it branches, a button per way; Back (←); Start again.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react'
import { VOICE_EVENTS, VOICE_STATES } from '../../model/voiceStates'
import { LineButton } from '../tour/TourFrame'
import { COLUMNS, Place, rowFor } from '../voiceWorkflowFixtures'
import { nextOf, voiceTree, waysOn, type StateNode, type StateTree } from './voiceTree'

export default { title: 'Demo/Voice message', parameters: { layout: 'fullscreen' } } satisfies Meta

const RING = 'rounded-full px-3 py-1.5 text-sm font-medium text-blue-600 ring-1 ring-blue-200 dark:text-blue-400 dark:ring-blue-400/30'

/** A node of the tree and the ones under it. */
function Branch({ node, at, onPick, here }: { node: StateNode; at: StateNode; onPick(n: StateNode): void; here: Ref<HTMLButtonElement> }) {
  const on = node === at
  return (
    <li>
      <button
        ref={on ? here : undefined}
        aria-current={on || undefined}
        onClick={() => onPick(node)}
        className={`flex w-full flex-wrap items-baseline gap-x-1.5 rounded-md px-2 py-1 text-left ${
          on ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800'
        }`}
      >
        <span className={`text-xs ${on ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'}`}>{VOICE_EVENTS[node.on]}</span>
        <span className={node.link ? `text-xs ${on ? '' : 'text-zinc-500 dark:text-zinc-400'}` : 'text-sm font-medium'}>
          {node.link ? '↩\uFE0E ' : ''}
          {VOICE_STATES[node.state].label}
        </span>
      </button>
      {node.children.length ? (
        <ul className="m-0 ml-2 list-none border-l border-zinc-300 p-0 pl-1 dark:border-zinc-700">
          {node.children.map((c) => (
            <Branch key={c.id} node={c} at={at} onPick={onPick} here={here} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

const Choice = ({ onClick, children }: { onClick(): void; children: ReactNode }) => (
  <button onClick={onClick} className="rounded-full bg-white px-3 py-1.5 text-sm text-zinc-800 ring-1 ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700">
    {children}
  </button>
)

function Walk({ tree }: { tree: StateTree }) {
  // the way walked, from the root: Back goes back along it
  const [trail, setTrail] = useState<StateNode[]>([tree.root])
  const at = trail[trail.length - 1]
  const seen = useMemo(() => new Set(trail.map((n) => n.state)), [trail])
  const next = nextOf(tree, at, seen)
  const ways = waysOn(tree, at)
  const row = rowFor(at.state, at)
  const go = (n: StateNode | null) => n && setTrail((t) => [...t, n])
  const back = () => setTrail((t) => (t.length > 1 ? t.slice(0, -1) : t))

  // → and ←, unless typing
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? '')) return
      if (e.key === 'ArrowRight' && next) {
        e.preventDefault()
        setTrail((t) => [...t, next])
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setTrail((t) => (t.length > 1 ? t.slice(0, -1) : t))
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [next])

  // the node chosen stays in sight in the tree
  const here = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    here.current?.scrollIntoView({ block: 'nearest' })
  }, [at])

  return (
    <div className="flex min-h-screen w-max items-start gap-6 bg-zinc-200 px-6 pb-6 font-sans text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
      <nav aria-label="States" className="sticky top-6 mt-6 max-h-[calc(100vh-3rem)] w-[22rem] shrink-0 overflow-y-auto rounded-xl bg-zinc-100 p-2 dark:bg-zinc-900">
        <ul className="m-0 list-none p-0">
          <Branch node={tree.root} at={at} onPick={go} here={here} />
        </ul>
      </nav>
      <main className="flex w-min flex-col gap-4">
        <header data-state={at.state} className="sticky top-0 z-10 flex flex-col gap-3 bg-zinc-200 pt-6 pb-2 dark:bg-zinc-800">
          <h2 className="m-0 flex items-baseline gap-2 text-lg font-semibold">
            <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">{VOICE_EVENTS[at.on]}</span>
            {VOICE_STATES[at.state].label}
            {row.label ? <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">· {row.label}</span> : null}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {trail.length > 1 ? (
              <button onClick={back} className={RING}>
                ← Back
              </button>
            ) : null}
            {next ? <LineButton onClick={() => go(next)}>Next →</LineButton> : null}
            {ways.length > 1 || (ways.length === 1 && !next)
              ? ways.map((w) => (
                  <Choice key={w.id} onClick={() => go(w)}>
                    {VOICE_EVENTS[w.on]} <span className="opacity-60">· {VOICE_STATES[w.state].label}</span>
                  </Choice>
                ))
              : null}
            {trail.length > 1 ? (
              <button onClick={() => setTrail([tree.root])} className={RING}>
                Start again
              </button>
            ) : null}
          </div>
        </header>
        {/* drawn anew for each node: the product's parts keep what they hold while shown */}
        <div key={at.id} className="grid grid-cols-[max-content_max-content] items-start gap-6">
          {row.cells.map((c, i) => (
            <Place key={COLUMNS[i].title} cell={c} col={COLUMNS[i]} />
          ))}
        </div>
      </main>
    </div>
  )
}

/** Every state of a voice message, the normal way first. */
export const EveryState: StoryObj = {
  name: 'Every state',
  render: function Render() {
    const tree = useMemo(voiceTree, [])
    return <Walk tree={tree} />
  },
}
