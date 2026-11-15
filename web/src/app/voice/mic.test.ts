import { afterEach, describe, expect, it, vi } from 'vitest'
import { keepAwake, Mic, stopRecorder, type OpenMic } from './mic'

/** A recorder as far as stopping it goes: `state`, and a 'stop' it says when asked to stop. */
class FakeRecorder extends EventTarget {
  state: RecordingState = 'recording'
  mimeType = 'audio/mp4'
  stops = 0
  stop() {
    this.stops++
    this.state = 'inactive'
    queueMicrotask(() => this.dispatchEvent(new Event('stop')))
  }
}

describe('stopRecorder (B745)', () => {
  it('stops a recorder and gives what it recorded once it says it stopped', async () => {
    const rec = new FakeRecorder()
    const blob = await stopRecorder(rec, [new Blob(['ab']), new Blob(['c'])])
    expect(rec.stops).toBe(1)
    expect(blob.size).toBe(3)
    expect(blob.type).toBe('audio/mp4')
  })

  it('gives at once what a recorder recorded before it stopped by itself (the phone took the microphone)', async () => {
    const rec = new FakeRecorder()
    rec.state = 'inactive' // it said its stop long ago: asked again, it would never say so
    const blob = await stopRecorder(rec, [new Blob(['30 seconds'])])
    expect(rec.stops).toBe(0)
    expect(blob.size).toBe(10)
  })
})

describe('keepAwake (B745)', () => {
  const asked: { released: boolean; release: () => Promise<void> }[] = []
  const wakeLock = {
    request: vi.fn(async () => {
      const l = { released: false, release: async () => void (l.released = true) }
      asked.push(l)
      return l
    }),
  }
  let shown: DocumentVisibilityState = 'visible'
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, get: () => wakeLock })
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => shown })
  const settle = () => new Promise((r) => setTimeout(r, 0))

  afterEach(() => {
    asked.length = 0
    wakeLock.request.mockClear()
    shown = 'visible'
  })

  it('keeps the screen on while recording, again when the page shows after it was hidden, and lets go at the end', async () => {
    const letGo = keepAwake()
    await settle()
    expect(asked).toHaveLength(1)
    // hidden, the page loses it
    shown = 'hidden'
    asked[0].released = true
    document.dispatchEvent(new Event('visibilitychange'))
    await settle()
    expect(asked).toHaveLength(1)
    shown = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    await settle()
    expect(asked).toHaveLength(2)
    letGo()
    await settle()
    expect(asked[1].released).toBe(true)
    // let go, the page showing again asks for nothing
    document.dispatchEvent(new Event('visibilitychange'))
    await settle()
    expect(asked).toHaveLength(2)
  })

  it('lets go of a lock that comes after recording stopped', async () => {
    const letGo = keepAwake()
    letGo()
    await settle()
    expect(asked).toHaveLength(1)
    expect(asked[0].released).toBe(true)
  })
})

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
