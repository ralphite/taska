"""Commands on items: make one, change its fields, write on its talk, merge, archive, delete, hide a message."""

from __future__ import annotations

import mimetypes
import os
import re
from typing import Any, Dict, List, Optional

from ..domain import events as ev
from ..domain.history import followed, last_archive, status_set_by
from ..domain.model import FileRef, Item
from ..domain.rules import RefContext, descendants, item_at, open_kids, replied
from ..domain.state import ProjectState
from ..domain.vocab import CLOSED, LETTER, MAX_TEXT, MESSAGE_KINDS, PEOPLE, PRIORITIES, STATUSES, WHENS, Refused
from .base import Args, Outcome, Run, handles

_NONE_WORDS = ("", "-", "none", "null")


def field_value(state: ProjectState, name: str, v: Any, ctx: Optional[RefContext] = None, me: Optional[Item] = None) -> Any:
    """A field's value as sent, checked and in its stored form."""
    if name == "type":
        v = str(v).lower()
        if v not in LETTER:
            raise Refused(f"type must be one of {'/'.join(LETTER)}")
    elif name == "pri":
        v = str(v).upper()
        if v not in PRIORITIES:
            raise Refused("pri must be P0-P3")
    elif name == "when":
        v = str(v).lower()
        if v not in WHENS:
            raise Refused("when must be now/later")
    elif name == "status":
        v = {"drop": "dropped"}.get(str(v).lower(), str(v).lower())
        if v not in STATUSES:
            raise Refused("status must be open/doing/review/done/dropped (proposed is set for you)")
    elif name == "title":
        v = " ".join(str(v).split())
        if not v:
            raise Refused("empty title")
        v = v[:300]
    elif name in ("body", "next"):
        v = str(v).strip()[:MAX_TEXT]
    elif name == "archived":
        v = v if isinstance(v, bool) else str(v).lower() in ("1", "true", "yes", "on")
    elif name == "rank":  # "do this next": first in its priority (smaller goes first); none keeps the usual order
        if v is None or str(v).strip().lower() in _NONE_WORDS:
            return None
        try:
            v = float(v)
        except ValueError:
            raise Refused("rank must be a number, or - for the usual order")
    elif name == "parent":
        if str(v).strip().lower() in _NONE_WORDS:
            return None
        p = item_at(state, v, ctx)
        if me is not None:
            up: Optional[Item] = p
            while up:
                if up.n == me.n:
                    raise Refused("parent loop")
                up = state.items.get(up.parent) if up.parent is not None else None
        return p.n
    else:
        raise Refused(f"unknown field '{name}'")
    return v


@handles("new")
def new_item(r: Run, a: Args) -> Outcome:
    s = r.state
    title = field_value(s, "title", a.get("title", ""))  # checked in this order, so the first problem is the one told
    kind = field_value(s, "type", a.get("type") or "idea")
    pri = field_value(s, "pri", a.get("pri") or "P2")
    when = field_value(s, "when", a.get("when") or "now")
    status = "proposed" if not r.person else field_value(s, "status", a.get("status") or "open")
    body = field_value(s, "body", a.get("body") or "")
    nxt = field_value(s, "next", a.get("next") or "")
    parent = field_value(s, "parent", a.get("parent"), r.ctx) if a.get("parent") else None
    e = ev.ItemAdded(n=s.max_n + 1, by=r.by, title=title, src=a.get("src") or r.ctx.src, type=kind, pri=pri, when=when,
                     status=status, body_text=body, next=nxt, parent=parent, keep=r.keep())
    if r.by == "org" and e.status == "review":  # only an agent finishing its work puts an item in review
        e.status = "open"
    r.emit(e)
    r.ctx.last = e.n
    proposed = " (proposed: the user approves it before anyone works on it)" if e.status == "proposed" else ""
    return Outcome(f"ok {s.code(e.n)} new{proposed}", "Created " + s.code(e.n))


def cascade(r: Run, it: Item, f: Dict[str, Any], was: Dict[str, Any], src: Optional[str]) -> None:
    """What you do to an item is done to the items under it: put Later, they go Later; marked won't do, the
    unfinished ones too; archived, the finished ones too. Each such change says which item it followed, so putting
    that item back puts back only the ones that followed it."""
    s = r.state
    for k in descendants(s, it.n):
        g: Dict[str, Any] = {}
        if "when" in f:
            if f["when"] == "later" and k.status not in CLOSED and k.when != "later":
                g["when"] = "later"
            elif f["when"] != "later" and k.when == "later" and followed(s, k, "when")[0] == it.n:
                g["when"] = f["when"]
        if "status" in f:
            if f["status"] == "dropped" and k.status not in CLOSED:
                g["status"] = "dropped"
            elif was.get("status") == "dropped" and f["status"] not in CLOSED and k.status == "dropped":
                by_it, before = followed(s, k, "status")
                if by_it == it.n and before:
                    g["status"] = before
        if "archived" in f:
            if f["archived"] and k.status in CLOSED and not k.archived:
                g["archived"] = True
            elif not f["archived"] and k.archived and followed(s, k, "archived")[0] == it.n:
                g["archived"] = False
        if g:
            r.emit(ev.FieldsSet(n=k.n, by=r.by, f=g, was={x: k.get(x) for x in g}, src=src, cascade=it.n,
                                        keep=r.keep()))


