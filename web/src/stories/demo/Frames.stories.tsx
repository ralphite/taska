// The page inside a Demo's frame (T589): not listed in the sidebar; each Demo's frame opens it by its address, with
// the Demo and the layout (?demo=sayIt&layout=phone; &net=record while web/scripts/record-demo.mjs records).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { DEMOS } from './demos'
import { DemoPage } from './DemoPage'

export default { title: 'Demo/Frames', tags: ['!dev', '!test'], parameters: { layout: 'fullscreen' } } satisfies Meta

export const Page: StoryObj = {
  render: () => {
    const q = new URLSearchParams(window.location.search)
    const demo = DEMOS[q.get('demo') ?? '']
    const layout = q.get('layout') === 'desk' ? 'desk' : 'phone'
    return demo ? <DemoPage demo={demo} layout={layout} record={q.get('net') === 'record'} /> : <p className="p-4 text-sm">No such Demo</p>
  },
}
