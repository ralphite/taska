"""Once per project (B682): a record for every voice note, made from what was kept of its words before (the changes
that brought them, the file kept next to its audio, the copies on the inputs and comments), and the texts that held
a note's words as only what was typed. Pure: what was kept is given."""

from __future__ import annotations

import difflib
import re
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Tuple

from . import events as ev
from .model import Comment, FileRef, Input, Voice
from .state import ProjectState
from .voices import voices_of

Kept = Dict[str, Dict[str, Any]]  # a note's file -> what was kept of its words ({"tr", "heard", "alt", "wait"})
FULLER = "Fuller words of the voice note:"


@dataclass
class SplitReport:
    voices: int = 0
    from_log: int = 0
    from_side: int = 0
    from_copy: int = 0
    no_words: int = 0
    waiting: int = 0
    texts_exact: int = 0  # texts whose voice words were found as they are and taken out
    texts_fuzzy: int = 0  # found changed (you edited them): taken out, and the note's words are yours
    texts_clean: int = 0  # texts that held none of their notes' words
    not_found: List[str] = field(default_factory=list)  # notes with words none of which are in their text

    def line(self) -> str:
        return (f"{self.voices} voices ({self.from_log} from the log, {self.from_side} from kept files, "
                f"{self.from_copy} from copies, {self.no_words} without words, {self.waiting} still to transcribe); "
                f"texts: {self.texts_exact} split exactly, {self.texts_fuzzy} split with your changes, "
                f"{self.texts_clean} had no voice words; {len(self.not_found)} notes' words not in their text")


