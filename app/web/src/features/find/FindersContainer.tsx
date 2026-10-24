// Finding by typing, with the page's data: the sheet of every key, the project switcher, and the command palette
// (an item, or what a key does here: its keys are pressed again once the palette has closed).

import { useApp } from '../../app/context'
import { useProjectModel, useProjectRoute } from '../../app/hooks'
import { codeOf } from '../../model/project'
import type { SheetRequest } from '../../stores/sheet'
import { SheetLayout } from '../../ui/Sheet'
import { useSideProjects } from '../sidebar/SidebarContainer'
import { keysSheet, Palette, Switcher } from './Finders'

type Req<K extends SheetRequest['kind']> = { req: Extract<SheetRequest, { kind: K }> }

export function KeysSheet(_: Req<'keys'>) {
  return <SheetLayout {...keysSheet()} />
}

export function SwitchProjectSheet(_: Req<'switch-project'>) {
  const app = useApp()
  const slug = useProjectRoute()?.slug ?? ''
  // in your order, as the sidebar lists them
  const { list: side } = useSideProjects(slug)
  const list = (side || []).map((x) => ({ slug: x.slug, title: x.title, tone: x.tone, needs: x.needs, here: x.current }))
  const open = (s: string) => {
    app.sheets.close()
    app.nav.to(`/p/${encodeURIComponent(s)}/`)
  }
  return <SheetLayout title="Switch project" body={<Switcher rows={list} loading={!side} onOpen={open} />} />
}

export function PaletteSheet(_: Req<'palette'>) {
  const app = useApp()
  const route = useProjectRoute()
  const m = useProjectModel(route?.slug ?? '')
  const code = (n: number) => (m ? codeOf(m, n) : '')
  const open = route?.place.kind === 'item' && m ? (m.byN.get(Number(/\d+/.exec(route.place.ref)?.[0]))?.n ?? null) : null
  const close = () => app.sheets.close()
  return (
    <SheetLayout
      title="Go to or do"
      body={
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
      }
    />
  )
}
