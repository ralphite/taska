// I779 prototype (D134, second design): a project's rules document is a template. A line `{{编程}}` on its own
// puts the shared rules 编程 there (`{{编程 › 测试}}`: only its section 测试); Taska keeps the line and puts the text in
// its place when an agent reads the rules. No groups, no switches: where, how many and which section are all in the
// text. What is drawn here is only what is new: the line read as a block that opens in place, the editor's Insert
// shared rules, a name not found, Settings › Shared rules and the text an agent gets. Everything around them is the
// page's own (RulesReading, RulesEditing, DocView, DocEdit, DocBlock, Rich, SettingsFrame, Part, Sheet, BarBtn,
// ProjTile) with the stories' own demo data. Nothing here changes Taska.
import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { DocBlock } from '../../features/docs/DocBlock'
import { DocEdit } from '../../features/docs/DocEdit'
import { PHONE_DOC_LOOK } from '../../features/docs/DocView'
import { BarBtn, RULES_COLUMN } from '../../features/docs/Rules'
import type { SectionKey } from '../../features/settings/sectionList'
import { Part } from '../../features/settings/SettingsParts'
import { ago } from '../../model/time'
import type { Doc, RuleVersion } from '../../model/types'
import { plural } from '../../model/words'
import { CurrentMark, ProjTile } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import { Rich } from '../../ui/Markdown'
import type { InlineWorld } from '../../ui/markdown/inline'
import { Sheet, SheetLayout } from '../../ui/Sheet'
import { MENU_ROW, MUTED, SECOND, projectTones, toneOf } from '../../ui/tones'
import { acts } from '../acts'
import { comment } from '../docFixtures'
import { docAt } from '../docPage'
import { T } from '../fixtures'
import { inFrame } from '../Frames'
import { at, rulesDocOf } from '../rulesFixtures'
import type { SettingsHere } from '../settingsFixtures'

const NOW = Date.parse(T) + 60_000
const text = (...parts: string[][]) => parts.map((p) => p.join('\n')).join('\n\n')

// ---------------------------------------------------------------- the shared rules and the projects that use them

/** Taska's rules today (version 5), split as D134's migration splits them: how to talk and work for every project,
 * the coding rules for every coding project, the rest stays Taska's. */
const COMMON = text(
  ['## 沟通和工作方式（含禁止空跑）'],
  ['给 Yadong 写东西、安排自己怎么干活、写规则时看这一条。'],
  ['### 1. 禁止空跑'],
  ['- 没有真实新工作就结束这一轮；不许定时唤醒模型查有没有活或消息，任何频率都不行。', '- 要一直连着 Taska、又不花 token：每轮结束前在后台挂一个请求，等到有新工作才返回。', '- 发现空跑立即停掉并告诉 Yadong。'],
  ['### 2. 沟通'],
  ['- 一切沟通都在 Taska，Yadong 只看 Taska；受阻就在 Taska 说明、建事项，接着做别的。', '- 超过 10 行写成文档，消息一句话指过去。', '- 他已经讲明的直接做，做完报告，不让他勾。'],
  ['### 3. 写规则'],
  ['- 规则越少越好：同一领域写成一条，分节写清什么时候用。', '- 规则里不许有编号、链接，不许引用文档；共享规则的引用行除外。'],
)
const CODING = text(
  ['## 需求（改功能、改行为时）'],
  ['- 动手前把需求放进真实使用里想一遍；可能听错或有两种理解时，先在事项里问 Yadong 确认。', '- Yadong 明确讲过的需求是硬性要求；和新要求冲突时先问他。'],
  ['## 代码（改代码、提交、推送时）'],
  ['- 删功能或换掉旧做法就删干净：路由、状态、界面、服务端一起删，不做向后兼容。', '- 修一处先找出同样做法的地方一起改，完成时说查了哪些。', '- 推送的内容不含用户数据、个人数据、密钥；代码和提交说明不用中文。'],
  ['## 测试（决定测多少时）'],
  ['- 按风险测：改字、挪位置、小修只跑类型检查、lint 和单元测试。', '- 重测试（整组浏览器测试、逐状态截图）默认一天最多一次，先在事项里说明跑什么、为什么。', '- 测试一失败，先查是产品的 bug 还是测试过时。'],
)
const WRITING = text(['## 写作（写方案、笔记、文档时）'], ['- 先写结论，再写理由；一段只讲一件事。', '- 术语第一次出现时附英文。', '- 图用 Mermaid，不贴截图。'])

