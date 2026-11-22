// T854 (D152): tasks closer to Linear's, a prototype composed only of the page's own parts with a demo shop: the
// phone's list page and the desktop's project page as today, but for the four pieces under discussion:
//   1. no type: # tags beside the title (a tap shows the tasks with it), Tags in the filters and the task's menu
//   2. a group: its own icon, how many of its tasks are finished and a thin bar; its page lists them; the menu's
//      Make a group / Make a task
//   3. blocked by: "Waits for T843" on the row, "Blocks T845" on the blocker's page; the menu's Wait for…
//   4. the agent session on a task at the top of its page: icon, name, a dot, its last line and how long ago; it
//      opens the Agents sheet on that session
// The prototype holds what the server would (each task's tags, the groups, what waits for what) and changes it as
// the menu says, so the page answers as it would.
import { useState } from 'react'
import { agentsSheet } from '../../features/agents/Agents'
import { agentsFacts } from '../../features/agents/agentsFacts'
import { filtersSheet } from '../../features/list/Filters'
import { filterFacts } from '../../features/list/filterFacts'
import type { RowFacts } from '../../features/list/ListRows'
import type { TaskFacts } from '../../features/task/TaskPage'
import { workNews } from '../../model/tasks'
import { NO_FILTERS } from '../../model/route'
import type { AgentSeen, Task } from '../../model/types'
import { Sheet, SheetLayout } from '../../ui/Sheet'
import { AGENTS_ON, sessionKey } from '../agentsFixtures'
import { act } from '../acts'
import { T, task, message, modelOf } from '../fixtures'
import { guide } from '../guideFixture'
import { headOf } from '../headFixtures'
import { pageOf } from '../taskPage'
import { listOf } from '../listFixtures'
import { DeskPage } from '../searchDeskPage'
import { shopWithHistory } from '../settingsFixtures'

const now = Date.parse(T)
const iso = (min: number) => new Date(now - min * 60_000).toISOString()

/** The session on T843: a session works on many tasks, so its name is never a task's (T711). */
export const SESSION = '结账页手机问题'
const agent = { by: 'claude-code', t: iso(3), ses: SESSION }
const said = (id: number, min: number, text: string) => message({ id, ses: SESSION, text, t: iso(min) })
const you = (id: number, min: number, text: string) => message({ id, by: 'you', kind: 'say', text, t: iso(min) })

/** The shop's tasks: the group T840 with its five, an old bug another waits for, the queue, Later. No task has a type:
 * every code is T and a number. */
export const TASKS: Task[] = [
  task({
    n: 840,
    pri: 'P1',
    title: '结账页改版',
    body: '结账页这一轮的修改都放在这里。\n\n- 界面上的改动先在 Storybook 里做原型，看过再写代码。\n- 手机和电脑一样。',
    t0: iso(6 * 24 * 60),
  }),
  task({ n: 841, parent: 840, status: 'done', title: '购物车里改了数量，总价不跟着变', t0: iso(5 * 24 * 60) }),
  task({ n: 842, parent: 840, status: 'done', title: '优惠码输错时，说清楚错在哪', t0: iso(5 * 24 * 60) }),
  task({
    n: 843,
    parent: 840,
    status: 'doing',
    pri: 'P1',
    title: '手机上键盘弹出来，挡住了结账按钮',
    body: '在 iPhone 上填地址时，键盘把底部的“去付款”按钮盖住了，要先收起键盘才能点。',
    agent,
    t0: iso(2 * 24 * 60),
    thread: [
      you(1, 2 * 24 * 60, '手机上填地址的时候，键盘把付款按钮挡住了，得先收起键盘。'),
      said(2, 40, '在 393 宽的屏幕上复现了：键盘弹出后按钮还贴在页面底部，被键盘盖住。'),
      said(3, 3, '按钮改成跟着键盘上移，正在跑检查。'),
    ],
  }),
  task({ n: 844, parent: 840, status: 'done', title: '付款成功页显示订单号', t0: iso(4 * 24 * 60) }),
  task({ n: 845, parent: 840, title: '结账页加上“稍后再买”', body: '购物车里的东西可以先移到“稍后再买”，不占这次的总价。', t0: iso(3 * 24 * 60) }),
  task({ n: 838, pri: 'P1', title: '导出订单时丢了当前的筛选', body: '筛选了“未发货”再导出，文件里还是全部订单。', t0: iso(8 * 24 * 60) }),
  task({ n: 846, title: '导出时也保留排序', t0: iso(7 * 24 * 60) }),
  task({ n: 847, pri: 'P1', title: '订单列表按日期分组显示', t0: iso(9 * 24 * 60) }),
  task({ n: 848, pri: 'P3', when: 'later', title: '打印订单时用浅色', t0: iso(12 * 24 * 60) }),
  task({ n: 836, status: 'done', title: '订单按金额排序', t0: iso(14 * 24 * 60) }),
].map((it) => ({ ...it, code: 'T' + it.n }))

