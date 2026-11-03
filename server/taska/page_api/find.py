"""The phone's search (F479) as the page draws it: what was found in every project, closest first, each with its
project. An item or a rule comes as the list has it (item_view, with its parent's code and its subitems counted);
an input with its words, when it was said and the item it became; a document with its title and its item."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from ..domain.finding import Found, terms
from ..domain.vocab import CLOSED
from ..services.workspace import Workspace
from .views import View, item_view


def find_view(ws: Workspace, q: str, here: str) -> Dict[str, Any]:
    how, found = ws.find(q, here)
    out: List[View] = []
    titles: Dict[str, str] = {}
    by_project: Dict[str, List[Tuple[int, Found]]] = {}
    for i, (name, f) in enumerate(found):
        by_project.setdefault(name, []).append((i, f))
    rows: Dict[int, View] = {}
    for name, fs in by_project.items():
        p = ws.projects.get(name)
        if p is None:
            continue
        with p.lock:
            st = p.state
            titles[name] = p.title
            for i, f in fs:
                row: View = {"project": name, "kind": f.kind, "key": f.key, "n": f.n}
                if f.kind in ("items", "rules"):
                    it = st.items.get(f.n or 0)
                    if it is None:
                        continue
                    kids = st.children(it.n)
                    row["item"] = item_view(st, p.agents, it)
                    row["parentCode"] = st.code(it.parent) if it.parent else None
                    row["kids"] = {"done": sum(1 for k in kids if k.status in CLOSED), "all": len(kids)} if kids else None
                elif f.kind == "inputs":
                    r = st.inputs.get(f.key)
                    if r is None:
                        continue
                    row.update(code="#%d" % r.number, title=" ".join(r.text.split())[:200], t=r.t,
                               became=st.code(f.n) if f.n else None)
                else:
                    d = st.docs.get(int(f.key[1:]))
                    if d is None:
                        continue
                    row.update(code="D%d" % d.d, d=d.d, title=d.title, on=st.code(d.n))
                rows[i] = row
    out = [rows[i] for i in sorted(rows)]
    return {"q": q, "by": how, "marks": terms(q), "found": out, "titles": titles}
