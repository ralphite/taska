import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { workerTip } from '../features/list/ListRows'
import { projectCard } from '../model/projects'
import { AgentName, Who } from '../ui/bits'
import { AgentPill } from './Header'

// T711 (Yadong): an agent with an app icon is shown by its icon, never by the words "Claude Code" (its name stays in
// the icon's tip and for a screen reader); an agent without one keeps its name. The session's name shows in the head's
// agent button and on messages, never in a list (an item row's agent mark, the sidebar's card).
describe('agents by their icon, sessions where they belong (T711)', () => {
  test('an agent with an icon: the icon, named for the tip and a screen reader; without one: its name', () => {
    const { container } = render(
      <p>
        <Who by="claude-code" /> <AgentName by="codex" /> <Who by="antigravity" />
      </p>,
    )
    expect(screen.getByRole('img', { name: 'Claude Code' })).toHaveProperty('title', 'Claude Code')
    expect(screen.getByRole('img', { name: 'Codex' })).toBeTruthy()
    expect(container.textContent).not.toMatch(/Claude Code|Codex/)
    expect(container.textContent).toContain('Antigravity')
  })

  test('the head: the icon in the name\'s place, then the session and what it does', () => {
    const { container } = render(<AgentPill tone="recent" label="Claude Code · 5m" who={{ by: 'claude-code', session: 'Fix export', state: '5m' }} offline={false} />)
    expect(container.querySelector('img')).toBeTruthy()
    expect(container.textContent).toBe('Fix export· 5m')
  })

  test('lists name no session: a row\'s agent mark, the sidebar\'s card', () => {
    expect(workerTip('claude-code')).toBe('Claude Code is on it')
    const card = projectCard({ open: 1, closed: 0, needs: 0, inputs: 0, docs: 0, work: true, t: 0, agents: [{ name: 'claude-code', t: 1e12, waiting: true, session: 'Fix export' }] }, 1e12)
    expect(card.agent?.who).toEqual({ by: 'claude-code', state: 'ready' })
  })
})
