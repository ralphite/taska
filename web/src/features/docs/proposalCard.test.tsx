import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { RuleProposal } from '../../model/types'
import { NEED, NEEDS_CARD, PRIMARY_BASE, SECOND } from '../../ui/tones'
import { ProposalCard } from './Rules'

// B763 (Yadong r1282): a rules proposal is drawn in the same card as an item's needs, with the same buttons: View
// changes and Approve are the item card's Approve button, Not now its quieter one (the same component, reused).
const p: RuleProposal = { id: 1, by: 'claude-code', t: '2026-11-13T09:00:00-08:00', why: 'Ask before pushing', state: 'wait', on: 3, comments: [] }
const on = { view() {}, comment() {}, decline() {}, approve() {} }
const f = { p, who: 'Claude Code', now: Date.parse('2026-11-13T10:00:00-08:00'), talk: 0 }
const has = (el: HTMLElement, cls: string) => cls.split(' ').every((c) => el.className.split(' ').includes(c))

test('B763: a proposal is in the needs card, its buttons the item card buttons', () => {
  const { container, unmount } = render(<ProposalCard f={f} on={on} />)
  expect(has(container.querySelector('section') as HTMLElement, NEEDS_CARD)).toBe(true)
  const view = screen.getByRole('button', { name: /View changes/ })
  expect(has(view, PRIMARY_BASE) && has(view, NEED.approve.btn)).toBe(true)
  unmount()
  render(<ProposalCard f={f} open on={on} />)
  const yes = screen.getByRole('button', { name: /Approve/ })
  expect(has(yes, PRIMARY_BASE) && has(yes, NEED.approve.btn)).toBe(true)
  expect(has(screen.getByRole('button', { name: /Not now/ }), SECOND)).toBe(true)
})
