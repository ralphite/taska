"""The plain-text answers agents read: an item's card, the item list, the inbox, the rules, a document.
The change log is in `log`.

The words here are the agent interface: agents parse them, so they stay exactly as they are.
"""

from __future__ import annotations

import hashlib
import textwrap
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Mapping, Sequence, Tuple

from ..domain import rules, sections, versions
from . import guide_text
from ..domain.model import Comment, Doc, FileRef, Input, Item, Message, Proposal
from ..domain.rules import Held
from ..domain.state import ProjectState
from ..domain.text import clean_title, first_line, hm
from ..domain.vocab import CLOSED
from ..domain.voices import for_agents, is_voice

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


def _others(rd: Reading, files: Sequence[FileRef], path: bool = False) -> List[str]:
    """The files that are not voice notes (a voice note is read as its words)."""
    name = rd.file_path if path else rd.file_ref
    return [name(f.f) for f in files if not is_voice(f)]


def _own_files(st: ProjectState, x: Message) -> List[FileRef]:
    """A message of yours carries the voice notes of the input it is: its words are read with it."""
    inp = st.inputs.get(x.src or "") if x.by == "you" else None
    if not inp or x.change or not (x.id == inp.seq or x.text.startswith(f"{inp.id} updated:")):
        return list(x.files)
    return list(x.files) + [f for f in inp.files if is_voice(f)]


def _comment(rd: Reading, c: Comment) -> str:
    """A comment as agents read it: its words, each voice note's words on a line of its own, its other files."""
    words = for_agents(rd.state, c.text, c.files).replace("\n", "\n     ")
    return words + "".join(f" [{p}]" for p in _others(rd, c.files, path=True))


def when(it: Item) -> str:
    """Now or later, and the day a Later ends (D115 #21): "later until 2026-11-10"."""
    return f"later until {it.later_until}" if it.when == "later" and it.later_until else it.when


def line(st: ProjectState, it: Item) -> str:
    out = f"{st.code(it.n)} {it.pri} {when(it)} {it.status} {it.title}"
    w = rules.waiting(st, it)
    if w:
        out += " ?"
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
    out = [f"{c} {it.type} {it.pri} {when(it)} {it.status}{' archived' if it.archived else ''}  {it.title}"]
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
    asks = rules.open_asks(st, it)
    if asks and rules.replied(it):  # answered in part: the rest still waits (B749)
        out.append("< the user answered some of the questions (see thread); still waiting on: "
                   + " | ".join(first_line(x.text, 200) for x in asks))
    elif asks:
        out.append("? asked, waiting on the user: " + "\n".join(x.text for x in asks))
    elif rules.replied(it):
        out.append("< the user replied after the agent's last message (see thread)")
    if it.body:
        out.append("body:\n" + it.body)
    files = _files_of(rd, it)
    if files:
        out.append("files: " + " ".join(files))
    docs = st.docs_of(it.n)
    if docs:
        out.append("docs: " + "; ".join(_doc_summary(d) for d in docs))
    if it.thread:
        out.append("thread:")
        for x in it.thread[-30:]:
            tag = x.by + (f" · {x.ses}" if x.ses else "") + ("" if x.kind == "say" else " " + x.kind) \
                + (" → " + ", ".join(x.to) if x.to else "")
            edited = f" (edited {hm(x.edited)})" if x.edited else ""
            files = _own_files(st, x)
            out.append(f"#{x.id} {hm(x.t)} {tag}{edited}: {for_agents(st, x.text, files)}"
                       + "".join(f" [{p}]" for p in _others(rd, files)))
    out.extend(_reference(rd, it))
    return "\n".join(out) + "\n"


