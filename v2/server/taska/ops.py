"""Changes to a project: every op is checked here, then written as an event (Store.emit).

The page sends ops as JSON (/api/op); agents write commands (/do) that dsl.parse_dsl turns into the same ops. Each
op returns a short line for the agent ("ok F12 status=review") and a label for the organizer's summary.
"""

from __future__ import annotations

import mimetypes
import os
import re
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple

from .core import (CLOSED, DOC_KEY, KINDS, LETTER, MAX_OPS, MAX_TEXT, PEOPLE, PRIS, STATUSES, WHENS, Err, Item, Op,
                   block_key, md_blocks, title_of)

if TYPE_CHECKING:
    from .store import Store



# B336 (R337): what you do to an item is done to the items under it, the way you would expect: put Later, they go
# Later; marked won't do, the unfinished ones too; archived, the finished ones too; merged, they move under what it
# was merged into. Each such change says which item it followed (cascade), so putting that item back (Now again,
# reopened, unarchived) puts back only the ones that followed it, not ones you changed yourself.
def descendants(s: "Store", n: int) -> List[Item]:
    out: List[Item] = []
    todo = [n]
    while todo:
        m = todo.pop()
        for k in s.items.values():
            if k.get("parent") == m and not k.get("deleted") and not k["merged_into"]:
                out.append(k)
                todo.append(k["n"])
    return out


def followed(s: "Store", k: Item, field_: str) -> Tuple[Optional[int], Any]:
    """The item k's last change of `field_` followed (or None), and what the field was before it."""
    for e in reversed(s.events):
        if e.get("k") == "set" and e.get("n") == k["n"] and field_ in e.get("f", {}):
            return e.get("cascade"), e.get("was", {}).get(field_)
    return None, None


def cascade(s: "Store", it: Item, f: Dict[str, Any], was: Dict[str, Any], by: str, src: Optional[str], keep: Dict[str, Any]) -> None:
    for k in descendants(s, it["n"]):
        g: Dict[str, Any] = {}
        if "when" in f:
            if f["when"] == "later" and k["status"] not in CLOSED and k["when"] != "later":
                g["when"] = "later"
            elif f["when"] != "later" and k["when"] == "later" and followed(s, k, "when")[0] == it["n"]:
                g["when"] = f["when"]
        if "status" in f:
            if f["status"] == "dropped" and k["status"] not in CLOSED:
                g["status"] = "dropped"
            elif was.get("status") == "dropped" and f["status"] not in CLOSED and k["status"] == "dropped":
                by_it, before = followed(s, k, "status")
                if by_it == it["n"] and before:
                    g["status"] = before
        if "archived" in f:
            if f["archived"] and k["status"] in CLOSED and not k.get("archived"):
                g["archived"] = True
            elif not f["archived"] and k.get("archived") and followed(s, k, "archived")[0] == it["n"]:
                g["archived"] = False
        if g:
            s.emit({"k": "set", "n": k["n"], "by": by, "f": g, "was": {x: k.get(x) for x in g}, "src": src, "cascade": it["n"], **keep})

def was_by(s: "Store", it: Item) -> Optional[str]:
    """Who last set an item's status (F197): an agent may not reopen what the user dropped."""
    for e in reversed(s.events):
        if e.get("n") == it["n"] and e["k"] == "set" and "status" in (e.get("f") or {}) and not isinstance(e.get("f"), str):
            return e.get("by")
        if e.get("n") == it["n"] and e["k"] == "add":
            return e.get("by")
    return None