/** What the server would hold for them: their tags, the groups, what waits for what. */
export const TAGS: Record<number, string[]> = { 841: ['bug'], 842: ['ux'], 843: ['bug', '手机'], 845: ['ux'], 838: ['bug'], 848: ['打印'] }
export const ALL_TAGS = ['bug', 'ux', '手机', '打印']

/** The shop's tasks with these tags. */
const withTags = (tags: Record<number, string[]>) => TASKS.map((it) => ({ ...it, tags: tags[it.n] ?? [] }))
export const GROUPS = [840]
// where each group stands, as its agent wrote it (T867)
const NOW: Record<number, string> = { 840: 'Checkout is in; the export waits for the new filter (T843)' }
export const AFTER: Record<number, number[]> = { 845: [843], 846: [838] }

/** How the session on T843 is: at work, or waiting for Yadong to approve a command. */
export type State = 'working' | 'waiting'
const session = (state: State) => ({
  name: SESSION,
  t: now - 3 * 60_000,
  sid: '3f6c1d2e-8a4b-4c1e-9d2f-6b7a8c9d0e1f',
  status: state === 'waiting' ? ('waiting' as const) : ('busy' as const),
  since: now - 40 * 60_000,
  cwd: '/Users/you/dev/shop',
  ...(state === 'waiting' ? { waitingFor: 'approve Bash: npm --prefix web run check' } : {}),
  on: { n: 843, since: now - 40 * 60_000 },
})
export const agentsOf = (state: State): AgentSeen[] => [
  {
    name: 'claude-code',
    t: now - 3 * 60_000,
    waiting: false,
    session: SESSION,
    sessions: [session(state)],
    ...(state === 'waiting' ? { blocked: [{ session: SESSION, waitingFor: 'approve Bash: npm --prefix web run check', since: now - 2 * 60_000 }] } : {}),
  },
]

export interface Start {
  /** the task open (the phone: none, the list) */
  open?: number | null
  /** the tag the list shows */
  tag?: string | null
  state?: State
}

