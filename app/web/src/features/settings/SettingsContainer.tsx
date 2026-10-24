// Settings with the page's data: on the desktop its column of sections and the section beside it; on the phone its
// index, or one section's page (Documents, Activity and Deleted are pages here too). It loads what a section shows
// when the section opens; what you do goes to app.settings (and app.docs, app.restores for the phone's lists).

import { useEffect, useMemo, type ReactNode } from 'react'
import { Notices } from '../../app/project/notices'
import { useLayout, useServices, useStores, useStoreValue } from '../../app/context'
import { usePaneRef } from '../../app/panes'
import { useProjectModel, type ProjectRoute } from '../../app/hooks'
import { logSentence } from '../../model/activity'
import { agentState, agoLong } from '../../model/agents'
import { closed, inQueue } from '../../model/items'
import { codeOf, liveN } from '../../model/project'
import { dayShort, when } from '../../model/time'
import { AGENT_NAME, inputCode, plural, whoName } from '../../model/words'
import { toneOf } from '../../ui/tones'
import { listedCommentCount } from '../../model/docs'
import { useSideProjects } from '../../app/projectLists'
import { DeletedBody, DocsBody, LogBody, PhoneProjectsBody } from './PhoneSections'
import { AgentsBody, NotificationsBody, OrganizerBody, PhoneBody, PhonePushBody, ProjectsBody, SpellingsBody, type ProjectsEvents, type ProjectsFacts } from './Sections'
import { SECTIONS, sectionOf, type SectionKey } from './sectionList'
import { DeskNav, PhoneIndex, type NavFacts } from './SettingsNav'
import { Loading, PhHead } from './SettingsParts'

const standalone = () => typeof matchMedia !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true)

