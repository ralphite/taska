// Help with the page's data: the topic its address names, a search kept while the page is open, and the way back
// (as Settings has it). Keyboard shortcuts are the page's own keys.

import { useState } from 'react'
import { useLayout, useServices } from '../../app/context'
import { keyHelp } from '../../app/actions'
import type { ProjectRoute } from '../../app/hooks'
import { Rich } from '../../ui/Markdown'
import type { InlineWorld } from '../../ui/markdown/inline'
import { HelpPage, KeyTable } from './HelpPage'
import { searchHelp, shownTopic } from './topics'

/** Help's words name no item and hold no file. */
const WORLD: InlineWorld = { find: () => null, url: () => '', size: () => undefined }

export function HelpContainer({ route, place }: { route: ProjectRoute; place: string }) {
  const app = useServices('nav')
  const desk = useLayout() === 'desk'
  const [q, setQ] = useState('')
  const key = route.place.kind === 'help' ? route.place.topic : null
  const topic = shownTopic(key, desk)
  const href = (k: string) => `/p/${encodeURIComponent(route.slug)}/help/${k}`
  return (
    <HelpPage
      desk={desk}
      topic={topic}
      q={q}
      found={searchHelp(q)}
      back={app.nav.cameFromLabel()}
      place={place}
      body={
        topic ? (
          <>
            <Rich text={topic.text} world={WORLD} />
            {topic.key === 'keys' ? <div className="mt-6"><KeyTable groups={keyHelp()} /></div> : null}
          </>
        ) : null
      }
      on={{
        open: (k) => {
          setQ('')
          app.nav.to(href(k))
        },
        href,
        search: setQ,
        back: () => app.nav.settingsBack(),
      }}
    />
  )
}
