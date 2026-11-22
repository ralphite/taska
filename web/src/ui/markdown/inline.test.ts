import { describe, expect, test } from 'vitest'
import { clean, inlineHtml, picturesIn, type InlineWorld } from './inline'

const world: InlineWorld = { find: (c) => (c === 'D1' ? { kind: 'doc', d: 1 } : null), url: (f) => f, size: () => undefined }

describe('links', () => {
  test('a link to a Taska code shows its words and opens what the code names', () => {
    for (const md of ['see [the plan](#D1)', 'see [the plan](D1)']) {
      const html = inlineHtml(md, world)
      expect(html).toContain('data-ref="D1"')
      expect(html).toContain('>the plan</span>')
      expect(html).not.toContain('](')
    }
  })
  test('a link to a code that names nothing is just its words', () => {
    expect(inlineHtml('see [the plan](#D9)', world)).toBe('see the plan')
  })
  test('a link to a file sent to Taska opens it at its address, on the phone too (T782)', () => {
    const at: InlineWorld = { ...world, url: (f) => `/p/demo/f/${f}` }
    const html = clean(inlineHtml('[进度报告](f121-deep-dive-1113-2021.html)', at))
    expect(html).toContain('href="/p/demo/f/f121-deep-dive-1113-2021.html"')
    expect(html).toContain('>进度报告</a>')
    expect(html).not.toContain('](')
  })
})

describe('pictures', () => {
  test('a picture without words is named by its file, so its button has a name', () => {
    expect(inlineHtml('![](shots/after.png)', world)).toContain('alt="after.png"')
    expect(inlineHtml('![the list](shots/after.png)', world)).toContain('alt="the list"')
  })
})

describe('videos (T747)', () => {
  test('a video file plays where it stands, with its controls, in the page on the phone too', () => {
    const html = clean(inlineHtml('the walk-through: ![how it works](f12-demo.mp4)', world))
    expect(html).toContain('<video')
    expect(html).toMatch(/controls/)
    expect(html).toMatch(/playsinline/)
    expect(html).toContain('src="f12-demo.mp4#t=0.001"')
    expect(html).toContain('aria-label="how it works"')
    expect(html).not.toContain('<img')
  })
  test('a video on the web plays too; a picture stays a picture', () => {
    expect(clean(inlineHtml('![](https://example.com/a/clip.MOV?x=1)', world))).toContain('<video')
    expect(clean(inlineHtml('![](f3-shot.png)', world))).not.toContain('<video')
  })
  test("a video is not one of the viewer's pictures", () => {
    expect(picturesIn('![](f1-a.png) ![](f2-b.mp4) ![](f3-c.jpg)')).toEqual(['f1-a.png', 'f3-c.jpg'])
  })
})
