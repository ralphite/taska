# I693 Project rules as one document, with versions

Plan only: nothing in Taska changes until Yadong decides the questions at the end. The mock is in Storybook under
**Prototype / I693 Project rules as one document**.

## Goals

- One project has **one rules document**: Markdown, edited as a whole. No rule items, no list of rules.
- Every change is a **version**: who, when, why. The history lists them; any two can be compared; any one can be
  restored (the restore is a new version, so nothing is lost).
- Agents **propose** a change to the document; it waits for Yadong as a diff he approves or turns down. Yadong's own
  changes (typed, or said and placed by the organizer) apply at once.
- Agents read the document as it is now, and are told once when it changes, with what changed.
- **No backward compatibility** (r1118): rule items, their codes (R055) and every place that shows them are deleted,
  not kept readable. No text in Taska refers to a rule by code any more. The old rule records are kept only in the
  backup taken before the migration; nothing in the page reads them.

## How it works today

| Part | Where | What it does |
|---|---|---|
| Rule items | `domain/vocab.py` (type `rule`, letter R), `model/words.ts` `RULE_STATUS_WORD` | A rule is an item: title, body, statuses proposed / open ("Active") / dropped ("Retired"), archived, its own talk. |
| Rules in force | `domain/rules.py:133` `rules_in_force`, `is_rule_in_force` | Not proposed, not closed, not archived; ordered by priority. |
| Agents read them | `http/agent_routes.py:64-73`, `agent_text/render.py:208` `rules_text` | `/agent` says "N project rules, read GET /rules"; `GET /rules` prints each rule's code, title and body. |
| In `/next` | `agent_text/work.py:51-54` | "N project rules: read GET /rules once per session". |
| Told when changed | `services/agents.py:110` `rule_news` | Once per session: "rule changed, apply it from now on: R12 ..." or "rule ended". |
| Agents propose | `commands/items.py:90` | An agent's `new rule` is born `proposed`; only Yadong approves (`items.py:159`). |
| Organizer | `agent_text/organizer_text.py:12-17`, `services/organizer.py:32` | Makes or updates a rule only when Yadong plainly says it is one; reads the rules with every input; its changes apply at once (it acts for Yadong, `PEOPLE = ("you", "org")`). |
| Rules tab | `model/visible.ts:29`, `features/list/rows.ts:138`, `Filters.tsx`, `pages/headFacts.ts:21` | A list: Needs you (proposed), Active, Retired; status filter; tab count = active rules. |
| Rows and actions | `model/actions.ts:84-104`, `ListRows.tsx:188` | Approve / Won't do (proposed), Retire (active), Reactivate / Archive (retired); swipes; no priority, no Later. |
| Item page | `features/item/ItemPage.tsx:88-104`, `ItemMenu.tsx` | Title, status (Active), body, talk; no priority, Later, documents. |
| Elsewhere | `domain/finding.py:107` (search kind `rules`), `ui/Segments.tsx:29` (type picker), `help/topics.ts:199`, `services/workspace.py:41` | Search, the type picker, help, the items listed. |

The live project already writes its rules as **2 long rules with sections** (R055 and one more), so one document is
what it has become in practice.

Documents (`D<n>`) today: Markdown on an item (`domain/model.py:305` `Doc`), replaced whole by `D1 doc`
(`commands/docs.py:19`, event `DocWritten`), paragraph comments and threads, resolve, an editor (`DocEdit`), the
reading view (`DocView`) on desktop and phone. `Doc.versions` counts writes and **every `DocWritten` stays in the
event log**, so old texts exist, but nothing shows history, diffs or restore.

Nota's Markdown versions (the Nota project, F719, F735):

| What | Where |
|---|---|
| Every edit is a change record (op, by, before, after, state applied / suggested / undone); versions are derived from them: the same writer's changes less than 10 minutes apart are one version, each with who, when and a summary ("added 2 blocks, changed 1"). | `server/nota/views.py:301-349` |
| The page as it was at any time: `GET /notes/<n>/at?t=`. | `server/nota/server.py:518-521` |
| History screen: versions on the right grouped by day (avatar, time, who, what), the page as it was on the left with that version's changes marked (added green, removed struck red, a changed block shows its old words), a "Show what changed" switch, "Restore this version". | `web/src/components/PageHistory.vue` |
| Restore undoes every change after that time in one batch, so it is a version itself and Undo takes it back. | `server/nota/model.py:1855` |
| Rules are one page per note; an agent's (or the organizer's) change to rules is a **suggested** change, marked in place, kept or undone by the user. | `model.py:990-1000`, `model.py:1060-1062`, `agentapi.py:735` |
| Word-level diff: added underlined on green, removed struck in red. | `web/src/components/DiffText.vue` |

