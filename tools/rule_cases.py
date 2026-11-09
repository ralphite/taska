"""The server's rules as cases the page checks its own copies against, and the server's words the page uses. Each
case runs on the real server code (fresh projects in a temporary folder, never real data, a clock that steps one
second per change) and is written into web/src/model/ruleCases.gen.ts; domain/vocab.py's lists go to
web/src/model/vocab.gen.ts, which the page imports instead of lists of its own.

- EFFECTS: what a change does (refactor 7): a project as the page sees it (page_api/views.py), the commands you send
  (model/commands.ts), and the project after the server ran them. model/optimistic.test.ts holds each preview to it.
- NEEDS: items in every status, asked or not, answered or not, archived or not, and whether they need you
  (domain/rules.py needs_you). USER_WORDS: messages by everyone, of every kind, and whether they are the user's
  words (user_word). QUEUE: items and the order agents take them (queue_order). NEXT: projects and the item /next
  hands out next (agent_text/work.py next_work), with the inputs whose voice notes are still being worked out.
  model/rules.test.ts holds the page's rules to them.

tests/test_rule_cases.py writes both files again in memory and fails when either differs. Regenerate after changing
a rule or a word the page copies, or a case here:

    python3 tools/rule_cases.py
"""

from __future__ import annotations

import json
import os
import re
import sys
import tempfile
from typing import Any, Callable, Dict, List, Optional, Tuple

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "web", "src", "model", "ruleCases.gen.ts")
VOCAB = os.path.join(ROOT, "web", "src", "model", "vocab.gen.ts")
sys.path.insert(0, os.path.join(ROOT, "server"))

from taska.agent_text.render import Reading  # noqa: E402
from taska.agent_text.work import Asker, next_work  # noqa: E402
from taska.domain import rules, vocab  # noqa: E402
from taska.domain.model import Message  # noqa: E402
from taska.page_api import views  # noqa: E402
from taska.services import project as project_module  # noqa: E402
from taska.services.workspace import Workspace  # noqa: E402

AGENT = "claude-code"
TIME = "2026-11-06T09:00:00-08:00"  # every time in a case: the cases read alike each time
_TIME = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?")


class Place:
    """A fresh project to run a case on."""

    def __init__(self, ws: Workspace, name: str):
        self.p = ws.add(name)

    def run(self, by: str, *commands: Dict[str, Any], src: Optional[str] = None) -> List[str]:
        lines, _ = self.p.run([(0, c) for c in commands], by, src=src)
        bad = [x for x in lines if x.startswith("err")]
        if bad:
            raise RuntimeError(f"{self.p.slug}: {bad}")
        return lines

    def you(self, *commands: Dict[str, Any]) -> List[str]:
        return self.run("you", *commands)

    def agent(self, *commands: Dict[str, Any]) -> List[str]:
        return self.run(AGENT, *commands)

    def file(self, name: str, mime: str) -> Dict[str, Any]:
        f = self.p.files.save(name, mime, b"sample")
        return {"f": f.f, "name": f.name, "mime": f.mime, "size": f.size}

    def seen(self) -> Dict[str, Any]:
        """The project as the page gets it: its items, inputs, documents, voice notes and what can be undone."""
        with self.p.lock:
            out = views.entities(self.p.state, self.p.agents)
            out["undo"] = views.project_view(self.p.state, self.p.agents, slug="", title="", organizer_on=False,
                                             organizer_busy=[], organizer_model="", presence=[], work=False,
                                             db_path="")["undo"]
        return json.loads(_TIME.sub(TIME, json.dumps(out)))


def task(title: str, **f: Any) -> Dict[str, Any]:
    return {"op": "new", "type": "task", "title": title, **f}


Seed = Callable[[Place], Any]


