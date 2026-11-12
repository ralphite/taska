"""The words agents read, kept word for word (they are the agent interface, a spec, not code): the command
grammar, the guide (/agent, with {base}, {grammar}, {rules}), the skill agents install (/skill), and the connect
script (/connect, with {name}, {base}, {host})."""

GRAMMAR = (
    "WRITE (plain text, one command per line; indented lines continue the previous command's text):\n"
    '  new bug P1 now parent=B03 src=r12 Export ignores the active filter\n'
    '                            type (feature|bug|idea|task), priority (P0-P3), now|later, parent= and src= are\n'
    '                            each optional and go before the title as plain words, no brackets\n'
    '    <optional body, indented>\n'
    "  B03 P1 later doing        set priority / when / status / type, any mix (status: open|doing|done|drop; drop = won't do)\n"
    '  B03 later until 2026-11-10    Later until that day: then it is back to now by itself\n'
    '  B03 done <text>           words after the fields (and indented lines) are posted as progress, e.g. the done report\n'
    '  B03 title|body|next <text>      replace that field (body may continue on indented lines)\n'
    '  B03 say|ask|propose|decide|progress <text>     add to the thread: ask = question for the user, also when\n'
    '                                  you are stuck and need something from them (say what you need),\n'
    '                                  withdraw = take back your open ask (say why),\n'
    '                                  propose = suggestion (not decided), decide = decision made\n'
    '  B03 say @worker <text>    to another agent session (its session= name): it gets B03 on its next /next or /do reply\n'
    '  B03 merge F01             merge B03 into F01 (use only for clear duplicates)\n'
    '  B03 delete                delete an item you proposed that the user has not answered (an alarm that went away)\n'
    '  Messages and docs are Markdown (lists, **bold**, `code`, links). Show an image where it belongs with\n'
    '  ![what it shows](f12-a.png): upload it first with\n'
    '  curl -s BASE/api/file?name=a.png -H \'Content-Type: image/png\' --data-binary @a.png   (prints its "f")\n'
    '  B03 say files=f12-a.png,f13-b.png <text>   images attached below the message instead\n'
    '  B03 ask <question>        with indented choices the user taps: "- ( ) option" lines = pick one (yes/no too),\n'
    '                            "- [ ] option" lines = pick any. The reply lists the picks as "✓ option".\n'
    '                            Several things to ask: one ask each, in a row. The user answers them in one card;\n'
    '                            the reply has a line each, "- <question> → ✓ option" (or their words), and the\n'
    '                            questions not answered yet keep waiting.\n'
    '  B03 doc [title]           new document on B03 (plans, designs); its Markdown is the indented lines, first line = title\n'
    "  D1 doc [new title]        replace D1's Markdown with the indented lines; comments stay with unchanged paragraphs\n"
    '                            a ```mermaid block is drawn as a diagram. Keep it small and plain: flowchart or\n'
    '                            sequenceDiagram only; every node label in double quotes (A["Save (draft)"] --> B["Done"]);\n'
    '                            no HTML but <br/>; no special characters outside quotes. One that does not draw comes\n'
    "                            back to you on the doc's item with Mermaid's reason: fix it\n"
    '  B03 html [title]          new web page document on B03: the indented lines are HTML (scripts allowed), shown as a page\n'
    '  D1 html [new title]       replace D1 with the indented HTML\n'
    '  D1 reply ¶3 <text>        answer the comments on paragraph 3 of D1 (¶3.2: its second thread, as /D1 names it)\n'
    '  B03 archive|unarchive     hide a done/dropped item from the default lists (reopening unarchives)\n'
    '  rules propose <why>       propose a change to the project rules (the user approves or declines it); indented\n'
    '                            under it, each change: replace ## <section> / add ## <section> [after ## <section>]\n'
    '                            / delete ## <section>, its new text indented under that line (whole: all of it)\n'
    '  rules reply P12 <text>    answer the user on your proposal P12\n'
    '  ack r12 r13               mark inputs handled without changing items\n'
    "  project icon f12-logo.png    the project's picture in place of its letter (e.g. its app's favicon): a png, svg,\n"
    '                            ico, webp or jpg up to 256 KB, uploaded as above; project icon none = the letter again;\n'
    '                            which picture to pick: ICON below\n'
    '  $ means the item created earlier in the same request. Refs: B03, b3, 3 are the same item.'
)

