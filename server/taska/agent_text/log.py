"""The project's change log: each change as an entry of facts (who, when, what kind, the items, inputs and documents
it names, the values it set), and the same entry in the log's words for agents.

An entry is data the page and agents each say in their own words: `entries` is what the page's Activity gets, `text`
what agents read (those words stay exactly as they are; agents parse them).
"""

from __future__ import annotations

from typing import Any, Dict, List, Sequence

from ..domain import events as ev
from ..domain.state import ProjectState
from ..domain.text import first_line, hm
from ..domain.voices import one_line

Entry = Dict[str, Any]

ARCHIVED_SHOWN = 12  # an archive of many items names its first ones


def text(st: ProjectState, n: int) -> str:
    """The last n changes in the log's words, one a line."""
    return "".join(f"#{x['seq']} {hm(x['t'])} {x['who']}{' · ' + x['ses'] if x.get('ses') else ''} {said(x)}\n"
                   for x in entries(st, n)) or "\n"


def entries(st: ProjectState, n: int, before: int = 0) -> List[Entry]:
    """The last n changes, one entry each; with `before`, the n changes before that one."""
    evs = st.events
    if before:
        lo, hi = 0, len(evs)
        while lo < hi:  # events are in order: the first at or after `before`
            mid = (lo + hi) // 2
            if evs[mid].seq < before:
                lo = mid + 1
            else:
                hi = mid
        evs = evs[:lo]
    return [entry(st, e) for e in evs[-n:]]


def entry(st: ProjectState, e: ev.Event) -> Entry:
    """One change as facts: {seq, t, who, ses?, kind, ...what it names, codes}. `kind` is the change's stored kind
    ("other", with its `name`, for a kind the log has nothing to say about); `codes` names each item it mentions by
    its code now."""
    who, kind, facts = _facts(st, e)
    x: Entry = {"seq": e.seq, "t": e.t, "who": who, "kind": kind, **facts}
    if e.ses:
        x["ses"] = e.ses
    ns = _items_named(x)
    if ns:
        x["codes"] = {str(k): st.code(k) for k in ns}
    return x


def _value(v: Any) -> Any:
    """A value a field was or became: as it is, a text on its first line."""
    return v if v is None or isinstance(v, (bool, int, float)) else first_line(v)


