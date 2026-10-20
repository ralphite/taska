"""The organizer (optional, Gemini): turns what you said (an input) into item changes, one input at a time.

The model decides what to change and writes it in the agents' command language; the code checks and applies it
(ops.run), so every change traces back to the input. With no key, inputs wait for the coding agent instead.
"""

from __future__ import annotations

import base64
import os
import re
import threading
import time
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from .core import CLOSED, Err, Input, hm
from .dsl import parse_dsl
from .gemini import gemini
from .guide import GRAMMAR

if TYPE_CHECKING:
    from .store import Store

ORG = """\
You are the organizer inside Taska, a personal tracker the user shares with coding agents. The user just
sent a raw input (text, maybe images or a voice transcript). Turn it into commands that change the tracker.
Reply with commands only: no explanation, no markdown fences.

Types: feature = something to add or improve; bug = something broken to find and fix; idea = a thought to
think through, maybe vague; task = a concrete piece of work that is not a feature or bug (write a doc, answer a
question, prepare a demo, look into something); rule = a standing
instruction for this project that agents must follow when it applies (commit format, who reviews, naming, how
to organize). When the user states a rule, create it (`new rule <when it applies>` + how, as the body) or update
the existing rule; do not file it as a task. Follow the project rules below that are about organizing.
Work like this:
- If the input belongs to an existing item (listed below), update that item instead of creating a duplicate.
- An input with a scope item is already shown in that item's thread: never repeat it with say. Only apply
  field changes it asks for ("set high priority" = P1, "urgent" = P0, "later", "done", ...) or new items it
  mentions. A reply to an agent's ask/block is for that agent: change nothing and reply `ack <input id>`.
- A question or request addressed to the coding agent (how something works, "explain", "can you..."):
  reply `pass` so the input stays in the inbox for the agent. Still create items for anything else it says.
- If it is new, `new <type> <P0-P3> <now|later> <short title>` with the user's own wording as the body, for
  example `new bug P2 now Export ignores the active filter`: plain words, no brackets.
  One input may contain several separate things: create one item each. Use parent=<code> to split a big
  item into subtasks.
- Write titles, bodies and notes in the language of THIS input (English input -> English, Chinese input ->
  Chinese), even when other items are in another language and even though the app itself is in English. Keep the user's wording; keep paths, commands and identifiers exactly.
  Do not invent facts.
- "Won't do / not doing it" (in any language) closes an item without finishing it: `<code> drop`.
- Do not decide for the user: put suggestions in `propose`, and use `ask` only when something is truly
  ambiguous or missing. If the input only answers an open question, record it with `say` and stop.
- "Not now / later / put it off" (in any language) about something not tracked yet still means: create it with `later`,
  so it is not lost. Only greetings, thanks or pure acknowledgements need no item.
- Priority (always write it on new items): P2 = normal, the default for every type. Only the user's words move it:
  P0 when they say it is urgent or blocks them, P1 when they say it is important or should come soon, P3 when
  they say it can wait or "someday". Do not raise it because it sounds big. New items are `now` unless the user says later.
  Explicit words from the user ("P0", "urgent", "not urgent", "later") always win, and the project rules
  below override these defaults.
- Merge only clear duplicates. Prefer fewer, accurate changes. If nothing needs changing, reply: ack <input id>
- When the user asks the agents to look at something and find the problems themselves (often with a screenshot:
  "look at this, find what is wrong, fix it"), do not work out the problems yourself: create one item whose title
  only says what to look at, in the user's words (for example `new bug P2 now Problems on this screen`), with the
  user's words as the body and nothing you read into the picture. The coding agent finds the problems and names
  the item.

""" + GRAMMAR