def _clean(text: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", re.sub(r"[ \t]+\n", "\n", text)).strip()


def _cut(text: str, start: int, end: int) -> str:
    before, after = text[:start], text[end:]
    if before.rstrip().endswith(FULLER):
        before = before.rstrip()[: -len(FULLER)]
    return _clean(before.rstrip(" \t") + ("\n" if before.strip() and after.strip() else "") + after.lstrip(" \t"))


def _fuzzy(text: str, words: str) -> Optional[Tuple[int, int]]:
    """Where in the text the note's words are, changed by you: most of them there, in order, close together."""
    if len(words) < 6 or not text:
        return None
    sm = difflib.SequenceMatcher(None, text, words, autojunk=False)
    blocks = [b for b in sm.get_matching_blocks() if b.size >= 2]
    if not blocks:
        return None
    matched = sum(b.size for b in blocks)
    start, end = blocks[0].a, blocks[-1].a + blocks[-1].size
    if matched < 0.6 * len(words) or end - start > 1.6 * len(words) + 20:
        return None
    # the span reaches the ends of its lines where only a few characters are left there (words you added)
    ls = text.rfind("\n", 0, start) + 1
    le = text.find("\n", end)
    le = len(text) if le < 0 else le
    if start - ls <= 3:
        start = ls
    if le - end <= 3:
        end = le
    return start, end


def take_out(text: str, candidates: List[str], words: str) -> Tuple[str, Optional[str], str]:
    """The text without a note's words -> (the rest, the words as they were in it, how: exact, fuzzy or none).
    `candidates`: every version of its words that may be in the text (as heard, tidied, first words, fuller ones)."""
    for c in sorted({c.strip() for c in candidates if c and c.strip()}, key=len, reverse=True):
        at = text.find(c)
        if at >= 0:
            return _cut(text, at, at + len(c)), c, "exact"
    span = _fuzzy(text, words.strip())
    if span:
        return _cut(text, *span), text[span[0]:span[1]].strip(), "fuzzy"
    return text, None, "none"


def _candidates(st: ProjectState, f: str, v: Voice, kept: Kept, copies: Kept) -> List[str]:
    out = [v.tidied, v.said, v.early, v.was or ""]
    for src in (kept.get(f) or {}, copies.get(f) or {}):
        out += [str(src.get(k) or "") for k in ("tr", "heard", "alt")]
    for e in st.events:
        if isinstance(e, ev.WordsIn) and e.f == f:
            out += [e.tr, e.was or "", e.heard or ""]
    return out


def _owners(st: ProjectState) -> Iterable[Tuple[str, Any, List[FileRef]]]:
    for inp in st.inputs.values():
        yield "input", inp, inp.files
    for d in st.docs.values():
        for c in d.comments + list(d.gone.values()):
            yield "comment", (d.d, c), c.files
    for it in st.items.values():
        for m in it.thread:
            yield "message", m, m.files


def plan(st: ProjectState, kept: Kept, copies: Kept, t: str) -> Tuple[ev.VoicesSplit, SplitReport]:
    """The one change that does it, and what it did. `kept`: what was kept next to each note's audio; `copies`: the
    words the inputs and comments carried with their files."""
    rep = SplitReport()
    voices: Dict[str, Voice] = {}
    owners = list(_owners(st))
    for _, _, files in owners:
        for f in voices_of(files):
            if f.f in voices:
                continue
            had = st.voices.get(f.f)
            side, copy = kept.get(f.f) or {}, copies.get(f.f) or {}
            v = Voice(**had.__dict__) if had else Voice(f=f.f, t=t)
            if had and had.tidied:
                rep.from_log += 1
                if had.said == had.tidied:
                    v.said = str(side.get("heard") or copy.get("heard") or had.said)
            elif side.get("tr") or copy.get("tr"):
                if side.get("tr"):
                    rep.from_side += 1
                else:
                    rep.from_copy += 1
                v.tidied = str(side.get("tr") or copy.get("tr"))
                v.said = str(side.get("heard") or copy.get("heard") or v.tidied)
                v.state = "done"
            elif copy.get("wait") and not side:
                v.state, rep.waiting = "wait", rep.waiting + 1
            else:
                v.state = "none" if side else "failed"
                v.err = "" if side else "no words were kept"
                rep.no_words += 1
            v.early = ""
            voices[f.f] = v
    rep.voices = len(voices)
    inputs: Dict[str, str] = {}
    comments: Dict[str, Dict[str, str]] = {}
    written: Dict[str, int] = {}  # each input's last change of its words
    came: Dict[str, int] = {}  # when each note's words first came
    for e in st.events:
        if isinstance(e, ev.InputAdded):
            written[e.id] = e.seq
        elif isinstance(e, ev.InputAmended) and e.src:
            written[e.src] = e.seq
        elif isinstance(e, (ev.WordsIn, ev.VoiceHeard)) and e.f not in came:
            came[e.f] = e.seq

    def after_text(f: str, inp: Input) -> bool:
        """Its words came after its input's words were last written: they were never in that text."""
        return came.get(f, 0) > written.get(inp.id, 0)

    for kind, owner, files in owners:
        notes = [f for f in voices_of(files) if voices[f.f].tidied]
        if kind == "message" or not notes:
            continue
        text = owner.text if isinstance(owner, Input) else owner[1].text
        rest, how = text, "clean"
        for f in notes:
            v = voices[f.f]
            rest, found, got = take_out(rest, _candidates(st, f.f, v, kept, copies), v.tidied)
            if got == "fuzzy" and found:
                if v.was is None:
                    v.was = v.tidied
                v.tidied, v.fixed = found, (owner.updated if isinstance(owner, Input) else None) or t
            if got == "none" and text.strip() and not (isinstance(owner, Input) and after_text(f.f, owner)):
                rep.not_found.append(f.f)  # its words came before its text was last written, yet are not in it
            how = "fuzzy" if got == "fuzzy" or how == "fuzzy" else ("exact" if got == "exact" else how)
        setattr(rep, f"texts_{how}", getattr(rep, f"texts_{how}") + 1)
        if rest != text:
            if isinstance(owner, Input):
                inputs[owner.id] = rest
            else:
                dn, c = owner
                assert isinstance(c, Comment)
                comments.setdefault(str(dn), {})[str(c.id)] = rest
    return ev.VoicesSplit(voices=voices, inputs=inputs, comments=comments, by="taska"), rep


def copies_in(rows: Iterable[Dict[str, Any]]) -> Kept:
    """The words stored rows carried with their files (each later copy over an earlier one)."""
    out: Kept = {}
    for row in rows:
        for f in row.get("files") or []:
            if isinstance(f, dict) and any(k in f for k in ("tr", "heard", "wait")):
                got = out.setdefault(str(f.get("f", "")), {})
                for k in ("tr", "heard", "wait"):
                    if f.get(k) is not None:
                        got[k] = f[k]
    return out