/** `prefsBox`: the box the transcription rules are edited in (the desktop's) */
export function SettingsContainer({ route, place, prefsBox }: { route: ProjectRoute; place: string; prefsBox: ReactNode }) {
  const app = useServices('activity', 'docs', 'nav', 'notices', 'restores', 'settings', 'sheets')
  const stores = useStores('activity', 'box', 'data', 'settings', 'sheet')
  const pane = usePaneRef('settings')
  const desk = useLayout() === 'desk'
  const m = useProjectModel(route.slug)
  const st = useStoreValue(stores.settings, (s) => s)
  const asked = useStoreValue(stores.sheet, (s) => s.asked)
  const projects = useStoreValue(stores.data, (s) => s.projects)
  const mode = useStoreValue(stores.box, (s) => s.mode)
  const activity = useStoreValue(stores.activity, (s) => (s.slug === route.slug ? s : null))
  const cursor = useStoreValue(stores.data, (s) => s.copies[route.slug]?.cursor ?? '')
  const { list: side, tones } = useSideProjects(route.slug)
  const phoneList = !desk && route.place.kind === 'side' ? route.place.side : null
  const sec: SectionKey | null = phoneList ?? (route.place.kind === 'settings' ? sectionOf(route.place.section, desk) : null)
  const title = m?.facts.title || route.slug
  const s = app.settings

  useEffect(() => {
    // what a section shows is asked for when it opens (Agents: the guide; the projects and spellings once)
    if (sec === 'agents') void s.loadGuide(route.slug)
    if (!stores.settings.getState().fixes) void s.loadSpellings()
    if (sec === 'projects' || !stores.settings.getState().deleted) void s.loadProjects()
  }, [app, stores, s, sec, route.slug])
  useEffect(() => {
    if (sec === 'log' && cursor) void app.activity.show(route.slug, cursor)
  }, [app, sec, route.slug, cursor])

  const href = (k: SectionKey) => `/p/${encodeURIComponent(route.slug)}/${SECTIONS[k].path}`
  const open = (k: SectionKey) => app.nav.to(href(k))
  const back = () => app.nav.settingsBack()

  const agents = useMemo(() => {
    if (!m) return null
    const [tone, , line] = agentState(m.facts.agents, m.facts.work, m.at)
    const live = m.items.filter((it) => !it.mergedInto && !it.archived && it.type !== 'rule')
    const base = m.facts.base
    const ask = `This project tracks work in Taska. Run \`curl -s ${base}/agent\` to learn the interface, then follow \`curl -s ${base}/next\` and write your progress back to the items.`
    return {
      tone,
      line,
      queue: live.filter((it) => inQueue(it) && it.status !== 'doing' && it.when === 'now').length,
      later: live.filter((it) => it.when === 'later' && !closed(it.status)).length,
      seen: [...m.facts.agents].sort((a, b) => b.t - a.t).map((a) => ({ name: a.name, who: whoName(a.name), when: a.waiting ? 'waiting for work' : agoLong(a.t, m.at), known: a.name in AGENT_NAME && a.name !== 'agent' })),
      cmd: `curl -s ${base}/connect | sh`,
      far: m.facts.remote && m.facts.remote !== base ? `curl -s ${m.facts.remote}/connect | sh` : '',
      ask,
      guide: st.guide?.slug === route.slug ? st.guide.text : null,
    }
  }, [m, st.guide, route.slug])

  const nav: NavFacts = {
    title,
    tone: toneOf(tones, route.slug),
    agentTone: m ? agentState(m.facts.agents, m.facts.work, m.at)[0] : 'idle',
    right: {
      notifications: desk ? app.notices.state().replace('Blocked by the browser', 'Blocked') : app.notices.sub ? 'On' : 'Off',
      agents: m ? agentState(m.facts.agents, m.facts.work, m.at)[1] : '',
      projects: projects ? projects.length : '',
      spellings: st.fixes?.length || '',
      organizer: m?.facts.organizer.on ? 'On' : 'Off',
    },
  }

  const projectsFacts: ProjectsFacts = {
    live: projects && side ? side.map((p) => ({ name: p.slug, title: p.title, tone: p.tone, open: typeof p.open === 'number' ? p.open : 0, here: p.current })) : null,
    gone: (st.deleted || []).map((d) => ({ name: d.name, title: d.title, when: dayShort(d.t), items: d.items })),
    file: m?.facts.file || '',
    pNew: st.pNew,
    pNewText: st.pNewText,
    pErr: st.pErr,
    renaming: st.renaming,
    purging: new Set(Object.keys(asked).filter((k) => k.startsWith('purge ')).map((k) => k.slice(6))),
    menu: st.pMenu,
  }
  const projectsOn: ProjectsEvents = {
    newProject: (on) => s.newProject(on),
    create: (t) => void s.create(t),
    rename: (slug) => s.rename(slug),
    saveRename: (slug, t, was) => void s.saveRename(slug, t, was),
    remove: (slug) => void s.remove(slug, route.slug),
    restore: (slug) => void s.restore(slug),
    purge: (slug) => void s.purge(slug),
    menu: (k) => s.menu(k),
    open: (slug) => app.nav.to(`/p/${encodeURIComponent(slug)}/`),
  }

  const body = (k: SectionKey): ReactNode => {
    if (!m) return <Loading />
    switch (k) {
      case 'agents':
        return agents ? <AgentsBody f={agents} connect={route.place.kind === 'settings' && route.place.section === 'connect'} onCopy={(t) => s.copy(t)} /> : <Loading />
      case 'projects':
        return desk ? <ProjectsBody f={projectsFacts} on={projectsOn} /> : <PhoneProjectsBody f={projectsFacts} on={projectsOn} />
      case 'phone':
        return <PhoneBody link={m.facts.remote ? m.facts.remote + '/' : ''} keyText={m.facts.key} asking={!!asked['new-key']} desk={desk} on={{ copy: (t) => s.copy(t), newKey: () => void s.newKey(route.slug) }} />
      case 'notifications':
        return desk ? (
          <NotificationsBody state={app.notices.state()} quiet={app.notices.quiet()} on={{ turnOn: () => void app.notices.turnOn(), quiet: () => app.notices.setQuiet(!app.notices.quiet()) }} />
        ) : (
          (() => {
            // on the Home Screen with a push service: this phone's pushes (asked once)
            if (!standalone() || !Notices.pushable()) return <PhonePushBody standalone={standalone()} onPhone={() => open('phone')} phoneHref={href('phone')} />
            if (app.notices.sub === undefined) {
              void app.notices.pushState()
              return <Loading />
            }
            const push = { sub: !!app.notices.sub, blocked: Notification.permission === 'denied', quiet: app.notices.quiet(), on: { turnOn: () => void app.notices.pushOn(), turnOff: () => void app.notices.pushOff(), quiet: () => app.notices.setQuiet(!app.notices.quiet()) } }
            return <PhonePushBody standalone onPhone={() => open('phone')} push={push} />
          })()
        )
      case 'spellings':
        return (
          <SpellingsBody
            fixes={st.fixes}
            prefs={st.prefs}
            editing={mode?.kind === 'prefs'}
            prefsSlot={desk ? prefsBox : null}
            on={{ editPrefs: () => s.editPrefs(route.slug), toggleTidy: () => void s.toggleTidy(), addWord: (w) => s.addWord(w), forget: (c) => void s.forget(c) }}
          />
        )
      case 'organizer':
        return <OrganizerBody on={m.facts.organizer.on} model={m.facts.organizer.model} />
      case 'docs':
        return (
          <DocsBody
            docs={[...m.docs].sort((a, b) => b.d - a.d).map((d) => {
              const it = m.byN.get(liveN(m, d.n))
              return { d: d.d, title: d.title, web: d.fmt === 'html', on: it ? `${codeOf(m, it.n)} ${it.title}` : '', comments: listedCommentCount(d) }
            })}
            onOpen={(d) => app.docs.open(d)}
          />
        )
      case 'log':
        return (
          <LogBody
            rows={activity?.rows ? activity.rows.map((e) => ({ s: logSentence(m, e), undo: m.facts.undo.find((u) => u.seq === e.seq)?.seq ?? null })) : null}
            end={!!activity?.end}
            asking={new Set(Object.keys(asked).filter((x) => x.startsWith('revert ')).map((x) => Number(x.slice(7))))}
            on={{
              item: (n) => app.nav.openItem(codeOf(m, n)),
              input: () => app.nav.newInput(),
              undo: (seq) => app.sheets.confirm('revert ' + seq) && void app.restores.revert(route.slug, seq),
              more: () => void app.activity.more(route.slug),
            }}
          />
        )
      case 'deleted':
        return (
          <DeletedBody
            things={m.facts.deleted.map((x) => ({
              label: x.kind === 'item' ? x.code || '' : `D${x.d}`,
              title: x.title,
              what: x.kind === 'item' ? `Item${x.more ? `, with ${plural(x.more, 'subitem')}` : ''}` : `Document${x.on ? ` on ${x.on}` : ''}`,
              at: when(x.at, m.at),
            }))}
            inputs={m.facts.deletedInputs.map((x) => ({ id: x.id, code: inputCode(x.id), t: when(x.t, m.at), at: when(x.at, m.at), text: x.text || (x.files ? plural(x.files, 'file') : ''), items: x.items }))}
            on={{
              restore: (label) => (/^D\d+$/.test(label) ? void app.restores.doc(route.slug, Number(label.slice(1))) : void app.restores.item(route.slug, label)),
              restoreInput: (id) => app.restores.input(route.slug, id),
            }}
          />
        )
    }
  }

  const k = sec ?? 'agents'
  return (
    <section
      data-part="settings"
      aria-label="Settings"
      className={`flex min-h-0 flex-1 flex-col bg-zinc-100 lg:flex-row lg:overflow-hidden lg:bg-transparent dark:bg-zinc-950 dark:lg:bg-transparent ${place}`}
    >
      <nav
        hidden={!desk && !!sec}
        aria-label="Sections of Settings"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-10 lg:w-60 lg:flex-none lg:shrink-0 lg:scrollbar-thin lg:border-r lg:border-zinc-200 lg:pb-4 dark:lg:border-zinc-800"
      >
        {desk ? <DeskNav current={k} back={app.nav.cameFromLabel()} f={nav} on={{ open, back, keys: () => app.sheets.open({ kind: 'keys' }), href }} /> : sec ? null : <PhoneIndex f={nav} on={{ open, back, href }} />}
      </nav>
      <div
        ref={pane}
        hidden={!desk && !sec}
        className={`min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain lg:scrollbar-gutter-both lg:hover:scrollbar-thumb-zinc-500/80 dark:lg:hover:scrollbar-thumb-zinc-400/70 ${mode?.kind === 'prefs' ? 'pb-64' : ''}`}
      >
        {!desk ? (
          sec ? (
            <>
              <PhHead title={SECTIONS[sec].name} onBack={back} />
              <p className="px-5 pt-1 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">{SECTIONS[sec].about(title)}</p>
              {sec === 'projects' ? body(sec) : <div className="mx-3 mt-4 rounded-2xl bg-white px-4 dark:bg-zinc-900 [&>:first-child]:border-t-0 [&>:last-child]:border-b-0">{body(sec)}</div>}
              <div className="h-10" />
            </>
          ) : null
        ) : (
          <div className="mx-auto w-full max-w-[46rem] px-8 pt-9 pb-16">
            <header className="pb-6">
              <h1 className="text-[22px] leading-tight font-semibold tracking-tight">{SECTIONS[k].name}</h1>
              <p className="mt-2 text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">{SECTIONS[k].about(title)}</p>
            </header>
            {body(k)}
          </div>
        )}
      </div>
    </section>
  )
}
