// Each kind of sheet with the page's data: what it holds and what each of its buttons does. The frame is the
// SheetContainer's.

import type { App } from '../../app/createApp'
import { copyText, forAgent } from '../../app/clipboard'
import { canUndoFiling, organizing } from '../../model/inputs'
import { closed } from '../../model/items'
import { codeOf, type ProjectModel } from '../../model/project'
import type { ProjectRoute } from '../../app/hooks'
import { filtered, visible } from '../../model/visible'
import { inputCode } from '../../model/words'
import type { SheetSpec } from '../../stores/sheet'
import type { SheetParts } from '../../ui/Sheet'
import { toneOf, projectTones } from '../../ui/tones'
import { Thumbs } from '../inputs/Files'
import { useItemWorld } from '../item/ItemPageContainer'
import { filterEvents } from '../project/ProjectPageContainer'
import { filtersSheet } from './Filters'
import { keysSheet, Palette, Switcher } from './Finders'
import { asSaidSheet, historySheet, inputMenuSheet, messageMenuSheet, sourcesSheet } from './InputSheets'
import { itemMenuPop, itemMenuSheet, type ItemMenuEvents } from './ItemMenu'
import { moveParentSheet, pickSheet } from './Pickers'
import { itemMoveProjectSheet, moveInputSheet, type OtherProject } from './ProjectSheets'

export interface SheetCtx {
  app: App
  spec: SheetSpec
  route: ProjectRoute | null
  m: ProjectModel | null
  desk: boolean
  arm: 's' | 'p' | 't' | null
  asked: Readonly<Record<string, number>>
  world: ReturnType<typeof useItemWorld>
}

function others(app: App, slug: string): OtherProject[] {
  const rows = app.stores.data.getState().projects || []
  const tones = projectTones([slug, ...rows.map((p) => p.name)])
  return rows.filter((p) => p.name !== slug).map((p) => ({ slug: p.name, title: p.title || p.name, tone: toneOf(tones, p.name), open: p.open }))
}

