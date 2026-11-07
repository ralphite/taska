"""The organizer (optional, Gemini): turns what you said into item changes, one input at a time, oldest first.

The model decides what to change and writes it in the agents' command language; the commands check and apply it,
so every change traces back to the input. With no key, inputs wait for the coding agent instead.
"""

from __future__ import annotations

import base64
import os
import queue
import re
import sys
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

from ..agent_text import render
from ..agent_text.language import parse
from ..agent_text.organizer_text import AS_SAID_LABEL, INSTRUCTIONS
from ..domain import events as ev, rules
from ..domain.model import Input
from ..domain.text import hm
from ..domain.vocab import CLOSED, TEXT_VERBS, Refused
from ..domain.voices import for_agents, words_of
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
    # T697 r(D121): a voice note's tidied words are what the body is written from; its words word for word come only
    # to judge whether something was misheard
    said = for_agents(st, inp.text, inp.files, as_said=True, said_as=AS_SAID_LABEL)
    out.append(f"New input {inp.id} at {hm(inp.t)}{scope}:\n{said or '(no text)'}")
    return "\n\n".join(out)


PARALLEL = int(os.environ.get("TASKA_ORGANIZE_PARALLEL", 4))  # inputs organized at the same time
# B684 (Yadong, #9933): each input is asked of both models at once, and the first good answer is the plan
MODELS = [m.strip() for m in os.environ.get("TASKA_ORGANIZER_MODELS", "gemini-3.1-pro-preview,gemini-3.8-flash").split(",") if m.strip()]


def echo(p: Project, inp: Input, c: Any) -> bool:
    """A message from the organizer on the item the input was said in (B703, r1144, #10330), or on the item its plan
    just made from it (B714, r1167): the user's own words and files are already there (tidied); with nothing to do
    they stay as said, and anything to do is done by changing things, never by writing them again in a message. So
    no organizer message goes on that item; it is dropped here."""
    if not isinstance(c, dict) or c.get("op") != "say":
        return False
    if str(c.get("ref") or "").strip() == "$":
        return True  # on the item this plan just made from the input: it already shows the input's words and files (B714)
    if inp.scope is None:
        return False
    try:
        return rules.item_at(p.state, c.get("ref") or "").n == inp.scope
    except Refused:
        return False


def first_plan(parts: List[Dict[str, Any]], think: int) -> str:
    """The plan of whichever model answers first with words; an empty or failed answer waits for the other. Every
    model failed: the first failure (a busy service is asked again later by the organizer)."""
    done: "queue.Queue[Tuple[Optional[str], Optional[Exception]]]" = queue.Queue()

    def one(model: str) -> None:
        try:
            done.put((gemini.ask("organizer", INSTRUCTIONS, parts, think=think, model=model), None))
        except Exception as ex:  # one failing must not lose the other's answer
            done.put((None, ex))

    for m in MODELS:
        threading.Thread(target=one, args=(m,), daemon=True).start()
    errors: List[Exception] = []
    for _ in MODELS:
        plan, err = done.get()
        if plan and plan.strip():
            return plan
        if err is not None:
            errors.append(err)
    if errors:
        raise errors[0]
    return ""


