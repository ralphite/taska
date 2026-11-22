import { describe, expect, it } from 'vitest'
import { fileUrl, withFilesPass } from './filesPass'

describe('withFilesPass (T790)', () => {
  it("puts the pass on each address of the project's files, however it is written", () => {
    const html = `<audio src="/p/system-design/f/f50-D5-zh-1.1.mp3"></audio><img src='https://host.example:7340/k/ab12-cd34/p/system-design/f/f9-a.png'>
<script>new Audio("http://127.0.0.1:7340/p/system-design/f/f51-b.m4a")</script>`
    expect(withFilesPass(html, 'system-design', 'abc123')).toBe(`<audio src="/p/system-design/f/f50-D5-zh-1.1.mp3?cap=abc123"></audio><img src='/p/system-design/f/f9-a.png?cap=abc123'>
<script>new Audio("/p/system-design/f/f51-b.m4a?cap=abc123")</script>`)
  })
  it("leaves other projects' files, other addresses and a page with no pass as they are", () => {
    const html = `<a href="/p/dev2/f/f406-x.mp4">x</a> <a href="/p/system-design/T27">T27</a>`
    expect(withFilesPass(html, 'system-design', 'abc123')).toBe(html)
    expect(withFilesPass('<img src="/p/system-design/f/f1.png">', 'system-design', '')).toBe('<img src="/p/system-design/f/f1.png">')
  })
  it('is the same when done twice', () => {
    const once = withFilesPass('<img src="/p/a/f/f1.png">', 'a', 'c0ffee')
    expect(withFilesPass(once, 'a', 'c0ffee')).toBe(once)
  })
})

describe('a file of the project (T828)', () => {
  it('carries the files pass, so it opens in a window without the key (an iPhone Home Screen app opens a PDF in one)', () => {
    expect(fileUrl('home', 'f217-family conversations.pdf', 'c0ffee')).toBe('/p/home/f/f217-family%20conversations.pdf?cap=c0ffee')
  })
  it('is the plain address without a pass', () => {
    expect(fileUrl('home', 'f1.png')).toBe('/p/home/f/f1.png')
  })
})