AGENT = (
    "Taska is the user's tracker for features, bugs, ideas and tasks. BASE={base}\n"
    'Item code = type letter (F/B/I/T) + number; padding may change as the list grows, B3 = B03.\n'
    '\n'
    'READ  (plain text)\n'
    '  curl -s BASE/next         what to do now: the inbox first, items the user replied on, then the next item  <- start here\n'
    '  curl -s BASE/inbox        unprocessed user inputs: raw text, scoped item, files\n'
    '  curl -s BASE/items        open items, one line each: code pri when status title [flag] [^parent]\n'
    '                            flag: ? you asked (waits on the user) / < the user replied\n'
    '                            filters: ?q=word&type=bug&pri=P0&when=now&status=all|open|doing|done|dropped&wait=1&reply=1&archived=1|all&limit=60\n'
    '  curl -s BASE/B03          full card: fields, body, thread, files (image/audio paths are readable from disk)\n'
    '  curl -s BASE/rules        project rules: one document of standing instructions; follow the parts that apply\n'
    '                            (when they change while you work, your next /next or /do reply says so once, with\n'
    '                            what changed: follow it from then on; the same when this guide changes)\n'
    "  curl -s BASE/D1           a document: numbered paragraphs (¶) with the user's comments under each\n"
    '  curl -s BASE/log?n=30     recent changes\n'
    '  optional on any call: &session=<the title your app shows for this session> (or the header X-Taska-Session), so\n'
    '                            the user can tell your sessions apart; and "&sid=$CLAUDE_CODE_SESSION_ID$CODEX_THREAD_ID"\n'
    '                            (the shell fills in your session\'s id; keep the URL in double quotes), so the user\n'
    '                            sees when the session waits on them\n'
    '\n'
    '{grammar}\n'
    "  curl -s BASE/do --data-binary @- <<'EOF'\n"
    '  B03 doing\n'
    '  B03 progress Reproduced it: the export ignores the filter\n'
    '  EOF\n'
    '\n'
    'Now: {rules}\n'
    'LOOP  doing means you are working on it now. Mark an item doing when you start; when you hand back a result, set it\n'
    '      done (the user reviews it) or ask what you need: never leave a result\n'
    '      sitting in doing (T646). If you stop working on it, set it back to open. Keep going: take /next, mark it doing, do the work, write progress and set done, then GET /next\n'
    "      again. Don't stop to chat. If you are stuck or need a decision, post `B03 ask <what you need>` and\n"
    '      move on; /next brings the item back once the user replies. Nothing to do: end your turn. Never wait in\n'
    '      the foreground, poll, or set a timer or scheduled task (heartbeat, cron, automation) to look at Taska:\n'
    '      never wake a model just to check for messages, at any frequency. No foreground polling loops either.\n'
    '      Resume only for a real user message or a confirmed new-work event. Claude Code: before ending the turn,\n'
    '      start this with Bash run_in_background and end the turn; Taska holds it until there is work, so it costs\n'
    '      no tokens while it waits and your session resumes only when it ends with work:\n'
    '      `while o=$(curl -s "BASE/next?wait=540&by=claude-code&sid=$CLAUDE_CODE_SESSION_ID"); [ -z "$o" ] || echo "$o" | grep -q \'nothing to do now\'; do sleep 20; done`\n'
    '      Other agents without such a background command: report once that delivery is unavailable and end the turn.\n'
    '      While you work, a /do reply ending "N new inputs since your last /next" means the user wrote meanwhile:\n'
    '      finish the step you are on, then GET /next. Handle pushed messages at the normal message boundary.\n'
    '      Big items have subitems (parent=B03): /next gives you the subitems first and the parent once they are\n'
    '      finished; split big work the same way with `new ... parent=B03`.\n'
    '      Always call /next and /do with ?by=<your name>: with several agents on one project, /next gives each of you\n'
    '      its own item and lists "others are on (skip)": another agent holds those, leave them. A hold lapses after\n'
    '      30 minutes without a word from that agent.\n'
    '      /next picks items marked now, ideas included: an idea is something to think through; do it when small\n'
    '      and clear, otherwise propose a plan and ask.\n'
    'YOURS Items you create start as proposed: the user approves them before anyone works on them. `B03 done`\n'
    "      from you puts the item in review; the user accepts it. Write item content in the user's language.\n"
    '      A question left: ask it instead of done. One after done: set the item back to doing, then ask (r809).\n'
    '      The message with done has four parts, in this order: Result (what is different now, one line); How to\n'
    '      check (where to look or what to tap); What changed (a short list); a picture of it (T274 #41).\n'
    'WHO   Add ?by=<you> (claude-code, codex, antigravity) to /next and /do: the user sees whether an agent is around.\n'
    'TELL  The user reads Taska only, often on a phone: never your terminal or chat. Everything they should see\n'
    "      (what you did, how you checked it, screenshots, plans, questions) goes into the item's messages.\n"
    '      First line = the conclusion in one sentence; the page folds long messages to it. Then details, short,\n'
    '      in Markdown, images inline (see `say` above). Don\'t post "starting now": the status already says doing.\n'
    '      More than 10 lines (a plan, research, a checklist, a long report): write it as a document (`B03 doc`),\n'
    '      choices to tick included, and post one line that names it, e.g. "The plan is in D2; tick at the end".\n'
    '      Name items, documents and inputs by their code (B03, D2, r12): the page links each code and shows a card\n'
    '      about it on hover. A code alone means little to the user: the first time a message names one, add a few\n'
    '      words on what it is, e.g. "D2 (the release plan)".\n'
    "RULES Reuse existing items (/items?q=) instead of duplicating. Keep the user's wording. Never turn a\n"
    '      suggestion into a decision: use propose/ask and wait. Commands with src=rN (or ack rN) mark that\n'
    '      input handled; if an input is a question for you, answer it in the related item (or tell the user) and ack it.\n'
    'ASK   Ask only when a wrong guess would do damage that is hard to undo: spending money, sending something to\n'
    "      someone, deleting, or a choice of scope or design that is the user's to make. Otherwise take the most\n"
    '      likely answer from what you already know (their address, their earlier choices), say the assumption in\n'
    '      one line, and finish the work; the user corrects you if needed. Never ask what they already said (r814).\n'
    "ICON  The project's icon (`project icon`) is how the user tells projects apart in the collapsed sidebar, drawn in a\n"
    '      rounded square from 16 to 40 px, on a light plate in light and dark. What works best, in this order (T744):\n'
    "      1. The project's own mark: its app's favicon or app icon (the repo's public/ or static/ folder,\n"
    '         apple-touch-icon, the web manifest\'s icons, a logo.svg), or its website\'s favicon. SVG, or a square PNG\n'
    '         of 128 px or more; not a wide logo or a wordmark.\n'
    "      2. No mark of its own (e.g. a project called Home): make a small SVG yourself: one simple glyph for what\n"
    '         the project is about (a house for Home), filled, white on one solid colour that fills the square, no text,\n'
    '         no gradients or fine lines; pick a colour the other projects\' icons and letters do not use.\n'
    "      Never another company's logo for a project that is not theirs. Readable at 16 px: look at it small before\n"
    '      setting it; say what you chose and why on the item.\n'
    '\n'
    "MANAGER MODE (optional: if your app can't run two sessions this way, work alone as above)\n"
    '      A manager session hands items to worker sessions and runs them in parallel; it never edits code itself.\n'
    '      Unrelated items go to different workers at the same time, each in its own working copy; related items go to\n'
    '      the worker already on them. A new item that outranks what the busy workers are on goes out at once, to an idle\n'
    '      worker or a new one: a P0 never waits behind a P2 (B656).\n'
    '      Manager: picks items from /next and the threads, claims each for its worker with /next?by=<worker>, sends the\n'
    '      worker its item (or a short list of related ones), sleeps until an event below, merges and ships finished\n'
    '      work, and puts what needs the user on the item. Worker: does its items and writes progress/done/ask on each\n'
    '      itself (&session=<worker>); never polls Taska, never waits on the user, keeps working while a background\n'
    '      command runs, says on the item before a step longer than 15 minutes, and ends every turn with a message there.\n'
    '      Never stuck: workers run where nothing prompts for approval (a refused command is refused; it takes\n'
    '      another route); the manager never waits on a prompt or on a worker. A stuck worker: stop its turn, hand\n'
    '      the item out again, say why on the item.\n'
    '      The manager continues only for a real user update, a worker result, or a confirmed failure event.\n'
    '      Elapsed time, silence or an empty queue is never a reason to wake a model.\n'
    '      Reuse a worker for related items; between items, compact it once its context passes about 40%.\n'
    '      Cost: the done message ends with one line: active minutes, fresh tokens, cache-read tokens, steps, from\n'
    '      tools/session_usage.py <worker session.jsonl> --since <start> --until <end>.\n'
    '      Claude Code: each worker is a resident session; send it a session message (both in the same permission\n'
    '        mode), or `claude -p --resume <session> --permission-mode auto --output-format json "<brief>"`.\n'
    '      Codex: use the native send_message_to_thread tool only for authorized real work. Do not launch a relay\n'
    '      model. For automatic Taska updates, follow the Codex setup below.\n'
    '      Antigravity: a subagent per item, as in its own section below.\n'
    '\n'
    'MANAGER NEVER BLOCKS (T652)\n'
    '      A manager does four things only: reads and writes Taska, sends messages to task sessions, checks what they\n'
    '      hand back, and writes that back to Taska.\n'
    "      A new manager session first registers itself: `python3 tools/install_manager_guard.py add` in Taska's\n"
    '      folder (Codex: add --harness codex). That installs a hook that rejects at once, without a prompt, browser,\n'
    '      computer and simulator tools, questions in chat (use `ask` on the item instead) and edits outside its own\n'
    '      memory and temp folders; the reason says to hand the work to the task session that owns it. Task sessions\n'
    '      are not affected.\n'
    '      A blocked task session reports it to the manager; the manager writes it on the item for the user and\n'
    '      never does the blocked step itself.\n'
)

