// Writing a document (T529, D80): the line over the editor, while you speak into it.
// guards: src/features/docs/DocEdit.tsx src/features/docs/DocEditContainer.tsx src/app/voice/dictation.ts
import { expect, test } from '@playwright/test'
import { isDesk, open, project } from './seed'
import { docEdit, docHint, docMic } from './ui'

test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } })

test('D80 #17: on the phone, speaking into a document, the hint reads on a line or two, not squeezed beside the buttons', async ({
  page,
  request,
}) => {
  test.skip(isDesk(page), 'the phone, where the line is narrow')
  const p = await project(request, {
    agent: 'new task P2 now Plan the export\n',
    approve: ['T1'],
    then: 'T1 doc The plan\n  Ship option A today.\n',
  })
  await open(page, p, 'D1')
  await docEdit(page).click()
  await docMic(page).click()
  const hint = docHint(page)
  await expect(hint).toContainText('Listening')
  const lines = await hint.evaluate((e) => {
    const r = document.createRange()
    r.selectNodeContents(e)
    return new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size
  })
  expect(lines).toBeLessThanOrEqual(2)
  await docMic(page).click()
})
