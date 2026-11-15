import { expect, test, vi } from 'vitest'
import { createStore } from 'zustand/vanilla'
import type { DataState } from '../../stores/data'
import { watchDamaged } from './damaged'

// T806 #3: changes skipped when a project opened are said on the page, once per project
test('skipped changes are said once, and a project with none says nothing', () => {
  const copies: Record<string, unknown> = { shop: { facts: { title: 'Shop', damaged: 2 } }, home: { facts: { title: 'Home' } } }
  const data = createStore<Pick<DataState, 'copies'>>(() => ({ copies: copies as DataState['copies'] }))
  const show = vi.fn()
  const stop = watchDamaged({ data: data as never, toasts: { show } })
  data.setState({ copies: { ...copies } as DataState['copies'] })
  expect(show).toHaveBeenCalledTimes(1)
  expect(show.mock.calls[0][0]).toBe('2 changes in Shop could not be read · some may be missing')
  stop()
})
