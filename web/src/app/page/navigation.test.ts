import { describe, expect, test } from 'vitest'
import { createRouteStore, type History } from '../../stores/route'
import { Navigation } from './navigation'

/** A browser history in memory: its addresses and their states. */
function memory(url: string): History {
  const steps: { url: string; state: unknown }[] = [{ url, state: null }]
  let at = 0
  const here = () => new URL(steps[at].url, 'http://taska.local')
  return {
    location: () => ({ path: here().pathname, search: here().search, hash: here().hash }),
    push: (u, state) => {
      steps.splice(at + 1, steps.length, { url: u, state: state ?? null })
      at++
    },
    replace: (u, state) => (steps[at] = { url: u, state: state ?? null }),
    state: () => steps[at].state,
    back: () => (at = Math.max(0, at - 1)),
    backBy: (n) => (at = Math.max(0, at - n)),
    listen: () => () => {},
  }
}

function page(url: string, desk: boolean) {
  const route = createRouteStore(memory(url))
  const lit: [string, boolean][] = []
  const nav = new Navigation(route, () => desk, (id, still) => lit.push([id, still]))
  return { route, nav, lit }
}

describe('going to an input (r1092, T689 #2)', () => {
  test("another project's input, by its address: there, lit where the phone lists it, and no words in the address", () => {
    const { route, nav, lit } = page('/p/home/B003', false)
    nav.to('/p/shop/inputs#r8')
    nav.normalize()
    expect(route.getState().url).toBe('/p/shop/inputs')
    expect(lit).toEqual([['r8', false]])
  })

  test("from the phone's search: the Inputs tab shows in place of the search page", () => {
    const { route, nav, lit } = page('/p/home/', false)
    nav.search(true)
    nav.fromSearch('/p/shop/inputs#r8')
    nav.normalize()
    expect(route.getState()).toMatchObject({ url: '/p/shop/inputs', layers: [] })
    expect(lit).toEqual([['r8', false]])
  })

  test('on the desktop it is lit on the New input page, which lists what you said', () => {
    const { route, nav, lit } = page('/p/home/', true)
    nav.to('/p/shop/inputs#r8')
    nav.normalize()
    expect(route.getState().url).toBe('/p/shop/new')
    expect(lit).toEqual([['r8', false]])
  })

  test("this project's input: to where it is listed, lit (still, as the Sources sheet asks)", () => {
    const { route, nav, lit } = page('/p/shop/F001', false)
    nav.goInput('r4', true)
    expect(route.getState().url).toBe('/p/shop/inputs')
    expect(lit).toEqual([['r4', true]])
  })
})

describe("the phone's Filters sheet", () => {
  // QA of T689 #2 found it: "Show 2 items" closed the sheet and the list went back to all 19
  test('a filter set while the sheet is open stays once it closes, by its button or by Back', () => {
    for (const close of ['button', 'back'] as const) {
      const { route, nav } = page('/p/shop/', false)
      route.getState().openLayer('sheet')
      nav.setList({ type: 'bug' })
      if (close === 'button') route.getState().shutLayer('sheet')
      else route.getState().backBy(1)
      route.getState().read() // the browser says the history moved
      expect([close, route.getState().url, route.getState().layers]).toEqual([close, '/p/shop/?type=bug', []])
    }
  })
})