SKILL = (
    '---\n'
    'name: taska\n'
    "description: Work with Taska, the user's per-project tracker of features, bugs, ideas, tasks and rules (a small local web app). Use when the user mentions Taska or item codes like B03 or F12, asks you to work on, continue or keep working through the tasks, or when the project folder has a .taska file.\n"
    '---\n'
    '\n'
    '# Taska\n'
    '\n'
    'Taska runs on this machine. You read and update it with curl; every reply is short plain text.\n'
    '\n'
    "1. **Find it.** The project's `.taska` file (in the current folder or a parent) holds its URL, for example\n"
    '   `http://127.0.0.1:7340/p/myapp`. No file: `curl -s http://127.0.0.1:7340/api/projects` lists the projects;\n'
    '   pick the one for this folder or ask the user. Below, BASE is that project URL.\n'
    '2. **Learn it once per session.** `curl -s BASE/agent` is one page with every read and write command.\n'
    '   Then `curl -s BASE/rules` and follow the project rules that apply to what you are doing.\n'
    '3. **Work the loop.** Say who you are on /next and /do with `?by=claude-code` (or `codex`, `antigravity`): the\n'
    '   user\'s phone shows whether an agent is around. Add `&sid=$CLAUDE_CODE_SESSION_ID$CODEX_THREAD_ID` too (in\n'
    '   double quotes; the shell fills in your session\'s id): Taska then shows your session and when it waits on the\n'
    '   user. `curl -s "BASE/next?by=claude-code&sid=$CLAUDE_CODE_SESSION_ID$CODEX_THREAD_ID"` says what to do: the inbox first, then items the user replied on,\n'
    '   then the next item by priority. Mark the item doing, do the work, write progress back, then mark it done\n'
    '   (it goes to the user for review). Ask /next again.\n'
    "4. **Keep going.** After each item, take the next one; don't stop to chat.\n"
    '   - After your last item, always check /next once more. Nothing to do: end your turn. Never wait in the\n'
    '     foreground, poll, or set a timer or scheduled task (heartbeat, cron, automation) to look at Taska: each\n'
    '     scheduled checks for messages are forbidden at any frequency, including hourly or daily.\n'
    '   - No foreground polling loops or repeated reads while waiting. Resume only for a real user message or a\n'
    '     confirmed new-work event. Claude Code: start this with Bash run_in_background and end the turn (Taska\n'
    '     holds it until there is work: no tokens while it waits):\n'
    '     `while o=$(curl -s "BASE/next?wait=540&by=claude-code&sid=$CLAUDE_CODE_SESSION_ID"); [ -z "$o" ] || echo "$o" | grep -q \'nothing to do now\'; do sleep 20; done`\n'
    '     Others: if delivery is unavailable, report it once and end the turn.\n'
    '   - Codex: automatic updates use the native queue setup below. Do not use a second CLI writer\n'
    '     or a relay model. Other agents do not use this Codex-specific transport.\n'
    '5. **Need the user?** Post `B03 ask <what you need or your question>`, then take the next item.\n'
    '   /next brings it back once the user replies. When the answer is a choice, list it under the question as\n'
    '   indented `- ( ) option` lines (pick one) or `- [ ] option` lines (pick any): the user taps instead of typing.\n'
    '6. **The user reads Taska only**, usually on a phone, never your terminal or chat. Whatever they should see goes\n'
    '   into the item: what you did and how you checked it, screenshots, plans, questions. **The first line is the\n'
    '   conclusion in one sentence**: the page folds long messages to it. Messages are Markdown:\n'
    '   short paragraphs and lists, images inline with `![what it shows](f12-a.png)` after uploading\n'
    "   (`curl -s BASE/api/file?name=a.png -H 'Content-Type: image/png' --data-binary @a.png`).\n"
    '   Name items, documents and inputs by code (B03, D2, r12), and the first time add a few words on what each is,\n'
    '   e.g. "D2 (the release plan)": the page turns codes into links with a card on hover, but a bare code means little.\n'
    '7. Items you create start as proposed until the user approves them. Never treat a suggestion as decided.\n'
)

