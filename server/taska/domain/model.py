"""The records of a project's current state: items, their messages, inputs, documents and their comments.

They are rebuilt from the change log (domain.projector) and written as JSON rows next to it (`to_row`), in the shape
the stored state tables have always had.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .voice_states import DONE, STATES as VOICE_STATES, WAIT

Row = Dict[str, Any]


@dataclass(frozen=True)
class FileRef:
    """A file that came with an input, a message or a comment: taska-files/<f>. A voice note's words are not here:
    they are its one record (Voice, state.voices), by its file (B682)."""

    f: str
    name: str
    mime: Optional[str] = None
    size: Optional[int] = None

    @classmethod
    def from_row(cls, d: Any) -> FileRef:
        if isinstance(d, str):
            return cls(f=d, name=d.split("-", 1)[-1])
        return cls(f=str(d.get("f", "")), name=str(d.get("name", "")), mime=d.get("mime"), size=d.get("size"))

    def to_row(self) -> Row:
        out: Row = {"f": self.f, "name": self.name}
        if self.mime is not None:
            out["mime"] = self.mime
        if self.size is not None:
            out["size"] = self.size
        return out

    @property
    def is_audio(self) -> bool:
        return (self.mime or "").startswith("audio/")


def files_row(files: List[FileRef]) -> List[Row]:
    return [f.to_row() for f in files]


@dataclass
class Voice:
    """A voice note's words: the one record of them (B682). Every place that shows or reads a voice note (an input, a
    message, a comment, a draft) names it by its file and reads its words here; every step of working them out, and a
    correction of yours, changes only this.

    state: wait (being worked out; `early`: the speech model's first words meanwhile), done, none (nobody was heard),
    failed. `said`: word for word; `tidied`: what everyone reads (what agents get). `fixed`: when you last changed the
    tidied words (then they are yours: later words from a model do not replace them); `was`: the words heard before
    you changed them."""

    f: str
    state: str = WAIT  # one of voice_states.STATES
    said: str = ""
    tidied: str = ""
    early: str = ""
    err: str = ""
    fixed: Optional[str] = None
    was: Optional[str] = None
    t: str = ""

    @property
    def words(self) -> str:
        """What it says now: its tidied words, the first words while they are worked out."""
        return self.tidied or (self.early if self.state == WAIT else "")

    def to_row(self) -> Row:
        out: Row = {"f": self.f, "state": self.state, "said": self.said, "tidied": self.tidied}
        for k in ("early", "err", "fixed", "was"):
            v = getattr(self, k)
            if v:
                out[k] = v
        out["t"] = self.t
        return out

    @classmethod
    def from_row(cls, d: Row) -> "Voice":
        state = str(d.get("state") or DONE)
        return cls(f=str(d.get("f", "")), state=state if state in VOICE_STATES else DONE, said=str(d.get("said") or ""),
                   tidied=str(d.get("tidied") or ""), early=str(d.get("early") or ""), err=str(d.get("err") or ""),
                   fixed=d.get("fixed") or None, was=d.get("was") or None, t=str(d.get("t") or ""))


@dataclass
class Message:
    """One message in an item's talk: the user's (by "you"), the organizer's ("org") or an agent's."""

    id: int  # the change number that wrote it
    by: str
    kind: str
    text: str
    t: str
    src: Optional[str]  # the input it came from
    files: List[FileRef] = field(default_factory=list)
    ses: Optional[str] = None  # the agent's session
    to: Optional[List[str]] = None  # the agent sessions it names with @name
    edited: Optional[str] = None
    change: bool = False  # a note on an edit of the input, not the input's words
    hidden: Optional[bool] = None
    of: Optional[List[int]] = None  # your answer to these of the questions in a row, the others still wait (B749)

    def to_row(self) -> Row:
        out: Row = {"id": self.id, "by": self.by, "kind": self.kind, "text": self.text, "t": self.t, "src": self.src,
                    "files": files_row(self.files)}
        if self.of:
            out["of"] = list(self.of)
        if self.ses:
            out["ses"] = self.ses
        if self.to:
            out["to"] = list(self.to)
        if self.edited is not None:
            out["edited"] = self.edited
        if self.change:
            out["change"] = True
        if self.hidden is not None:
            out["hidden"] = self.hidden
        return out


@dataclass
class AgentMark:
    """Who works on an item and when it was last heard of there."""

    by: str
    t: str
    ses: Optional[str] = None

    def to_row(self) -> Row:
        return {"by": self.by, "t": self.t, **({"ses": self.ses} if self.ses else {})}


@dataclass
class Decision:
    """What the user decided on a proposal or on finished work: from proposed/review to the choice."""

    from_: str
    to: str
    msg: Optional[int]  # the agent's last message at the time
    t: str

    def to_row(self) -> Row:
        return {"from": self.from_, "to": self.to, "msg": self.msg, "t": self.t}


ITEM_FIELDS = ("title", "body", "next", "pri", "when", "status", "type", "parent", "archived", "rank", "later_until")


@dataclass
class Item:
    n: int
    type: str
    title: str
    body: str
    pri: str
    when: str
    status: str
    parent: Optional[int]
    next: str
    t0: str
    t1: str
    by: Optional[str]  # who made it
    thread: List[Message] = field(default_factory=list)
    srcs: List[str] = field(default_factory=list)  # the inputs it came from or that added to it
    merged_into: Optional[int] = None
    archived: bool = False
    agent: Optional[AgentMark] = None
    rank: Optional[float] = None  # the user's order within a priority (smaller first); None: by priority
    decided: Optional[Decision] = None
    deleted: Optional[str] = None  # the input it was deleted with, or "#item" when deleted by itself
    deleted_at: Optional[str] = None
    later_until: Optional[str] = None  # Later until this day (YYYY-MM-DD, local): then back to Now by itself (D115 #21)

    def get(self, name: str) -> Any:
        """A field that a change can set (ITEM_FIELDS)."""
        return getattr(self, name)

    def put(self, name: str, value: Any) -> None:
        if name in ITEM_FIELDS:
            setattr(self, name, value)

    @property
    def live(self) -> bool:
        """Not merged into another item and not deleted."""
        return self.merged_into is None and not self.deleted

    def to_row(self) -> Row:
        out: Row = {"n": self.n, "type": self.type, "title": self.title, "body": self.body, "pri": self.pri,
                    "when": self.when, "status": self.status, "parent": self.parent, "next": self.next,
                    "thread": [m.to_row() for m in self.thread], "srcs": list(self.srcs),
                    "merged_into": self.merged_into, "archived": self.archived, "t0": self.t0, "t1": self.t1,
                    "by": self.by}
        if self.agent:
            out["agent"] = self.agent.to_row()
        if self.rank is not None:
            out["rank"] = self.rank
        if self.decided:
            out["decided"] = self.decided.to_row()
        if self.deleted:
            out["deleted"] = self.deleted
        if self.deleted_at:
            out["deleted_at"] = self.deleted_at
        if self.later_until:
            out["later_until"] = self.later_until
        return out


@dataclass
class OrgNote:
    """What the organizer did with an input, as the page and /inbox say it."""

    ok: bool
    msg: str
    t: str
    keep: bool  # left for the coding agent
    changed: Optional[bool] = None
    undone: bool = False

    def to_row(self) -> Row:
        out: Row = {"ok": self.ok, "msg": self.msg, "t": self.t, "keep": self.keep}
        if self.changed is not None:
            out["changed"] = self.changed
        if self.undone:
            out["undone"] = True
        return out


@dataclass
class InputVersion:
    text: str
    t: str
    mode: str  # edit, append

    def to_row(self) -> Row:
        return {"text": self.text, "t": self.t, "mode": self.mode}


@dataclass
class InputDeletion:
    """An input in Deleted: when, by which change, the items that went with it and those that stayed (and why)."""

    t: str
    seq: int
    ns: List[int]
    kept: List[List[Any]]  # [n, why]

    def to_row(self) -> Row:
        return {"t": self.t, "seq": self.seq, "ns": list(self.ns), "kept": [list(k) for k in self.kept]}


@dataclass
class Moved:
    """An input sent to the wrong project lives on in `to` as `as_`."""

    to: str
    as_: str

    def to_row(self) -> Row:
        return {"to": self.to, "as": self.as_}


@dataclass
class Input:
    """What the user said, verbatim: a new input to the project, or a reply on an item (scope)."""

    id: str  # r12
    t: str
    by: str
    text: str
    scope: Optional[int]
    files: List[FileRef]
    seq: int  # the change that made it
    acked: bool = False  # handled
    touched: List[int] = field(default_factory=list)  # the items it made or changed
    org: Optional[OrgNote] = None
    kind: Optional[str] = None  # "answer": a form sent on its item, filed as it is; "cancelled": not sent (B627)
    history: List[InputVersion] = field(default_factory=list)
    v: int = 0  # bumps on every change of its words
    edit_seq: int = 0
    updated: Optional[str] = None
    moved: Optional[Moved] = None
    deleted: Optional[InputDeletion] = None
    q: str = ""  # the page's own id for it, as it sent it: the page tells it from what it still shows on its way

    @property
    def number(self) -> int:
        return int(self.id[1:])

    def to_row(self) -> Row:
        out: Row = {"id": self.id, "t": self.t, "by": self.by, "text": self.text, "scope": self.scope,
                    "files": files_row(self.files), "acked": self.acked, "touched": list(self.touched),
                    "org": self.org.to_row() if self.org else None, "seq": self.seq}
        if self.kind:
            out["kind"] = self.kind
        if self.history:
            out["history"] = [h.to_row() for h in self.history]
            out["v"], out["edit_seq"], out["updated"] = self.v, self.edit_seq, self.updated
        elif self.v:
            out["v"] = self.v
        if self.moved:
            out["moved"] = self.moved.to_row()
        if self.deleted:
            out["deleted"] = self.deleted.to_row()
        return out


@dataclass
class Comment:
    """A comment in a document: on a paragraph (key), the document as a whole (DOC_KEY) or a part of a web page."""

    id: int
    key: str
    th: int  # its thread within the paragraph: each place selected has its own
    quote: str
    text: str
    by: str
    t: str
    files: List[FileRef] = field(default_factory=list)
    edited: Optional[str] = None
    ses: Optional[str] = None  # the agent's session: a comment names it as a message does (T711)

    def to_row(self) -> Row:
        out: Row = {"id": self.id, "key": self.key, "th": self.th, "quote": self.quote, "text": self.text,
                    "by": self.by, "t": self.t, "files": files_row(self.files)}
        if self.edited is not None:
            out["edited"] = self.edited
        if self.ses:
            out["ses"] = self.ses
        return out


@dataclass
class SectionEdit:
    """One change to the rules document by its sections (I693): replace, add (after a section, else at the end) or
    delete a section named by its heading, or the whole text."""

    op: str
    section: str = ""
    md: str = ""
    after: str = ""

    def to_row(self) -> Row:
        out: Row = {"op": self.op}
        for k in ("section", "md", "after"):
            if getattr(self, k):
                out[k] = getattr(self, k)
        return out

    @classmethod
    def from_row(cls, r: Any) -> SectionEdit:
        return cls(op=str(r.get("op", "")), section=str(r.get("section") or ""), md=str(r.get("md") or ""),
                   after=str(r.get("after") or ""))


@dataclass
class Proposal:
    """An agent's proposed change to the rules (I693), written on the text as it was at `base` (its write's number in
    the log): waiting for the user, approved, declined, or sent back because a section it changes changed since."""

    id: int  # its event's number in the log
    by: str
    t: str
    why: str
    base: int
    edits: List[SectionEdit] = field(default_factory=list)
    ses: Optional[str] = None
    src: Optional[str] = None
    state: str = "wait"  # wait, approved, declined, stale
    decided: Optional[str] = None  # when
    note: str = ""  # sent back: the sections that changed

    def to_row(self) -> Row:
        out: Row = {"id": self.id, "by": self.by, "t": self.t, "why": self.why, "base": self.base,
                    "edits": [e.to_row() for e in self.edits], "state": self.state}
        for k in ("ses", "src", "decided", "note"):
            if getattr(self, k):
                out[k] = getattr(self, k)
        return out


@dataclass
class Doc:
    """A document on an item: Markdown (the default) or a web page (fmt "html"), with its comments. The project's rules
    are one document of the project itself (kind "rules", no item: n 0), with its proposals (I693)."""

    d: int
    n: int  # the item it belongs to (0: the project's)
    t0: str
    title: str = ""
    md: str = ""
    t1: str = ""
    by: str = ""
    versions: int = 0
    fmt: Optional[str] = None
    comments: List[Comment] = field(default_factory=list)
    deleted: Optional[str] = None
    resolved: Dict[str, str] = field(default_factory=dict)  # "<key>#<thread>" -> when
    gone: Dict[int, Comment] = field(default_factory=dict)  # deleted comments, for a restore
    kind: Optional[str] = None  # "rules": the project's rules
    proposals: List[Proposal] = field(default_factory=list)

    @property
    def is_rules(self) -> bool:
        return self.kind == "rules"

    @property
    def is_page(self) -> bool:
        return self.fmt == "html"

    def comment(self, cid: int) -> Optional[Comment]:
        return next((c for c in self.comments if c.id == cid), None)

    def to_row(self) -> Row:
        out: Row = {"d": self.d, "n": self.n, "comments": [c.to_row() for c in self.comments], "t0": self.t0,
                    "versions": self.versions, "title": self.title, "md": self.md, "t1": self.t1, "by": self.by}
        if self.fmt:
            out["fmt"] = self.fmt
        if self.deleted:
            out["deleted"] = self.deleted
        if self.resolved:
            out["resolved"] = dict(self.resolved)
        if self.gone:
            out["gone"] = {str(k): c.to_row() for k, c in self.gone.items()}
        if self.kind:
            out["kind"] = self.kind
        if self.proposals:
            out["proposals"] = [p.to_row() for p in self.proposals]
        return out
