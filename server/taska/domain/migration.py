"""The log's format 2 (Refactor 8): every stored change in today's kinds, once, so nothing reads an earlier format.

What it rewrites, each change in its place (a change's number is its place in the log: nothing is taken out):

- `tr`, a voice note's words as they came in before B682 -> `voice` (VoiceHeard, done: the same step of its record);
- `heard`, notes' words as said kept once (F568) -> `voices`: those notes' records as they then were, with those words;
- an agent's `block` (before T646) -> the `ask` it became; the change that made it one (`asked`) -> `folded`;
- the organizer's failure that the service was only busy for (written before T424) -> `retry`, asked again, as Taska
  does now without writing anything (its note on the input goes);
- a change of a kind nothing reads any more (`plain`, a feature since gone), which changes nothing -> `folded`;
- a file a change carries keeps only what a file is (`f`, `name`, `mime`, `size`): the words of its note that files
  carried before B682 are in the note's record.

Only a project whose one-time changes of the earlier formats were all made (B682, T646, I693) is rewritten. Pure: the
rows are given and the new rows returned; `same` says whether two logs leave the same state.
"""

from __future__ import annotations

import dataclasses
import json
from collections import Counter
from typing import Any, Collection, Dict, List, Set, Tuple

from . import events as ev
from .input_states import transient
from .model import Row, Voice
from .projection import apply
from .state import ProjectState

FORMAT = "2"
FILE_KEYS = ("f", "name", "mime", "size")


def unready(rows: List[Row]) -> str:
    """Why this log cannot be rewritten yet ("": it can): a one-time change of an earlier format still to be made."""
    def last(*kinds: str, **match: Any) -> int:
        return max((i for i, r in enumerate(rows) if r.get("k") in kinds and all(r.get(a) == b for a, b in match.items())),
                   default=-1)

    if last("tr", "heard") > last("voices"):
        return "its voice notes' words are still to be put in their records (B682)"
    if last("say", kind="block") > last("asked"):
        return "earlier blocks are still to become asks (T646)"
    if last("add", type="rule") > last("rulesmoved"):
        return "rule items are still to move into the rules document (I693)"
    return ""


def _files(row: Row, counts: Counter) -> Row:
    files = row.get("files")
    if not isinstance(files, list):
        return row
    kept = [{k: f[k] for k in FILE_KEYS if k in f} if isinstance(f, dict) else f for f in files]
    if kept != files:
        counts["file words dropped"] += sum(1 for a, b in zip(files, kept) if a != b)
        return {**row, "files": kept}
    return row


def _common(row: Row) -> Dict[str, Any]:
    return {"by": row.get("by") or "", "t": row.get("t") or "", "ses": row.get("ses") or None}


def _one(row: Row, state: ProjectState, counts: Counter, retried: Set[str]) -> Row:
    k = row.get("k")
    if k == "tr":
        counts["tr -> voice"] += 1
        return ev.VoiceHeard(f=str(row["f"]), state="done", said=str(row.get("heard") or ""), tidied=str(row["tr"]),
                             late=bool(row.get("late")), src=row.get("src"), **_common(row)).to_row()
    if k == "heard":
        counts["heard -> voices"] += 1
        records: Dict[str, Voice] = {}
        for notes in dict(row.get("notes") or {}).values():
            for f, words in dict(notes).items():
                had = records.get(f) or state.voices.get(f)
                if had is not None:
                    records[f] = dataclasses.replace(had, said=words)
        return ev.VoicesSplit(voices=records, **_common(row)).to_row()
    if k == "say" and row.get("kind") == "block":
        counts["block -> ask"] += 1
        return {**row, "kind": "ask"}
    if k == "asked":
        counts["asked -> folded"] += 1
        return ev.Folded(was="asked", **_common(row)).to_row()
    if k == "org" and not row.get("retry") and not row.get("ok") and transient(str(row.get("msg") or "")):
        counts["busy failure -> retry"] += 1
        retried.add(str(row.get("src")))
        return ev.Organized(src=row.get("src"), retry=True, **_common(row)).to_row()
    if str(k) not in ev.READERS:
        counts[f"{k} -> folded"] += 1
        return ev.Folded(was=str(k), **_common(row)).to_row()
    return row


def rewrite(rows: List[Row]) -> Tuple[List[Row], Counter, Set[str]]:
    """The log in format 2, how many changes of each kind were rewritten (empty: none needed it), and the inputs whose
    busy failure became asking again (their organizer's note goes). Call only when `unready` says nothing."""
    counts: Counter = Counter()
    retried: Set[str] = set()
    state = ProjectState()
    out: List[Row] = []
    for row in rows:
        new = _one(_files(row, counts), state, counts, retried)
        out.append(new)
        try:
            apply(state, ev.decode(new))
        except Exception:  # a damaged change is skipped on replay as well: the next ones are rewritten the same way
            pass
    return out, counts, retried


def _plain(x: Any) -> Any:
    if dataclasses.is_dataclass(x) and not isinstance(x, type):
        return {f.name: getattr(x, f.name) for f in dataclasses.fields(x)}
    if isinstance(x, (set, frozenset)):
        return sorted(x, key=repr)
    return repr(x)


def snapshot(state: ProjectState, retried: Collection[str] = ()) -> str:
    """Everything a log leaves, but the log itself (and the mark that voice notes' words were split, B682), and the
    organizer's note on the inputs `retried` (a busy failure, asked again: the note goes, as nothing is written for one
    now): two logs with the same snapshot leave the same records."""
    parts: Dict[str, Any] = {f.name: getattr(state, f.name) for f in dataclasses.fields(state)
                             if f.name not in ("events", "voices_split", "inputs")}
    parts["inputs"] = {k: dataclasses.replace(v, org=None) if k in retried else v for k, v in state.inputs.items()}
    return json.dumps(parts, default=_plain, sort_keys=True, ensure_ascii=False)
