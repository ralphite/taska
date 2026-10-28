"""Commands on the project itself: its name for people (its address never changes)."""

from __future__ import annotations

from ..domain import events as ev
from ..domain.text import project_title
from ..domain.vocab import Refused
from .base import Args, Outcome, Run, handles


@handles("cfg")
def rename(r: Run, a: Args) -> Outcome:
    if not a.has("name"):
        raise Refused("cfg needs name")
    title = project_title(a.get("name"))
    r.emit(ev.ProjectRenamed(name=title, by=r.by))
    return Outcome(f"ok named {title}", "")
