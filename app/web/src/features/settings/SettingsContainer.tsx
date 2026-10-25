// Settings with the page's data: on the desktop its column of sections and the section beside it; on the phone its
// index, or one section's page (Documents, Activity and Deleted are pages here too). It loads what a section shows
// when the section opens; what you do goes to app.settings (and app.docs, app.restores for the phone's lists).

import { useEffect, useMemo, type ReactNode } from 'react'
import { Notices } from '../../app/project/notices'
import { useLayout, useServices, useStores, useStoreValue } from '../../app/context'
import { usePaneRef } from '../../app/panes'
import { useProjectModel, type ProjectRoute } from '../../app/hooks'
import { codeOf } from '../../model/project'
import { toneOf } from '../../ui/tones'
import { useSideProjects } from '../../app/projectLists'
import { DeletedBody, DocsBody, LogBody, PhoneProjectsBody } from './PhoneSections'
import { AgentsBody, NotificationsBody, OrganizerBody, PhoneBody, PhonePushBody, ProjectsBody, SpellingsBody, type ProjectsEvents } from './Sections'
import { SECTIONS, sectionOf, type SectionKey } from './sectionList'
import { DeskNav, PhoneIndex } from './SettingsNav'
import { Loading } from './SettingsParts'
import { SettingsFrame } from './SettingsFrame'
import { agentsFacts, deletedRows, docRows, logRows, navFacts, projectsOf } from './settingsFacts'

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

  const agents = useMemo(() => (m ? agentsFacts(m, st.guide?.slug === route.slug ? st.guide.text : null) : null), [m, st.guide, route.slug])

  const nav = navFacts(m, title, toneOf(tones, route.slug), {
    notifications: desk ? app.notices.state().replace('Blocked by the browser', 'Blocked') : app.notices.sub ? 'On' : 'Off',
    projects: projects ? projects.length : '',
    spellings: st.fixes?.length || '',
  })


  const projectsFacts = projectsOf(projects, side, st, asked, m?.facts.file || '')
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
            docs={docRows(m)}
            onOpen={(d) => app.docs.open(d)}
          />
        )
      case 'log':
        return (
          <LogBody
            rows={activity?.rows ? logRows(m, activity.rows) : null}
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
            {...deletedRows(m)}
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
    <SettingsFrame
      desk={desk}
      sec={sec}
      title={title}
      place={place}
      prefs={mode?.kind === 'prefs'}
      paneRef={pane}
      nav={desk ? <DeskNav current={k} back={app.nav.cameFromLabel()} f={nav} on={{ open, back, keys: () => app.sheets.open({ kind: 'keys' }), href }} /> : sec ? null : <PhoneIndex f={nav} on={{ open, back, href }} />}
      body={body(k)}
      onBack={back}
    />
  )
}
