"""Commands on documents: write one, tick its choices, comment, resolve, edit, delete, move, take a file off; a
diagram that does not draw goes back to its writer."""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Set, Tuple

from ..domain import events as ev
from ..domain.markdown import block_key, blocks as md_blocks
from ..domain.rules import doc_at, doc_view, is_proposal_key, item_at
from ..domain.vocab import DOC_KEY, MAX_TEXT, PEOPLE, TASKA, Refused
from .base import Args, Outcome, Run, handles
from .inputs import sent_files, voice_words

RULES_HOW = "the rules change with `rules propose <why>` (by sections; the user approves), not as a document"
_PAGE_TITLE = re.compile(r"<title>(.*?)</title>|<h1[^>]*>(.*?)</h1>", re.S | re.I)
_MERMAID = re.compile(r"\s*```[ \t]*mermaid\b", re.I)


@handles("doc")
def write_doc(r: Run, a: Args) -> Outcome:
    """A new document on an item, or new text for an existing one."""
    s = r.state
    html = a.get("fmt") == "html"  # a web page, shown as it is
    md = a.text("md").strip()  # a document is kept whole, however long
    if not md:
        raise Refused("a document needs its text (indented lines under the command)")
    first = " ".join(md.split("\n", 1)[0].lstrip("#").split())  # a document is a note: its first line is the title
    if html:
        m = _PAGE_TITLE.search(md)
        first = " ".join(re.sub(r"<[^>]+>", "", (m.group(1) or m.group(2)) if m else "").split())
    title = " ".join(str(a.get("title") or first or "Untitled").split())[:200]
    if a.get("title") and title != first[:200] and not html:
        md = f"# {title}\n\n{md}"
    fmt = "html" if html else None
    if a.get("d"):
        d = doc_at(s, a.get("d"))
        if d.is_rules:
            raise Refused(RULES_HOW)
        r.emit(ev.DocWritten(d=d.d, n=d.n, title=title, md=md, by=r.by, fmt=fmt))
        return Outcome(f"ok D{d.d} updated{r.gone_note(s.items.get(d.n))}", f"Updated D{d.d}")
    it = item_at(s, a.get("ref", ""), r.ctx)
    dn = s.max_doc + 1
    r.emit(ev.DocWritten(d=dn, n=it.n, title=title, md=md, by=r.by, fmt=fmt))
    return Outcome(f"ok D{dn} new on {s.code(it.n)}{r.gone_note(it)}", f"Wrote D{dn}")


@handles("dticks")
def tick(r: Run, a: Args) -> Outcome:
    """Choices ticked on the page go into the document as it is now."""
    d = doc_at(r.state, a.get("d"))
    if d.is_rules:
        raise Refused(RULES_HOW)
    md, at = str(d.md), 0
    spans: List[Tuple[int, int, str]] = []
    seen: Dict[str, int] = {}
    want = {f"{t.get('key')}~{int(t.get('occ') or 0)}": str(t.get("text", "")) for t in a.get("ticks") or []}
    for _, text in md_blocks(md):
        pos = md.find(text, at)
        if pos < 0:
            continue
        at = pos + len(text)
        k = block_key(text)
        seen[k] = seen.get(k, -1) + 1
        now = want.pop(f"{k}~{seen[k]}", None)
        if now is not None:
            if block_key(now) != k:  # only ticks may change: anything else is not a choice
                raise Refused("only the choices of a list can change this way")
            spans.append((pos, at, now))
    if want:
        raise Refused(f"the form changed in D{d.d}: open it again and tick again")
    for start, end, now in reversed(spans):
        md = md[:start] + now + md[end:]
    if md == d.md:
        return Outcome(f"ok D{d.d} unchanged", "Unchanged")
    r.emit(ev.DocWritten(d=d.d, n=d.n, title=d.title, md=md, by=r.by))
    return Outcome(f"ok D{d.d} updated", f"Ticked in D{d.d}")