def _effects() -> List[Tuple[str, Seed, Callable[[Place, Any], List[Dict[str, Any]]]]]:
    """(name, seed, the commands you send) for each case."""
    def proposed(x: Place) -> None:
        x.agent({"op": "new", "type": "bug", "title": "Export ignores the filter"},
                {"op": "say", "ref": "B1", "kind": "progress", "text": "Found it."})

    def review(x: Place) -> None:
        x.you(task("Write the export"))
        x.agent({"op": "set", "ref": "T1", "f": {"status": "doing"}}, {"op": "set", "ref": "T1", "f": {"status": "done"}},
                {"op": "say", "ref": "T1", "kind": "progress", "text": "Done: it keeps the filter."})

    def family(x: Place) -> None:  # T1 with an open subitem T2 and a finished one T3
        x.you(task("Paint the fence"), task("Buy the paint", parent="T1"), task("Pick a colour", parent="T1"))
        x.you({"op": "set", "ref": "T3", "f": {"status": "done"}})

    def done_family(x: Place) -> None:
        family(x)
        x.you({"op": "set", "ref": "T1", "f": {"status": "done"}})

    def three(x: Place) -> None:
        x.you(task("One"), task("Two"), task("Three"))

    def input_with_item(x: Place) -> None:
        x.you({"op": "input", "text": "Export to Excel"})
        x.run("org", {"op": "new", "type": "feature", "title": "Export to Excel"}, src="r1")
        x.you({"op": "input", "text": "And keep the sort"})

    def doc(x: Place) -> None:
        x.you(task("Plan the export"))
        x.agent({"op": "doc", "ref": "T1", "md": "# Plan\n\nRead the filter first.\n\nThen write the rows."})
        x.you({"op": "dc", "d": 1, "para": 1, "text": "Which filter?"})
        x.agent({"op": "dc", "d": 1, "para": 1, "text": "The one on the list."})
        x.you(task("Ship it"))

    def last_input(x: Place) -> str:
        return sorted(x.p.state.inputs)[-1]

    def comment_id(x: Place) -> int:
        return next(c.id for c in x.p.state.docs[1].comments if c.by == "you")

    def agent_message(x: Place) -> int:
        return next(m.id for m in x.p.state.items[1].thread if m.by == AGENT)

    return [
        ("approving a proposal keeps the decision", proposed, lambda x, _: [{"op": "set", "ref": "B1", "f": {"status": "open"}}]),
        ("declining a proposal", proposed, lambda x, _: [{"op": "set", "ref": "B1", "f": {"status": "dropped"}}]),
        ("taking a decision back", lambda x: (proposed(x), x.you({"op": "set", "ref": "B1", "f": {"status": "open"}})),
         lambda x, _: [{"op": "set", "ref": "B1", "f": {"status": "proposed"}}]),
        ("accepting finished work", review, lambda x, _: [{"op": "set", "ref": "T1", "f": {"status": "done"}}]),
        ("sending finished work back", review, lambda x, _: [{"op": "set", "ref": "T1", "f": {"status": "open"}}]),
        ("reopening an archived item brings it back",
         lambda x: (x.you(task("Old")), x.you({"op": "set", "ref": "T1", "f": {"status": "done"}}),
                    x.you({"op": "archive", "refs": ["T1"], "on": True})),
         lambda x, _: [{"op": "set", "ref": "T1", "f": {"status": "open"}}]),
        ("later until a day: later, with the unfinished subitems", family,
         lambda x, _: [{"op": "set", "ref": "T1", "f": {"later_until": "2026-12-01"}}]),
        ("back to now: the day goes",
         lambda x: (x.you(task("Wait")), x.you({"op": "set", "ref": "T1", "f": {"later_until": "2026-12-01"}})),
         lambda x, _: [{"op": "set", "ref": "T1", "f": {"when": "now"}}]),
        ("later with no day: the day goes",
         lambda x: (x.you(task("Wait")), x.you({"op": "set", "ref": "T1", "f": {"later_until": "2026-12-01"}})),
         lambda x, _: [{"op": "set", "ref": "T1", "f": {"when": "later", "later_until": None}}]),
        ("won't do: the unfinished subitems too", family, lambda x, _: [{"op": "set", "ref": "T1", "f": {"status": "dropped"}}]),
        ("archived: the finished subitems too", done_family, lambda x, _: [{"op": "set", "ref": "T1", "f": {"archived": True}}]),
        ("fields as the server keeps them", three,
         lambda x, _: [{"op": "set", "ref": "T1", "f": {"pri": "P0", "type": "bug", "title": "  Many   spaces  ", "body": "  Trimmed.  "}}]),
        ("under another item, and on its own", three,
         lambda x, _: [{"op": "set", "ref": "T2", "f": {"parent": "1"}}, {"op": "set", "ref": "T3", "f": {"parent": "T2"}},
                       {"op": "set", "ref": "T2", "f": {"parent": "none"}}]),
        ("next in its priority, and back in order", three,
         lambda x, _: [{"op": "set", "ref": "T1", "f": {"rank": -100}}, {"op": "set", "ref": "T2", "f": {"rank": -50}},
                       {"op": "set", "ref": "T2", "f": {"rank": None}}]),
        ("archiving many: the finished ones, with their finished subitems",
         lambda x: (done_family(x), x.you(task("Open one"), task("Done one")), x.you({"op": "set", "ref": "T5", "f": {"status": "done"}})),
         lambda x, _: [{"op": "archive", "refs": ["T1", "T4", "T5"], "on": True}]),
        ("unarchiving", lambda x: (three(x), x.you({"op": "set", "ref": "T1", "f": {"status": "done"}}), x.you({"op": "archive", "refs": ["T1"]})),
         lambda x, _: [{"op": "archive", "refs": ["T1"], "on": False}]),
        ("deleting an item with its subitems", family, lambda x, _: [{"op": "idel", "ref": "T1"}]),
        ("hiding an agent's message", lambda x: (proposed(x), agent_message(x))[1],
         lambda x, mid: [{"op": "hide", "ref": "B1", "id": mid, "on": True}]),
        ("a new subitem", family, lambda x, _: [{"op": "new", "title": "Sand it first", "parent": "T1", "type": "task", "pri": "P2", "when": "now"}]),
        ("merging into another item takes its subitems along", lambda x: (family(x), x.you(task("Fence and gate"))),
         lambda x, _: [{"op": "merge", "ref": "T1", "into": "T4"}]),
        ("taking a merged item out", lambda x: (three(x), x.you({"op": "merge", "ref": "T1", "into": "T2"})),
         lambda x, _: [{"op": "unmerge", "ref": "T1"}]),
        ("putting back one of your changes", lambda x: (three(x), x.you({"op": "set", "ref": "T1", "f": {"pri": "P3"}}),
                                                         x.p.state.events[-1].seq)[2],
         lambda x, seq: [{"op": "revert", "seq": seq}]),
        ("words on finished work take it back to open", review,
         lambda x, _: [{"op": "input", "text": "Keep the sort too", "scope": "T1"}]),
        ("deleting an input takes the item only it made", input_with_item, lambda x, _: [{"op": "delete", "id": "r1"}]),
        ("editing an input", input_with_item, lambda x, _: [{"op": "amend", "id": "r2", "mode": "edit", "v": x.p.state.inputs["r2"].v, "text": "And keep the order"}]),
        ("adding to an input", input_with_item, lambda x, _: [{"op": "amend", "id": "r2", "mode": "append", "text": "By date."}]),
        ("correcting an input's words", input_with_item, lambda x, _: [{"op": "correct", "id": "r2", "wrong": "sort", "right": "order", "v": x.p.state.inputs["r2"].v}]),
        ("an input with another item", lambda x: (input_with_item(x), x.you(task("Sorting"))),
         lambda x, _: [{"op": "rescope", "id": "r2", "to": "T2"}]),
        ("sending a recording kept as cancelled", lambda x: x.you({"op": "input", "text": "Never mind", "kind": "cancelled"}),
         lambda x, _: [{"op": "send", "id": "r1"}]),
        ("taking a file off an input", lambda x: x.you({"op": "input", "text": "Two shots", "files": [x.file("a.png", "image/png"), x.file("b.png", "image/png")]}),
         lambda x, _: [{"op": "unfile", "id": "r1", "f": "f1-a.png"}]),
        ("inputs handled", input_with_item, lambda x, _: [{"op": "ack", "ids": ["r1", "r2"]}]),
        ("writing a document", doc, lambda x, _: [{"op": "doc", "d": 1, "md": "# Plan\n\nRead the filter, then the sort."}]),
        ("deleting a document", doc, lambda x, _: [{"op": "ddel", "d": 1}]),
        ("a document to another item", doc, lambda x, _: [{"op": "dmove", "d": 1, "to": "T2"}]),
        ("resolving a thread", doc, lambda x, _: [{"op": "dcres", "d": 1, "key": next(c.key for c in x.p.state.docs[1].comments), "on": True}]),
        ("a comment, in the thread of the same words", doc,
         lambda x, _: [{"op": "dc", "d": 1, "key": "doc", "text": "Looks right."},
                       {"op": "dc", "d": 1, "key": next(c.key for c in x.p.state.docs[1].comments), "quote": "", "text": "And the sort?"}]),
        ("editing a comment", lambda x: (doc(x), comment_id(x))[1], lambda x, cid: [{"op": "dcedit", "d": 1, "id": cid, "text": "Which filter, exactly?"}]),
        ("deleting a comment", lambda x: (doc(x), comment_id(x))[1], lambda x, cid: [{"op": "dcdel", "d": 1, "id": cid}]),
        ("writing the rules", lambda x: x.you({"op": "rules", "md": "## Commits\n\n- In English."}),
         lambda x, _: [{"op": "rules", "md": "## Commits\n\n- In English, short."}]),
    ]


