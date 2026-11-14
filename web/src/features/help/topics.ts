// Help's topics: what Taska is and how each part of it works, in groups as docs sites have them. Each topic has its
// address (/help/<key>), its name, a line on what it answers, and its words in Markdown, in "## " sections. Help says
// only what the page does not already show: no list of keys (? shows them), no inner workings of agents. Keyboard shortcuts are
// drawn from the page's own list of keys, so its words here only lead into them.

export interface HelpTopic {
  key: string
  title: string
  about: string
  text: string
}

export interface HelpGroup {
  name: string
  topics: HelpTopic[]
}

export const HELP_GROUPS: HelpGroup[] = [
  {
    name: 'Getting started',
    topics: [
      {
        key: 'start',
        title: 'What Taska is',
        about: 'Hand work to coding agents by writing or speaking, and keep track of every piece of it.',
        text: `Taska is a task list you share with coding agents such as Claude Code and Codex. You say what you want; agents do the work and write back; you decide what is finished.

## How it works

1. **You say what you want**, typed or as a voice note, in any language.
2. **It becomes items.** The organizer turns what you said into items, or adds it to the item it is about.
3. **Agents work through the items** by priority and write back on each one: progress, questions, proposals.
4. **You decide.** Answer their questions, approve what they propose and accept what they finish.

## What a project holds

| Place | What it holds |
| --- | --- |
| Items | The work, with what needs you at the top; its views include **Archive**, the finished items you put away |
| Inputs | Everything you said, as you said it, and what each became: on the desktop under **New input**, on the phone its own tab |
| Rules | One document: how agents work in this project |

## Finding your way

The sidebar lists your projects, each with how many things need you. **Documents**, **Activity**, **Deleted**, **Settings** and **Help** are at its foot.`,
      },
      {
        key: 'inputs',
        title: 'Writing and speaking',
        about: 'New inputs, voice notes, files, and replies on an item.',
        text: `Everything you tell Taska starts as an input: a few words, a voice note, a picture, or all of them together.

## Write a new input

Press **New input** and write as you would to a person: one thing or many, in any language. Paste or drop pictures and files, or use **+**.

## Speak instead

The microphone records a voice note. Taska writes out what you said and keeps the recording, so the original words are always there to check.

- On the desktop, point at a voice note's play button to see its original words.
- **Settings › Voice spellings** teaches Taska words it gets wrong.

## What happens next

The organizer reads each input and turns it into items: new ones, or words added to the item it is about. Every input keeps a link to what it became, with your inputs. **What happens to what you say** has the whole way.

## Reply on an item

On an item, the box under it replies there: an answer to a question, more detail, or a change of mind. The connected agent sees it at once.`,
      },
      {
        key: 'after-you-say',
        title: 'What happens to what you say',
        about: 'Where an input goes, and where you see what it became.',
        text: `Everything you say is an input: words, a voice note, a picture, or all of them. Here is where it goes.

## Step by step

1. **You say it**, under **New input** or in an item's box.
2. **It shows at once** as a new line in your inputs. Said in an item, it is also your message there.
3. **A voice note writes itself out**: its first words in about two seconds, then tidied words, used everywhere.
4. **The organizer reads it** and does what it asks: one input can do several things.
5. **Not sure what you meant?** The organizer asks you on the item, with choices, as an agent does.

## What the organizer does

- Something new becomes a **new item**: a short title, and all your words as its body.
- Words about an item go into **that item's talk**: only the part about it.
- "Make it P0", "later", "done" or "won't do" **change the item**.
- "From now on, always…" **changes the Rules**.
- A question or request for an agent is **left for an agent**.
- Hello and thanks need nothing.

New items are P1 and Now, unless you say urgent or later.

## Where you see what

| You say | Your inputs show | Where else |
| --- | --- | --- |
| Something new, under New input | Created B713 | B713: your words, pictures and voice notes |
| More about T03, under New input | Added to T03 | T03's talk: the part about it |
| More about T03, in T03 | Added to T03 | Only your message in T03 |
| "Make it P0", in T03 | Added to T03 | T03's priority changes |
| Something new, in T03 | Created B713 | Your message in T03, with **→ Created B713** under it |
| A rule | Changed the rules | A new version of the Rules |
| A question for an agent | For an agent | The agent picks it up |

Change an input you sent and it is read again: its items follow the new words.

## What never happens

- No notes from the organizer on an item it just made, or on the item you spoke in. A question for you is the only exception.
- Your whole input is never pasted into another item.
- Your words are never shortened, reordered or rewritten. Only "um"s and words said twice go.
- You never press Retry: when the organizer can't be reached, Taska keeps trying.`,
      },
      {
        key: 'connect',
        title: 'Connect an agent',
        about: 'Let Claude Code or Codex work on this project.',
        text: `## Open Agents

Click the agent status at the top right. **Agents** shows whether an agent is here, what is waiting for one, every agent session seen in the project and what each is doing, and the ways to connect one.

## Connect one

**Connect new agent**, at the top right of Agents, copies what to paste to the agent. It tells the agent to connect its
folder once (the project's address and Taska's skill) and then to start on the work. **Connect an agent on another
network**, under the list, copies the same for an agent on a computer outside this network.

An agent that has worked on the project in the last few days counts as connected.

## When agents start

When you write, Taska tells the connected agent at once. An agent waiting for work spends no tokens.

## What agents read

**What agents read**, under the sessions in Agents, shows the guide they follow, word for word.`,
      },
    ],
  },
  {
    name: 'Working with items',
    topics: [
      {
        key: 'items',
        title: 'Items',
        about: 'Codes, types, statuses, priority, Now and Later, and subitems.',
        text: `An item is one piece of work: a feature, a bug, an idea or a task.

## Codes

Each item has a code: its type's letter and a number, such as **F12** or **B3**. Agents and you use codes to point at items.

| Letter | Type |
| --- | --- |
| F | Feature |
| B | Bug |
| I | Idea |
| T | Task |

## Statuses

| Status | Means |
| --- | --- |
| {status:proposed} Proposed | An agent suggests it; it waits for your approval |
| {status:open} Open | Approved, not started |
| {status:doing} In progress | An agent is working on it now |
| {status:review} In review | The agent finished; it waits for you to accept |
| {status:done} Done | You accepted it |
| {status:dropped} Won't do | You decided against it |
| {status:wait} Needs you | An agent asked you something |

## Priority, Now and Later

P0 is the most urgent and P3 the least. **Now** items are the queue agents take work from; **Later** items wait until you move them back.

## Subitems

An item can sit under another one. Drag a row onto the middle of another row, or choose **Put under…** in its menu.`,
      },
      {
        key: 'needs-you',
        title: 'What needs you',
        about: 'Questions, proposals and finished work waiting for your answer.',
        text: `An item needs you when an agent asked a question, proposed something, or finished work for you to check. These come first in **Items**, in the **Needs you** view, and in each project's count in the sidebar.

## Answer, approve, accept

| The agent… | You can |
| --- | --- |
| asked a question | Pick a choice, or write a reply |
| proposed something | **Approve**, or say **Won't do** |
| finished work | **Accept**, or say **Not yet** and what is still wrong |

**Not yet** sends the item back to the agent.

## On the phone

Swipe a row right for its next step, or left for the other actions.`,
      },
      {
        key: 'lists',
        title: 'Lists, views and search',
        about: 'Find items, order the queue, and act on many at once.',
        text: `## Views and filters

The views over the list are **Needs you**, **Active**, **All**, **Archive**, **Open**, **Later**, **Done** and **Won't do**. **Filters** narrow the list by type, priority and more; save a set of filters as your own view.

## Search

Search (**⌘K** or **/**, or the magnifier beside Taska in the sidebar) finds items, inputs, the rules and documents in every project, by what the words mean. Type, or click the mic and say it. Words that name something you can do, like **Done** or **Settings**, show it under Actions.

## Order the queue

On the desktop, drag a row over the top or bottom edge of another row to put it before or after. Drag a subitem off every row to take it out from under its parent. Drag a row onto a project in the sidebar to move it there.

## Act on many at once

On the desktop, pick several rows, then act on all of them together.

## Order your projects

Drag projects in the sidebar into your own order. On the phone, hold one still first.`,
      },
      {
        key: 'documents',
        title: 'Documents',
        about: 'Longer plans and write-ups that belong to an item.',
        text: `A document (code **D** and a number) holds a longer plan or write-up for an item: an agent's proposal, a design, or notes. It opens beside its item.

## Comment on a document

Select words, or point at a paragraph, to comment on it. The agent answers in the comment's thread.

## Find documents

**Documents** in the sidebar lists every document in the project.`,
      },
      {
        key: 'rules',
        title: 'Rules',
        about: 'One document of standing instructions every agent follows in this project.',
        text: `The rules are one document: how agents work in this project. Every agent reads it before it starts, and is told when it changes.

## Writing good rules

- One section per area, under its own heading.
- Say when it applies.
- **Edit** changes the whole document; say why in one line.

## Versions

Every save is a version: who, when, why. **History** lists them by day. Open one to see what it changed; **Compare with now**; **Restore** makes it the next version, so nothing is lost.

## Proposed changes

An agent proposes a change; it waits in **Needs you**. **View changes** shows it marked in the text: **Approve** or **Not now**. **Comment** answers the agent.`,
      },
      {
        key: 'undo',
        title: 'Undo and getting things back',
        about: 'Undo a change, look through Activity, and restore from Deleted.',
        text: `## Undo

**Undo**, the button that appears after a change, puts back what you just did.

## Activity

**Activity** lists every change in the project, yours and the agents'. Undo an older change of yours from there.

## Deleted

**Deleted** keeps the inputs, items and documents you deleted. Restore them from there.`,
      },
    ],
  },
  {
    name: 'Your setup',
    topics: [
      {
        key: 'phone',
        title: 'Use on your phone',
        about: 'Open Taska on your phone, like an app.',
        text: `## Set it up

1. Open **Settings › Use on your phone** on the computer. It shows a link and a key.
2. Open the link on the phone and enter the key once.
3. Choose **Share › Add to Home Screen**, so Taska opens like an app.

## On the phone

- The sidebar is a drawer from the left.
- Swipe rows to act on them.
- Record voice notes from the box at the bottom.`,
      },
      {
        key: 'notifications',
        title: 'Notifications',
        about: 'Alerts when something starts to need you.',
        text: `## Turn them on

**Settings › Notifications** turns on alerts when an item starts to need you. **Quiet hours** hold them back while you do not want to be disturbed.

## On the phone

Notifications work once Taska is on the Home Screen. Turn them on from Taska opened there.`,
      },
    ],
  },
]