def _src(r: Run, a: Args) -> Optional[str]:
    return a.get("src") or r.ctx.src


@handles("set")
def set_fields(r: Run, a: Args) -> Outcome:
    s = r.state
    it = item_at(s, a.get("ref", ""), r.ctx)
    code = s.code(it.n)
    f: Dict[str, Any] = {}
    was: Dict[str, Any] = {}
    for k, v in dict(a.get("f") or {}).items():
        v = field_value(s, k, v, r.ctx, it)
        if v != it.get(k):
            f[k], was[k] = v, it.get(k)
    note = ""
    if r.by == "org" and f.get("status") == "review":  # the organizer writes down what you said; it finishes no work
        raise Refused(f"{code}: only an agent that did the work puts it in review; to close it, set it done")
    if not r.person and "status" in f:
        if it.status == "proposed" and f["status"] != "dropped":
            raise Refused(f"{code} is proposed: only the user can approve it. To move it on, answer them: `{code} say ...` "
                          f"or `{code} ask ...` puts it back in front of them to approve (B299)")
        if it.status == "dropped" and status_set_by(s, it) in PEOPLE:  # the user said no
            raise Refused(f"{code}: the user marked it won't do. Don't reopen or work on it; to ask, post "
                          f"`{code} ask <why it is worth doing>`")
        if f["status"] == "done":
            f["status"], note = "review", " (the user accepts it to make it done)"
            if it.status == "review":
                del f["status"], was["status"]
    status = f.get("status", it.status)
    # any item can be archived, in any state; only setting it open again brings it back
    if it.archived and "status" in f and status not in CLOSED and "archived" not in f:
        f["archived"], was["archived"] = False, True
    src = _src(r, a)
    if not f:
        if not r.person and (a.get("f") or {}).get("status") == "done" and it.status == "review" and replied(it):
            r.emit(ev.MessagePosted(n=it.n, by=r.by, kind="progress", text="Ready for your review again.", src=src,
                                            keep=r.keep()))
            return Outcome(f"ok {code} back with the user for review (to say what changed, post `{code} progress ...`)",
                           "Updated " + code)
        return Outcome(f"ok {code} no change{note}", "")
    if not r.person and f.get("status") in ("review", "done"):
        left = open_kids(s, it)
        if left:
            note += f" (note: its subitems {' '.join(s.code(k.n) for k in left)} are not finished yet)"
    r.emit(ev.FieldsSet(n=it.n, by=r.by, f=f, was=was, src=src, keep=r.keep(), undo_of=a.get("undo_of") or None))
    if r.person:  # what you do from the page goes to the subitems; an agent's changes stay as they were
        cascade(r, it, f, was, src)
    said = " ".join(f"{k}={v}" if k in ("pri", "when", "status", "type", "parent", "archived") else k for k, v in f.items())
    return Outcome(f"ok {code} {said}{note}{r.gone_note(it)}", "Updated " + code)


def _message_files(r: Run, a: Args) -> List[FileRef]:
    """Images or other files shown with a message, uploaded first with POST /api/file."""
    files: List[FileRef] = []
    for f_ in a.get("files") or []:
        fid = os.path.basename(str(f_.get("f", "") if isinstance(f_, dict) else f_))
        if not r.project.file_exists(fid):
            if r.by == "org":  # the organizer took a link in your words for a file: the link stays in the text
                continue
            raise Refused(f"unknown file {fid}: upload it first with POST /api/file?name=<name>")
        files.append(FileRef(f=fid, name=fid.split("-", 1)[-1], mime=mimetypes.guess_type(fid)[0] or "application/octet-stream"))
    return files


@handles("say")
def say(r: Run, a: Args) -> Outcome:
    s = r.state
    it = item_at(s, a.get("ref", ""), r.ctx)
    code = s.code(it.n)
    kind = a.get("kind", "say")
    if kind not in MESSAGE_KINDS:
        raise Refused(f"kind must be one of {'/'.join(MESSAGE_KINDS)}")
    text = str(a.get("text", "")).strip()[:MAX_TEXT]
    if not text:
        raise Refused("empty text")
    files = _message_files(r, a)
    src = _src(r, a)
    if r.by == "org" and src in s.inputs:  # what the organizer files from your input keeps its files and links
        inp = s.inputs[str(src)]
        have = {x.f for x in files}
        files += [FileRef(f=x.f, name=x.name, mime=x.mime) for x in inp.files if x.f not in have]
        links = [u for u in re.findall(r"https?://\S+", inp.text or "") if u not in text]
        if links:
            text += "\n\n" + "\n".join(links)
    to, unknown = r.project.mentions(text) if not r.person else ([], [])
    to = [x for x in to if not r.session or _key(x) != _key(r.session)]  # not to itself
    r.emit(ev.MessagePosted(n=it.n, by=r.by, kind=kind, text=text, src=src, files=files, to=to, keep=r.keep()))
    sent = (" → " + ", ".join(to)) if to else ""
    if unknown:
        sent += (f" ({', '.join(unknown)}: no session by that name has called Taska yet; it hears this once it calls "
                 "with session=<that name>)")
    label = {"ask": "Asked on ", "block": "Blocked on ", "decide": "Decided on "}.get(kind, "Noted on ") + code
    return Outcome(f"ok {code} {kind}{sent}{r.gone_note(it)}", label)


