"""A voice note's words (B682): its one record, changed by each step of working them out and by a correction of
yours; once per project, the words taken out of the texts that held them."""

from __future__ import annotations

from typing import List

from .. import events as ev
from ..model import Input, InputVersion, Voice
from ..state import ProjectState
from ..voice_states import DONE, WAIT, after
from ..voices import said
from .core import reduces
from .steps import changed_words, show_edit


def record(state: ProjectState, f: str) -> Voice:
    v = state.voices.get(f)
    if v is None:
        v = state.voices[f] = Voice(f=f)
    return v


def heard(state: ProjectState, f: str, e: ev.Event, kind: str, said_: str = "", tidied: str = "", early: str = "",
          err: str = "") -> None:
    """A step of working out a note's words into its record. Words you changed stay yours: a model's later words are
    kept as what was heard (word for word, and as it tidied them) but not shown in their place."""
    v = record(state, f)
    v.t = e.t
    had_words = bool(v.tidied)
    v.state = after(v.state, kind, had_words)  # voice_states: the one rule of the record's states
    if kind == WAIT:
        v.early = early or v.early
        return
    v.early = ""
    if v.fixed and kind == DONE:
        v.said = said_ or tidied or v.said
        v.was = tidied or v.was
        return
    if had_words and kind != DONE:  # words in before stay its words
        return
    v.err = err
    if kind == DONE:
        v.tidied, v.said = tidied, said_ or tidied


def inputs_with(state: ProjectState, f: str) -> List[Input]:
    return [i for i in state.inputs.values() if not i.moved and not i.deleted and any(x.f == f for x in i.files)]


def came_late(state: ProjectState, f: str, e: ev.Event, before: List[str]) -> None:
    """An agent or the organizer had the input without these words: it comes back to them updated (its words as
    before kept in its history); the message is not marked edited, you changed nothing (B626)."""
    for inp, was in zip(inputs_with(state, f), before):
        inp.history.append(InputVersion(text=was, t=e.t, mode="append"))
        changed_words(inp, e)


@reduces(ev.VoiceHeard)
def _heard(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.VoiceHeard)
    before = [said(state, i.text, i.files) for i in inputs_with(state, e.f)] if e.late else []
    heard(state, e.f, e, e.state, e.said, e.tidied, e.early, e.err)
    if e.late:
        came_late(state, e.f, e, before)


@reduces(ev.VoiceFixed)
def _fixed(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.VoiceFixed)
    v = record(state, e.f)
    if v.was is None and v.tidied and v.tidied != e.tidied:
        v.was = v.tidied
    if not v.said:
        v.said = v.tidied or e.tidied
    v.tidied, v.fixed, v.t, v.early = e.tidied, e.t, e.t, ""
    if v.state != DONE and e.tidied:
        v.state = DONE


@reduces(ev.VoicesSplit)
def _split(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.VoicesSplit)
    for f, v in e.voices.items():
        state.voices[f] = Voice(**{**v.__dict__, "f": f})
    for rid, text in e.inputs.items():
        inp = state.inputs.get(rid)
        if inp:
            inp.text = text
            show_edit(state, inp, e, mark=False)  # its message says what was typed; the notes' words show beside it
    for dn, cs in e.comments.items():
        d = state.docs.get(int(dn))
        for c in (d.comments + list(d.gone.values())) if d else []:
            if str(c.id) in cs:
                c.text = cs[str(c.id)]
    state.voices_split = True
