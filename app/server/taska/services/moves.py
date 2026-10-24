"""Moving work between projects: an input sent to the wrong project, and an item (with its subitems, the words it
came from, its talk and its documents) that belongs in another one."""

from __future__ import annotations

import threading
from typing import Any, Dict, List, Optional, Set, Tuple

from ..domain import events as ev
from ..domain.history import made_by_organizer
from ..domain.model import FileRef, Item
from ..domain.rules import item_at
from ..domain.vocab import MAX_TEXT, Refused
from .project import Project


class Moves:
    """Moves between the projects of a workspace: one move of an item at a time; an input on its way out takes no
    other change until it is gone."""

    def __init__(self) -> None:
        self.one_at_a_time = threading.Lock()  # an item move, and the page's answer for it, whole
        self._out: Set[Tuple[str, str]] = set()  # (project, input) on their way to another project
        self._out_lock = threading.Lock()

    def moving(self, slug: str, rid: str) -> bool:
        with self._out_lock:
            return (slug, rid) in self._out

    def _leaving(self, slug: str, rid: str, on: bool) -> None:
        with self._out_lock:
            (self._out.add if on else self._out.discard)((slug, rid))

    def input(self, here: Project, there: Optional[Project], rid: Any) -> Dict[str, Any]:
        """The input lives on in the other project as a new input (its files copied); here it is marked moved, and
        what the organizer made of it here is undone."""
        if not there or there is here:
            raise Refused("choose another project")
        with here.lock:
            inp = here.state.inputs.get(rid)
            if not inp:
                raise Refused(f"unknown input {rid}")
            if inp.moved or self.moving(here.slug, rid):
                raise Refused(f"{rid} was moved already")
            if inp.deleted:
                raise Refused(f"{rid} is deleted; restore it first")
            if here.organizing.busy == rid:
                raise Refused(f"{rid} is being organized right now; try again in a moment")
            self._leaving(here.slug, rid, True)
            blobs: List[Tuple[FileRef, bytes]] = [(f, here.files.read(f.f)) for f in inp.files]
            text = inp.text
        try:
            files: List[FileRef] = []
            for f, blob in blobs:  # the other project keeps its own copies
                copy = there.files.save(f.name, f.mime, blob)
                if f.tr:
                    files.append(copy.with_words(f.tr))
                    continue
                files.append(copy)
                with here.lock:  # words still being worked out here go to the copy too, and hold it there
                    job = here.voice.jobs.get(f.f)
                    if job:
                        here.voice.forwards.setdefault(f.f, []).append((there.voice, copy.f))
                if job:
                    with there.lock:
                        there.voice.jobs[copy.f] = job
                    there.voice.hold_timer(job)
            lines, _ = there.run([(0, {"op": "input", "text": text, "files": [x.to_row() for x in files]})], "you")
            if not lines[0].startswith("ok"):
                raise Refused(lines[0])
            new = lines[0].split()[-1]
            with here.lock:
                current = here.state.inputs[rid]
                if made_by_organizer(here.state, rid) and current.org and not current.org.undone:
                    here.emit(ev.FilingUndone(src=rid, by="you"))
                here.emit(ev.InputMoved(src=rid, to=there.slug, as_=new, by="you"))
        finally:
            self._leaving(here.slug, rid, False)
        return {"ok": True, "to": there.slug, "as": new}

    def item(self, here: Project, there: Optional[Project], ref: Any, under: Any = None) -> Dict[str, Any]:
        """The item is made there with its words and talk (and its subitems, the inputs it came from, its documents);
        here it says where it went and is closed."""
        if not there or there is here:
            raise Refused("choose another project")
        named = here.state.title or here.slug
        with here.lock:
            st = here.state
            root = item_at(st, ref, follow=False)
            if root.deleted or root.merged_into:
                raise Refused(f"{st.code(root.n)} cannot be moved")
            plan = []
            docs: List[Tuple[int, str, str]] = []
            said: List[Tuple[int, str, str, List[Tuple[str, str, bytes, str]]]] = []
            for it, par in _tree(here, root):
                code = st.code(it.n)
                talk = "\n\n".join(f"{x.by} ({_stamp(x.t)}): {x.text}" for x in it.thread if x.text and not x.hidden)
                body = it.body + (f"\n\n---\nTalk in {named} {code}:\n\n{talk}" if talk else "")
                plan.append((it.n, par, code, it.status, bool(it.archived), {
                    "title": it.title, "body": body[:MAX_TEXT], "type": it.type, "pri": it.pri, "when": it.when, "next": it.next}))
                replies = {x.src for x in it.thread if x.by == "you" and x.src}
                for rid in it.srcs:  # what it was made from goes along too, as one message there
                    inp = st.inputs.get(rid)
                    if rid in replies or not inp:
                        continue
                    got: List[Tuple[str, str, bytes, str]] = []
                    for f in inp.files:
                        try:
                            got.append((f.name or f.f, f.mime or "", here.files.read(f.f), f.tr or ""))
                        except OSError:
                            pass
                    if got or (inp.text or "").strip():
                        said.append((it.n, rid, inp.text or "", got))
                for d in sorted((d for d in st.docs.values() if d.n == it.n and not d.deleted), key=lambda d: d.d):
                    notes = "\n\n".join(f"- {c.by} ({_stamp(c.t)})" + (f" on “{c.quote[:200]}”" if c.quote else "")
                                        + f": {c.text}" for c in d.comments if c.text)
                    md = d.md + (f"\n\n---\nComments in {named} D{d.d}:\n\n{notes}" if notes else "")
                    docs.append((it.n, d.title or "", md))
        parent_there = None
        if under:  # put it under an item there
            with there.lock:
                parent_there = there.state.code(item_at(there.state, under, follow=False).n)
        new_as: Dict[int, str] = {}
        for n, par, code, status, archived, fields in plan:
            command: Dict[str, Any] = {"op": "new", **fields, "status": status}
            if par is not None:
                command["parent"] = new_as[par]
            elif parent_there:
                command["parent"] = parent_there
            lines, _ = there.run([(0, command)], "you")
            if not lines[0].startswith("ok"):
                raise Refused(f"{code}: {lines[0]}")
            new_as[n] = lines[0].split()[1]
            if archived:
                there.run([(0, {"op": "set", "ref": new_as[n], "f": {"archived": True}})], "you")
        for n, rid, text, got in said:
            files = [there.files.save(name, mime, data) for name, mime, data, _ in got]
            words = "\n".join(f"> {tr}" for (_, _, _, tr) in got if tr)
            msg = f"What you said in {named} ({rid}):" + (f"\n\n{text}" if text.strip() else "") \
                + (f"\n\n{words}" if words and not text.strip() else "")
            there.run([(0, {"op": "say", "ref": new_as[n], "kind": "say", "text": msg[:MAX_TEXT], "files": [x.f for x in files]})], "you")
        for n, title, md in docs:
            there.run([(0, {"op": "doc", "ref": new_as[n], "title": title, "md": md})], "you")
        to_name = there.state.title or there.slug
        for n, _, code, _, _, _ in plan:
            here.run([(0, {"op": "say", "ref": code, "kind": "progress", "text": f"Moved to {to_name} as {new_as[n]}"}),
                      (1, {"op": "set", "ref": code, "f": {"status": "dropped", "archived": True}})], "you")
        extra = {k: v for k, v in (("with", len(plan) - 1), ("docs", len(docs))) if v}
        return {"ok": True, "as": new_as[plan[0][0]], **extra}



def _tree(here: Project, root: Item) -> List[Tuple[Item, Optional[int]]]:
    """The item and its subitems, parents before their children: (item, its parent's number)."""
    out: List[Tuple[Item, Optional[int]]] = []
    todo: List[Tuple[Item, Optional[int]]] = [(root, None)]
    while todo:
        it, par = todo.pop(0)
        out.append((it, par))
        todo += [(k, it.n) for k in sorted(here.state.items.values(), key=lambda k: k.n) if k.parent == it.n and k.live]
    return out


def _stamp(t: str) -> str:
    return t[:16].replace("T", " ")
