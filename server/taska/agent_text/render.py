"""The plain-text answers agents read: an item's card, the item list, the inbox, the rules, a document, the log.

The words here are the agent interface: agents parse them, so they stay exactly as they are.
"""

from __future__ import annotations

import textwrap
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Mapping, Sequence

from ..domain import events as ev
from ..domain import rules
from ..domain.model import Doc, Input, Item
from ..domain.rules import Held
from ..domain.state import ProjectState
from ..domain.text import clean_title, first_line, hm
from ..domain.vocab import CLOSED

FileRefText = Callable[[str], str]


@dataclass
class Reading:
    """What an answer is read from: the state, which inputs wait for voice words, whether the organizer is on, and
    how a file is named for this caller (a path on this machine, an address from elsewhere)."""

    state: ProjectState
    held: Held
    organizer_on: bool
    file_ref: FileRefText  # for this caller
    file_path: FileRefText  # always the path on this machine


def line(st: ProjectState, it: Item) -> str:
    out = f"{st.code(it.n)} {it.pri} {it.when} {it.status} {it.title}"
    w = rules.waiting(st, it)
    if w:
        out += " !" if w.kind == "block" else " ?"
    elif rules.replied(it):
        out += " <"
    if it.parent:
        out += f" ^{st.code(it.parent)}"
    if it.archived:
        out += " [archived]"
    return out


def listing(st: ProjectState, q: Mapping[str, Sequence[str]]) -> str:
    def one(k: str, default: str = "") -> str:
        return (q.get(k) or [default])[0]

    status, limit = one("status", "active"), int(one("limit", "60") or 60)
    words = one("q").lower().split()
    archived = one("archived")  # "" hide, "1" only archived, "all" both
    rows: List[Item] = []
    for it in rules.by_priority(st.live_items()):
        if (archived == "1" and not it.archived) or (not archived and it.archived):
            continue
        if status == "active" and it.status in CLOSED:
            continue
        if status not in ("active", "all") and it.status != status:
            continue
        if (one("type") or "") != "rule" and it.type == "rule":
            continue  # rules have their own view: GET /rules
        if one("type") and it.type != one("type").lower():
            continue
        if one("pri") and it.pri != one("pri").upper():
            continue
        if one("when") and it.when != one("when").lower():
            continue
        if one("wait") and not rules.waiting(st, it):
            continue
        if one("reply") and not rules.replied(it):
            continue
        hay = (st.code(it.n) + " " + str(it.n) + " " + it.title + " " + it.body + " " + it.next).lower()
        if all(w in hay for w in words):
            rows.append(it)
    out = [line(st, i) for i in rows[:limit]]
    if len(rows) > limit:
        out.append(f"… {len(rows) - limit} more (add &limit=)")
    return f"{len(rows)} items" + ("\n" + "\n".join(out) if out else "") + "\n"


def _files_of(rd: Reading, it: Item) -> List[str]:
    seen: set = set()
    out: List[str] = []
    for rid in it.srcs:
        inp = rd.state.inputs.get(rid)
        for f in inp.files if inp else []:
            if f.f not in seen:
                seen.add(f.f)
                out.append(rd.file_ref(f.f))
    return out


