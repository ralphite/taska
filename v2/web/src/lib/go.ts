// Going through what needs you (T65, B153). On the phone a card per item floats above the input box: what it needs,
// its talk, and its actions; Previous and Next at the bottom under your thumb. On the desktop the items open in their
// pane one after another, an amber strip says where you are, and what you settle stays in the list, green, with Undo.
// From the home page it goes on from project to project (F251).
import {
  D,
  OV,
  U,
  bump,
  byN,
  desk,
  filtered,
  inTab,
  model,
  needsList,
  needsYou,
  othersNeeding,
  projTitle,
  render,
  titleOf,
  walkTab,
} from './state'
import { toast } from './toast'
import { closeDialog, openDialog } from './dialog'
import { openItem, setTab } from './nav'

// ---------------------------------------------------------------- the phone's card

export function peek(n: number, { focus = true } = {}) {
  const it = byN.get(n)
  if (!it) return
  const moved = U.peek !== n
  U.peek = n
  const g = U.go && U.go.list.includes(n) ? U.go : null
  openDialog('peek', { n }, { aboveComposer: true, focus, card: true, walk: !!g })
  if (moved) OV.maxH = 0
  bump('dialog', 'composer')
  if (moved) requestAnimationFrame(() => document.getElementById('dlgBody')?.scrollTo({ top: 0 }))
}
// After you act on an item while going through: the next one after it that still waits on you.
export function advance(from: number | null, said = '') {
  const g = U.go
  if (!g) {
    closeDialog()
    if (said) toast(said)
    return
  }
  if (from) g.done.add(from)
  const next = g.list
    .slice(g.list.indexOf(from ?? -1) + 1)
    .find((k) => !g.done.has(k) && byN.get(k) && needsYou(byN.get(k) as NonNullable<ReturnType<typeof byN.get>>))
  if (next) {
    peek(next, { focus: false })
    if (said) toast(said)
  } else endWalk(said)
}
export function endWalk(said = '') {
  const g = U.go,
    left = g
      ? g.list.filter(
          (k) => !g.done.has(k) && byN.get(k) && needsYou(byN.get(k) as NonNullable<ReturnType<typeof byN.get>>),
        ).length
      : 0
  closeDialog()
  if (goAll() && goAllNext(g?.done.size || 0)) return // F251
  if (goAll()) {
    const all = goRoundSaid(g?.done.size || 0, left)
    goAllOff()
    return toast(`${said ? said + ' · ' : ''}Went through every project · ${all}`)
  }
  const end = left ? `that was the last one, ${left} still need${left === 1 ? 's' : ''} you` : 'nothing else needs you'
  toast(said ? `${said} · ${end}` : end[0].toUpperCase() + end.slice(1))
}
export function goThroughPhone() {
  const list = needsList()
  if (!list.length) return toast('Nothing needs you right now')
  U.go = { list, done: new Set(), how: {}, undo: {}, at: null, hidden: 0, by: 'filter' }
  peek(list[0])
}

// ---------------------------------------------------------------- the desktop

