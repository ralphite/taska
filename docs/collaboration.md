# Agents working together

Taska is where different agents (Claude Code, Codex, Antigravity, and several sessions of each) work on one
project over a long time, organized by items rather than by chat transcripts. This page says what that has to
mean, and what Taska does for it today.

## The goal

Several agents of different kinds work on the same project, on and off, for weeks. For that to work:

1. **Every agent hears about work.** Whatever the agent, a new item or your reply reaches it without you
   reminding it, and costs nothing while there is no work.
2. **A new agent knows who else is here.** When an agent connects, it learns which other agents and sessions
   work on the project, what each one is on, and how recently it was seen.
3. **Two agents never do the same item unknowingly.** An agent that is about to work on an item another one
   holds is told so first, before it changes anything.
4. **Agents can settle it themselves.** The newcomer can leave the item to the holder and wait, or write to
   the holder and work it out with it.
5. **You decide, and it holds.** You can hand an item from one agent to another; the one that had it is told to
   stop, and stops.
6. **Everything is on the item.** Who did what, who handed what to whom, and what the agents said to each other
   is in the item's conversation, where you can read it.

## What Taska does today

| Goal | Today | Missing |
| --- | --- | --- |
| 1. Hearing about work | Claude Code holds `GET /next?wait=540` in the background and wakes when it returns. Codex gets a short message from Taska for each update from you. Antigravity keeps Taska's waker running in its own terminal, which wakes it with a message when it is idle and there is work. A voice note is sent once its words are final. | Other agents: none. They read `/next` when they run. |
| 2. Knowing who is here | The page shows who is around; its Agents dialog lists every session by its app, each with its state (working, idle, waiting for you, gone), the item it is on, and a manager's workers under it (a worker says `&parent=<manager>`). `/next` lists the items others hold ("others are on (skip)"). | Done: a session's `/next` says which other sessions are here, what each is on and when each was last heard of (first, then when it changes). |
| 3. No unknowing double work | `/next` gives each agent session its own item and holds it for that session; others skip it. A hold lapses after 30 minutes without a word from the holder. | Done: `B03 doing` on an item another session holds is refused with who holds it and how to go on. Making an item no longer holds it. |
| 4. Settling it | `B03 say @<session> ...` writes to another session; it gets it on its next `/next` or `/do` answer, and a waiting session wakes for it. Words another agent writes on an item you are on come to you the same way. | Done: the guide says: take the next one, write to the holder when you need it, never change it without your word. |
| 5. Your hand-over | Antigravity only: a newer session that takes the project over replaces the one before, which is told to stop. | Done for any agent: `B03 take` at your word; the one that had it is told on the item to stop. |
| 6. On the item | Every message says who wrote it and from which session. | Hand-overs and holds do not show on the item. |

## Design choices

Each of these is decided; a change to one is Yadong's call. Unit tests pin them (tests/test_held_items.py,
tests/test_antigravity_waker.py, tests/test_agent_sessions_view.py, tests/test_codex_notifications.py,
tests/test_organizer_replies.py, web/src/features/agents/agentsFacts.test.ts), and `python3 tools/collab_check.py`
checks them with real agent sessions on the real Taska.

- **What holds an item.** A session holds an item when `/next` gives it to it or when it changes it (`doing`,
  a field). Making an item does not hold it: an agent's proposal, once approved, is anyone's. A message does not
  move a hold. A hold lapses after 30 minutes without a word from its session.
- **Doing another session's item.** `B03 doing` on an item another session holds is refused, with who holds it,
  when it was last heard of, and what to do: take the next one, write to it, or `B03 take` only when the user asked.
  A manager's worker (`&parent=<manager>`) is not refused its manager's item: the manager hands it on.
- **Taking over.** `B03 take` holds the item for the new session and writes on it, addressed to the session that had
  it, that it is taken over at the user's word and to stop; that session hears it on its next call.
- **Who is here.** A session's `/next` lists the other agent sessions heard of in the last day, the item each is on
  and when each was last heard of: on its first `/next`, then only when who is here or what they are on changed,
  not as time passes.
- **Talking to each other.** `B03 say @<session> ...` reaches that session on its next `/next` or `/do` answer, and
  a waiting session wakes for it. What another session writes on an item you are on reaches you the same way.
- **Hearing about work.** Claude Code holds `/next?wait=540` in the background. Codex gets one short message per
  update from you, a voice note's once its words are final. Antigravity keeps Taska's waker running in its own
  terminal (`BASE/waker`), started again before every turn ends; the waker wakes it only when it is idle and there
  is work, once, and again only if it stays silent ten minutes. Only when you write and no waker has waited for 15
  minutes is it said, once, as a proposed item, deleted when a waker waits again.
- **Your replies on an item.** A reply on an item always stays in the agent's inbox; the organizer never acks it and
  never changes that item's status from it (it may still set priority or Now/Later, and make items for other things).
- **Agents dialog.** Every session by its app (Claude Code, Codex, Antigravity, then Others), a worker under its
  manager; its state as its app says (Claude Code, Codex), else by when it was heard of; Codex quiet for 10 minutes
  counts as gone (it says idle long after it closed). The way back: Claude Code's own link, Codex's resume command,
  none for Antigravity.

## What to build next

Hand-overs and holds are said on the item as messages; a mark of who holds an item, on the item's page and its row,
is still to come.
