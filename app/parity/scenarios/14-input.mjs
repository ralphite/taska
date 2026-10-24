// A new input with words and a picture: what the box shows while it goes, and where it lands.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const PIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'pic.png')
export default [
  {
    id: 'new-input',
    title: '新输入：文字加图片',
    async run(t) {
      await t.goto('/p/taska/')
      await t.upload((p) => p.getByRole('button', { name: 'Add images or files' }), [PIC], '加一张图')
      await t.click((p) => p.getByRole('textbox', { name: 'Input' }), '点输入框')
      await t.type('Parity: a new input with a picture', '写字')
      if (t.desk) await t.key('Enter', '按 Enter 发送')
      else await t.click((p) => p.getByRole('button', { name: /^Send/ }), '点发送')
      await t.wait(1500, '等一下')
      await t.agent('GET', '/p/taska/inbox')
      if (t.phone) await t.click((p) => p.getByRole('tab', { name: /^Inputs/ }), '看 Inputs')
    },
  },
]
