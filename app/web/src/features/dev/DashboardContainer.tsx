// The dashboard with the page: it asks Taska for the range shown (kept in the address, ?days=), and the page's title
// says what it is.

import { useEffect, useState } from 'react'
import { useApp } from '../../app/context'
import type { Dash } from '../../model/dashboard'
import { Dashboard } from './Dashboard'

export function DashboardContainer() {
  const app = useApp()
  const [range, setRange] = useState(() => new URLSearchParams(location.search).get('days') || '7')
  const [d, setD] = useState<Dash | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    document.title = 'Dashboard · Taska'
    let gone = false
    app.api
      .devDashboard(range)
      .then((x) => {
        if (gone) return
        setD(x)
        setErr('')
      })
      .catch((e: Error) => !gone && setErr(e.message))
    history.replaceState(null, '', `?days=${range}`)
    return () => {
      gone = true
    }
  }, [app, range])
  return <Dashboard d={d} err={err} range={range} onRange={setRange} />
}
