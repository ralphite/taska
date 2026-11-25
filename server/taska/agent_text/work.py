"""/next: what an agent should do now. New inputs first, then a document's unanswered comments, then the tasks the
user replied on while an agent is working on them (in progress), then what another session wrote for it, then the
queue (doing first, then by priority, oldest first; subtasks before their parent), skipping what another session
holds. Any other task the user replied on (open, proposed, a question answered) waits its turn by priority (T606,
Yadong's choice): it comes before the queue's next task only when that one is not in progress and is no more
urgent."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Callable, List, Optional, Tuple

from ..domain import history, rules
from ..domain.model import Task, Message
from ..domain.state import ident
from ..domain.vocab import CLOSED
from .render import on_it, Reading, card, doc_text, input_card, proposal_text, proposals_for, rules_head

Holder = Callable[[Task], Optional[Tuple[str, float]]]
Calls = Callable[[], List[Tuple[Task, Message, bool]]]


# T762: the Antigravity session's waker, started (or left running) before each turn ends; it wakes the session
ANTIGRAVITY_WAKER = 'curl -s "BASE/waker" | sh -s "$ANTIGRAVITY_CONVERSATION_ID"'

@dataclass
class Work:
    text: str
    has_work: bool
    given: Optional[int] = None  # the task whose card it holds
    claim: Optional[Tuple[int, str]] = None  # (task, session): the queue task it takes
    stop: Optional[Tuple[int, int]] = None  # (task, the change): told to stop it (T816)


@dataclass
class Asker:
    """Who asks: the agent and its session (None for the page), and how to find holds and calls for it."""

    who: Optional[str] = None
    session: str = ""
    holder: Holder = field(default=lambda it: None)
    calls: Calls = field(default=lambda: [])
    told: Callable[[int], bool] = field(default=lambda seq: False)  # was it told of this change already


def _q(s: str) -> str:
    """s for a URL's query (as urllib.parse.quote; this layer does no I/O, so not urllib)."""
    keep = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
    return "".join(chr(b) if chr(b) in keep else f"%{b:02X}" for b in s.encode("utf-8"))


def _stop(st, asker: Asker) -> Optional[Tuple[int, int]]:
    """The first task closed under this agent session that it was not told of: the one on it, or any when no one
    was heard on it."""
    if not asker.who:
        return None
    me = ident(asker.who, asker.session)
    for n, seq in history.to_stop(st, time.time()):
        a = st.tasks[n].agent
        if not asker.told(seq) and (not a or ident(a.by, a.ses) == me):
            return n, seq
    return None


