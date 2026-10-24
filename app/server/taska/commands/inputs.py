"""Commands on what you said: a new input or a reply, fixing or adding to one, marking inputs handled, deleting and
restoring one, moving one to another item, taking a file off one."""

from __future__ import annotations

import os
from typing import List

from ..domain import events as ev
from ..domain.history import deletions
from ..domain.model import FileRef
from ..domain.rules import item_at
from ..domain.vocab import MAX_TEXT, PEOPLE, Refused
from .base import Args, Outcome, Run, handles


def sent_files(r: Run, a: Args) -> List[FileRef]:
    """The uploaded files a command brings along, checked to exist."""
    files: List[FileRef] = []
    for f in a.get("files") or []:
        fid = os.path.basename(str(f.get("f", "")))
        if not r.project.file_exists(fid):
            raise Refused(f"unknown file {fid}")
        files.append(FileRef(f=fid, name=str(f.get("name", "")) if "name" in f else "", mime=f.get("mime"),
                             size=f.get("size"), tr=f.get("tr")))
    return files


@handles("input")
def new_input(r: Run, a: Args) -> Outcome:
    s = r.state
    q = a.text("q")[:64]
    if q in s.page_ids:  # the page sent it again because the answer got lost: it is in already
        return Outcome(f"ok {s.page_ids[q]}", "Received")
    text, files = r.project.with_words(a.text("text").strip(), sent_files(r, a))
    text = text[:MAX_TEXT]
    if not text and not files:
        raise Refused("empty input")
    scope = item_at(s, a.get("scope")).n if a.get("scope") else None  # a merged item's replies go where it went
    rid = f"r{s.max_input + 1}"
    answer = a.get("kind") == "answer" and scope is not None  # a form you sent: it goes to its item as it is
    r.emit(ev.InputAdded(id=rid, by=r.by, text=text, scope=scope, files=files, q=q,
                                 kind="answer" if answer else None))
    return Outcome(f"ok {rid}", "Received")


@handles("correct")
def correct(r: Run, a: Args) -> Outcome:
    """The wrong words in an input, fixed there and remembered for every project."""
    rid = a.text("id")
    inp = r.state.inputs.get(rid)
    if not inp:
        raise Refused(f"unknown input {rid}")
    wrong, right = " ".join(a.text("wrong").split()), " ".join(a.text("right").split())
    if not wrong or wrong not in inp.text:
        raise Refused(f"{rid} does not say that")
    r.project.remember_spelling(wrong, right)
    r.project.note_voice_fix(wrong, right, inp, r.by)
    return amend(r, Args({"op": "amend", "id": rid, "mode": "edit", "v": a.get("v"), "text": inp.text.replace(wrong, right)}))


@handles("amend")
def amend(r: Run, a: Args) -> Outcome:
    s = r.state
    rid = a.text("id")
    inp = s.inputs.get(rid)
    if not inp:
        raise Refused(f"unknown input {rid}")
    if inp.moved or r.project.is_moving(rid):
        raise Refused("this input has moved; edit it in the destination project")
    if inp.deleted:
        raise Refused(f"{rid} is deleted; restore it first (Settings, Deleted)")
    mode = a.get("mode")
    if mode not in ("edit", "append"):
        raise Refused("choose edit or append")
    # an append goes after whatever is there by then (words transcribed meanwhile are no reason to refuse it)
    if mode == "edit" and a.get("v") != inp.v:
        raise Refused("this input changed in another window; reopen it before saving")
    text, files = r.project.with_words(a.text("text").strip(), sent_files(r, a))
    if not text and not files:
        raise Refused("enter some text")
    if mode == "append":
        text = (inp.text + ("\n\n" + text if text else "")).strip()
    if len(text) > MAX_TEXT:
        raise Refused(f"input is too long (maximum {MAX_TEXT} characters)")
    if text == inp.text and not files:
        return Outcome(f"ok {rid} unchanged", "Unchanged")
    r.emit(ev.InputAmended(src=rid, mode=str(mode), text=text, by=r.by, files=files))
    return Outcome(f"ok {rid} updated", "Updated")


@handles("ack")
def ack(r: Run, a: Args) -> Outcome:
    asked = list(a.get("ids", []))
    ids = [i for i in asked if i in r.state.inputs]
    bad = [i for i in asked if i not in r.state.inputs]
    if bad:
        raise Refused(f"unknown input {' '.join(bad)}")
    r.emit(ev.InputsAcked(ids=ids, by=r.by))
    return Outcome("ok ack " + " ".join(ids), "")


@handles("delete", "restore")
def delete_input(r: Run, a: Args) -> Outcome:
    """An input to Deleted with the items only it made, and back."""
    s = r.state
    rid = a.text("id")
    inp = s.inputs.get(rid)
    if not inp:
        raise Refused(f"unknown input {rid}")
    if r.by not in PEOPLE:
        raise Refused("only the user deletes inputs")
    if a.name == "restore":
        gone = inp.deleted
        if not gone:
            raise Refused(f"{rid} is not deleted")
        r.emit(ev.InputRestored(src=rid, ns=list(gone.ns), by=r.by))
        with_ = (" with " + " ".join(s.code(n) for n in gone.ns)) if gone.ns else ""
        return Outcome(f"ok {rid} restored{with_}", f"Restored {rid}")
    if inp.deleted:
        raise Refused(f"{rid} is deleted already")
    if inp.moved or r.project.is_moving(rid):
        raise Refused(f"{rid} has moved to another project; delete it there")
    plan = deletions(s, [rid]).get(rid)
    go, keep = (plan.go, plan.keep) if plan else ([], [])
    r.emit(ev.InputDeleted(src=rid, ns=go, kept=keep, by=r.by))
    with_ = (" with " + " ".join(s.code(n) for n in go)) if go else ""
    kept = ("; kept " + ", ".join(f"{s.code(n)} ({why})" for n, why in keep)) if keep else ""
    return Outcome(f"ok {rid} deleted{with_}{kept}", f"Deleted {rid}")


@handles("rescope")
def rescope(r: Run, a: Args) -> Outcome:
    s = r.state
    inp = s.inputs.get(a.text("id"))
    if not inp:
        raise Refused("no such input")
    it = item_at(s, a.get("to"), r.ctx)
    r.emit(ev.InputRescoped(src=inp.id, to=it.n, by=r.by))
    return Outcome(f"ok {inp.id} now goes with {s.code(it.n)}", f"Moved {inp.id} to {s.code(it.n)}")
