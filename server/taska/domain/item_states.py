"""An item's states (B816): which changes of status are allowed, by whom, and which ones an agent must be told of.
The commands (an item's status set), the agents' /next and the tests ask here; nothing else decides it.

    stateDiagram-v2
        [*] --> proposed: an agent makes it
        [*] --> open: you or the organizer make it
        proposed --> open: you approve
        proposed --> dropped: you decline, or the agent takes it back
        open --> doing: an agent starts
        doing --> open: an agent stops, or asks you
        doing --> review: an agent hands in its result (its done)
        open --> review: an agent hands in its result
        review --> done: you accept
        review --> doing: you send it back (in words)
        doing --> dropped: you mark it won't do (the agent on it is told to stop)
        doing --> done: you close it (the agent on it is told to stop)
        done --> open: you reopen
        dropped --> open: you reopen (an agent may not, when you dropped it)

You may make any change; the organizer any but putting an item in review (it writes down your words, it finishes
no work). An agent may not approve a proposal (only take its own back), may not reopen what you dropped, and its
done is review: you accept it. An agent's done also takes back the questions it still has open on the item, so an
item never waits for your answer and your acceptance at once.

Told: an agent is told of a change of yours only when it would otherwise go on with work that is gone: you closed or
dropped an item it was doing (STOP). An approval needs no telling: the item joins the queue, and an agent waiting for
work is woken by it; one busy with another item takes it in its turn (r1397).

Pure: no I/O."""

from __future__ import annotations

from typing import Optional, Tuple

from .vocab import CLOSED, PEOPLE

PROPOSED, OPEN, DOING, REVIEW, DONE, DROPPED = "proposed", "open", "doing", "review", "done", "dropped"

YOU, ORG, AGENT = "you", "org", "agent"

# Where an agent may set an item by itself (its done is asked as done and becomes review; done itself is yours).
AGENT_TO = frozenset({OPEN, DOING, REVIEW, DROPPED})

STOP = "stop"  # the one telling: the agent on it stops


def actor(by: str) -> str:
    return by if by in PEOPLE else AGENT


def asked(frm: str, to: str, by: str) -> str:
    """The status a change asks for becomes: an agent's done is review (you accept it)."""
    return REVIEW if actor(by) == AGENT and to == DONE else to


def refusal(code: str, frm: str, to: str, by: str, closed_by: Optional[str]) -> Optional[str]:
    """Why this change of status is not allowed, or None. `to` as asked (an agent's done already made review);
    `closed_by`: who last set the status (an agent may not reopen what you dropped)."""
    who = actor(by)
    if who == YOU or frm == to:
        return None
    if who == ORG:
        if to == REVIEW:
            return f"{code}: only an agent that did the work puts it in review; to close it, set it done"
        return None
    if frm == PROPOSED and to != DROPPED:
        return (f"{code} is proposed: only the user can approve it. To move it on, answer them: `{code} say ...` "
                f"or `{code} ask ...` puts it back in front of them to approve (B299)")
    if frm == DROPPED and closed_by in PEOPLE:
        return (f"{code}: the user marked it won't do. Don't reopen or work on it; to ask, post "
                f"`{code} ask <why it is worth doing>`")
    if to not in AGENT_TO:
        return f"{code}: an agent does not set it {to}"
    return None


def told(frm: str, to: str, by: str) -> Optional[str]:
    """What the agent on the item is told of this change, or None."""
    if actor(by) != AGENT and frm == DOING and to in CLOSED:
        return STOP
    return None


def steps() -> Tuple[Tuple[str, str, str], ...]:
    """Every (from, to, who) allowed, for the tests and the diagram's check."""
    states = (PROPOSED, OPEN, DOING, REVIEW, DONE, DROPPED)
    out = []
    for f in states:
        for t in states:
            if f == t or t == PROPOSED:  # no one sets an item proposed: it is made so
                continue
            for who in (YOU, ORG, AGENT):
                if refusal("X", f, t, who, None) is None:
                    out.append((f, t, who))
    return tuple(out)
