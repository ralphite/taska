"""A voice note's words (B682): each step of working them out, a correction of yours, and taking them out of the
texts once. Typed events and how their stored rows read."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, ClassVar, Dict

from ..model import Row, Voice
from .base import Event, Reader, common, need, opt


@dataclass
class VoiceHeard(Event):
    """A step of working out a voice note's words: begun (wait), its first words meanwhile (wait with `early`), its
    words (done), nobody heard (none), or failed. `late`: an agent or the organizer had the input it came with before
    these words: they get it again. `src`: that input, when there is one."""

    KIND: ClassVar[str] = "voice"
    f: str = ""
    state: str = "done"
    said: str = ""
    tidied: str = ""
    early: str = ""
    err: str = ""
    late: bool = False

    def body(self) -> Row:
        row: Row = {"f": self.f, "state": self.state}
        opt(row, "src", self.src, bool(self.src))
        opt(row, "said", self.said, bool(self.said))
        opt(row, "tidied", self.tidied, bool(self.tidied))
        opt(row, "early", self.early, bool(self.early))
        opt(row, "err", self.err, bool(self.err))
        opt(row, "late", True, self.late)
        row["by"] = self.by
        return row


@dataclass
class VoiceFixed(Event):
    """You changed a voice note's words (in the box before sending, editing what you said, a misheard word put right):
    its tidied words are yours from now on, wherever it shows."""

    KIND: ClassVar[str] = "voicefix"
    f: str = ""
    tidied: str = ""

    def body(self) -> Row:
        row: Row = {"f": self.f, "tidied": self.tidied}
        opt(row, "src", self.src, bool(self.src))
        row["by"] = self.by
        return row


@dataclass
class VoicesSplit(Event):
    """Voice notes' records set as they are, and texts that held voice words set to only what was typed: {input id:
    text}, {"<d>": {"<comment id>": text}}. Written once per project by B682 (and, in format 2, for the words as said
    that F568 kept once)."""

    KIND: ClassVar[str] = "voices"
    voices: Dict[str, Voice] = field(default_factory=dict)
    inputs: Dict[str, str] = field(default_factory=dict)
    comments: Dict[str, Dict[str, str]] = field(default_factory=dict)

    def body(self) -> Row:
        return {"voices": {f: v.to_row() for f, v in self.voices.items()}, "inputs": dict(self.inputs),
                "comments": {d: dict(cs) for d, cs in self.comments.items()}, "by": self.by}


def _voices(r: Row) -> Dict[str, Voice]:
    got: Any = need(r, "voices")
    return {str(f): Voice.from_row(dict(v, f=f)) for f, v in dict(got).items()}


READERS: Dict[str, Reader] = {
    "voice": lambda r: VoiceHeard(f=need(r, "f"), state=need(r, "state"), said=r.get("said") or "",
                                  tidied=r.get("tidied") or "", early=r.get("early") or "", err=r.get("err") or "",
                                  late=bool(r.get("late")), src=r.get("src"), **common(r)),
    "voicefix": lambda r: VoiceFixed(f=need(r, "f"), tidied=need(r, "tidied"), src=r.get("src"), **common(r)),
    "voices": lambda r: VoicesSplit(voices=_voices(r), inputs=dict(r.get("inputs") or {}),
                                    comments={str(d): dict(cs) for d, cs in (r.get("comments") or {}).items()},
                                    **common(r)),
}
