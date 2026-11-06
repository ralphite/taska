# I693 Project rules as one document, with versions

Plan only: nothing in Taska changes until Yadong decides the questions at the end. The mock is in Storybook under
**Prototype / I693 Project rules as one document**.

## Goals

- One project has **one rules document**: Markdown, edited as a whole. No rule items, no list of rules.
- Every change is a **version**: who, when, why. The history lists them; any two can be compared; any one can be
  restored (the restore is a new version, so nothing is lost).
- Agents **propose** a change to the document; it waits for Yadong as a diff he approves or turns down. Yadong's own
  changes (typed, or said and placed by the organizer) apply at once.
- Agents read the document as it is now, and are told once when it changes.

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
| Rule item page (R12) | Title, status, body, talk | Gone; old codes open the document at its section | remove |
| Item type `rule` (picker, `new rule`, letter R) | Yes | Gone; `new rule` refused with "use `rules propose`" | remove |
| Reading the rules | Rows, then each item | The document: headings, outline when long, paragraph comments | change |
| Editing | Each rule's title and body | Edit the whole document (`DocEdit`), optional "why" line | change |
| Agent reads `GET /rules` | Codes, titles, bodies | The Markdown, headed "version 8, Yadong, 11-05 14:20" | change |
| `/agent` and `/next` line | "N project rules: read GET /rules" | "Project rules v8: read GET /rules once per session" | change |
| Told when changed (`rule_news`) | Per rule | "rules changed to v9 by Yadong: GET /rules" (with its why) | change |
| Agent proposes | `new rule` (proposed item) | `rules propose <why>` + the whole new text, indented | change |
| Organizer | `new rule` / update a rule | Edits the document from Yadong's words (`rules edit <why>`), applied at once, src = the input | change |
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

## Data migration (once per project, as events)

1. Order the rules in force as `/rules` does today (`by_priority`).
2. Version 1 of the rules document: each one a section, `## <title>` then its body (a body's own `##` headings go one
   level down). By "taska", why "Rules moved into one document".
3. Proposed rule items become proposals on version 1 (each appends its section), by the agent that proposed them.
4. Retired, proposed and active rule items are archived and stay readable (their talk too); they are no longer type
   `rule`. Old codes (R055) link to the section made from them.
5. A project with no rules gets an empty document only when someone first writes or proposes.
6. `tests/check_data.py` checks every rule in force landed in version 1, word for word.

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
| 3 | Old codes like R055 | No codes in the document; an old code opens it at that section |
| 4 | Retired rules | Not in the document; kept in history and as archived items |
| 5 | What one version is | Each save; saves by the same writer less than 10 minutes apart are one (Nota) |
| 6 | A proposal made on an older version | Taska tells the agent to write it again on the current one; Yadong only approves proposals on the current version |
| 7 | "Why" with a change | Optional for Yadong, required for agents and the organizer |
| 8 | How a diff looks | One column, changes marked in place (green added, red struck), phone and desktop alike |
| 9 | Where the rules live | The Rules tab opens the document; it is not listed under Documents |
| 10 | Rules shared by all projects | Not in this change |
