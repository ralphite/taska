# Taska product spec (v1.1)

This is the English copy of the approved product spec (Taska document D20, reviewed by the user on 2026-10-19).
It was reverse-engineered from the current Taska (code, README, rules and recent items). **v2 must do what is
written here.** It says what to do and why, not how to code it.

Decisions taken during review:

- The organizer stays Gemini.
- Every current feature is kept.
- Data: v2 first runs side by side on a *copy* of the old data; the real migration happens once, on switch day.
- Frontend framework: React (F294).

---

## 1. What Taska is

- **In one sentence**: one task list shared by you and your coding agents. You say what you want, agents do the
  work, and they come back to you only when they need you.
- **Who it is for**: people who build things with coding agents (Claude Code, Codex, Antigravity, any agent that can
  run curl); one person, data on their own machine.
- **The goal every change is measured against**: you get more done with less effort:
  1. A thought is captured in seconds, from anywhere; nothing you said is lost.
  2. Agents keep working without being watched and stop only for what really needs you.
  3. What needs you is visible at a glance and handled in one step (answer, approve, accept).
  4. You know where each thing stands without reading chat logs.

## 2. Concepts

### 2.1 Projects

- One Taska holds many projects, each with its own data.
- A project has a **name** (free to change) and an **address** (`/p/<address>`, fixed once created; agents and
  phone links depend on it).
- Each project has its own colour and initial tile, so you do not post into the wrong project.
- Projects can be reordered (drag), renamed and deleted; a deleted project can be restored in Settings > Projects,
  or deleted for good.
- Opening the address of a deleted project goes to the home page, which offers to restore it.

### 2.2 Items

- **Types**: feature, bug, idea (to be discussed first), task (a task or a reusable procedure), rule (see 2.6).
- **Codes**: type letter + number, e.g. F297, B299, I289, T293, R296. Numbers are unique within a project and never
  reused; the number of digits grows with the count. B3 = B03 = B0003.
- **Fields**: title, body (Markdown), priority P0-P3, now/later, status, parent (any depth), a one-line "next",
  sources (the inputs that made or added to it), creator, created and updated times, archived, merged into.
- **Statuses**:

| Status | Meaning | Who can set it |
|---|---|---|
| proposed | made by an agent or the organizer; waits for your approval | only you approve (set to open) |
| open | queued for an agent | anyone |
| doing | an agent has started | anyone |
| review | the agent says it is done | an agent's "done" becomes this |
| done | you accepted it | only you |
| dropped | you said won't do; an agent cannot reopen it | anyone; an agent cannot undo yours |

- **Merge**: an item can be merged into another; links and documents of the old code point to the merged one.
- **Archive**: any status can be archived; done or dropped items older than today are archived automatically when
  the list opens; reopening unarchives.
- **Subitems**: big items are split into subitems; an agent does the subitems first and the parent once they are all
  finished. Marking a parent done while subitems are open warns.
- **Delete**: an item is deleted together with its input, and can be restored from Deleted.
- **Move to another project**: a new item with the same content and talk is made there; the original is marked
  moved.

### 2.3 Inputs

- Everything you say is first stored verbatim as an input, code r360 (shown as #360 on the page, so it is not
  confused with rule R360).
- An input may hold any mix of text, links, screenshots, attachments and recordings; no type, priority or project
  has to be picked first.
- Two kinds: a **new input** (to the whole project) and a **reply** (written on an item; it carries that item).
- Inputs are "organized" into item changes: new, add to, split, merge, add to the talk, ask (section 5).
- You can edit, append to, undo the organizing of, move to another project, move to another item, remove an
  attachment from, and delete an input; every change keeps a history.
- An input sent to the wrong project can be moved.
- With the network down or the server restarting, inputs queue in the browser and are sent once it is back
  ("waiting to send").

### 2.4 The talk (each item's conversation)

- Your messages on the right (blue bubbles), agents' on the left.
- Agent message kinds: say, progress, ask (waits for your answer), block (stuck, waits for you), propose, decide,
  withdraw (takes back a question).
- **Questions can carry choices**: `- ( )` pick one, `- [ ]` pick any; one tap answers; multi-choice lists start
  with "All".
