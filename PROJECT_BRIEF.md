# Taska: project idea and UI drafts

First written on 2026-10-08; last updated on 2026-10-09. It is based on the whole discussion: the first ideas and
everything added later. Later additions never override earlier requirements. Taska is the local folder name; the
product name is not decided yet.

(Translated from the original Chinese on 2026-10-11. The README describes what Taska is today; this brief records
where it started.)

## 1. The problem

Taska is a minimal, local, single-user tool for working with any coding agent (for example Claude Code or Codex).
It keeps you and the agent agreed on tasks, background, decisions and next steps, all the time.

While developing, bugs, small features, to-dos and ideas worth digging into come up at random. Handed straight to an
agent, they get forgotten, missed, or worked on with an outdated understanding.

Today the user writes these down in a Google Doc, with comments or different colours for discussion. That is free
enough, but it makes structure and the current conclusions hard to maintain. The new tool should keep that
directness and cut the cost of recording and communicating.

In the original conversation the user corrected "Copilot Agent" to **coding agent, from any vendor**. Other unclear
bits of voice transcription are not taken as new requirements.

## 2. Core use: free input, the system organizes, and everyone stays aligned

1. **Write it down the moment you think of it.**
   - One free-form input takes any mix of text, links, one or more images, attachments and voice recordings.
   - You never have to pick a type, a priority or an owner first.
2. **Keep the raw material.**
   - Every input is first stored as the original record.
   - Recordings are kept and can be passed to the processor.
   - A transcript is an optional extra and never replaces the audio.
3. **One queue for everything.**
   - Global input is about the whole project.
   - Text or a voice comment under an item carries that item's context automatically.
   - Both go through the same processing.
4. **An agent or language model understands and organizes it.**
   - Using what the project already holds, it decides to create, update, split or merge items, add to a
     discussion, or ask a clarifying question.
   - The processor can be a local agent or a language model; how it is connected is decided later.
5. **Structured operations do the change.**
   - A plan can be generated or shown on request: what to add, which field to change, what to merge into what.
   - The plan can be executed by code: a deterministic executor updates the data.
   - The model decides what to change; code makes the change exactly.
6. **Every change can be traced.**
   - Every item, decision and edit can be traced back to its original input, the plan and the result.
   - The original text, images, audio and the change history are kept.

## 3. Items and the discussion on each one

### Scale

- Everyday use means **hundreds of items**.
- The UI must make browsing, finding, organizing and moving work forward easy anywhere from **10 to 1000 items**.
- That is the range to design and test for, not a limit.
- Whether the UI works cannot be judged from a handful of sample items.

### The four main types

"Item" is the general word; `task` is one specific type and does not mean every to-do.

| Type | Meaning |
| --- | --- |
| feature | A capability to add or improve. |
| bug | A problem to find and fix. |
| idea | Something still vague that needs discussion and exploration. It does not have to be a clear requirement or plan when it is entered. |
| task | A reusable process, instruction or action description for an agent to understand and carry out. It can be reused, and an agent can base a recurring schedule on it. |

A task can describe a few steps, one action, or a process to repeat.
- It does not have to recur.
- It needs no frequency, no step array and no complex workflow.
- Its meaning is written in natural language; the agent works out how to carry it out.

### Codes and priority

- **Codes.** A row starts with its code: `T0001`, `B0002`, `F0003`, `I0004`.
  - T/B/F/I stand for task/bug/feature/idea.
  - The number has at least four digits, zero-padded. Past 9999 it simply grows a digit; it is never cut off or
    reset.
- **No repeated type.** The code already shows the type, so the row does not repeat it in words. Filtering by type
  stays.
- **Priority.** It is always `P0`, `P1`, `P2` or `P3`. It sits on the second line under the title, next to
  waiting-for-reply, progress and attachment information.
- **What codes are for:** search, source references, organizing plans, and the instructions copied to an agent.

### What every item can do

- **Fields and size.** Every item has a priority, now / later, and progress. Bigger items can be nested, split
  into subtasks, and keep growing.
- **Discussion.** Each item holds your additions and the agent's feedback, questions, proposals, updates and
  progress.
- **Clear state.** At any time you can see the current understanding, the decisions made, the open questions and
  the next step. Suggestions are never confused with decisions.