def effects(ws: Workspace) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for i, (name, seed, commands) in enumerate(_effects()):
        x = Place(ws, f"case-{i}")
        got = seed(x)
        before = x.seen()
        cmds = commands(x, got)
        x.you(*cmds)
        out.append({"name": name, "before": before, "commands": cmds, "after": x.seen()})
    return out


# -- the rules the page copies (domain/rules.py, agent_text/work.py) ---------------------------------------------

def _views(x: Place) -> List[Dict[str, Any]]:
    with x.p.lock:
        return [views.item_view(x.p.state, x.p.agents, it) for it in x.p.state.items.values() if not it.deleted]


def needs(ws: Workspace) -> Dict[str, Any]:
    """Every status, asked or not, your word after it or not, archived or not; merged; and whether each needs you."""
    x = Place(ws, "needs")
    n = 0
    for status in vocab.STATUSES:
        for asked in (False, True):
            for answered in (False, True):
                for archived in (False, True):
                    n += 1
                    ref = str(n)
                    x.agent({"op": "new", "type": "task", "title": f"{status} asked={asked} answered={answered} archived={archived}"})
                    if status != "proposed":
                        x.you({"op": "set", "ref": ref, "f": {"status": "open"}})
                        if status in ("doing", "review"):
                            x.agent({"op": "set", "ref": ref, "f": {"status": "doing"}})
                        if status == "review":
                            x.agent({"op": "set", "ref": ref, "f": {"status": "done"}})
                        if status in ("open", "done", "dropped"):
                            x.you({"op": "set", "ref": ref, "f": {"status": status}})
                    if asked:
                        x.agent({"op": "say", "ref": ref, "kind": "ask", "text": "Which one?"})
                    if answered:
                        x.you({"op": "say", "ref": ref, "text": "This one."})
                    if archived:
                        x.you({"op": "set", "ref": ref, "f": {"archived": True}})
    x.agent({"op": "new", "type": "task", "title": "merged"}, {"op": "merge", "ref": str(n + 1), "into": "1"})
    with x.p.lock:
        want = {str(it.n): rules.needs_you(x.p.state, it) for it in x.p.state.items.values()}
    return {"items": _views(x), "needs": want}


