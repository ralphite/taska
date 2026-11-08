"""The states of a voice note's one record of words (state.voices, B682) and the steps between them (T726). The
page's model of a voice message (web/src/model/voiceStates.ts) reads these as the truth once Taska has the note.

    (new) --begun--------------------> wait     a record is made waiting (VoiceHeard wait)
    wait  --its fast words-----------> wait     `early` holds them meanwhile (T687)
    wait  --its words----------------> done
    wait  --nobody heard-------------> none
    wait  --failed-------------------> failed   `err` says why
    none, failed --tried again-------> wait     the page asks again (again=1)
    done  --any later step-----------> done     words in stay: a model's later step never takes them away
    any   --you changed its words----> done     (VoiceFixed) they are yours from then on

Pure: no I/O."""

from __future__ import annotations

from typing import FrozenSet, Optional, Tuple

WAIT = "wait"
DONE = "done"
NONE = "none"
FAILED = "failed"
STATES: FrozenSet[str] = frozenset((WAIT, DONE, NONE, FAILED))

# The steps above, as (from, step, to): a step of working out its words is a VoiceHeard with that state; `from` None:
# no record yet. From done the record holds words, which stay (`after`).
STEPS: Tuple[Tuple[Optional[str], str, str], ...] = (
    (None, WAIT, WAIT),
    (WAIT, WAIT, WAIT),
    (WAIT, DONE, DONE),
    (WAIT, NONE, NONE),
    (WAIT, FAILED, FAILED),
    (NONE, WAIT, WAIT),
    (FAILED, WAIT, WAIT),
    (DONE, WAIT, DONE),
    (DONE, DONE, DONE),
    (DONE, NONE, DONE),
    (DONE, FAILED, DONE),
)


def after(state: Optional[str], step: str, has_words: bool) -> str:
    """The record's state after a step of working out its words. `has_words`: it holds words already; they stay (it
    stays as it is while a step begins again, and is done after any other step)."""
    if not has_words:
        return step
    return (state or WAIT) if step == WAIT else DONE


def answer_state(done: bool, words: str, err: str) -> str:
    """The state a page is told of a note's words: still waiting (its fast words may be there), failed, in, or nobody
    heard."""
    if not done:
        return WAIT
    return FAILED if err else DONE if words else NONE
