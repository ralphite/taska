// The project page (B496, r749): the window's width picks its layout, the desktop's or the phone's, and nothing else
// does. The two never share layout code; they draw the same parts. What floats over the page (the box, sheets, the
// picture viewer, tips, toasts) is the same on both and stays as the layout changes, so nothing you were writing goes.
import { useLayoutEffect } from 'react'
import { D, desk, model, needsYou, projTitle, useTick } from '../lib/state'
import { PSEC } from '../lib/settings-data'
import { Composer, VcBar } from '../components/Composer'
import { Dialog } from '../components/Sheets'
import { Tip, Toast, Viewer } from '../components/Shell'
import { DeskLayout } from './DeskLayout'
import { PhoneLayout } from './PhoneLayout'

export function ProjectPage() {
  useTick((s) => s.view + s.head + s.project)
  const S = model.S
  useLayoutEffect(() => {
    const waiting = S.items.filter(needsYou).length,
      sec = D.page ? (D.section ? PSEC[D.section][2] : 'Settings') + ' · ' : ''
    document.title = (waiting ? `(${waiting}) ` : '') + sec + (S.project ? `${projTitle()} · Taska` : 'Taska')
  })
  return (
    <>
      {desk() ? <DeskLayout /> : <PhoneLayout />}
      <Composer />
      <Dialog />
      <Viewer />
      <Tip />
      <VcBar />
      <Toast />
    </>
  )
}
