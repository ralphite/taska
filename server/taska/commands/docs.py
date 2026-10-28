"""Commands on documents: write one, tick its choices, comment, resolve, edit, delete, move, take a file off."""

from __future__ import annotations

import re
from typing import Dict, List, Tuple

from ..domain import events as ev
from ..domain.markdown import block_key, blocks as md_blocks
from ..domain.rules import doc_at, doc_view, item_at
from ..domain.vocab import DOC_KEY, MAX_TEXT, PEOPLE, Refused
from .base import Args, Outcome, Run, handles
from .inputs import sent_files

_PAGE_TITLE = re.compile(r"<title>(.*?)</title>|<h1[^>]*>(.*?)</h1>", re.S | re.I)


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
        found = next((t for _, t in paras if block_key(t) == key or (d.is_page and key.startswith("h:"))), None)
        old = next((c for c in d.comments if c.key == key), None)
        if found is None and not old:
            raise Refused("that paragraph is not in the document")
        text = found if found is not None else (old.quote if old else "")
    words, files = r.project.with_words(str(a.get("text", "")).strip(), sent_files(r, a))  # a voice comment keeps its recording
    body = words[:MAX_TEXT]
    files = [f.with_wait(None) for f in files]  # words still to come stay with the recording: the page waits for them
    if not body and not files:
        raise Refused("empty comment")
    quote = " ".join(a.text("quote").split()) or text  # what the user selected, else the paragraph
    r.emit(ev.CommentAdded(d=d.d, key=key, quote=quote[:500], text=body, by=r.by, files=files, th=a.thread()))
    return Outcome(f"ok D{d.d} comment{r.gone_note(s.items.get(d.n))}", f"Commented on D{d.d}")


@handles("ddel")
def delete_doc(r: Run, a: Args) -> Outcome:
    d = doc_at(r.state, a.get("d"))
    on = a.on()
    r.emit(ev.DocDeleted(d=d.d, on=on, by=r.by))
    return Outcome(f"ok D{d.d} {'deleted' if on else 'restored'}", f"{'Deleted' if on else 'Restored'} D{d.d}")


@handles("dmove")
def move_doc(r: Run, a: Args) -> Outcome:
    s = r.state
    d, it = doc_at(s, a.get("d")), item_at(s, a.get("to"), r.ctx)
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
        text, files = r.project.with_words(a.text("text").strip(), sent_files(r, a))  # files added while editing go too
        text = text[:MAX_TEXT]
        if not text and not c.files and not files:
            raise Refused("empty comment: delete it instead")
        r.emit(ev.CommentEdited(d=d.d, id=cid, text=text, by=r.by, files=files))
        return Outcome(f"ok D{d.d} comment {cid} edited", f"Edited a comment on D{d.d}")
    if a.name == "dcdel":
        r.emit(ev.CommentDeleted(d=d.d, id=cid, by=r.by))
    else:
        r.emit(ev.CommentRestored(d=d.d, id=cid, by=r.by))
    word = "deleted" if a.name == "dcdel" else "restored"
    return Outcome(f"ok D{d.d} comment {cid} {word}", f"{word.capitalize()} a comment on D{d.d}")
