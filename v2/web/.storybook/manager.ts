// T457: the page gets the whole height; the add-on panel opens from the toolbar when wanted.
// F528: every component story shows the desktop and the phone at once, so the toolbar has no screen-size picker; light
// or dark is one button that switches between them.
import { addons, types, useGlobals } from 'storybook/manager-api'
import { Badge, IconButton } from 'storybook/internal/components'
import { CHANNEL_WS_DISCONNECT } from 'storybook/internal/core-events'
import { MoonIcon, SunIcon } from '@storybook/icons'
import { createElement, useEffect, useState } from 'react'

addons.setConfig({
  showPanel: false,
  toolbar: {
    'storybook/viewport': { hidden: true },
    'storybook/viewport/tool': { hidden: true },
  },
})

// the manager's bundle compiles JSX the classic way, so the elements are made with createElement
function SchemeButton() {
  const [globals, updateGlobals] = useGlobals()
  const dark = globals.scheme === 'dark'
  return createElement(
    IconButton,
    {
      key: 'scheme',
      title: dark ? 'Dark: switch to light' : 'Light: switch to dark',
      onClick: () => updateGlobals({ scheme: dark ? 'light' : 'dark' }),
    },
    createElement(dark ? MoonIcon : SunIcon),
  )
}
addons.register('taska/scheme', () => {
  addons.add('taska/scheme/tool', {
    type: types.TOOL,
    title: 'Light or dark',
    match: ({ viewMode }) => viewMode === 'story',
    render: SchemeButton,
  })
})

// B537: Storybook draws the code as it is now; live Taska runs its last ship. When live Taska is behind, the toolbar
// says so (asked of Storybook's server each minute, .storybook/live-version.ts); nothing shows when they are the same.
function LiveBehind() {
  const [behind, setBehind] = useState(0)
  useEffect(() => {
    const ask = () =>
      fetch('/taska-live.json', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d: { behind: number | null }) => setBehind(d.behind || 0))
        .catch(() => {})
    ask()
    const t = setInterval(ask, 60_000)
    return () => clearInterval(t)
  }, [])
  if (!behind) return null
  return createElement(
    'span',
    {
      title:
        'Storybook \u663e\u793a\u7684\u662f\u73b0\u5728\u7684\u4ee3\u7801\uff1b\u7ebf\u4e0a Taska \u4e0b\u6b21\u4e0a\u7ebf\u540e\u624d\u4e00\u6837',
    },
    createElement(
      Badge,
      { status: 'warning' },
      `\u7ebf\u4e0a Taska \u8fd8\u662f\u65e7\u7248\u672c\uff08\u5dee ${behind} \u4e2a\u63d0\u4ea4\uff09`,
    ),
  )
}
addons.register('taska/live-behind', () => {
  addons.add('taska/live-behind/tool', {
    type: types.TOOL,
    title: 'Live Taska behind',
    match: () => true,
    render: LiveBehind,
  })
})

// B517: the page loses its line to Storybook's server when the server stops (and starts again) or is too busy to
// answer for 20 s, and Storybook never takes it up again: the page would stay as it was, with "Server timed out". It
// waits until the server answers, then reloads itself on the same story. Any answer counts: a story list that fails
// (a story with an error) shows its error after the reload, and Storybook loads it again once the story is fixed.
addons.register('taska/reconnect', (api) => {
  api.on(CHANNEL_WS_DISCONNECT, () => {
    const back = async () => {
      try {
        await fetch('/index.json', { cache: 'no-store', signal: AbortSignal.timeout(60_000) })
        return location.reload()
      } catch {
        // still away
      }
      setTimeout(back, 2000)
    }
    setTimeout(back, 1000)
  })
})