/** A topic's words in parts, as docs sites lay them out: what comes before its first section, then each "## " section
 * with an id for its link (the page's On this page list). */
export function topicParts(text: string): { intro: string; sections: { id: string; title: string; text: string }[] } {
  const [intro, ...rest] = text.split(/^## /m)
  return {
    intro: intro.trim(),
    sections: rest.map((part) => {
      const [title, ...lines] = part.split('\n')
      return { id: title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), title: title.trim(), text: lines.join('\n').trim() }
    }),
  }
}

export const HELP_TOPICS: HelpTopic[] = HELP_GROUPS.flatMap((g) => g.topics)

/** A topic the search found, and, when only its words matched, the sentence of them that matched best (shown in
 * place of what the topic answers, so you see why it was found). */
export interface HelpFound {
  topic: HelpTopic
  line: string | null
}

export const searchWordsOf = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean)

/** A status's icon in the words ({status:doing}) is no word to find. */
const noIcons = (s: string) => s.replace(/\{status:\w+\}\s?/g, '')

/** A topic's words as plain sentences: no Markdown marks, one sentence or list line each; a section whose name is
 * all that matched gives its name with its first sentence (a sentence says more than a name), after the rest. */
const sentences = (text: string) => {
  const plain = (s: string) => noIcons(s).replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1').replace(/[*_`]+/g, '')
  const said = (s: string) =>
    plain(s)
      .split('\n')
      .flatMap((l) => l.split(/(?<=[.!?])\s+/))
      .filter((l) => !/^[\s|:-]+$/.test(l))
      .map((l) => l.replace(/^\s*([-+]|\d+\.)\s+/, '').replace(/^\s*\|\s*|\s*\|\s*$/g, '').replace(/\s*\|\s*/g, ': ').trim())
      .filter(Boolean)
  const { intro, sections } = topicParts(text)
  return [...said(intro), ...sections.flatMap((x) => said(x.text)), ...sections.map((x) => `${plain(x.title)}: ${said(x.text)[0] ?? ''}`)]
}

/** The sentence with the most of the words searched for (the first of those). */
const bestLine = (text: string, words: string[]) => {
  let best = ''
  let most = 0
  for (const s of sentences(text)) {
    const low = s.toLowerCase()
    const k = words.filter((w) => low.includes(w)).length
    if (k > most) [best, most] = [s, k]
  }
  return best || null
}

/** The topics whose name or words have every word searched for, best first (a name before words). */
export function searchHelp(q: string): HelpFound[] {
  const words = searchWordsOf(q)
  if (!words.length) return []
  const has = (s: string) => words.every((w) => s.toLowerCase().includes(w))
  const named = HELP_TOPICS.filter((t) => has(t.title + ' ' + t.about))
  return [
    ...named.map((topic) => ({ topic, line: null })),
    ...HELP_TOPICS.filter((t) => !named.includes(t) && has(noIcons(t.text))).map((topic) => ({ topic, line: bestLine(topic.text, words) })),
  ]
}

/** The topic Help shows: the one its address names; with none named, the first, as docs sites open (B650). */
export const shownTopic = (key: string | null): HelpTopic => HELP_TOPICS.find((t) => t.key === key) ?? HELP_TOPICS[0]