- **Editing.** You can edit an item directly, or tap it and add to it by voice; that goes through the same queue.
- **Light types.**
  - Types and attributes exist, but the organizer can set them first and you adjust them later.
  - The four types are a light way to understand and organize. They need no schemas, field models or state
    machines of their own.

## 4. Voice is a core capability

- **Voice everywhere it can be.** Creating items, editing titles and text, adding background and replying in
  discussions should all work by voice. Options should work spoken too, such as "make it high priority", "put it
  for later" or "split it into two subtasks".
- **Context.** Transcription uses the whole project's text and the current item as context by default. It prefers
  existing terms, names, file paths, code identifiers and terminal commands.
- **Your own terms.** You can add priority words, context and exact correction rules.
- **Technical content stays exact.** Transcription never "fixes" a command, path or name to make a sentence
  smoother.
- **Checking.** You can see and edit the transcript. When something is ambiguous, Taska asks.

## 5. Two agent roles

| Role | Job |
| --- | --- |
| Organizer (agent or language model) | Consumes the input queue, understands the project's context, proposes structured operations, maintains items and discussions. |
| Coding agent | Reads the project and its items, develops, and writes questions, plans, progress, results and checks back to the item. |

- **Open to any agent.** The data should be easy for any outside agent to read and update efficiently.
- **Links.** You can copy a link to the project or an item and reference it in an existing coding agent session.
- **Getting started.** The simplest start is a usage page with one button that copies a complete prompt, telling
  the agent how to read, discuss and update. A skill can come later.
- **Scope now.** Full agent integration is not built at this stage.

## 6. UI principles and the final direction

- **Minimal and fast.** Compact, quick to enter, little to read. No space-hungry decoration, unrelated
  explanations or features without value. Simple must not become crude or miss core capabilities.
- **Scale.**
  - Design for hundreds of items, and check usability at 10, 100 and 1000.
  - What matters: finding the relevant items quickly, seeing what needs attention, seeing context and carrying
    on, plus how fast the list responds and how much there is to read.
  - Users must not have to expand items one by one or scroll the whole list to manage them.
  - The current mock scrolls continuously and searches everything, with no pagination. The type filter is always
    visible; time and status filters open on demand.
- **The final direction is one working page plus one free input box.** Items expand in place, and what you add is
  attached to the current item.
- **The item outline** shows now / later, type, priority, subitems, questions waiting for a reply and the next
  step.
- **Light feedback.** Show only what was received, what it was organized into, and whether a reply is needed. The
  raw material, the exact plan and the change history open on demand.
- **Other views.** Input records and items are two separate views. There is also an entry for inputs still to be
  organized, the voice context settings, and a copyable usage guide for agents.
- **Why this version.** The user found an early two-column version complex and crude, and asked for a redesign
  based on all the ideas. **The last one-page version that was generated** is the baseline to reproduce.

### The input box (from phone screenshots)

- **Layout.** A compact pill like ChatGPT's: plus, text, a preview switch, microphone and send on one line.
  Focusing it brings no second row of tools.
- **Images and files.** Screenshots can be pasted straight in. The plus adds images, files or image links.
  Thumbnails of the material show only when there are attachments.
- **Recording.** While recording, the pill itself shows cancel, a waveform, stop and send. Stopping returns to
  editing the text, with the transcript available on demand. Cancelling keeps the text and images already there.
- **Preview.** With preview on, sending first shows the organizing plan; with it off, organizing goes straight
  ahead. Recording and organizing are still mocked here.

### Phone first, images and documents

- **Phone and desktop.** Both count, and they may use different layouts and interactions. Acceptance starts on
  the phone. **Being extremely easy to use, clear and simple is the top priority**: fewer taps, no useless
  explanations, no unreasonable steps.
- **No pagination.** A thousand items can scroll continuously, and search covers everything. The input tools stay
  on one line; long text grows upwards and does not take reading space for long.
- **Images.**
  - Most items may contain images, including links and pasted screenshots.
  - Wide, tall, very long or any other size must be readable.
  - Items show image references and thumbnails directly. Tapping opens full screen, zooms, or scrolls at original
    size. Images must not be hidden inside the raw input.
