// T457 (r680): the column the input box lives in, as on the page: on the desktop the right pane (the New input page
// when nothing is open, else the item or its document) with the box at its foot; on the phone the list, or the open
// item, with the box at the foot of the screen. Every story of the item, its document and the box stands in it. Wide: as
// wide as the window, as a full-width item pane is (B495: two columns).
import { useLayoutEffect } from 'react'
import { Composer } from '../../components/Composer'
import { DetailView } from '../../components/Detail'
import { List } from '../../components/List'
import { InputsView } from '../../components/Inputs'
import { Foot, MainHead, Tabs } from '../../components/Shell'
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
  const isDesk = desk(),
    compose = isDesk && D.compose
  return (
    <Pane w={isDesk && !wide ? 'item' : 'full'} h="flex h-screen flex-col lg:h-[calc(100dvh-3rem)]">
      {isDesk || U.open ? (
        // on the New input page the pane is its head, and the foot (the box and what you said lately) scrolls under it
        <div className={compose ? 'shrink-0' : 'flex min-h-0 flex-1 flex-col'}>
          <DetailView hidden={false} />
        </div>
      ) : (
        <>
          <MainHead hidden={false} />
          <Tabs hidden={false} />
          <List />
        </>
      )}
      <div className={compose ? 'flex min-h-0 flex-1 flex-col [&>footer]:min-h-0 [&>footer]:flex-1' : 'contents'}>
        <Foot hidden={false} wideCls="" />
      </div>
      <Composer />
      <Dialog />
    </Pane>
  )
}

/** The list column as on the page: its head (and on the phone the tabs and, at the foot, the box) around the list,
 * or around the Inputs tab. */
export function ListColumn({ inputs = false }: { inputs?: boolean }) {
  useArea('list')
  useArea('view')
  useLayoutEffect(() => bump('composer', 'feedback'), [])
  const phone = !desk()
  return (
    <Pane w="list" h="flex h-screen flex-col lg:h-[calc(100dvh-3rem)]">
      <MainHead hidden={false} />
      {phone ? <Tabs hidden={false} /> : null}
      {inputs ? <InputsView hidden={false} /> : <List />}
      {phone ? (
        <>
          <Foot hidden={false} wideCls="" />
          <Composer />
        </>
      ) : null}
    </Pane>
  )
}
