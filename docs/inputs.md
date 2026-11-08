# What happens to an input

An input is one thing the user says: typed words, a voice note, pictures and files, or several of them together. This
is where it goes from the moment it is sent to the items it lands on. Each rule names where it was decided, so it can
be checked one by one. How a voice note is written out: D121; every state of a voice message and what each place shows
in it: [voice.md](voice.md). Taska's own copy of this page in Chinese: D126 (B714).

```mermaid
flowchart TD
    A["The user says something<br/>typed, a voice note or a picture"] --> W{"Where?"}
    W -->|"New input"| P["A new line in Inputs"]
    W -->|"In an item"| S["A new line in Inputs<br/>and the user's message in that item's talk"]
    P --> V["A voice note: first words in about 2 s<br/>then its tidied words, used everywhere"]
    S --> V
    V --> O["The organizer reads the input<br/>once its words are final, at most 150 s"]
    O --> D{"What does it ask for?<br/>one input can do several things"}
    D -->|"Something new"| N["A new item<br/>a short title; all the user's words about it as its body"]
    D -->|"An existing item, said on New input"| E["Added to that item<br/>a sentence or two about it"]
    D -->|"Other items mentioned in passing"| X["Written on those items<br/>each gets only the part about it"]
    D -->|"Priority, Later, done, won't do"| F["The item's fields change"]
    D -->|"Plainly a rule"| R["The rules document changes"]
    D -->|"A question or request for an agent"| G["Left for an agent<br/>it stays in the agent's queue"]
    D -->|"Hello, thanks, an answer to an agent"| Z["Nothing to do"]
    D -->|"Unsure"| Q["A question card for the user<br/>on the new item or the item spoken in"]
    N --> N2["The new item: body, pictures, voice notes, From 1 input<br/>its talk is empty"]
    N --> C["Said in an item: under the user's message there<br/>a line: Created B713"]
    E --> M["A new message of the user's words in that item's talk<br/>marked with the input it came from"]
    X --> M
    F --> F2["The item's header shows the new fields"]
    R --> R2["A new version of the rules document"]
    G --> G2["The Inputs line says For an agent"]
    Z --> Z2["The Inputs line says Handled<br/>said in an item: Added to that item"]
    D -.-> NO["Never<br/>an organizer note on an item it just made<br/>an organizer note on the item spoken in<br/>the whole input pasted into another item<br/>the user's words rewritten or cut"]
    classDef never stroke-dasharray: 5 5
    class NO never
```

## Rules

| # | Rule | Source |
|---|---|---|
| 1 | Every input stays in Inputs as it was said; its line says what it became (Created B713, Added to T03, For an agent, ...) | B629 |
| 2 | Words said in an item show at once as the user's message in that item's talk (tidied words), without waiting for the organizer | B703 r1144, #10330 (replaced the choice in #10294) |
| 3 | The organizer writes no message on the item the input was said in: no repeat and no rewording; what needs doing it does by changing things | B703 r1141, #10330 |
| 4 | The organizer writes no message on an item it just made from the input: the item already shows the words, pictures and voice notes | B714 r1167 |
| 5 | The one message the organizer may write on those two items is a question for the user (an ask, with choices when there are some), when it is unsure; its notes and proposals there are dropped | B714 #10594 |
| 6 | An input said in an item that makes new items shows one line under the user's message there: → Created B713 (several: → Created B713, F714), each code opening its item; the same on the phone and the desktop | B714 #10594 |
| 7 | A new item's body is all the user's words about it, tidied: only fillers and words said twice go; never shortened, reordered or rewritten | F432, T697 (D121, B696) |
| 8 | A voice note's words word for word are only for the organizer to judge whether a word was misheard; they never go into a body | T697 (D121) |
| 9 | Another item mentioned in an input gets a sentence or two about it, marked with the input; the whole input is never pasted there | B452 |
| 10 | The rules change only when the user plainly says it is a rule ("rule", "from now on always ..."); anything the product or agents should do is an item | the organizer's instructions |
| 11 | A question or request for an agent is left for the agent; whatever else the input says still becomes items | the organizer's instructions |
| 12 | New items are P1 and Now; the user's own words ("urgent", "later") win | r10, r1072, R055 #9566 |
| 13 | When the organizer cannot be reached, Taska asks it again by itself; the user never presses Retry | T424 |

