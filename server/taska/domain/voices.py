"""A voice note's words as everyone reads them (B682): one record per voice note (state.voices), named by its file
wherever the note is (an input, a message, a comment). What was typed and each voice note's words together are
what was said; agents read each note as "voice 0:21: <its words>". Pure: no I/O."""

from __future__ import annotations

import re
from typing import Iterable, List, Optional

from .model import FileRef, Voice
from .state import ProjectState
from .voice_states import FAILED, WAIT

AUDIO = re.compile(r"\.(webm|ogg|m4a|mp4|mp3|wav|aac|flac)$", re.I)
LENGTH = re.compile(r"(\d+)-(\d+)\.\w+$")


def is_voice(f: FileRef) -> bool:
    return (f.mime or "").startswith("audio/") or (not f.mime and bool(AUDIO.search(f.f)))


def voices_of(files: Iterable[FileRef]) -> List[FileRef]:
    return [f for f in files if is_voice(f)]


def voice(st: ProjectState, f: str) -> Optional[Voice]:
    return st.voices.get(f)


def words_of(st: ProjectState, f: str) -> str:
    """A voice note's words now: tidied (yours, when you changed them), its first words while being worked out."""
    v = st.voices.get(f)
    return v.words if v else ""


def length(f: FileRef) -> str:
    """Its length as its name says it (voice_0-21.webm: 0:21), or ''."""
    m = LENGTH.search(f.name or f.f)
    return f"{int(m.group(1))}:{m.group(2)}" if m else ""


def said(st: ProjectState, text: str, files: Iterable[FileRef]) -> str:
    """What was said: the words typed, then each voice note's words (as the page shows it, and as it is searched)."""
    parts = [text.strip()] + [words_of(st, f.f) for f in voices_of(files)]
    return "\n".join(p for p in parts if p)


def lacking(v: Optional[Voice]) -> str:
    """Why a voice note has no words to read: being worked out, nobody heard, failed."""
    if v is None or v.state == WAIT:
        return "(transcribing…)"
    return "(transcription failed)" if v.state == FAILED else "(no words heard)"


AS_SAID = "word for word"


def voice_line(st: ProjectState, f: FileRef, as_said: bool = False, said_as: str = AS_SAID) -> str:
    """One voice note as agents read it: "voice 0:21: <its words>"; with `as_said`, its words word for word too when
    they differ, on a line headed `said_as` (the tidied words are what count)."""
    v = st.voices.get(f.f)
    n = length(f)
    head = f"voice {n}:" if n else "voice:"
    words = v.words if v else ""
    out = f"{head} {' '.join(words.split()) if words else lacking(v)}"
    if v and v.state == WAIT and words:
        out += " (first words; more coming)"
    if v and v.fixed:
        out += " (corrected by the user)"
    if as_said and v and v.said and " ".join(v.said.split()) != " ".join(words.split()):
        out += f"\n  {said_as}: {' '.join(v.said.split())}"
    return out


def for_agents(st: ProjectState, text: str, files: Iterable[FileRef], as_said: bool = False, said_as: str = AS_SAID) -> str:
    """What was said as agents read it: the words typed, then one line per voice note with its words."""
    lines = [text.rstrip()] if text.strip() else []
    lines += [voice_line(st, f, as_said, said_as) for f in voices_of(files)]
    return "\n".join(lines)


def one_line(st: ProjectState, text: str, files: Iterable[FileRef]) -> str:
    """The first line of what was said, for a log line: the typed words, else the first voice note's words."""
    first = text.strip().split("\n")[0].strip() if text.strip() else ""
    if first:
        return first
    for f in voices_of(files):
        v = st.voices.get(f.f)
        return (v.words.strip().split("\n")[0] if v and v.words.strip() else "voice " + lacking(v))
    return ""
