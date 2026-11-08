import { describe, expect, it } from 'vitest'
import { VOICE_STATE_LIST, VOICE_STEPS } from '../../model/voiceStates'
import { nextOf, voiceTree, type StateNode } from './voiceTree'

describe('the voice states tree (F731)', () => {
  const t = voiceTree()
  const all: StateNode[] = []
  const walk = (n: StateNode) => (all.push(n), n.children.forEach(walk))
  walk(t.root)

  it('opens every state once, and has a node for every step between two states', () => {
    expect([...t.opened.keys()].sort()).toEqual([...VOICE_STATE_LIST].sort())
    expect(all.filter((n) => !n.link)).toHaveLength(VOICE_STATE_LIST.length)
    const steps = new Set(VOICE_STEPS.filter((s) => s.from !== s.to).map((s) => `${s.from ?? 'start'} ${s.on} ${s.to}`))
    expect(new Set(all.map((n) => n.id))).toEqual(steps)
  })

  it('walks the normal path on Next, from Recording to Created an item', () => {
    const path = [t.root.state]
    for (let n = nextOf(t, t.root, new Set(path)); n && path.length < 8; n = nextOf(t, n, new Set(path))) path.push(n.state)
    expect(path).toEqual(['recording', 'uploading', 'transcribing', 'fastWords', 'words', 'sending', 'organizing', 'created'])
  })

  it('goes on past a link, into what it names', () => {
    const early = [...t.byId.values()].find((n) => n.state === 'sentTranscribing' && !n.link)!
    const seen = new Set(['recording', 'uploading', 'transcribing', 'fastWords', 'words', 'sending', 'sentTranscribing'] as const)
    const fast = nextOf(t, early, seen)!
    expect([fast.state, fast.link]).toEqual(['sentFastWords', true])
    expect(nextOf(t, fast, new Set([...seen, 'sentFastWords']))?.state).toBe('organizing')
  })
})