CODEX_WORKERS = """
## Codex: visible worker sessions

For Taska work, the main session creates or reuses 1-3 visible worker sessions in the
same Codex project. These workers are ordinary sessions the user can open, not hidden
subagents. The main session assigns work and aims to remain idle; it sends new requirements
to the relevant worker session, steering it when it is busy.

Worker sessions read Taska and write progress, questions, and results directly to Taska.
A worker may use subagents when useful for its task.

Reuse suitable worker sessions and match assignments to actual work; avoid duplicate
execution and creating workers with no task.
"""

CODEX_DELIVERY = """
## Codex desktop: event delivery

Taska sends a short notice through the native Codex queue and requests desktop processing.
An idle session starts a turn; a busy session handles the queued notice after its current
turn ends. No delivery hook or busy/idle check is needed. No new update means no model call,
timer or message polling. This Codex-specific transport does not change other agents.

Bind the existing session authorized for this project by POSTing to BASE/api/codex-notifications:
{"threadId":"<existing-session-UUID>"}
Use the project's existing connection for BASE. No hook installation or reload is required.

On a Taska notice, use the existing project connection to read Taska and distribute the work
as described above. Workers write progress, questions, and results directly to Taska.
There is no separate notification acknowledgement. When nothing needs action, end the turn.
If delivery fails, report it once; no polling fallback or scheduled retry.
"""
ANTIGRAVITY = """
## Antigravity: one main session, a subagent per item (F755)

This section is for Antigravity only; Claude Code and Codex work as described above.

One Antigravity session runs a project: the main session (Yadong runs it on Opus 5.5 high). It only
dispatches: it takes work from Taska, starts a subagent for each item, and passes the user's new words on.
It does not do the items itself.

1. **Start.** Your session id is $ANTIGRAVITY_CONVERSATION_ID: use it as sid on every call. Take the project:
   `curl -s "BASE/next?by=antigravity&sid=$ANTIGRAVITY_CONVERSATION_ID&lead=1"`. A newer session that does
   this takes over; then your /next answers "replaced": stop and say so in one line.
2. **An item: a subagent of its own.** For each item /next gives you, mark it doing, then start a subagent
   with invoke_subagent, named by the item, e.g. "B754 drag to reorder":
   - code or design work: the `taska-code` subagent (your model: Opus 5.5 high);
   - anything else: the `taska-work` subagent (pro: the best Gemini);
   - a model the user names on the item wins.
   Its prompt: the item code, BASE, and "read BASE/<code>, do it, write back on it". Then take /next again.
3. **New words on an item that has a subagent:** send them to that subagent (`agentapi send-message
   <its conversation id> "<the item card from BASE/<code>>"`), never a second subagent for the item.
   Keep the list item -> subagent id; it is also on the item (each subagent says it in its first message).
4. **Nothing to do:** start the background wait /next gives you and end the turn. It holds until Taska has
   work, then sends it to you as a message (agentapi send-message to yourself): you wake in seconds.
5. **Subagents** never call /next and never wait for Taska. They write progress, done and ask on their item
   with `curl -s "BASE/do?by=antigravity&session=<its name>&sid=$ANTIGRAVITY_CONVERSATION_ID"`, the done
   message as the rules say; after an ask they end their turn: the main session brings them the answer.
"""

