import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { List } from './List'
import { ask, item, load } from '../test/fixture'
import { BEHAVIOUR } from '../lib/behaviour'
import { U } from '../lib/state'
import type { Wait } from '../lib/types'

describe('the list', () => {
  it('F291 (behind its switch): one tree with preset views; a subitem hangs under its item', () => {
    BEHAVIOUR.treeList = true
    U.status = 'all'
    load([
      item(1, { title: 'Parent work' }),
      item(2, { title: 'Child work', parent: 1 }),
      item(3, { title: 'Ship it', status: 'review' }),
      item(4, { title: 'Done already', status: 'done', t1: new Date().toISOString() }),
    ])
    const { container } = render(<List />)
    const views = [...container.querySelectorAll('[data-views] [data-v]')].map((b) => b.getAttribute('data-v'))
    expect(views).toEqual(['all', 'wait', 'queued', 'later', 'closed', 'every'])
    const rows = [...container.querySelectorAll('article[data-n]')].map((a) => a.getAttribute('data-n'))
    expect(rows).not.toContain('4') // finished work is in the Finished view
    expect(rows.indexOf('2')).toBe(rows.indexOf('1') + 1)
    expect(screen.getByRole('button', { name: /Accept/ })).toHaveAttribute('data-v', 'accept')
    BEHAVIOUR.treeList = false
  })
  it('as the one-file Taska: what needs you first, with its one action, then the agent queue and Later', () => {
    BEHAVIOUR.treeList = false
    U.status = 'all'
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