def next_work(rd: Reading, project_name: str, gone: bool, asker: Asker) -> Work:
    st = rd.state
    if gone:
        return Work(f"Project {project_name} was deleted: there is no work here. The user can restore it in Taska "
                    "(Settings › Projects).\n", False)
    out = ["Keep working without stopping. After each task, write back, then GET /next again."]
    if st.rules and st.rules.md.strip():
        out.append(rules_head(st) + " and follow the parts that apply.")
    live = rules.by_priority(i for i in st.live_tasks() if i.status not in CLOSED and not i.archived)
    talking = {n for r in st.inputs.values() if rd.held(r) for n in [r.scope, *r.touched] if n}
    for label, rows in (
            # answered in part (T749): what was answered is the agent's to pick up, the rest still waits
            ("waiting on the user (skip)", [i for i in live if rules.waiting(st, i) and not rules.replied(i)]),
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
    stop = _stop(st, asker)
    if stop:  # you closed what it was doing: at once, before anything else (T816)
        it = st.tasks[stop[0]]
        how = "marked it won't do" if it.status == "dropped" else "closed it"
        return Work(f"{head}\nstop {st.code(it.n)}: the user {how} while you were on it. Stop working on it now (a "
                    f"worker you gave it to as well), and say on it in one line what you leave: `{st.code(it.n)} say ...`\n"
                    + card(rd, it), True, stop=stop)
    docs = [d for d in st.docs.values() if rules.doc_unanswered(d) and not d.deleted and (d.is_rules or (
            st.tasks.get(d.n) and not st.tasks[d.n].merged_into and not st.tasks[d.n].deleted))]
    if docs:
        d = min(docs, key=lambda d: d.t1)
        return Work(f"{head}\nanswer the user's comments on D{d.d} (GET /D{d.d}):\n" + doc_text(rd, d), True)
    mine = proposals_for(st, asker.who) if asker.who else []
    if mine:  # the user wrote on its proposed change to the rules, or it was sent back to write again (T693)
        return Work(f"{head}\n" + proposal_text(st, mine[0]), True)
    live = [i for i in live if i.n not in talking]  # their latest words are not in yet: they come next
    replied = [i for i in live if rules.replied(i)]
    me = ident(asker.who, asker.session) if asker.who else None
    others: List[Tuple[Task, str]] = []  # what another session is on, shown once as "others are on (skip)"
    if me:  # T885: the user's reply on a task another session is on is for that session, never "resume" for this one
        others = [(i, c[0]) for i in replied for c in [asker.holder(i)] if c and c[0] != me]
        replied = [i for i in replied if all(i is not x for x, _ in others)]
    back = sorted((i for i in replied if rules.in_progress(i)), key=lambda i: i.t1)
    if back:
        it = back[0]
        return Work(f"{head}\nresume {st.code(it.n)}: the user replied\n" + card(rd, it), True, given=it.n)
    fresh = min((i for i in replied if not rules.in_progress(i)), key=lambda i: (i.pri, i.t1), default=None)
    calls = asker.calls() if asker.who else []
    if calls:  # another agent or session wrote to this one, or on the task it is on
        it, x, to_me = calls[0]
        what = "wrote to you" if to_me else "wrote on it (you are on it)"
        return Work(f"{head}\nresume {st.code(it.n)}: {ident(x.by, x.ses)} {what} (#{x.id})\n" + card(rd, it), True,
                    given=it.n)
    work = [i for i in live if i.when == "now" and not i.group and i.status in ("open", "doing")
            and not rules.waiting(st, i) and not rules.open_kids(st, i)]
    blocked = [(i, rules.waits_for(st, i)) for i in work]
    blocked = [(i, ws) for i, ws in blocked if ws]
    if blocked:  # waiting for other tasks (T857): given once they are finished
        out.append("blocked (skip): " + ", ".join(f"{st.code(i.n)} ← {' '.join(st.code(w.n) for w in ws)}" for i, ws in blocked))
        head = "\n".join(out)
    queue = rules.queue_order([i for i in work if all(i is not b for b, _ in blocked)])
    if me:  # what another session is on is theirs; each gets its own next task
        others += [(i, c[0]) for i in queue for c in [asker.holder(i)] if c and c[0] != me and all(i is not x for x, _ in others)]
        queue = [i for i in queue if all(i is not x for x, _ in others)]
    if others:
        out.append("others are on (skip): " + " ".join(f"{st.code(i.n)} ({(on_it(rd, i) or (a, a))[1]})" for i, a in others))
        head = "\n".join(out)
    if fresh and (not queue or (queue[0].status != "doing" and fresh.pri <= queue[0].pri)):
        return Work(f"{head}\nresume {st.code(fresh.n)}: the user replied\n" + card(rd, fresh), True, given=fresh.n)
    if queue:
        it = queue[0]
        waited = f": {' '.join(st.code(n) for n in it.after)} it waited for {'is' if len(it.after) == 1 else 'are'} done" if it.after else ""
        return Work(f"{head}\nnext {st.code(it.n)}{waited} ({len(queue)} in queue: doing first, then P0→P3, oldest first)\n"
                    + card(rd, it), True, given=it.n, claim=(it.n, me) if me else None)
    end = "nothing to do now. End your turn (Claude Code: with the background wait from /agent running; never wait, poll or set a timer in the foreground)."
    if asker.who and asker.who.startswith("claude"):
        # the command itself, so a session that read the guide long ago keeps listening without spending tokens (T633)
        # quoted (T880: a session named "Taska project T875" gave a command curl refused, so the session never waited)
        who = _q(asker.who) + (f"&session={_q(asker.session)}" if asker.session else "")
        end += ("\nClaude Code: before ending the turn, start Taska's wait with Bash run_in_background, as it is (it costs "
                "no tokens; it ends on any work for you, and that wakes you; never write your own loop, T869):\n"
                f"  curl -s \"BASE/listen?by={who}\" | sh")
    elif asker.who == "antigravity":  # T762: Taska's waker wakes the session with a message when there is work
        end += ("\nAntigravity: before ending the turn, run this (it returns at once: it starts Taska's waker for this "
                "session when none runs, which costs no tokens and wakes you with a message when there is work):\n  "
                + ANTIGRAVITY_WAKER)
    return Work(f"{head}\n{end}\n", False)
