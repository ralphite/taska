"""A task's states (T816): which changes of status are allowed, by whom, and which ones an agent must be told of.
The commands (a task's status set), the agents' /next and the tests ask here; nothing else decides it.

STEPS is the diagram in docs/task-states.md: `mermaid()` draws it, and a test keeps the document the same as this
table and every step in it allowed by `refusal` (r1398: the state machine is part of the documents, kept by the
code). `told` says when an agent is told of a change of yours (only STOP: you closed what it was doing).

You may make any change; the organizer any but putting a task in review (it writes down your words, it finishes
no work). An agent may not approve a proposal (only take its own back), may not reopen what you dropped, and its
done is review: you accept it. An agent's done also takes back the questions it still has open on the task, so an
task never waits for your answer and your acceptance at once (T779).

Your words on a task are your turn given to the agent: on a proposal they approve it (T818 r1401: you would
press won't do if you did not want it; a question in them the agent answers before it starts), on a task in review
or done they say it is not done yet (r961, r1082). An agent's words change no status: it never approves itself.

A subtask the user asked for starts open (T818 r1404): an agent that splits a task into the parts the user asked
for names the user's words it came from (`src=r12`, an input of theirs), and they show on it.

An approval needs no telling: the task joins the queue, and an agent waiting for work is woken by it; one busy with
another task takes it in its turn (r1397).

Pure: no I/O."""

from __future__ import annotations

from typing import Optional, Tuple

from .vocab import CLOSED, PEOPLE

PROPOSED, OPEN, DOING, REVIEW, DONE, DROPPED = "proposed", "open", "doing", "review", "done", "dropped"

YOU, ORG, AGENT = "you", "org", "agent"

STOP = "stop"  # the one telling: the agent on it stops

# The diagram: (from, to, who, what it is); from None: where a task starts. "told to stop" marks a STOP.
STEPS: Tuple[Tuple[Optional[str], str, str, str], ...] = (
    (None, PROPOSED, AGENT, "an agent proposes it"),
    (None, OPEN, YOU, "the user or the organizer makes it"),
    (None, OPEN, AGENT, "an agent makes a subtask the user asked for (their words on it)"),
    (PROPOSED, OPEN, YOU, "the user approves, or writes on it"),
    (PROPOSED, DROPPED, YOU, "the user declines (won't do)"),
    (PROPOSED, DROPPED, AGENT, "the agent takes it back"),
    (OPEN, DOING, AGENT, "an agent starts working on it"),
    (DOING, OPEN, AGENT, "the agent stops"),
    (DOING, REVIEW, AGENT, "the agent is done (its done is review)"),
    (OPEN, REVIEW, AGENT, "the agent is done"),
    (REVIEW, DONE, YOU, "the user accepts"),
    (REVIEW, OPEN, YOU, "the user says not yet, or writes on it"),
    (OPEN, DROPPED, YOU, "won't do"),
    (DOING, DROPPED, YOU, "won't do (the agent on it is told to stop)"),
    (DOING, DONE, YOU, "closed (the agent on it is told to stop)"),
    (DONE, OPEN, YOU, "reopened, or the user writes on it"),
    (DROPPED, OPEN, YOU, "reopened (an agent may not, when the user dropped it)"),
)

# Where an agent may set a task by itself (its done is asked as done and becomes review; done itself is yours).
AGENT_TO = frozenset({OPEN, DOING, REVIEW, DROPPED})


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
                f"or `{code} ask ...` puts it back in front of them to approve (T299)")
    if frm == DROPPED and closed_by in PEOPLE:
        return (f"{code}: the user marked it won't do. Don't reopen or work on it; to ask, post "
                f"`{code} ask <why it is worth doing>`")
    if to not in AGENT_TO:
        return f"{code}: an agent does not set it {to}"
    return None


def starts(by: str, asked_for: bool) -> str:
    """The status a new task starts with: an agent's is a proposal, unless it is a subtask the user asked for."""
    return PROPOSED if actor(by) == AGENT and not asked_for else OPEN


def on_your_words(status: str) -> Optional[str]:
    """The status a task takes when you write on it, or None (it stays)."""
    return OPEN if status in (PROPOSED, REVIEW, DONE) else None


def told(frm: str, to: str, by: str) -> Optional[str]:
    """What the agent on the task is told of this change, or None."""
    if actor(by) != AGENT and frm == DOING and to in CLOSED:
        return STOP
    return None


def mermaid() -> str:
    """STEPS as the diagram in docs/task-states.md."""
    name = {None: "[*]", PROPOSED: "Proposed", OPEN: "Open", DOING: "Doing", REVIEW: "Review", DONE: "Done",
            DROPPED: "Dropped"}
    return "stateDiagram-v2\n" + "\n".join(f"  {name[f]} --> {name[t]}: {what}" for f, t, _, what in STEPS)