def field(s: "Store", f: str, v: Any, ctx: Optional[Dict[str, Any]] = None, me: Optional[Item] = None) -> Any:
    if f == "type":
        v = str(v).lower()
        if v not in LETTER:
            raise Err(f"type must be one of {'/'.join(LETTER)}")
    elif f == "pri":
        v = str(v).upper()
        if v not in PRIS:
            raise Err("pri must be P0-P3")
    elif f == "when":
        v = str(v).lower()
        if v not in WHENS:
            raise Err("when must be now/later")
    elif f == "status":
        v = {"drop": "dropped"}.get(str(v).lower(), str(v).lower())
        if v not in STATUSES:
            raise Err("status must be open/doing/review/done/dropped (proposed is set for you)")
    elif f == "title":
        v = " ".join(str(v).split())
        if not v:
            raise Err("empty title")
        v = v[:300]
    elif f in ("body", "next"):
        v = str(v).strip()[:MAX_TEXT]
    elif f == "archived":
        v = v if isinstance(v, bool) else str(v).lower() in ("1", "true", "yes", "on")
    elif f == "rank":  # F197: "do this next" puts it first in its priority (smaller goes first); none keeps the usual order
        if v is None or str(v).strip().lower() in ("", "-", "none", "null"):
            return None
        try:
            v = float(v)
        except ValueError:
            raise Err("rank must be a number, or - for the usual order")
    elif f == "parent":
        if str(v).strip().lower() in ("", "-", "none", "null"):
            return None
        p = s.item(v, ctx)
        if me is not None:
            up: Optional[Item] = p
            while up:
                if up["n"] == me["n"]:
                    raise Err("parent loop")
                up = s.items.get(up["parent"]) if up["parent"] is not None else None
        return p["n"]
    else:
        raise Err(f"unknown field '{f}'")
    return v


def op_files(s: "Store", op: Op) -> List[Dict[str, Any]]:
    """The uploaded files an op brings along, checked to exist."""
    files: List[Dict[str, Any]] = []
    for f in op.get("files") or []:
        fid = os.path.basename(str(f.get("f", "")))
        if not os.path.isfile(os.path.join(s.fdir, fid)):
            raise Err(f"unknown file {fid}")
        files.append({k: f[k] for k in ("f", "name", "mime", "size", "tr") if k in f})
        files[-1]["f"] = fid
    return files