const toggle = <T,>(list: readonly T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

/** The phone's list page or the desktop's project page, holding the prototype's data and what the page holds. */
export function Proto({ desk, start = {} }: { desk: boolean; start?: Start }) {
  const state = start.state ?? 'working'
  const [tags, setTags] = useState(TAGS)
  const [groups, setGroups] = useState<number[]>(GROUPS)
  const [after, setAfter] = useState(AFTER)
  const [open, setOpen] = useState<number | null>(start.open === undefined ? (desk ? 843 : null) : start.open)
  const [tag, setTag] = useState<string | null>(start.tag ?? null)
  const [sheet, setSheet] = useState<null | 'agents' | 'session' | 'filters'>(null)
  const agents = agentsOf(state)
  const m = modelOf(withTags(tags).map((it) => ({ ...it, group: groups.includes(it.n), ...(groups.includes(it.n) && NOW[it.n] ? { next: NOW[it.n] } : {}) })), [], { title: 'Shop', agents, work: true })
  const tagsOf = (it: Task) => tags[it.n] ?? []
  const byN = (n: number) => m.byN.get(n) as Task
  const rowFacts = (it: Task): Partial<RowFacts> => ({
    ...(after[it.n]?.length ? { waitsFor: after[it.n].map((n) => ({ n, code: 'T' + n })) } : {}),
    // a group's agent mark: none (no agent is handed a group)
    ...(groups.includes(it.n) ? { worker: null } : {}),
  })
  const pick = (t: string | null) => (setTag(t), desk ? null : setOpen(null))
  const list = { tags: { on: tag, pick }, facts: rowFacts, filters: true, on: { open: (n: number) => setOpen(n), goto: (n: number) => setOpen(n), tag: pick } }
  const page = (it: Task) => {
    const news = it.agent && it.status === 'doing' ? workNews(it, m.at) : null
    const f: Partial<TaskFacts> = {
      waitsFor: (after[it.n] ?? []).map(byN),
      blocks: Object.entries(after)
        .filter(([, ns]) => ns.includes(it.n))
        .map(([n]) => byN(Number(n))),
      ...(news ? { workers: [{ by: 'claude-code', name: SESSION, state, text: news.text, age: news.age }] } : {}),
    }
    return {
      others: m.tasks.filter((x) => x.n !== it.n),
      f,
      on: { agents: () => setSheet('session'), tag: pick, goto: (n: number) => setOpen(n) },
      menu: { allTags: ALL_TAGS, waitsFor: (after[it.n] ?? []).map((n) => 'T' + n) },
      menuOn: {
        tag: (t: string) => setTags({ ...tags, [it.n]: toggle(tagsOf(it), t) }),
        group: (on: boolean) => setGroups(on ? [...groups, it.n] : groups.filter((n) => n !== it.n)),
      },
      waitSkip: groups,
      waitFor: (n: number) => setAfter({ ...after, [it.n]: [...new Set([...(after[it.n] ?? []), n])] }),
      onBack: () => setOpen(null),
    }
  }
  const sheets = (
    <>
      <Sheet open={sheet === 'agents' || sheet === 'session'} look={{ tall: true, wide: true }} desk={desk} onClose={() => setSheet(null)}>
        {sheet === 'agents' || sheet === 'session' ? (
          <SheetLayout {...agentsSheet(agentsFacts(shopWithHistory(agents, { tasks: m.tasks }), guide('shop')), AGENTS_ON, sheet === 'session' ? { pick: sessionKey('claude-code', SESSION), page: true } : {})} />
        ) : null}
      </Sheet>
      <Sheet open={sheet === 'filters'} look={{}} desk={desk} onClose={() => setSheet(null)}>
        {sheet === 'filters' ? <SheetLayout {...phoneFilters(tag, (t) => setTag(t), () => setSheet(null))} /> : null}
      </Sheet>
    </>
  )
  if (desk) {
    const it = byN(open ?? 843)
    return (
      <>
        <DeskPage slug="shop" n={it.n} rail={false} onSearch={act('Sidebar: search')} model={m} onAgents={() => setSheet('agents')} list={list} page={page(it)} />
        {sheets}
      </>
    )
  }
  return (
    <>
      {open == null ? (
        <div className="flex h-full flex-col">
          {headOf(false, { tasks: m.tasks, agents, onAgents: () => setSheet('agents'), onFilters: () => setSheet('filters'), filtered: !!tag })}
          {listOf(m.tasks, 'tasks', {}, false, list)}
        </div>
      ) : (
        <div key={open} className="flex h-full flex-col">
          {pageOf(byN(open), false, page(byN(open)))}
        </div>
      )}
      {sheets}
    </>
  )
}

/** The phone's Filters sheet with Tags in place of Type. */
function phoneFilters(tag: string | null, pick: (t: string | null) => void, close: () => void) {
  const list = { ...NO_FILTERS, tag: tag ?? 'all' }
  const on = { set: (k: string, v: string) => (k === 'tag' ? pick(v === 'all' ? null : v) : act('Filters: set')()), unset: act('Filters: unset'), reset: () => pick(null), saveView: act('Filters: save as a view'), close }
  return filtersSheet({ ...filterFacts(modelOf(withTags(TAGS)), 'tasks', list), tags: ALL_TAGS }, on)
}
