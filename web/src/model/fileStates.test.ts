// A file's upload state (T728 #10): one rule for going up, up and failed, a voice note's own state built on it, and
// a message on its way whose only file failed says so instead of counting it.
import { describe, expect, test } from 'vitest'
import { FILE_STATES, FILE_STATE_LIST, fileState, filesLine, goingUp, isUp, notFailed } from './fileStates'
import { outgoingLine } from './outgoing'
import { noteState, sayIn, stillComing } from './voiceStates'

describe('a file going up, up, failed', () => {
  test('every state is worked out from what is kept of it', () => {
    expect(fileState({ f: '', uploading: true })).toBe('uploading')
    expect(fileState({ f: '' })).toBe('uploading') // no name from Taska yet: not up
    expect(fileState({ f: 'f1-a.png' })).toBe('up')
    expect(fileState({ f: '', uploading: false, failed: true })).toBe('failed')
    expect(FILE_STATE_LIST).toEqual(['uploading', 'up', 'failed'])
  })
  test('only an up file goes; a failed one is neither up nor going up, and a reload lets it go', () => {
    const failed = { f: '', failed: true }
    expect([isUp(failed), goingUp(failed), notFailed(failed)]).toEqual([false, false, false])
    expect([isUp({ f: 'f1' }), goingUp({ f: 'f1' }), notFailed({ f: 'f1' })]).toEqual([true, false, true])
    expect([isUp({ f: '', uploading: true }), goingUp({ f: '', uploading: true })]).toEqual([false, true])
  })
  test('a voice note is going up or refused as any file is, and says it in the same words', () => {
    expect(noteState({ mime: 'audio/webm', f: '', failed: true, transcript: 'wait' })).toBe('uploadFailed')
    expect(sayIn('uploadFailed', 'chip')?.say).toBe(FILE_STATES.failed.say)
    expect(noteState({ mime: 'audio/webm', uploading: true, transcript: 'wait' })).toBe('uploading')
    expect(stillComing({ f: '', uploading: true, mime: 'image/png' })).toBe(true)
    expect(stillComing({ f: '', failed: true, mime: 'image/png' })).toBe(false)
  })
})

describe('T728: a message on its way with files only', () => {
  const pic = (o: object = {}) => ({ f: 'f1-a.png', name: 'a.png', mime: 'image/png', ...o })
  test('counts the files that go; its only picture refused: Upload failed, not "1 file"', () => {
    expect(outgoingLine({ text: '', files: [pic()] })).toBe('1 file')
    expect(outgoingLine({ text: '', files: [pic(), pic({ f: '', failed: true })] })).toBe('1 file')
    expect(outgoingLine({ text: '', files: [pic({ f: '', failed: true })] })).toBe('Upload failed')
    expect(filesLine([pic(), pic({ f: '', uploading: true })])).toBe('2 files')
  })
})