/** Taska's own rules, after the two lines. */
const TASKA_OWN = text(
  ['## Taska 自己的开发规则'],
  ['改 Taska 的代码时看这一条。'],
  ['### 1. 上线'],
  ['- 改完马上上线，不攒；上线只用 tools/ship.sh。', '- 一分钟内在用不重启，弹提示让他点。'],
  ['### 2. Storybook'],
  ['- 故事 = 产品里真实用的组件 + 数据，不画产品里没有的界面。', '- 界面提案和 mock 一律是 Storybook 原型：用已有的组件和页面拼出来，只改被要求的那块。'],
)
/** Taska's rules document as it is written: the two lines, then its own. */
export const TASKA_RULES = text(['{{通用}}'], ['{{编程}}'], [TASKA_OWN])
/** the same with a name written wrong */
export const TASKA_BROKEN = TASKA_RULES.replace('{{编程}}', '{{编程X}}')

interface Project {
  slug: string
  title: string
}
const PROJECTS: Project[] = [
  { slug: 'taska', title: 'Taska' },
  { slug: 'system-design', title: 'System design' },
  { slug: 'shop', title: 'Shop' },
  { slug: 'home', title: 'Home' },
]
const TONES = projectTones(PROJECTS.map((p) => p.slug))
const projectOf = (slug: string) => PROJECTS.find((p) => p.slug === slug) as Project

export interface Shared {
  name: string
  d: number
  md: string
  v: number
  by: string
  /** minutes since it last changed */
  ago: number
  /** each project that uses it, and its line */
  used: { slug: string; line: string }[]
}
export const SHARED_RULES: Shared[] = [
  {
    name: '通用',
    d: 21,
    md: COMMON,
    v: 4,
    by: 'you',
    ago: 60 * 26,
    used: [
      { slug: 'taska', line: '{{通用}}' },
      { slug: 'system-design', line: '{{通用}}' },
      { slug: 'shop', line: '{{通用}}' },
      { slug: 'home', line: '{{通用}}' },
    ],
  },
  {
    name: '编程',
    d: 22,
    md: CODING,
    v: 3,
    by: 'claude-code',
    ago: 140,
    used: [
      { slug: 'taska', line: '{{编程}}' },
      { slug: 'shop', line: '{{编程}}' },
      { slug: 'home', line: '{{编程 › 测试}}' },
    ],
  },
  { name: '写作', d: 23, md: WRITING, v: 1, by: 'you', ago: 60 * 24 * 6, used: [{ slug: 'system-design', line: '{{写作}}' }] },
]
const sharedOf = (name: string) => SHARED_RULES.find((s) => s.name === name)

// ---------------------------------------------------------------- the lines, as Taska would read them

/** A line of its own `{{name}}` or `{{name › section}}`. */
const LINE = /^\{\{\s*([^}›]+?)\s*(?:›\s*([^}]+?)\s*)?\}\}$/
interface Ref {
  name: string
  part: string | null
  label: string
}
const refOf = (line: string): Ref | null => {
  const m = LINE.exec(line.trim())
  return m ? { name: m[1], part: m[2] ?? null, label: m[2] ? `${m[1]} › ${m[2]}` : m[1] } : null
}

