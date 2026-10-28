"""One project at run time, put together from its parts: its stored changes (`store`), its files, who waits for its
news (`news`), what agents do in it (`agents`), its voice notes being worked out (`voice`) and what the organizer is
doing (`organizing`). One lock for all of them: a change and what follows from it are seen whole.

Every change goes through `emit`: into the store, then those waiting for news hear it. Command handlers see the
project through `commands.base.Changes`, which this implements by handing each question to the part that knows.
"""

from __future__ import annotations

import os
import sys
import threading
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Callable, List, Optional, Protocol, Sequence, Tuple

from ..agent_text.render import Reading
from ..commands.run import Command, run_all
from ..domain import events as ev
from ..domain.model import FileRef, Input
from ..domain.rules import Held
from ..domain.state import ProjectState
from ..domain.vocab import Refused
from ..infra.files import FileStore
from .agents import AgentActivity
from .news import News
from .store import ProjectStore
from .voice_jobs import VoiceJobs


class Shared(Protocol):
    """What a project asks of the workspace it is in."""

    def remember_spelling(self, wrong: str, right: str) -> None: ...

    def note_voice_fix(self, wrong: str, right: str, **where: Any) -> None: ...

    def input_moving(self, slug: str, rid: str) -> bool: ...


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


@dataclass
class Organizing:
    """What the organizer is doing here: whether it runs, and the input it is working on now."""

    on: bool = False
    busy: Optional[str] = None


class Project:
    def __init__(self, folder: str, slug: str, shared: Optional[Shared] = None):
        self.folder = os.path.abspath(folder)
        self.slug = slug  # its address and folder name: never changes
        self.shared = shared
        self.lock = threading.RLock()
        self.store = ProjectStore(self.folder, self.lock, self._warn)
        self.files = FileStore(self.folder)
        self.news = News(self.lock, rev=self.store.count)
        self.gone = False  # deleted while this ran
        self.organizing = Organizing()
        self.agents = AgentActivity(self.store.db, self.state, changed=self.news.wake, gone=lambda: self.gone)
        self.voice = VoiceJobs(self)

    def _warn(self, seq: int, what: str) -> None:
        print(f"taska: {self.slug}: change {seq} {what}", file=sys.stderr)

    # -- reading -------------------------------------------------------------------

    @property
    def state(self) -> ProjectState:
        return self.store.state

    @property
    def title(self) -> str:
        """What the project is called: any name; its address was made from it once."""
        return self.state.title or self.slug

    def held(self, inp: Input) -> bool:
        return self.voice.held(inp)

    @property
    def held_fn(self) -> Held:
        return self.voice.held

    def reading(self, file_ref: Optional[Callable[[str], str]] = None) -> Reading:
        return Reading(state=self.state, held=self.voice.held, organizer_on=self.organizing.on,
                       file_ref=file_ref or self.file_path, file_path=self.file_path)

    def file_path(self, fid: str) -> str:
        return self.files.path(fid)

    # -- changing ---------------------------------------------------------------------

    def emit(self, event: ev.Event) -> None:
        """One change: into the store; whoever waits for news hears it."""
        with self.lock:
            if self.gone:
                raise Refused(f"project {self.slug} was deleted")
            event.t = now_iso()
            self.store.commit(event)
            self.news.bump()

    def run(self, commands: Sequence[Tuple[int, Command]], by: str, src: Optional[str] = None, keep: bool = False,
            session: str = "") -> Tuple[List[str], List[str]]:
        with self.lock:
            return run_all(self, commands, by, src=src, keep=keep, session=" ".join(session.split())[:60])

    # -- what command handlers ask (commands.base.Changes) ------------------------------

    def file_exists(self, fid: str) -> bool:
        return self.files.exists(fid)

    def with_words(self, text: str, files: List[FileRef]) -> Tuple[str, List[FileRef]]:
        return self.voice.with_words(text, files)

    def is_moving(self, rid: str) -> bool:
        return bool(self.shared and self.shared.input_moving(self.slug, rid))

    def mentions(self, text: str) -> Tuple[List[str], List[str]]:
        return self.agents.mentions(self.state, text)

    def remember_spelling(self, wrong: str, right: str) -> None:
        if self.shared:
            self.shared.remember_spelling(wrong, right)

    def note_voice_fix(self, wrong: str, right: str, inp: Input, by: str) -> None:
        if not self.shared:
            return
        audio = self.voice.notes_of(inp)
        said = [fid for fid in audio if self.voice.heard(fid, wrong)]
        self.shared.note_voice_fix(wrong, right, project=self.slug, item=self.state.bare_code(inp.scope), input=inp.id,
                                   who=by, via="input", file=" ".join(said or audio) or None)

    # -- the file ------------------------------------------------------------------------

    def close(self) -> None:
        self.store.close()
