// T859 (Yadong r1461): switching to a project not opened for a while left the desktop blank until a reload. The page
// drew the copy this browser kept before T855, whose items had a type and no tags, and threw on what was not there.
// A copy is used only by the page build that kept it.

import { describe, expect, it } from 'vitest'
import { keptCopy, type Stored } from './cache'

const stored = (build?: string): Stored => ({ build, cursor: 'c1', items: [], inputs: [], docs: [], voices: [], facts: {} as Stored['facts'], server: {} as Stored['server'] })

describe('the copy this browser kept', () => {
  it('is used by the build that kept it', () => {
    expect(keptCopy(stored('index-NEW.js'), 'index-NEW.js', 5)?.cursor).toBe('c1')
  })

  it('is not used by another build, nor when kept before copies said their build', () => {
    expect(keptCopy(stored('index-OLD.js'), 'index-NEW.js', 5)).toBeNull()
    expect(keptCopy(stored(), 'index-NEW.js', 5)).toBeNull()
    expect(keptCopy(null, 'index-NEW.js', 5)).toBeNull()
  })
})