def _facts(st: ProjectState, e: ev.Event) -> "tuple[str, str, Entry]":
    """Who made a change, its kind, and what it names."""
    who, k = e.by, e.KIND
    src = {"src": e.src} if e.src else {}
    if isinstance(e, ev.InputAdded):
        return who, k, {"id": e.id, **({"to": e.scope} if e.scope else {}),
                        "text": first_line(one_line(st, e.text, e.files))}
    if isinstance(e, ev.ItemAdded):
        return who, k, {"n": e.n, "type": e.type, "pri": e.pri, "when": e.when, "title": first_line(e.clean), **src}
    if isinstance(e, ev.FieldsSet):
        changes = [{"field": a, **({"was": _value(e.was[a])} if a in e.was else {}), "now": _value(b)}
                   for a, b in e.fields.items()]
        return who, k, {"n": e.n, "set": changes, **({"undo": e.undo_of} if e.undo_of else {})}
    if isinstance(e, ev.MessagePosted):
        return who, k, {"n": e.n, "as": e.kind, "text": first_line(e.text)}
    if isinstance(e, (ev.ItemMerged, ev.ItemUnmerged)):
        return who, k, {"n": e.n, "into": e.into}
    if isinstance(e, ev.LaterEnded):
        return who, k, {"n": e.n}
    if isinstance(e, ev.InputsAcked):
        return who, k, {"ids": list(e.ids)}
    if isinstance(e, ev.ProjectRenamed) and e.name is not None:
        return who, k, {"name": e.name}
    if isinstance(e, ev.DocWritten):
        return who, k, {"d": e.d, "n": e.n, "title": first_line(e.title)}
    if isinstance(e, ev.CommentAdded):
        return who, k, {"d": e.d, "text": first_line(one_line(st, e.text, e.files))}
    if isinstance(e, ev.CommentEdited):
        return who, k, {"d": e.d, "text": first_line(e.text)}
    if isinstance(e, (ev.ThreadResolved, ev.DocDeleted)):
        return who, k, {"d": e.d, "on": e.on}
    if isinstance(e, (ev.CommentDeleted, ev.CommentRestored, ev.CommentMoved)):
        return who, k, {"d": e.d}
    if isinstance(e, ev.DocMoved):
        return who, k, {"d": e.d, "to": e.to}
    if isinstance(e, ev.VoiceHeard):
        words = e.early if e.state == "wait" else e.tidied if e.state == "done" else ""
        return who, k, {**src, "state": e.state, "text": first_line(words) if words else ""}
    if isinstance(e, ev.VoiceFixed):
        return who, k, {**src, "text": first_line(e.tidied)}
    if isinstance(e, ev.VoicesSplit):
        return who, k, {"count": len(e.voices)}
    if isinstance(e, ev.Folded):
        return who, k, {"was": e.was}
    if isinstance(e, (ev.FilingUndone, ev.FilingRedone, ev.InputSent)):
        return who, k, {"src": e.src}
    if isinstance(e, ev.InputDeleted):
        return who, k, {"src": e.src, "ns": list(e.ns), "kept": [[n, why] for n, why in e.kept]}
    if isinstance(e, ev.InputRestored):
        return who, k, {"src": e.src, "ns": list(e.ns)}
    if isinstance(e, ev.ItemsArchived):
        return who, k, {"on": e.on, "ns": e.ns[:ARCHIVED_SHOWN], "count": len(e.ns)}
    if isinstance(e, (ev.ItemsDeleted, ev.ItemsRestored)):
        return who, k, {"ns": list(e.ns)}
    if isinstance(e, ev.InputMoved):
        return who, k, {"src": e.src, "to": e.to, "as": e.as_}
    if isinstance(e, ev.InputAmended):
        return who, k, {"src": e.src, "mode": e.mode, "text": first_line(e.text)}
    if isinstance(e, ev.FileTakenOff):
        return who, k, {"f": e.f, **({"d": e.d} if e.d else src)}
    if isinstance(e, ev.MessageHidden):
        return who, k, {"n": e.n, "on": e.on}
    if isinstance(e, ev.InputRescoped):
        return who, k, {"src": e.src, "to": e.to}
    if isinstance(e, ev.Organized):
        if e.retry:
            return who, k, {"src": e.src, "retry": True}
        return "org", k, {"src": e.src, "ok": e.ok, "msg": first_line(e.msg, 90)}
    # a kind with no words of its own: its stored identity
    name = e.kind if isinstance(e, ev.Unknown) else k
    raw_id = e.raw.get("id", "") if isinstance(e, ev.Unknown) else ""
    return who, "other", {"name": name, **({"id": str(raw_id)} if raw_id else {})}


def _items_named(x: Entry) -> List[int]:
    """The items an entry names, each once, in order."""
    out: List[int] = []
    for key in ("n", "into"):
        if isinstance(x.get(key), int):
            out.append(x[key])
    if x["kind"] in ("in", "dmove", "rescope") and isinstance(x.get("to"), int):
        out.append(x["to"])
    out += x.get("ns", [])
    out += [n for n, _ in x.get("kept", [])]
    for c in x.get("set", []):
        if c["field"] == "parent":
            out += [v for v in (c.get("was"), c["now"]) if isinstance(v, int) and not isinstance(v, bool)]
    return list(dict.fromkeys(out))


