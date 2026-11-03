"""The words agents read, kept word for word (they are the agent interface, a spec, not code): the command
grammar, the guide (/agent, with {base}, {grammar}, {rules}), the skill agents install (/skill), and the connect
script (/connect, with {name}, {base}, {host})."""

GRAMMAR = (
    "WRITE (plain text, one command per line; indented lines continue the previous command's text):\n"
    '  new bug P1 now parent=B03 src=r12 Export ignores the active filter\n'
    '                            type (feature|bug|idea|task|rule), priority (P0-P3), now|later, parent= and src= are\n'
    '                            each optional and go before the title as plain words, no brackets\n'
    '    <optional body, indented>\n'
    "  B03 P1 later doing        set priority / when / status / type, any mix (status: open|doing|done|drop; drop = won't do)\n"
    '  B03 done <text>           words after the fields (and indented lines) are posted as progress, e.g. the done report\n'
    '  B03 title|body|next <text>      replace that field (body may continue on indented lines)\n'
    '  B03 say|ask|block|propose|decide|progress <text>     add to the thread: ask = question for the user,\n'
    '                                  block = you are stuck and need the user (say what you need),\n'
    '                                  withdraw = take back your open ask/block (say why),\n'
    '                                  propose = suggestion (not decided), decide = decision made\n'
    '  B03 say @worker <text>    to another agent session (its session= name): it gets B03 on its next /next or /do reply\n'
    '  B03 merge F01             merge B03 into F01 (use only for clear duplicates)\n'
    '  Messages and docs are Markdown (lists, **bold**, `code`, links). Show an image where it belongs with\n'
    '  ![what it shows](f12-a.png): upload it first with\n'
    '  curl -s BASE/api/file?name=a.png -H \'Content-Type: image/png\' --data-binary @a.png   (prints its "f")\n'
    '  B03 say files=f12-a.png,f13-b.png <text>   images attached below the message instead\n'
    '  B03 ask <question>        with indented choices the user taps: "- ( ) option" lines = pick one (yes/no too),\n'
    '                            "- [ ] option" lines = pick any. The reply lists the picks as "✓ option".\n'
    '  B03 doc [title]           new document on B03 (plans, designs); its Markdown is the indented lines, first line = title\n'
    "  D1 doc [new title]        replace D1's Markdown with the indented lines; comments stay with unchanged paragraphs\n"
    '  B03 html [title]          new web page document on B03: the indented lines are HTML (scripts allowed), shown as a page\n'
    '  D1 html [new title]       replace D1 with the indented HTML\n'
    '  D1 reply ¶3 <text>        answer the comments on paragraph 3 of D1\n'
    '  B03 archive|unarchive     hide a done/dropped item from the default lists (reopening unarchives)\n'
    '  ack r12 r13               mark inputs handled without changing items\n'
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
    '                            flag: ? you asked / ! you are blocked (both wait on the user) / < the user replied\n'
    '                            filters: ?q=word&type=bug&pri=P0&when=now&status=all|open|doing|done|dropped&wait=1&reply=1&archived=1|all&limit=60\n'
    '  curl -s BASE/B03          full card: fields, body, thread, files (image/audio paths are readable from disk)\n'
    '  curl -s BASE/rules        project rules: standing instructions; follow those that apply to what you do\n'
    '                            (a rule added or changed while you work is named once in your next /next or /do reply:\n'
    '                            read it and follow it from then on)\n'
    "  curl -s BASE/D1           a document: numbered paragraphs (¶) with the user's comments under each\n"
    '  curl -s BASE/log?n=30     recent changes\n'
    '  optional on any call: &session=<the title your app shows for this session> (or the header X-Taska-Session), so\n'
    '                            the user can tell your sessions apart\n'
    '\n'
    '{grammar}\n'
    "  curl -s BASE/do --data-binary @- <<'EOF'\n"
    '  B03 doing\n'
    '  B03 progress Reproduced it: the export ignores the filter\n'
    '  EOF\n'
    '\n'
    'Now: {rules}\n'
    'LOOP  doing means an agent is working on it. Mark an item doing when you start; when you hand back a result, set it\n'
    '      done (the user reviews it) or ask what you need: never leave a result sitting in doing (T646). If you drop\n'
    '      that work, set it back to open. Keep going: take /next, mark it doing, do the work, write progress and set done, then GET /next\n'
    "      again. Don't stop to chat. If you are stuck or need a decision, post `B03 block <what you need>` and\n"
    '      move on; /next brings the item back once the user replies. Nothing to do: end your turn. Never wait in\n'
    '      the foreground, poll, or set a timer or scheduled task (heartbeat, cron, automation) to look at Taska:\n'
    '      never wake a model just to check for messages, at any frequency. No foreground polling loops either.\n'
    '      Resume only for a real user message or a confirmed new-work event. Claude Code: before ending the turn,\n'
    '      start this with Bash run_in_background and end the turn; Taska holds it until there is work, so it costs\n'
    '      no tokens while it waits and your session resumes only when it ends with work:\n'
    '      `while o=$(curl -s "BASE/next?wait=540&by=claude-code"); [ -z "$o" ] || echo "$o" | grep -q \'nothing to do now\'; do sleep 20; done`\n'
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
    '      suggestion into a decision: use propose/ask/block and wait. Commands with src=rN (or ack rN) mark that\n'
    '      input handled; if an input is a question for you, answer it in the related item (or tell the user) and ack it.\n'
    'ASK   Ask only when a wrong guess would do damage that is hard to undo: spending money, sending something to\n'
    "      someone, deleting, or a choice of scope or design that is the user's to make. Otherwise take the most\n"
    '      likely answer from what you already know (their address, their earlier choices), say the assumption in\n'
    '      one line, and finish the work; the user corrects you if needed. Never ask what they already said (r814).\n'
    '\n'
    "MANAGER MODE (optional: if your app can't run two sessions this way, work alone as above)\n"
    '      A manager session hands items to one long-lived worker session; it never edits code itself.\n'
    '      Manager: picks items from /next and the threads, claims them for the worker with /next?by=<worker>, sends the\n'
    '      worker a short list in priority order (small ones first), sleeps until an event below, and puts what needs\n'
    '      the user on the item. Worker: does the list in order and writes progress/done/ask/block on each item itself\n'
    '      (&session=worker); never polls Taska, never waits on the user, keeps working while a background command\n'
    '      runs, says on the item before a step longer than 15 minutes, and ends every turn with a message there.\n'
    '      Never stuck: the worker runs where nothing prompts for approval (a refused command is refused; it takes\n'
    '      another route); the manager never waits on a prompt or on the worker. A stuck worker: stop its turn, hand\n'
    '      the item out again, say why on the item.\n'
    '      The manager continues only for a real user update, a worker result, or a confirmed failure event.\n'
    '      Elapsed time, silence or an empty queue is never a reason to wake a model.\n'
    '      Reuse the worker for related items; between items, compact it once its context passes about 40%.\n'
    '      Cost: the done message ends with one line: active minutes, fresh tokens, cache-read tokens, steps, from\n'
    '      tools/session_usage.py <worker session.jsonl> --since <start> --until <end>.\n'
    '      Claude Code: the worker is a resident session; send it a session message (both in the same permission\n'
    '        mode), or `claude -p --resume <session> --permission-mode auto --output-format json "<brief>"`.\n'
    '      Codex: use the native send_message_to_thread tool only for authorized real work. Do not launch a\n'
    '      second writer or a relay model. For automatic Taska updates, follow the Codex setup below.\n'
    '      Antigravity: one worker started from its Agent Manager and reused. Not tried yet, nor how to read its tokens.\n'
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
    '   user\'s phone shows whether an agent is around. `curl -s "BASE/next?by=claude-code"` says what to do: the inbox first, then items the user replied on,\n'
    '   then the next item by priority. Mark the item doing, do the work, write progress back, then mark it done\n'
    '   (it goes to the user for review). Ask /next again.\n'
    "4. **Keep going.** After each item, take the next one; don't stop to chat.\n"
    '   - After your last item, always check /next once more. Nothing to do: end your turn. Never wait in the\n'
    '     foreground, poll, or set a timer or scheduled task (heartbeat, cron, automation) to look at Taska: each\n'
    '     scheduled checks for messages are forbidden at any frequency, including hourly or daily.\n'
    '   - No foreground polling loops or repeated reads while waiting. Resume only for a real user message or a\n'
    '     confirmed new-work event. Claude Code: start this with Bash run_in_background and end the turn (Taska\n'
    '     holds it until there is work: no tokens while it waits):\n'
    '     `while o=$(curl -s "BASE/next?wait=540&by=claude-code"); [ -z "$o" ] || echo "$o" | grep -q \'nothing to do now\'; do sleep 20; done`\n'
    '     Others: if delivery is unavailable, report it once and end the turn.\n'
    '   - Codex: automatic updates use the native queue setup below. Do not use a second CLI writer\n'
    '     or a relay model. Other agents do not use this Codex-specific transport.\n'
    '5. **Need the user?** Post `B03 block <what you need>` or `B03 ask <question>`, then take the next item.\n'
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
AGENT += CODEX_WORKERS + CODEX_DELIVERY.replace("{", "{{").replace("}", "}}")
SKILL += CODEX_WORKERS + CODEX_DELIVERY

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
    'echo "This folder now points to Taska project {name}: {base} (saved in .taska)"\n'
)
