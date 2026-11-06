"""The rules document's versions, read back from the log (I693), as Nota derives them: every write is kept in the log,
and the writes of one writer less than 10 minutes apart are one version (it keeps every why, newest first). A
restore and an approved proposal stand alone; a write taken back (undo) and its undo are no
version. Pure functions of the state.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from . import events as ev
from .model import Doc, Proposal
from .sections import changed_since
from .state import ProjectState
from .text import seconds

MERGE_GAP = 10 * 60


@dataclass
class Version:
    v: int
    by: str
    t0: str  # its first write
    t: str  # its last write
    md: str  # the text it left
    whys: List[str] = field(default_factory=list)  # newest first
    srcs: List[str] = field(default_factory=list)
    seqs: List[int] = field(default_factory=list)  # its writes
    restored: Optional[int] = None
    p: Optional[int] = None  # the proposal it approved
    ses: Optional[str] = None


def writes(state: ProjectState, d: Doc) -> List[ev.DocWritten]:
    """The document's writes that stand: none taken back, no undo."""
    out: List[ev.DocWritten] = []
    for e in state.events:
        if isinstance(e, ev.DocWritten) and e.d == d.d:
            if e.undo:
                out = [x for x in out if x.seq != e.undo]
            else:
                out.append(e)
    return out


def versions(state: ProjectState, d: Doc) -> List[Version]:
    """Oldest first."""
    out: List[Version] = []
    last: Optional[ev.DocWritten] = None
    for e in writes(state, d):
        alone = bool(e.restored or e.p or not out)
        joins = (last is not None and not alone and out and not (out[-1].restored or out[-1].p)
                 and e.by == last.by and seconds(e.t) - seconds(last.t) < MERGE_GAP)
        if joins:
            x = out[-1]
            x.t, x.md = e.t, e.md
            x.seqs.append(e.seq)
        else:
            x = Version(v=len(out) + 1, by=e.by, t0=e.t, t=e.t, md=e.md, seqs=[e.seq], restored=e.restored, p=e.p,
                        ses=e.ses)
            out.append(x)
        if e.why:
            x.whys.insert(0, e.why)
        if e.src and e.src not in x.srcs:
            x.srcs.append(e.src)
        last = e
    return out


def current(state: ProjectState, d: Optional[Doc]) -> int:
    """The version the document is at (0: none yet)."""
    return len(versions(state, d)) if d else 0


def version_of_write(state: ProjectState, d: Doc, seq: int) -> int:
    """The version a write is part of (0: before any)."""
    return next((x.v for x in versions(state, d) if seq in x.seqs), 0)


def base_text(state: ProjectState, p: Proposal) -> str:
    """The text a proposal was written on."""
    if not p.base:
        return ""
    e = state.event(p.base)
    return e.md if isinstance(e, ev.DocWritten) else ""


def last_write(state: ProjectState, d: Doc) -> int:
    ws = writes(state, d)
    return ws[-1].seq if ws else 0


def stale(state: ProjectState, d: Doc, p: Proposal) -> List[str]:
    """The sections the proposal changes that changed since it was written (empty: it still applies)."""
    if p.base == last_write(state, d):
        return []
    return changed_since(base_text(state, p), d.md, p.edits)


def waiting(d: Optional[Doc]) -> List[Proposal]:
    """Proposals waiting for the user."""
    return [p for p in d.proposals if p.state == "wait"] if d else []
