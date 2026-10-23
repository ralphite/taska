// F479 (D58): a prototype of search by voice, to look at before anything is built. The real page (the Storybook
// demo project) plays it on the phone and on the desktop: tap search and it listens at once, no typing; what you
// said comes into the box; the items are found by what they mean, the closest first; tap one and it opens as any
// item does. The page's own parts do the rest (the search box, its search by the words, the rows, opening an item);
// only what is not built yet is put on it: the box listening, and the "By meaning" rows, which are the page's own
// rows of those items with the line saying why each was found. Nothing here changes Taska itself.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Player, type Ctx, type Script } from '../stories/lib/player'

const meta: Meta = {
  title: 'Prototype/Voice search',
  // the frame fits the room Storybook has, with what is said under it in sight: no fixed preview size around it
  parameters: { layout: 'fullscreen', viewport: { disable: true } },
}
export default meta

// what Yadong says, and what the model would find for it, the closest first, each with why
const SAID = '\u987e\u5ba2\u7ed3\u8d26\u65f6\u51fa\u95ee\u9898\u7684\u90a3\u51e0\u4e2a'
const FOUND: [number, string][] = [
  [2, '\u7ed3\u8d26\u65f6\u70b9 Pay now \u6ca1\u53cd\u5e94\uff0c\u4ed8\u4e0d\u4e86\u94b1'],
  [36, '\u7ed3\u8d26\u603b\u4ef7\u7b97\u9519\uff0c\u591a\u51cf\u4e86\u8fd0\u8d39'],
  [38, '\u7ed3\u8d26\u9875\u7684\u8868\u5355\u987a\u5e8f'],
  [17, '\u6539\u7ed3\u8d26\u6d41\u7a0b\u524d\u5148\u5728\u771f iPhone \u4e0a\u6d4b'],
]
const ADDED = 'data-proto' // put on the page by the prototype

/** The search box listening (a red mic where the magnifier is), working out the words, or as it is. */
function box(doc: Document, how: 'listen' | 'words' | 'off') {
  const q = doc.querySelector<HTMLInputElement>('#q'),
    icon = doc.getElementById('searchIcon')
  if (!q || !icon) return
  icon.querySelector(`[${ADDED}]`)?.remove()
  const own = icon.firstElementChild as HTMLElement | null
  q.dataset.protoPh ||= q.placeholder
  if (how === 'off') {
    if (own) own.style.display = ''
    q.placeholder = q.dataset.protoPh
    return
  }
  // the page's own mic, the one its box records with
  const mic = doc.querySelector('[data-act="mic"] svg, [data-act="new-voice"] svg')?.cloneNode(true) as Element | null
  if (own) own.style.display = 'none'
  if (mic) {
    mic.setAttribute(ADDED, '')
    mic.setAttribute(
      'class',
      how === 'listen' ? 'size-4.5 animate-pulse text-red-600 dark:text-red-400' : 'size-4.5 text-zinc-400',
    )
    icon.append(mic)
  }
  q.placeholder = how === 'listen' ? 'Listening\u2026' : 'Getting the words\u2026'
}

/** The page's own rows of the items found, each with the line saying why, cut from the list before searching. */
function rowsOf(doc: Document) {
  return FOUND.map(([n, why]) => {
    const row = doc.querySelector(`#list article[data-n="${n}"]`)?.cloneNode(true) as HTMLElement | null
    const text = row?.querySelector('[data-act="open"] .min-w-0')
    if (!row || !text) return null
    text.querySelectorAll(':scope > p:not(:first-child)').forEach((p) => p.remove()) // the line under the title is why
    const line = doc.createElement('p')
    line.className = 'mt-0.5 line-clamp-1 text-[13px] text-zinc-500 dark:text-zinc-400' // as a search hit's line
    line.textContent = why
    text.firstElementChild?.after(line)
    return row
  }).filter((r): r is HTMLElement => !!r)
}

/** Above the list: what was found by meaning, under a head like the list's own (the page's Zone). */
function byMeaning(doc: Document, rows: HTMLElement[] | null) {
  doc.getElementById('protoMeaning')?.remove()
  const list = doc.getElementById('list')
  if (!list) return
  // the words alone matched nothing; what they mean did. The views' counts are of the words, so they go too.
  list
    .querySelectorAll<HTMLElement>('.py-16, [data-act="set-filter"] .tabular-nums, [data-act="tab"] .tabular-nums')
    .forEach((e) => (e.style.display = 'none'))
  const part = doc.createElement('section')
  part.id = 'protoMeaning'
  part.setAttribute(ADDED, '')
  part.innerHTML =
    '<div data-zone="meaning" class="flex h-9 items-center gap-2 border-y border-zinc-200 bg-zinc-100 pr-1 pl-4 dark:border-zinc-700/70 dark:bg-zinc-800">' +
    `<h2 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">${rows ? 'By meaning' : 'Finding by meaning\u2026'}</h2>` +
    (rows
      ? `<span class="grid h-5 min-w-5 place-items-center rounded-full bg-zinc-200/80 px-1.5 text-[11px] font-bold text-zinc-600 tabular-nums dark:bg-zinc-800 dark:text-zinc-300">${rows.length}</span>`
      : '') +
    '</div>'
  rows?.forEach((r) => part.append(r))
  const bar = list.querySelector(':scope > :not(article):not(section)') // the views, Active, All... stay on top
  if (bar && bar.nextSibling) bar.after(part)
  else list.prepend(part)
}

const play =
  (desk: boolean): Script =>
  async (c: Ctx) => {
    const { doc, say, find, tap, wait } = c
    const rows = rowsOf(doc)
    say(
      desk
        ? '1 / 5 \u00b7 Click search (or press /): it listens at once'
        : '1 / 5 \u00b7 Tap search: it listens at once',
    )
    await wait(2500)
    if (desk) {
      const q = await find('#q')
      await tap(q)
      q?.focus()
    } else await tap(await find('#searchBtn'))
    box(doc, 'listen')
    await wait(1200)
    say(`2 / 5 \u00b7 Say what you are looking for: \u201c${SAID}\u201d`)
    await wait(4000)
    say('3 / 5 \u00b7 Stop talking: it stops by itself, and the words come in')
    box(doc, 'words')
    await wait(1500)
    box(doc, 'off')
    const q = doc.querySelector<HTMLInputElement>('#q')
    if (q) {
      q.value = SAID
      q.dispatchEvent(new Event('input', { bubbles: true })) // the page searches the words as it does
    }
    await find('#list .py-16') // the page has searched the words (and found none)
    byMeaning(doc, null)
    await wait(1600)
    say('4 / 5 \u00b7 Found by what it means, the closest first')
    byMeaning(doc, rows)
    await wait(3500)
    say('5 / 5 \u00b7 Tap the closest one to open it')
    await wait(1200)
    await tap(doc.querySelector<HTMLElement>('#protoMeaning [data-act="open"]'))
    say('Done \u00b7 It opens as any item does')
    await wait(2500)
  }
const phone = play(false),
  desktop = play(true)

export const Phone: StoryObj = {
  parameters: {
    docs: { description: { story: 'Tap search, say it, see what is found by meaning, open one. On the phone.' } },
  },
  render: (_, { globals }) => <Player path="/p/shop/" script={phone} scheme={String(globals.scheme)} />,
}
export const Desktop: StoryObj = {
  parameters: {
    docs: { description: { story: 'The same on the desktop: click search or press /.' } },
  },
  render: (_, { globals }) => <Player path="/p/shop/" script={desktop} scheme={String(globals.scheme)} on="desktop" />,
}