AGENT += CODEX_WORKERS + CODEX_DELIVERY.replace("{", "{{").replace("}", "}}") + ANTIGRAVITY.replace("{", "{{").replace("}", "}}")
SKILL += CODEX_WORKERS + CODEX_DELIVERY + ANTIGRAVITY

# F755: the subagents the Antigravity main session starts, one per item (~/.gemini/config/agents/<name>.md)
_SUB = """---
name: {name}
description: {what}
model: {model}
---

You do one Taska item. Your prompt names it and BASE, the project's Taska URL.
- Read `curl -s BASE/agent` once, then `curl -s BASE/rules` and `curl -s BASE/<code>` (the item), and do the work.
- Write back on the item only: `curl -s "BASE/do?by=antigravity&session=<your name>&sid=$ANTIGRAVITY_CONVERSATION_ID"
  --data-binary @-` with `<code> progress <text>`, `<code> done <the done message>` or `<code> ask <question>`.
  Your first message on it says your conversation id ($ANTIGRAVITY_CONVERSATION_ID), so new words reach you.
- Never call /next and never wait for Taska: after an ask, or when done, end your turn. New words on the item
  come to you as a message from the main session.
- The user reads Taska only, usually on a phone: what they should see goes on the item, in their language.
"""
ANTIGRAVITY_AGENTS = {
    "taska-code": _SUB.format(name="taska-code", model="inherit",
                              what="Does one Taska item that is code or design work, on the main session's model."),
    "taska-work": _SUB.format(name="taska-work", model="pro",
                              what="Does one Taska item that is not code or design (research, writing, data), on the best Gemini."),
}

CONNECT = (
    '#!/bin/sh\n'
    "# Connects the current folder to the Taska project {name}. Run it in the project's folder on the machine\n"
    '# where your coding agent works:  curl -s {base}/connect | sh\n'
    'set -e\n'
    "printf '%s\\n' '{base}' > .taska\n"
    'for d in "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.gemini/config/skills"; do\n'
    '  if [ -d "$(dirname "$d")" ]; then\n'
    '    mkdir -p "$d/taska" && curl -fsS \'{host}/skill\' -o "$d/taska/SKILL.md" && echo "skill: $d/taska/SKILL.md"\n'
    '  fi\n'
    'done\n'
    'if [ -d "$HOME/.gemini/config" ]; then  # F755: the subagents Antigravity starts for Taska items\n'
    '  mkdir -p "$HOME/.gemini/config/agents"\n'
    '  for a in taska-code taska-work; do\n'
    '    curl -fsS "{host}/antigravity-agents/$a.md" -o "$HOME/.gemini/config/agents/$a.md" && echo "subagent: $a"\n'
    '  done\n'
    'fi\n'
    'echo "This folder now points to Taska project {name}: {base} (saved in .taska)"\n'
)
