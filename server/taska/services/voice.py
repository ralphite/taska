"""Voice notes into words: a project's notes are heard with its own context (the item spoken to, its open items and
their words), the spellings fixed before and the user's preferences, all from the workspace."""

from __future__ import annotations

import os
from typing import Any, Callable, Dict, Optional

from ..domain.voice_words import voice_context
from ..infra.logs import log
from .project import Project
from .transcribe import Hearing, fell_back, transcribe
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

    def run(data: bytes, mime: str, scope: Optional[int], path: Optional[str], first: Callable[[str], None]) -> Dict[str, Any]:
        res = transcribe(hearing, data, mime, scope, path, first)
        # B788: what its words fell back from is logged, for the log review every few days (r1340) to find
        for why in fell_back(res.get("steps") or []):
            log.warning(f"voice fallback: {why}", extra={"f": {"source": "server", "kind": "voicefallback", "project": p.slug,
                                                                 "f": os.path.basename(path or ""), "why": why}})
        return res

    return run
