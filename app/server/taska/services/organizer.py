"""The organizer (optional, Gemini): turns what you said into item changes, one input at a time, oldest first.

The model decides what to change and writes it in the agents' command language; the commands check and apply it,
so every change traces back to the input. With no key, inputs wait for the coding agent instead.
"""

from __future__ import annotations

import base64
import os
import re
import sys
import threading
import time
from typing import Any, Dict, List, Optional

from ..agent_api import render
from ..agent_api.language import parse
from ..agent_api.organizer_text import INSTRUCTIONS
from ..domain import events as ev, rules
from ..domain.model import Input
from ..domain.text import hm
from ..domain.vocab import CLOSED, Refused
from ..infra import gemini
from .project import Project


def context(p: Project, inp: Input) -> str:
    """What the organizer reads with an input: the open items, the rules, the item it is about, and the input."""
    st = p.state
    rows = [render.line(st, i) for i in rules.by_priority(st.live_items()) if i.status not in CLOSED][:600]
    out = ["Open items:\n" + ("\n".join(rows) if rows else "(none yet)"), "Project rules:\n" + render.rules_text(st)]
    rd = p.reading()
    if inp.scope in st.items:
        out.append("Scope item (the input is about this one):\n" + render.card(rd, st.items[inp.scope]))  # type: ignore[index]
    scope = f" [scope: {st.code(inp.scope)}]" if inp.scope else " [no scope: whole project]"
    if inp.history:
        out.append("This is an update to an existing input, not a new submission. The latest text is authoritative. "
                   "Update its linked items where relevant instead of duplicating them. Preserve unrelated work. "
                   "Do not repeat completed external actions. The coding agent must see the update: include pass.")
        out.append("Previous input text:\n" + inp.history[-1].text)
        out.append("Linked items:\n" + "\n".join(render.card(rd, st.items[n]) for n in inp.touched if n in st.items))
    out.append(f"New input {inp.id} at {hm(inp.t)}{scope}:\n{inp.text or '(no text)'}")
    return "\n\n".join(out)


class Organizer(threading.Thread):
    def __init__(self, project: Project):
        super().__init__(daemon=True)
        self.p = project

    def run(self) -> None:
        p = self.p
        while True:
            with p.changed:
                while True:
                    if p.gone:  # the project was deleted: its organizer stops; restoring it starts a new one
                        return
                    todo = [i for i in rules.pending(p.state) if not i.org and not p.held(i)]
                    if todo:
                        break
                    p.changed.wait(timeout=30)
                inp = min(todo, key=lambda i: i.number)
                p.organizer_busy = inp.id
                p.bump()
            self.organize(inp.id)

    def organize(self, rid: str) -> None:
        p, t0 = self.p, time.time()
        with p.lock:  # changes may land while the request is made
            inp = p.state.inputs[rid]
            version = inp.v
            parts: List[Dict[str, Any]] = [{"text": context(p, inp)}]
            files = list(inp.files)
            scope, had_history = inp.scope, bool(inp.history)
        err: Optional[str] = None
        try:
            for f in files:
                path = p.file_path(f.f)
                mime = f.mime or ""
                if mime.startswith("image/") or (mime.startswith("audio/") and not f.tr):
                    if os.path.getsize(path) < 12 * 1024 * 1024:
                        with open(path, "rb") as fh:
                            parts.append({"inline_data": {"mime_type": mime.split(";")[0], "data": base64.b64encode(fh.read()).decode()}})
            plan = gemini.ask("organizer", INSTRUCTIONS, parts, think=int(os.environ.get("TASKA_THINK", "512")))
        except Exception as ex:
            plan, err = "", str(ex)
        with p.lock:
            p.organizer_busy = None
            current = p.state.inputs[rid]
            if current.v != version or current.moved or current.acked:
                p.bump()  # a plan made for older words must not overwrite or handle the newer input
                return
            if err:
                print(f"[organizer] {time.strftime('%Y-%m-%d %H:%M:%S')} {p.slug} {rid} failed: {err[:300]}",
                      file=sys.stderr, flush=True)
                p.emit(ev.Organized(src=rid, ok=False, msg=err, by="org"))
                return
            keep = had_history or bool(re.search(r"(?im)^\s*pass\s*$", plan))
            commands = parse(re.sub(r"(?im)^\s*pass\s*$", "", plan))
            if keep:  # the input is for the coding agent: changes may be made, but it stays in the inbox
                commands = [(no, c) for no, c in commands if isinstance(c, Refused) or c.get("op") != "ack"]
            lines, labels = p.run(commands, "org", src=rid, keep=keep)
            bad = [x for x in lines if x.startswith("err")]
            if not p.state.inputs[rid].acked and not bad and not keep:
                p.emit(ev.InputsAcked(ids=[rid], by="org"))
            noted = f"Added to {p.state.code(scope)}" if scope in p.state.items else "No changes needed"
            msg = " · ".join(labels) if labels else ("" if keep else noted)
            if keep:
                msg = (msg + " · " if msg else "") + "Left for your coding agent"
            if bad:
                msg += " · Some commands failed: " + "; ".join(bad)
            p.emit(ev.Organized(src=rid, ok=not bad, msg=msg, plan=plan, keep=keep, changed=bool(labels),
                                ms=int((time.time() - t0) * 1000), by="org"))


class Organizers:
    """One organizer per project, when a key is set."""

    def __init__(self, enabled: bool):
        self.enabled = enabled

    def start(self, p: Project) -> None:
        if self.enabled:
            Organizer(p).start()
