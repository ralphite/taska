import { expect, test } from 'vitest'
import { armHint } from '../model/actions'
import { ITEM_ACTS, actTip, type ItemActId } from '../model/itemActs'
import { item } from '../stories/fixtures'
import { ICON } from './icon-paths'
import { actBg, actIcon, actText, chosenTone } from './tones'

const ids = Object.keys(ITEM_ACTS) as ItemActId[]

test("every item action's icons are icons there are", () => {
  for (const id of ids) {
    expect(ICON).toHaveProperty(actIcon(id))
    expect(ICON).toHaveProperty(actIcon(id, true))
  }
})

test('an action looks as before, read by its id', () => {
  expect([actTip('drop'), actText('drop'), actBg('drop'), chosenTone('drop')]).toEqual(["Won't do · W", 'text-red-600 dark:text-red-400', 'bg-red-600 dark:bg-red-500', 'bg-red-600 text-white dark:bg-red-500 dark:text-red-950'])
  expect([actTip('reopen'), actText('reopen'), actBg('reopen')]).toEqual(['Reopen · S then 2', 'text-zinc-500 dark:text-zinc-400', null])
  expect([actIcon('accept'), actIcon('accept', true)]).toEqual(['done', 'check'])
})

test('the hints of S and P come from what they set (T opens the tags, T855)', () => {
  const it = item({ n: 1 })
  expect([armHint('s', it), armHint('p', it), armHint(null, it)]).toEqual(['Status: 1–6', 'Priority: 0–3', 'First S or P: then a digit'])
})
