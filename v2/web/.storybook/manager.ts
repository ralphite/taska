// T457: the page gets the whole height; the add-on panel opens from the toolbar when wanted
import { addons } from 'storybook/manager-api'
import { CHANNEL_WS_DISCONNECT } from 'storybook/internal/core-events'

addons.setConfig({ showPanel: false })

// B517: the page loses its line to Storybook's server when the server stops (and starts again) or is too busy to
// answer for 20 s, and Storybook never takes it up again: the page would stay as it was, with "Server timed out". It
// waits until the server answers, then reloads itself on the same story.
addons.register('taska/reconnect', (api) => {
  api.on(CHANNEL_WS_DISCONNECT, () => {
    const back = async () => {
      try {
        if ((await fetch('/index.json', { cache: 'no-store' })).ok) return location.reload()
      } catch {
        // still away
      }
      setTimeout(back, 2000)
    }
    setTimeout(back, 1000)
  })
})
