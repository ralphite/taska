import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { List } from './List'
import { ask, item, load } from '../test/fixture'
import type { Wait } from '../lib/types'

describe('the list', () => {
  it('shows what needs you first, with its one action, then the agent queue and Later', () => {
    load([
      item(1, { title: 'Pick a colour', wait: ask(1, 'Which?\n- ( ) Red\n- ( ) Blue') as unknown as Wait }),
      item(2, { title: 'Ship it', status: 'review' }),
      item(3, { title: 'Write the docs' }),
      item(4, { title: 'Someday', when: 'later' }),
    ])
    const { container } = render(<List />)
    const zones = [...container.querySelectorAll('[data-zone]')].map((z) => z.getAttribute('data-zone'))
    expect(zones).toEqual(['needs', 'queue', 'later'])
    const needs = container.querySelector('[data-zone="needs"]') as HTMLElement
    expect(within(needs).getByText('2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Answer/ })).toHaveAttribute('data-act', 'row-act')
    expect(screen.getByRole('button', { name: /Accept/ })).toHaveAttribute('data-v', 'accept')
    expect(screen.getByText('Write the docs')).toBeInTheDocument()
  })
  it('says how to start when a project has nothing yet', () => {
    load([])
    render(<List />)
    expect(screen.getByText(/No items yet/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Connect a coding agent' })).toBeInTheDocument()
  })
})