def _reference(rd: Reading, it: Item) -> List[str]:
    """F568: last, every input the item came from, in time order, so an agent has the user's words in one read: the
    words as everyone reads them (a voice note's tidied words); one line for those already in the body or the thread
    above."""
    st = rd.state
    srcs = sorted((st.inputs[r] for r in it.srcs if r in st.inputs and not st.inputs[r].deleted), key=lambda i: i.t)
    if not srcs:
        return []
    talk = {x.src: x.id for x in it.thread[-30:] if x.by == "you" and x.src}
    body_words = " ".join((it.body or "").split())
    out = ["reference: the user's own words (the inputs it came from):"]
    for inp in srcs:
        where = f" on {st.code(inp.scope)}" if inp.scope and inp.scope != it.n else ""
        said = for_agents(st, inp.text, inp.files)
        words = " ".join(said.split())
        if inp.id in talk:
            out.append(f"{inp.id} {hm(inp.t)}{where}: in the thread above (#{talk[inp.id]})")
        elif words and words in body_words:
            out.append(f"{inp.id} {hm(inp.t)}{where}: in the body above")
        else:
            out.append(f"{inp.id} {hm(inp.t)}{where}:")
            out.extend("  " + ln for ln in (said or "(no words)").splitlines())
            fs = _others(rd, inp.files)
            if fs:
                out.append("  files: " + " ".join(fs))
    return out


def _doc_summary(d: Doc) -> str:
    open_ = rules.doc_unanswered(d)
    return f"D{d.d} {d.title} ({len(d.comments)} comments" + (f", {open_} unanswered" if open_ else "") + ")"


def input_card(rd: Reading, inp: Input) -> str:
    st = rd.state
    scope = f" →{st.code(inp.scope)} {st.items[inp.scope].title}" if inp.scope else ""
    head = f"{inp.id} {hm(inp.t)} {inp.by}{scope}" + ("" if not inp.acked else " [handled]") \
        + (" [deleted by the user]" if inp.deleted else "") \
        + (" [cancelled: not sent, not to handle]" if inp.kind == "cancelled" else "")
    out = [head]
    said = for_agents(st, inp.text, inp.files, as_said=True)
    if said:
        out.append(textwrap.indent(said, "  "))
    others = _others(rd, inp.files)
    if others:
        out.append("  files: " + " ".join(others))
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


def who_wrote(by: str) -> str:
    """Who wrote a version of the rules, as agents read it."""
    return {"you": "the user", "org": "the organizer (the user's words)", "taska": "taska"}.get(by, by)


def guide(base: str, rules_line: str) -> str:
    """GET /agent: the guide, for this address and with the rules' version."""
    return guide_text.AGENT.format(base=base, grammar=guide_text.GRAMMAR, rules=rules_line)


_version: List[str] = []  # the guide's words it was worked out from, then its version and the text


def guide_version() -> Tuple[str, str]:
    """The guide's version (a short hash) and its text as every project and address shares it, so it changes only
    when the guide's words do (F743)."""
    if _version[:2] != [guide_text.AGENT, guide_text.GRAMMAR]:
        words = guide("BASE", "<the project rules' version>")
        _version[:] = [guide_text.AGENT, guide_text.GRAMMAR, hashlib.sha256(words.encode()).hexdigest()[:12], words]
    return _version[2], _version[3]


def rules_head(st: ProjectState) -> str:
    """The rules' version in one line, for /agent and /next (I693)."""
    d = st.rules
    v = versions.versions(st, d) if d else []
    return f"Project rules v{v[-1].v}: read GET /rules once per session" if v else "No project rules yet"


def rules_text(st: ProjectState) -> str:
    """GET /rules: the rules document as it is now, headed by its version, who and when; the proposals waiting."""
    d = st.rules
    vs = versions.versions(st, d) if d else []
    how = ("To change them, propose: `rules propose <why>` with the sections it changes indented under it (replace, "
           "add or delete ## <section>; whole only for the whole text); the user approves or declines.")
    if not vs:
        out = ["No project rules yet.", how]
    else:
        x = vs[-1]
        out = [f"Project rules, version {x.v}, {who_wrote(x.by)}, {hm(x.t)}. Follow the parts that apply to what you are "
               "doing.", how, "", d.md.strip("\n") if d else ""]
    for p in versions.waiting(d):
        out.append(f"\nwaiting for the user: P{p.id} by {p.by}: {p.why}")
    return "\n".join(out) + "\n"


def _overlap(a: Proposal, b: Proposal) -> bool:
    """Two proposals about the same sections (a whole text is about all of them)."""
    x, y = sections.touched(a.edits), sections.touched(b.edits)
    return x is None or y is None or bool({sections.name_of(t) for t in x} & {sections.name_of(t) for t in y})


