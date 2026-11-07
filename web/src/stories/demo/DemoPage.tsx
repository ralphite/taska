// A Demo's page (T589): the real page, whole, as main.tsx starts it, inside a Demo's frame of its own; only its
// surroundings are the Demo's (frameEnv.ts). Its network is the replay of a real server's answers, or, while
// web/scripts/record-demo.mjs records, that script's hook. It is the one place a story loads the app
// (scripts/check-architecture.mjs).

import { useEffect, useState } from 'react'
import { AppProvider, type Layout } from '../../app/context'
import { createApp } from '../../app/createApp'
import { installPressFeedback } from '../../app/press'
import { App } from '../../pages/App'
import { PAGE_BODY } from './pageBody'
import type { Demo } from './demos'
import { fixClock, fixMic, frameEnv, lockNetwork, recordingTransport, type DemoNet } from './frameEnv'
import { replay, type ReplayLog } from './replay'

type Win = Window & typeof globalThis & { __demoNet?: DemoNet; __demoLog?: ReplayLog }

/** Makes the page's surroundings in this frame, then the app. */
function start(demo: Demo, layout: Layout, record: boolean) {
  const w = window as Win
  fixClock(w, demo.now)
  fixMic(w, demo.clip)
  // the network: the recording script's hook while it records (only it can give one), else the replay
  const net = record ? w.__demoNet : undefined
  let transport
  if (net) transport = recordingTransport(net)
  else {
    const r = replay(demo.recordings[layout])
    w.__demoLog = r.log
    transport = r.transport
  }
  lockNetwork(w)
  // the page's own body, as index.html gives it
  document.body.className = PAGE_BODY
  installPressFeedback()
  return createApp(frameEnv(transport, demo.start, layout === 'desk'))
}

export function DemoPage({ demo, layout, record }: { demo: Demo; layout: Layout; record: boolean }) {
  const [app] = useState(() => start(demo, layout, record))
  useEffect(() => () => app.stop(), [app])
  return (
    <AppProvider app={app}>
      <App />
    </AppProvider>
  )
}