Where they are kept: rules 3 to 5 in `echo` (`server/taska/services/organizer.py`, tested in
`tests/test_organizer_echo.py`), the rest of the organizer's side in its instructions
(`server/taska/agent_text/organizer_text.py`); rule 1 in `web/src/model/became.ts` (`becameOf`) and
`web/src/model/inputStates.ts` (below), rule 6 in `web/src/model/became.ts` (`madeFrom`) and
`web/src/features/item/Talk.tsx`; rule 13 in `server/taska/domain/input_states.py` (`transient`) and
`web/src/model/outgoingStates.ts`.

## Where each case shows

| Case | Inputs | The new item | The item spoken in | Other items |
|---|---|---|---|---|
| Something new, on New input | Created B713 | body = the words; pictures, voice notes; From 1 input; empty talk | | |
| An existing item, on New input | Added to T03 | | | T03's talk: a message with the part about it |
| More detail, or an answer to an agent, in an item | Added to T03 | | only the user's message | |
| "Make it P0", "done" in an item | Added to T03 | | the user's message and the changed fields; no organizer note | |
| Something new, in an item | Created B713 | as in the first row | the user's message, with → Created B713 under it | |
| F12 mentioned in passing | also Added to F12 | | | F12's talk: a message with the part about it |
| Unsure what was meant | as the rows above | a question card, when it is the new item | a question card | |
| Plainly a rule | Changed the rules | | | a new version of the rules |
| A question for an agent | For an agent | | | in the agent's queue |
| An input edited after it was sent | read again, and left for an agent too | its items follow the new words | | |

## On its way to Taska