- Long messages: folded to their first line on the phone; height-limited on the desktop with "Show all".
- An agent's message can be hidden; your messages can be edited and appended to, with history.
- Codes in text (T12, D17, r360, #360) are links; on the desktop, hovering shows a card about it.

### 2.5 Documents

- Codes D1, D2...; each belongs to an item; the first line is the title, the body is Markdown (headings, lists,
  tables, code, images).
- **A document is part of its item** (like an artifact): commenting in a document is talking on the item; the
  comment also appears in the item's talk and agents receive and answer it as usual (r374).
- **Opening a document replaces the item in the same pane**, on the same page; comments show in the document next to
  their place.
- **Commenting in a document uses the item's input box**: no separate comment box; the line above the box says the
  target, e.g. "Comment on D20 paragraph 3" (R108).
- Mostly written by agents (plans, designs, research); you can create and edit them too. Every change keeps a
  version.
- **Comments**: on the whole document, a paragraph, selected text, or an area circled on an image; comments sit in a
  rail to the right of the paragraph (under it on the phone).
- Comments can be replied to, edited, moved, deleted, and resolved; a new comment reopens a resolved thread.
- After the document changes, paragraphs that did not change keep their comments.
- A table of contents lets you jump to a section.
- All documents have one list (Documents), newest first.

### 2.6 Rules

- Rules are standing requirements of a project (e.g. "commit messages are not in Chinese"), code R.
- Every agent reads the rules before it starts and follows them.
- Rules follow the same proposed -> approved flow.

### 2.7 Agents and the organizer

| Role | What it does |
|---|---|
| Organizer (optional, Gemini) | turns your inputs into item changes: new, add to, merge, ask; transcribes voice |
| Coding agent | takes items in order, works, writes back progress, asks, marks done |

- Without an organizer, inputs go straight to the coding agent to organize.
- A project can have several agents at once; each gets a different item and lets go after 30 quiet minutes.

## 3. "Needs you" and status display

The core judgement of Taska; v2 must match it exactly:

- **Needs you** = not closed, not merged, and either:
  1. an agent asks you or is blocked (an ask / block not answered yet); or
  2. it waits for your approval (proposed) or acceptance (review) and you have not replied yet.
- **Once you reply, you have spoken**: the item leaves Needs you and goes back to the agent (B286). The Approve /
  Accept buttons stay, so you can press them any time (B299). Replying without approving is not approving (R035).
- When the agent answers you and the item still waits for approval or acceptance, it is back in Needs you.
- While an agent waits for your answer, the item shows "waiting on you", never "in progress" or "Stuck" (R280).
- **Stuck**: in progress, but the agent has been quiet for a long time.
- The number next to each project = how many things need you there; the home page sums all projects.

## 4. The interface

### 4.1 Overall

- **Phone first**, only iPhone 393x852; the desktop is mainly 1440 wide. Light and dark both look good.
- Can be added to the phone's Home Screen (opens like an app) and receives push notifications.
- Addresses and pages map one to one; back and forward work; a reload returns to the same place.

### 4.2 Home page (all projects)

- One table: one row per project, with how many things need you, whether an agent is around, recent activity; tap to
  open.
- "Go through": walk everything that needs you in all projects, one by one.
- Search (Cmd+K) across projects.

### 4.3 The project page (three panes on desktop, one on the phone)

- **Left (a drawer on the phone)**: project list (with needs-you counts, drag to reorder), New input, and at the
  bottom Documents, Activity, Deleted, Settings.
- **Top**: project name, tabs Items / Inputs / Archive / Rules, the agent status ("Claude Code - 2m").
- **Middle: the list**. Items has sections:
  1. **Needs you**: each row has its action button on the right (Answer / Approve / Accept / Reply); beyond a few
     rows it folds into "Show N more"; Go through at the top.
  2. **Agent queue**: queued and in progress.
  3. **Later**: for later (agents do not take them).
  4. **Finished**: done and dropped, archivable in one step.
- Each row: round status icon, code, title, a second line (priority, status, subitem progress, message count,
  avatar of the agent working on it); unread rows have a small blue dot.
- Above the list: search, filters (type, status, priority, now/later, archived), sort. Search highlights the words.
- Row actions: on the desktop, icon buttons on hover and a right-click menu; on the phone, swipe right to move
  forward, swipe left for more, long press to preview.
- Multi-select: Cmd / Shift click selects several rows to change status, priority etc. together.
- Drag to reorder (queue order).
- **Right: the item page** (its own page on the phone):
  - Top: code, status, Done / Later / Archive / ... menu, previous / next, full width.
  - Title and property chips (status, priority, type, now/later, sources), editable in place.
  - Body, next, subitems, documents (newest first), attachments.
  - Needs-you cards (question, proposal, review) with their buttons inside.
  - The talk.
  - **The input box at the bottom** (the only one in the whole app, R108): the line above it says who it is for
    (reply to an item / new input / comment on a document); type, paste images, attach files, record (including
    "stop and send"); drafts save themselves, one per target.

### 4.4 Other pages

| Page | Contents |
|---|---|
| Inputs | every input, newest first; each shows what organizing did (items made/changed); desktop: list on the left, details on the right; waiting-to-send first |
| Archive | archived items |
| Rules | rule list; new rules can be added |
| Documents | all documents |
| Activity | every change in the project, newest first; your own changes can be undone |
| Deleted | deleted inputs and items, restorable |
| Settings > Agents | this project's agents: who is around, how to connect a new agent |
| Settings > Projects | all projects: rename, reorder, delete, restore |
| Settings > Use on your phone | phone link (with the key), new key |
| Settings > Notifications | push on/off |
| Settings > Voice spellings | fixed spellings for voice transcription |
| Settings > Organizer | whether the organizer is on and what it does; the "tidy the words" switch |

### 4.5 Other interactions

- **Go through**: walk what needs you one card at a time: answer / approve / accept / skip, with a summary at the end.
- **Cmd+K palette**: jump to any item, or run any action.
- **Shortcuts** (desktop, ? lists them): J/K move, Shift+J/Shift+K move among what needs you, A next step
  (accept/approve/answer), R reply, N send back, C new input, G S settings, and more.
- **Undo**: every quick action can be undone (Undo on the toast).
- **Toasts** and **tooltips** share one style.

## 5. Organizing (input -> items)

- The organizer reads the project's items and decides: new, add to an existing item, split, merge, add to the talk,
  or ask you.
- **The model decides what to change; code makes the change exactly**: the organizer outputs structured commands
  that code runs.
- Every change traces back to its input; organizing can be undone ("Undo organizing") and redone.
- A reply written on an item is added to that item, not organized again.
- With the organizer off or failing, the input goes to the coding agent; nothing is lost.

## 6. Voice

- Voice works everywhere: new input, reply, document comment.
- **Two models listen**: a main transcription model plus a speech-only model; where they heard different words is
  marked before sending; a note where nobody spoke is detected.
- The project's own words (item titles, file names, commands) are the context, so names, paths and commands are not
  "smoothed".
- **Fixed spellings**: select a wrongly transcribed word to add "always write it like this", shared by all projects.
- Optional "tidy the words" (drops filler words).
- A recording stays in the browser until sent; a lost connection or a restart never loses it; it can be sent first
  and its words added later.
- The original recording is always kept; the words are added to it.
- When recording fails on a phone, say which reason (no permission, not a secure connection, Home Screen app limits).

## 7. The agent interface (must stay exactly as it is)

All agents depend on these; v2 must be **fully compatible**:

| Request | What it does |
|---|---|
| `GET /p/<project>/agent` | the guide (agents read it first) |
| `GET /next?by=<name>` | what to do now: new inputs first, then items you replied on, then work in progress, then by priority, oldest first within one; subitems before parents; `?wait=540` waits until there is work |
| `GET /rules`, `/inbox`, `/items?...`, `/B03`, `/D1`, `/log` | rules, unorganized inputs, item list (one line each, filterable), one item, a document (numbered paragraphs and comments), recent changes |
| `POST /do?by=<name>` | write back: one command per line (new, status/priority/now-later, say/ask/block/progress..., doc, reply, ack, merge, archive...), indented lines continue the command above |
| `POST /api/file?name=` | upload an image or file; messages show it with `![](file name)` |
| `GET /connect` | one command connects an agent and installs the Taska skill |

- Replies are short plain text, to save tokens.
- Agents keep going: they take one item after another without stopping.
- Items an agent makes are proposals; an agent's done becomes review; an agent cannot approve or reopen what you
  dropped.
- The page shows which agent is around, what it works on, and how long it has been quiet.

## 8. Access, security, push

- Runs on this machine only; this machine and the local network need no key.
- From outside (a tunnel such as VS Code Dev Tunnels) a key is required; "Use on your phone" gives a link that
  carries the key and the phone remembers it after one visit. A new key can be made; other devices then lose access.
- Push: when something needs you, the phone (even with Taska closed) and the desktop get a notification.
- Local Hub (the machine's front door) links to Taska.

## 9. Data and history

- All data lives on this machine; attachments and recordings are plain files.
- **Every change is recorded**: who, when, what, from which input. Undo, history, Activity and traceability depend
  on it.
- Only what is sent to Gemini for organizing and transcription leaves the machine, and only when a key is set.
- v2 stores data in SQLite (D19); old data is imported by a migration tool and the old files are left untouched.

## 10. Requirements that do not change

- **Zero dependencies**: Python is enough; one command starts it (D19).
- **Fast**: opening and switching projects is fast (B292, T293); hundreds to thousands of items stay usable.
- **Nothing is lost**: inputs, drafts and recordings survive any network loss, reload or restart.
- **Quality rules** (R004, R108, R267, R272, R280...) still apply:
  - one consistent interface reusing the same parts, only one input box;
  - allow as much as possible, no needless limits;
  - questions to the user ask one thing per line, multi-choice lists start with "All";
  - before shipping, walk the whole flow, on the phone and in dark mode.

## 11. Known problems v2 solves along the way

| Problem | Source |
|---|---|
| Switching projects is slow (full page reload, 1-2 MB at once) | B292, T293 |
| Documents in messages open directly, and can be commented on in place | I289 |
| The list becomes a tree with preset views (All / Needs you / Queue / Later / Finished) and custom order | F291 |
| Phone: buttons moving under the finger, Go through feedback, archive and search state unclear, small issues | B302-B305 |
| Codes readable (links + hover cards) | F297, R296 |
