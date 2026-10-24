import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frame } from '../../stories/Frames'
import { WebPage } from './WebPage'

const meta: Meta = { title: 'Components/Document/Web page' }
export default meta
type Story = StoryObj

const html = `<!doctype html><html><body style="font-family:system-ui;margin:24px">
<h1 id="top">Export plan</h1><p data-part="intro">Three ways to ship filtered export, what each costs, and what we recommend.</p>
<div id="a" style="padding:12px;border:1px solid #ddd;border-radius:12px;margin:12px 0">A: export the list as shown</div>
<div id="b" style="padding:12px;border:1px solid #ddd;border-radius:12px">B: export with the filters as columns</div></body></html>`
const on = { pick() {}, say() {}, esc() {}, toggle() {}, away() {} }
const thread = () => <div className="rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-sm">A comment on this part.</div>

/** The page as its agent wrote it, run in its own frame; Comment mode on (the desktop), a part picked. */
export const Page: Story = {
  render: () => (
    <div className="flex gap-6">
      <Frame layout="desk" width={720} height={420}>
        <WebPage title="Export plan" html={html} threads={[{ tk: "h:[id='a']#3", key: "h:[id='a']", quote: 'A: export the list as shown', n: 2, done: false }]} held={null} open={null} desk inspect renderThread={thread} on={on} />
      </Frame>
      <Frame layout="phone" width={393} height={420}>
        <div className="px-4">
          <WebPage title="Export plan" html={html} threads={[]} held={{ key: "h:[id='b']", text: 'B: export with the filters as columns' }} open={null} desk={false} inspect={false} renderThread={thread} on={on} />
        </div>
      </Frame>
    </div>
  ),
}