From Send until Taska has it, an input is on its way: in the page's outbox, kept in this browser, sent in order and
again until Taska has it (rule 13: when Taska cannot be reached it goes again by itself; Retry is only for one Taska
said no to). Its phases, every way between them (the event that causes it) and what each place shows in each phase,
its words, their colour and what can be done there, are defined once, in `web/src/model/outgoingStates.ts` (T728 #2);
every place that shows something on its way reads it there, and the outbox changes only by its steps (`outStep`). The
diagram and the table below are made from that file, and `web/src/model/outgoingStates.test.ts` fails when they differ
from it. A voice message on its way is in the voice state its phase names (Sending, Waiting for Taska, Not sent:
[voice.md](voice.md)). Once Taska has it, what became of it is below.

<!-- made from outgoingStates.ts: outgoingDiagram() -->
```mermaid
flowchart TD
    start(("Send"))
    gone(("gone"))
    uploading["Uploading"]
    sending["Sending"]
    waiting["Waiting for Taska"]
    notSent["Not sent"]
    reloaded["Sent before a reload, its files going up"]
    takenBack["Taken back while going out"]
    start -->|"Send"| uploading
    start -->|"Send · The page reloaded"| sending
    start -->|"The page reloaded"| reloaded
    reloaded -->|"Its files up"| sending
    uploading -->|"Its files up"| sending
    sending -->|"Goes out"| sending
    uploading -->|"No answer for a while"| waiting
    sending -->|"No answer for a while · Taska out of reach"| waiting
    waiting -->|"Taska answers again · Tried again (by itself, sooner once Taska is back)"| sending
    sending -->|"Taska said no"| notSent
    notSent -->|"Retry"| sending
    waiting -->|"Edit: back in the box · ×"| gone
    notSent -->|"Edit: back in the box · ×"| gone
    waiting -->|"Edit: back in the box · ×"| takenBack
    uploading -->|"×"| gone
    sending -->|"× · Taska has it"| gone
    sending -->|"×"| takenBack
    takenBack -->|"Taska has it · Taska said no"| gone
    takenBack -->|"Taska out of reach · Tried again (by itself, sooner once Taska is back) · Goes out"| takenBack
```

The tone in brackets is the colour: busy blue and moving, partial amber (it waits, nothing to do), failed red. ×
cancels it: it is not sent (one going out right now is deleted as soon as Taska has it). Edit takes it back into the
box to change it.

<!-- made from outgoingStates.ts: outgoingPlacesTable() -->
| Phase | its row in the desktop's New input list | the line over the phone's box (New input) | its row on the Inputs page | your bubble in the item's talk | an answer, on its question's card in the item's talk |
|---|---|---|---|---|---|
| Uploading (`uploading`) | Uploading… (busy) · × | Uploading… (busy) · × | Uploading… (busy) · × | Uploading… (busy) · × | Uploading… (busy) |
| Sending (`sending`) | Sending… (busy) · × | Sending… (busy) · × | Sending… (busy) · × | Sending… (busy) · × | Sending… (busy) |
| Waiting for Taska (`waiting`) | Waiting for Taska… (partial) · Edit × | Waiting for Taska… (partial) · Edit × | Waiting for Taska… (partial) · Edit × | Waiting for Taska… (partial) · Edit × | Waiting for Taska… (partial) |
| Not sent (`notSent`) | Not sent (failed) · Retry Edit × | Not sent (failed) · Retry Edit × | Not sent (failed) · Retry Edit × | Not sent (failed) · Retry Edit × | Not sent (failed) |
| Sent before a reload, its files going up (`reloaded`) | — | — | — | — | — |
| Taken back while going out (`takenBack`) | — | — | — | — | — |

## What became of it

Once Taska has an input, what became of it is one of the states below. Every state, every way between them (the event
that causes it) and what each place shows in each state, its words, their colour and what can be done there, are
defined once, in `web/src/model/inputStates.ts` (T728 #1); the state with what it names (the items, why it failed,
where it went) is worked out in one place, `becameOf` (`web/src/model/became.ts`), and every place reads both. The
diagram and the table are made from that file, and `web/src/model/inputStates.test.ts` fails when they differ from
it. Each state names the voice state a voice message is in then ([voice.md](voice.md)).

Taska's side of the same way is `server/taska/domain/input_states.py`: queued, organizing, failed, again (a failure the
service only was busy for: asked again by itself), undone, left, agents, handled, cancelled, moved, deleted, with the
steps between them; the organizer takes what it says is queued, an agent's inbox holds what it says is theirs, and
Undo of a filing goes through only when the organizer filed it and that filing is there to take back. Whether a
failure goes away by itself is one rule there (`transient`), told to the page as `org.again`: such an input is
Organizing, never Retry (rule 13).

<!-- made from inputStates.ts: inputDiagram() -->
```mermaid
flowchart TD
    start(("sent"))
    transcribing["Its words to come"]
    organizing["Organizing"]
    filed["Made or changed items"]
    answer["An answer on its item"]
    agent["For an agent"]
    note["Nothing filed, the organizer said why"]
    handled["Handled"]
    failed["Couldn't organize"]
    undone["Its filing undone"]
    cancelled["Recording kept as cancelled"]
    moved["Moved to another project"]
    start -->|"Taska has it"| transcribing
    start -->|"Taska has it"| organizing
    start -->|"Taska has it"| agent
    start -->|"Esc (New input: kept)"| cancelled
    cancelled -->|"Send"| transcribing
    cancelled -->|"Send"| organizing
    cancelled -->|"Send"| agent
    transcribing -->|"Its words in"| organizing
    transcribing -->|"Its words in"| agent
    organizing -->|"Made or changed items"| filed
    organizing -->|"Filed as an answer"| answer
    organizing -->|"Nothing to file, said why"| note
    organizing -->|"Nothing to do"| handled
    organizing -->|"Left for an agent"| agent
    organizing -->|"Service busy: asked again by itself"| organizing
    organizing -->|"Organizer failed"| failed
    failed -->|"Retry · Edited after sending"| organizing
    failed -->|"Retry · Edited after sending"| agent
    undone -->|"Organize · Edited after sending"| organizing
    undone -->|"Organize · Edited after sending"| agent
    filed -->|"Undo"| undone
    answer -->|"Undo"| undone
    agent -->|"An agent did it"| filed
    agent -->|"An agent did it"| handled
    filed -->|"Edited after sending"| organizing
    filed -->|"Edited after sending"| agent
    answer -->|"Edited after sending"| organizing
    answer -->|"Edited after sending"| agent
    agent -->|"Edited after sending"| organizing
    agent -->|"Edited after sending"| agent
    note -->|"Edited after sending"| organizing
    note -->|"Edited after sending"| agent
    handled -->|"Edited after sending"| organizing
    handled -->|"Edited after sending"| agent
    filed -->|"More voice said into it"| transcribing
    answer -->|"More voice said into it"| transcribing
    agent -->|"More voice said into it"| transcribing
    note -->|"More voice said into it"| transcribing
    handled -->|"More voice said into it"| transcribing
    any(("any state")) -->|"Moved to another project"| moved
```

