// The sheet of every key and the project switcher, with the page's data.

import { useServices } from '../../app/context'
import { useProjectRoute } from '../../app/hooks'
import type { SheetRequest } from '../../stores/sheet'
import { SheetLayout } from '../../ui/Sheet'
import { useSideProjects } from '../../app/projectLists'
import { keyHelp } from '../../app/actions'
import { keysSheet, Switcher } from './Finders'

type Req<K extends SheetRequest['kind']> = { req: Extract<SheetRequest, { kind: K }> }

export function KeysSheet(_: Req<'keys'>) {
  return <SheetLayout {...keysSheet(keyHelp())} />
}

export function SwitchProjectSheet(_: Req<'switch-project'>) {
  const app = useServices('nav', 'sheets')
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