def user_words() -> List[Dict[str, Any]]:
    return [{"by": by, "kind": kind, "src": src, "user": rules.user_word(Message(id=1, by=by, kind=kind, text="", t="", src=src))}
            for by in ("you", "org", AGENT, vocab.TASKA) for kind in vocab.MESSAGE_KINDS for src in (None, "r1")]


def queue(ws: Workspace) -> List[Dict[str, Any]]:
    """Items in progress or not, placed by you (rank) or not, by priority: the order agents take them."""
    out: List[Dict[str, Any]] = []
    for i, rows in enumerate([
        [("P2", None, False), ("P1", None, False), ("P2", None, True), ("P3", 1, False), ("P0", None, False)],
        [("P1", -5, False), ("P1", None, False), ("P0", None, False), ("P2", -9, False), ("P3", None, False), ("P1", 3, False)],
        [("P2", 2, True), ("P0", None, True), ("P1", 1, False), ("P1", None, False), ("P1", 1, True)],
    ]):
        x = Place(ws, f"queue-{i}")
        for k, (pri, rank, doing) in enumerate(rows, 1):
            x.you(task(f"Item {k}", pri=pri))
            if rank is not None:
                x.you({"op": "set", "ref": str(k), "f": {"rank": rank}})
            if doing:
                x.agent({"op": "set", "ref": str(k), "f": {"status": "doing"}})
        with x.p.lock:
            order = [it.n for it in rules.queue_order(list(x.p.state.items.values()))]
        out.append({"items": _views(x), "order": order})
    return out