@handles("dc")
def comment(r: Run, a: Args) -> Outcome:
    """A comment on one paragraph of a document, or on all of it (key "doc", paragraph 0)."""
    s = r.state
    d = doc_at(s, a.get("d"))
    paras = [(b.kind, b.text) for b in md_blocks(d.md)]
    if d.is_page:  # a part of the page, by its place in the page (key "h:..."); paragraph N is a thread
        threads = doc_view(d)[0]
        if a.get("para") and str(a.get("para")) != "0":
            k = int(a.get("para"))
            if not 1 <= k <= len(threads):
                raise Refused(f"D{d.d} has threads 1-{len(threads)}")
            a = a.with_(key=threads[k - 1].key, quote=threads[k - 1].text, para="")
        elif a.get("key") != DOC_KEY and not a.text("key").startswith("h:"):
            raise Refused("a part of a web page is named h:<its place>")
        paras = [("html", a.text("quote"))] if a.get("key") != DOC_KEY else []
    if str(a.get("para", "")) == "0" or a.get("key") == DOC_KEY:
        key, text = DOC_KEY, ""
    elif a.get("para"):
        k = int(a.get("para"))
        if not 1 <= k <= len(paras):
            raise Refused(f"D{d.d} has paragraphs 1-{len(paras)}")
        text = paras[k - 1][1]
        key = block_key(text)
    else:
        key = str(a.get("key", ""))
        if d.is_rules and is_proposal_key(key):  # the thread on a proposed change (I693)
            p = next((x for x in d.proposals if f"p{x.id}" == key), None)
            if not p:
                raise Refused("no such proposal")
            a = a.with_(quote=a.text("quote") or p.why)
        found = next((t for _, t in paras if block_key(t) == key or (d.is_page and key.startswith("h:"))), None)
        old = next((c for c in d.comments if c.key == key), None)
        if found is None and not old and not (d.is_rules and is_proposal_key(key)):
            raise Refused("that paragraph is not in the document")
        text = found if found is not None else (old.quote if old else "")
    body, files = str(a.get("text", "")).strip()[:MAX_TEXT], sent_files(r, a)  # a voice comment: its note, by name
    fixes = voice_words(r, a, [f.f for f in files])
    if not body and not files:
        raise Refused("empty comment")
    quote = " ".join(a.text("quote").split()) or text  # what the user selected, else the paragraph
    th = a.thread()
    if th is None and a.get("para") is not None and not d.is_page:
        # an answer by paragraph goes into one of its threads: the one named (¶3.2), else the first the user waits on
        mine = [c for c in d.comments if c.key == key]
        threads = list(dict.fromkeys(c.th for c in mine))
        pick = str(a.get("pick") or "")
        if pick.isdigit():
            if not 1 <= int(pick) <= len(threads):
                raise Refused(f"¶{a.get('para')} has threads 1-{len(threads)}" if threads else f"¶{a.get('para')} has no comments")
            th = threads[int(pick) - 1]
        else:
            last = {c.th: c.by for c in mine}
            th = next((t for t in threads if last[t] == "you" and f"{key}#{t}" not in d.resolved), None)
        if th is not None:
            quote = next(c.quote for c in mine if c.th == th)
    r.emit(ev.CommentAdded(d=d.d, key=key, quote=quote[:500], text=body, by=r.by, files=files, th=th))
    for fix in fixes:
        r.emit(fix)
    return Outcome(f"ok D{d.d} comment{r.gone_note(s.items.get(d.n))}", f"Commented on D{d.d}")


@handles("ddel")
def delete_doc(r: Run, a: Args) -> Outcome:
    d = doc_at(r.state, a.get("d"))
    if d.is_rules:
        raise Refused("the rules are not deleted; restore an earlier version instead")
    on = a.on()
    r.emit(ev.DocDeleted(d=d.d, on=on, by=r.by))
    return Outcome(f"ok D{d.d} {'deleted' if on else 'restored'}", f"{'Deleted' if on else 'Restored'} D{d.d}")


@handles("dmove")
def move_doc(r: Run, a: Args) -> Outcome:
    s = r.state
    d, it = doc_at(s, a.get("d")), item_at(s, a.get("to"), r.ctx)
    if d.is_rules:
        raise Refused("the rules belong to the project, not to an item")
    r.emit(ev.DocMoved(d=d.d, to=it.n, by=r.by))
    return Outcome(f"ok D{d.d} now on {s.code(it.n)}", f"Moved D{d.d} to {s.code(it.n)}")


@handles("dcmove")
def move_comment(r: Run, a: Args) -> Outcome:
    d = doc_at(r.state, a.get("d"))
    cid, key = a.number("id"), a.text("key")
    if not d.comment(cid):
        raise Refused(f"D{d.d} has no comment {cid}")
    paras = {b.key: b for b in doc_view(d)[0]}
    if key != DOC_KEY and key not in paras:
        raise Refused(f"D{d.d} has no such paragraph")
    quote = "" if key == DOC_KEY else " ".join(paras[key].text.split())[:500]
    r.emit(ev.CommentMoved(d=d.d, id=cid, key=key, quote=quote, by=r.by))
    return Outcome(f"ok D{d.d} comment {cid} moved", f"Moved a comment on D{d.d}")


@handles("unfile")
def take_file_off(r: Run, a: Args) -> Outcome:
    """A file taken off what you sent (an input, so your reply too), or off a comment."""
    s = r.state
    fid = a.text("f")
    if a.get("d"):
        d = doc_at(s, a.get("d"))
        cid = a.number("id")
        c = d.comment(cid)
        if not c or not any(x.f == fid for x in c.files):
            raise Refused("no such file on that comment")
        if c.by not in PEOPLE:
            raise Refused("only files you sent can be taken off")
        r.emit(ev.FileTakenOff(d=d.d, id=cid, f=fid, by=r.by))
    else:
        inp = s.inputs.get(a.text("id"))
        if not inp or not any(x.f == fid for x in inp.files):
            raise Refused("no such file on that input")
        r.emit(ev.FileTakenOff(src=inp.id, f=fid, by=r.by))
    return Outcome("ok file taken off", "Took off a file")


