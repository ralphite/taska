"""/next: what an agent should do now. New inputs first, then a document's unanswered comments, then the items the
user replied on, then what another session wrote for it, then the queue (doing first, then by priority, oldest first;
subitems before their parent), skipping what another session holds."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, List, Optional, Tuple

from ..domain import rules
from ..domain.model import Item, Message
from ..domain.state import ident
from ..domain.vocab import CLOSED, WORK_TYPES
from .render import Reading, card, doc_text, input_card

Holder = Callable[[Item], Optional[Tuple[str, float]]]
Calls = Callable[[], List[Tuple[Item, Message, bool]]]


@dataclass
class Work:
    text: str
    has_work: bool
    given: Optional[int] = None  # the item whose card it holds
    claim: Optional[Tuple[int, str]] = None  # (item, session): the queue item it takes


@dataclass
class Asker:
    """Who asks: the agent and its session (None for the page), and how to find holds and calls for it."""

    who: Optional[str] = None
    session: str = ""
    holder: Holder = field(default=lambda it: None)
    calls: Calls = field(default=lambda: [])


IDEA = ("\nan idea: think it through first. Small and clear: do it. Bigger, or more than one way to go: "
        "post your plan ({code} propose ...) and ask before building.")


def next_work(rd: Reading, project_name: str, gone: bool, asker: Asker) -> Work:
    st = rd.state
    if gone:
        return Work(f"Project {project_name} was deleted: there is no work here. The user can restore it in Taska "
                    "(Settings › Projects).\n", False)
    out = ["Keep working without stopping. After each item, write back, then GET /next again."]
    in_force = rules.rules_in_force(st)
    if in_force:
        n = len(in_force)
        out.append(f"{n} project rule{'s' if n != 1 else ''}: read GET /rules once per session and follow those that apply.")
    live = rules.by_priority(i for i in st.live_items() if i.status not in CLOSED and not i.archived)
    talking = {n for r in st.inputs.values() if rd.held(r) for n in [r.scope, *r.touched] if n}
    for label, rows in (
            ("waiting on the user (skip)", [i for i in live if rules.waiting(st, i)]),
            ("proposed, the user has not approved yet (skip)", [i for i in live if i.status == "proposed" and not rules.replied(i)]),
            ("in review, the user accepts them (skip)", [i for i in live if i.status == "review" and not rules.replied(i)]),
            ("the user's voice note on it is being transcribed (skip, it comes next)", [i for i in live if i.n in talking])):
        if rows:
            out.append(f"{label}: " + " ".join(st.code(i.n) for i in rows))
    head = "\n".join(out)
    inbox = rules.for_agent(st, rd.organizer_on, rd.held)
    if inbox:
        cards = "".join(input_card(rd, i) + "\n" for i in rules.by_number(inbox))
        return Work(f"{head}\nfirst handle the inbox ({len(inbox)}):\n{cards}", True)
    docs = [d for d in st.docs.values() if rules.doc_unanswered(d) and not d.deleted and st.items.get(d.n)
            and not st.items[d.n].merged_into and not st.items[d.n].deleted]
    if docs:
        d = min(docs, key=lambda d: d.t1)
        return Work(f"{head}\nanswer the user's comments on D{d.d} (GET /D{d.d}):\n" + doc_text(rd, d), True)
    live = [i for i in live if i.n not in talking]  # their latest words are not in yet: they come next
    back = sorted((i for i in live if rules.replied(i)), key=lambda i: i.t1)
    if back:
        it = back[0]
        return Work(f"{head}\nresume {st.code(it.n)}: the user replied\n" + card(rd, it), True, given=it.n)
    calls = asker.calls() if asker.who else []
    if calls:  # another agent or session wrote to this one, or on the item it is on
        it, x, to_me = calls[0]
        what = "wrote to you" if to_me else "wrote on it (you are on it)"
        return Work(f"{head}\nresume {st.code(it.n)}: {ident(x.by, x.ses)} {what} (#{x.id})\n" + card(rd, it), True,
                    given=it.n)
    me = ident(asker.who, asker.session) if asker.who else None
    queue = rules.queue_order([i for i in live if i.when == "now" and i.type in WORK_TYPES and i.status in ("open", "doing")
                               and not rules.waiting(st, i) and not rules.open_kids(st, i)])
    if me:  # what another session is on is theirs; each gets its own next item
        theirs = [(i, c[0]) for i in queue for c in [asker.holder(i)] if c and c[0] != me]
        if theirs:
            out.append("others are on (skip): " + " ".join(f"{st.code(i.n)} ({a})" for i, a in theirs))
            head = "\n".join(out)
            queue = [i for i in queue if all(i is not x for x, _ in theirs)]
    if queue:
        it = queue[0]
        how = IDEA.format(code=st.code(it.n)) if it.type == "idea" else ""
        return Work(f"{head}\nnext {st.code(it.n)} ({len(queue)} in queue: doing first, then P0→P3, oldest first){how}\n"
                    + card(rd, it), True, given=it.n, claim=(it.n, me) if me else None)
    return Work(f"{head}\nnothing to do now. Wait for work: GET /next?wait=540 (returns as soon as something comes in).\n",
                False)