def run(s: "Store", op: Op, by: str, ctx: Dict[str, Any]) -> Tuple[str, Any]:
    """Validate and apply one op. Returns (result line, label) or raises Err."""
    name, src = op.get("op"), op.get("src") or ctx.get("src")
    keep: Dict[str, Any] = {"keep": True} if ctx.get("keep") else {}  # linked to src, but src stays unhandled
    if src and src not in s.inputs:
        raise Err(f"unknown input {src}")
    if name == "input":
        q = str(op.get("q") or "")[:64]
        if q in s.qids:  # the page sent it again because the answer got lost: it is in already
            return f"ok {s.qids[q]}", "Received"
        files = op_files(s, op)
        text = s.with_words(str(op.get("text") or "").strip(), files)[:MAX_TEXT]
        if not text and not files:
            raise Err("empty input")
        scope = s.item(op["scope"])["n"] if op.get("scope") else None  # a merged item's replies go where it went (B5)
        rid = f"r{s.nin + 1}"
        e: Dict[str, Any] = {"k": "in", "id": rid, "by": by, "text": text, "scope": scope, "files": files}
        if q:
            e["q"] = q
        if op.get("kind") == "answer" and scope is not None:
            e["kind"] = "answer"  # F419: a form you sent (an answer to a question, a document's choices): it goes to its item as it is
        s.emit(e)
        return f"ok {rid}", "Received"
    if name == "correct":  # F144: the wrong words in an input, fixed there and remembered for every project
        rid = str(op.get("id") or "")
        inp = s.inputs.get(rid)
        if not inp:
            raise Err(f"unknown input {rid}")
        wrong, right = " ".join(str(op.get("wrong") or "").split()), " ".join(str(op.get("right") or "").split())
        if not wrong or wrong not in inp["text"]:
            raise Err(f"{rid} does not say that")
        if s.hub:
            s.hub.correct(wrong, right)
        op, name = {"op": "amend", "id": rid, "mode": "edit", "v": op.get("v"), "text": inp["text"].replace(wrong, right)}, "amend"
    if name == "amend":
        rid = str(op.get("id") or "")
        inp = s.inputs.get(rid)
        if not inp:
            raise Err(f"unknown input {rid}")
        if inp.get("moved") or inp.get("moving"):
            raise Err("this input has moved; edit it in the destination project")
        if inp.get("deleted"):
            raise Err(f"{rid} is deleted; restore it first (Settings, Deleted)")
        if op.get("v") != inp.get("v", 0):
            raise Err("this input changed in another window; reopen it before saving")
        mode = op.get("mode")
        if mode not in ("edit", "append"):
            raise Err("choose edit or append")
        files = op_files(s, op)
        text = s.with_words(str(op.get("text") or "").strip(), files)
        if not text and not files:
            raise Err("enter some text")
        if mode == "append":
            text = (inp["text"] + ("\n\n" + text if text else "")).strip()
        if len(text) > MAX_TEXT:
            raise Err(f"input is too long (maximum {MAX_TEXT} characters)")
        if text == inp["text"] and not files:
            return f"ok {rid} unchanged", "Unchanged"
        s.emit({"k": "amend", "src": rid, "mode": mode, "text": text, "by": by, **({"files": files} if files else {})})
        return f"ok {rid} updated", "Updated"
    if name == "doc":  # new document on an item, or new text for an existing one
        md = str(op.get("md") or "").strip()[:MAX_TEXT]
        if not md:
            raise Err("a document needs Markdown text (indented lines under the command)")
        first = " ".join(md.split("\n", 1)[0].lstrip("#").split())  # a document is a note: its first line is the title
        title = " ".join(str(op.get("title") or first or "Untitled").split())[:200]
        if op.get("title") and title != first[:200]:
            md = f"# {title}\n\n{md}"
        if op.get("d"):
            d = s.doc(op["d"])
            s.emit({"k": "doc", "d": d["d"], "n": d["n"], "title": title, "md": md, "by": by})
            return f"ok D{d['d']} updated" + s.gone_note(s.items.get(d["n"], {}), by), f"Updated D{d['d']}"
        it = s.item(op.get("ref", ""), ctx)
        dn = s.maxd + 1
        s.emit({"k": "doc", "d": dn, "n": it["n"], "title": title, "md": md, "by": by})
        return f"ok D{dn} new on {s.code(it['n'])}" + s.gone_note(it, by), f"Wrote D{dn}"
    if name == "dc":  # a comment on one paragraph of a document, or on all of it (key "doc", para 0: B247)
        d = s.doc(op.get("d"))
        blocks = md_blocks(d["md"])
        if str(op.get("para", "")) == "0" or op.get("key") == DOC_KEY:
            key, text_ = DOC_KEY, ""
        elif op.get("para"):
            k_ = int(op["para"])
            if not 1 <= k_ <= len(blocks):
                raise Err(f"D{d['d']} has paragraphs 1-{len(blocks)}")
            text_ = blocks[k_ - 1][1]
            key = block_key(text_)
        else:
            key = str(op.get("key", ""))
            found = next((t for _, t in blocks if block_key(t) == key), None)
            old = next((c for c in d["comments"] if c["key"] == key), None)
            if found is None and not old:
                raise Err("that paragraph is not in the document")
            text_ = found if found is not None else (old or {})["quote"]
        files = op_files(s, op)  # F184: a voice comment brings its recording; its words are in the text
        body = s.with_words(str(op.get("text", "")).strip(), files)[:MAX_TEXT]
        for f in files:  # words still to come stay with the recording: the page waits for them before it sends
            f.pop("wait", None)
        if not body and not files:
            raise Err("empty comment")
        quote = " ".join(str(op.get("quote") or "").split()) or text_  # what the user selected, else the paragraph
        s.emit({"k": "dc", "d": d["d"], "key": key, "quote": quote[:500], "text": body, "by": by, **({"files": files} if files else {})})
        return f"ok D{d['d']} comment" + s.gone_note(s.items.get(d["n"], {}), by), f"Commented on D{d['d']}"
    if name in ("idel", "iundel"):  # T257 #5
        it = s.item(op.get("ref"), ctx, follow=False)
        if name == "iundel":
            g = next((g for g in reversed(s.gone_items) if it["n"] in g["ns"]), None)
            if not g:
                raise Err(f"{s.code(it['n'])} is not deleted")
            s.emit({"k": "iundel", "ns": g["ns"], "by": by})
            return f"ok {s.code(it['n'])} restored", f"Restored {s.code(it['n'])}"
        if it.get("deleted"):
            raise Err(f"{s.code(it['n'])} is deleted already")
        ns: List[int] = []
        todo = [it["n"]]
        while todo:  # its subitems go with it
            n = todo.pop()
            ns.append(n)
            todo += [k["n"] for k in s.items.values() if k["parent"] == n and not k.get("deleted") and not k["merged_into"]]
        s.emit({"k": "idel", "ns": ns, "by": by})
        return f"ok {s.code(it['n'])} deleted" + (f" with {len(ns) - 1} subitems" if len(ns) > 1 else ""), f"Deleted {s.code(it['n'])}"
    if name == "ddel":  # T257 #8
        d = s.doc(op.get("d"))
        on = op.get("on", True) not in (False, "0", "false", 0)
        s.emit({"k": "ddel", "d": d["d"], "on": on, "by": by})
        return f"ok D{d['d']} {'deleted' if on else 'restored'}", f"{'Deleted' if on else 'Restored'} D{d['d']}"
    if name == "dmove":  # T257 #9
        d, it = s.doc(op.get("d")), s.item(op.get("to"), ctx)
        s.emit({"k": "dmove", "d": d["d"], "to": it["n"], "by": by})
        return f"ok D{d['d']} now on {s.code(it['n'])}", f"Moved D{d['d']} to {s.code(it['n'])}"
    if name == "dcmove":  # T257 #10
        d = s.doc(op.get("d"))
        cid, key = int(op.get("id") or 0), str(op.get("key") or "")
        c = next((c for c in d["comments"] if c["id"] == cid), None)
        if not c:
            raise Err(f"D{d['d']} has no comment {cid}")
        blocks_by = {b["key"]: b for b in s.doc_view(d)[0]}
        if key != DOC_KEY and key not in blocks_by:
            raise Err(f"D{d['d']} has no such paragraph")
        s.emit({"k": "dcmove", "d": d["d"], "id": cid, "key": key, "quote": "" if key == DOC_KEY else " ".join(blocks_by[key]["text"].split())[:500], "by": by})
        return f"ok D{d['d']} comment {cid} moved", f"Moved a comment on D{d['d']}"
    if name == "unfile":  # T257 #11
        f_ = str(op.get("f") or "")
        if op.get("d"):
            d = s.doc(op.get("d"))
            cid = int(op.get("id") or 0)
            c = next((c for c in d["comments"] if c["id"] == cid), None)
            if not c or not any(x["f"] == f_ for x in c.get("files", [])):
                raise Err("no such file on that comment")
            if c["by"] not in PEOPLE:
                raise Err("only files you sent can be taken off")
            s.emit({"k": "unfile", "d": d["d"], "id": cid, "f": f_, "by": by})
        else:
            inp = s.inputs.get(str(op.get("id") or ""))
            if not inp or not any(x["f"] == f_ for x in inp["files"]):
                raise Err("no such file on that input")
            s.emit({"k": "unfile", "src": inp["id"], "f": f_, "by": by})
        return "ok file taken off", "Took off a file"
    if name == "hide":  # T257 #12
        it = s.item(op.get("ref"), ctx)
        mid, on = int(op.get("id") or 0), op.get("on", True) not in (False, "0", "false", 0)
        x = next((x for x in it["thread"] if x["id"] == mid), None)
        if not x or x["by"] in PEOPLE:
            raise Err("only an agent's message can be hidden")
        s.emit({"k": "hide", "n": it["n"], "id": mid, "on": on, "by": by})
        return f"ok {'hidden' if on else 'shown'}", f"{'Hid' if on else 'Showed'} a message on {s.code(it['n'])}"
    if name == "rescope":  # T257 #7
        inp = s.inputs.get(str(op.get("id") or ""))
        if not inp:
            raise Err("no such input")
        it = s.item(op.get("to"), ctx)
        s.emit({"k": "rescope", "src": inp["id"], "to": it["n"], "by": by})
        return f"ok {inp['id']} now goes with {s.code(it['n'])}", f"Moved {inp['id']} to {s.code(it['n'])}"
    if name == "dcres":  # T274 #2: resolve a comment thread, or open it again
        d = s.doc(op.get("d"))
        key, on = str(op.get("key") or ""), op.get("on", True) not in (False, "0", "false", 0)
        if not any(c["key"] == key for c in d["comments"]):
            raise Err(f"D{d['d']} has no thread {key!r}")
        s.emit({"k": "dcres", "d": d["d"], "key": key, "on": on, "by": by})
        return f"ok D{d['d']} thread {'resolved' if on else 'open again'}", f"{'Resolved' if on else 'Reopened'} a thread on D{d['d']}"
    if name in ("dcedit", "dcdel", "dcundel"):  # B258: you change or delete a comment of yours, or bring it back
        d = s.doc(op.get("d"))
        cid = int(op.get("id") or 0)
        c = (d.get("gone") or {}).get(cid) if name == "dcundel" else next((c for c in d["comments"] if c["id"] == cid), None)
        if not c:
            raise Err(f"D{d['d']} has no comment {cid}" + (" to restore" if name == "dcundel" else ""))
        if by not in PEOPLE or (name == "dcedit" and c["by"] not in PEOPLE):
            raise Err("only the user deletes comments, and edits only their own")  # F262: an agent's comment can go too
        if name == "dcedit":
            files = op_files(s, op)  # T257 #3: files added while editing go with it
            text_ = s.with_words(str(op.get("text") or "").strip(), files)[:MAX_TEXT]
            if not text_ and not c.get("files") and not files:
                raise Err("empty comment: delete it instead")
            s.emit({"k": "dcedit", "d": d["d"], "id": cid, "text": text_, "by": by, **({"files": files} if files else {})})
            return f"ok D{d['d']} comment {cid} edited", f"Edited a comment on D{d['d']}"
        s.emit({"k": name, "d": d["d"], "id": cid, "by": by})
        return f"ok D{d['d']} comment {cid} {'deleted' if name == 'dcdel' else 'restored'}", f"{'Deleted' if name == 'dcdel' else 'Restored'} a comment on D{d['d']}"
    if name == "cfg":
        if "auto" in op and "name" not in op:  # T260: there is no switch any more
            return f"ok {s.mode()} (always on)", ""
        f: Dict[str, Any] = {}
        if "name" in op:  # the project's name for people (F173); its address stays
            f["name"] = title_of(op["name"])
        if not f:
            raise Err("cfg needs auto or name")
        s.emit({"k": "cfg", "f": f, "by": by})
        return f"ok {s.mode()}" if "auto" in f else f"ok named {f['name']}", ""
    if name == "ack":
        ids = [i for i in op.get("ids", []) if i in s.inputs]
        bad = [i for i in op.get("ids", []) if i not in s.inputs]
        if bad:
            raise Err(f"unknown input {' '.join(bad)}")
        s.emit({"k": "ack", "ids": ids, "by": by})
        return "ok ack " + " ".join(ids), ""
    if name == "new":
        title = field(s, "title", op.get("title", ""))
        e = {"k": "add", "n": s.maxn + 1, "by": by, "title": title, "src": src,
             "type": field(s, "type", op.get("type") or "idea"), "pri": field(s, "pri", op.get("pri") or "P2"),
             "when": field(s, "when", op.get("when") or "now"),
             "status": "proposed" if by not in PEOPLE else field(s, "status", op.get("status") or "open"),
             "body": field(s, "body", op.get("body") or ""), "next": field(s, "next", op.get("next") or "")}
        e["parent"] = field(s, "parent", op["parent"], ctx) if op.get("parent") else None
        s.emit({**e, **keep})
        ctx["last"] = e["n"]
        return f"ok {s.code(e['n'])} new" + (" (proposed: the user approves it before anyone works on it)" if e["status"] == "proposed" else ""), "Created " + s.code(e["n"])
    if name == "archive":  # many items in one change (T113 A5): the page's "Archive N" and its Undo, any number
        on = bool(op.get("on", True))
        ns = []
        skip: List[str] = []
        for r in op.get("refs") or []:
            it = s.item(r, ctx, follow=False)
            if it["archived"] == on or it["n"] in ns:
                continue
            if on and it["status"] not in CLOSED:
                skip.append(s.code(it["n"]))
                continue
            ns.append(it["n"])
        word = "archived" if on else "unarchived"
        asked = len(ns)
        follow: Dict[str, int] = {}  # B336: the subitems that go along, and which item each followed
        for n in list(ns) if by in PEOPLE else []:
            if on:
                kids = [k for k in descendants(s, n) if k["status"] in CLOSED and not k.get("archived")]
            else:
                last = next((e for e in reversed(s.events) if e.get("k") == "arch" and e.get("on") and n in e.get("ns", [])), None)
                kids = [s.items[int(k)] for k, p in ((last or {}).get("follow") or {}).items()
                        if p == n and int(k) in s.items and s.items[int(k)].get("archived")]
            for k in kids:
                if k["n"] not in ns:
                    ns.append(k["n"])
                    follow[str(k["n"])] = n
        if ns:
            s.emit({"k": "arch", "ns": ns, "on": on, "by": by, **({"follow": follow} if follow else {})})
        return f"ok {word} {asked}" + (f"; not finished, so not archived: {' '.join(skip)}" if skip else ""), f"{word.capitalize()} {asked}"
    if name in ("delete", "restore"):  # F177: an input to Deleted with the items only it made, and back
        rid = str(op.get("id") or "")
        inp = s.inputs.get(rid)
        if not inp:
            raise Err(f"unknown input {rid}")
        if by not in PEOPLE:
            raise Err("only the user deletes inputs")
        if name == "restore":
            gone = inp.get("deleted")
            if not gone:
                raise Err(f"{rid} is not deleted")
            s.emit({"k": "undel", "src": rid, "ns": gone["ns"], "by": by})
            return f"ok {rid} restored" + (" with " + " ".join(s.code(n) for n in gone["ns"]) if gone["ns"] else ""), f"Restored {rid}"
        if inp.get("deleted"):
            raise Err(f"{rid} is deleted already")
        if inp.get("moved") or inp.get("moving"):
            raise Err(f"{rid} has moved to another project; delete it there")
        plan = s.deletions([rid]).get(rid, {"go": [], "keep": []})
        s.emit({"k": "del", "src": rid, "ns": plan["go"], "kept": plan["keep"], "by": by})
        return f"ok {rid} deleted" + (" with " + " ".join(s.code(n) for n in plan["go"]) if plan["go"] else "") \
            + ("; kept " + ", ".join(f"{s.code(n)} ({why})" for n, why in plan["keep"]) if plan["keep"] else ""), f"Deleted {rid}"
    if name == "unmake":  # undo "Make item" (T113 A7): the item goes (won't do, archived) and its input waits again
        it = s.item(op.get("ref", ""), ctx, follow=False)
        add = next((x for x in s.events if x["k"] == "add" and x["n"] == it["n"]), None)
        if not add or add.get("by") != "you" or not add.get("src"):
            raise Err(f"{s.code(it['n'])} was not made from an input")
        if s.touched_since(it["n"], add["seq"]):
            raise Err(f"{s.code(it['n'])} changed since it was made: set it to won't do instead")
        s.emit({"k": "unmake", "n": it["n"], "src": add["src"], "by": by})
        return f"ok {s.code(it['n'])} unmade", "Undid " + s.code(it["n"])
    it = s.item(op.get("ref", ""), ctx)
    code = s.code(it["n"])
    if name == "set":
        f = {}
        was: Dict[str, Any] = {}
        for k, v in op["f"].items():
            v = field(s, k, v, ctx, it)
            if v != it.get(k):
                f[k], was[k] = v, it.get(k)
        note = ""
        if by not in PEOPLE and "status" in f:
            if it["status"] == "proposed" and f["status"] != "dropped":
                raise Err(f"{code} is proposed: only the user can approve it. To move it on, answer them: `{code} say ...` or `{code} ask ...` puts it back in front of them to approve (B299)")
            if it["status"] == "dropped" and was_by(s, it) in PEOPLE:  # the user said no: an agent doesn't reopen it (F197)
                raise Err(f"{code}: the user marked it won't do. Don't reopen or work on it; to ask, post `{code} ask <why it is worth doing>`")
            if f["status"] == "done":
                f["status"], note = "review", " (the user accepts it to make it done)"
                if it["status"] == "review":
                    del f["status"], was["status"]
        status = f.get("status", it["status"])
        # F281: any item can be archived, in any state; only setting it open again brings it back
        if it.get("archived") and "status" in f and status not in CLOSED and "archived" not in f:
            f["archived"], was["archived"] = False, True  # reopening brings it back
        if not f:
            if by not in PEOPLE and op["f"].get("status") == "done" and it["status"] == "review" and s.replied(it):  # B299: done again after the user's reply: theirs to accept again
                s.emit({"k": "say", "n": it["n"], "by": by, "kind": "progress", "text": "Ready for your review again.", "src": src, **keep})
                return f"ok {code} back with the user for review (to say what changed, post `{code} progress ...`)", "Updated " + code
            return f"ok {code} no change{note}", ""
        if by not in PEOPLE and f.get("status") in ("review", "done"):
            left = s.open_kids(it)
            if left:
                note += f" (note: its subitems {' '.join(s.code(k['n']) for k in left)} are not finished yet)"
        s.emit({"k": "set", "n": it["n"], "by": by, "f": f, "was": was, "src": src, **keep, **({"undo_of": op["undo_of"]} if op.get("undo_of") else {})})
        if by in PEOPLE:  # B336: what you do from the page; an agent's changes stay as they were
            cascade(s, it, f, was, by, src, keep)
        return f"ok {code} " + " ".join(f"{k}={v}" if k in ("pri", "when", "status", "type", "parent", "archived") else k for k, v in f.items()) + note + s.gone_note(it, by), "Updated " + code
    if name == "say":
        kind = op.get("kind", "say")
        if kind not in KINDS:
            raise Err(f"kind must be one of {'/'.join(KINDS)}")
        text = str(op.get("text", "")).strip()[:MAX_TEXT]
        if not text:
            raise Err("empty text")
        files = []
        for f_ in op.get("files") or []:  # images or other files shown with the message, uploaded first with POST /api/file
            fid = os.path.basename(str(f_.get("f", "") if isinstance(f_, dict) else f_))  # pyright: ignore[reportUnknownMemberType]
            if not os.path.isfile(os.path.join(s.fdir, fid)):
                if by == "org":  # the organizer took a link in your words for a file (B172): the link stays in the text
                    continue
                raise Err(f"unknown file {fid}: upload it first with POST /api/file?name=<name>")
            files.append({"f": fid, "name": fid.split("-", 1)[-1], "mime": mimetypes.guess_type(fid)[0] or "application/octet-stream"})
        if by == "org" and src in s.inputs:  # R319: what the organizer files from your input keeps its pictures, voice notes and links
            have = {x["f"] for x in files}
            files += [{k: f_[k] for k in ("f", "name", "mime") if k in f_} for f_ in s.inputs[src].get("files", []) if f_.get("f") not in have]
            links = [u for u in re.findall(r"https?://\S+", s.inputs[src].get("text") or "") if u not in text]
            if links:
                text += "\n\n" + "\n".join(links)
        s.emit({"k": "say", "n": it["n"], "by": by, "kind": kind, "text": text, "src": src, **({"files": files} if files else {}), **keep})
        return f"ok {code} {kind}" + s.gone_note(it, by), {"ask": "Asked on ", "block": "Blocked on ", "decide": "Decided on "}.get(kind, "Noted on ") + code
    if name == "merge":
        into = s.item(op.get("into", ""), ctx)
        if into["n"] == it["n"]:
            raise Err("cannot merge into itself")
        kids = [k for k in s.items.values() if k.get("parent") == it["n"] and not k.get("deleted") and not k["merged_into"]]
        s.emit({"k": "merge", "n": it["n"], "into": into["n"], "by": by, "src": src, **keep})
        for k in kids if by in PEOPLE else []:  # B336: its subitems go under what it was merged into (your merges)
            if k["n"] != into["n"]:
                s.emit({"k": "set", "n": k["n"], "by": by, "f": {"parent": into["n"]}, "was": {"parent": it["n"]}, "src": src, "cascade": it["n"], **keep})
        return f"ok {code} merged into {s.code(into['n'])}" + s.gone_note(it, by), f"Merged {code}"
    raise Err(f"unknown op '{name}'")


def run_all(s: "Store", ops: List[Tuple[int, Any]], by: str, src: Optional[str] = None, keep: bool = False) -> Tuple[List[str], List[Any]]:
    """ops: list of (lineno, op dict | Err). keep = link changes to src without marking it handled."""
    lines: List[str] = []
    labels: List[Any] = []
    ctx: Dict[str, Any] = {"src": src, "keep": keep}
    with s.lock:
        for no, op in ops[:MAX_OPS]:
            try:
                if isinstance(op, Err):
                    raise op
                msg, label = run(s, op, by, ctx)
                lines.append(msg)
                if label:
                    labels.append(label)
            except Err as ex:
                lines.append(f"err{f' L{no}' if no else ''}: {ex}")
        if len(ops) > MAX_OPS:
            lines.append(f"err: only the first {MAX_OPS} commands were run")
    return lines, labels
