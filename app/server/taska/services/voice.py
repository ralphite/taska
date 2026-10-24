"""Voice notes into words: which transcription a project's notes get."""

from __future__ import annotations

from typing import Any, Callable, Dict, Optional

from .project import Project
from .voice_jobs import Transcriber


def transcriber_for(p: Project, workspace: Callable[[], Any]) -> Transcriber:
    def transcribe(data: bytes, mime: str, scope: Optional[int], path: Optional[str],
                   later: Callable[[Optional[str]], None]) -> Dict[str, Any]:
        raise RuntimeError("voice transcription is not in this build yet")
    return transcribe
