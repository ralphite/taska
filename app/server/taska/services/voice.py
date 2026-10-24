"""Voice notes into words: a project's notes are heard with its own context (the item spoken to, its open items and
their words), the spellings fixed before and the user's preferences, all from the workspace."""

from __future__ import annotations

from typing import Any, Callable, Dict, Optional

from ..domain.voice_words import voice_context
from .project import Project
from .transcribe import Hearing, transcribe
from .voice_jobs import Transcriber


def transcriber_for(p: Project, workspace: Callable[[], Any]) -> Transcriber:
    def context(scope: Optional[int]):
        with p.lock:
            return voice_context(p.state, scope)

    hearing = Hearing(
        context=context,
        fixes=lambda: workspace().spellings.all(),
        prefs=lambda: workspace().voice_prefs.get()["text"],
        tidy=lambda: workspace().voice_prefs.tidy(),
    )

    def run(data: bytes, mime: str, scope: Optional[int], path: Optional[str], later: Callable[[Optional[str]], None]) -> Dict[str, Any]:
        return transcribe(hearing, data, mime, scope, path, later)

    return run