def proposals_for(st: ProjectState, who: str) -> List[Proposal]:
    """This agent's proposed changes to the rules that wait on it: the user wrote on one, or one was sent back and it
    has not answered or proposed again since."""
    d = st.rules
    if not d:
        return []
    out: List[Proposal] = []
    for p in d.proposals:
        if p.by != who:
            continue
        talk = rules.proposal_comments(d, p.id)
        if talk and talk[-1].by == "you":
            out.append(p)
        elif p.state == "stale" and not any(x.by == who and x.id > p.id and _overlap(x, p) for x in d.proposals) \
                and not any(c.by == who and c.t >= (p.decided or "") for c in talk):
            out.append(p)
    return out


def proposal_text(st: ProjectState, p: Proposal) -> str:
    """One proposal for its agent: what it said, what became of it, the talk on it."""
    d = st.rules
    assert d is not None
    state = {"wait": "waits for the user", "approved": "approved", "declined": "declined",
             "stale": f"sent back: {p.note}; write it again on the rules as they are now (GET /rules) and propose it again"}
    out = [f"your rules proposal P{p.id} ({p.why}) {state.get(p.state, p.state)}. Answer the user with "
           f"`rules reply P{p.id} <text>`; to change it, `rules propose <why>` again."]
    for c in rules.proposal_comments(d, p.id):
        out.append(f"   > {c.by} {hm(c.t)}: {for_agents(st, c.text, c.files)}")
    return "\n".join(out) + "\n"


def doc_text(rd: Reading, d: Doc) -> str:
    st = rd.state
    blocks, detached = rules.doc_view(d)
    titled = bool(blocks) and " ".join(blocks[0].text.lstrip("#").split()) == d.title
    out = [f"D{d.d} on {st.code(d.n)}{'' if titled else ': ' + d.title}  (updated {hm(d.t1)} by {d.by}; reply with: "
           f"D{d.d} reply ¶N <text>, ¶0 for the whole document, ¶N.K for thread K of ¶N)"]
    texts = [b.text for b in blocks]
    if d.is_rules:  # the project's rules (I693): answered here; changed only by proposing
        out[0] = (f"D{d.d}: the project's rules  (updated {hm(d.t1)} by {who_wrote(d.by)}; reply with: D{d.d} reply ¶N "
                  "<text>, ¶0 for the whole document; to change the rules: rules propose <why>)")
    if d.is_page:  # a web page: its HTML, then each part commented on
        out[0] = (f"D{d.d} on {st.code(d.n)}: {d.title}  (a web page; updated {hm(d.t1)} by {d.by}; replace it with: "
                  f"D{d.d} html; reply with: D{d.d} reply ¶N <text>, ¶0 for the whole page)")
        out.append(textwrap.indent(d.md, "  "))
        texts = ["part of the page: " + first_line(b.text, 200) for b in blocks]
    def mark(i: int, comments: List[Any]) -> Dict[int, str]:
        """With more than one thread on a paragraph, each is named ¶i.k, so a reply can go into it."""
        threads = list(dict.fromkeys(c.th for c in comments))
        return {t: f"[¶{i}.{k}] " for k, t in enumerate(threads, 1)} if len(threads) > 1 else {}
    whole = rules.doc_whole(d)
    if whole:
        out.append("¶0 comments on the whole document:")
        names = mark(0, whole)
        for c in whole:
            out.append(f"   > {names.get(c.th, '')}{c.by} {hm(c.t)}: {_comment(rd, c)}")
    for i, (b, text) in enumerate(zip(blocks, texts), 1):
        out.append(f"¶{i} " + text.replace("\n", "\n   "))
        names = mark(i, b.comments) if not d.is_page else {}
        for c in b.comments:
            part = "" if " ".join(c.quote.split()) == " ".join(text.split()) else f"on \"{first_line(c.quote, 120)}\": "
            out.append(f"   > {names.get(c.th, '')}{c.by} {hm(c.t)}: {part}{_comment(rd, c)}")
    if detached:
        out.append("comments whose paragraph was rewritten or removed:")
        for t in detached:
            out.append(f"   on \"{first_line(t.quote, 80)}\"")
            for c in t.comments:
                out.append(f"   > {c.by} {hm(c.t)}: {_comment(rd, c)}")
    return "\n".join(out) + "\n"



def clean(title: str) -> str:
    return clean_title(title)[0]
