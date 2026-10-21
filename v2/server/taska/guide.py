"""The words agents read: the guide (/agent), the command grammar, the skill they install, the connect script.

These texts are the agent interface: they stay word for word as they were in the one-file Taska.
"""

from __future__ import annotations

import os

GRAMMAR = """\
WRITE (plain text, one command per line; indented lines continue the previous command's text):
  new bug P1 now parent=B03 src=r12 Export ignores the active filter
                            type (feature|bug|idea|task|rule), priority (P0-P3), now|later, parent= and src= are
                            each optional and go before the title as plain words, no brackets
    <optional body, indented>
  B03 P1 later doing        set priority / when / status / type, any mix (status: open|doing|done|drop; drop = won't do)
  B03 done <text>           words after the fields (and indented lines) are posted as progress, e.g. the done report
  B03 title|body|next <text>      replace that field (body may continue on indented lines)
  B03 say|ask|block|propose|decide|progress <text>     add to the thread: ask = question for the user,
                                  block = you are stuck and need the user (say what you need),
                                  withdraw = take back your open ask/block (say why),
                                  propose = suggestion (not decided), decide = decision made
  B03 merge F01             merge B03 into F01 (use only for clear duplicates)
  Messages and docs are Markdown (lists, **bold**, `code`, links). Show an image where it belongs with
  ![what it shows](f12-a.png): upload it first with
  curl -s BASE/api/file?name=a.png -H 'Content-Type: image/png' --data-binary @a.png   (prints its "f")
  B03 say files=f12-a.png,f13-b.png <text>   images attached below the message instead
  B03 ask <question>        with indented choices the user taps: "- ( ) option" lines = pick one (yes/no too),
                            "- [ ] option" lines = pick any. The reply lists the picks as "✓ option".
  B03 doc [title]           new document on B03 (plans, designs); its Markdown is the indented lines, first line = title
  D1 doc [new title]        replace D1's Markdown with the indented lines; comments stay with unchanged paragraphs
  D1 reply ¶3 <text>        answer the comments on paragraph 3 of D1
  B03 archive|unarchive     hide a done/dropped item from the default lists (reopening unarchives)
  ack r12 r13               mark inputs handled without changing items
  $ means the item created earlier in the same request. Refs: B03, b3, 3 are the same item."""

AGENT = """\
Taska is the user's tracker for features, bugs, ideas and tasks. BASE={base}
Item code = type letter (F/B/I/T) + number; padding may change as the list grows, B3 = B03.
Now: {mode}  (the user flips this in the UI; every /next and /do reply repeats it)

READ  (plain text)
  curl -s BASE/next         what to do now: the inbox first, items the user replied on, then the next item  <- start here
  curl -s BASE/inbox        unprocessed user inputs: raw text, scoped item, files
  curl -s BASE/items        open items, one line each: code pri when status title [flag] [^parent]
                            flag: ? you asked / ! you are blocked (both wait on the user) / < the user replied
                            filters: ?q=word&type=bug&pri=P0&when=now&status=all|open|doing|done|dropped&wait=1&reply=1&archived=1|all&limit=60
  curl -s BASE/B03          full card: fields, body, thread, files (image/audio paths are readable from disk)
  curl -s BASE/rules        project rules: standing instructions; follow those that apply to what you do
  curl -s BASE/D1           a document: numbered paragraphs (¶) with the user's comments under each
  curl -s BASE/log?n=30     recent changes
  optional on any call: &session=<your session's name · machine · folder> (or the header X-Taska-Session), so the
                            user can tell your sessions apart

{grammar}
  curl -s BASE/do --data-binary @- <<'EOF'
  B03 doing
  B03 progress Reproduced it: the export ignores the filter
  EOF

Now: {rules}
LOOP  doing means work has started (not that you are on it this second). Mark an item doing when you start;
      if you drop that work, set it back to open. keep-going ON: take /next, mark it doing, do the work, write progress and set done, then GET /next
      again. Don't stop to chat. If you are stuck or need a decision, post `B03 block <what you need>` and
      move on; /next brings the item back once the user replies. Nothing to do and keep-going ON: wait with
      GET /next?wait=540 (returns when work arrives) and repeat. If a background command can wake you when it
      exits, end your turn with WATCH running instead: waiting costs no tokens and never interrupts your work.
      While you work, a /do reply ending "N new inputs since your last /next" means the user wrote meanwhile:
      finish the step you are on, then GET /next. Nothing else interrupts you.
      Big items have subitems (parent=B03): /next gives you the subitems first and the parent once they are
      finished; split big work the same way with `new ... parent=B03`.
      Always call /next and /do with ?by=<your name>: with several agents on one project, /next gives each of you
      its own item and lists "others are on (skip)": another agent holds those, leave them. A hold lapses after
      30 minutes without a word from that agent.
      keep-going OFF: finish the current item, write back, stop. /next picks items marked now, ideas included:
      an idea is something to think through; do it when small and clear, otherwise propose a plan and ask.
WATCH while o=$(curl -s "BASE/next?wait=540"); [ -z "$o" ] || echo "$o" | grep -qE 'nothing to do now|keep-going OFF'; do sleep 20; done
YOURS Items you create start as proposed: the user approves them before anyone works on them. `B03 done`
      from you puts the item in review; the user accepts it. Write item content in the user's language.
      The message with done has four parts, in this order: Result (what is different now, one line); How to
      check (where to look or what to tap); What changed (a short list); a picture of it (T274 #41).
WHO   Add ?by=<you> (claude-code, codex, antigravity) to /next and /do: the user sees whether an agent is around.
TELL  The user reads Taska only, often on a phone: never your terminal or chat. Everything they should see
      (what you did, how you checked it, screenshots, plans, questions) goes into the item's messages.
      First line = the conclusion in one sentence; the page folds long messages to it. Then details, short,
      in Markdown, images inline (see `say` above). Don't post "starting now": the status already says doing.
      Name items, documents and inputs by their code (B03, D2, r12): the page links each code and shows a card
      about it on hover. A code alone means little to the user: the first time a message names one, add a few
      words on what it is, e.g. "D2 (the release plan)".
RULES Reuse existing items (/items?q=) instead of duplicating. Keep the user's wording. Never turn a
      suggestion into a decision: use propose/ask/block and wait. Commands with src=rN (or ack rN) mark that
      input handled; if an input is a question for you, answer it in the related item (or tell the user) and ack it.
"""

