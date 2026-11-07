// Words selected in a document (T591: Commenting > Words selected, Bar over selected words): the page's own document
// with the browser's selection on some of its words, and the page's bar over them (SelectionBar), which the document
// draws where they are as the page does (B708 r1149). Select other words in it and the bar follows them.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { After, Frames } from './Frames'
import { doc } from './docFixtures'
import { docAt } from './docPage'

export default { title: 'UI/Document pane/Commenting/Selected words' } satisfies Meta
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

/** The document with "written from scratch" selected; `recording`: its bar's mic pressed once. */
function Selected({ desk, recording }: { desk: boolean; recording: boolean }) {
  return (
    <After
      run={(root) => {
        if (root.querySelector('[data-selection-bar]:not([hidden])')) return
        select(root, 'p1', 'written from scratch')
        if (recording) setTimeout(() => root.querySelector<HTMLButtonElement>('[data-selection-bar] [aria-label="Record comment on selection"]')?.click(), 50)
      }}
    >
      {docAt(doc(), desk)}
    </After>
  )
}

/** Words selected in a paragraph: they stay only selected, and the bar over them offers to speak or comment. */
export const WordsSelected: Story = { name: 'Words selected', render: () => <Frames phone={false} height={560} deskWidth={900}>{() => <Selected desk recording={false} />}</Frames> }
/** On the phone: the same bar over them, in the document's sheet. */
export const WordsSelectedPhone: Story = { name: 'Words selected, on the phone', render: () => <Frames desk={false} phoneWidth={393}>{() => <Selected desk={false} recording={false} />}</Frames> }
/** The bar's mic pressed: it records a comment about them, the same button is ✓. */
export const SelectionBarRecording: Story = { name: 'Bar over selected words', render: () => <Frames phone={false} height={560} deskWidth={900}>{() => <Selected desk recording />}</Frames> }