const GO_KEY = () => 'taska.go.' + model.S.project
const GO = { ready: false }
export function keepGo() {
  // the walk, for a reload (sessionStorage: this tab only)
  if (!GO.ready || !desk()) return
  try {
    const g = U.go
    if (g)
      sessionStorage.setItem(
        GO_KEY(),
        JSON.stringify({ list: g.list, done: [...g.done], how: g.how, at: g.at, hidden: g.hidden, by: g.by }),
      )
    else sessionStorage.removeItem(GO_KEY())
  } catch {
    /* no storage */
  }
}
export function restoreGo() {
  GO.ready = true
  if (!desk() || U.go) return
  try {
    const x = JSON.parse(sessionStorage.getItem(GO_KEY()) || 'null')
    if (x?.list?.length)
      U.go = {
        list: (x.list as number[]).filter((n) => byN.has(n)),
        done: new Set(x.done || []),
        how: x.how || {},
        undo: {},
        at: x.at,
        hidden: x.hidden || 0,
        by: x.by || 'filter',
      }
  } catch {
    /* nothing kept */
  }
}
export function startGoDesk(from?: number | null) {
  const t = walkTab(),
    list = needsList(t),
    all = model.S.items.filter((it) => needsYou(it) && inTab(it, t)).length,
    by = U.q.trim()
      ? filtered() && (U.type !== 'all' || U.when !== 'all' || U.status !== 'all' || U.pri !== 'all')
        ? 'search and filter'
        : 'search'
      : 'filter'
  if (!list.length && !all && goNextProject()) return // F193: nothing here, so on to the next project with something for you
  if (!list.length)
    return toast(all ? `Nothing that needs you is in this ${by} (${all} hidden)` : 'Nothing needs you right now') // B15
  U.go = { list, done: new Set(), how: {}, undo: {}, at: null, hidden: all - list.length, by }
  if (U.go.hidden)
    toast(
      `Going through the ${list.length} your ${by} shows · ${U.go.hidden} more need${U.go.hidden === 1 ? 's' : ''} you`,
    )
  openItem(from != null && list.includes(from) ? from : list[0])
}
export function advanceDesk(from: number, how: string) {
  const g = U.go
  if (!g) return
  g.done.add(from)
  g.how[from] = how
  const next = g.list
    .slice(g.list.indexOf(from) + 1)
    .find((k) => !g.done.has(k) && byN.get(k) && needsYou(byN.get(k) as NonNullable<ReturnType<typeof byN.get>>)) // no going round
  if (next) openItem(next)
  else endGoDesk('last')
}
export function endGoDesk(how: 'end' | 'last') {
  const g = U.go
  if (!g) return
  const settled = g.done.size,
    left = g.list.filter(
      (k) => !g.done.has(k) && byN.get(k) && needsYou(byN.get(k) as NonNullable<ReturnType<typeof byN.get>>),
    ).length
  const tally = `${settled} settled${left ? ` · ${left} still need${left === 1 ? 's' : ''} you` : ''}`
  if (how !== 'end' && goAll() && goAllNext()) return // F251
  U.go = null
  render()
  if (goAll()) {
    const said = goRoundSaid(settled, left)
    goAllOff()
    return toast(`${how === 'end' ? 'Stopped going through' : 'Went through every project'} · ${said}`)
  }
  const next = how !== 'end' && !left && nextNeeding() // F193
  goAllOff()
  if (next)
    return toast(`Nothing else needs you here · ${tally} · ${titleOf(next)} has ${next.needs}`, () => goNextProject(), {
      label: 'Go on ⇧J',
    })
  toast(
    how === 'end'
      ? `Stopped going through · ${tally}`
      : left
        ? `That was the last one · ${tally}`
        : `Nothing else needs you · ${tally}`,
  )
}
export function goResume() {
  // back to where you left off, in Items (T113 A13)
  const g = U.go
  if (!g) return
  if (U.tab !== 'items' || D.page || D.compose) {
    setTab('items')
  }
  const waits = (k: number) =>
      byN.get(k) && needsYou(byN.get(k) as NonNullable<ReturnType<typeof byN.get>>) && !g.done.has(k),
    i = g.list.indexOf(g.at ?? -1)
  const next = g.at != null && waits(g.at) ? g.at : g.list.slice(i + 1).find(waits)
  return next ? openItem(next) : endGoDesk('last')
}

// ---------------------------------------------------------------- across projects (F193, F251)

export const nextNeeding = () => {
  const others = othersNeeding()
  return others.find((p) => titleOf(p).localeCompare(projTitle()) > 0) || others[0]
}
export function goNextProject() {
  const after = nextNeeding()
  if (!after) return false
  try {
    sessionStorage.setItem('taska.go.start', after.name)
  } catch {
    /* no storage */
  }
  location.assign(`/p/${encodeURIComponent(after.name)}/`)
  return true
}
export function startGoFromAnotherProject(start: () => void) {
  try {
    if (sessionStorage.getItem('taska.go.start') !== model.S.project) return
    sessionStorage.removeItem('taska.go.start')
  } catch {
    return
  }
  if (!U.go) start()
}
export const goAll = () => {
  try {
    return sessionStorage.getItem('taska.go.all') === '1'
  } catch {
    return false
  }
}
export const goAllOff = () => {
  try {
    for (const k of ['all', 'seen', 'tally']) sessionStorage.removeItem('taska.go.' + k)
  } catch {
    /* no storage */
  }
}
const goSeen = (): string[] => {
  try {
    return JSON.parse(sessionStorage.getItem('taska.go.seen') || '[]')
  } catch {
    return []
  }
}
export const goAllAhead = () =>
  goAll() && othersNeeding().find((p) => !goSeen().includes(p.name) && p.name !== model.S.project)
const goTally = () => {
  try {
    return Number(sessionStorage.getItem('taska.go.tally') || 0)
  } catch {
    return 0
  }
}
function goRoundSaid(settled: number, left: number) {
  const others = othersNeeding().reduce((k, p) => k + (p.needs || 0), 0),
    all = goTally() + settled,
    still = left + others
  return `${all} settled${still ? ` · ${still} still need${still === 1 ? 's' : ''} you` : ''}`
}
function goAllNext(settled = U.go?.done.size || 0) {
  const next = goAllAhead()
  if (!next) return false
  const seen = [...new Set([...goSeen(), model.S.project])]
  try {
    sessionStorage.setItem('taska.go.seen', JSON.stringify(seen))
    sessionStorage.setItem('taska.go.tally', String(goTally() + settled))
    sessionStorage.setItem('taska.go.start', next.name)
  } catch {
    /* no storage */
  }
  location.assign(`/p/${encodeURIComponent(next.name)}/`)
  return true
}