def card(rd: Reading, it: Item) -> str:
    st = rd.state
    c = st.code(it.n)
    out = [f"{c} {it.type} {it.pri} {it.when} {it.status}{' archived' if it.archived else ''}  {it.title}"]
    if it.deleted:
        out.append(f"deleted by the user together with input {it.deleted}: stop working on it")
    if it.merged_into:
        out.append(f"merged into {st.code(it.merged_into)}")
    kids = [st.code(i.n) for i in st.live_items() if i.parent == it.n]
    meta = [x for x in (f"parent {st.code(it.parent)}" if it.parent else "",
                        "kids " + " ".join(kids) if kids else "",
                        "src " + " ".join(it.srcs) if it.srcs else "") if x]
    if meta:
        out.append(" · ".join(meta))
    if it.next:
        out.append("next: " + it.next)
    par = st.items.get(it.parent) if it.parent else None
    if par:  # what the item is part of, short: its title, how it starts, what was decided there, its documents
        out.append(f"part of {st.code(par.n)} ({par.status}): {par.title}")
        out.extend("  " + first_line(ln, 200) for ln in [ln for ln in (par.body or "").splitlines() if ln.strip()][:4])
        out.extend(f"  decided: {first_line(x.text, 200)}" for x in [x for x in par.thread if x.kind == "decide"][-2:])
        pdocs = st.docs_of(par.n)
        if pdocs:
            out.append("  docs: " + "; ".join(f"D{d.d} {d.title}" for d in pdocs))
    w = rules.waiting(st, it)
    if w:
        out.append(f"{'! blocked' if w.kind == 'block' else '? asked'}, waiting on the user: " + w.text)
    elif rules.replied(it):
        out.append("< the user replied after the agent's last message (see thread)")
    if it.body:
        out.append("body:\n" + it.body)
    files = _files_of(rd, it)
    if files:
        out.append("files: " + " ".join(files))
    # the user's own words this item came from, whole (the organizer may have summed up); what is already in the
    # talk as the user's message, or is the body, is not repeated
    shown = {x.src for x in it.thread if x.by == "you"}
    body_words = " ".join((it.body or "").split())
    said = [st.inputs[r] for r in it.srcs if r in st.inputs and r not in shown and not st.inputs[r].deleted
            and " ".join((st.inputs[r].text or "").split()) not in body_words]
    if said:
        out.append("the user's own words (the inputs it came from):")
        for inp in said:
            where = f" on {st.code(inp.scope)}" if inp.scope and inp.scope != it.n else ""
            out.append(f"{inp.id} {hm(inp.t)}{where}:")
            out.extend("  " + ln for ln in (inp.text or "(no words)").splitlines())
            fs = [rd.file_ref(f.f) for f in inp.files]
            if fs:
                out.append("  files: " + " ".join(fs))
    docs = st.docs_of(it.n)
    if docs:
        out.append("docs: " + "; ".join(_doc_summary(d) for d in docs))
    if it.thread:
        out.append("thread:")
        for x in it.thread[-30:]:
            tag = x.by + (f" · {x.ses}" if x.ses else "") + ("" if x.kind == "say" else " " + x.kind) \
                + (" → " + ", ".join(x.to) if x.to else "")
            edited = f" (edited {hm(x.edited)})" if x.edited else ""
            out.append(f"#{x.id} {hm(x.t)} {tag}{edited}: {x.text}" + "".join(f" [{rd.file_ref(f.f)}]" for f in x.files))
    return "\n".join(out) + "\n"


def _doc_summary(d: Doc) -> str:
    open_ = rules.doc_unanswered(d)
    return f"D{d.d} {d.title} ({len(d.comments)} comments" + (f", {open_} unanswered" if open_ else "") + ")"


def input_card(rd: Reading, inp: Input) -> str:
    st = rd.state
    scope = f" →{st.code(inp.scope)} {st.items[inp.scope].title}" if inp.scope else ""
    head = f"{inp.id} {hm(inp.t)} {inp.by}{scope}" + ("" if not inp.acked else " [handled]") \
        + (" [deleted by the user]" if inp.deleted else "")
    out = [head]
    if inp.text:
        out.append(textwrap.indent(inp.text, "  "))
    if inp.files:
        out.append("  files: " + " ".join(rd.file_ref(f.f) for f in inp.files))
    if inp.org:
        out.append(f"  organizer: {inp.org.msg}")
    if inp.history:
        out.append(f"  updated: {hm(inp.updated or '')}; latest text above replaces earlier versions")
        out.append("  linked items: " + " ".join(st.code(n) for n in inp.touched))
    return "\n".join(out)


def inbox(rd: Reading) -> str:
    rows = rules.by_number(rules.for_agent(rd.state, rd.organizer_on, rd.held))
    busy = sum(1 for i in rules.pending(rd.state) if rd.organizer_on and not i.org)
    head = f"inbox {len(rows)} pending" + (f" (+{busy} being organized)" if busy else "") + "\n"
    return head + "".join(input_card(rd, i) + "\n" for i in rows)