class Organizer(threading.Thread):
    """Turns pending inputs into ops with Gemini. One at a time, oldest first."""

    def __init__(self, store: "Store"):
        super().__init__(daemon=True)
        self.s = store

    def run(self) -> None:
        s = self.s
        while True:
            with s.cond:
                while True:
                    if s.gone:  # the project was deleted: its organizer stops; restoring it starts a new one (F173)
                        return
                    todo = [i for i in s.pending() if not i["org"] and not s.held(i)]  # org is set (and logged) once tried; held: its words are coming (B165)
                    if todo:
                        break
                    s.cond.wait(timeout=30)
                inp = dict(min(todo, key=lambda i: int(i["id"][1:])))
                s.org_busy = inp["id"]
                s.bump()
            self.process(inp)

    def context(self, inp: Input) -> str:
        s = self.s
        rows = [s.line(i) for i in s.sorted(s.active()) if i["status"] not in CLOSED][:600]
        out = ["Open items:\n" + ("\n".join(rows) if rows else "(none yet)"), "Project rules:\n" + s.rules_text()]
        if inp["scope"] in s.items:
            out.append("Scope item (the input is about this one):\n" + s.card(s.items[inp["scope"]]))
        scope = f" [scope: {s.code(inp['scope'])}]" if inp["scope"] else " [no scope: whole project]"
        if inp.get("from") == "rules":
            scope += " [sent from the Rules view: most likely a rule]"
        if inp.get("history"):
            out.append("This is an update to an existing input, not a new submission. The latest text is authoritative. "
                       "Update its linked items where relevant instead of duplicating them. Preserve unrelated work. "
                       "Do not repeat completed external actions. The coding agent must see the update: include pass.")
            out.append("Previous input text:\n" + inp["history"][-1]["text"])
            out.append("Linked items:\n" + "\n".join(s.card(s.items[n]) for n in inp["touched"] if n in s.items))
        out.append(f"New input {inp['id']} at {hm(inp['t'])}{scope}:\n{inp['text'] or '(no text)'}")
        return "\n\n".join(out)

    def process(self, inp: Input) -> None:
        s, t0 = self.s, time.time()
        with s.lock:  # writes may land while we build the prompt
            inp = dict(inp)
            version = inp.get("v", 0)
            parts: List[Dict[str, Any]] = [{"text": self.context(inp)}]
            err: Optional[str] = None
        try:
            for f in inp["files"]:
                path = os.path.join(s.fdir, f["f"])
                mime = f.get("mime", "")
                if mime.startswith("image/") or (mime.startswith("audio/") and not f.get("tr")):
                    if os.path.getsize(path) < 12 * 1024 * 1024:
                        with open(path, "rb") as fh:
                            parts.append({"inline_data": {"mime_type": mime.split(";")[0], "data": base64.b64encode(fh.read()).decode()}})
            plan = gemini(ORG, parts, think=int(os.environ.get("TASKA_THINK", "512")))
        except Exception as ex:
            plan, err = "", str(ex)
        with s.lock:
            s.org_busy = None
            current = s.inputs[inp["id"]]
            if current.get("v", 0) != version or current.get("moved") or current["acked"]:
                s.bump()  # a stale plan must not overwrite or acknowledge a newer input
                return
            if err:
                s.emit({"k": "org", "src": inp["id"], "ok": False, "msg": err, "by": "org"})
                return
            keep = bool(inp.get("history")) or bool(re.search(r"(?im)^\s*pass\s*$", plan))
            ops = parse_dsl(re.sub(r"(?im)^\s*pass\s*$", "", plan))
            if keep:  # the input is for the coding agent: changes may be applied, but it stays in the inbox
                ops = [(no, op) for no, op in ops if isinstance(op, Err) or op.get("op") != "ack"]
            lines, labels = s.run_all(ops, "org", src=inp["id"], keep=keep)
            bad = [x for x in lines if x.startswith("err")]
            if not s.inputs[inp["id"]]["acked"] and not bad and not keep:
                s.emit({"k": "ack", "ids": [inp["id"]], "by": "org"})
            noted = f"Added to {s.code(inp['scope'])}" if inp["scope"] in s.items else "No changes needed"
            msg = " · ".join(labels) if labels else ("" if keep else noted)
            if keep:
                msg = (msg + " · " if msg else "") + "Left for your coding agent"
            if bad:
                msg += " · Some commands failed: " + "; ".join(bad)
            s.emit({"k": "org", "src": inp["id"], "ok": not bad, "msg": msg, "plan": plan, "keep": keep, "changed": bool(labels), "ms": int((time.time() - t0) * 1000), "by": "org"})