class Organizer(threading.Thread):
    def __init__(self, project: Project, clock: Any = time.time):
        super().__init__(daemon=True)
        self.p = project
        self.clock = clock
        self.later: Dict[str, Tuple[float, int]] = {}  # an input the service could not take yet: when to ask again, tries

    def due(self, inp: Input) -> bool:
        """An input to organize now: not organized yet, or failed only because the service was busy, slow or out of
        reach (T424: Taska asks again by itself; the user never has to press Try again), and not waiting to be asked
        again."""
        if inp.org and (inp.org.ok or inp.org.undone or not transient(inp.org.msg)):
            return False
        return self.later.get(inp.id, (0.0, 0))[0] <= self.clock()

    def nap(self) -> float:
        """How long to wait for news: until the next input is to be asked again, at most 30 s."""
        now = self.clock()
        return max(1.0, min([30.0] + [until - now for until, _ in self.later.values() if until > now]))

    def run(self) -> None:
        """Inputs are organized several at once, as they come (B684: one at a time was not needed), at most
        PARALLEL; each in its own thread, the oldest first."""
        p = self.p
        while True:
            with p.lock:
                while True:
                    if p.gone:  # the project was deleted: its organizer stops; restoring it starts a new one
                        return
                    room = PARALLEL - len(p.organizing.busy)
                    todo = [i for i in rules.pending(p.state) if i.id not in p.organizing.busy and self.due(i) and not p.held(i)]
                    if todo and room > 0:
                        break
                    p.news.wait(timeout=self.nap())
                for inp in sorted(todo, key=lambda i: i.number)[:room]:
                    p.organizing.busy.add(inp.id)
                    threading.Thread(target=self.organize, args=(inp.id,), daemon=True).start()
                p.news.bump()

    def organize(self, rid: str) -> None:
        p, t0 = self.p, time.time()
        with p.lock:  # changes may land while the request is made
            inp = p.state.inputs[rid]
            version = inp.v
            parts: List[Dict[str, Any]] = [{"text": context(p, inp)}]
            files = list(inp.files)
            heard = {f.f: words_of(p.state, f.f) for f in files}  # a voice note without words goes as its audio
            scope, had_history = inp.scope, bool(inp.history)
        err: Optional[str] = None
        try:
            for f in files:
                path = p.file_path(f.f)
                mime = f.mime or ""
                if mime.startswith("image/") or (mime.startswith("audio/") and not heard[f.f]):
                    if os.path.getsize(path) < 12 * 1024 * 1024:
                        with open(path, "rb") as fh:
                            parts.append({"inline_data": {"mime_type": mime.split(";")[0], "data": base64.b64encode(fh.read()).decode()}})
            plan = first_plan(parts, int(os.environ.get("TASKA_THINK", "512")))
            if not plan.strip():  # an empty answer (MALFORMED_RESPONSE and the like) is not "no changes needed"
                err = "Gemini gave an empty answer"
        except Exception as ex:
            plan, err = "", str(ex)
        with p.lock:
            p.organizing.busy.discard(rid)
            current = p.state.inputs[rid]
            if current.v != version or current.moved or current.acked:
                p.news.bump()  # a plan made for older words must not overwrite or handle the newer input
                return
            if err:
                print(f"[organizer] {time.strftime('%Y-%m-%d %H:%M:%S')} {p.slug} {rid} failed: {err[:300]}",
                      file=sys.stderr, flush=True)
                if transient(err):  # asked again later, longer each time (up to 10 min); the input stays waiting
                    tries = self.later.get(rid, (0.0, 0))[1] + 1
                    self.later[rid] = (self.clock() + min(600, 15 * 2 ** (tries - 1)), tries)
                    p.news.bump()
                    return
                p.emit(ev.Organized(src=rid, ok=False, msg=err, by="org"))
                return
            self.later.pop(rid, None)
            keep = had_history or bool(re.search(r"(?im)^\s*pass\s*$", plan))
            commands = parse(re.sub(r"(?im)^\s*pass\s*$", "", indent_strays(plan)))
            commands = [(no, c) for no, c in commands if not echo(p, current, c)]
            if keep:  # the input is for the coding agent: changes may be made, but it stays in the inbox
                commands = [(no, c) for no, c in commands if isinstance(c, Refused) or c.get("op") != "ack"]
            lines, labels = p.run(commands, "org", src=rid, keep=keep)
            bad = [x for x in lines if x.startswith("err")]
            if not p.state.inputs[rid].acked and not bad and not keep:
                p.emit(ev.InputsAcked(ids=[rid], by="org"))
            noted = f"Added to {p.state.code(scope)}" if scope in p.state.items else "No changes needed"
            msg = " · ".join(labels) if labels else ("" if keep else noted)
            if keep:
                msg = (msg + " · " if msg else "") + "Left for agent"
            if bad:
                msg += " · Some commands failed: " + "; ".join(bad)
            p.emit(ev.Organized(src=rid, ok=not bad, msg=msg, plan=plan, keep=keep, changed=bool(labels),
                                ms=int((time.time() - t0) * 1000), by="org"))


_TRANSIENT = re.compile(r"(?i)\b(429|5\d\d)\b|rate.?limit|quota|exhausted|overload|unavailable|high demand|"
                        r"unreachable|timed? ?out|timeout|deadline|connection|reset|network|temporar|empty answer")


def transient(msg: str) -> bool:
    """A failure that goes away by itself: the service busy, slow or out of reach (not a refused key or request)."""
    return bool(_TRANSIENT.search(msg or "")) and not re.search(r"(?i)\b(401|403)\b|api.?key|unauthori", msg or "")


# a line that starts a command: new, ack, pass, or an item or document code ($ is the item made just before)
_HEAD = re.compile(r"(?i)(new|ack|pass)\b|\$|[A-Za-z]?\d+\b")


def indent_strays(plan: str) -> str:
    """B623: the model sometimes writes a body or a message over several lines and leaves the later ones unindented,
    which the command language reads as commands of their own (unknown command). A line that starts no command, after a
    command that takes text, is that command's text."""
    out: List[str] = []
    takes_text = False
    for line in plan.split("\n"):
        if line.strip() and not line[:1].isspace() and not line.startswith(("```", "#")):
            if _HEAD.match(line):
                word, _, rest = line.strip().partition(" ")
                verb = rest.split(" ", 1)[0].lower()
                takes_text = word.lower() == "new" or verb in TEXT_VERBS or verb in ("doc", "html")
            elif takes_text:
                line = "  " + line
        out.append(line)
    return "\n".join(out)


class Organizers:
    """One organizer per project, when a key is set."""

    def __init__(self, enabled: bool):
        self.enabled = enabled

    def start(self, p: Project) -> None:
        if self.enabled:
            Organizer(p).start()
