"""The page's view of a project: its items, inputs and documents as the page draws them (with the facts the page's
rules need: what waits on the user, whether they spoke last, who read it, what organizing did, what deleting an input
would take), and the project's own facts (agents, what can be undone, what is in Deleted).

Keys are the page's (camelCase); the shapes are this version's own page interface.
"""

from __future__ import annotations

import os
from typing import Any, Callable, Dict, List, Optional

from ..domain import rules
from ..domain.history import DeletionPlan, Filing, deletions, filings, undoable
from ..domain.model import Comment, Doc, FileRef, Input, Item, Message
from ..domain.state import ProjectState
from ..services.agents import AgentActivity

View = Dict[str, Any]


def file_view(f: FileRef) -> View:
    out: View = {"f": f.f, "name": f.name}
    for k in ("mime", "size", "tr", "wait"):
        v = getattr(f, k)
        if v is not None:
            out[k] = v
    return out


def message_view(m: Message) -> View:
    out: View = {"id": m.id, "by": m.by, "kind": m.kind, "text": m.text, "t": m.t, "src": m.src,
                 "files": [file_view(f) for f in m.files]}
    if m.ses:
        out["ses"] = m.ses
    if m.to:
        out["to"] = list(m.to)
    if m.edited:
        out["edited"] = m.edited
    if m.change:
        out["change"] = True
    if m.hidden:
        out["hidden"] = True
    return out


def item_view(st: ProjectState, agents: AgentActivity, it: Item) -> View:
    w = rules.waiting(st, it)
    out: View = {"n": it.n, "code": st.code(it.n), "type": it.type, "title": it.title, "body": it.body, "pri": it.pri,
                 "when": it.when, "status": it.status, "parent": it.parent, "next": it.next, "srcs": list(it.srcs),
                 "mergedInto": it.merged_into, "archived": it.archived, "t0": it.t0, "t1": it.t1, "by": it.by,
                 "thread": [message_view(m) for m in it.thread],
                 "wait": {"id": w.id, "kind": w.kind, "text": w.text, "by": w.by, "ses": w.ses,
                          "files": [file_view(f) for f in w.files]} if w else None,
                 "talked": rules.talked(st, it)}
    if it.agent:
        out["agent"] = {"by": it.agent.by, "t": it.agent.t, "ses": it.agent.ses}
    if it.rank is not None:
        out["rank"] = it.rank
    if it.decided:
        d = it.decided
        out["decided"] = {"from": d.from_, "to": d.to, "msg": d.msg, "t": d.t}
    reads = agents.reads.get(it.n)
    if reads:
        out["readBy"] = {k: int(v * 1000) for k, v in reads.items()}
    return out


def input_view(inp: Input, held: bool, filing: Optional[Filing], plan: Optional[DeletionPlan]) -> View:
    out: View = {"id": inp.id, "t": inp.t, "by": inp.by, "text": inp.text, "scope": inp.scope,
                 "files": [file_view(f) for f in inp.files], "acked": inp.acked, "touched": list(inp.touched),
                 "org": None, "seq": inp.seq, "v": inp.v}
    if inp.org:
        o = inp.org
        out["org"] = {"ok": o.ok, "msg": o.msg, "t": o.t, "keep": o.keep, "changed": bool(o.changed), "undone": o.undone}
    if inp.kind:
        out["kind"] = inp.kind
    if inp.history:
        out["history"] = [{"text": h.text, "t": h.t, "mode": h.mode} for h in inp.history]
        out["updated"] = inp.updated
    if inp.moved:
        out["moved"] = {"to": inp.moved.to, "as": inp.moved.as_}
    if held:
        out["trWait"] = True
    if filing:
        out["filing"] = {"can": filing.can, "what": filing.what, "why": filing.why}
    if plan:
        out["deletion"] = {"go": list(plan.go), "keep": [list(k) for k in plan.keep]}
    return out