@handles("dcres")
def resolve(r: Run, a: Args) -> Outcome:
    """A comment thread resolved, or open again."""
    d = doc_at(r.state, a.get("d"))
    key, on = a.text("key"), a.on()
    if not any(c.key == key for c in d.comments):
        raise Refused(f"D{d.d} has no thread {key!r}")
    r.emit(ev.ThreadResolved(d=d.d, key=key, on=on, by=r.by, th=a.thread()))
    return Outcome(f"ok D{d.d} thread {'resolved' if on else 'open again'}",
                   f"{'Resolved' if on else 'Reopened'} a thread on D{d.d}")


@handles("dcedit", "dcdel", "dcundel")
def change_comment(r: Run, a: Args) -> Outcome:
    """You change or delete a comment of yours, or bring it back."""
    d = doc_at(r.state, a.get("d"))
    cid = a.number("id")
    c = d.gone.get(cid) if a.name == "dcundel" else d.comment(cid)
    if not c:
        raise Refused(f"D{d.d} has no comment {cid}" + (" to restore" if a.name == "dcundel" else ""))
    if r.by not in PEOPLE or (a.name == "dcedit" and c.by not in PEOPLE):
        raise Refused("only the user deletes comments, and edits only their own")
    if a.name == "dcedit":
        text, files = a.text("text").strip()[:MAX_TEXT], sent_files(r, a)  # files added while editing go too
        if not text and not c.files and not files:
            raise Refused("empty comment: delete it instead")
        fixes = voice_words(r, a, [f.f for f in c.files + files])
        if text != c.text or files:
            r.emit(ev.CommentEdited(d=d.d, id=cid, text=text, by=r.by, files=files))
        for fix in fixes:
            r.emit(fix)
        return Outcome(f"ok D{d.d} comment {cid} edited", f"Edited a comment on D{d.d}")
    if a.name == "dcdel":
        r.emit(ev.CommentDeleted(d=d.d, id=cid, by=r.by))
    else:
        r.emit(ev.CommentRestored(d=d.d, id=cid, by=r.by))
    word = "deleted" if a.name == "dcdel" else "restored"
    return Outcome(f"ok D{d.d} comment {cid} {word}", f"{word.capitalize()} a comment on D{d.d}")


def _writer(writes: List[ev.DocWritten], key: str) -> Optional[ev.DocWritten]:
    """The write that put this paragraph in the document as it is (the user ticking a choice or editing another
    paragraph leaves it its writer's)."""
    had: Set[str] = set()
    found = None
    for e in writes:
        keys = {block_key(t) for _, t in md_blocks(e.md)}
        if key in keys and key not in had:
            found = e
        had = keys
    return found


@handles("diagram-failed")
def diagram_failed(r: Run, a: Args) -> Outcome:
    """Taska's own (B714 r1181): a diagram the page could not draw goes to the agent that wrote it, so it fixes it,
    as a message on the document's item addressed to that agent's session; once per version of the document and
    paragraph. Nothing goes when the user wrote it, or the document changed since the page drew it."""
    if r.by != TASKA:
        raise Refused("only Taska reports a diagram that does not draw")
    s = r.state
    d = doc_at(s, a.get("d"))
    key = a.text("key")
    why = "\n".join(x.rstrip() for x in a.text("error").strip().splitlines())[:600].strip() or "Mermaid says nothing"
    if d.is_rules or d.is_page or d.deleted or (a.has("v") and a.number("v") != d.versions):
        return Outcome(f"ok D{d.d} no notice", "")
    k = next((i for i, b in enumerate(doc_view(d)[0], 1) if b.key == key and _MERMAID.match(b.text)), 0)
    if not k:
        return Outcome(f"ok D{d.d} has no such diagram", "")
    writes = [e for e in s.events if isinstance(e, ev.DocWritten) and e.d == d.d]
    w = _writer(writes, key)
    if not w or w.by in PEOPLE or w.by == TASKA:
        return Outcome(f"ok D{d.d} ¶{k} is the user's: no notice", "")
    it = s.items.get(d.n)
    while it and it.merged_into:
        it = s.items.get(it.merged_into)
    if not it or it.deleted:
        return Outcome(f"ok D{d.d} no item to tell on", "")
    head = f"D{d.d} ¶{k}: this diagram does not draw:"
    if any(x.by == TASKA and x.id > writes[-1].seq and x.text.startswith(head) for x in it.thread):
        return Outcome(f"ok D{d.d} ¶{k} told already", "")
    text = f"{head} {why.rstrip('.')}. Fix it." if "\n" not in why else f"{head}\n```\n{why}\n```\nFix it."
    to = w.ses or w.by
    r.emit(ev.MessagePosted(n=it.n, by=TASKA, kind="say", text=text, to=[to]))
    return Outcome(f"ok D{d.d} ¶{k} told {to}", "")