def rules_text(st: ProjectState) -> str:
    rows = rules.rules_in_force(st)
    if rows:
        out = [f"{len(rows)} project rule{'s' if len(rows) != 1 else ''} in force. Follow the ones that apply to what you are doing."]
    else:
        out = ["No project rules yet."]
    for it in rows:
        out.append(f"{st.code(it.n)} {it.title}" + ("\n" + textwrap.indent(it.body, "  ") if it.body else ""))
    return "\n".join(out) + "\n"


def doc_text(rd: Reading, d: Doc) -> str:
    st = rd.state
    blocks, detached = rules.doc_view(d)
    titled = bool(blocks) and " ".join(blocks[0].text.lstrip("#").split()) == d.title
    out = [f"D{d.d} on {st.code(d.n)}{'' if titled else ': ' + d.title}  (updated {hm(d.t1)} by {d.by}; reply with: "
           f"D{d.d} reply ¶N <text>, ¶0 for the whole document)"]
    texts = [b.text for b in blocks]
    if d.is_page:  # a web page: its HTML, then each part commented on
        out[0] = (f"D{d.d} on {st.code(d.n)}: {d.title}  (a web page; updated {hm(d.t1)} by {d.by}; replace it with: "
                  f"D{d.d} html; reply with: D{d.d} reply ¶N <text>, ¶0 for the whole page)")
        out.append(textwrap.indent(d.md, "  "))
        texts = ["part of the page: " + first_line(b.text, 200) for b in blocks]
    whole = rules.doc_whole(d)
    if whole:
        out.append("¶0 comments on the whole document:")
        for c in whole:
            out.append(f"   > {c.by} {hm(c.t)}: {c.text}" + "".join(f" [{rd.file_path(f.f)}]" for f in c.files))
    for i, (b, text) in enumerate(zip(blocks, texts), 1):
        out.append(f"¶{i} " + text.replace("\n", "\n   "))
        for c in b.comments:
            part = "" if " ".join(c.quote.split()) == " ".join(text.split()) else f"on \"{first_line(c.quote, 120)}\": "
            out.append(f"   > {c.by} {hm(c.t)}: {part}{c.text}" + "".join(f" [{rd.file_path(f.f)}]" for f in c.files))
    if detached:
        out.append("comments whose paragraph was rewritten or removed:")
        for t in detached:
            out.append(f"   on \"{first_line(t.quote, 80)}\"")
            for c in t.comments:
                out.append(f"   > {c.by} {hm(c.t)}: {c.text}")
    return "\n".join(out) + "\n"


# ----------------------------------------------------------------------------- the change log


def log(st: ProjectState, n: int) -> str:
    return "".join(f"#{x['seq']} {hm(x['t'])} {x['who']}{' · ' + x['ses'] if x.get('ses') else ''} {x['what']}\n"
                   for x in log_entries(st, n)) or "\n"


def log_entries(st: ProjectState, n: int, before: int = 0) -> List[Dict[str, Any]]:
    """The last n changes, one each: {seq, t, who, what}; with `before`, the n changes before that one."""
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
    out: List[Dict[str, Any]] = []
    for e in evs[-n:]:
        who, what = _said(st, e)
        out.append({"seq": e.seq, "t": e.t, "who": who, "what": what, **({"ses": e.ses} if e.ses else {})})
    return out


def _codes(st: ProjectState, ns: Sequence[int]) -> str:
    return " ".join(st.code(n) for n in ns)


