// What the page shows when drawing it threw (T859): a short line and Reload in its place, never a blank window. The
// error goes to Taska's log as one the page did not catch (PageErrors), and the page tries again by itself when what
// it draws changes (`again`: a project's copy came, another page was opened), so a copy it could not draw is drawn
// again once the server's comes. Reload loads the page without the copies this browser kept.

import { Component, type ReactNode } from 'react'
import { LINK_BTN } from '../ui/tones'

interface Props {
  /** what the page draws from: when it changes, the page is drawn again */
  again: unknown
  reload(): void
  children: ReactNode
}

export class RenderGuard extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown): void {
    // caught here, so the browser does not report it: report it as it would have (the page's log listens there)
    if (typeof reportError === 'function') reportError(error)
  }

  componentDidUpdate(before: Props): void {
    if (this.state.failed && before.again !== this.props.again) this.setState({ failed: false })
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="grid h-dvh w-full place-items-center bg-white text-sm text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        <div className="flex items-center gap-2">
          Couldn’t show this page.
          <button type="button" onClick={() => this.props.reload()} className={LINK_BTN}>
            Reload
          </button>
        </div>
      </div>
    )
  }
}
