"""Running commands: each one checked by its handler, which emits the changes; a run answers one line per command.

The page sends commands as JSON; agents write lines that agent_api.language turns into the same commands.
"""

from __future__ import annotations

from typing import Any, List, Mapping, Optional, Sequence, Tuple, Union

from ..domain.rules import RefContext, item_at
from ..domain.vocab import MAX_OPS, Refused
from . import docs, filings, inputs, items, project  # noqa: F401  (they register their handlers)
from .base import HANDLERS, Args, Changes, Outcome, Run

Command = Union[Mapping[str, Any], Refused]  # a command, or why its line could not be read


def run_one(r: Run, raw: Mapping[str, Any]) -> Outcome:
    a = Args(raw)
    src = a.get("src") or r.ctx.src
    if src and src not in r.state.inputs:
        raise Refused(f"unknown input {src}")
    handler = HANDLERS.get(str(a.name))
    if handler is None:
        item_at(r.state, a.get("ref", ""), r.ctx)  # a bad reference is what is told first
        raise Refused(f"unknown op '{a.name}'")
    return handler(r, a)


def run_all(project_: Changes, commands: Sequence[Tuple[int, Command]], by: str, src: Optional[str] = None,
            keep: bool = False, session: str = "") -> Tuple[List[str], List[str]]:
    """Run commands in order -> (one answer line each, the organizer's labels). `keep`: link the changes to `src`
    without marking it handled. The caller holds the project lock."""
    r = Run(project=project_, by=by, ctx=RefContext(src=src, keep=keep), session=session)
    lines: List[str] = []
    labels: List[str] = []
    for no, command in commands[:MAX_OPS]:
        try:
            if isinstance(command, Refused):
                raise command
            out = run_one(r, command)
            lines.append(out.line)
            if out.label:
                labels.append(out.label)
        except Refused as ex:
            lines.append(f"err{f' L{no}' if no else ''}: {ex}")
    if len(commands) > MAX_OPS:
        lines.append(f"err: only the first {MAX_OPS} commands were run")
    return lines, labels
