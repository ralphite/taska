// The dashboard with the page: it asks Taska for the range shown (kept in the address, ?days=), and the page's title
// says what it is.

import { useEffect, useState } from 'react'
import { useServices } from '../../app/context'
import type { Dash } from '../../model/dashboard'
import { Dashboard } from './Dashboard'

export function DashboardContainer() {
  const app = useServices('api')
  const [range, setRange] = useState(() => new URLSearchParams(location.search).get('days') || '7')
  const [d, setD] = useState<Dash | null>(null)
  const [err, setErr] = useState('')
  // which rounds of work the chart shows, and when it is (now, as the page last drew it)
  const [rounds, setRounds] = useState('last20')
  const [now, setNow] = useState(0)
  useEffect(() => {
    document.title = 'Dashboard · Taska'
    let gone = false
    app.api
      .devDashboard(range)
      .then((x) => {
        if (gone) return
        setD(x)
        setNow(Date.now())
        setErr('')
      })
      // as Taska answered (its status), or the browser's own words when nothing came back
      .catch((e: Error & { status?: number; detail?: string }) => !gone && setErr(e.status ? `Taska answered ${e.status}` : e.detail || e.message))
    history.replaceState(null, '', `?days=${range}`)
    return () => {
      gone = true
    }
  }, [app, range])
  return <Dashboard d={d} err={err} range={range} onRange={setRange} rounds={rounds} now={now} onRounds={(r) => (setRounds(r), setNow(Date.now()))} />
}
