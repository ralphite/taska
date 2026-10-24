"""One project at run time: its state (replayed from its log), its file, its lock, and who waits for its news.

Every change goes through `emit` under the lock: the log first (a change in the log is never lost), then the state,
then those waiting for news are woken. The state rows in the file follow within a second.
"""

from __future__ import annotations

import os
import sys
import threading
import time
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Protocol, Sequence, Set, Tuple

from ..agent_api.render import Reading
from ..commands.run import Command, run_all
from ..domain import events as ev
from ..domain.model import FileRef, Input
from ..domain.projector import apply, replay
from ..domain.rules import Held
from ..domain.state import ProjectState
from ..domain.vocab import Refused
from ..infra.files import FileStore
from ..infra.project_db import ProjectDb, StateRows, dumps
from .agents import AgentActivity
from .voice_jobs import VoiceJobs


class Shared(Protocol):
    """What a project asks of the workspace it is in."""

    def remember_spelling(self, wrong: str, right: str) -> None: ...

    def note_voice_fix(self, wrong: str, right: str, **where: Any) -> None: ...


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


class Project:
    def __init__(self, folder: str, slug: str, shared: Optional[Shared] = None):
        self.folder = os.path.abspath(folder)
        self.slug = slug  # its address and folder name: never changes
        self.shared = shared
        self.lock = threading.RLock()
        self.changed = threading.Condition(self.lock)
        self.db = ProjectDb(self.folder)
        self.files = FileStore(self.folder)
        rows = []
        for seq, row, _ in self.db.rows():
            if row is None:
                self._warn(seq, "skipped: it is not a change")
            else:
                rows.append(row)
        self._state = replay(rows, self._warn)
        self.rev = len(self._state.events)  # bumps on every change, and on news that is not a change (the organizer)
        self.boot = format(int(time.time() * 1000), "x")  # rev starts again with the process; boot tells pages apart
        self.gone = False  # deleted while this ran
        self.organizer_on = False
        self.organizer_busy: Optional[str] = None
        self.agents = AgentActivity(self.db, self._state, changed=self._wake, gone=lambda: self.gone)
        self.voice = VoiceJobs(self)
        self.page_answers: Dict[str, Tuple[Dict[str, Any], int]] = {}  # the page's save id -> its answer
        self.move_lock = threading.Lock()  # one move of an item to another project at a time
        self.moving: Set[str] = set()  # inputs being moved to another project right now
        self._written: Dict[str, Dict[Any, str]] = {"items": {}, "inputs": {}, "docs": {}}
        self._flusher: Optional[threading.Timer] = None
        self.write_state(full=True)

    def _warn(self, seq: int, what: str) -> None:
        print(f"taska: {self.slug}: change {seq} {what}", file=sys.stderr)

    # -- reading -------------------------------------------------------------------

    @property
    def state(self) -> ProjectState:
        return self._state

    @property
    def title(self) -> str:
        """What the project is called: any name; its address was made from it once."""
        return self._state.title or self.slug

    def held(self, inp: Input) -> bool:
        return self.voice.held(inp)

    @property
    def held_fn(self) -> Held:
        return self.voice.held

    def reading(self, file_ref: Optional[Callable[[str], str]] = None) -> Reading:
        return Reading(state=self._state, held=self.voice.held, organizer_on=self.organizer_on,
                       file_ref=file_ref or self.file_path, file_path=self.file_path)

    def file_path(self, fid: str) -> str:
        return self.files.path(fid)

    # -- changing ---------------------------------------------------------------------

    def emit(self, event: ev.Event) -> None:
        """One change: into the log, then the state; whoever waits for news hears it. Under the lock."""
        with self.changed:
            if self.gone:
                raise Refused(f"project {self.slug} was deleted")
            event.t = now_iso()
            self.db.append(len(self._state.events) + 1, event.to_row())
            apply(self._state, event)
            self.rev += 1
            self.changed.notify_all()
            self._soon_write()

    def bump(self) -> None:
        """News that is not a change (the organizer starts, words came in): pages and waiting agents hear it."""
        with self.changed:
            self.rev += 1
            self.changed.notify_all()

    def _wake(self) -> None:
        with self.changed:
            self.changed.notify_all()

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
        return rid in self.moving

    def mentions(self, text: str) -> Tuple[List[str], List[str]]:
        return self.agents.mentions(self._state, text)

    def remember_spelling(self, wrong: str, right: str) -> None:
        if self.shared:
            self.shared.remember_spelling(wrong, right)

    def note_voice_fix(self, wrong: str, right: str, inp: Input, by: str) -> None:
        if not self.shared:
            return
        audio = [f.f for f in inp.files if os.path.splitext(f.f)[1].lower() in AUDIO_EXTS]
        said = [fid for fid in audio if wrong in " ".join(str(v) for k, v in (self.voice.kept(fid) or {}).items()
                                                          if k in ("tr", "heard"))]
        self.shared.note_voice_fix(wrong, right, project=self.slug, item=self._state.bare_code(inp.scope), input=inp.id,
                                   who=by, via="input", file=" ".join(said or audio) or None)

    # -- the state rows in the file ---------------------------------------------------------

    def write_state(self, full: bool = False) -> None:
        """Write the rows of the current state that changed since the last write (all of them with full)."""
        with self.lock:
            if self.db.closed:
                return
            rows = StateRows()
            tables = (("items", self._state.items, rows.items, rows.items_gone),
                      ("inputs", self._state.inputs, rows.inputs, rows.inputs_gone),
                      ("docs", self._state.docs, rows.docs, rows.docs_gone))
            for table, records, fresh_rows, gone in tables:
                was = self._written[table]
                fresh: Dict[Any, str] = {}
                for k, v in records.items():
                    text = dumps(v.to_row())
                    fresh[k] = text
                    if full or was.get(k) != text:
                        fresh_rows[k] = text
                gone.update(k for k in was if k not in fresh)
                self._written[table] = fresh
            if rows or full:
                self.db.write_state(rows, len(self._state.events), full=full)

    def _soon_write(self) -> None:
        if self._flusher and self._flusher.is_alive():
            return
        self._flusher = threading.Timer(1.0, self.write_state)
        self._flusher.daemon = True
        self._flusher.start()

    def changed_at(self) -> float:
        return self.db.changed_at()

    def close(self) -> None:
        with self.lock:
            if self._flusher:
                self._flusher.cancel()
            self.write_state()
            self.db.close()


AUDIO_EXTS = (".webm", ".ogg", ".m4a", ".mp4", ".mp3", ".wav", ".aac", ".flac")