/** A shared document's sections, by "## ": each its name (the words before its "（…）") and its text. */
const sectionsOf = (md: string) =>
  md
    .split(/^(?=## )/m)
    .filter((s) => s.startsWith('## '))
    .map((s) => ({ name: s.slice(3).split(/[（(\n]/)[0].trim(), md: s.trim() }))

/** What a line puts in its place; null: no such shared rules, or no such section. */
const textOf = (r: Ref): string | null => {
  const s = sharedOf(r.name)
  if (!s) return null
  if (!r.part) return s.md
  return sectionsOf(s.md).find((x) => x.name === r.part)?.md ?? null
}

/** The document cut at its lines: each line, and the text between them. */
type Seg = { kind: 'ref'; r: Ref } | { kind: 'text'; md: string }
const segments = (md: string): Seg[] => {
  const out: Seg[] = []
  for (const para of md.split(/\n{2,}/)) {
    const r = refOf(para)
    const last = out.at(-1)
    if (r) out.push({ kind: 'ref', r })
    else if (last?.kind === 'text') last.md += '\n\n' + para
    else out.push({ kind: 'text', md: para })
  }
  return out
}

/** The lines whose names are not found, as the editor shows them. */
export const notFound = (md: string) =>
  md
    .split('\n')
    .map(refOf)
    .filter((r): r is Ref => !!r && textOf(r) == null)
    .map((r) => r.label)

/** What an agent gets: each line replaced by its text, every heading of it saying where it came from, a name not
 * found said in its place; first, that the project's own words win. */
export function expanded(md: string, v: number, by: string, t: string): string {
  const body = segments(md).map((s) => {
    if (s.kind === 'text') return s.md
    const got = textOf(s.r)
    if (got == null) return `（找不到共享规则“${s.r.label}”）`
    return got.replace(/^(## .+)$/gm, `$1（来自共享规则“${s.r.name}”）`)
  })
  return [
    `Project rules, version ${v}, ${by}, ${t}. Follow the parts that apply to what you are doing.`,
    '本项目自己写的和共享部分冲突时，以本项目的为准。',
    'To change them, propose: `rules propose <why>`; the user approves or declines.',
    '',
    body.join('\n\n'),
  ].join('\n')
}

// ---------------------------------------------------------------- the documents as the page has them

/** A text as the page has a rules document (its blocks), so the page's DocView reads it. */
function rulesDoc(md: string, d: number, title: string, v: number, by: string, minutes: number): Doc {
  const x: RuleVersion = { v, by, t0: at(minutes + 4), t: at(minutes), md, whys: [], srcs: [], seq: v * 10 }
  return { ...rulesDocOf([x], []), d, title }
}
/** A shared document; 编程's line on heavy tests has a thread. */
const sharedDoc = (s: Shared): Doc => {
  const d = rulesDoc(s.md, s.d, s.name, s.v, s.by, s.ago)
  const b = d.blocks.find((x) => x.text.includes('重测试'))
  if (b)
    b.comments = [
      comment({ id: 11, key: b.key, th: 11, quote: '一天最多一次', text: '整组 e2e 也算在里面吗？', by: 'you', t: at(130) }),
      comment({ id: 12, key: b.key, th: 11, quote: '一天最多一次', text: '算，e2e 就是重测试。', t: at(125) }),
    ]
  return d
}
export const TASKA_VERSION = { v: 6, by: 'you', ago: 12 }
export const taskaSub = (when: (t: string) => string) => `v${TASKA_VERSION.v} · You · ${when(at(TASKA_VERSION.ago))}`

const ruleActs = acts('Rules', ['openShared'] as const, { openShared: 'Prototype › I779 Rules include › Settings: one opened' })

// ---------------------------------------------------------------- the Rules tab: a line read in place

/** A shared document's text, each paragraph drawn by the document's DocBlock with DocView's spacing, so it reads as the
 * text around it. */
function SharedText({ md, world }: { md: string; world: InlineWorld }) {
  return (
    <div className="space-y-3 text-[15px]">
      {md.split(/\n{2,}/).map((t, i) => (
        <div key={i} className="py-1 break-words">
          <DocBlock b={{ kind: /^#/.test(t) ? 'heading' : /^- /.test(t) ? 'list' : 'para', text: t }} title={false} world={world} />
        </div>
      ))}
    </div>
  )
}

/** A line read: "Shared rules · 编程 · 3 projects", the name to its document, a click opens its text in place; a
 * name not found, in red. */
function RefBlock({ r, open, world, onToggle }: { r: Ref; open: boolean; world: InlineWorld; onToggle(): void }) {
  const got = textOf(r)
  const s = sharedOf(r.name)
  if (got == null || !s)
    return (
      <div data-ref-line={r.label} className="flex min-h-10 items-center gap-2 rounded-lg border border-dashed border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-400/40 dark:bg-red-400/10 dark:text-red-300">
        <Icon n="alert" c="size-4 shrink-0" />
        <span className="min-w-0 break-words">Not found: {r.label}</span>
      </div>
    )
  return (
    <div data-ref-line={r.label} className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onToggle())}
        className={`flex min-h-10 cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900 ${open ? 'rounded-t-lg' : 'rounded-lg'} ${MUTED}`}
      >
        <Icon n={open ? 'down' : 'right'} c="size-4 shrink-0" />
        <span className="min-w-0 flex-1">
          Shared rules ·{' '}
          <button
            onClick={(e) => (e.stopPropagation(), ruleActs.openShared(r.name))}
            className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            {r.label}
          </button>{' '}
          · {plural(s.used.length, 'project')}
        </span>
      </div>
      {open ? (
        <div className="border-t border-dashed border-zinc-300 px-3 pt-2 pb-3 dark:border-zinc-700">
          <SharedText md={got} world={world} />
        </div>
      ) : null}
    </div>
  )
}

/** The Rules tab's document: each line a block (`open`: the ones opened), the text between them as the page reads a
 * document (DocView, its comments as usual). */
export function RulesWithLines({ md, desk, world, open: start = [] }: { md: string; desk: boolean; world: InlineWorld; open?: string[] }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set(start))
  const toggle = (k: string) => {
    const next = new Set(open)
    if (!next.delete(k)) next.add(k)
    setOpen(next)
  }
  return (
    <>
      {segments(md).map((s, i) =>
        s.kind === 'ref' ? (
          <div key={i} className={`${RULES_COLUMN} mb-3`}>
            <RefBlock r={s.r} open={open.has(s.r.label)} world={world} onToggle={() => toggle(s.r.label)} />
          </div>
        ) : (
          <Fragment key={i}>{docAt(rulesDoc(s.md, 5 + i, 'Rules', TASKA_VERSION.v, TASKA_VERSION.by, TASKA_VERSION.ago), desk, { viewOnly: true })}</Fragment>
        ),
      )}
    </>
  )
}

// ---------------------------------------------------------------- the editor: the lines as text, Insert shared rules

const editActs = acts('Rules editor', ['discard', 'save', 'mic'] as const)

/** The editor's button of the rules' own: the look of its Speak. */
function ToolBtn({ label, short, btnRef, onClick }: { label: string; short: string; btnRef: React.Ref<HTMLButtonElement>; onClick(): void }) {
  return (
    <button
      ref={btnRef}
      onClick={onClick}
      title={label}
      className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      <Icon n="book" />
      <span className="max-lg:hidden">{label}</span>
      <span className="lg:hidden">{short}</span>
    </button>
  )
}

/** The rules in the page's editor: the lines are words like the rest; Insert shared rules lists the shared documents
 * (and 编程's sections) and puts the line where the caret is, on a line of its own; a name not found is said in red
 * beside the buttons while you write. */
export function RulesEditor({ desk, start, picking: startPicking = false }: { desk: boolean; start: string; picking?: boolean }) {
  const [text, setText] = useState(start)
  const [picking, setPicking] = useState(startPicking)
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null)
  const field = useRef<HTMLTextAreaElement | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const caret = useRef<number | null>(null)
  useLayoutEffect(() => {
    // the caret where the project's own rules start, as if you had clicked there
    const el = field.current
    const i = start.indexOf('## Taska')
    if (el && i >= 0) el.setSelectionRange(i, i)
  }, [start])
  useLayoutEffect(() => {
    // after an insert: the caret after the line put in
    const el = field.current
    if (el && caret.current != null) {
      el.focus()
      el.setSelectionRange(caret.current, caret.current)
      caret.current = null
    }
  }, [text])
  useLayoutEffect(() => {
    // the desktop's list opens under its button, as the page's menus open under theirs
    const b = btn.current
    if (!picking || !desk || spot || !b) return
    const r = inFrame(b.getBoundingClientRect(), b)
    setSpot({ x: r.left, y: r.bottom + 4 })
  }, [picking, desk, spot])
  const insert = (line: string) => {
    const el = field.current
    const i = el ? el.selectionStart : text.length
    const before = text.slice(0, i)
    const after = text.slice(i)
    const pre = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
    const post = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
    caret.current = (before + pre + line + post).length
    setText(before + pre + line + post + after)
    setPicking(false)
  }
  const missing = notFound(text)
  const hint = missing.length ? (
    <span className="flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
      <Icon n="alert" c="size-3.5 shrink-0" />
      Not found: {missing.join(', ')}
    </span>
  ) : desk ? (
    'Esc keeps draft'
  ) : (
    ''
  )
  const has = (line: string) => text.split('\n').some((l) => l.trim() === line)
  const row = (line: string, name: ReactNode, note: string, sub = false) => (
    <button key={line} onClick={() => insert(line)} className={`${MENU_ROW} h-11 ${sub ? 'pl-10' : ''}`}>
      {sub ? null : <Icon n="book" c="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" />}
      <span className={`min-w-0 flex-1 truncate ${sub ? 'text-zinc-600 dark:text-zinc-300' : 'font-medium'}`}>{name}</span>
      {note ? <span className={`shrink-0 text-xs ${MUTED}`}>{note}</span> : null}
      <span className="grid size-4 shrink-0 place-items-center">{has(line) ? <CurrentMark /> : null}</span>
    </button>
  )
  const rows = (
    <div className="-mx-1 flex flex-col">
      {SHARED_RULES.map((s) => {
        const parts = sectionsOf(s.md)
        return (
          <Fragment key={s.name}>
            {row(`{{${s.name}}}`, s.name, plural(s.used.length, 'project'))}
            {parts.length > 1 ? parts.map((p) => row(`{{${s.name} › ${p.name}}}`, `› ${p.name}`, '', true)) : null}
          </Fragment>
        )
      })}
    </div>
  )
  return (
    <>
      <DocEdit
        isNew={false}
        text={text}
        hint={hint}
        mic={{ on: false, text: 'Speak' }}
        tools={<ToolBtn label="Insert shared rules" short="Shared" btnRef={btn} onClick={() => (setSpot(null), setPicking(true))} />}
        fieldRef={(el) => {
          field.current = el
        }}
        on={{ change: setText, discard: editActs.discard, save: editActs.save, mic: editActs.mic }}
      />
      <Sheet open={picking && (!desk || !!spot)} look={desk ? { pop: true, at: spot } : {}} desk={desk} onClose={() => setPicking(false)}>
        <SheetLayout menu title="Insert shared rules" body={rows} />
      </Sheet>
    </>
  )
}

// ---------------------------------------------------------------- Settings › Shared rules

export const SHARED_KEY = 'shared' as SectionKey
const setActs = acts('Shared rules', ['create', 'history', 'copy', 'save', 'discard', 'mic', 'rules'] as const, { rules: "the project's Rules (Prototype › I779 Rules include › Reading: shared rules in place)" })

const changed = (s: Shared) => `changed ${ago(at(s.ago), NOW, 'long')}`
const meta = (s: Shared) => `${plural(s.used.length, 'project')} · ${changed(s)}`

/** Settings with Shared rules last in its column, after Organizer; `open`: one opened. */
export const sharedSection = (open: string | null = null): SettingsHere => ({
  more: {
    key: SHARED_KEY,
    section: { path: 'shared', icon: 'book', name: 'Shared rules', about: () => 'Written once; a line like {{编程}} puts one in a project’s rules.' },
    right: SHARED_RULES.length,
    body: (desk) => <SharedBody desk={desk} start={open} />,
  },
})

/** The shared documents: each its name, how many projects use it, when it last changed; New first (as Projects'). */
function SharedRows({ desk, onOpen }: { desk: boolean; onOpen(name: string): void }) {
  return (
    <>
      {desk ? (
        <section className="flex items-center gap-4 border-t border-zinc-200 py-5 dark:border-zinc-800">
          <button onClick={setActs.create} className={`${SECOND} shrink-0`}>
            <Icon n="plus" c="size-4" sw="2" />
            New shared rules
          </button>
        </section>
      ) : (
        <button onClick={setActs.create} className="flex min-h-12 w-full items-center gap-3 py-2.5 text-left text-[15px] font-medium text-blue-600 dark:text-blue-400">
          <Icon n="plus" c="size-5" />
          New shared rules
        </button>
      )}
      <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {SHARED_RULES.map((s) => (
          <li key={s.name}>
            <button onClick={() => onOpen(s.name)} className={`flex w-full items-center gap-3 text-left ${desk ? 'min-h-16 py-3 hover:opacity-80' : 'px-1 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}>
              <Icon n="book" c="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold break-words">{s.name}</span>
                <span className={`mt-0.5 block truncate text-xs ${MUTED}`}>{meta(s)}</span>
              </span>
              <Icon n="right" c="size-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

/** Who uses it: each project and its line, read only; a row goes to that project's Rules. */
function UsedBy({ s }: { s: Shared }) {
  return (
    <Part title="Used by">
      <ul className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-800">
        {s.used.map((u) => {
          const p = projectOf(u.slug)
          return (
            <li key={u.slug}>
              <button onClick={() => setActs.rules(u.slug)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left hover:opacity-80">
                <ProjTile title={p.title} tone={toneOf(TONES, p.slug)} cls="size-8 rounded-lg text-sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{p.title}</span>
                  <span className={`mt-0.5 block truncate font-mono text-xs ${MUTED}`}>{u.line}</span>
                </span>
                <span className={`shrink-0 text-[13px] ${MUTED}`}>Rules</span>
                <Icon n="right" c="size-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
              </button>
            </li>
          )
        })}
      </ul>
    </Part>
  )
}

/** Settings' Shared rules, as the page would hold it: one opens (the desktop: in the section; the phone: over it, as a
 * document opens) read as the Rules tab reads its document, comments as on any document; Edit opens the same editor
 * (no Insert there: shared rules put in no other); under it, who uses it. */
function SharedBody({ desk, start }: { desk: boolean; start: string | null }) {
  const [open, setOpen] = useState(start)
  const [editing, setEditing] = useState<string | null>(null)
  const s = open ? (sharedOf(open) ?? null) : null
  const close = () => (setOpen(null), setEditing(null))
  const editor =
    s && editing != null ? (
      <DocEdit
        isNew={false}
        text={editing}
        hint={desk ? 'Esc keeps draft' : ''}
        mic={{ on: false, text: 'Speak' }}
        on={{ change: setEditing, discard: () => (setActs.discard(), setEditing(null)), save: () => (setActs.save(), setEditing(null)), mic: setActs.mic }}
      />
    ) : null
  const page = s ? (
    <>
      {/* the desktop's document column is the Rules tab's: as wide as the section, its comments' room beside it */}
      <div className={`mb-6 ${desk && !editor ? '-mx-10' : ''}`}>{editor ?? docAt(sharedDoc(s), desk, { viewOnly: true })}</div>
      {editor ? null : <UsedBy s={s} />}
    </>
  ) : null
  const bar =
    s && !editor ? (
      <>
        <BarBtn icon="history" label="History" onClick={setActs.history} />
        {desk ? <BarBtn icon="copy" label="Copy" onClick={setActs.copy} /> : null}
        <BarBtn icon="pencil" label="Edit" onClick={() => setEditing(s.md)} />
      </>
    ) : null
  const sub = s ? (editor ? 'Editing' : `v${s.v} · ${meta(s)}`) : ''
  if (desk)
    return s ? (
      <>
        <div className="flex items-center gap-2 border-t border-zinc-200 py-4 dark:border-zinc-800">
          <button onClick={close} aria-label="Back to shared rules" title="Back to shared rules · Esc" className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
            <Icon n="left" c="size-5" sw="2.25" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-semibold">{s.name}</h2>
            <p className={`truncate text-xs ${MUTED}`}>{sub}</p>
          </div>
          {bar}
        </div>
        {page}
      </>
    ) : (
      <SharedRows desk onOpen={setOpen} />
    )
  return (
    <>
      <Sheet open={!!s} look={PHONE_DOC_LOOK} desk={false} onClose={close}>
        {s ? <SheetLayout title={s.name} extra={bar} sub={<p className={`px-5 pb-1 text-xs ${MUTED}`}>{sub}</p>} body={page} /> : null}
      </Sheet>
      <SharedRows desk={false} onOpen={setOpen} />
    </>
  )
}

// ---------------------------------------------------------------- what an agent reads

/** The text `rules` gives an agent, in the page's code look. */
export function AgentReads({ world }: { world: InlineWorld }) {
  const t = expanded(TASKA_RULES, TASKA_VERSION.v, TASKA_VERSION.by, '11-13 23:40')
  return (
    <div className="px-8 pt-8 pb-12 text-[15px]">
      <Rich text={'```\n' + t + '\n```'} world={world} />
    </div>
  )
}
