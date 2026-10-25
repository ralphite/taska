// Words selected in a document (T591: Commenting > Words selected, Bar over selected words): the page's own document
// with the browser's selection on some of its words, and the page's bar over them (SelectionBar) where they are.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { SelectionBar, type Box } from '../features/composer/SelectionBar'
import { Frames } from './Frames'
import { doc } from './docFixtures'
import { After, docAt } from './docPage'

export default { title: 'Components/Document/Commenting' } satisfies Meta
type Story = StoryObj

/** Selects `words` in the paragraph `key`, as a drag over them would. */
function select(root: HTMLElement, key: string, words: string): Range | null {
  const sec = root.querySelector(`section[data-key="${key}"] [data-block]`)
  const walk = sec && document.createTreeWalker(sec, NodeFilter.SHOW_TEXT)
  while (walk?.nextNode()) {
    const t = walk.currentNode as Text
    const i = t.data.indexOf(words)
    if (i < 0) continue
    const r = document.createRange()
    r.setStart(t, i)
    r.setEnd(t, i + words.length)
    getSelection()?.removeAllRanges()
    getSelection()?.addRange(r)
    return r
  }
  return null
}

function Selected({ desk, recording }: { desk: boolean; recording: boolean }) {
  const [at, setAt] = useState<Box | null>(null)
  return (
    <>
      <After
        run={(root) => {
          const r = select(root, 'p1', 'written from scratch')
          const b = r?.getBoundingClientRect()
          if (b && !at) setAt({ top: b.top, bottom: b.bottom, left: b.left, width: b.width, height: b.height })
        }}
      >
        {docAt(doc(), desk)}
      </After>
      <SelectionBar at={at} recording={recording} comment fix={false} on={{ mic() {}, comment() {}, fix() {} }} />
    </>
  )
}

/** Words selected in a paragraph: they stay only selected, and the bar over them offers to speak or comment. */
export const WordsSelected: Story = { name: 'Words selected', render: () => <Frames phone={false} height={560} deskWidth={900}>{() => <Selected desk recording={false} />}</Frames> }
/** The bar's mic pressed: it records a comment about them, the same button stops it. */
export const SelectionBarRecording: Story = { name: 'Bar over selected words', render: () => <Frames phone={false} height={560} deskWidth={900}>{() => <Selected desk recording />}</Frames> }
