import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { List } from './List'
import { item, load } from '../test/fixture'
import { U } from '../lib/state'

describe('the list', () => {
  it('F291: one tree with preset views; a subitem hangs under its item', () => {
    U.status = 'all'
    load([
      item(1, { title: 'Parent work' }),
      item(2, { title: 'Child work', parent: 1 }),
      item(3, { title: 'Ship it', status: 'review' }),
      item(4, { title: 'Done already', status: 'done', t1: new Date().toISOString() }),
    ])
    const { container } = render(<List />)
    const views = [...container.querySelectorAll('[data-views] [data-v]')].map((b) => b.getAttribute('data-v'))
    expect(views).toEqual(['all', 'every', 'wait', 'queued', 'later', 'closed'])
    const rows = [...container.querySelectorAll('article[data-n]')].map((a) => a.getAttribute('data-n'))
    expect(rows).not.toContain('4') // finished work is in the Finished view
    expect(rows.indexOf('2')).toBe(rows.indexOf('1') + 1)
    expect(screen.getByRole('button', { name: /Accept/ })).toHaveAttribute('data-v', 'accept')
  })
  it('says how to start when a project has nothing yet', () => {
    load([])
    render(<List />)
    expect(screen.getByText(/No items yet/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Connect a coding agent' })).toBeInTheDocument()
  })
})
