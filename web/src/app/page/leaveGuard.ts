// Leaving or reloading the page while a recording goes on asks first, in the browser's own words (r389, B317): what
// is being said would be lost. Never while nothing records: words and notes not sent are kept over a reload.

export class LeaveGuard {
  private readonly ask: (e: BeforeUnloadEvent) => void
  constructor(recording: () => boolean) {
    this.ask = (e) => {
      if (!recording()) return
      e.preventDefault()
      e.returnValue = '' // older browsers ask only when this is set
    }
    if (typeof window !== 'undefined') window.addEventListener('beforeunload', this.ask)
  }

  stop(): void {
    if (typeof window !== 'undefined') window.removeEventListener('beforeunload', this.ask)
  }
}