def _key(name: object) -> str:
    return "-".join(str(name).lower().split())


@handles("merge")
def merge(r: Run, a: Args) -> Outcome:
    s = r.state
    it = item_at(s, a.get("ref", ""), r.ctx)
    code = s.code(it.n)
    into = item_at(s, a.get("into", ""), r.ctx)
    if into.n == it.n:
        raise Refused("cannot merge into itself")
    kids = [k for k in s.items.values() if k.parent == it.n and k.live]
    src = _src(r, a)
    r.emit(ev.ItemMerged(n=it.n, into=into.n, by=r.by, src=src, keep=r.keep()))
    for k in kids if r.person else []:  # its subitems go under what it was merged into (your merges)
        if k.n != into.n:
            r.emit(ev.FieldsSet(n=k.n, by=r.by, f={"parent": into.n}, was={"parent": it.n}, src=src,
                                        cascade=it.n, keep=r.keep()))
    return Outcome(f"ok {code} merged into {s.code(into.n)}{r.gone_note(it)}", f"Merged {code}")


@handles("archive")
def archive(r: Run, a: Args) -> Outcome:
    """Many items in one change: the page's "Archive N" and its Undo, any number."""
    s = r.state
    on = bool(a.get("on", True))
    ns: List[int] = []
    skip: List[str] = []
    for ref in a.get("refs") or []:
        it = item_at(s, ref, r.ctx, follow=False)
        if it.archived == on or it.n in ns:
            continue
        if on and it.status not in CLOSED:
            skip.append(s.code(it.n))
            continue
        ns.append(it.n)
    word = "archived" if on else "unarchived"
    asked = len(ns)
    follow: Dict[str, int] = {}  # the subitems that go along, and which item each followed
    for n in list(ns) if r.person else []:
        if on:
            kids = [k for k in descendants(s, n) if k.status in CLOSED and not k.archived]
        else:
            last = last_archive(s, n)
            kids = [s.items[int(k)] for k, p in (last.follow if last else {}).items()
                    if p == n and int(k) in s.items and s.items[int(k)].archived]
        for k in kids:
            if k.n not in ns:
                ns.append(k.n)
                follow[str(k.n)] = n
    if ns:
        r.emit(ev.ItemsArchived(ns=ns, on=on, by=r.by, follow=follow))
    left = f"; not finished, so not archived: {' '.join(skip)}" if skip else ""
    return Outcome(f"ok {word} {asked}{left}", f"{word.capitalize()} {asked}")


@handles("idel", "iundel")
def delete_item(r: Run, a: Args) -> Outcome:
    s = r.state
    it = item_at(s, a.get("ref"), r.ctx, follow=False)
    code = s.code(it.n)
    if a.name == "iundel":
        g = next((g for g in reversed(s.deleted_groups) if it.n in g.ns), None)
        if not g:
            raise Refused(f"{code} is not deleted")
        r.emit(ev.ItemsRestored(ns=g.ns, by=r.by))
        return Outcome(f"ok {code} restored", f"Restored {code}")
    if it.deleted:
        raise Refused(f"{code} is deleted already")
    ns: List[int] = []
    todo = [it.n]
    while todo:  # its subitems go with it
        n = todo.pop()
        ns.append(n)
        todo += [k.n for k in s.items.values() if k.parent == n and k.live]
    r.emit(ev.ItemsDeleted(ns=ns, by=r.by))
    more = f" with {len(ns) - 1} subitems" if len(ns) > 1 else ""
    return Outcome(f"ok {code} deleted{more}", f"Deleted {code}")


@handles("hide")
def hide(r: Run, a: Args) -> Outcome:
    s = r.state
    it = item_at(s, a.get("ref"), r.ctx)
    mid, on = a.number("id"), a.on()
    x = next((x for x in it.thread if x.id == mid), None)
    if not x or x.by in PEOPLE:
        raise Refused("only an agent's message can be hidden")
    r.emit(ev.MessageHidden(n=it.n, id=mid, on=on, by=r.by))
    return Outcome(f"ok {'hidden' if on else 'shown'}", f"{'Hid' if on else 'Showed'} a message on {s.code(it.n)}")