def _next(x: Place, held: List[str]) -> Dict[str, Any]:
    """What /next hands an agent on nothing yet, every item in progress another session's (it skips those)."""
    with x.p.lock:
        st = x.p.state
        rd = Reading(state=st, held=lambda inp: inp.id in held, organizer_on=False, file_ref=lambda f: f, file_path=lambda f: f)
        asker = Asker(who=AGENT, session="case", holder=lambda it: ("other", 0.0) if it.status == "doing" else None)
        given = next_work(rd, x.p.slug, False, asker).given
    return {"items": _views(x), "inputs": [views.input_view(i, None, None) for i in st.inputs.values()], "held": held, "next": given}


def next_up(ws: Workspace) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []

    def place(name: str, rows: List[Tuple[str, str, str]]) -> Place:
        """(pri, when, type) per item, open."""
        x = Place(ws, name)
        for k, (pri, when, kind) in enumerate(rows, 1):
            x.you({"op": "new", "type": kind, "title": f"Item {k}", "pri": pri, "when": when})
        return x

    x = place("next-0", [("P2", "now", "task"), ("P1", "now", "bug"), ("P0", "later", "task"), ("P1", "now", "idea")])
    out.append(_next(x, []))  # the queue's head: now, by priority, oldest first
    x = place("next-1", [("P1", "now", "task"), ("P1", "now", "task"), ("P2", "now", "task")])
    x.agent({"op": "say", "ref": "3", "text": "Started on it."})
    x.you({"op": "say", "ref": "3", "text": "Look at this first."})
    out.append(_next(x, []))  # you replied on a P2: the P1 queue head is more urgent
    x.you({"op": "set", "ref": "1", "f": {"pri": "P2"}}, {"op": "set", "ref": "2", "f": {"pri": "P2"}})
    out.append(_next(x, []))  # you replied on it, and it is as urgent as the head: it comes first
    x = place("next-2", [("P1", "now", "task"), ("P2", "now", "task")])
    x.agent({"op": "set", "ref": "2", "f": {"status": "doing"}}, {"op": "say", "ref": "2", "kind": "progress", "text": "Halfway."})
    x.you({"op": "say", "ref": "2", "text": "Stop: not like that."})
    out.append(_next(x, []))  # you replied on work in progress: it is resumed first
    x = place("next-3", [("P1", "now", "task"), ("P2", "now", "task")])
    x.you({"op": "input", "text": "", "scope": "1", "files": [x.file("note.webm", "audio/webm")]})
    out.append(_next(x, ["r1"]))  # your voice note on it is still being worked out: it waits, it comes next
    x = place("next-4", [("P1", "now", "task"), ("P2", "now", "task"), ("P0", "now", "task")])
    x.you(task("Sub", parent="1", pri="P3"))
    x.agent({"op": "say", "ref": "3", "kind": "ask", "text": "Which one?"})
    out.append(_next(x, []))  # asked: it waits on you; a parent waits for its subitem
    x = place("next-5", [("P1", "later", "task")])
    x.agent({"op": "say", "ref": "1", "text": "Done?"})
    x.you({"op": "say", "ref": "1", "text": "Not yet: one more thing."})
    out.append(_next(x, []))  # the queue is empty: an item you replied on, even Later
    x = place("next-6", [("P0", "now", "task"), ("P1", "now", "task")])
    x.agent({"op": "set", "ref": "1", "f": {"status": "doing"}})
    out.append(_next(x, []))  # in progress is another session's: the next one
    x = place("next-7", [("P0", "now", "task")])
    x.you(task("Middle", parent="1", pri="P1"), task("Deep", parent="2", pri="P3"))
    x.you({"op": "set", "ref": "2", "f": {"status": "done"}})
    out.append(_next(x, []))  # an open subitem at any depth, under a finished one, comes before its parent
    return out


def _ts(v: Any) -> str:
    return json.dumps(v, ensure_ascii=True)