def said(x: Entry) -> str:
    """What a change was, in the log's words."""
    k = x["kind"]
    codes: Dict[str, str] = x.get("codes", {})

    def c(n: int) -> str:
        return codes[str(n)]

    def cs(ns: Sequence[int]) -> str:
        return " ".join(c(n) for n in ns)

    if k == "in":
        return f"in {x['id']}" + (f" →{c(x['to'])}" if x.get("to") else "") + f" {x['text']!r}"
    if k == "add":
        return (f"new {c(x['n'])} {x['type']} {x['pri']} {x['when']} {x['title']!r}"
                + (f" ←{x['src']}" if x.get("src") else ""))
    if k == "set":
        return (f"{c(x['n'])} " + ", ".join(f"{s['field']} {first_line(s.get('was', ''), 24)}→{first_line(s['now'], 24)}"
                                            for s in x["set"])
                + (f" (undo #{x['undo']})" if x.get("undo") else ""))
    if k == "say":
        return f"{c(x['n'])} {x['as']} {x['text']!r}"
    if k == "merge":
        return f"{c(x['n'])} merged into {c(x['into'])}"
    if k == "unmerge":
        return f"{c(x['n'])} taken out of {c(x['into'])}"
    if k == "due":
        return f"{c(x['n'])} back to now (its day came)"
    if k == "ack":
        return "ack " + " ".join(x["ids"])
    if k == "cfg":
        return f"renamed the project {x['name']!r}"
    if k == "doc":
        return f"doc D{x['d']} on {c(x['n'])} {x['title']!r}"
    if k == "dc":
        return f"D{x['d']} comment {x['text']!r}"
    if k == "dcres":
        return f"{'resolved' if x['on'] else 'reopened'} a thread on D{x['d']}"
    if k == "dcedit":
        return f"edited a comment on D{x['d']}: {x['text']!r}"
    if k == "voice":
        note = f"{x['src']} voice note" if x.get("src") else "a voice note"
        if x["state"] == "wait":
            return f"{note} first words: {x['text']!r}" if x["text"] else f"{note} being transcribed"
        if x["state"] == "done":
            return f"{note} words: {x['text']!r}"
        return f"{note}: {'no words heard' if x['state'] == 'none' else 'transcription failed'}"
    if k == "voicefix":
        return f"{x['src'] + ' ' if x.get('src') else ''}voice note words corrected: {x['text']!r}"
    if k == "voices":
        return f"kept each voice note's words in one place ({x['count']} voice notes)"
    if k == "folded":
        return f"an earlier kind of change ({x['was']}), folded in"
    if k == "dcdel":
        return f"deleted a comment on D{x['d']}"
    if k == "dcundel":
        return f"restored a comment on D{x['d']}"
    if k == "undo":
        return f"undo organizer changes for {x['src']}"
    if k == "redo":
        return f"redo organizer changes for {x['src']}"
    if k in ("del", "undel"):
        kept = x.get("kept", [])
        return (f"{x['src']} {'deleted' if k == 'del' else 'restored'}" + (" with " + cs(x["ns"]) if x["ns"] else "")
                + ("; kept " + ", ".join(f"{c(n)} ({why})" for n, why in kept) if kept else ""))
    if k == "arch":
        return (f"{'archived' if x['on'] else 'unarchived'} {x['count']}: " + cs(x["ns"])
                + (" …" if x["count"] > len(x["ns"]) else ""))
    if k == "moved":
        return f"{x['src']} moved to {x['to']} as {x['as']}"
    if k == "amend":
        return f"{x['src']} {x['mode']}: {x['text']!r}"
    if k == "idel":
        return "deleted " + cs(x["ns"])
    if k == "iundel":
        return "restored " + cs(x["ns"])
    if k == "ddel":
        return f"{'deleted' if x['on'] else 'restored'} D{x['d']}"
    if k == "dmove":
        return f"D{x['d']} moved to {c(x['to'])}"
    if k == "dcmove":
        return f"moved a comment on D{x['d']}"
    if k == "unfile":
        return f"took {x['f']} off " + (f"a comment on D{x['d']}" if x.get("d") else str(x.get("src")))
    if k == "hide":
        return f"{'hid' if x['on'] else 'showed'} a message on {c(x['n'])}"
    if k == "send":
        return f"{x['src']} sent (it was a cancelled recording)"
    if k == "rescope":
        return f"{x['src']} now goes with {c(x['to'])}"
    if k == "org":
        if x.get("retry"):
            return f"organizer {x['src']} retry"
        return f"organizer {x['src']} {'ok' if x['ok'] else 'FAILED'}: {x['msg']}"
    return f"{x['name']} {x.get('id', '')}".rstrip()