def _said(st: ProjectState, e: ev.Event) -> "tuple[str, str]":
    """Who made a change and what it was, in the log's words."""
    who = e.by
    c = st.code
    if isinstance(e, ev.InputAdded):
        return who, f"in {e.id}" + (f" →{c(e.scope)}" if e.scope else "") + f" {first_line(e.text)!r}"
    if isinstance(e, ev.ItemAdded):
        return who, (f"new {c(e.n)} {e.type} {e.pri} {e.when} {first_line(e.clean)!r}" + (f" ←{e.src}" if e.src else ""))
    if isinstance(e, ev.FieldsSet):
        f = e.fields
        return who, (f"{c(e.n)} " + ", ".join(f"{a} {first_line(e.was.get(a, ''), 24)}→{first_line(b, 24)}" for a, b in f.items())
                     + (f" (undo #{e.undo_of})" if e.undo_of else ""))
    if isinstance(e, ev.MessagePosted):
        return who, f"{c(e.n)} {e.kind} {first_line(e.text)!r}"
    if isinstance(e, ev.ItemMerged):
        return who, f"{c(e.n)} merged into {c(e.into)}"
    if isinstance(e, ev.InputsAcked):
        return who, "ack " + " ".join(e.ids)
    if isinstance(e, ev.ProjectRenamed) and e.name is not None:
        return who, f"renamed the project {e.name!r}"
    if isinstance(e, ev.DocWritten):
        return who, f"doc D{e.d} on {c(e.n)} {first_line(e.title)!r}"
    if isinstance(e, ev.CommentAdded):
        return who, f"D{e.d} comment {first_line(e.text)!r}"
    if isinstance(e, ev.ThreadResolved):
        return who, f"{'resolved' if e.on else 'reopened'} a thread on D{e.d}"
    if isinstance(e, ev.CommentEdited):
        return who, f"edited a comment on D{e.d}: {first_line(e.text)!r}"
    if isinstance(e, ev.CommentDeleted):
        return who, f"deleted a comment on D{e.d}"
    if isinstance(e, ev.CommentRestored):
        return who, f"restored a comment on D{e.d}"
    if isinstance(e, ev.FilingUndone):
        return who, f"undo organizer changes for {e.src}"
    if isinstance(e, ev.FilingRedone):
        return who, f"redo organizer changes for {e.src}"
    if isinstance(e, (ev.InputDeleted, ev.InputRestored)):
        kept = e.kept if isinstance(e, ev.InputDeleted) else []
        return who, (f"{e.src} {'deleted' if isinstance(e, ev.InputDeleted) else 'restored'}"
                     + (" with " + _codes(st, e.ns) if e.ns else "")
                     + ("; kept " + ", ".join(f"{c(n)} ({why})" for n, why in kept) if kept else ""))
    if isinstance(e, ev.ItemsArchived):
        return who, (f"{'archived' if e.on else 'unarchived'} {len(e.ns)}: " + _codes(st, e.ns[:12])
                     + (" …" if len(e.ns) > 12 else ""))
    if isinstance(e, ev.InputMoved):
        return who, f"{e.src} moved to {e.to} as {e.as_}"
    if isinstance(e, ev.InputAmended):
        return who, f"{e.src} {e.mode}: {first_line(e.text)!r}"
    if isinstance(e, ev.WordsIn):
        return who, f"{e.src} voice note words: {first_line(e.tr)!r}"
    if isinstance(e, ev.ItemsDeleted):
        return who, "deleted " + _codes(st, e.ns)
    if isinstance(e, ev.ItemsRestored):
        return who, "restored " + _codes(st, e.ns)
    if isinstance(e, ev.DocDeleted):
        return who, f"{'deleted' if e.on else 'restored'} D{e.d}"
    if isinstance(e, ev.DocMoved):
        return who, f"D{e.d} moved to {c(e.to)}"
    if isinstance(e, ev.CommentMoved):
        return who, f"moved a comment on D{e.d}"
    if isinstance(e, ev.FileTakenOff):
        return who, f"took {e.f} off " + (f"a comment on D{e.d}" if e.d else str(e.src))
    if isinstance(e, ev.MessageHidden):
        return who, f"{'hid' if e.on else 'showed'} a message on {c(e.n)}"
    if isinstance(e, ev.InputRescoped):
        return who, f"{e.src} now goes with {c(e.to)}"
    if not isinstance(e, ev.Organized) and e.src is None:  # a kind with no display text: show its stored identity
        kind = e.kind if isinstance(e, ev.Unknown) else e.KIND
        raw_id = e.raw.get("id", "") if isinstance(e, ev.Unknown) else ""
        return who, f"{kind} {raw_id}".rstrip()
    if isinstance(e, ev.Organized) and e.retry:
        return who, f"organizer {e.src} retry"
    msg = e.msg if isinstance(e, ev.Organized) else ""
    ok = e.ok if isinstance(e, ev.Organized) else False
    return "org", f"organizer {e.src} {'ok' if ok else 'FAILED'}: {first_line(msg, 90)}"


def clean(title: str) -> str:
    return clean_title(title)[0]