/** -> the sheet's parts, and whether it is a menu (no title row on the desktop); null: what it was about is gone. */
export function sheetParts(c: SheetCtx): { parts: SheetParts; menu?: boolean } | null {
  const { app, spec, route, m, desk } = c
  const close = () => app.sheets.close()
  const done = (run: () => void) => () => (close(), run())
  const slug = route?.slug ?? ''
  const code = (n: number) => (m ? codeOf(m, n) : '')
  const p = spec.props
  switch (spec.kind) {
    case 'menu':
    case 'menu-desk': {
      const n = Number(p.n)
      const it = m?.byN.get(n)
      if (!m || !it) return null
      const on: ItemMenuEvents = {
        edit: done(() => {
          app.nav.openItem(code(n))
          app.stores.itemView.getState().setEditing(n)
        }),
        copy: done(() => void copyText(forAgent(it, code(n), m.facts.base)).then(() => app.toasts.show('Copied'))),
        newDoc: done(() => {}),
        addSub: done(() => {
          app.nav.openItem(code(n))
          app.stores.itemView.getState().setSubFor(n)
        }),
        reparent: () => app.sheets.open('move', { n }, { pop: desk, focus: false, at: spec.at }),
        later: done(() => void app.items.change(n, 'when', it.when === 'now' ? 'later' : 'now')),
        archive: (on) => {
          close()
          void app.items.change(n, 'archived', on, { note: on ? 'Find it under Archive' : '' })
          if (on && route?.place.kind === 'item') app.nav.closeItem()
        },
        doNext: done(() => void app.items.doNext(n)),
        moveProject: () => (others(app, slug).length ? app.sheets.open('item-move-proj', { n }, { focus: false }) : (close(), app.toasts.show('No other project to move to'))),
        remove: () => {
          if (!app.sheets.confirm('item-delete ' + n)) return
          close()
          void app.items.remove(n)
          if (route?.place.kind === 'item') app.nav.closeItem()
        },
        set: (f, v) => {
          if (p.arm || c.arm) close()
          void app.items.change(n, f, v)
        },
      }
      const facts = { it, code: code(n), parentCode: it.parent ? code(it.parent) : null, asking: !!c.asked['item-delete ' + n], arm: (p.arm as 's' | 'p' | 't' | null) ?? c.arm }
      return spec.kind === 'menu-desk' ? { parts: itemMenuPop(facts, on), menu: true } : { parts: itemMenuSheet(facts, on) }
    }
    case 'filters': {
      if (!m || !route) return null
      const rows = visible(m.items, route.tab, route.list)
      return {
        parts: filtersSheet(
          { tab: route.tab, list: route.list, filtered: filtered(route.tab, route.list), shown: rows.length, open: rows.filter((it) => !closed(it.status) && !it.archived).length },
          { ...filterEvents(app), close },
        ),
      }
    }
    case 'keys':
      return { parts: keysSheet() }
    case 'move': {
      const it = m?.byN.get(Number(p.n))
      if (!m || !it) return null
      return { parts: moveParentSheet({ it, items: m.items, kids: m.kids, code, desk }, (to) => (close(), void app.items.change(it.n, 'parent', to))) }
    }
    case 'pick': {
      if (!m) return null
      const run = p.run as (n: number) => void
      return { parts: pickSheet({ head: String(p.head), items: m.items, skip: (p.skip as number[]) || [], code, desk }, (n) => (close(), run(n))) }
    }
    case 'item-move-proj': {
      const it = m?.byN.get(Number(p.n))
      if (!m || !it) return null
      return {
        parts: itemMoveProjectSheet({ code: code(it.n), others: others(app, slug) }, (to) => {
          close()
          void app.moves.item(slug, it.n, to)
        }),
      }
    }
    case 'move-input': {
      const r = m?.byId.get(String(p.id))
      if (!m || !r) return null
      const made = r.touched.filter((n) => n !== r.scope && m.byN.has(n) && !m.byN.get(n)?.archived)
      return {
        parts: moveInputSheet(
          {
            code: inputCode(r.id),
            words: r.text || `${r.files.length} file${r.files.length === 1 ? '' : 's'}`,
            others: others(app, slug),
            made: made.map((n) => `${code(n)} ${m.byN.get(n)?.title}`),
            byOrganizer: !!(r.org && r.org.ok && !r.org.undone && !r.org.keep),
            scope: r.scope && m.byN.has(r.scope) ? code(r.scope) : null,
          },
          (to) => void app.inputActions.move(slug, r.id, to).then((ok) => ok && close()),
        ),
      }
    }
    case 'input-menu': {
      const r = m?.byId.get(String(p.id))
      if (!m || !r) return null
      const id = r.id
      const busy = organizing(r, m.facts.organizer)
      const asking = r.files.find((f) => c.asked[`unfile ${id} ${f.f}`])?.f ?? null
      return {
        parts: inputMenuSheet(
          {
            r,
            tidy: true,
            undo: canUndoFiling(r) ? { tip: `${inputCode(id)}: ${r.filing?.what || ''}` } : null,
            move: others(app, slug).length > 0 && !busy,
            history: !!r.history?.length,
            scope: r.scope ? code(r.scope) : null,
            asking,
            deleteTip:
              `Delete ${inputCode(id)}` +
              (r.deletion?.go.length ? ` and ${r.deletion.go.map(code).join(', ')}` : '') +
              (r.deletion?.keep.length ? `; ${r.deletion.keep.map(([n, why]) => `${code(n)} stays: ${why}`).join('; ')}` : ''),
          },
          {
            edit: done(() => app.box.amendStart(slug, m, id, 'edit')),
            append: done(() => app.box.amendStart(slug, m, id, 'append')),
            asSaid: (f) => void app.api.words(slug, f).catch(() => app.api.words(slug, f, true)).then((w) => app.sheets.open('as-said', { heard: w.heard || '', tr: w.tr || '' }, desk ? { pop: true, focus: false } : {})),
            undo: done(() => app.inputActions.undoFiling(slug, id)),
            move: () => app.sheets.open('move-input', { id }),
            history: () => app.sheets.open('history', { id }),
            rescope: () => app.sheets.open('pick', { head: `Put ${inputCode(id)} with…`, skip: r.scope ? [r.scope] : [], run: (n: number) => app.inputActions.rescope(slug, id, code(n), r.scope ? code(r.scope) : null) }, { focus: false }),
            takeOff: (f) => {
              if (!app.sheets.confirm(`unfile ${id} ${f}`)) return
              close()
              app.inputActions.takeOff(slug, id, f)
            },
            remove: done(() => app.inputActions.remove(slug, id)),
          },
        ),
      }
    }
    case 'history': {
      const r = m?.byId.get(String(p.id))
      return m && r ? { parts: historySheet(r, m.at) } : null
    }
    case 'sources': {
      const it = m?.byN.get(Number(p.n))
      if (!m || !it) return null
      const inputs = it.srcs.map((id) => m.byId.get(id)).filter((r) => r && r.kind !== 'answer') as NonNullable<ReturnType<typeof m.byId.get>>[]
      return {
        parts: sourcesSheet(
          {
            code: code(it.n),
            inputs,
            world: c.world,
            now: m.at,
            files: (f) => <Thumbs files={f} url={c.world.url} play={() => ({ playing: false, t: null })} tidy on={{ play() {}, words() {}, view() {} }} />,
          },
          () => close(),
        ),
      }
    }
    case 'as-said':
      return { parts: asSaidSheet(String(p.heard || ''), String(p.tr || '')), menu: true }
    case 'msg-menu': {
      const n = Number(p.n)
      const id = Number(p.id)
      if (!m || !m.byN.has(n)) return null
      return { parts: messageMenuSheet(done(() => void app.runner.send({ id: 'h' + Date.now().toString(36), slug, commands: [{ op: 'hide', ref: code(n), id, on: true }], patches: [], said: `hiding a message on ${code(n)}`, t: Date.now() }))) }
    }
    case 'switch': {
      const rows = app.stores.data.getState().projects
      const tones = projectTones([slug, ...(rows || []).map((x) => x.name)])
      const list = (rows || []).map((x) => ({ slug: x.name, title: x.title || x.name, tone: toneOf(tones, x.name), needs: x.needs, here: x.name === slug }))
      return { parts: { title: 'Switch project', body: <Switcher rows={list} loading={!rows} onOpen={(s) => (close(), app.nav.to(`/p/${encodeURIComponent(s)}/`))} /> } }
    }
    case 'palette': {
      const open = route?.place.kind === 'item' && m ? m.byN.get(Number(/\d+/.exec(route.place.ref)?.[0]))?.n ?? null : null
      return {
        parts: {
          title: 'Go to or do',
          body: (
            <Palette
              items={m?.items || []}
              code={code}
              open={open}
              onItem={(n) => (close(), app.nav.openItem(code(n)))}
              onKeys={(keys) => {
                close()
                ;(document.activeElement as HTMLElement | null)?.blur()
                requestAnimationFrame(() => {
                  for (const key of keys.split(' ')) document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
                })
              }}
            />
          ),
        },
      }
    }
  }
  return null
}
