"""What every command handler gets: the command's arguments as sent, and the project it changes.

A command comes as a mapping from the page (JSON) or from an agent's line (the command language); `Args` reads it
the way Taska always has (lenient about types, strict about meaning). `Changes` is the project as a command sees it:
its state to read, `emit` to make a change, and the few services a change needs (files, voice words, spellings).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Mapping, NamedTuple, Optional, Protocol, Tuple

from ..domain.events import Event
from ..domain.model import FileRef, Input, Item
from ..domain.rules import RefContext
from ..domain.state import ProjectState
from ..domain.vocab import PEOPLE

OFF = (False, "0", "false", 0)


class Args:
    """A command's arguments, as sent."""

    def __init__(self, raw: Mapping[str, Any]):
        self.raw = raw

    @property
    def name(self) -> Any:
        return self.raw.get("op")

    def get(self, key: str, default: Any = None) -> Any:
        return self.raw.get(key, default)

    def has(self, key: str) -> bool:
        return key in self.raw

    def text(self, key: str) -> str:
        """The value as text, "" when absent or empty."""
        return str(self.raw.get(key) or "")

    def on(self, key: str = "on") -> bool:
        """A switch that is on unless sent as off."""
        return self.raw.get(key, True) not in OFF

    def number(self, key: str) -> int:
        return int(self.raw.get(key) or 0)

    def thread(self) -> Optional[int]:
        th = str(self.raw.get("th") or "")
        return int(th) if th.isdigit() else None

    def with_(self, **changes: Any) -> Args:
        return Args(dict(self.raw, **changes))


class Outcome(NamedTuple):
    line: str  # the answer an agent reads ("ok F12 status=review")
    label: str  # how the organizer's summary says it ("Updated F12"); "" for none


class Changes(Protocol):
    """The project as command handlers see it."""

    @property
    def state(self) -> ProjectState: ...

    def emit(self, event: Event) -> None:
        """Write a change to the log and apply it."""
        ...

    def file_exists(self, fid: str) -> bool: ...

    def with_words(self, text: str, files: List[FileRef]) -> Tuple[str, List[FileRef]]:
        """Words of voice notes that came in after the page let go of them: the text and the files get them."""
        ...

    def is_moving(self, rid: str) -> bool:
        """An input being moved to another project right now."""
        ...

    def mentions(self, text: str) -> Tuple[List[str], List[str]]: ...

    def remember_spelling(self, wrong: str, right: str) -> None: ...

    def note_voice_fix(self, wrong: str, right: str, inp: Input, by: str) -> None: ...


@dataclass
class Run:
    """One run of commands: who sends them, the input they come from, the agent session."""

    project: Changes
    by: str
    ctx: RefContext = field(default_factory=RefContext)
    session: str = ""

    @property
    def state(self) -> ProjectState:
        return self.project.state

    @property
    def person(self) -> bool:
        return self.by in PEOPLE

    def keep(self) -> bool:
        return self.ctx.keep

    def emit(self, event: Event) -> None:
        """A change made by this run: it carries the agent's session."""
        if self.session and not event.ses:
            event.ses = self.session
        self.project.emit(event)

    def gone_note(self, it: Optional[Item]) -> str:
        """What an agent hears when it writes to an item the user deleted."""
        if not it or not it.deleted or self.person:
            return ""
        return f" (note: the user deleted {self.state.code(it.n)} together with input {it.deleted}: stop working on it)"


Handler = Callable[[Run, Args], Outcome]
HANDLERS: Dict[str, Handler] = {}


def handles(*names: str) -> Callable[[Handler], Handler]:
    def register(fn: Handler) -> Handler:
        for n in names:
            HANDLERS[n] = fn
        return fn
    return register
