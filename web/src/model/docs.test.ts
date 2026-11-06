import { describe, expect, test } from 'vitest'
import { docWords } from './docs'

describe("a document's words as a reader sees them", () => {
  test('a web page without its markup, styles and scripts (search showed its source)', () => {
    const md = '<!doctype html><html><head><title>x</title><link rel="stylesheet" href="a.css"></head><body><h1>Export plan</h1><p>Keep the &amp; filter</p><script>var div = 1</script></body></html>'
    expect(docWords({ md, fmt: 'html' })).toBe('Export plan Keep the & filter')
  })

  test('Markdown as it is', () => {
    expect(docWords({ md: '# Plan\n\n- keep the filter', fmt: 'md' })).toBe('# Plan\n\n- keep the filter')
  })
})
