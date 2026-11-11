"""Commands on what you said: a new input or a reply, fixing or adding to one, marking inputs handled, deleting and
restoring one, moving one to another item, taking a file off one, sending a cancelled recording after all."""

from __future__ import annotations

import os
from typing import Iterable, List, Optional

from ..domain import events as ev
from ..domain.history import deletions
from ..domain.model import FileRef
from ..domain.rules import item_at
from ..domain.state import ProjectState
from ..domain.vocab import MAX_TEXT, PEOPLE, Refused
from ..domain.voices import words_of
from .base import Args, Outcome, Run, handles


def sent_files(r: Run, a: Args) -> List[FileRef]:
    """The uploaded files a command brings along, checked to exist."""
    files: List[FileRef] = []
    for f in a.get("files") or []:
        fid = os.path.basename(str(f.get("f", "")))
        if not r.project.file_exists(fid):
            raise Refused(f"unknown file {fid}")
        files.append(FileRef(f=fid, name=str(f.get("name", "")) if "name" in f else "", mime=f.get("mime"),
                             size=f.get("size")))
    return files


def voice_words(r: Run, a: Args, notes: Iterable[str], src: Optional[str] = None) -> List[ev.VoiceFixed]:
    """The words of voice notes as you left them (in the box before sending, editing what you said: `words`, {file:
    words}) -> the changes that make them a note's words, in its one record, wherever it shows (B682), for the
    notes whose words you changed. Words the page was given for a note (its first, its final ones) change nothing."""
    given = a.get("words") or {}
    if not isinstance(given, dict):
        raise Refused("words: expected {file: words}")
    mine = set(notes)
    out: List[ev.VoiceFixed] = []
    for fid, words in given.items():
        words = str(words or "").strip()[:MAX_TEXT]
        if fid not in mine or not words:
            continue
        v = r.state.voices.get(fid)
        if v and words in {x.strip() for x in (v.tidied, v.early, v.said) if x}:
            continue
        out.append(ev.VoiceFixed(f=fid, tidied=words, src=src, by=r.by))
    return out


def answered_of(s: ProjectState, n: Optional[int], of: object) -> List[int]:
    """An answer to some of the questions in a row (B749): the ids of the item's questions it answers, each one an
    agent's ask on that item; the others keep waiting. None given: it answers them all, as anything you say does."""
    if not of:
        return []
    if not isinstance(of, list) or not all(isinstance(x, int) for x in of):
        raise Refused("of: expected the ids of the questions answered")
    asks = {x.id for x in s.items[n].thread if x.kind == "ask"} if n is not None else set()
    bad = [x for x in of if x not in asks]
    if bad:
        raise Refused(f"of: {bad[0]} is not a question on this item")
    return list(dict.fromkeys(of))


@handles("input")
def new_input(r: Run, a: Args) -> Outcome:
    s = r.state
    q = a.text("q")[:64]
    if q in s.page_ids:  # the page sent it again because the answer got lost: it is in already
        return Outcome(f"ok {s.page_ids[q]}", "Received")
    text, files = a.text("text").strip()[:MAX_TEXT], sent_files(r, a)
    if not text and not files:
        raise Refused("empty input")
    scope = item_at(s, a.get("scope")).n if a.get("scope") else None  # a merged item's replies go where it went
    rid = f"r{s.max_input + 1}"
    answer = a.get("kind") == "answer" and scope is not None  # a form you sent: it goes to its item as it is
    cancelled = a.get("kind") == "cancelled"  # a recording you cancelled: kept, not sent to anyone (B627)
    if cancelled and scope is not None:
        raise Refused("only a new input can be kept as cancelled")
    of = answered_of(s, scope, a.get("of")) if answer else []
    r.emit(ev.InputAdded(id=rid, by=r.by, text=text, scope=scope, files=files, q=q,
                         kind="answer" if answer else "cancelled" if cancelled else None, of=of))
    for fix in voice_words(r, a, (f.f for f in files), rid):
        r.emit(fix)
    if cancelled:
        return Outcome(f"ok {rid} kept as cancelled", "Kept in Inputs")
    # words on an item that waits for review, not Accept, take it back to open (Yadong r961: open is the agent's turn;
    # in progress only while an agent works on it); so do words on an item already done (r1082: replying to a done
    # item means it is not done)
    it = s.items.get(scope) if scope is not None else None
    if it is not None and it.status in ("review", "done") and r.by == "you":
        r.emit(ev.FieldsSet(n=it.n, by=r.by, f={"status": "open"}, was={"status": it.status}, src=rid))
    return Outcome(f"ok {rid}", "Received")


@handles("send")
def send(r: Run, a: Args) -> Outcome:
    """A cancelled recording sent after all (B627): the organizer and the agents get it as a new input."""
    rid = a.text("id")
    inp = r.state.inputs.get(rid)
    if not inp:
        raise Refused(f"unknown input {rid}")
    if r.by not in PEOPLE:
        raise Refused("only the user sends a cancelled input")
    if inp.kind != "cancelled":
        raise Refused(f"{rid} was sent already")
    if inp.deleted:
        raise Refused(f"{rid} is deleted; restore it first (Settings, Deleted)")
    if inp.moved or r.project.is_moving(rid):
        raise Refused(f"{rid} has moved to another project; send it there")
    r.emit(ev.InputSent(src=rid, by=r.by))
    return Outcome(f"ok {rid} sent", "Sent")


@handles("correct")
def correct(r: Run, a: Args) -> Outcome:
    """The wrong words in an input, fixed there and remembered for every project: in what was typed, or in one of
    its voice notes' words (then the note's words are yours, wherever it shows)."""
    rid = a.text("id")
    inp = r.state.inputs.get(rid)
    if not inp:
        raise Refused(f"unknown input {rid}")
    wrong, right = " ".join(a.text("wrong").split()), " ".join(a.text("right").split())
    note = next((f.f for f in inp.files if wrong and wrong in words_of(r.state, f.f)), None)
    if not wrong or (wrong not in inp.text and not note):
        raise Refused(f"{rid} does not say that")
    r.project.remember_spelling(wrong, right)
    r.project.note_voice_fix(wrong, right, inp, r.by)
    if wrong not in inp.text and note:
        if inp.moved or r.project.is_moving(rid):
            raise Refused("this input has moved; edit it in the destination project")
        r.emit(ev.VoiceFixed(f=note, tidied=words_of(r.state, note).replace(wrong, right), src=rid, by=r.by))
        return Outcome(f"ok {rid} updated", "Updated")
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
    text, files = a.text("text").strip(), sent_files(r, a)
    fixes = voice_words(r, a, [f.f for f in inp.files + files], rid)
    fixed = bool(fixes)
    if not text and not files and not fixed and not (mode == "edit" and inp.files):
        raise Refused("enter some text")
    if mode == "append":
        text = (inp.text + ("\n\n" + text if text else "")).strip()
    if len(text) > MAX_TEXT:
        raise Refused(f"input is too long (maximum {MAX_TEXT} characters)")
    for fix in fixes:
        r.emit(fix)
    if text == inp.text and not files:
        return Outcome(f"ok {rid} {'updated' if fixed else 'unchanged'}", "Updated" if fixed else "Unchanged")
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
    if inp.kind == "cancelled":
        raise Refused(f"{inp.id} was not sent; send it first")
    it = item_at(s, a.get("to"), r.ctx)
    r.emit(ev.InputRescoped(src=inp.id, to=it.n, by=r.by))
    return Outcome(f"ok {inp.id} now goes with {s.code(it.n)}", f"Moved {inp.id} to {s.code(it.n)}")
