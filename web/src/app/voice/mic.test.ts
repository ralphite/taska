import { afterEach, describe, expect, it, vi } from 'vitest'
import { keepAwake, stopRecorder } from './mic'

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
