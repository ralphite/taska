import { afterEach, describe, expect, it } from 'vitest'
import { Mic, type OpenMic } from './mic'

/** a microphone stream as the browser gives it: its one track hears until stopped */
function stream() {
  const track = { readyState: 'live' as MediaStreamTrackState, stop() { this.readyState = 'ended' }, getSettings: () => ({}) }
  return { track, s: { getAudioTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream }
}

describe('the microphone from the Home Screen (B217, B800)', () => {
  let stop = () => {}
  afterEach(() => {
    stop()
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
  })
  function mic(home: boolean, busy = () => false) {
    let asked = 0
    const given: ReturnType<typeof stream>[] = []
    const m = new Mic({ busy, keep: () => home, open: async (): Promise<OpenMic> => (asked++, given.push(stream()), { stream: given[given.length - 1].s, refused: null, settings: {} }) })
    stop = m.stop
    return { m, asked: () => asked, given }
  }

  it('is asked for once for two recordings, and kept between them while Taska is on screen', async () => {
    const { m, asked, given } = mic(true)
    m.done((await m.open()).stream)
    expect(given[0].track.readyState).toBe('live')
    m.done((await m.open()).stream)
    expect(asked()).toBe(1)
  })

  it('is let go when Taska goes to the background, and asked for again after', async () => {
    const { m, asked, given } = mic(true)
    m.done((await m.open()).stream)
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(given[0].track.readyState).toBe('ended')
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    await m.open()
    expect(asked()).toBe(2)
  })

  it('stays while a recording goes on in the background', async () => {
    let busy = true
    const { m, given } = mic(true, () => busy)
    await m.open()
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(given[0].track.readyState).toBe('live')
    busy = false
    m.done(given[0].s) // it ended in the background: let go then
    expect(given[0].track.readyState).toBe('ended')
  })

  it('in a browser tab each recording opens it and lets it go', async () => {
    const { m, asked, given } = mic(false)
    m.done((await m.open()).stream)
    expect(given[0].track.readyState).toBe('ended')
    m.done((await m.open()).stream)
    expect(asked()).toBe(2)
  })
})
