"""The server's rules as cases the page checks its own copies against: each case runs on the real server code (a
fresh project in a temporary folder, never real data) and is written into web/src/model/ruleCases.gen.ts.

- EFFECTS: what a change does (refactor 7): a project as the page sees it (page_api/views.py), the commands you send
  (model/commands.ts), and the project after the server ran them. model/optimistic.test.ts holds each preview to it.

tests/test_rule_cases.py writes the file again in memory and fails when it differs. Regenerate after changing a rule
the page copies, or a case here:

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
sys.path.insert(0, os.path.join(ROOT, "server"))

from taska.page_api import views  # noqa: E402
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


def render() -> str:
    """The file, as it is written."""
    with tempfile.TemporaryDirectory(prefix="taska-cases-") as tmp:
        ws = Workspace(os.path.join(tmp, "data"), "", gemini=False)
        try:
            cases = effects(ws)
        finally:
            ws.close()
    text = json.dumps(cases, ensure_ascii=True, indent=1)
    return (
        "// Generated by tools/rule_cases.py from the server's own rules: do not edit (regenerate: python3 tools/rule_cases.py).\n\n"
        "import type { Command } from './commands'\n"
        "import type { Doc, Input, Item, UndoEntry, Voice } from './types'\n\n"
        "/** A project as the page gets it (page_api/views.py entities, and what can be undone). */\n"
        "export interface Seen {\n  items: Item[]\n  inputs: Input[]\n  docs: Doc[]\n  voices: Voice[]\n  undo: UndoEntry[]\n}\n\n"
        "/** What a change did on the server: the project before, the commands you sent, the project after. */\n"
        "export interface EffectCase {\n  name: string\n  before: Seen\n  commands: Command[]\n  after: Seen\n}\n\n"
        f"export const EFFECTS: EffectCase[] = {text}\n"
    )


def main() -> None:
    text = render()
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(text)
    print("wrote", os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
