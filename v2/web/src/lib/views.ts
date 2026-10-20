// F320: your own views of the item list. A view is the filters you set (type, when, status, priority, sort) with a
// name; it sits after Active, All… in the view row, and it is the same in every project (kept with Taska).
import { U, bump, render } from './state'
import { JSON_POST, net, NET, pushUndo } from './data'
import { toast } from './toast'
import { writeURL } from './url'

export type View = { name: string; type: string; when: string; status: string; pri: string; sort: string }
const KEYS = ['type', 'when', 'status', 'pri', 'sort'] as const
type Filters = Pick<View, (typeof KEYS)[number]>

export const VW_STATE = { list: [] as View[], edit: -1 }

const now = (): Filters => {
  const u = U as unknown as Filters
  return { type: u.type, when: u.when, status: u.status, pri: u.pri, sort: u.sort }
}
export const isView = (v: View) => KEYS.every((k) => (U as unknown as Filters)[k] === v[k])
export function setFilters(f: Filters) {
  for (const k of KEYS) (U as unknown as Filters)[k] = f[k]
}

export async function loadViews() {
  try {
    VW_STATE.list = await net<View[]>('/api/views')
    bump('list')
  } catch {
    /* no views this time: the row shows the presets */
  }
}

async function save(list: View[], said: string, undo = true) {
  const was = VW_STATE.list
  VW_STATE.list = list
  bump('list')
  try {
    const d = await net<{ ok?: boolean; views?: View[]; error?: string }>(
      '/api/views',
      JSON_POST({ views: list }),
      NET.op,
    )
    if (!d.ok) throw new Error(d.error || 'Not saved')
    VW_STATE.list = d.views || list
    bump('list')
    toast(said, undo ? pushUndo(said, () => save(was, 'Put back', false)) : null)
  } catch (ex) {
    VW_STATE.list = was
    bump('list')
    toast(`View not saved: ${(ex as Error).message}`, null, { error: true })
  }
}

export function showView(i: number) {
  const v = VW_STATE.list[i]
  if (!v) return
  setFilters(v)
  writeURL(false)
  render()
}
export function saveView(name: string) {
  name = name.split(/\s+/).join(' ').trim()
  if (!name) return toast('Name the view first', null, { error: true })
  if (VW_STATE.list.some((v) => v.name.toLowerCase() === name.toLowerCase()))
    return toast(`There is a view called ${name} already`, null, { error: true })
  void save([...VW_STATE.list, { name, ...now() }], `Saved the view ${name}`)
}
export function renameView(i: number, name: string) {
  VW_STATE.edit = -1
  const v = VW_STATE.list[i]
  name = name.split(/\s+/).join(' ').trim()
  if (!v || !name || name === v.name) return bump('list')
  if (VW_STATE.list.some((o, j) => j !== i && o.name.toLowerCase() === name.toLowerCase()))
    return toast(`There is a view called ${name} already`, null, { error: true })
  void save(
    VW_STATE.list.map((o, j) => (j === i ? { ...o, name } : o)),
    `Renamed to ${name}`,
  )
}
export function updateView(i: number) {
  const v = VW_STATE.list[i]
  if (v)
    void save(
      VW_STATE.list.map((o, j) => (j === i ? { ...o, ...now() } : o)),
      `${v.name} now shows these filters`,
    )
}
export function deleteView(i: number) {
  const v = VW_STATE.list[i]
  if (v)
    void save(
      VW_STATE.list.filter((_, j) => j !== i),
      `Deleted the view ${v.name}`,
    )
}
