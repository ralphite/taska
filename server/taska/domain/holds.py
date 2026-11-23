"""Which agent session holds a task (T769, T772, T877), from the projected state alone: the last one /next gave it to or
that wrote to it, while fresh (CLAIM_TTL); past that, while its app says it is still at work on it."""

from __future__ import annotations

from typing import Callable, Optional, Tuple

from .model import Task
from .state import ProjectState, ident
from .text import seconds
from .vocab import CLAIM_TTL

Hold = Tuple[str, float]  # the session ("claude-code · worker") and when it took the task or last wrote on it


def fresh(state: ProjectState, it: Task, now: float) -> Optional[Hold]:
    """The session on the task while its hold is fresh: the latest of its claim and its last change while doing."""
    c = state.claims.get(it.n)
    best = (c.who, c.since) if c and now - c.since < CLAIM_TTL else None
    a = it.agent
    if a and it.status == "doing":
        t = seconds(a.t)
        if now - t < CLAIM_TTL and (not best or t >= best[1]):
            best = (ident(a.by, a.ses), t)
    return best


def kept(state: ProjectState, it: Task, status: Callable[[str], str]) -> Optional[Hold]:
    """T877: a hold past CLAIM_TTL on a task doing stays while its session is at work in its app (`status` of the
    session: busy, also while an agent of its own works on in the background, or waiting on the user) and this is the
    task it took last. A session that hands the work to its own agent goes quiet on Taska, and another session was
    sent to do the same work."""
    if it.status != "doing":
        return None
    c, a = state.claims.get(it.n), it.agent
    found = ([(c.who, c.since)] if c else []) + ([(ident(a.by, a.ses), seconds(a.t))] if a else [])
    if not found:
        return None
    who, since = max(found, key=lambda x: x[1])
    if status(who) not in ("busy", "waiting"):
        return None
    later = any(n != it.n and x.who == who and x.since > since for n, x in state.claims.items()) or any(
        n != it.n and t.agent and t.status == "doing" and ident(t.agent.by, t.agent.ses) == who
        and seconds(t.agent.t) > since for n, t in state.tasks.items())
    return None if later else (who, since)