def vocab_text() -> str:
    """domain/vocab.py's words, for the page (model/vocab.gen.ts)."""
    v = vocab
    rows = [
        ("LETTER", "Each item type and the letter of its code (the order of the page's type menus).", v.LETTER),
        ("TYPES", "The item types.", list(v.LETTER)),
        ("PRIORITIES", "Priorities, the most urgent first.", list(v.PRIORITIES)),
        ("DEFAULT_PRI", "A new item's priority when nobody says one (r10, r1072).", v.DEFAULT_PRI),
        ("WHENS", "Now or later.", list(v.WHENS)),
        ("STATUSES", "An item's statuses, in their order.", list(v.STATUSES)),
        ("CLOSED", "The finished statuses.", list(v.CLOSED)),
        ("DECISIONS", "The two choices of a proposal (approve, won't do) and of finished work (accept, not yet).",
         {k: list(x) for k, x in v.DECISIONS.items()}),
        ("PEOPLE", "The user, and the organizer, who writes down what the user said.", list(v.PEOPLE)),
        ("TASKA", "Taska's own notes to an agent.", v.TASKA),
        ("NOTES", "Neither side's word: the organizer's own notes, and Taska's.", list(v.NOTES)),
        ("MESSAGE_KINDS", "The kinds of a message on an item.", list(v.MESSAGE_KINDS)),
        ("USER_KINDS", "What the organizer files from an input as the user's own: their words, decision, idea.", list(v.USER_KINDS)),
        ("WORK_TYPES", "The types of work /next hands out.", list(v.WORK_TYPES)),
        ("DOC_KEY", "The comment thread on a document as a whole.", v.DOC_KEY),
    ]
    body = "".join(f"/** {doc} */\nexport const {name} = {_ts(val)} as const\n\n" for name, doc, val in rows)
    return ("// Generated by tools/rule_cases.py from server/taska/domain/vocab.py: do not edit (regenerate: python3 tools/rule_cases.py).\n"
            "// The words of Taska's data, as the server has them.\n\n" + body.rstrip("\n") + "\n")


def render() -> Tuple[str, str]:
    """The two files, as they are written: the cases, the words."""
    step = iter(range(10 ** 6))
    real = project_module.now_iso

    def clock() -> str:  # one second per change: times that tell changes apart, the same on every machine
        n = next(step)
        return f"2026-11-06T{9 + n // 3600:02d}:{n // 60 % 60:02d}:{n % 60:02d}-08:00"

    project_module.now_iso = clock  # type: ignore[assignment]
    try:
        with tempfile.TemporaryDirectory(prefix="taska-cases-") as tmp:
            ws = Workspace(os.path.join(tmp, "data"), "", gemini=False)
            try:
                cases = effects(ws)
                more = {"NEEDS": needs(ws), "USER_WORDS": user_words(), "QUEUE": queue(ws), "NEXT": next_up(ws)}
            finally:
                ws.close()
    finally:
        project_module.now_iso = real  # type: ignore[assignment]
    text = json.dumps(cases, ensure_ascii=True, indent=1)
    rest = "".join(f"export const {k}: {TYPES[k]} = {json.dumps(v, ensure_ascii=True, indent=1)}\n\n" for k, v in more.items())
    return (
        "// Generated by tools/rule_cases.py from the server's own rules: do not edit (regenerate: python3 tools/rule_cases.py).\n\n"
        "import type { Command } from './commands'\n"
        "import type { Doc, Input, Item, Kind, UndoEntry, Voice } from './types'\n\n"
        "/** A project as the page gets it (page_api/views.py entities, and what can be undone). */\n"
        "export interface Seen {\n  items: Item[]\n  inputs: Input[]\n  docs: Doc[]\n  voices: Voice[]\n  undo: UndoEntry[]\n}\n\n"
        "/** What a change did on the server: the project before, the commands you sent, the project after. */\n"
        "export interface EffectCase {\n  name: string\n  before: Seen\n  commands: Command[]\n  after: Seen\n}\n\n"
        f"export const EFFECTS: EffectCase[] = {text}\n\n"
        "/** Items, and whether each needs you (domain/rules.py needs_you), by its number. */\n"
        "export interface NeedsCase {\n  items: Item[]\n  needs: Record<string, boolean>\n}\n\n"
        "/** A message, and whether it is the user's own words (user_word). */\n"
        "export interface UserWordCase {\n  by: string\n  kind: Kind\n  src: string | null\n  user: boolean\n}\n\n"
        "/** Items, and the order agents take them (queue_order). */\n"
        "export interface QueueCase {\n  items: Item[]\n  order: number[]\n}\n\n"
        "/** A project, the inputs whose voice notes are still being worked out, and the item /next hands out next. */\n"
        "export interface NextCase {\n  items: Item[]\n  inputs: Input[]\n  held: string[]\n  next: number | null\n}\n\n"
        + rest.rstrip("\n") + "\n"
    ), vocab_text()


TYPES = {"NEEDS": "NeedsCase", "USER_WORDS": "UserWordCase[]", "QUEUE": "QueueCase[]", "NEXT": "NextCase[]"}


def main() -> None:
    cases, words = render()
    for path, text in ((OUT, cases), (VOCAB, words)):
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(text)
        print("wrote", os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main()