- **One copy of the material.** Original images and links stay in the input record, and the item references the
  same material. If an image fails to load, its original link stays and loading can be retried.
- **Files.** A few files can be attached too. Markdown and text files show their content; other files keep an open
  or download entry.
- **Documents.**
  - A document is a light concept of its own, separate from ordinary attachments, and can be linked to an item.
  - The agent's plans, architecture designs and the like go here. They are discussed with the user and iterated
    here, instead of making the user go back to the agent's own UI.
  - Markdown documents can be read, edited, and commented inline per paragraph, with replies.
  - On the phone the way to comment is always visible and does not rely on hover. Going back and forth keeps the
    reading position and drafts.
- **Comments survive edits.**
  - A comment keeps the original text it quotes.
  - When the text is rewritten or deleted, comments must not be lost or silently moved to another paragraph.
  - In this round of the mock they stay as "the original text changed".
- **Not needed now:** a full collaborative document system, or complex version, permission or workflow models.
  Real agent write-back is not connected yet.

## 7. Technical constraints

- **Portable.** A simple local web app that can be moved to another machine and run there.
- **Stack.** Python plus HTML / JavaScript / TypeScript; Tailwind CSS is fine. **No Node.js.**
- **Storage.** Prefer files that are easy to read and update, such as JSON or YAML. The storage format is not
  final yet.
- **Meaning first, no over-engineering.**
  - An item's process, intent, steps and requirements are described mostly in natural language, for an agent to
    understand and use in the end.
  - No complex task type system, workflow schema or execution model.
- **Minimal structure.**
  - Keep only the structure needed to find items, link sources and record changes.
  - The structured operation plans mentioned earlier exist to create, update and merge app data
    deterministically. They do not mean a task's description must become a process language.
- **Recurring work.** An agent can work out recurring schedules or execution instructions by analysing a task. The
  app does not have to build a full scheduler or workflow engine now. How this connects is decided later.
- **One user.** The main case is one user working with coding agents, not tied to any coding agent product.

## 8. The earlier mock and its limits

On 2026-10-08 the requirements were recorded and the final UI mock was reproduced locally. On 2026-10-09 the local
mock was updated for the new requirements:

- **Sample size.** 100 items by default; the More menu switches between 10, 100 and 1000 sample items. All
  results scroll continuously, with no pagination and no "load more" button.
- **Search and filters.** Search covers titles, text and codes. Type, now / later and status filters can be
  combined, and the number of results is shown.
- **Types.**
  - Four types: feature, bug, idea and task.
  - Old "to-do" samples became features.
  - New reusable tasks show natural-language instructions and "Copy for agent".
  - Ideas have a place for discussion.
- **Scrolling and drafts.**
  - The list scrolls on its own while the free input stays visible.
  - Changing filters keeps drafts and edits in progress.
  - Jumping from a source, or to a newly added result, lands on that item.
- **Kept from the original:** expanding in place, adding to items, the recording sample, attachments, the queue,
  plans, merging, input records and history.

The 10 / 100 / 1000 item cases, full search, combined filters, editing, discussion and the phone layout were
checked on a real local server.

That mock was a demonstration only:
- Data lived in page memory, and reloading brought the samples back.
- Recording, transcription and agent organizing were simulated by sample logic.
- Some buttons, such as saving voice settings and item links, only showed the interaction.
- Attachments could be picked and images previewed, but nothing was persisted.

The full product has to really store the raw inputs, call the processor and keep the history. The mock must not be
taken as having those abilities.

### Implementation questions that were still open then

- The audio and transcription service, and how the project context is built.
- The file storage format, the attachment folder, and the minimal data structure that links items, sources,
  plans and changes.
- How the organizer runs, when plans are applied automatically, and the recovery and undo strategy.
- The exact protocol coding agents use to read and write back: files, an API, links or a skill.

## 9. The last UI mock

The design started from a UI draft made in a ChatGPT conversation: one working page with a free input box. It was
then reproduced locally and updated twice: on 2026-10-09 for hundreds of items and natural-language tasks, and
afterwards for the phone first (continuous list, images and documents in an item, paragraph comments, a one-line
input box with four-digit codes and recording in place). That mock has since been replaced by the real app in
`taska.py`.