## The design

Data: the rules document is a `Doc` of the project (no item), `kind: "rules"`, one per project. Saving is the
existing `DocWritten` with two new fields: `why` (one line) and `src` (the input it came from). A version is one
`DocWritten`; history, diffs and restore are pure reads of the log (`domain/history.py`), as Nota derives them.
A proposal is a new event `DocProposed` (full new Markdown, the version it was written on, why, by) and
`DocDecided` (approved / turned down, by Yadong). Approving writes the proposal as the next version.

## Every related function: keep, change, remove

| Function | Now | After | |
|---|---|---|---|
| Rules tab | List of rule items | Opens the rules document; tab badge only when a proposal waits | change |
| Status filter, Active / Retired zones, rule rows, swipes, row actions | Yes | Gone (no list) | remove |
| Rule item page (R12) | Title, status, body, talk | Deleted with its talk; old codes in texts become the rule's title | remove |
| Item type `rule` (picker, `new rule`, letter R) | Yes | Gone; `new rule` refused with "use `rules propose`" | remove |
| Reading the rules | Rows, then each item | The document: headings, outline when long, paragraph comments | change |
| Editing | Each rule's title and body | Edit the whole document (`DocEdit`), optional "why" line | change |
| Agent reads `GET /rules` | Codes, titles, bodies | The Markdown, headed "version 8, Yadong, 11-05 14:20" | change |
| `/agent` and `/next` line | "N project rules: read GET /rules" | "Project rules v8: read GET /rules once per session" | change |
| Told when changed (`rule_news`) | Per rule | "rules changed to v9 by Yadong: <why>" and the changed sections as a diff | change |
| Agent proposes | `new rule` (proposed item) | `rules propose <why>`: replace, add or delete named sections (the whole text only when it says so) | change |
| Organizer | `new rule` / update a rule | Edits sections from Yadong's words (`rules edit <why>`), applied at once, src = the input | change |
| Yadong approves | Approve on the row or item | Proposal card on the document and a Needs you row: View changes, Approve, Not now | change |
| Talking about a proposal | The rule item's talk | Comment on the proposal (its thread); the agent answers and may propose again | change |
| Retire a rule | Status Retired | Delete its section; the version keeps it | change |
| Version history | None | List: who, when, why, lines added / removed; grouped by day | new |
| One version | None | The document as it was, its changes marked (Nota's look) | new |
| Diff between two versions | None | Default: a version against the one before; "Compare with now" | new |
| Restore | Reactivate one rule | Restore a version: a new version "Restored v5", toast Undo | new |
| Comments on the rules | Talk on each rule | Paragraph comments, as on any document; they stay with unchanged paragraphs | keep |
| Search (`finding.py`, kind `rules`) | Rule items | Sections of the document | change |
| Help topic Rules | Proposed / retired rules | One document, versions, proposals | change |
| Phone and desktop | List and item page | Same screens: pane on desktop, full sheet on the phone | change |

## Data migration (once per project, as events; no backward compatibility, r1118)

Measured on a copy of the live data (11-06):

| Project | Rule items | In force | Codes in texts now (messages / documents / item titles and bodies / rules / inputs) |
|---|---|---|---|
| taska | 72 | 2 (R055, R416) | 300 / 243 / 48 / 8 / 2 |
| lumina | 13 | 13 | 35 / 2 / 0 / 1 / 0 |
| xiaoming-laptop | 2 | 2 | 15 / 6 / 0 / 1 / 0 |
| dev2 | 4 | 2 | 13 / 0 / 0 / 3 / 0 |
| nextjob | 2 | 1 (+1 waiting for review) | 6 / 0 / 0 / 0 / 0 |
| macstudio | 2 | 2 | 3 / 2 / 2 / 0 / 0 |
| home, todos | 2, 1 | 2, 1 | 1 / 0 / 0 / 0 / 0 |

Most codes point at rules retired long ago (R488 alone is named 102 times in the event log).

1. Before anything, `tools/copy_data.py` copies the data root to `~/.taska/backups/<date>-before-i693`. That copy is
   the only home of the old rule items, their talk and their versions; Taska does not read it.
2. Version 1 of each project's rules document: the rules in force (and nextjob's rule waiting for review, as a
   proposal on version 1), in the order `/rules` gives them today, each a section `## <title>` then its body (the
   body's own headings one level down). By "taska", why "Rules moved into one document".
3. Every code of a rule item in the current texts (messages, documents' current versions, item titles and bodies,
   inputs, the rules themselves) is replaced by the rule's title in quotes, e.g. `R055` → `“沟通和工作方式”`; for a
   rule in force it links to that section of the document. One event per changed text, by "taska", why "rule codes
   removed"; it is not an edit of Yadong's and nobody is told.
4. All rule items are deleted with their talk: no archive, no item page, no list. `rule` leaves the item types
   (`vocab.py`), so `R` is no longer a code anyone can write; `new rule` is refused with "use `rules propose`".
5. A project with no rules gets an empty document only when someone first writes or proposes.
6. `tests/check_data.py`: every rule in force landed in version 1 word for word; no rule items are left; no text
   holds a code of a former rule. `web/src/removed.test.ts` gains the rule list, rule rows and rule codes.
## The mock

Storybook, **Prototype / I693 Project rules as one document** (`web/src/stories/i693/`), each on the phone and the
desktop. The look is Gemini's (`prototype/i693-gemini-mock.html`); the page's own parts draw it (PaneFrame, Sheet,
DocView with its comments, DocEdit, Rich, Avatar, Toast), new parts are in `RulesParts.tsx`. One change from Gemini:
Approve is Taska's Approve blue, as everywhere else, not black.

| Story | Shows |
|---|---|
| Reading, a proposal waiting | The document, its comments, the bar: v8 · who · when; History, Copy, Edit |
| Editing, with why | Today's editor and one "Why" line under the bar |
| Version history | Versions by day (who, time, why, +/−, Now); desktop: the version beside the list |
| One version, its changes | v7: removed struck red, added green; Show changes, Compare with now, Restore |
| A version compared with now | v5 against v8 |
| Restoring: it asks once | "Restore v5? It becomes v9. Nothing is lost." |
| Restored, with Undo | v9 = v5's text, toast "Restored v5 · Undo" |
| A proposal opened | The proposal's diff; Comment, Not now, Approve |
| A proposal approved | The card in place, buttons disabled, "Approved" |

## For Yadong to decide

| # | Question | Recommended |
|---|---|---|
| 1 | An agent's change to the rules | Waits as a proposal for Approve (as today); never applied silently |
| 2 | The organizer's change from Yadong's own words | Applied at once, marked as from his input, Undo in the toast (as today) |
| 3 | Old codes like R055 | Gone everywhere: each code in today's texts becomes the rule's title (r1118) |
| 4 | Retired rules and old rule items | Deleted with their talk; only the backup keeps them, no screen reads it (r1118) |
| 5 | What one version is | Each save; saves by the same writer less than 10 minutes apart are one (Nota) |
| 6 | A proposal made on an older version | Taska tells the agent to write it again on the current one; Yadong only approves proposals on the current version |
| 7 | "Why" with a change | Optional for Yadong, required for agents and the organizer |
| 8 | How a diff looks | One column, changes marked in place (green added, red struck), phone and desktop alike |
| 9 | Where the rules live | The Rules tab opens the document; it is not listed under Documents |
| 10 | Rules shared by all projects | Not in this change |

## Review of this plan (after r1118)

What changed, and why:

| # | Before | Now | Why |
|---|---|---|---|
| 1 | Old rule items archived, readable; codes link to sections | Deleted; codes in texts replaced by titles; backup only | r1118: no backward compatibility |
| 2 | Agents and the organizer send the whole new document | They name the sections they replace, add or delete; the server writes the version | R055 is long: a model that retypes the whole text drops or changes words it did not mean to; a section edit can be checked and diffed exactly |
| 3 | Agents told "rules changed, GET /rules" | Told the why and the changed sections | Agents should not reread a long document for a small change |
| 4 | One version = saves less than 10 minutes apart, each with a why | The merged version shows every why it holds, newest first | Otherwise a why is lost when two saves merge |
| 5 | A proposal on an old version is sent back | Sent back only when a section it changes has changed since | Proposals about untouched sections stay valid; fewer round trips |

Risks I checked:

- The rules document has no item, but `Doc` today belongs to an item (`Doc.n`). The rules document gets `n = 0` and
  `kind "rules"`; the places that look up the item (`commands/docs.py` uses `s.items.get(d.n)`) treat 0 as the project. Comments,
  threads and the editor work on the doc; each lookup of `d.n` is checked when this is built.
- Replacing codes in messages changes old words; it is limited to the code itself, the rest of each text stays byte
  for byte, and the backup holds the originals.
- Search, the type picker, help, `/agent`, `/next`, filters, counts and stories that name rules all change in the
  same change, with `removed.test.ts` locking the rule list, rows and codes out.
