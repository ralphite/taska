# What happens to an input

An input is one thing the user says: typed words, a voice note, pictures and files, or several of them together. This
is where it goes from the moment it is sent to the items it lands on. Each rule names where it was decided, so it can
be checked one by one. How a voice note is written out: D121. Taska's own copy of this page in Chinese: D126 (B714).

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
(`server/taska/agent_text/organizer_text.py`); rule 1 in `web/src/model/became.ts` (`becameOf`), rule 6 in the same
file (`madeFrom`) and `web/src/features/item/Talk.tsx`.

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

## Never

- The organizer writes a note or a proposal on an item it just made, or on the item the input was said in (a
  question for the user is the one message it may write there).
- The whole input is pasted into another item.
- The user's words are rewritten, shortened or summed up by the organizer's own reading of them.
- The user has to press Retry because the organizer could not be reached.
