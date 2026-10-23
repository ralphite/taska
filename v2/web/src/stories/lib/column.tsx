// T457 (r680): the column the input box lives in, as on the page: on the desktop the right pane (the New input page
// when nothing is open, else the item or its document) with the box at its foot; on the phone the list, or the open
// item, with the box at the foot of the screen. Every story of the item, its document and the box stands in it. Wide: as
// wide as a full-width item pane (B495: two columns).
import { useLayoutEffect } from 'react'
import { Composer } from '../../components/Composer'
import { DetailView } from '../../components/Detail'
import { InputsView } from '../../components/Inputs'
import { DeskFilters, FilterStrip, Foot, ItemsView, MainHead, Tabs, paneLayout } from '../../components/Shell'
import { Dialog } from '../../components/Sheets'
import { D, U, bump, desk, talkScroller, useArea } from '../../lib/state'
import { Pane } from './demo'

export function Column({ text = '', wide = false }: { text?: string; wide?: boolean }) {
  useArea('list')
  useArea('detail')
  useArea('view')
  useLayoutEffect(() => {
    const t = document.getElementById('text') as HTMLTextAreaElement | null
    if (t && text) {
      t.value = text
      t.dispatchEvent(new Event('input', { bubbles: true }))
    }
    bump('composer', 'feedback')
    // the desktop opens an item at its latest message, as the page does (lib/nav.ts, B279)
    const end = () => {
      const t = talkScroller()
      if (desk() && U.open && !U.doc && t) t.scrollTop = t.scrollHeight
    }
    end()
    const timers = [120, 400, 1000].map((ms) => setTimeout(end, ms))
    return () => timers.forEach(clearTimeout)
  }, [text])
  // which parts show is the page's own rule (paneLayout, the same the page uses), not this story's
  const { v, isDesk } = paneLayout(),
    compose = isDesk && D.compose
  return (
    <Pane w={isDesk ? (wide ? 'wide' : 'item') : 'full'} h="flex h-screen flex-col lg:h-[calc(100dvh-3rem)]">
      {isDesk ? (
        // on the New input page the pane is its head, and the foot (the box and what you said lately) scrolls under it
        <div className={compose ? 'shrink-0' : 'flex min-h-0 flex-1 flex-col'}>
          <DetailView hidden={v.detail} />
        </div>
      ) : (
        <>
          <MainHead hidden={v.mainHead} />
          <Tabs hidden={v.tabs} />
          <FilterStrip />
          <ItemsView hidden={v.items} />
          <InputsView hidden={v.inputs} />
          <DetailView hidden={v.detail} />
        </>
      )}
      <div className={compose ? 'flex min-h-0 flex-1 flex-col [&>footer]:min-h-0 [&>footer]:flex-1' : 'contents'}>
        <Foot hidden={v.foot} wideCls="" />
      </div>
      <Composer />
      <Dialog />
    </Pane>
  )
}

/** The list column as on the page: its head (and on the phone the tabs and, at the foot, the box) around the list,
 * or the Inputs tab, or Documents, Activity, Deleted. */
export function ListColumn() {
  useArea('list')
  useArea('view')
  useLayoutEffect(() => bump('composer', 'feedback'), [])
  // which parts show is the page's own rule (paneLayout); on the phone the list column is the whole screen
  const { v, isDesk } = paneLayout()
  return (
    <Pane w="list" h="flex h-screen flex-col lg:h-[calc(100dvh-3rem)]">
      <MainHead hidden={v.mainHead} />
      <Tabs hidden={v.tabs} />
      {isDesk ? <DeskFilters hidden={v.deskFilters} /> : <FilterStrip />}
      <ItemsView hidden={v.items} />
      <InputsView hidden={v.inputs} />
      {isDesk ? null : (
        <>
          <Foot hidden={v.foot} wideCls="" />
          <Composer />
        </>
      )}
    </Pane>
  )
}