def comment_view(c: Comment) -> View:
    out: View = {"id": c.id, "key": c.key, "th": c.th, "quote": c.quote, "text": c.text, "by": c.by, "t": c.t,
                 "files": [file_view(f) for f in c.files]}
    if c.edited:
        out["edited"] = c.edited
    return out


def doc_view(d: Doc) -> View:
    blocks, detached = rules.doc_view(d)
    return {"d": d.d, "n": d.n, "title": d.title, "md": d.md, "t0": d.t0, "t1": d.t1, "by": d.by, "versions": d.versions,
            "fmt": d.fmt or "md",
            "blocks": [{"key": b.key, "kind": b.kind, "text": b.text, "comments": [comment_view(c) for c in b.comments]}
                       for b in blocks],
            "detached": [{"key": t.key, "quote": t.quote, "comments": [comment_view(c) for c in t.comments]} for t in detached],
            "whole": [comment_view(c) for c in rules.doc_whole(d)], "unanswered": rules.doc_unanswered(d),
            "resolved": dict(d.resolved)}


def deleted_inputs(st: ProjectState) -> List[View]:
    """Deleted inputs, newest deletion first, with what went with them."""
    rows = sorted((i for i in st.inputs.values() if i.deleted), key=lambda i: -(i.deleted.seq if i.deleted else 0))

    def item(n: int) -> View:
        it = st.items[n]
        return {"n": n, "code": st.code(n), "title": it.title, "type": it.type}

    out: List[View] = []
    for i in rows:
        gone = i.deleted
        assert gone is not None
        out.append({"id": i.id, "t": i.t, "at": gone.t, "text": i.text, "files": len(i.files), "scope": i.scope,
                    "items": [item(n) for n in gone.ns if n in st.items],
                    "kept": [dict(item(n), why=why) for n, why in gone.kept if n in st.items]})
    return out


def deleted_things(st: ProjectState) -> List[View]:
    """Items and documents deleted by themselves, newest first."""
    items = [{"kind": "item", "n": g.ns[0], "code": st.code(g.ns[0]), "title": st.items[g.ns[0]].title, "at": g.t,
              "more": len(g.ns) - 1}
             for g in st.deleted_groups if g.ns and g.ns[0] in st.items and st.items[g.ns[0]].deleted == "#item"]
    docs = [{"kind": "doc", "d": d.d, "title": d.title, "at": d.deleted, "on": st.code(d.n) if d.n in st.items else ""}
            for d in st.docs.values() if d.deleted]
    return sorted(items + docs, key=lambda x: str(x["at"]), reverse=True)


def home_short(path: str) -> str:
    home = os.path.expanduser("~")
    return "~" + path[len(home):] if path == home or path.startswith(home + os.sep) else path


def entities(st: ProjectState, agents: AgentActivity, held: Callable[[Input], bool]) -> Dict[str, List[View]]:
    """Every item, input and document the page shows."""
    plans = deletions(st)
    filed = filings(st)
    return {
        "items": [item_view(st, agents, it) for it in st.items.values() if not it.deleted],
        "inputs": [input_view(i, held(i), filed.get(i.id), plans.get(i.id)) for i in st.inputs.values() if not i.deleted],
        "docs": [doc_view(d) for d in st.docs.values()
                 if not d.deleted and not (st.items[d.n].deleted if d.n in st.items else None)],
    }


def project_view(st: ProjectState, agents: AgentActivity, *, slug: str, title: str, organizer_on: bool,
                 organizer_busy: Optional[str], presence: List[View], work: bool, db_path: str) -> View:
    """The project's own facts: its name, who is around, what can be undone, what is in Deleted."""
    return {"slug": slug, "title": title, "width": len(str(st.max_n)), "file": home_short(db_path),
            "organizer": {"on": organizer_on, "busy": organizer_busy},
            "agents": presence, "work": work, "agentsVersion": agents.version,
            "undo": [{"seq": u.seq, "n": u.n, "f": u.f, "was": u.was, "t": u.t} for u in undoable(st)],
            "deletedInputs": deleted_inputs(st), "deleted": deleted_things(st)}