The tone in brackets is the colour: busy blue and moving, failed red, done green, quiet grey, plain the items it went
to as links. Retry and Organize show only while the organizer is on to take it; Undo only where Taska would take back
what the organizer filed (`filing.can`); Move only when there is another project; Open goes to what it went to.

<!-- made from inputStates.ts: inputPlacesTable() -->
| State | its row in the desktop's New input list | its row on the Inputs page | the line over the phone's box (New input) | under your message in the item's talk | its menu (⋯, a long press) and Move |
|---|---|---|---|---|---|
| Its words to come (`transcribing`) | as model/voiceStates says it (busy) | as model/voiceStates says it (busy) | as model/voiceStates says it (busy) | as model/voiceStates says it (busy) | (nothing to do) |
| Organizing (`organizing`) | Organizing… (busy) | Organizing… (busy) | Organizing… (busy) | — | (nothing to do) |
| Made or changed items (`filed`) | its items: Created B014 · Added to F012 (plain) | its items: Created B014 · Added to F012 (plain) | its items: Created B014 · Added to F012 (plain) · Open, Undo, Move to… | → Created B713 (the items it made there) (plain) | Undo, Move to… |
| An answer on its item (`answer`) | Answer to T007 (plain) | Answer to T007 (plain) | Answer to T007 (plain) · Open, Undo, Move to… | — | Undo, Move to… |
| For an agent (`agent`) | For an agent (quiet) | For an agent (quiet) | For an agent (quiet) · Move to… | — | Move to… |
| Nothing filed, the organizer said why (`note`) | the organizer's words (quiet) | the organizer's words (quiet) | the organizer's words (quiet) · Move to… | — | Move to… |
| Handled (`handled`) | Handled (done) | Handled (done) | Handled (done) · Move to… | — | Move to… |
| Couldn't organize (`failed`) | Couldn't organize · why (failed) · Retry | Couldn't organize · why (failed) · Retry | Couldn't organize · why (failed) · Retry | — | Move to… |
| Its filing undone (`undone`) | Undone (quiet) · Organize | Undone (quiet) · Organize | Undone (quiet) · Organize | — | Move to… |
| Recording kept as cancelled (`cancelled`) | Cancelled (quiet) · Send | Cancelled (quiet) · Send | — | — | Send, Move to… |
| Moved to another project (`moved`) | Moved to Shop (plain) · Open | Moved to Shop (plain) · Open | Moved to Shop (plain) · Open | Moved to Shop (plain) · Open | — |

## Never

- The organizer writes a note or a proposal on an item it just made, or on the item the input was said in (a
  question for the user is the one message it may write there).
- The whole input is pasted into another item.
- The user's words are rewritten, shortened or summed up by the organizer's own reading of them.
- The user has to press Retry because the organizer could not be reached.