SKILL = """\
---
name: taska
description: Work with Taska, the user's per-project tracker of features, bugs, ideas, tasks and rules (a small local web app). Use when the user mentions Taska or item codes like B03 or F12, asks you to work on, continue or keep working through the tasks, or when the project folder has a .taska file.
---

# Taska

Taska runs on this machine. You read and update it with curl; every reply is short plain text.

1. **Find it.** The project's `.taska` file (in the current folder or a parent) holds its URL, for example
   `http://127.0.0.1:7340/p/myapp`. No file: `curl -s http://127.0.0.1:7340/api/projects` lists the projects;
   pick the one for this folder or ask the user. Below, BASE is that project URL.
2. **Learn it once per session.** `curl -s BASE/agent` is one page with every read and write command.
   Then `curl -s BASE/rules` and follow the project rules that apply to what you are doing.
3. **Work the loop.** Say who you are on /next and /do with `?by=claude-code` (or `codex`, `antigravity`): the
   user's phone shows whether an agent is around. `curl -s "BASE/next?by=claude-code"` says what to do: the inbox first, then items the user replied on,
   then the next item by priority. Mark the item doing, do the work, write progress back, then mark it done
   (it goes to the user for review). Ask /next again.
4. **Keep going.** The first line of /next says keep-going ON or OFF.
   - ON and nothing to do: `curl -s "BASE/next?wait=540&by=claude-code"` waits and returns as soon as work arrives. Repeat.
     After your last item, always check /next once more.
   - If you can run a command in the background that wakes you when it exits (Claude Code: Bash with
     `run_in_background`), start this and end your turn instead of holding it. Waiting costs no tokens, it
     ends only when there is work and keep-going is ON, and it never interrupts you mid-task:
     `while o=$(curl -s "BASE/next?wait=540&by=claude-code"); [ -z "$o" ] || echo "$o" | grep -qE 'nothing to do now|keep-going OFF'; do sleep 20; done`
   - OFF: finish the current item, write back, stop.
5. **Need the user?** Post `B03 block <what you need>` or `B03 ask <question>`, then take the next item.
   /next brings it back once the user replies. When the answer is a choice, list it under the question as
   indented `- ( ) option` lines (pick one) or `- [ ] option` lines (pick any): the user taps instead of typing.
6. **The user reads Taska only**, usually on a phone, never your terminal or chat. Whatever they should see goes
   into the item: what you did and how you checked it, screenshots, plans, questions. **The first line is the
   conclusion in one sentence**: the page folds long messages to it. Messages are Markdown:
   short paragraphs and lists, images inline with `![what it shows](f12-a.png)` after uploading
   (`curl -s BASE/api/file?name=a.png -H 'Content-Type: image/png' --data-binary @a.png`).
   Name items, documents and inputs by code (B03, D2, r12), and the first time add a few words on what each is,
   e.g. "D2 (the release plan)": the page turns codes into links with a card on hover, but a bare code means little.
7. Items you create start as proposed until the user approves them. Never treat a suggestion as decided.
"""

CONNECT = """#!/bin/sh
# Connects the current folder to the Taska project {name}. Run it in the project's folder on the machine
# where your coding agent works:  curl -s {base}/connect | sh
set -e
printf '%s\\n' '{base}' > .taska
for d in "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.gemini/config/skills"; do
  if [ -d "$(dirname "$d")" ]; then
    mkdir -p "$d/taska" && curl -fsS '{host}/skill' -o "$d/taska/SKILL.md" && echo "skill: $d/taska/SKILL.md"
  fi
done
echo "This folder now points to Taska project {name}: {base} (saved in .taska)"
"""


SKILL_DIRS = {"Claude Code": "~/.claude/skills", "Codex": "~/.codex/skills", "Antigravity": "~/.gemini/config/skills"}


def install_skill() -> None:
    """Write SKILL.md for every coding agent found on this machine (user level, all projects)."""
    for agent, d in SKILL_DIRS.items():
        root = os.path.expanduser(d)
        if not os.path.isdir(os.path.dirname(root)):
            print(f"  skip {agent}: {os.path.dirname(root)} not found")
            continue
        os.makedirs(os.path.join(root, "taska"), exist_ok=True)
        path = os.path.join(root, "taska", "SKILL.md")
        with open(path, "w", encoding="utf-8") as f:
            f.write(SKILL)
        print(f"  {agent}: {path}")
