"""One project: its state, rebuilt by replaying its change log (`apply` never validates; ops.run does).

The log lives in SQLite (storage.Db). Every change is an event: it is written to the log first, then applied to the
state in memory, exactly as the old one-file Taska did with its JSON Lines file, so an imported log replays to the
same state and every agent-facing answer stays the same.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import threading
import time
from typing import TYPE_CHECKING, Any, Callable, Dict, List, Optional, Set, Tuple

from . import ops, storage, views, voice
from .core import (CLAIM_TTL, CLOSED, DOC_KEY, LETTER, PEOPLE, TR_HOLD, TYPE_OF, Doc, Err, Event, Input, Item, Msg, Op,
                   block_key, clean_title, edit_note, md_blocks, now, stamp, user_word)

if TYPE_CHECKING:
    from .hub import Hub

Job = Dict[str, Any]


class Store:
    """All state of one project. Thread-safe through `lock` (and `cond`, which wakes those waiting for news)."""

    FILED_WAS = {"proposed": "proposed", "open": "open", "doing": "in progress", "review": "in review", "done": "done", "dropped": "won't do"}

    def __init__(self, folder: str, hub: Optional["Hub"] = None, name: str = ""):
        self.folder = os.path.abspath(folder)
        self.path = storage.db_path(self.folder)
        self.fdir = os.path.join(self.folder, "taska-files")
        self.hub = hub
        self.lock = threading.RLock()
        self.cond = threading.Condition(self.lock)
        self.items: Dict[int, Item] = {}
        self.inputs: Dict[str, Input] = {}
        self.events: List[Event] = []
        self.op_done: Dict[str, Tuple[Dict[str, Any], int]] = {}  # B326: the page's save id -> its answer, so a save sent again is done once
        self.move_lock = threading.Lock()  # F397: one move of an item to another project at a time, so one sent again waits and is not done twice
        self.qids: Dict[str, str] = {}  # the page's id for an input it sent -> the input: sent again after a lost answer, it goes in once (T101)
        self.undone: Set[int] = set()  # seqs of your changes that were put back (F80)
        self.org_off: Set[int] = set()  # organizer changes taken back by an undo (T113 A4)
        self.took: Dict[int, List[int]] = {}  # each undo's list of them
        self.stash: Dict[int, List[Tuple[str, int, Any]]] = {}  # each deletion's seq -> what it took out of the items that stay (F177)
        self.gone_items: List[Dict[str, Any]] = []  # T257 #5: items deleted by themselves (with their subitems), for Deleted and a restore
        self.rev = 0  # bumps on every change, including transient organizer state
        self.boot = format(int(time.time() * 1000), "x")  # rev restarts with the process; boot tells pages apart
        self.maxn = self.nin = self.nfile = 0
        self.cfg: Dict[str, Any] = {"auto": True}  # auto = keep-going (always on, T260); name: what people call it (F173)
        self.name, self.gone = name or os.path.basename(self.folder), False  # name: the project's address and folder; gone: deleted while this ran (F173)
        self.docs: Dict[int, Doc] = {}
        self.maxd = 0
        self.org_on = False
        self.org_busy: Optional[str] = None
        self.trs: Dict[str, Job] = {}  # voice notes being transcribed in the background, by file (B165): t0, done, tr, err
        self.claims: Dict[int, Tuple[str, float]] = {}  # n -> (agent, time): what /next gave an agent (F194)
        self.fwd: Dict[str, List[Tuple["Store", str]]] = {}  # file -> [(project, file)]: copies of notes whose input moved before their words came (F79, T101)
        self.db = storage.Db(self.path)
        for seq, line in self.db.events():
            try:
                e = json.loads(line)
            except ValueError as ex:
                print(f"taska: {self.name}: skipped change {seq}: {ex}", file=sys.stderr)
                continue
            try:
                self.apply(e)
            except Exception as ex:  # a damaged change must not stop the app
                print(f"taska: {self.name}: change {seq} did not apply: {ex}", file=sys.stderr)
        if os.path.isdir(self.fdir):
            for fname in os.listdir(self.fdir):
                m = re.match(r"f(\d+)-", fname)
                if m:
                    self.nfile = max(self.nfile, int(m.group(1)))
        saved = self.db.get("agents")
        if isinstance(saved, dict):  # name -> {"t": last call, "waiting": how many /next?wait calls it holds now}
            self.agents: Dict[str, Dict[str, Any]] = {str(k): {"t": float(v), "waiting": 0} for k, v in saved.items()}
        else:  # first run: when did each agent last write here?
            self.agents = {}
            for e in self.events:
                if e.get("by") and e["by"] not in PEOPLE and e.get("t"):
                    try:
                        self.agents[e["by"]] = {"t": stamp(e["t"]), "waiting": 0}
                    except ValueError:
                        pass
        reads = self.db.get("reads")  # F220: item -> agent -> when it last read it (the item's card, or /next giving it)
        self.reads: Dict[int, Dict[str, float]] = {int(n): dict(v) for n, v in reads.items()} if isinstance(reads, dict) else {}
        self.pv, self.saved = 0, 0.0  # pv: bumps when an agent turns up, starts or stops waiting
        # T293: (kind, id) -> [hash as last served, change number]; pages ask only for what changed
        self.sv: Dict[Tuple[str, Any], List[Any]] = {}
        self.svn = 0
        self.sv_memo: Optional[Tuple[Tuple[int, int], Dict[str, Any]]] = None
        self.written: Dict[str, Dict[Any, str]] = {"items": {}, "inputs": {}, "docs": {}}  # the state rows as last written
        self.flush_at = 0.0
        self.flusher: Optional[threading.Timer] = None
        self.write_state(full=True)

    # -- the current state kept in the database ---------------------------------

    def write_state(self, full: bool = False) -> None:
        """Write the rows of the current state that changed since the last write (all of them with full)."""
        with self.lock:
            if self.db.closed:
                return
            rows = storage.StateRows()
            for table, now_rows in (("items", self.items), ("inputs", self.inputs), ("docs", self.docs)):
                was = self.written[table]
                fresh: Dict[Any, str] = {}
                for k, v in now_rows.items():
                    text = storage.dumps(v)
                    fresh[k] = text
                    if full or was.get(k) != text:
                        getattr(rows, table)[k] = text
                getattr(rows, table + "_gone").update(k for k in was if k not in fresh)
                self.written[table] = fresh
            if rows or full:
                self.db.write_state(rows, len(self.events), full=full)

    def soon_write(self) -> None:
        """The state rows follow the log within a second (one write for a burst of changes)."""
        if self.flusher and self.flusher.is_alive():
            return
        self.flusher = threading.Timer(1.0, self.write_state)
        self.flusher.daemon = True
        self.flusher.start()

    def mtime(self) -> float:
        """When the project last changed on disk."""
        t = 0.0
        for p in (self.path, self.path + "-wal"):
            try:
                t = max(t, os.path.getmtime(p))
            except OSError:
                pass
        return t

    # -- replay ---------------------------------------------------------------

    def touch(self, n: Optional[int], rid: Optional[str], ack: bool = True) -> None:
        it, inp = self.items.get(n) if n is not None else None, self.inputs.get(rid) if rid else None
        if it and rid and rid not in it["srcs"]:
            it["srcs"].append(rid)
        if inp:
            if n not in inp["touched"]:
                inp["touched"].append(n)
            if ack:
                inp["acked"] = True

    def entry(self, it: Item, e: Event, kind: str, text: str, src: Optional[str] = None, files: Optional[List[Any]] = None) -> None:
        it["thread"].append({"id": e["seq"], "by": e["by"], "kind": kind, "text": text, "t": e["t"], "src": src, "files": files or []})
        it["t1"] = e["t"]

    def apply(self, e: Event) -> None:
        self.rev += 1
        self.events.append(e)
        e["seq"] = len(self.events)
        k = e["k"]
        if k == "in":
            inp: Optional[Input] = {"id": e["id"], "t": e["t"], "by": e["by"], "text": e.get("text", ""), "scope": e.get("scope"),
                                    "files": e.get("files", []), "acked": False, "touched": [], "org": None, "seq": e["seq"]}
            assert inp is not None
            self.inputs[inp["id"]] = inp
            self.nin = max(self.nin, int(inp["id"][1:]))
            if e.get("q"):
                self.qids[e["q"]] = inp["id"]
            it = self.items.get(inp["scope"]) if inp["scope"] is not None else None
            if it:
                self.entry(it, e, "say", inp["text"], inp["id"])
                self.touch(it["n"], inp["id"], ack=False)
        elif k == "add":
            n = e["n"]
            self.maxn = max(self.maxn, n)
            e["title"], named = clean_title(e["title"])  # "[src=r246] ..." from an agent (B222); the log stays as it was
            self.items[n] = {"n": n, "type": e["type"], "title": e["title"], "body": e.get("body", ""),
                             "pri": e["pri"], "when": e["when"], "status": e["status"], "parent": e.get("parent"),
                             "next": e.get("next", ""), "thread": [], "srcs": [], "merged_into": None, "archived": False,
                             "t0": e["t"], "t1": e["t"], "by": e.get("by")}  # by: who made it, so the page names the same agent the same way (B157)
            self.touch(n, e.get("src"), ack=not e.get("keep"))
            if named and not e.get("src") and named in self.inputs:
                self.touch(n, named, ack=False)  # the input it named is its source; whether it was handled stays as it was
        elif k == "set":
            it = self.items[e["n"]]
            if "title" in e["f"]:
                e["f"]["title"] = clean_title(e["f"]["title"])[0]
            it.update(e["f"])
            it["t1"] = e["t"]
            if e.get("undo_of"):
                self.undone.add(e["undo_of"])
            self.touch(it["n"], e.get("src"), ack=not e.get("keep"))
        elif k == "say":
            it = self.items[e["n"]]
            self.entry(it, e, e["kind"], e["text"], e.get("src"), e.get("files"))
            self.touch(it["n"], e.get("src"), ack=not e.get("keep"))
        elif k == "merge":
            a, b = self.items[e["n"]], self.items[e["into"]]
            a["merged_into"], a["t1"] = b["n"], e["t"]
            for c in self.items.values():
                if c["parent"] == a["n"]:
                    c["parent"] = b["n"]
            self.entry(b, e, "progress", f"Merged in {self.code(a['n'])}: {a['title']}", e.get("src"))
            for rid in a["srcs"]:
                self.touch(b["n"], rid, ack=False)
            self.touch(b["n"], e.get("src"), ack=not e.get("keep"))
        elif k == "ack":
            for rid in e["ids"]:
                if rid in self.inputs:
                    self.inputs[rid]["acked"] = True
        elif k == "amend":
            inp = self.inputs[e["src"]]
            inp.setdefault("history", []).append({"text": inp["text"], "t": e["t"], "mode": e["mode"]})
            inp.update(text=e["text"], v=inp.get("v", 0) + 1, edit_seq=e["seq"], updated=e["t"], acked=False, org=None)
            if e.get("files"):  # files that came with the details (B168)
                inp["files"] = inp["files"] + e["files"]
            self.show_edit(inp, e)  # the earlier versions stay in the input's history
        elif k == "tr":  # a voice note's words, in after its input was sent (B165)
            inp = self.inputs.get(e["src"])
            if inp:
                old = inp["text"]
                inp["files"] = [dict(f, tr=e["tr"]) if f["f"] == e["f"] else f for f in inp["files"]]
                if e.get("was") and e["was"] in old:  # fuller words in place of the shorter ones given first
                    inp["text"] = old.replace(e["was"], e["tr"], 1)
                elif e.get("was"):  # you changed those words: the fuller ones follow, said as such
                    inp["text"] = old.rstrip() + "\n\nFuller words of the voice note:\n" + e["tr"]
                elif e["tr"] not in old:
                    inp["text"] = old.rstrip() + "\n" + e["tr"] if old.strip() else e["tr"]
                if e.get("late"):  # an agent or the organizer saw it without its words: it comes back to them updated
                    inp.setdefault("history", []).append({"text": old, "t": e["t"], "mode": "append"})
                    inp.update(v=inp.get("v", 0) + 1, edit_seq=e["seq"], updated=e["t"], acked=False, org=None)
                    self.show_edit(inp, e)
                else:  # nobody has read it yet: its message on the item simply shows the words now
                    inp["v"] = inp.get("v", 0) + 1  # an edit opened before the words came cannot save over them (T101)
                    self.show_edit(inp, e, mark=False)
        elif k == "undo":
            self.undo(e)
        elif k == "redo":
            self.redo(e)
        elif k == "arch":  # many items archived or unarchived in one change (T113 A5)
            for n in e["ns"]:
                it = self.items.get(n)
                if it:
                    it["archived"], it["t1"] = e["on"], e["t"]
        elif k == "unmake":  # "Make item" undone: the item goes, and its input waits for an agent again
            it, inp = self.items.get(e["n"]), self.inputs.get(e["src"])
            if it:
                it.update(status="dropped", archived=True, t1=e["t"])
            if inp and e["n"] in inp["touched"]:
                inp["touched"].remove(e["n"])
                if not inp["touched"]:
                    inp["acked"] = False
        elif k == "del":  # F177: an input deleted, with the items only it made (e["ns"]); restorable ("undel")
            rid = e["src"]
            inp = self.inputs.get(rid)
            if inp:
                inp["deleted"] = {"t": e["t"], "seq": e["seq"], "ns": list(e.get("ns") or []), "kept": list(e.get("kept") or [])}
            for n in e.get("ns") or []:
                if n in self.items:
                    self.items[n]["deleted"] = rid
            took: List[Tuple[str, int, Any]] = []
            self.stash[e["seq"]] = took  # the items that stay lose it from their sources, and its words on them
            for it in self.items.values():
                if it.get("deleted") == rid:
                    continue
                if rid in it["srcs"]:
                    took.append(("src", it["n"], it["srcs"].index(rid)))
                    it["srcs"].remove(rid)
                own = [x for x in it["thread"] if x.get("src") == rid and x["by"] == "you"]
                if own:
                    took += [("msg", it["n"], x) for x in own]
                    it["thread"] = [x for x in it["thread"] if x not in own]
        elif k == "undel":  # F177: a deleted input and its items back, as they were
            rid = e["src"]
            inp = self.inputs.get(rid)
            gone = (inp or {}).get("deleted")
            if inp:
                inp["deleted"] = None
            for it in self.items.values():
                if it.get("deleted") == rid:
                    it["deleted"] = None
            for kind, n, x in reversed(self.stash.pop(gone["seq"], []) if gone else []):
                it = self.items.get(n)
                if not it:
                    continue
                if kind == "src" and rid not in it["srcs"]:
                    it["srcs"].insert(min(x, len(it["srcs"])), rid)
                elif kind == "msg" and all(t["id"] != x["id"] for t in it["thread"]):
                    it["thread"].append(x)
                    it["thread"].sort(key=lambda t: t["id"])
        elif k == "moved":  # sent to the wrong project (F79): it lives on in e["to"] as e["as"]
            inp = self.inputs.get(e["src"])
            if inp:
                inp.update(acked=True, moved={"to": e["to"], "as": e["as"]})
                it = self.items.get(inp["scope"]) if inp["scope"] is not None else None
                if it:  # its message on the item goes with it
                    it["thread"] = [x for x in it["thread"] if x["id"] != inp["seq"]]
                    if inp["id"] in it["srcs"] and inp["id"] not in [x.get("src") for x in it["thread"]]:
                        it["srcs"].remove(inp["id"])
        elif k == "org":
            inp = self.inputs.get(e["src"])
            if inp:
                inp["org"] = None if e.get("retry") else {"ok": e["ok"], "msg": e["msg"], "t": e["t"],
                                                          "keep": e.get("keep", "Left for your coding agent" in e["msg"]), "changed": e.get("changed", False)}
        elif k == "cfg":
            self.cfg.update(e["f"])
            self.cfg["auto"] = True  # T260: agents always keep going; an old "off" in the log no longer stops them
        elif k == "doc":
            d = self.docs.get(e["d"])
            if not d:
                self.maxd = max(self.maxd, e["d"])
                d = self.docs[e["d"]] = {"d": e["d"], "n": e["n"], "comments": [], "t0": e["t"], "versions": 0}
            d.update(title=e.get("title") or d.get("title", ""), md=e["md"], t1=e["t"], by=e["by"])
            d["versions"] += 1
            it = self.items.get(d["n"])
            if it:
                it["t1"] = e["t"]
        elif k == "idel":  # T257 #5: an item deleted by itself, with its subitems; restorable ("iundel")
            for n in e["ns"]:
                if n in self.items:
                    self.items[n]["deleted"] = "#item"
                    self.items[n]["deleted_at"] = e["t"]
            self.gone_items.append({"ns": list(e["ns"]), "t": e["t"], "seq": e["seq"]})
        elif k == "iundel":
            for n in e["ns"]:
                if n in self.items and self.items[n].get("deleted") == "#item":
                    self.items[n]["deleted"] = None
            self.gone_items = [g for g in self.gone_items if g["ns"] != list(e["ns"])]
        elif k == "ddel":  # T257 #8: a document deleted, restorable
            d = self.docs.get(e["d"])
            if d:
                d["deleted"] = e["t"] if e.get("on", True) else None
        elif k == "dmove":  # T257 #9: a document goes with another item
            d = self.docs.get(e["d"])
            if d and e["to"] in self.items:
                d["n"] = e["to"]
        elif k == "dcmove":  # T257 #10: a comment goes on another paragraph
            c = next((c for c in self.docs[e["d"]]["comments"] if c["id"] == e["id"]), None)
            if c:
                c.update(key=e["key"], quote=e.get("quote", ""))
        elif k == "unfile":  # T257 #11: a file taken off what you sent (an input, so your reply too), or off a comment
            if e.get("d"):
                c = next((c for c in self.docs[e["d"]]["comments"] if c["id"] == e["id"]), None)
                if c:
                    c["files"] = [f for f in c.get("files", []) if f["f"] != e["f"]]
            else:
                inp = self.inputs.get(e["src"])
                if inp:
                    inp["files"] = [f for f in inp["files"] if f["f"] != e["f"]]
                    for it in self.items.values():
                        for x in it["thread"]:
                            if x.get("src") == e["src"] and x.get("files"):
                                x["files"] = [f for f in x["files"] if f["f"] != e["f"]]
        elif k == "hide":  # T257 #12: an agent's message folded away, or shown again
            it = self.items.get(e["n"])
            for x in (it or {}).get("thread", []):
                if x["id"] == e["id"]:
                    x["hidden"] = bool(e.get("on", True))
        elif k == "rescope":  # T257 #7: what you said goes with another item: the input, and your reply in its thread
            inp = self.inputs.get(e["src"])
            if inp:
                old = inp.get("scope")
                inp["scope"] = e["to"]
                inp["touched"] = [n for n in inp["touched"] if n != old] + ([] if e["to"] in inp["touched"] else [e["to"]])  # what it went with before is not what it became
                was = self.items.get(old) if old is not None else None
                if was:
                    moved = [x for x in was["thread"] if x.get("src") == e["src"] and x["by"] == "you"]
                    was["thread"] = [x for x in was["thread"] if x not in moved]
                    new = self.items.get(e["to"])
                    if new:
                        new["thread"] = sorted(new["thread"] + moved, key=lambda x: x["id"])
        elif k == "dcres":  # T274 #2: a thread resolved, or open again
            res = self.docs[e["d"]].setdefault("resolved", {})
            if e.get("on"):
                res[e["key"]] = e["t"]
            else:
                res.pop(e["key"], None)
        elif k == "dc":
            self.docs[e["d"]].get("resolved", {}).pop(e["key"], None)  # a new word opens a resolved thread again
            self.docs[e["d"]]["comments"].append({"id": e["seq"], "key": e["key"], "quote": e["quote"], "text": e["text"], "by": e["by"], "t": e["t"],
                                                  "files": e.get("files", [])})  # a voice comment keeps its recording (F184)
        elif k in ("dcedit", "dcdel", "dcundel"):  # B258: your comment changed, deleted (kept aside) or back where it was
            d = self.docs[e["d"]]
            if k == "dcundel":
                c = d.setdefault("gone", {}).pop(e["id"], None)
                if c:
                    d["comments"] = sorted(d["comments"] + [c], key=lambda c: c["id"])
            else:
                c = next((c for c in d["comments"] if c["id"] == e["id"]), None)
                if c and k == "dcedit":
                    c.update(text=e["text"], edited=e["t"])
                    if e.get("files"):
                        c["files"] = c.get("files", []) + e["files"]
                elif c:
                    d["comments"].remove(c)
                    d.setdefault("gone", {})[e["id"]] = c
        if e.get("by") and e["by"] not in PEOPLE and k in ("add", "set", "say") and e.get("n") in self.items:
            self.items[e["n"]]["agent"] = {"by": e["by"], "t": e["t"]}  # who works on it, and since when it was last heard of (F194)

    def touches(self, e: Event) -> List[Any]:
        """The items an event changes or adds to: a change, a message, a reply, a subitem, a document, a comment."""
        out: List[Any] = [e[k] for k in ("n", "into", "scope", "parent") if e.get(k)] + list(e.get("ns") or [])
        f = e.get("f")  # a set's fields; a voice note's file name on "tr" events
        if isinstance(f, dict) and f.get("parent"):  # pyright: ignore[reportUnknownMemberType]
            out.append(f["parent"])
        if e["k"] in ("dc", "dcedit", "dcdel", "dcundel", "dcres", "ddel", "dmove", "dcmove") and e.get("d") in self.docs:
            out.append(self.docs[e["d"]]["n"])
        return out

    def touched_since(self, n: int, seq: int) -> bool:
        """Did anything happen to item n after event `seq`?"""
        return any(n in self.touches(e) for e in self.events[seq:])

    def filings(self) -> Dict[str, Dict[str, Any]]:
        """What the organizer last did with each input (since its last edit), in words, and whether all of it is still as
        it left it (T113 A4): an undo then takes back only its own work, not what you or an agent did after.
        -> {rid: {"can": bool, "what": "removes F08 · B12 back to P2", "why": "F08 changed since"}}"""
        last: Dict[Any, int] = {}
        by_src: Dict[str, List[Event]] = {}
        for e in self.events:
            for m in self.touches(e):
                last[m] = e["seq"]
            if e.get("by") == "org" and e.get("src") and e["k"] in ("add", "set", "say", "merge") and e["seq"] not in self.org_off:
                by_src.setdefault(e["src"], []).append(e)
        out: Dict[str, Dict[str, Any]] = {}
        for rid, xs in by_src.items():
            inp = self.inputs.get(rid)
            if not inp or inp.get("deleted") or not inp["org"] or not inp["org"].get("ok") or inp["org"].get("undone"):
                continue
            xs = [x for x in xs if x["seq"] > inp.get("edit_seq", 0)]
            mine = {m: x["seq"] for x in xs for m in (x.get("n"), x.get("into")) if m}
            changed = [m for m, s in mine.items() if last.get(m, 0) > s]
            words: List[str] = []
            for x in xs:
                c = self.code(x["n"])
                if x["k"] == "add":
                    words.append(f"removes {c}")
                elif x["k"] == "set":
                    words += [f"{c} back to {self.FILED_WAS.get(x['was'].get(f), x['was'].get(f))}" if f in ("pri", "status", "when", "type")
                              else f"{c}'s old {f}" for f in x["f"]]
                elif x["k"] == "say":
                    words.append(f"takes back the note on {c}")
                elif x["k"] == "merge":
                    words.append(f"{c} no longer merged into {self.code(x['into'])}")
            words = list(dict.fromkeys(words))
            if words:
                out[rid] = {"can": not changed, "why": f"{self.code(changed[0])} changed since" if changed else "",
                            "what": " · ".join(words[:4]) + (f" · and {len(words) - 4} more" if len(words) > 4 else "")}
        return out

    def redo_blocked(self, rid: Any) -> Optional[str]:
        """Why the filing an undo took back can't come back now, or None (T113 A4)."""
        last = next((x for x in reversed(self.events) if x.get("src") == rid and (x["k"] in ("undo", "redo", "amend") or x.get("by") == "org")), None)
        if not last or last["k"] != "undo":
            return f"there is no undone filing of {rid} to put back"
        for seq in self.took.get(last["seq"], []):
            x = self.events[seq - 1]
            for m in (x.get("n"), x.get("into")):
                if m and self.touched_since(m, last["seq"]):
                    return f"{self.code(m)} changed since the filing was undone"
        return None

    def show_edit(self, inp: Input, e: Event, mark: bool = True) -> None:
        """S1: an input you changed shows as its one message, now with the new words and marked edited, wherever it is
        in a thread. When someone wrote there since, one short message after theirs says what changed (so a question
        asked meanwhile counts as answered); where the input only started an item (the organizer filed it) one
        "rN updated" message carries the latest words. The earlier versions are the input's history."""
        rid, head = inp["id"], f"{inp['id']} updated:\n"
        old = inp["history"][-1]["text"] if inp.get("history") else ""
        for n in dict.fromkeys(inp["touched"] + ([inp["scope"]] if inp["scope"] else [])):
            it = self.items.get(n)
            if not it:
                continue
            th = it["thread"]
            own = next((x for x in th if x["src"] == rid and x["id"] == inp["seq"]), None)
            if own:
                own["text"] = inp["text"]
                if mark:
                    own["edited"] = e["t"]
                    if any(x["by"] not in (inp["by"], "org") for x in th[th.index(own) + 1:]):
                        self.entry(it, e, "say", edit_note(rid, old, inp["text"]), rid)
                        th[-1]["change"] = True  # a note on the edit, not another version of the words
                continue
            note = next((x for x in reversed(th) if x["src"] == rid and x["text"].startswith(head)), None)
            if note:
                note["text"] = head + inp["text"]
                if mark:
                    note["edited"] = e["t"]
            elif mark:
                self.entry(it, e, "say", head + inp["text"], rid)

    def undo(self, e: Event) -> None:
        """Revert the organizer's changes for input e["src"]; fields changed again since stay as they are."""
        rid = e["src"]
        since = self.inputs.get(rid, {}).get("edit_seq", 0)
        took: List[int] = []
        self.took[e["seq"]] = took
        for x in [x for x in self.events if x.get("src") == rid and x.get("by") == "org" and x["seq"] > since]:
            k = x["k"]
            if x["seq"] in self.org_off:  # taken back already
                continue
            if k in ("add", "set", "say", "merge"):
                self.org_off.add(x["seq"])
                took.append(x["seq"])
            if k == "add" and x["n"] in self.items:
                self.items[x["n"]].update(status="dropped", archived=True, t1=e["t"])
            elif k == "set" and x["n"] in self.items:
                it = self.items[x["n"]]
                for f, v in x["f"].items():
                    if it.get(f) == v:
                        it[f] = x["was"].get(f)
                it["t1"] = e["t"]
            elif k == "say" and x["n"] in self.items:
                self.items[x["n"]]["thread"] = [t for t in self.items[x["n"]]["thread"] if t["id"] != x["seq"]]
            elif k == "merge" and x["n"] in self.items:
                a, b = self.items[x["n"]], self.items.get(x["into"])
                if a["merged_into"] == x["into"]:
                    a["merged_into"] = None
                if b:
                    b["thread"] = [t for t in b["thread"] if t["id"] != x["seq"]]
        if rid in self.inputs:  # the input is unhandled again (the organizer's changes had marked it handled)
            self.inputs[rid].update(acked=False, org={"ok": True, "msg": "Undone", "t": e["t"], "keep": False, "undone": True})

    def redo(self, e: Event) -> None:
        """Put back what the last undo of input e["src"]'s filing took back (T113 A4): Z after "Undo organizing"."""
        rid = e["src"]
        u = next((x for x in reversed(self.events[:e["seq"] - 1]) if x["k"] == "undo" and x.get("src") == rid), None)
        if not u:
            return
        for seq in self.took.get(u["seq"], []):
            x = self.events[seq - 1]
            self.org_off.discard(seq)
            it = self.items.get(x["n"])
            if not it:
                continue
            it["t1"] = e["t"]
            if x["k"] == "add":
                it.update(status=x["status"], archived=False)
            elif x["k"] == "set":
                for f, v in x["f"].items():
                    if it.get(f) == x["was"].get(f):
                        it[f] = v
            elif x["k"] == "say":
                if all(t["id"] != seq for t in it["thread"]):
                    it["thread"].append({"id": seq, "by": x["by"], "kind": x["kind"], "text": x["text"], "t": x["t"], "src": x.get("src"), "files": x.get("files") or []})
                    it["thread"].sort(key=lambda t: t["id"])
            elif x["k"] == "merge":
                it["merged_into"] = x["into"]
                b = self.items.get(x["into"])
                if b and all(t["id"] != seq for t in b["thread"]):
                    b["thread"].append({"id": seq, "by": x["by"], "kind": "progress", "text": f"Merged in {self.code(it['n'])}: {it['title']}",
                                        "t": x["t"], "src": x.get("src"), "files": []})
                    b["thread"].sort(key=lambda t: t["id"])
        o = next((x for x in reversed(self.events[:u["seq"] - 1]) if x["k"] == "org" and x.get("src") == rid and not x.get("retry")), None)
        if o and rid in self.inputs:
            keep = o.get("keep", "Left for your coding agent" in o["msg"])
            self.inputs[rid].update(acked=not keep, org={"ok": o["ok"], "msg": o["msg"], "t": o["t"], "keep": keep, "changed": o.get("changed", False)})

    # -- deleting an input (F177) ------------------------------------------------
    # Delete moves an input to Deleted, with the items only it made, as long as no agent has worked on them. An item
    # that has other inputs, or that an agent changed or wrote on, stays: it only loses this input from its sources (and
    # the input's own words on it). Nothing is erased: Restore, Undo or Z put all of it back.

    def deletions(self, only: Optional[List[str]] = None) -> Dict[str, Dict[str, Any]]:
        """What deleting each input would do: {rid: {"go": [n], "keep": [[n, why]]}}, for the inputs `only` (default all)."""
        made: Dict[str, List[int]] = {}
        hands: Set[Any] = set()
        for e in self.events:
            if e["k"] == "add" and e.get("src"):
                made.setdefault(e["src"], []).append(e["n"])
            if e.get("by") and e["by"] not in PEOPLE:  # an agent's change, message, subitem, document or comment, not its making the item
                hands.update(m for m in self.touches(e) if not (e["k"] == "add" and m == e["n"]))
        out: Dict[str, Dict[str, Any]] = {}
        for rid in (only or [r for r, i in self.inputs.items() if not i.get("deleted")]):
            go: List[int] = []
            keep: Dict[int, str] = {}
            for n in made.get(rid, []):
                it = self.items.get(n)
                if not it or it["merged_into"] or it.get("deleted"):
                    continue
                if any(r != rid and r in self.inputs and not self.inputs[r].get("deleted") for r in it["srcs"]):
                    keep[n] = "it has other inputs"
                elif n in hands:
                    keep[n] = "an agent already worked on it"
                else:
                    go.append(n)
            stays = True
            while stays:  # a subitem that stays keeps its parent
                stays = False
                for n in list(go):
                    if any(k["parent"] == n and not k["merged_into"] and not k.get("deleted") and k["n"] not in go for k in self.items.values()):
                        go.remove(n)
                        keep[n], stays = "a subitem of it stays", True
            if go or keep:
                out[rid] = {"go": sorted(go), "keep": [[n, keep[n]] for n in sorted(keep)]}
        return out

    def deleted_list(self) -> List[Dict[str, Any]]:
        """Deleted inputs, newest deletion first, with what went with them: Settings > Deleted restores them."""
        rows = [i for i in self.inputs.values() if i.get("deleted")]
        rows.sort(key=lambda i: -i["deleted"]["seq"])

        def item(n: int) -> Dict[str, Any]:
            return {"n": n, "code": self.code(n), "title": self.items[n]["title"], "type": self.items[n]["type"]}

        return [{"id": i["id"], "t": i["t"], "at": i["deleted"]["t"], "text": i["text"], "files": len(i["files"]), "scope": i["scope"],
                 "items": [item(n) for n in i["deleted"]["ns"] if n in self.items],
                 "kept": [dict(item(n), why=why) for n, why in i["deleted"]["kept"] if n in self.items]} for i in rows]

    def gone_list(self) -> List[Dict[str, Any]]:
        """T257 #5, #8: items and documents deleted by themselves, newest first, for Deleted."""
        items = [{"kind": "item", "n": g["ns"][0], "code": self.code(g["ns"][0]), "title": self.items[g["ns"][0]]["title"], "at": g["t"], "more": len(g["ns"]) - 1}
                 for g in self.gone_items if g["ns"] and g["ns"][0] in self.items and self.items[g["ns"][0]].get("deleted") == "#item"]
        docs = [{"kind": "doc", "d": d["d"], "title": d["title"], "at": d["deleted"], "on": self.code(d["n"]) if d["n"] in self.items else ""}
                for d in self.docs.values() if d.get("deleted")]
        return sorted(items + docs, key=lambda x: x["at"], reverse=True)

    def gone_note(self, it: Item, by: str) -> str:
        """What an agent hears when it writes to an item the user deleted (F177)."""
        if not it.get("deleted") or by in PEOPLE:
            return ""
        return f" (note: the user deleted {self.code(it['n'])} together with input {it['deleted']}: stop working on it)"

    @property
    def title(self) -> str:
        """What the project is called (F173): any name; its address (self.name) was made from it once and never changes."""
        return str(self.cfg.get("name") or self.name)

    def emit(self, e: Event) -> None:
        if self.gone:
            raise Err(f"project {self.name} was deleted")
        e["t"] = now()
        self.db.append(len(self.events) + 1, e)  # the log first: a change that is in the log is never lost
        self.apply(e)
        self.cond.notify_all()
        self.soon_write()

    def bump(self) -> None:
        self.rev += 1
        self.cond.notify_all()

    # -- lookups --------------------------------------------------------------

    def code(self, n: Any) -> str:
        it = self.items.get(n)
        return (LETTER[it["type"]] if it else "?") + str(n).zfill(len(str(self.maxn)))

    def item(self, ref: Any, ctx: Optional[Dict[str, Any]] = None, follow: bool = True) -> Item:
        s = str(ref).strip()
        if s == "$":
            if not ctx or not ctx.get("last"):
                raise Err("$ is empty: no item created earlier in this request")
            s = str(ctx["last"])
        m = re.fullmatch(r"([A-Za-z]?)0*(\d+)", s)
        if not m or (m.group(1) and m.group(1).upper() not in TYPE_OF):
            raise Err(f"bad item ref '{s}'")
        it = self.items.get(int(m.group(2)))
        if not it:
            raise Err(f"{s} not found")
        while follow and it["merged_into"]:
            it = self.items[it["merged_into"]]
        return it

    def doc(self, ref: Any) -> Doc:
        m = re.fullmatch(r"[Dd]?(\d+)", str(ref).strip())
        d = self.docs.get(int(m.group(1))) if m else None
        if not d:
            raise Err(f"no document {ref}")
        return d

    def doc_view(self, d: Doc) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Blocks with their comment threads; threads whose paragraph changed come back as `detached`."""
        blocks: List[Dict[str, Any]] = []
        keys: Set[str] = set()
        for kind, text in md_blocks(d["md"]):
            key = block_key(text)
            first = key not in keys
            keys.add(key)
            blocks.append({"key": key, "kind": kind, "text": text,
                           "comments": [c for c in d["comments"] if c["key"] == key] if first else []})
        detached: Dict[str, Dict[str, Any]] = {}
        for c in d["comments"]:
            if c["key"] not in keys and c["key"] != DOC_KEY:
                detached.setdefault(c["key"], {"key": c["key"], "quote": c["quote"], "comments": []})["comments"].append(c)
        return blocks, list(detached.values())

    @staticmethod
    def doc_whole(d: Doc) -> List[Dict[str, Any]]:
        """B247: the comments on the document as a whole."""
        return [c for c in d["comments"] if c["key"] == DOC_KEY]

    def doc_open(self, d: Doc) -> int:
        """Threads whose last word is the user's: the agent should answer them."""
        last: Dict[str, str] = {}
        for c in d["comments"]:
            last[c["key"]] = c["by"]
        return sum(1 for k, by in last.items() if by == "you" and k not in d.get("resolved", {}))

    @staticmethod
    def waiting(it: Item) -> Optional[Msg]:
        """The open ask/block an agent posted that the user has not answered yet. Whatever the user says after it
        answers it, a picked choice or not (B163): the list, the item, Go through and /next all read it here."""
        for x in reversed(it["thread"]):
            if user_word(x) or x["kind"] == "withdraw":
                return None
            if x["kind"] in ("ask", "block"):
                return x
        return None

    @staticmethod
    def replied(it: Item) -> bool:
        """The user wrote after an agent's last word on this item: the agent should pick it up."""
        user = False
        for x in reversed(it["thread"]):
            if user_word(x):
                user = True
            elif x["by"] != "org":  # the organizer's own notes are neither side's word
                return user
        return False

    def for_agent(self) -> List[Input]:
        """Inputs a coding agent should handle (the organizer, when on, sees them first)."""
        return [i for i in self.pending() if (not self.org_on or i["org"]) and not (i["org"] or {}).get("undone")  # undone: parked until the user asks again
                and not self.held(i)]

    def pending(self) -> List[Input]:
        return [i for i in self.inputs.values() if not i["acked"] and not i.get("deleted")]

    def active(self) -> List[Item]:
        return [i for i in self.items.values() if not i["merged_into"] and not i.get("deleted")]  # deleted: in Deleted (F177)

    def open_kids(self, it: Item) -> List[Item]:
        """Subitems not finished yet (any depth): a parent is done when they are."""
        out: List[Item] = []
        todo = [it["n"]]
        while todo:
            n = todo.pop()
            for k in self.items.values():
                if k["parent"] == n and not k["merged_into"] and not k.get("deleted"):
                    todo.append(k["n"])
                    if k["status"] not in CLOSED:
                        out.append(k)
        return out

    def sorted(self, items: Any) -> List[Item]:
        return sorted(items, key=lambda i: (i["when"] != "now", i["pri"], i["n"]))  # same priority: oldest first

    def undoable(self, limit: int = 5, scan: int = 600) -> List[Dict[str, Any]]:
        """Your latest changes that can still be put back (F80), newest first: field changes by you that nobody
        changed again since. An undo and the change it put back cancel out, so undoing again walks further back."""
        out: List[Dict[str, Any]] = []
        seen: Set[Tuple[int, str]] = set()
        for e in reversed(self.events[-scan:]):
            if e["k"] == "arch":  # archived in a batch since: an older archive change is not the latest any more
                seen.update((n, "archived") for n in e["ns"])
            if e["k"] != "set" or e.get("undo_of") or e["seq"] in self.undone:
                continue
            it = self.items.get(e["n"])
            if e.get("by") == "you" and it and not it["merged_into"] and not it.get("deleted"):
                f = {k: v for k, v in e["f"].items() if (e["n"], k) not in seen and it.get(k) == v}
                if f:
                    out.append({"seq": e["seq"], "n": e["n"], "f": f, "was": {k: e["was"].get(k) for k in f}, "t": e["t"]})
                    if len(out) >= limit:
                        break
            seen.update((e["n"], k) for k in e["f"])
        return out

    def rules(self) -> List[Item]:
        return [i for i in self.sorted(self.active()) if i["type"] == "rule" and i["status"] not in CLOSED + ("proposed",) and not i["archived"]]

    def mode(self) -> str:
        return "keep-going ON" if self.cfg["auto"] else "keep-going OFF"

    # -- agents ---------------------------------------------------------------

    def claimer(self, it: Item, now_: Optional[float] = None) -> Optional[Tuple[str, float]]:
        """The agent working on an item (F194): the last one /next gave it to or that wrote to it, while it is fresh
        (CLAIM_TTL). Quiet longer than that, the item is free again for any agent."""
        t_now = now_ or time.time()
        c = self.claims.get(it["n"])
        best = c if c and t_now - c[1] < CLAIM_TTL else None
        a = it.get("agent")
        if a and it["status"] == "doing":
            t = stamp(a["t"])
            if t_now - t < CLAIM_TTL and (not best or t >= best[1]):
                best = (a["by"], t)
        return best

    @staticmethod
    def agent_name(name: Any) -> str:
        return re.sub(r"[^\w .-]", "", str(name or "agent"))[:40] or "agent"

    def saw(self, name: Any, waiting: int = 0) -> None:
        """An agent called the API (waiting: +1 when it starts holding /next?wait, -1 when that returns)."""
        name = self.agent_name(name)
        with self.cond:
            a = self.agents.setdefault(name, {"t": 0, "waiting": 0})
            t_now = time.time()
            before = (a["waiting"] > 0, t_now - a["t"] < 600)
            a["t"], a["waiting"] = t_now, max(0, a["waiting"] + waiting)
            if (a["waiting"] > 0, True) != before:
                self.pv += 1
                self.cond.notify_all()
            if (waiting or t_now - self.saved > 60) and not self.gone:
                self.saved = t_now
                self.db.put("agents", {k: v["t"] for k, v in self.agents.items()})

    def read_item(self, n: int, name: Any) -> None:
        """F220: an agent read item n (its card, or /next gave it): the page says "Read by" under your last words."""
        name = self.agent_name(name)
        if name in PEOPLE or n not in self.items:
            return
        with self.cond:
            self.reads.setdefault(n, {})[name] = time.time()
            self.pv += 1
            self.cond.notify_all()
            if not self.gone:
                self.db.put("reads", {str(k): v for k, v in self.reads.items()})

    def read_next(self, name: Any) -> None:
        """An agent read /next: inputs older than this are ones it has been told about (T117)."""
        name = self.agent_name(name)
        with self.cond:
            self.agents.setdefault(name, {"t": 0, "waiting": 0})["next"] = time.time()

    def news_for(self, name: Any) -> List[str]:
        """Inputs for the agent that came in after it last read /next: it hears of them when it writes back, at a
        natural stop, instead of being woken in the middle of its work (T117)."""
        name = self.agent_name(name)
        since = self.agents.get(name, {}).get("next")
        if not since:
            return []
        return [i["id"] for i in sorted(self.for_agent(), key=lambda i: int(i["id"][1:])) if stamp(i["t"]) >= int(since)]  # times are kept to the second

    def presence(self) -> Dict[str, Any]:
        """What the page shows about agents: who came when, who waits now, and whether work is waiting for them."""
        return {"agents": [{"name": k, "t": int(v["t"] * 1000), "waiting": v["waiting"] > 0} for k, v in self.agents.items()],
                "work": bool(self.cfg["auto"] and views.next_text(self)[1])}

    # -- voice notes (B165): you can send before the words are in. The message goes at once with its recording; the
    # words are worked out meanwhile and added to it, and agents and the organizer get it once they are in.

    def held(self, inp: Input) -> bool:
        """An input whose voice note is still being transcribed: it waits for its words (at most TR_HOLD seconds)."""
        t_now = time.time()
        return any((j := self.trs.get(f["f"])) and not j["done"] and t_now - j["t0"] < TR_HOLD for f in inp["files"])

    def with_words(self, text: str, files: List[Dict[str, Any]]) -> str:
        """Words of voice notes that came in after the page let go of them: the files and the text get them. A note
        whose words are still to come is marked wait, so they are worked out again if Taska stops before (T101)."""
        for f in files:
            if f.get("tr") or not (f.get("mime") or "").startswith("audio/"):
                continue
            j = self.trs.get(f["f"]) or self.saved_job(f["f"])
            if j and j["done"] and j["tr"]:
                f["tr"] = j["tr"]
                if j["tr"] not in text:
                    text = text.rstrip() + "\n" + j["tr"] if text.strip() else j["tr"]
            elif j and not (j["done"] and not j["err"]):  # still being worked out, or failed and may be asked for again
                f["wait"] = True
        return text

    def saved_job(self, fid: str) -> Optional[Job]:
        """A voice note worked out before, its words kept next to its audio (T101), as a finished job."""
        res = voice.voice_saved(self, fid)
        if res:  # fuller words still to come were lost with the restart that came between
            res = {k: v for k, v in res.items() if k != "more"}
        return {"t0": time.time(), "done": True, "tr": res.get("tr", ""), "err": "", "res": res} if res else None

    def transcribe_later(self, fid: str, data: bytes, mime: str, scope: Optional[int]) -> None:
        """Start working out a voice note's words in the background; an input that has the note by then gets them.
        Words kept next to the audio from before (a restart, a page asking again) are used as they are (T101)."""
        saved = self.saved_job(fid)
        with self.cond:
            job = saved or {"t0": time.time(), "done": False, "tr": "", "err": ""}
            self.trs[fid] = job
            if saved:
                return self.words_in(fid, job)
        hold = self.hold_timer(job)

        def more(words: Optional[str]) -> None:  # the strong model's words after its cap: fuller ones replace those given
            with self.cond:
                self.cond.wait_for(lambda: job["done"], timeout=voice.PRO_LATE)
                was = job["tr"]
                res = {k: v for k, v in (job.get("res") or {}).items() if k != "more"}
                if words:
                    res.update(tr=words, tr_by="pro", alt="", doubts=[], pro_error="", times=dict(res.get("times") or {}, late=round(time.time() - job["t0"], 1)))
                    job["tr"] = words
                job["res"] = res
                if words and was:
                    self.words_more(fid, was, words)
                elif words:
                    self.words_in(fid, job)
                self.bump()
            voice.voice_keep(self, fid, res)

        def work() -> None:
            res: Dict[str, Any] = {}
            err = ""
            try:
                res = voice.transcribe(self, data, mime, scope, path=self.local(fid), later=more) or {}
                voice.voice_keep(self, fid, res)
            except Exception as ex:
                err = str(ex) or "transcription failed"
            hold.cancel()
            with self.cond:
                job.update(done=True, tr=res.get("tr", ""), err=err, res=res)
                self.words_in(fid, job)
                fwd = list(self.fwd.get(fid, ()))
            for t, tfid in fwd:  # its input went to another project meanwhile (F79): the copy there gets the words
                if not err:
                    voice.voice_keep(t, tfid, res)
                with t.cond:
                    t.words_in(tfid, job)

        threading.Thread(target=work, daemon=True).start()

    def hold_timer(self, job: Job) -> threading.Timer:
        """When an input's hold for its words runs out, whoever waits for work (/next?wait, the organizer) hears it."""
        def over() -> None:
            with self.cond:
                if not job["done"]:
                    self.bump()

        t = threading.Timer(max(0.0, job["t0"] + TR_HOLD - time.time()) + 0.05, over)
        t.daemon = True
        t.start()
        return t

    def words_in(self, fid: str, job: Job) -> None:
        """A voice note's words are in: the input that has the note gets them (under the lock). They come late when an
        agent or the organizer has had the input, or while the organizer works on it: a plan made without them is
        then dropped, and the input is organized again with them (T101)."""
        tr = job["tr"]
        inp = next((i for i in self.inputs.values() if not i.get("moved") and any(f["f"] == fid for f in i["files"])), None)
        if inp and tr and not any(f["f"] == fid and f.get("tr") for f in inp["files"]):
            late = inp["acked"] or inp["org"] or self.org_busy == inp["id"]
            self.emit({"k": "tr", "src": inp["id"], "f": fid, "tr": tr, "by": "you", **({"late": True} if late else {})})
        else:
            self.bump()  # an input waiting for these words goes on without them; the page hears it is done

    def words_more(self, fid: str, was: str, tr: str) -> None:
        """Fuller words for a voice note whose shorter ones were given already (under the lock): the input that has it
        gets them in place of those, as an update when an agent or the organizer had it."""
        inp = next((i for i in self.inputs.values() if not i.get("moved") and any(f["f"] == fid for f in i["files"])), None)
        if inp:
            late = inp["acked"] or inp["org"] or self.org_busy == inp["id"]
            self.emit({"k": "tr", "src": inp["id"], "f": fid, "tr": tr, "was": was, "by": "you", **({"late": True} if late else {})})

    def resume_words(self) -> None:
        """Voice notes sent before their words were in (marked wait) whose transcription a restart or a crash cut off:
        worked out again when Taska starts, so the words still reach their input though the page let go of the
        recording (T101). Words kept next to the audio are used as they are."""
        with self.lock:
            todo = [(f["f"], f.get("mime") or "", i["scope"]) for i in self.inputs.values() if not i.get("moved")
                    for f in i["files"] if f.get("wait") and not f.get("tr") and f["f"] not in self.trs]
        for fid, mime, scope in todo:
            data = b""
            if not voice.voice_saved(self, fid):
                try:
                    with open(self.local(fid), "rb") as fh:
                        data = fh.read()
                except OSError:
                    continue  # its audio is gone
            self.transcribe_later(fid, data, mime, scope)

    # -- changes ----------------------------------------------------------------

    def run(self, op: Op, by: str, ctx: Dict[str, Any]) -> Tuple[str, Any]:
        return ops.run(self, op, by, ctx)

    def run_all(self, ops_: List[Tuple[int, Any]], by: str, src: Optional[str] = None, keep: bool = False) -> Tuple[List[str], List[Any]]:
        """ops: list of (lineno, op dict | Err). keep = link changes to src without marking it handled."""
        return ops.run_all(self, ops_, by, src, keep)

    # -- files ------------------------------------------------------------------

    def save_file(self, name: Optional[str], mime: Optional[str], data: bytes) -> Dict[str, Any]:
        import mimetypes
        with self.lock:
            self.nfile += 1
            base = re.sub(r"[^\w.\-]+", "_", os.path.basename(name or "file"))  # \w keeps CJK and other letters
            if "." not in base:
                base += mimetypes.guess_extension(mime or "") or ""
            fid = f"f{self.nfile}-{base}"
            os.makedirs(self.fdir, exist_ok=True)
            with open(os.path.join(self.fdir, fid), "wb") as f:
                f.write(data)
        return {"f": fid, "name": name or base, "mime": mime or "application/octet-stream", "size": len(data)}

    def local(self, fid: str) -> str:
        return os.path.join(self.fdir, fid)

    # -- views ------------------------------------------------------------------

    def state(self) -> Dict[str, Any]:
        return views.state(self)

    SV_KEYS = (("items", "n"), ("inputs", "id"), ("docs", "d"))

    def state_since(self, since: int = 0, boot: str = "") -> Dict[str, Any]:
        """T293: the state, or only the items, inputs and documents that changed since the page's copy (its change
        number `sv`), with what went away. Every change is found by comparing what would be sent with what was."""
        with self.lock:
            if self.sv_memo and self.sv_memo[0] == (self.rev, self.pv):  # several pages asking after one change: worked out once
                st = dict(self.sv_memo[1])
            else:
                st = self.state_scan()
                self.sv_memo = ((self.rev, self.pv), dict(st))
            if since <= 0 or boot != self.boot or since > self.svn:
                return st
            for kind, idk in self.SV_KEYS:
                st[kind] = [x for x in st[kind] if self.sv[(kind, x[idk])][1] > since]
            st["delta"] = since
            st["drop"] = {kind: [k[1] for k, v in self.sv.items() if k[0] == kind and v[0] is None and v[1] > since]
                          for kind, _ in self.SV_KEYS}
            return st

    def state_scan(self) -> Dict[str, Any]:
        """The whole state, after noting which items, inputs and documents changed since it was last worked out."""
        with self.lock:
            st = self.state()
            now: Set[Tuple[str, Any]] = set()
            for kind, idk in self.SV_KEYS:
                for x in st[kind]:
                    key = (kind, x[idk])
                    now.add(key)
                    h = hashlib.md5(json.dumps(x, sort_keys=True, ensure_ascii=False, default=str).encode()).digest()
                    old = self.sv.get(key)
                    if not old or old[0] != h:
                        self.svn += 1
                        self.sv[key] = [h, self.svn]
            for key, v in self.sv.items():
                if key not in now and v[0] is not None:
                    self.svn += 1
                    v[0], v[1] = None, self.svn
            st["sv"] = self.svn
            return st

    def card(self, it: Item, ref: Optional[Callable[[str], str]] = None) -> str:
        return views.card(self, it, ref)

    def line(self, it: Item) -> str:
        return views.line(self, it)

    def rules_text(self) -> str:
        return views.rules_text(self)

    def next_text(self, ref: Optional[Callable[[str], str]] = None, who: Optional[str] = None, given: Optional[List[int]] = None) -> Tuple[str, bool]:
        return views.next_text(self, ref, who, given)

    def close(self) -> None:
        with self.lock:
            if self.flusher:
                self.flusher.cancel()
            self.write_state()
            self.db.close()

