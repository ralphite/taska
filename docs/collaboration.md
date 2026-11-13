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
| 2. Knowing who is here | The page shows who is around. `/next` lists the items others hold ("others are on (skip)"). | An agent is not told the other agents and sessions, or what each is on, when it connects. |
| 3. No unknowing double work | `/next` gives each agent session its own item and holds it for that session; others skip it. A hold lapses after 30 minutes without a word from the holder. | An agent told about an item some other way (by you in its chat, by reading the item) can mark it `doing` while another session holds it, and is not warned. |
| 4. Settling it | `B03 say @<session> ...` writes to another session; it gets it on its next `/next` or `/do` answer, and a waiting session wakes for it. Words another agent writes on an item you are on come to you the same way. | Nothing says what to do when you find an item held: wait, or write to the holder. |
| 5. Your hand-over | Antigravity only: a newer session that takes the project over replaces the one before, which is told to stop. | No hand-over of one item from one agent to another at your word. |
| 6. On the item | Every message says who wrote it and from which session. | Hand-overs and holds do not show on the item. |

## What to build next

In order of what it prevents:

1. **Warn on taking a held item.** `B03 doing` from a session while another one holds it answers with who holds
   it and since when, and does not take it unless the agent says it takes over on your word.
2. **Hand an item over at your word.** One command to hand it over, written on the item; the agent that had it
   hears "stop: handed to <agent> at the user's word" on its next call, as Antigravity's replaced session does.
3. **Who is here, on connecting.** The first `/next` of a session lists the other agents and sessions, what each
   is on, and when each was last seen; later calls say only what changed.
4. **What to do when an item is held.** The guide says: leave it and take the next one; write to the holder when
   you need something from it; never change it without your word.
