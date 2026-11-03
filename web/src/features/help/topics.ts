// Help's topics: what Taska is and how each part of it works, in groups as a help centre has them. Each topic has its
// address (/help/<key>), its name, one line on what it answers, and its words in Markdown. Keyboard shortcuts are
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
        about: 'Hand work to coding agents and keep track of it',
        text: `Taska keeps the work you hand to coding agents such as Claude Code and Codex. You say what you want, typed or by voice; it becomes **items**; agents take them one by one and write back on them; you answer their questions, approve what they propose and accept what they finish.

Each project has:

- **Items**: the work, with what needs you at the top.
- **Inputs**: everything you said, as you said it, and the items each became.
- **Archive**: finished items you put away.
- **Rules**: how agents work in this project.

The sidebar lists your projects with what needs you in each. Documents, Activity, Deleted, Settings and Help are at its foot.`,
      },
      {
        key: 'inputs',
        title: 'Writing and speaking',
        about: 'New inputs, voice notes, files and replies',
        text: `**New input** (or **C**) opens the box. Write as you would to a person: one thing or many, in any language. Add pictures or files by pasting, dropping or the paper clip.

**Voice**: the microphone records a voice note; Taska writes out what you said and keeps the recording. **Voice spellings** in Settings teach it words it gets wrong.

**The organizer** reads each input and turns it into items: new ones, or words added to the item it is about. Every input keeps a link to what it became, under Inputs.

**On an item**, the box under it replies there: an answer to a question, more detail, or a change of mind. The connected agent sees it at once.`,
      },
    ],
  },
  {
    name: 'Working with items',
    topics: [
      {
        key: 'items',
        title: 'Items',
        about: 'Types, statuses, priority, Now and Later, subitems',
        text: `Each item has a code: its type's letter and a number.

| Letter | Type |
| --- | --- |
| F | Feature |
| B | Bug |
| I | Idea |
| T | Task |
| R | Rule |

**Status**: *Proposed* (an agent suggests it; it waits for your approval), *Open*, *In progress*, *In review* (done by the agent; it waits for you to accept), *Done* and *Won't do*.

**Priority**: P0 is the most urgent, P3 the least. **Now** items are in the queue agents take work from; **Later** ones wait until you move them back.

**Subitems**: an item can sit under another one. Drag a row onto the middle of another row, or use **Put under…** in its menu.`,
      },
      {
        key: 'needs-you',
        title: 'What needs you',
        about: 'Questions, proposals and finished work waiting on you',
        text: `An item needs you when an agent asked a question, proposed something, or finished work for you to check. These are at the top of Items and in the **Needs you** view, and the sidebar counts them for each project.

- **Answer** a question: pick a choice or write a reply.
- **Approve** a proposal, or say *Won't do*.
- **Accept** finished work, or say **Not yet** and what is still wrong: it goes back to the agent.

On the phone, swipe a row right for its next step; swipe left for the others.`,
      },
      {
        key: 'lists',
        title: 'Lists, views and search',
        about: 'Find items, order the queue, act on many at once',
        text: `**Views** over the list: Needs you, Active, All, Queue, Later and Finished. **Filters** narrow by type, priority and more; save a set of filters as your own view.

**Search** (**/**) finds words in titles, in the talk and in documents. **⌘K** goes straight to an item by its code, or to anything you can do.

**Ordering the queue**: on the desktop, drag a row over the top or bottom of another row in the queue to put it before or after. Drag a subitem off every row to take it out from under its parent. Drag a row onto a project in the sidebar to move it there.

**Many at once**: ⌘-click or ⇧-click rows, then act on all of them together.

**Projects**: drag them in the sidebar into your own order (on the phone, hold one still first).`,
      },
      {
        key: 'documents',
        title: 'Documents',
        about: 'Plans and write-ups that belong to an item',
        text: `A document (code **D** and a number) holds a longer plan or write-up for an item: an agent's proposal, a design, notes. It opens beside its item.

Select words or point at a paragraph to **comment** on it; the agent answers in the comment's thread. Documents show tables, code and Mermaid diagrams.

**Documents** in the sidebar lists every document in the project.`,
      },
      {
        key: 'rules',
        title: 'Rules',
        about: 'How agents work in this project',
        text: `Rules tell agents how to work in this project; every agent reads them before it starts. Keep them few, each about one area, and each saying when it applies.

An agent may **propose** a rule: it waits for your approval like any proposal. A rule no longer wanted is **retired**: it stays under Rules with its history.`,
      },
      {
        key: 'undo',
        title: 'Undo and getting things back',
        about: 'Undo, Activity and Deleted',
        text: `**Undo** (**Z**, or the Undo button that appears after a change) puts back what you just did.

**Activity** lists every change in the project, yours and the agents'; undo an older change of yours from there.

**Deleted** keeps inputs, items and documents you deleted; restore them from there.`,
      },
    ],
  },
  {
    name: 'Agents',
    topics: [
      {
        key: 'connect',
        title: 'Connect an agent',
        about: 'Let Claude Code or Codex work on this project',
        text: `Click the agent's status at the top right to open **Agents**: whether an agent is here, what waits for one, and the ways to connect one.

- **Run a command** once per machine, in the project's folder, or
- **Tell the agent** the words shown there.

An agent that has worked on the project in the last days counts as connected. **What the agent reads** at the foot of Agents shows the guide it follows, word for word.`,
      },
      {
        key: 'agents',
        title: 'How agents get work',
        about: 'Told at once, with no tokens spent while they wait',
        text: `When you write, Taska tells the connected agent at once, and waiting costs no tokens.

- **Codex**: Taska puts a notice in the session's own queue. An idle session starts at once; a busy one after its turn.
- **Claude Code**: before ending a turn, the session leaves one request waiting in the background. Taska answers it only when there is work, and the agent goes on.
- **No tokens while waiting**: no model runs until there is work.

Agents must end their turn when nothing is left, and never use timers, heartbeats, scheduled tasks or polling. One found doing so is stopped and reported.`,
      },
    ],
  },
  {
    name: 'Your setup',
    topics: [
      {
        key: 'phone',
        title: 'Use on your phone',
        about: 'Open Taska away from this computer',
        text: `**Settings › Use on your phone** gives a link and a key. Open the link on the phone, enter the key once, then use **Share › Add to Home Screen** so Taska opens like an app.

On the phone, the sidebar is a drawer from the left; swipe rows to act on them; record voice notes from the box at the bottom.`,
      },
      {
        key: 'notifications',
        title: 'Notifications',
        about: 'Alerts when something needs you',
        text: `**Settings › Notifications** turns on alerts when an item starts to need you. Quiet hours hold them back while you do not want to be disturbed.

On the phone, notifications work once Taska is on the Home Screen; turn them on from Taska opened there.`,
      },
      {
        key: 'keys',
        title: 'Keyboard shortcuts',
        about: 'Every key, on the desktop',
        text: 'On the desktop almost everything has a key. Press **?** anywhere to see them over the page.',
      },
    ],
  },
]

export const HELP_TOPICS: HelpTopic[] = HELP_GROUPS.flatMap((g) => g.topics)

/** The topics whose name or words have every word searched for, best first (a name before words). */
export function searchHelp(q: string): HelpTopic[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const has = (s: string) => words.every((w) => s.toLowerCase().includes(w))
  return [...HELP_TOPICS.filter((t) => has(t.title + ' ' + t.about)), ...HELP_TOPICS.filter((t) => !has(t.title + ' ' + t.about) && has(t.text))]
}

/** The topic Help shows: the one its address names; with none named, the desktop opens the first, as a docs site
 * does (the phone shows its index of topics instead, B650). */
export const shownTopic = (key: string | null, desk: boolean): HelpTopic | null => HELP_TOPICS.find((t) => t.key === key) ?? (desk ? HELP_TOPICS[0] : null)
