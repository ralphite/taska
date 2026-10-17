#!/usr/bin/env python3
"""Taska: one-file tracker for what you think of while building, shared with coding agents.

    python3 taska.py                 # http://127.0.0.1:7340, data in ./taska.jsonl (+ ./taska-files/)
    curl -s localhost:7340/agent     # what a coding agent reads first

Standard library only. The UI is the HTML at the bottom (Tailwind via CDN).
With GEMINI_API_KEY set, a built-in organizer turns raw input into item changes and voice notes are
transcribed. Without it, the inbox simply waits for a coding agent. Data is an append-only JSONL log;
state is the replay of that log.
"""

import argparse
import array
import base64
import contextlib
import difflib
import hashlib
import hmac
import http.client
import ipaddress
import json
import io
import math
import mimetypes
import os
import re
import secrets
import shutil
import signal
import subprocess
import sys
import tempfile
import textwrap
import queue
import threading
import wave
import unicodedata
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, unquote, urlsplit

LETTER = {"feature": "F", "bug": "B", "idea": "I", "task": "T", "rule": "R"}
TYPE_OF = {v: k for k, v in LETTER.items()}
PRIS = ("P0", "P1", "P2", "P3")
WHENS = ("now", "later")
STATUSES = ("proposed", "open", "doing", "review", "done", "dropped")
CLOSED = ("done", "dropped")
CLAIM_TTL = 30 * 60  # an agent's hold on an item it works on: quiet longer than this, another agent may take it (F194)
PEOPLE = ("you", "org")  # the organizer writes down what the user said, so it acts for the user
KINDS = ("say", "ask", "block", "withdraw", "propose", "decide", "progress")
WORK_TYPES = ("bug", "feature", "task", "idea")  # what keep-going picks up
TEXT_VERBS = KINDS + ("title", "body", "next")
MAX_TEXT = 200_000
MAX_FILE = 25 * 1024 * 1024
MAX_OPS = 50
TR_HOLD = 150  # seconds an input sent before its voice note's words were in waits for them, at most (B165)
MODEL = os.environ.get("TASKA_MODEL", "gemini-flash-latest")
KEY_VARS = ("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY")


def home_short(path):
    """A path under the home folder as ~/..., the way people read it (and no user name on screen)."""
    home = os.path.expanduser("~")
    return "~" + path[len(home):] if path == home or path.startswith(home + os.sep) else path


class Err(Exception):
    pass


def now():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def hm(t):
    return t[5:10] + " " + t[11:16]


def first_line(s, n=60):
    s = " ".join(str(s).split())
    return s if len(s) <= n else s[: n - 1] + "…"


# --------------------------------------------------------------------------- documents


TABLE_SEP = re.compile(r"\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$")


def md_blocks(md):
    """Split Markdown into blocks (kind, text). Comments attach to a block through its text, so an edit
    that changes a paragraph detaches its comments instead of moving them to another paragraph."""
    out, lines, i = [], md.replace("\r\n", "\n").split("\n"), 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.lstrip().startswith("```"):
            j = i + 1
            while j < len(lines) and not lines[j].lstrip().startswith("```"):
                j += 1
            out.append(("code", "\n".join(lines[i:j + 1])))
            i = j + 1
            continue
        if re.match(r"#{1,6}\s", line):
            out.append(("heading", line))
            i += 1
            continue
        if line.lstrip().startswith("|") and i + 1 < len(lines) and TABLE_SEP.match(lines[i + 1]):  # a Markdown table
            j = i + 2
            while j < len(lines) and lines[j].lstrip().startswith("|"):
                j += 1
            out.append(("table", "\n".join(lines[i:j])))
            i = j
            continue
        kind = "list" if re.match(r"\s*([-*+]|\d+[.)])\s", line) else "quote" if line.lstrip().startswith(">") else "para"
        j = i + 1
        while j < len(lines) and lines[j].strip() and not lines[j].lstrip().startswith("```") and not re.match(r"#{1,6}\s", lines[j]):
            if kind == "para" and re.match(r"\s*([-*+]|\d+[.)])\s|\s*>", lines[j]):
                break
            j += 1
        out.append((kind, "\n".join(lines[i:j])))
        i = j
    return out


DOC_KEY = "doc"  # B247: the thread of comments on the document as a whole (a paragraph's key is 10 hex digits)


def block_key(text):
    return hashlib.sha1(" ".join(text.split()).encode("utf-8")).hexdigest()[:10]


USER_KINDS = ("say", "decide", "propose")  # what the organizer files from your input: your words, your decision, your idea


def edit_note(rid, old, new):
    """S1: what changed in an input, short: the words added, or the part that changed ("old" -> "new")."""
    if new.startswith(old) and old.strip():
        return f"Added to {rid}:\n{new[len(old):].strip()}"
    i = 0
    while i < min(len(old), len(new)) and old[i] == new[i]:
        i += 1
    j = 0
    while j < min(len(old), len(new)) - i and old[-1 - j] == new[-1 - j]:
        j += 1
    word = lambda c: c.isascii() and c.isalnum()
    while i > 0 and word(old[i - 1]):  # whole words, where words have spaces
        i -= 1
    while j > 0 and word(old[len(old) - j]):
        j -= 1
    was, now = old[i:len(old) - j].strip(), new[i:len(new) - j].strip()
    if not old.strip() or len(was) + len(now) > 400:
        return f"Edited {rid}:\n{new}"
    return f"Edited {rid}: \u201c{was}\u201d \u2192 \u201c{now}\u201d"


def user_word(x):
    """A message on an item that is the user's own words: what you wrote there (a reply typed in the box, a picked
    choice, details added), or what the organizer filed there from one of your inputs (an answer written on the list
    goes to the whole project, and the organizer files it here, often as a decision). Any of them answers an open ask
    (B163); the page has the same rule (userWord). The organizer's own notes (merges) and questions are not yours."""
    return x["by"] == "you" or (x["by"] == "org" and x["kind"] in USER_KINDS and bool(x.get("src")))


# --------------------------------------------------------------------------- store


class Store:
    """All state, rebuilt by replaying the log. `apply` never validates; `run` does."""

    def __init__(self, path):
        self.path = os.path.abspath(path)
        self.fdir = os.path.splitext(self.path)[0] + "-files"
        self.lock = threading.RLock()
        self.cond = threading.Condition(self.lock)
        self.items, self.inputs, self.events = {}, {}, []
        self.qids = {}  # the page's id for an input it sent -> the input: sent again after a lost answer, it goes in once (T101)
        self.undone = set()  # seqs of your changes that were put back (F80)
        self.org_off, self.took = set(), {}  # organizer changes taken back by an undo; each undo's list of them (T113 A4)
        self.stash = {}  # each deletion's seq -> what it took out of the items that stay, for a restore (F177)
        self.rev = 0  # bumps on every change, including transient organizer state
        self.boot = format(int(time.time() * 1000), "x")  # rev restarts with the process; boot tells pages apart
        self.maxn = self.nin = self.nfile = 0
        self.cfg = {"auto": True}  # auto = keep-going: agents keep taking the next item (on unless turned off); name: what people call it (F173)
        self.name, self.gone = "", False  # name: the project's address and folder; gone: deleted while this ran (F173)
        self.docs, self.maxd = {}, 0
        self.org_on, self.org_busy = False, None
        self.trs = {}  # voice notes being transcribed in the background, by file (B165): t0, done, tr, err
        self.claims = {}  # n -> (agent, time): what /next gave an agent, so another one asking now gets something else (F194)
        self.fwd = {}  # file -> [(project, file)]: copies of notes whose input moved before their words came (F79, T101)
        if os.path.exists(self.path):
            with open(self.path, encoding="utf-8") as f:
                for i, line in enumerate(f, 1):
                    if line.strip():
                        try:
                            self.apply(json.loads(line))
                        except Exception as ex:  # a damaged line must not stop the app
                            print(f"taska: skipped line {i}: {ex}", file=sys.stderr)
        if os.path.isdir(self.fdir):
            for name in os.listdir(self.fdir):
                m = re.match(r"f(\d+)-", name)
                if m:
                    self.nfile = max(self.nfile, int(m.group(1)))
        self.out = open(self.path, "a", encoding="utf-8")
        self.agents_file = os.path.join(os.path.dirname(self.path), "agents.json")
        try:  # name -> {"t": last call, "waiting": how many /next?wait calls it holds now}
            with open(self.agents_file, encoding="utf-8") as f:
                self.agents = {k: {"t": v, "waiting": 0} for k, v in json.load(f).items()}
        except (OSError, ValueError):  # first run: when did each agent last write here?
            self.agents = {}
            for e in self.events:
                if e.get("by") and e["by"] not in PEOPLE and e.get("t"):
                    try:
                        self.agents[e["by"]] = {"t": datetime.fromisoformat(e["t"]).timestamp(), "waiting": 0}
                    except ValueError:
                        pass
        self.reads_file = os.path.join(os.path.dirname(self.path), "reads.json")
        try:  # F220: item -> agent -> when it last read it (the item's card, or /next giving it)
            with open(self.reads_file, encoding="utf-8") as f:
                self.reads = {int(n): dict(v) for n, v in json.load(f).items()}
        except (OSError, ValueError):
            self.reads = {}
        self.pv, self.saved = 0, 0  # pv: bumps when an agent turns up, starts or stops waiting
        if self.out.tell() and not self._ends_with_newline():
            self.out.write("\n")

    def _ends_with_newline(self):
        with open(self.path, "rb") as f:
            f.seek(-1, os.SEEK_END)
            return f.read(1) == b"\n"

    # -- replay ---------------------------------------------------------------

    def touch(self, n, rid, ack=True):
        it, inp = self.items.get(n), self.inputs.get(rid)
        if it and rid and rid not in it["srcs"]:
            it["srcs"].append(rid)
        if inp:
            if n not in inp["touched"]:
                inp["touched"].append(n)
            if ack:
                inp["acked"] = True

    def entry(self, it, e, kind, text, src=None, files=None):
        it["thread"].append({"id": e["seq"], "by": e["by"], "kind": kind, "text": text, "t": e["t"], "src": src, "files": files or []})
        it["t1"] = e["t"]

    def apply(self, e):
        self.rev += 1
        self.events.append(e)
        e["seq"] = len(self.events)
        k = e["k"]
        if k == "in":
            inp = {"id": e["id"], "t": e["t"], "by": e["by"], "text": e.get("text", ""), "scope": e.get("scope"),
                   "files": e.get("files", []), "acked": False, "touched": [], "org": None, "from": e.get("from"), "seq": e["seq"]}
            self.inputs[inp["id"]] = inp
            self.nin = max(self.nin, int(inp["id"][1:]))
            if e.get("q"):
                self.qids[e["q"]] = inp["id"]
            it = self.items.get(inp["scope"])
            if it:
                self.entry(it, e, "say", inp["text"], inp["id"])
                self.touch(it["n"], inp["id"], ack=False)
        elif k == "add":
            n = e["n"]
            self.maxn = max(self.maxn, n)
            e["title"], named = clean_title(e["title"])  # "[src=r246] …" from an agent (B222); the log stays as it was
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
            took = self.stash[e["seq"]] = []  # the items that stay lose it from their sources, and its words on them
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
                it = self.items.get(inp["scope"])
                if it:  # its message on the item goes with it
                    it["thread"] = [x for x in it["thread"] if x["id"] != inp["seq"]]
                    if inp["id"] in it["srcs"] and inp["id"] not in [x.get("src") for x in it["thread"]]:
                        it["srcs"].remove(inp["id"])
        elif k == "org":
            inp = self.inputs.get(e["src"])
            if inp:
                inp["org"] = None if e.get("retry") else {"ok": e["ok"], "msg": e["msg"], "t": e["t"], "keep": e.get("keep", "Left for your coding agent" in e["msg"]), "changed": e.get("changed", False)}
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
        elif k == "dc":
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
                elif c:
                    d["comments"].remove(c)
                    d.setdefault("gone", {})[e["id"]] = c
        if e.get("by") and e["by"] not in PEOPLE and k in ("add", "set", "say") and e.get("n") in self.items:
            self.items[e["n"]]["agent"] = {"by": e["by"], "t": e["t"]}  # who works on it, and since when it was last heard of (F194)

    def touches(self, e):
        """The items an event changes or adds to: a change, a message, a reply, a subitem, a document, a comment."""
        out = [e[k] for k in ("n", "into", "scope", "parent") if e.get(k)] + list(e.get("ns") or [])
        f = e.get("f")  # a set's fields; a voice note's file name on "tr" events
        if isinstance(f, dict) and f.get("parent"):
            out.append(f["parent"])
        if e["k"] in ("dc", "dcedit", "dcdel", "dcundel") and e["d"] in self.docs:
            out.append(self.docs[e["d"]]["n"])
        return out

    def touched_since(self, n, seq):
        """Did anything happen to item n after event `seq`?"""
        return any(n in self.touches(e) for e in self.events[seq:])

    FILED_WAS = {"proposed": "proposed", "open": "open", "doing": "in progress", "review": "in review", "done": "done", "dropped": "won't do"}

    def filings(self):
        """What the organizer last did with each input (since its last edit), in words, and whether all of it is still as
        it left it (T113 A4): an undo then takes back only its own work, not what you or an agent did after.
        -> {rid: {"can": bool, "what": "removes F08 · B12 back to P2", "why": "F08 changed since"}}"""
        last, by_src = {}, {}
        for e in self.events:
            for m in self.touches(e):
                last[m] = e["seq"]
            if e.get("by") == "org" and e.get("src") and e["k"] in ("add", "set", "say", "merge") and e["seq"] not in self.org_off:
                by_src.setdefault(e["src"], []).append(e)
        out = {}
        for rid, xs in by_src.items():
            inp = self.inputs.get(rid)
            if not inp or inp.get("deleted") or not inp["org"] or not inp["org"].get("ok") or inp["org"].get("undone"):
                continue
            xs = [x for x in xs if x["seq"] > inp.get("edit_seq", 0)]
            mine = {m: x["seq"] for x in xs for m in (x.get("n"), x.get("into")) if m}
            changed = [m for m, s in mine.items() if last.get(m, 0) > s]
            words = []
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

    def redo_blocked(self, rid):
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

    def show_edit(self, inp, e, mark=True):
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

    def undo(self, e):
        """Revert the organizer's changes for input e["src"]; fields changed again since stay as they are."""
        rid = e["src"]
        since = self.inputs.get(rid, {}).get("edit_seq", 0)
        took = self.took[e["seq"]] = []
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

    def redo(self, e):
        """Put back what the last undo of input e["src"]'s filing took back (T113 A4): Z after "Undo filing"."""
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
                    b["thread"].append({"id": seq, "by": x["by"], "kind": "progress", "text": f"Merged in {self.code(it['n'])}: {it['title']}", "t": x["t"], "src": x.get("src"), "files": []})
                    b["thread"].sort(key=lambda t: t["id"])
        o = next((x for x in reversed(self.events[:u["seq"] - 1]) if x["k"] == "org" and x.get("src") == rid and not x.get("retry")), None)
        if o and rid in self.inputs:
            keep = o.get("keep", "Left for your coding agent" in o["msg"])
            self.inputs[rid].update(acked=not keep, org={"ok": o["ok"], "msg": o["msg"], "t": o["t"], "keep": keep, "changed": o.get("changed", False)})

    # -- deleting an input (F177) ------------------------------------------------
    # Delete moves an input to Deleted, with the items only it made, as long as no agent has worked on them. An item
    # that has other inputs, or that an agent changed or wrote on, stays: it only loses this input from its sources (and
    # the input's own words on it). Nothing is erased: Restore, Undo or Z put all of it back.

    def deletions(self, only=None):
        """What deleting each input would do: {rid: {"go": [n], "keep": [[n, why]]}}, for the inputs `only` (default all)."""
        made, hands = {}, set()
        for e in self.events:
            if e["k"] == "add" and e.get("src"):
                made.setdefault(e["src"], []).append(e["n"])
            if e.get("by") and e["by"] not in PEOPLE:  # an agent's change, message, subitem, document or comment, not its making the item
                hands.update(m for m in self.touches(e) if not (e["k"] == "add" and m == e["n"]))
        out = {}
        for rid in (only or [r for r, i in self.inputs.items() if not i.get("deleted")]):
            go, keep = [], {}
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

    def deleted_list(self):
        """Deleted inputs, newest deletion first, with what went with them: Settings › Deleted restores them."""
        rows = [i for i in self.inputs.values() if i.get("deleted")]
        rows.sort(key=lambda i: -i["deleted"]["seq"])
        item = lambda n: {"n": n, "code": self.code(n), "title": self.items[n]["title"], "type": self.items[n]["type"]}
        return [{"id": i["id"], "t": i["t"], "at": i["deleted"]["t"], "text": i["text"], "files": len(i["files"]), "scope": i["scope"],
                 "items": [item(n) for n in i["deleted"]["ns"] if n in self.items],
                 "kept": [dict(item(n), why=why) for n, why in i["deleted"]["kept"] if n in self.items]} for i in rows]

    def gone_note(self, it, by):
        """What an agent hears when it writes to an item the user deleted (F177)."""
        if not it.get("deleted") or by in PEOPLE:
            return ""
        return f" (note: the user deleted {self.code(it['n'])} together with input {it['deleted']}: stop working on it)"

    @property
    def title(self):
        """What the project is called (F173): any name; its address (self.name) was made from it once and never changes."""
        return self.cfg.get("name") or self.name

    def emit(self, e):
        if self.gone:
            raise Err(f"project {self.name} was deleted")
        e["t"] = now()
        self.out.write(json.dumps(e, ensure_ascii=False, separators=(",", ":")) + "\n")
        self.out.flush()
        self.apply(e)
        self.cond.notify_all()

    def bump(self):
        self.rev += 1
        self.cond.notify_all()

    # -- lookups --------------------------------------------------------------

    def code(self, n):
        it = self.items.get(n)
        return (LETTER[it["type"]] if it else "?") + str(n).zfill(len(str(self.maxn)))

    def item(self, ref, ctx=None, follow=True):
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

    def doc(self, ref):
        m = re.fullmatch(r"[Dd]?(\d+)", str(ref).strip())
        d = self.docs.get(int(m.group(1))) if m else None
        if not d:
            raise Err(f"no document {ref}")
        return d

    def doc_view(self, d):
        """Blocks with their comment threads; threads whose paragraph changed come back as `detached`."""
        blocks, keys = [], set()
        for kind, text in md_blocks(d["md"]):
            key = block_key(text)
            first = key not in keys
            keys.add(key)
            blocks.append({"key": key, "kind": kind, "text": text,
                           "comments": [c for c in d["comments"] if c["key"] == key] if first else []})
        detached = {}
        for c in d["comments"]:
            if c["key"] not in keys and c["key"] != DOC_KEY:
                detached.setdefault(c["key"], {"key": c["key"], "quote": c["quote"], "comments": []})["comments"].append(c)
        return blocks, list(detached.values())

    @staticmethod
    def doc_whole(d):
        """B247: the comments on the document as a whole."""
        return [c for c in d["comments"] if c["key"] == DOC_KEY]

    def doc_open(self, d):
        """Threads whose last word is the user's: the agent should answer them."""
        last = {}
        for c in d["comments"]:
            last[c["key"]] = c["by"]
        return sum(1 for by in last.values() if by == "you")

    def doc_text(self, d):
        blocks, detached = self.doc_view(d)
        titled = blocks and " ".join(blocks[0]["text"].lstrip("#").split()) == d["title"]
        out = [f"D{d['d']} on {self.code(d['n'])}{'' if titled else ': ' + d['title']}  (updated {hm(d['t1'])} by {d['by']}; reply with: D{d['d']} reply ¶N <text>, ¶0 for the whole document)"]
        whole = self.doc_whole(d)
        if whole:  # B247
            out.append("¶0 comments on the whole document:")
            for c in whole:
                out.append(f"   > {c['by']} {hm(c['t'])}: {c['text']}" + "".join(f" [{self.local(f['f'])}]" for f in c.get("files", [])))
        for i, b in enumerate(blocks, 1):
            out.append(f"¶{i} " + b["text"].replace("\n", "\n   "))
            for c in b["comments"]:
                part = "" if " ".join(c["quote"].split()) == " ".join(b["text"].split()) else f"on \"{first_line(c['quote'], 120)}\": "
                out.append(f"   > {c['by']} {hm(c['t'])}: {part}{c['text']}" + "".join(f" [{self.local(f['f'])}]" for f in c.get("files", [])))
        if detached:
            out.append("comments whose paragraph was rewritten or removed:")
            for t in detached:
                out.append(f"   on \"{first_line(t['quote'], 80)}\"")
                for c in t["comments"]:
                    out.append(f"   > {c['by']} {hm(c['t'])}: {c['text']}")
        return "\n".join(out) + "\n"

    @staticmethod
    def waiting(it):
        """The open ask/block an agent posted that the user has not answered yet. Whatever the user says after it
        answers it, a picked choice or not (B163): the list, the item, Go through and /next all read it here."""
        for x in reversed(it["thread"]):
            if user_word(x) or x["kind"] == "withdraw":
                return None
            if x["kind"] in ("ask", "block"):
                return x
        return None

    @staticmethod
    def replied(it):
        """The user wrote after an agent's last word on this item: the agent should pick it up."""
        user = False
        for x in reversed(it["thread"]):
            if user_word(x):
                user = True
            elif x["by"] != "org":  # the organizer's own notes are neither side's word
                return user
        return False

    def for_agent(self):
        """Inputs a coding agent should handle (the organizer, when on, sees them first)."""
        return [i for i in self.pending() if (not self.org_on or i["org"]) and not (i["org"] or {}).get("undone")  # undone: parked until the user asks again
                and not self.held(i)]

    # -- voice notes (B165): you can send before the words are in. The message goes at once with its recording; the
    # words are worked out meanwhile and added to it, and agents and the organizer get it once they are in.

    def held(self, inp):
        """An input whose voice note is still being transcribed: it waits for its words (at most TR_HOLD seconds)."""
        now = time.time()
        return any((j := self.trs.get(f["f"])) and not j["done"] and now - j["t0"] < TR_HOLD for f in inp["files"])

    def with_words(self, text, files):
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

    def saved_job(self, fid):
        """A voice note worked out before, its words kept next to its audio (T101), as a finished job."""
        res = voice_saved(self, fid)
        if res:  # fuller words still to come were lost with the restart that came between
            res = {k: v for k, v in res.items() if k != "more"}
        return {"t0": time.time(), "done": True, "tr": res.get("tr", ""), "err": "", "res": res} if res else None

    def transcribe_later(self, fid, data, mime, scope):
        """Start working out a voice note's words in the background; an input that has the note by then gets them.
        Words kept next to the audio from before (a restart, a page asking again) are used as they are (T101)."""
        saved = self.saved_job(fid)
        with self.cond:
            job = self.trs[fid] = saved or {"t0": time.time(), "done": False, "tr": "", "err": ""}
            if saved:
                return self.words_in(fid, job)
        hold = self.hold_timer(job)

        def more(words):  # the strong model's words after its cap: fuller ones replace those given
            with self.cond:
                self.cond.wait_for(lambda: job["done"], timeout=PRO_LATE)
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
            voice_keep(self, fid, res)

        def work():
            res, err = {}, ""
            try:
                res = transcribe(self, data, mime, scope, path=self.local(fid), later=more) or {}
                voice_keep(self, fid, res)
            except Exception as ex:
                err = str(ex) or "transcription failed"
            hold.cancel()
            with self.cond:
                job.update(done=True, tr=res.get("tr", ""), err=err, res=res)
                self.words_in(fid, job)
                fwd = list(self.fwd.get(fid, ()))
            for t, tfid in fwd:  # its input went to another project meanwhile (F79): the copy there gets the words
                if not err:
                    voice_keep(t, tfid, res)
                with t.cond:
                    t.words_in(tfid, job)
        threading.Thread(target=work, daemon=True).start()

    def hold_timer(self, job):
        """When an input's hold for its words runs out, whoever waits for work (/next?wait, the organizer) hears it."""
        def over():
            with self.cond:
                if not job["done"]:
                    self.bump()
        t = threading.Timer(max(0.0, job["t0"] + TR_HOLD - time.time()) + 0.05, over)
        t.daemon = True
        t.start()
        return t

    def words_in(self, fid, job):
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

    def words_more(self, fid, was, tr):
        """Fuller words for a voice note whose shorter ones were given already (under the lock): the input that has it
        gets them in place of those, as an update when an agent or the organizer had it."""
        inp = next((i for i in self.inputs.values() if not i.get("moved") and any(f["f"] == fid for f in i["files"])), None)
        if inp:
            late = inp["acked"] or inp["org"] or self.org_busy == inp["id"]
            self.emit({"k": "tr", "src": inp["id"], "f": fid, "tr": tr, "was": was, "by": "you", **({"late": True} if late else {})})

    def resume_words(self):
        """Voice notes sent before their words were in (marked wait) whose transcription a restart or a crash cut off:
        worked out again when Taska starts, so the words still reach their input though the page let go of the
        recording (T101). Words kept next to the audio are used as they are."""
        with self.lock:
            todo = [(f["f"], f.get("mime") or "", i["scope"]) for i in self.inputs.values() if not i.get("moved")
                    for f in i["files"] if f.get("wait") and not f.get("tr") and f["f"] not in self.trs]
        for fid, mime, scope in todo:
            data = b""
            if not voice_saved(self, fid):
                try:
                    with open(self.local(fid), "rb") as fh:
                        data = fh.read()
                except OSError:
                    continue  # its audio is gone
            self.transcribe_later(fid, data, mime, scope)

    def rules(self):
        return [i for i in self.sorted(self.active()) if i["type"] == "rule" and i["status"] not in CLOSED + ("proposed",) and not i["archived"]]

    def rules_text(self):
        rows = self.rules()
        out = [f"{len(rows)} project rule{'s' if len(rows) != 1 else ''} in force. Follow the ones that apply to what you are doing." if rows else "No project rules yet."]
        for it in rows:
            out.append(f"{self.code(it['n'])} {it['title']}" + ("\n" + textwrap.indent(it["body"], "  ") if it["body"] else ""))
        return "\n".join(out) + "\n"

    def mode(self):
        return "keep-going ON" if self.cfg["auto"] else "keep-going OFF"

    def next_text(self, ref=None, who=None, given=None):
        """-> (text, has_work). who: the agent asking: items another agent is on are skipped for it (F194). given (a
        list) gets the item whose card it holds, if any."""
        if self.gone:
            return f"Project {self.name} was deleted: there is no work here. The user can restore it in Taska (Settings › Projects).\n", False
        auto = self.cfg["auto"]
        out = [self.mode() + (": keep working without stopping. After each item, write back, then GET /next again."
                              if auto else ": finish what you are doing, write back, then stop and wait for the user.")]
        if self.rules():
            out.append(f"{len(self.rules())} project rule{'s' if len(self.rules()) != 1 else ''}: read GET /rules once per session and follow those that apply.")
        live = self.sorted(i for i in self.active() if i["status"] not in CLOSED)
        talking = {n for r in self.inputs.values() if self.held(r) for n in [r["scope"], *r["touched"]] if n}  # B165
        for label, rows in (("waiting on the user (skip)", [i for i in live if self.waiting(i)]),
                            ("proposed, the user has not approved yet (skip)", [i for i in live if i["status"] == "proposed"]),
                            ("in review, the user accepts them (skip)", [i for i in live if i["status"] == "review"]),
                            ("the user's voice note on it is being transcribed (skip, it comes next)", [i for i in live if i["n"] in talking])):
            if rows:
                out.append(f"{label}: " + " ".join(self.code(i["n"]) for i in rows))
        inbox = self.for_agent()
        if inbox:
            return "\n".join(out) + f"\nfirst handle the inbox ({len(inbox)}):\n" + "".join(self.input_card(i, ref) + "\n" for i in sorted(inbox, key=lambda i: int(i["id"][1:]))), True
        docs = [d for d in self.docs.values() if self.doc_open(d) and self.items.get(d["n"]) and not self.items[d["n"]]["merged_into"] and not self.items[d["n"]].get("deleted")]
        if docs:
            d = min(docs, key=lambda d: d["t1"])
            return "\n".join(out) + f"\nanswer the user's comments on D{d['d']} (GET /D{d['d']}):\n" + self.doc_text(d), True
        live = [i for i in live if i["n"] not in talking]  # their latest words are not in yet: they come next
        back = sorted((i for i in live if self.replied(i)), key=lambda i: i["t1"])
        if back:
            if given is not None:
                given.append(back[0]["n"])
            return "\n".join(out) + f"\nresume {self.code(back[0]['n'])}: the user replied\n" + self.card(back[0], ref), True
        queue = sorted((i for i in live if i["when"] == "now" and i["type"] in WORK_TYPES and i["status"] in ("open", "doing") and not self.waiting(i)
                        and not self.open_kids(i)),  # subitems first: the parent comes when they are finished
                       key=lambda i: (i["status"] != "doing", i["pri"], i.get("rank") is None, i.get("rank") or 0, i["n"]))  # same priority: what you put next, then oldest first (F197)
        if who:  # F194: what another agent is on is theirs; each agent gets its own next item
            theirs = [(i, c[0]) for i in queue for c in [self.claimer(i)] if c and c[0] != who]
            if theirs:
                out.append("others are on (skip): " + " ".join(f"{self.code(i['n'])} ({a})" for i, a in theirs))
                queue = [i for i in queue if all(i is not x for x, _ in theirs)]
        if queue:
            it = queue[0]
            if who:
                self.claims[it["n"]] = (who, time.time())
            if given is not None:
                given.append(it["n"])
            how = ("\nan idea: think it through first. Small and clear: do it. Bigger, or more than one way to go: "
                   f"post your plan ({self.code(it['n'])} propose ...) and ask before building.") if it["type"] == "idea" else ""
            return "\n".join(out) + f"\nnext {self.code(it['n'])} ({len(queue)} in queue: doing first, then P0→P3, oldest first){how}\n" + self.card(it, ref), True
        idle = "nothing to do now." + (" Wait for work: GET /next?wait=540 (returns as soon as something comes in)." if auto else "")
        return "\n".join(out) + "\n" + idle + "\n", False

    def claimer(self, it, now=None):
        """The agent working on an item (F194): the last one /next gave it to or that wrote to it, while it is fresh
        (CLAIM_TTL). Quiet longer than that, the item is free again for any agent."""
        now = now or time.time()
        c = self.claims.get(it["n"])
        best = c if c and now - c[1] < CLAIM_TTL else None
        a = it.get("agent")
        if a and it["status"] == "doing":
            t = datetime.fromisoformat(a["t"]).timestamp()
            if now - t < CLAIM_TTL and (not best or t >= best[1]):
                best = (a["by"], t)
        return best

    def saw(self, name, waiting=0):
        """An agent called the API (waiting: +1 when it starts holding /next?wait, -1 when that returns)."""
        name = re.sub(r"[^\w .-]", "", str(name or "agent"))[:40] or "agent"
        with self.cond:
            a = self.agents.setdefault(name, {"t": 0, "waiting": 0})
            now = time.time()
            before = (a["waiting"] > 0, now - a["t"] < 600)
            a["t"], a["waiting"] = now, max(0, a["waiting"] + waiting)
            if (a["waiting"] > 0, True) != before:
                self.pv += 1
                self.cond.notify_all()
            if (waiting or now - self.saved > 60) and not self.gone:
                self.saved = now
                try:
                    with open(self.agents_file, "w", encoding="utf-8") as f:
                        json.dump({k: v["t"] for k, v in self.agents.items()}, f)
                except OSError:
                    pass

    def read_item(self, n, name):
        """F220: an agent read item n (its card, or /next gave it): the page says "Read by" under your last words."""
        name = re.sub(r"[^\w .-]", "", str(name or "agent"))[:40] or "agent"
        if name in PEOPLE or n not in self.items:
            return
        with self.cond:
            self.reads.setdefault(n, {})[name] = time.time()
            self.pv += 1
            self.cond.notify_all()
            if not self.gone:
                try:
                    with open(self.reads_file + ".tmp", "w", encoding="utf-8") as f:
                        json.dump({str(k): v for k, v in self.reads.items()}, f)
                    os.replace(self.reads_file + ".tmp", self.reads_file)
                except OSError:
                    pass

    def read_next(self, name):
        """An agent read /next: inputs older than this are ones it has been told about (T117)."""
        name = re.sub(r"[^\w .-]", "", str(name or "agent"))[:40] or "agent"
        with self.cond:
            self.agents.setdefault(name, {"t": 0, "waiting": 0})["next"] = time.time()

    def news_for(self, name):
        """Inputs for the agent that came in after it last read /next: it hears of them when it writes back, at a
        natural stop, instead of being woken in the middle of its work (T117)."""
        name = re.sub(r"[^\w .-]", "", str(name or "agent"))[:40] or "agent"
        since = self.agents.get(name, {}).get("next")
        if not since:
            return []
        return [i["id"] for i in sorted(self.for_agent(), key=lambda i: int(i["id"][1:])) if datetime.fromisoformat(i["t"]).timestamp() >= int(since)]  # times are kept to the second

    def presence(self):
        """What the page shows about agents: who came when, who waits now, and whether work is waiting for them."""
        return {"agents": [{"name": k, "t": int(v["t"] * 1000), "waiting": v["waiting"] > 0} for k, v in self.agents.items()],
                "work": bool(self.cfg["auto"] and self.next_text()[1])}

    def active(self):
        return [i for i in self.items.values() if not i["merged_into"] and not i.get("deleted")]  # deleted: in Deleted (F177)

    def open_kids(self, it):
        """Subitems not finished yet (any depth): a parent is done when they are."""
        out, todo = [], [it["n"]]
        while todo:
            n = todo.pop()
            for k in self.items.values():
                if k["parent"] == n and not k["merged_into"] and not k.get("deleted"):
                    todo.append(k["n"])
                    if k["status"] not in CLOSED:
                        out.append(k)
        return out

    def sorted(self, items):
        return sorted(items, key=lambda i: (i["when"] != "now", i["pri"], i["n"]))  # same priority: oldest first

    def undoable(self, limit=5, scan=600):
        """Your latest changes that can still be put back (F80), newest first: field changes by you that nobody
        changed again since. An undo and the change it put back cancel out, so undoing again walks further back."""
        out, seen = [], set()
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

    def pending(self):
        return [i for i in self.inputs.values() if not i["acked"] and not i.get("deleted")]

    # -- validation + execution -------------------------------------------------

    def field(self, f, v, ctx=None, me=None):
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
            p = self.item(v, ctx)
            if me is not None:
                up = p
                while up:
                    if up["n"] == me["n"]:
                        raise Err("parent loop")
                    up = self.items.get(up["parent"])
            return p["n"]
        else:
            raise Err(f"unknown field '{f}'")
        return v

    def op_files(self, op):
        """The uploaded files an op brings along, checked to exist."""
        files = []
        for f in op.get("files") or []:
            fid = os.path.basename(str(f.get("f", "")))
            if not os.path.isfile(os.path.join(self.fdir, fid)):
                raise Err(f"unknown file {fid}")
            files.append({k: f[k] for k in ("f", "name", "mime", "size", "tr") if k in f})
            files[-1]["f"] = fid
        return files

    def run(self, op, by, ctx):
        """Validate and apply one op. Returns (result line, label) or raises Err."""
        name, src = op.get("op"), op.get("src") or ctx.get("src")
        keep = {"keep": True} if ctx.get("keep") else {}  # linked to src, but src stays unhandled
        if src and src not in self.inputs:
            raise Err(f"unknown input {src}")
        if name == "input":
            q = str(op.get("q") or "")[:64]
            if q in self.qids:  # the page sent it again because the answer got lost: it is in already
                return f"ok {self.qids[q]}", "Received"
            files = self.op_files(op)
            text = self.with_words(str(op.get("text") or "").strip(), files)[:MAX_TEXT]
            if not text and not files:
                raise Err("empty input")
            scope = self.item(op["scope"])["n"] if op.get("scope") else None  # a merged item's replies go where it went (B5)
            rid = f"r{self.nin + 1}"
            e = {"k": "in", "id": rid, "by": by, "text": text, "scope": scope, "files": files}
            if op.get("from") == "rules":
                e["from"] = "rules"
            if q:
                e["q"] = q
            self.emit(e)
            return f"ok {rid}", "Received"
        if name == "correct":  # F144: the wrong words in an input, fixed there and remembered for every project
            rid = str(op.get("id") or "")
            inp = self.inputs.get(rid)
            if not inp:
                raise Err(f"unknown input {rid}")
            wrong, right = " ".join(str(op.get("wrong") or "").split()), " ".join(str(op.get("right") or "").split())
            if not wrong or wrong not in inp["text"]:
                raise Err(f"{rid} does not say that")
            if HUB:
                HUB.correct(wrong, right)
            op, name = {"op": "amend", "id": rid, "mode": "edit", "v": op.get("v"), "text": inp["text"].replace(wrong, right)}, "amend"
        if name == "amend":
            rid = str(op.get("id") or "")
            inp = self.inputs.get(rid)
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
            files = self.op_files(op)
            text = self.with_words(str(op.get("text") or "").strip(), files)
            if not text and not files:
                raise Err("enter some text")
            if mode == "append":
                text = (inp["text"] + ("\n\n" + text if text else "")).strip()
            if len(text) > MAX_TEXT:
                raise Err(f"input is too long (maximum {MAX_TEXT} characters)")
            if text == inp["text"] and not files:
                return f"ok {rid} unchanged", "Unchanged"
            self.emit({"k": "amend", "src": rid, "mode": mode, "text": text, "by": by, **({"files": files} if files else {})})
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
                d = self.doc(op["d"])
                self.emit({"k": "doc", "d": d["d"], "n": d["n"], "title": title, "md": md, "by": by})
                return f"ok D{d['d']} updated" + self.gone_note(self.items.get(d["n"], {}), by), f"Updated D{d['d']}"
            it = self.item(op.get("ref", ""), ctx)
            dn = self.maxd + 1
            self.emit({"k": "doc", "d": dn, "n": it["n"], "title": title, "md": md, "by": by})
            return f"ok D{dn} new on {self.code(it['n'])}" + self.gone_note(it, by), f"Wrote D{dn}"
        if name == "dc":  # a comment on one paragraph of a document, or on all of it (key "doc", ¶0: B247)
            d = self.doc(op.get("d"))
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
                text_ = next((t for _, t in blocks if block_key(t) == key), None)
                old = next((c for c in d["comments"] if c["key"] == key), None)
                if text_ is None and not old:
                    raise Err("that paragraph is not in the document")
                text_ = text_ if text_ is not None else old["quote"]
            files = self.op_files(op)  # F184: a voice comment brings its recording; its words are in the text
            body = self.with_words(str(op.get("text", "")).strip(), files)[:MAX_TEXT]
            for f in files:  # words still to come stay with the recording: the page waits for them before it sends
                f.pop("wait", None)
            if not body and not files:
                raise Err("empty comment")
            quote = " ".join(str(op.get("quote") or "").split()) or text_  # what the user selected, else the paragraph
            self.emit({"k": "dc", "d": d["d"], "key": key, "quote": quote[:500], "text": body, "by": by, **({"files": files} if files else {})})
            return f"ok D{d['d']} comment" + self.gone_note(self.items.get(d["n"], {}), by), f"Commented on D{d['d']}"
        if name in ("dcedit", "dcdel", "dcundel"):  # B258: you change or delete a comment of yours, or bring it back
            d = self.doc(op.get("d"))
            cid = int(op.get("id") or 0)
            c = (d.get("gone") or {}).get(cid) if name == "dcundel" else next((c for c in d["comments"] if c["id"] == cid), None)
            if not c:
                raise Err(f"D{d['d']} has no comment {cid}" + (" to restore" if name == "dcundel" else ""))
            if by not in PEOPLE or (name == "dcedit" and c["by"] not in PEOPLE):
                raise Err("only the user deletes comments, and edits only their own")  # F262: an agent's comment can go too
            if name == "dcedit":
                text_ = str(op.get("text") or "").strip()[:MAX_TEXT]
                if not text_ and not c.get("files"):
                    raise Err("empty comment: delete it instead")
                self.emit({"k": "dcedit", "d": d["d"], "id": cid, "text": text_, "by": by})
                return f"ok D{d['d']} comment {cid} edited", f"Edited a comment on D{d['d']}"
            self.emit({"k": name, "d": d["d"], "id": cid, "by": by})
            return f"ok D{d['d']} comment {cid} {'deleted' if name == 'dcdel' else 'restored'}", f"{'Deleted' if name == 'dcdel' else 'Restored'} a comment on D{d['d']}"
        if name == "cfg":
            if "auto" in op and "name" not in op:  # T260: there is no switch any more
                return f"ok {self.mode()} (always on)", ""
            f = {}
            if "name" in op:  # the project's name for people (F173); its address stays
                f["name"] = title_of(op["name"])
            if not f:
                raise Err("cfg needs auto or name")
            self.emit({"k": "cfg", "f": f, "by": by})
            return f"ok {self.mode()}" if "auto" in f else f"ok named {f['name']}", ""
        if name == "ack":
            ids = [i for i in op.get("ids", []) if i in self.inputs]
            bad = [i for i in op.get("ids", []) if i not in self.inputs]
            if bad:
                raise Err(f"unknown input {' '.join(bad)}")
            self.emit({"k": "ack", "ids": ids, "by": by})
            return "ok ack " + " ".join(ids), ""
        if name == "new":
            title = self.field("title", op.get("title", ""))
            e = {"k": "add", "n": self.maxn + 1, "by": by, "title": title, "src": src,
                 "type": self.field("type", op.get("type") or "idea"), "pri": self.field("pri", op.get("pri") or "P2"),
                 "when": self.field("when", op.get("when") or "now"),
                 "status": "proposed" if by not in PEOPLE else self.field("status", op.get("status") or "open"),
                 "body": self.field("body", op.get("body") or ""), "next": self.field("next", op.get("next") or "")}
            e["parent"] = self.field("parent", op["parent"], ctx) if op.get("parent") else None
            self.emit({**e, **keep})
            ctx["last"] = e["n"]
            return f"ok {self.code(e['n'])} new" + (" (proposed: the user approves it before anyone works on it)" if e["status"] == "proposed" else ""), "Created " + self.code(e["n"])
        if name == "archive":  # many items in one change (T113 A5): the page's "Archive N" and its Undo, any number
            on, ns, skip = bool(op.get("on", True)), [], []
            for r in op.get("refs") or []:
                it = self.item(r, ctx, follow=False)
                if it["archived"] == on or it["n"] in ns:
                    continue
                if on and it["status"] not in CLOSED:
                    skip.append(self.code(it["n"]))
                    continue
                ns.append(it["n"])
            word = "archived" if on else "unarchived"
            if ns:
                self.emit({"k": "arch", "ns": ns, "on": on, "by": by})
            return f"ok {word} {len(ns)}" + (f"; not finished, so not archived: {' '.join(skip)}" if skip else ""), f"{word.capitalize()} {len(ns)}"
        if name in ("delete", "restore"):  # F177: an input to Deleted with the items only it made, and back
            rid = str(op.get("id") or "")
            inp = self.inputs.get(rid)
            if not inp:
                raise Err(f"unknown input {rid}")
            if by not in PEOPLE:
                raise Err("only the user deletes inputs")
            if name == "restore":
                gone = inp.get("deleted")
                if not gone:
                    raise Err(f"{rid} is not deleted")
                self.emit({"k": "undel", "src": rid, "ns": gone["ns"], "by": by})
                return f"ok {rid} restored" + (" with " + " ".join(self.code(n) for n in gone["ns"]) if gone["ns"] else ""), f"Restored {rid}"
            if inp.get("deleted"):
                raise Err(f"{rid} is deleted already")
            if inp.get("moved") or inp.get("moving"):
                raise Err(f"{rid} has moved to another project; delete it there")
            plan = self.deletions([rid]).get(rid, {"go": [], "keep": []})
            self.emit({"k": "del", "src": rid, "ns": plan["go"], "kept": plan["keep"], "by": by})
            return f"ok {rid} deleted" + (" with " + " ".join(self.code(n) for n in plan["go"]) if plan["go"] else "") \
                + ("; kept " + ", ".join(f"{self.code(n)} ({why})" for n, why in plan["keep"]) if plan["keep"] else ""), f"Deleted {rid}"
        if name == "unmake":  # undo "Make item" (T113 A7): the item goes (won't do, archived) and its input waits again
            it = self.item(op.get("ref", ""), ctx, follow=False)
            add = next((x for x in self.events if x["k"] == "add" and x["n"] == it["n"]), None)
            if not add or add.get("by") != "you" or not add.get("src"):
                raise Err(f"{self.code(it['n'])} was not made from an input")
            if self.touched_since(it["n"], add["seq"]):
                raise Err(f"{self.code(it['n'])} changed since it was made: set it to won't do instead")
            self.emit({"k": "unmake", "n": it["n"], "src": add["src"], "by": by})
            return f"ok {self.code(it['n'])} unmade", "Undid " + self.code(it["n"])
        it = self.item(op.get("ref", ""), ctx)
        code = self.code(it["n"])
        if name == "set":
            f, was = {}, {}
            for k, v in op["f"].items():
                v = self.field(k, v, ctx, it)
                if v != it.get(k):
                    f[k], was[k] = v, it.get(k)
            note = ""
            if by not in PEOPLE and "status" in f:
                if it["status"] == "proposed" and f["status"] != "dropped":
                    raise Err(f"{code} is proposed: only the user can approve it")
                if it["status"] == "dropped" and was_by(self, it) in PEOPLE:  # the user said no: an agent doesn't reopen it (F197)
                    raise Err(f"{code}: the user marked it won't do. Don't reopen or work on it; to ask, post `{code} ask <why it is worth doing>`")
                if f["status"] == "done":
                    f["status"], note = "review", " (the user accepts it to make it done)"
                    if it["status"] == "review":
                        del f["status"], was["status"]
            status = f.get("status", it["status"])
            if f.get("archived") and status not in CLOSED:
                raise Err(f"{code} is {status}: only done/dropped items can be archived")
            if it.get("archived") and status not in CLOSED and "archived" not in f:
                f["archived"], was["archived"] = False, True  # reopening brings it back
            if not f:
                return f"ok {code} no change{note}", ""
            if by not in PEOPLE and f.get("status") in ("review", "done"):
                left = self.open_kids(it)
                if left:
                    note += f" (note: its subitems {' '.join(self.code(k['n']) for k in left)} are not finished yet)"
            self.emit({"k": "set", "n": it["n"], "by": by, "f": f, "was": was, "src": src, **keep, **({"undo_of": op["undo_of"]} if op.get("undo_of") else {})})
            return f"ok {code} " + " ".join(f"{k}={v}" if k in ("pri", "when", "status", "type", "parent", "archived") else k for k, v in f.items()) + note + self.gone_note(it, by), "Updated " + code
        if name == "say":
            kind = op.get("kind", "say")
            if kind not in KINDS:
                raise Err(f"kind must be one of {'/'.join(KINDS)}")
            text = str(op.get("text", "")).strip()[:MAX_TEXT]
            if not text:
                raise Err("empty text")
            files = []
            for f in op.get("files") or []:  # images or other files shown with the message, uploaded first with POST /api/file
                fid = os.path.basename(str(f.get("f", "") if isinstance(f, dict) else f))
                if not os.path.isfile(os.path.join(self.fdir, fid)):
                    if by == "org":  # the organizer took a link in your words for a file (B172): the link stays in the text
                        continue
                    raise Err(f"unknown file {fid}: upload it first with POST /api/file?name=<name>")
                files.append({"f": fid, "name": fid.split("-", 1)[-1], "mime": mimetypes.guess_type(fid)[0] or "application/octet-stream"})
            self.emit({"k": "say", "n": it["n"], "by": by, "kind": kind, "text": text, "src": src, **({"files": files} if files else {}), **keep})
            return f"ok {code} {kind}" + self.gone_note(it, by), {"ask": "Asked on ", "block": "Blocked on ", "decide": "Decided on "}.get(kind, "Noted on ") + code
        if name == "merge":
            into = self.item(op.get("into", ""), ctx)
            if into["n"] == it["n"]:
                raise Err("cannot merge into itself")
            self.emit({"k": "merge", "n": it["n"], "into": into["n"], "by": by, "src": src, **keep})
            return f"ok {code} merged into {self.code(into['n'])}" + self.gone_note(it, by), f"Merged {code}"
        raise Err(f"unknown op '{name}'")

    def run_all(self, ops, by, src=None, keep=False):
        """ops: list of (lineno, op dict | Err). keep = link changes to src without marking it handled."""
        lines, labels, ctx = [], [], {"src": src, "keep": keep}
        with self.lock:
            for no, op in ops[:MAX_OPS]:
                try:
                    if isinstance(op, Err):
                        raise op
                    msg, label = self.run(op, by, ctx)
                    lines.append(msg)
                    if label:
                        labels.append(label)
                except Err as ex:
                    lines.append(f"err{f' L{no}' if no else ''}: {ex}")
            if len(ops) > MAX_OPS:
                lines.append(f"err: only the first {MAX_OPS} commands were run")
        return lines, labels

    # -- files ------------------------------------------------------------------

    def save_file(self, name, mime, data):
        with self.lock:
            self.nfile += 1
            base = re.sub(r"[^\w.\-]+", "_", os.path.basename(name or "file"))  # \w keeps CJK and other letters[:60].strip("._") or "file"
            if "." not in base:
                base += mimetypes.guess_extension(mime or "") or ""
            fid = f"f{self.nfile}-{base}"
            os.makedirs(self.fdir, exist_ok=True)
            with open(os.path.join(self.fdir, fid), "wb") as f:
                f.write(data)
        return {"f": fid, "name": name or base, "mime": mime or "application/octet-stream", "size": len(data)}

    def local(self, fid):
        return os.path.join(self.fdir, fid)

    # -- views ------------------------------------------------------------------

    def state(self):
        with self.lock:
            items, F, G = [], self.filings(), self.deletions()
            for it in self.items.values():
                if it.get("deleted"):
                    continue
                d = dict(it)
                d["code"] = self.code(it["n"])
                w = self.waiting(it)
                d["wait"] = {"id": w["id"], "kind": w["kind"], "text": w["text"], "by": w["by"], "files": w.get("files", [])} if w else None
                d["reply"] = self.replied(it)
                if self.reads.get(it["n"]):
                    d["read"] = {k: int(v * 1000) for k, v in self.reads[it["n"]].items()}
                items.append(d)
            return {"rev": self.rev, "boot": self.boot, "pv": self.pv, **self.presence(), "width": len(str(self.maxn)), "file": home_short(self.path), "cfg": self.cfg, "undo": self.undoable(),
                    "org": {"on": self.org_on, "model": MODEL, "busy": self.org_busy},
                    "items": items, "inputs": [dict(i, **({"tr_wait": True} if self.held(i) else {}), **({"filing": F[i["id"]]} if i["id"] in F else {}),
                                                    **({"drop": G[i["id"]]} if i["id"] in G else {})) for i in self.inputs.values() if not i.get("deleted")],
                    "deleted": self.deleted_list(),
                    "docs": [dict({k: v for k, v in d.items() if k != "gone"}, blocks=self.doc_view(d)[0], detached=self.doc_view(d)[1], whole=self.doc_whole(d), open=self.doc_open(d)) for d in self.docs.values()
                             if not self.items.get(d["n"], {}).get("deleted")]}

    def line(self, it):
        s = f"{self.code(it['n'])} {it['pri']} {it['when']} {it['status']} {it['title']}"
        w = self.waiting(it)
        if w:
            s += " !" if w["kind"] == "block" else " ?"
        elif self.replied(it):
            s += " <"
        if it["parent"]:
            s += f" ^{self.code(it['parent'])}"
        if it["archived"]:
            s += " [archived]"
        return s

    def listing(self, q):
        def one(k, d=""):
            return (q.get(k) or [d])[0]
        status, limit = one("status", "active"), int(one("limit", "60") or 60)
        words = one("q").lower().split()
        rows = []
        archived = one("archived")  # "" hide, "1" only archived, "all" both
        for it in self.sorted(self.active()):
            if (archived == "1" and not it["archived"]) or (not archived and it["archived"]):
                continue
            if status == "active" and it["status"] in CLOSED:
                continue
            if status not in ("active", "all") and it["status"] != status:
                continue
            if (one("type") or "") != "rule" and it["type"] == "rule":
                continue  # rules have their own view: GET /rules
            if one("type") and it["type"] != one("type").lower():
                continue
            if one("pri") and it["pri"] != one("pri").upper():
                continue
            if one("when") and it["when"] != one("when").lower():
                continue
            if one("wait") and not self.waiting(it):
                continue
            if one("reply") and not self.replied(it):
                continue
            hay = (self.code(it["n"]) + " " + str(it["n"]) + " " + it["title"] + " " + it["body"] + " " + it["next"]).lower()
            if all(w in hay for w in words):
                rows.append(it)
        out = [self.line(i) for i in rows[:limit]]
        if len(rows) > limit:
            out.append(f"… {len(rows) - limit} more (add &limit=)")
        return f"{len(rows)} items" + ("\n" + "\n".join(out) if out else "") + "\n"

    def files_of(self, it, ref=None):
        ref = ref or self.local
        seen, out = set(), []
        for rid in it["srcs"]:
            for f in self.inputs.get(rid, {}).get("files", []):
                if f["f"] not in seen:
                    seen.add(f["f"])
                    out.append(ref(f["f"]))
        return out

    def card(self, it, ref=None):
        c = self.code(it["n"])
        out = [f"{c} {it['type']} {it['pri']} {it['when']} {it['status']}{' archived' if it['archived'] else ''}  {it['title']}"]
        if it.get("deleted"):
            out.append(f"deleted by the user together with input {it['deleted']}: stop working on it")
        if it["merged_into"]:
            out.append(f"merged into {self.code(it['merged_into'])}")
        kids = [self.code(i["n"]) for i in self.active() if i["parent"] == it["n"]]
        meta = [x for x in (f"parent {self.code(it['parent'])}" if it["parent"] else "",
                            "kids " + " ".join(kids) if kids else "",
                            "src " + " ".join(it["srcs"]) if it["srcs"] else "") if x]
        if meta:
            out.append(" · ".join(meta))
        if it["next"]:
            out.append("next: " + it["next"])
        w = self.waiting(it)
        if w:
            out.append(f"{'! blocked' if w['kind'] == 'block' else '? asked'}, waiting on the user: " + w["text"])
        elif self.replied(it):
            out.append("< the user replied after the agent's last message (see thread)")
        if it["body"]:
            out.append("body:\n" + it["body"])
        files = self.files_of(it, ref)
        if files:
            out.append("files: " + " ".join(files))
        docs = [d for d in self.docs.values() if d["n"] == it["n"]]
        if docs:
            out.append("docs: " + "; ".join(f"D{d['d']} {d['title']} ({len(d['comments'])} comments" + (f", {self.doc_open(d)} unanswered" if self.doc_open(d) else "") + ")" for d in docs))
        if it["thread"]:
            out.append("thread:")
            for x in it["thread"][-30:]:
                tag = x["by"] + ("" if x["kind"] == "say" else " " + x["kind"])
                out.append(f"#{x['id']} {hm(x['t'])} {tag}" + (f" (edited {hm(x['edited'])})" if x.get("edited") else "") + f": {x['text']}" + "".join(f" [{(ref or self.local)(f['f'])}]" for f in x.get("files", [])))
        return "\n".join(out) + "\n"

    def input_card(self, inp, ref=None):
        ref = ref or self.local
        scope = f" →{self.code(inp['scope'])} {self.items[inp['scope']]['title']}" if inp["scope"] else ""
        head = f"{inp['id']} {hm(inp['t'])} {inp['by']}{scope}" + ("" if not inp["acked"] else " [handled]") + (" [deleted by the user]" if inp.get("deleted") else "")
        out = [head]
        if inp["text"]:
            out.append(textwrap.indent(inp["text"], "  "))
        if inp["files"]:
            out.append("  files: " + " ".join(ref(f["f"]) for f in inp["files"]))
        if inp["org"]:
            out.append(f"  organizer: {inp['org']['msg']}")
        if inp.get("history"):
            out.append(f"  updated: {hm(inp['updated'])}; latest text above replaces earlier versions")
            out.append("  linked items: " + " ".join(self.code(n) for n in inp["touched"]))
        return "\n".join(out)

    def inbox(self, ref=None):
        rows = sorted(self.for_agent(), key=lambda i: int(i["id"][1:]))
        busy = sum(1 for i in self.pending() if self.org_on and not i["org"])
        head = f"inbox {len(rows)} pending" + (f" (+{busy} being organized)" if busy else "") + f" · {self.mode()}\n"
        return head + "".join(self.input_card(i, ref) + "\n" for i in rows)

    def log(self, n):
        out = []
        for e in self.events[-n:]:
            k, who = e["k"], e.get("by", "")
            if k == "in":
                s = f"in {e['id']}" + (f" →{self.code(e['scope'])}" if e.get("scope") else "") + f" {first_line(e.get('text', ''))!r}"
            elif k == "add":
                s = f"new {self.code(e['n'])} {e['type']} {e['pri']} {e['when']} {first_line(e['title'])!r}" + (f" ←{e['src']}" if e.get("src") else "")
            elif k == "set":
                s = f"{self.code(e['n'])} " + ", ".join(f"{a} {first_line(e['was'].get(a, ''), 24)}→{first_line(b, 24)}" for a, b in e["f"].items()) + (f" (undo #{e['undo_of']})" if e.get("undo_of") else "")
            elif k == "say":
                s = f"{self.code(e['n'])} {e['kind']} {first_line(e['text'])!r}"
            elif k == "merge":
                s = f"{self.code(e['n'])} merged into {self.code(e['into'])}"
            elif k == "ack":
                s = "ack " + " ".join(e["ids"])
            elif k == "cfg":
                s = f"renamed the project {e['f']['name']!r}" if "name" in e["f"] else "keep-going " + ("ON" if e["f"].get("auto") else "OFF")
            elif k == "doc":
                s = f"doc D{e['d']} on {self.code(e['n'])} {first_line(e.get('title', ''))!r}"
            elif k == "dc":
                s = f"D{e['d']} comment {first_line(e['text'])!r}"
            elif k in ("dcedit", "dcdel", "dcundel"):
                s = {"dcedit": f"edited a comment on D{e['d']}: {first_line(e.get('text', ''))!r}", "dcdel": f"deleted a comment on D{e['d']}", "dcundel": f"restored a comment on D{e['d']}"}[k]
            elif k == "undo":
                s = f"undo organizer changes for {e['src']}"
            elif k == "redo":
                s = f"redo organizer changes for {e['src']}"
            elif k == "unmake":
                s = f"{self.code(e['n'])} unmade: {e['src']} waits again"
            elif k in ("del", "undel"):
                s = f"{e['src']} {'deleted' if k == 'del' else 'restored'}" + (" with " + " ".join(self.code(n) for n in e["ns"]) if e.get("ns") else "") \
                    + ("; kept " + ", ".join(f"{self.code(n)} ({why})" for n, why in e["kept"]) if e.get("kept") else "")
            elif k == "arch":
                s = f"{'archived' if e['on'] else 'unarchived'} {len(e['ns'])}: " + " ".join(self.code(n) for n in e["ns"][:12]) + (" …" if len(e["ns"]) > 12 else "")
            elif k == "moved":
                s = f"{e['src']} moved to {e['to']} as {e['as']}"
            elif k == "amend":
                s = f"{e['src']} {e['mode']}: {first_line(e['text'])!r}"
            elif k == "tr":
                s = f"{e['src']} voice note words: {first_line(e['tr'])!r}"
            elif e.get("retry"):
                s = f"organizer {e['src']} retry"
            else:
                s = f"organizer {e['src']} {'ok' if e['ok'] else 'FAILED'}: {first_line(e['msg'], 90)}"
                who = "org"
            out.append(f"#{e['seq']} {hm(e['t'])} {who} {s}")
        return "\n".join(out) + "\n"


# --------------------------------------------------------------------------- command language

GRAMMAR = """\
WRITE (plain text, one command per line; indented lines continue the previous command's text):
  new bug P1 now parent=B03 src=r12 Export ignores the active filter
                            type (feature|bug|idea|task|rule), priority (P0-P3), now|later, parent= and src= are
                            each optional and go before the title as plain words, no brackets
    <optional body, indented>
  B03 P1 later doing        set priority / when / status / type, any mix (status: open|doing|done|drop; drop = won't do)
  B03 title|body|next <text>      replace that field (body may continue on indented lines)
  B03 say|ask|block|propose|decide|progress <text>     add to the thread: ask = question for the user,
                                  block = you are stuck and need the user (say what you need),
                                  withdraw = take back your open ask/block (say why),
                                  propose = suggestion (not decided), decide = decision made
  B03 merge F01             merge B03 into F01 (use only for clear duplicates)
  Messages and docs are Markdown (lists, **bold**, `code`, links). Show an image where it belongs with
  ![what it shows](f12-a.png): upload it first with
  curl -s BASE/api/file?name=a.png -H 'Content-Type: image/png' --data-binary @a.png   (prints its "f")
  B03 say files=f12-a.png,f13-b.png <text>   images attached below the message instead
  B03 ask <question>        with indented choices the user taps: "- ( ) option" lines = pick one (yes/no too),
                            "- [ ] option" lines = pick any. The reply lists the picks as "✓ option".
  B03 doc [title]           new document on B03 (plans, designs); its Markdown is the indented lines, first line = title
  D1 doc [new title]        replace D1's Markdown with the indented lines; comments stay with unchanged paragraphs
  D1 reply ¶3 <text>        answer the comments on paragraph 3 of D1
  B03 archive|unarchive     hide a done/dropped item from the default lists (reopening unarchives)
  ack r12 r13               mark inputs handled without changing items
  $ means the item created earlier in the same request. Refs: B03, b3, 3 are the same item."""

AGENT = """\
Taska is the user's tracker for features, bugs, ideas and tasks. BASE={base}
Item code = type letter (F/B/I/T) + number; padding may change as the list grows, B3 = B03.
Now: {mode}  (the user flips this in the UI; every /next and /do reply repeats it)

READ  (plain text)
  curl -s BASE/next         what to do now: the inbox first, items the user replied on, then the next item  <- start here
  curl -s BASE/inbox        unprocessed user inputs: raw text, scoped item, files
  curl -s BASE/items        open items, one line each: code pri when status title [flag] [^parent]
                            flag: ? you asked / ! you are blocked (both wait on the user) / < the user replied
                            filters: ?q=word&type=bug&pri=P0&when=now&status=all|open|doing|done|dropped&wait=1&reply=1&archived=1|all&limit=60
  curl -s BASE/B03          full card: fields, body, thread, files (image/audio paths are readable from disk)
  curl -s BASE/rules        project rules: standing instructions; follow those that apply to what you do
  curl -s BASE/D1           a document: numbered paragraphs (¶) with the user's comments under each
  curl -s BASE/log?n=30     recent changes

{grammar}
  curl -s BASE/do --data-binary @- <<'EOF'
  B03 doing
  B03 progress Reproduced it: the export ignores the filter
  EOF

Now: {rules}
LOOP  doing means work has started (not that you are on it this second). Mark an item doing when you start;
      if you drop that work, set it back to open. keep-going ON: take /next, mark it doing, do the work, write progress and set done, then GET /next
      again. Don't stop to chat. If you are stuck or need a decision, post `B03 block <what you need>` and
      move on; /next brings the item back once the user replies. Nothing to do and keep-going ON: wait with
      GET /next?wait=540 (returns when work arrives) and repeat. If a background command can wake you when it
      exits, end your turn with WATCH running instead: waiting costs no tokens and never interrupts your work.
      While you work, a /do reply ending "N new inputs since your last /next" means the user wrote meanwhile:
      finish the step you are on, then GET /next. Nothing else interrupts you.
      Big items have subitems (parent=B03): /next gives you the subitems first and the parent once they are
      finished; split big work the same way with `new ... parent=B03`.
      Always call /next and /do with ?by=<your name>: with several agents on one project, /next gives each of you
      its own item and lists "others are on (skip)": another agent holds those, leave them. A hold lapses after
      30 minutes without a word from that agent.
      keep-going OFF: finish the current item, write back, stop. /next picks items marked now, ideas included:
      an idea is something to think through; do it when small and clear, otherwise propose a plan and ask.
WATCH while o=$(curl -s "BASE/next?wait=540"); [ -z "$o" ] || echo "$o" | grep -qE 'nothing to do now|keep-going OFF'; do sleep 20; done
YOURS Items you create start as proposed: the user approves them before anyone works on them. `B03 done`
      from you puts the item in review; the user accepts it. Write item content in the user's language.
WHO   Add ?by=<you> (claude-code, codex, antigravity) to /next and /do: the user sees whether an agent is around.
TELL  The user reads Taska only, often on a phone: never your terminal or chat. Everything they should see
      (what you did, how you checked it, screenshots, plans, questions) goes into the item's messages.
      First line = the conclusion in one sentence; the page folds long messages to it. Then details, short,
      in Markdown, images inline (see `say` above). Don't post "starting now": the status already says doing.
RULES Reuse existing items (/items?q=) instead of duplicating. Keep the user's wording. Never turn a
      suggestion into a decision: use propose/ask/block and wait. Commands with src=rN (or ack rN) mark that
      input handled; if an input is a question for you, answer it in the related item (or tell the user) and ack it.
"""

SKILL = """\
---
name: taska
description: Work with Taska, the user's per-project tracker of features, bugs, ideas, tasks and rules (a small local web app). Use when the user mentions Taska or item codes like B03 or F12, asks you to work on, continue or keep working through the tasks, or when the project folder has a .taska file.
---

# Taska

Taska runs on this machine. You read and update it with curl; every reply is short plain text.

1. **Find it.** The project's `.taska` file (in the current folder or a parent) holds its URL, for example
   `http://127.0.0.1:7340/p/myapp`. No file: `curl -s http://127.0.0.1:7340/api/projects` lists the projects;
   pick the one for this folder or ask the user. Below, BASE is that project URL.
2. **Learn it once per session.** `curl -s BASE/agent` is one page with every read and write command.
   Then `curl -s BASE/rules` and follow the project rules that apply to what you are doing.
3. **Work the loop.** Say who you are on /next and /do with `?by=claude-code` (or `codex`, `antigravity`): the
   user's phone shows whether an agent is around. `curl -s "BASE/next?by=claude-code"` says what to do: the inbox first, then items the user replied on,
   then the next item by priority. Mark the item doing, do the work, write progress back, then mark it done
   (it goes to the user for review). Ask /next again.
4. **Keep going.** The first line of /next says keep-going ON or OFF.
   - ON and nothing to do: `curl -s "BASE/next?wait=540&by=claude-code"` waits and returns as soon as work arrives. Repeat.
     After your last item, always check /next once more.
   - If you can run a command in the background that wakes you when it exits (Claude Code: Bash with
     `run_in_background`), start this and end your turn instead of holding it. Waiting costs no tokens, it
     ends only when there is work and keep-going is ON, and it never interrupts you mid-task:
     `while o=$(curl -s "BASE/next?wait=540&by=claude-code"); [ -z "$o" ] || echo "$o" | grep -qE 'nothing to do now|keep-going OFF'; do sleep 20; done`
   - OFF: finish the current item, write back, stop.
5. **Need the user?** Post `B03 block <what you need>` or `B03 ask <question>`, then take the next item.
   /next brings it back once the user replies. When the answer is a choice, list it under the question as
   indented `- ( ) option` lines (pick one) or `- [ ] option` lines (pick any): the user taps instead of typing.
6. **The user reads Taska only**, usually on a phone, never your terminal or chat. Whatever they should see goes
   into the item: what you did and how you checked it, screenshots, plans, questions. **The first line is the
   conclusion in one sentence**: the page folds long messages to it. Messages are Markdown:
   short paragraphs and lists, images inline with `![what it shows](f12-a.png)` after uploading
   (`curl -s BASE/api/file?name=a.png -H 'Content-Type: image/png' --data-binary @a.png`).
7. Items you create start as proposed until the user approves them. Never treat a suggestion as decided.
"""

SKILL_DIRS = {"Claude Code": "~/.claude/skills", "Codex": "~/.codex/skills", "Antigravity": "~/.gemini/config/skills"}


def install_skill():
    """Write SKILL.md for every coding agent found on this machine (user level, all projects)."""
    for agent, d in SKILL_DIRS.items():
        root = os.path.expanduser(d)
        if not os.path.isdir(os.path.dirname(root)):
            print(f"  skip {agent}: {os.path.dirname(root)} not found")
            continue
        os.makedirs(os.path.join(root, "taska"), exist_ok=True)
        path = os.path.join(root, "taska", "SKILL.md")
        with open(path, "w", encoding="utf-8") as f:
            f.write(SKILL)
        print(f"  {agent}: {path}")


ATTR = re.compile(r"(?i)(?P<open>\[)?(?:(?P<kv>(?:src|parent|pri|when|status|type|files)=[^\s\]]+)|(?P<pri>P[0-3])|(?P<when>now|later)"
                  r"|(?P<st>open|doing|review|done|drop|dropped)|(?P<type>feature|bug|idea|task|rule)|(?P<arch>archive|unarchive))(?(open)\])(?=\s|$)")  # [P1] as P1 (B222)
END_KV = re.compile(r"(?i)\s+\[?(src|parent)=([^\s\]]+)\]?\s*$")  # an option at the end of a title


def clean_title(t):
    """A title with the guide's options left in it, as agents wrote them when the guide showed them in brackets
    ("[src=r246] Fix the export", B222): the options go; -> (title, src it named or None). Bare words stay: "Open
    the settings" keeps its Open."""
    if "src=" not in t and "parent=" not in t and "[" not in t:
        return t, None
    found = []
    def drop(m):  # only real refs: "[src=...]" written about the tags stays in the title
        if m[1] or m[2]:
            found.append((m[1] or m[2]).lower())
        return " "
    out = re.sub(r"(?i)\[src=(r\d+)\]|\[parent=[A-Za-z]?\d+\]|\bsrc=(r\d+)\b", drop, t)
    lead = re.match(r"(?i)(?:\s*\[(?:P[0-3]|now|later|open|doing|review|done|drop|dropped|feature|bug|idea|task|rule)\])+", out)
    if lead:
        out = out[lead.end():]
    out = " ".join(out.split())
    return (out, found[0] if found else None) if out else (t, None)


def attrs(s):
    """Consume leading attribute tokens. Returns (dict, rest of the line)."""
    out, pos = {}, 0
    while True:
        m = ATTR.match(s, pos)
        if not m:
            break
        if m["kv"]:
            k, v = m["kv"].split("=", 1)
            out[k.lower()] = v
        elif m["pri"]:
            out["pri"] = m["pri"]
        elif m["when"]:
            out["when"] = m["when"].lower()
        elif m["st"]:
            out["status"] = m["st"].lower()
        elif m["arch"]:
            out["archived"] = m["arch"].lower() == "archive"
        else:
            out["type"] = m["type"].lower()
        pos = m.end()
        while pos < len(s) and s[pos].isspace():
            pos += 1
    return out, s[pos:]


def parse_dsl(text):
    """-> [(lineno, op | Err)]. Forgiving: markdown fences around the commands and # comments are ignored."""
    cmds = []
    for no, raw in enumerate(text.replace("\r\n", "\n").split("\n"), 1):
        if raw[:1] in (" ", "\t"):  # indented: text of the command above, code fences included
            if cmds:
                cmds[-1][2].append(raw)
            continue
        if raw.startswith("```"):
            continue
        if not raw.strip():
            if cmds and cmds[-1][2]:
                cmds[-1][2].append("")
            continue
        if raw.startswith("#"):
            continue
        cmds.append((no, raw.strip(), []))
    ops = []
    for no, head, cont in cmds:
        cont = textwrap.dedent("\n".join(cont)).strip("\n")
        try:
            ops.append((no, parse_cmd(head, cont)))
        except Err as ex:
            ops.append((no, ex))
    return ops


def parse_cmd(head, cont):
    word, _, rest = head.partition(" ")
    rest = rest.strip()
    low = word.lower()
    if low == "ack":
        ids = [x.lower() for x in re.findall(r"[rR]\d+", rest)]
        if not ids:
            raise Err("ack needs input ids like r12")
        return {"op": "ack", "ids": ids}
    if low == "new":
        a, title = attrs(rest)
        m = END_KV.search(title)
        while m:  # "new task Write the docs [src=r12]": the option at the end counts too (B222)
            a.setdefault(m[1].lower(), m[2])
            title = title[:m.start()]
            m = END_KV.search(title)
        if not title:
            raise Err("new needs a title")
        op = {"op": "new", "title": title, "body": cont}
        for k in ("type", "pri", "when", "status", "parent", "src"):
            if k in a:
                op[k] = a[k]
        return op
    if re.fullmatch(r"[Dd]\d+", word):  # documents
        sub, _, rest2 = rest.partition(" ")
        if sub.lower() == "doc":
            return {"op": "doc", "d": word[1:], "title": rest2.strip(), "md": cont}
        if sub.lower() == "reply":
            m = re.match(r"¶?(\d+)\s+(.*)", rest2.strip(), re.S)
            if not m:
                raise Err(f"use: {word} reply ¶3 <text>")
            return {"op": "dc", "d": word[1:], "para": m.group(1), "text": (m.group(2) + ("\n" + cont if cont else "")).strip()}
        raise Err(f"{word}: use doc or reply")
    if not re.fullmatch(r"\$|[A-Za-z]?\d+", word):
        raise Err(f"unknown command '{word}' (start with new, ack or an item code like B03)")
    sub, _, rest2 = rest.partition(" ")
    sub_l = sub.lower()
    if sub_l == "doc":
        return {"op": "doc", "ref": word, "title": rest2.strip(), "md": cont}
    if sub_l in TEXT_VERBS:
        a, text = attrs(rest2.strip()) if re.match(r"(?i)(src|files)=", rest2.strip()) else ({}, rest2.strip())
        text = (text + ("\n" + cont if cont else "")).strip()
        if sub_l in ("title", "body", "next"):
            return {"op": "set", "ref": word, "f": {sub_l: text}, "src": a.get("src")}
        return {"op": "say", "ref": word, "kind": sub_l, "text": text, "src": a.get("src"),
                "files": [f for f in (a.get("files") or "").split(",") if f]}
    if sub_l == "merge":
        return {"op": "merge", "ref": word, "into": rest2.strip().split()[0] if rest2.strip() else ""}
    a, left = attrs(rest)
    if left or not a:
        raise Err(f"cannot read '{rest or '(nothing)'}' after {word}")
    src = a.pop("src", None)
    return {"op": "set", "ref": word, "f": a, "src": src}


# --------------------------------------------------------------------------- Gemini


def api_key():
    for v in KEY_VARS:
        if os.environ.get(v):
            return os.environ[v]
    return None


def gemini_call(model, body, timeout=120):
    """One generateContent request -> the parsed reply. Busy and network errors are tried again; a model without a
    thinking switch is asked again without thinkingConfig."""
    for attempt in range(3):
        req = urllib.request.Request(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            data=json.dumps(body).encode(), headers={"x-goog-api-key": api_key() or "", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as ex:
            detail = ex.read().decode("utf-8", "replace")
            gen = body.get("generationConfig") or {}
            if ex.code == 400 and "hinking" in detail and "thinkingConfig" in gen:
                del gen["thinkingConfig"]  # model without a thinking switch
                continue
            if ex.code in (429, 500, 502, 503, 504) and attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            raise Err(f"Gemini HTTP {ex.code}: {first_line(detail, 160)}")
        except (OSError, http.client.HTTPException) as ex:  # unreachable, timed out, connection dropped
            if attempt < 2:
                time.sleep(2)
                continue
            raise Err(f"Gemini unreachable: {ex}")
    raise Err("Gemini failed")


def reply_text(data):
    """(text, why it was refused or None) from a generateContent reply. A speech model's words count as text."""
    cand = (data.get("candidates") or [{}])[0]
    text = "".join(p.get("text", "") or (p.get("audioTranscription") or {}).get("text", "")
                   for p in cand.get("content", {}).get("parts", []) if not p.get("thought")).strip()
    why = (data.get("promptFeedback") or {}).get("blockReason")
    if not why and not text and cand.get("finishReason") not in (None, "STOP", "MAX_TOKENS"):
        why = cand["finishReason"]
    return text, why


def gemini(system, parts, think=0, temperature=0.2, timeout=120, field=None, hint="", model=None):
    """field: answer as JSON {field: "..."} (hint describes it) and return that string; keeps prefaces and notes out."""
    body = {"contents": [{"role": "user", "parts": parts}],
            "generationConfig": {"temperature": temperature, "thinkingConfig": {"thinkingBudget": think}}}
    if field:
        body["generationConfig"].update(responseMimeType="application/json", responseSchema={
            "type": "OBJECT", "properties": {field: {"type": "STRING", "description": hint}}, "required": [field]})
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    text, _ = reply_text(gemini_call(model or MODEL, body, timeout))
    if field:
        try:
            return str(json.loads(text).get(field) or "").strip()
        except (ValueError, AttributeError):
            raise Err("Gemini answered in an unexpected format")
    return text


ORG = """\
You are the organizer inside Taska, a personal tracker the user shares with coding agents. The user just
sent a raw input (text, maybe images or a voice transcript). Turn it into commands that change the tracker.
Reply with commands only: no explanation, no markdown fences.

Types: feature = something to add or improve; bug = something broken to find and fix; idea = a thought to
think through, maybe vague; task = a concrete piece of work that is not a feature or bug (write a doc, answer a
question, prepare a demo, look into something); rule = a standing
instruction for this project that agents must follow when it applies (commit format, who reviews, naming, how
to organize). When the user states a rule, create it (`new rule <when it applies>` + how, as the body) or update
the existing rule; do not file it as a task. Follow the project rules below that are about organizing.
Work like this:
- If the input belongs to an existing item (listed below), update that item instead of creating a duplicate.
- An input with a scope item is already shown in that item's thread: never repeat it with say. Only apply
  field changes it asks for ("set high priority" = P1, "urgent" = P0, "later", "done", ...) or new items it
  mentions. A reply to an agent's ask/block is for that agent: change nothing and reply `ack <input id>`.
- A question or request addressed to the coding agent (how something works, "explain", "can you..."):
  reply `pass` so the input stays in the inbox for the agent. Still create items for anything else it says.
- If it is new, `new <type> <P0-P3> <now|later> <short title>` with the user's own wording as the body, for
  example `new bug P2 now Export ignores the active filter`: plain words, no brackets.
  One input may contain several separate things: create one item each. Use parent=<code> to split a big
  item into subtasks.
- Write titles, bodies and notes in the language of THIS input (English input -> English, Chinese input ->
  Chinese), even when other items are in another language and even though the app itself is in English. Keep the user's wording; keep paths, commands and identifiers exactly.
  Do not invent facts.
- "Won't do / not doing it" (in any language) closes an item without finishing it: `<code> drop`.
- Do not decide for the user: put suggestions in `propose`, and use `ask` only when something is truly
  ambiguous or missing. If the input only answers an open question, record it with `say` and stop.
- "Not now / later / put it off" (in any language) about something not tracked yet still means: create it with `later`,
  so it is not lost. Only greetings, thanks or pure acknowledgements need no item.
- Priority (always write it on new items): P2 = normal, the default for every type. Only the user's words move it:
  P0 when they say it is urgent or blocks them, P1 when they say it is important or should come soon, P3 when
  they say it can wait or "someday". Do not raise it because it sounds big. New items are `now` unless the user says later.
  Explicit words from the user ("P0", "urgent", "not urgent", "later") always win, and the project rules
  below override these defaults.
- Merge only clear duplicates. Prefer fewer, accurate changes. If nothing needs changing, reply: ack <input id>

""" + GRAMMAR


class Organizer(threading.Thread):
    """Turns pending inputs into ops with Gemini. One at a time, oldest first."""

    def __init__(self, store):
        super().__init__(daemon=True)
        self.s = store

    def run(self):
        s = self.s
        while True:
            with s.cond:
                while True:
                    if s.gone:  # the project was deleted: its organizer stops; restoring it starts a new one (F173)
                        return
                    todo = [i for i in s.pending() if not i["org"] and not s.held(i)]  # org is set (and logged) once tried; held: its words are coming (B165)
                    if todo:
                        break
                    s.cond.wait(timeout=30)
                inp = dict(min(todo, key=lambda i: int(i["id"][1:])))
                s.org_busy = inp["id"]
                s.bump()
            self.process(inp)

    def context(self, inp):
        s = self.s
        rows = [s.line(i) for i in s.sorted(s.active()) if i["status"] not in CLOSED][:600]
        out = ["Open items:\n" + ("\n".join(rows) if rows else "(none yet)"), "Project rules:\n" + s.rules_text()]
        if inp["scope"] in s.items:
            out.append("Scope item (the input is about this one):\n" + s.card(s.items[inp["scope"]]))
        scope = f" [scope: {s.code(inp['scope'])}]" if inp["scope"] else " [no scope: whole project]"
        if inp.get("from") == "rules":
            scope += " [sent from the Rules view: most likely a rule]"
        if inp.get("history"):
            out.append("This is an update to an existing input, not a new submission. The latest text is authoritative. "
                       "Update its linked items where relevant instead of duplicating them. Preserve unrelated work. "
                       "Do not repeat completed external actions. The coding agent must see the update: include pass.")
            out.append("Previous input text:\n" + inp["history"][-1]["text"])
            out.append("Linked items:\n" + "\n".join(s.card(s.items[n]) for n in inp["touched"] if n in s.items))
        out.append(f"New input {inp['id']} at {hm(inp['t'])}{scope}:\n{inp['text'] or '(no text)'}")
        return "\n\n".join(out)

    def process(self, inp):
        s, t0 = self.s, time.time()
        with s.lock:  # writes may land while we build the prompt
            inp = dict(inp)
            version = inp.get("v", 0)
            parts, err = [{"text": self.context(inp)}], None
        try:
            for f in inp["files"]:
                path = os.path.join(s.fdir, f["f"])
                mime = f.get("mime", "")
                if mime.startswith("image/") or (mime.startswith("audio/") and not f.get("tr")):
                    if os.path.getsize(path) < 12 * 1024 * 1024:
                        with open(path, "rb") as fh:
                            parts.append({"inline_data": {"mime_type": mime.split(";")[0], "data": base64.b64encode(fh.read()).decode()}})
            plan = gemini(ORG, parts, think=int(os.environ.get("TASKA_THINK", "512")))
        except Exception as ex:
            plan, err = "", str(ex)
        with s.lock:
            s.org_busy = None
            current = s.inputs[inp["id"]]
            if current.get("v", 0) != version or current.get("moved") or current["acked"]:
                s.bump()  # a stale plan must not overwrite or acknowledge a newer input
                return
            if err:
                s.emit({"k": "org", "src": inp["id"], "ok": False, "msg": err, "by": "org"})
                return
            keep = bool(inp.get("history")) or bool(re.search(r"(?im)^\s*pass\s*$", plan))
            ops = parse_dsl(re.sub(r"(?im)^\s*pass\s*$", "", plan))
            if keep:  # the input is for the coding agent: changes may be applied, but it stays in the inbox
                ops = [(no, op) for no, op in ops if isinstance(op, Err) or op.get("op") != "ack"]
            lines, labels = s.run_all(ops, "org", src=inp["id"], keep=keep)
            bad = [x for x in lines if x.startswith("err")]
            if not s.inputs[inp["id"]]["acked"] and not bad and not keep:
                s.emit({"k": "ack", "ids": [inp["id"]], "by": "org"})
            noted = f"Added to {s.code(inp['scope'])}" if inp["scope"] in s.items else "No changes needed"
            msg = " · ".join(labels) if labels else ("" if keep else noted)
            if keep:
                msg = (msg + " · " if msg else "") + "Left for your coding agent"
            if bad:
                msg += " · Some commands failed: " + "; ".join(bad)
            s.emit({"k": "org", "src": inp["id"], "ok": not bad, "msg": msg, "plan": plan, "keep": keep, "changed": bool(labels), "ms": int((time.time() - t0) * 1000), "by": "org"})


# --------------------------------------------------------------------------- voice notes

# How voice notes become text, measured on 59 real notes and 5 where nobody speaks (T101):
# - a fixed model version: an alias such as gemini-flash-latest moves to a newer model without notice;
# - a dedicated speech-to-text model at the same time, as a second opinion. It never made words up from silence,
#   never refused and never wrote Traditional characters, but it renders some English words in Chinese. So it only
#   decides whether anyone spoke, stands in when the main one gives nothing, and shows where the two disagree;
# - Traditional characters, which still slip in now and then, turned Simplified by one cheap text-only request.
# - A phone's voice processing (iPhone Safari records through the one made for calls) can cut every pause to digital
#   silence and turn later phrases 10 to 30 dB quieter. On two such notes both models kept only the first few words,
#   whatever the format, loudness or silence was changed to; only the strong model heard the rest. Such a note (exact
#   digital silence inside the speech, which none of 59 notes from a computer had) is heard by it too.
VOICE_MODEL = os.environ.get("TASKA_VOICE_MODEL", "gemini-3.8-flash")
ASR_MODEL = os.environ.get("TASKA_ASR_MODEL", "gemini-3.5-transcribe")
PRO_MODEL = os.environ.get("TASKA_PRO_MODEL", "gemini-3.1-pro-preview")
# How long one voice note may take, in seconds: the strong model once took 250 s on a phone note. Each model gets its
# own cap; what one did not finish in time is left out, and the whole note never takes much longer than VOICE_BUDGET.
VOICE_BUDGET = float(os.environ.get("TASKA_VOICE_BUDGET", 60))
VOICE_CAP = float(os.environ.get("TASKA_VOICE_CAP", 50))  # the main and the speech model
PRO_CAP = float(os.environ.get("TASKA_PRO_CAP", 45))  # the strong model
PRO_LATE = float(os.environ.get("TASKA_PRO_LATE", 180))  # past its cap it may go on this long; fuller words then follow
# The source stays free of Chinese (R66), so the Chinese below is escaped. VOICE_SYSTEM says: "You transcribe speech.
# Write only the words really spoken in the recording; if nobody speaks, return an empty string. Always write Chinese
# in Simplified characters, never Traditional." VOICE_HINT: "Word for word, Chinese in Simplified characters; empty
# when nobody speaks". VOICE_RULES quotes "Simplified / Traditional characters", "P zero/one/two" and "B seventy-three".
VOICE_SYSTEM = ("\u4f60\u662f\u8bed\u97f3\u8f6c\u5199\u5458\u3002\u53ea\u5199\u5f55\u97f3\u91cc\u771f\u6b63\u8bf4\u51fa\u7684\u8bdd\uff1b"
                "\u6ca1\u6709\u4eba\u8bf4\u8bdd\u5c31\u8fd4\u56de\u7a7a\u5b57\u7b26\u4e32\u3002"
                "\u4e2d\u6587\u4e00\u5f8b\u7528\u7b80\u4f53\u5b57\u4e66\u5199\uff0c\u7edd\u4e0d\u7528\u7e41\u4f53\u5b57\u3002")
VOICE_HINT = "\u9010\u5b57\u8f6c\u5199\uff0c\u4e2d\u6587\u7528\u7b80\u4f53\u5b57\uff1b\u6ca1\u6709\u4eba\u8bf4\u8bdd\u65f6\u4e3a\u7a7a"
VOICE_RULES = """\
Transcribe this voice note verbatim. The speaker mixes Mandarin Chinese and English while talking about software work.
Rules:
- Write only words that are actually spoken. If nobody speaks (silence, noise, a beep, music), return an empty transcript. Never output the hint words or item titles below unless the speaker says them.
- Write Chinese in Simplified characters (\u7b80\u4f53\u5b57) only, never Traditional (\u7e41\u9ad4\u5b57).
- Keep English words in Latin letters as spoken; never translate them. Write code identifiers, file paths, commands and product names the normal way (Codex, pytest, tests/test_export.py).
- Priorities are spoken as "P\u96f6", "P0", "P\u4e00", "P\u4e8c": write P0, P1, P2, P3. Item codes are a letter and a number, like B73, F12, R66, T101; the letter is often said in English and the number in Chinese ("B\u4e03\u5341\u4e09" is B73).
- Do not summarize, translate or tidy the wording. Keep self-corrections and repetitions. Use normal Chinese punctuation.
- If a word is unclear, give your best guess followed by (?).
- Put only the spoken words in transcript: no preface, notes or timestamps."""
# F183: how the user wants voice notes written down, in their own words: one text for every project, kept in the data
# root, edited on the Voice spellings page. Transcription follows it after the rules above.
VOICE_PREFS = """\
Chinese in Simplified characters, never Traditional.
Technical terms stay in English, as spoken: code names, commands, file names, product names.
Numbers, priorities and item codes the short way: 3, P1, B73.
My own words, as I said them: no summary, no translation."""
MAX_PREFS = 4000
# T2S_SYSTEM: "You turn Traditional characters into Simplified ones. Change only the character forms, never a word,
# punctuation, English or spaces." T2S_HINT: "The same text, Traditional characters made Simplified, nothing else changed".
T2S_SYSTEM = ("\u4f60\u628a\u7e41\u4f53\u5b57\u8f6c\u6362\u6210\u7b80\u4f53\u5b57\u3002"
              "\u53ea\u6539\u5b57\u5f62\uff0c\u4e0d\u6539\u4efb\u4f55\u8bcd\u8bed\u3001\u6807\u70b9\u3001\u82f1\u6587\u6216\u7a7a\u683c\u3002")
T2S_HINT = "\u540c\u4e00\u6bb5\u6587\u5b57\uff0c\u7e41\u4f53\u5b57\u6362\u6210\u7b80\u4f53\u5b57\uff0c\u5176\u4f59\u4e00\u5b57\u4e0d\u6539"
# Everyday English words: no help as spelling hints, and they push the project's own names down the list.
VOICE_COMMON = frozenset("""a about above after again all also always an and another any are as ask at away back be
because been before being best better between both but by can cannot could did do does doing done down each easy else
even every few first for from get gets give go goes going good got had has have here how however if in into is it its
just keep last later less let like look made make makes many may maybe more most much must my need needs never new
next no not now of off often old on once one only open or other our out over own per put really same see set should
since so some still such sure take than that the their them then there these they thing things this those though
through to too try two under until up use used uses using very via want was way we well were what when where which
while who why will with without would yes yet you your com org net www http https src localhost""".split())
FILE_NAME = re.compile(r"\.(png|jpe?g|gif|webp|heic|svg|webm|m4a|mp3|mp4|ogg|wav|pdf|txt|md|json|jsonl|html?|css|csv|log|zip|py|js|ts|sh)$")
AUDIO_MIME = {".webm": "audio/webm", ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".mp4": "audio/mp4", ".mp3": "audio/mpeg",
              ".wav": "audio/wav", ".aac": "audio/aac", ".flac": "audio/flac"}


def voice_term_ok(t):
    """A word worth a spelling hint: not a URL, a document id or key, an input ref (r119), a file name, a plain number
    or code, or an everyday English word."""
    low = t.lower()
    return (3 <= len(t) <= 30 and low not in VOICE_COMMON and not re.search(r"://|^www\.|localhost", low)
            and not ("/" in t and "." in t) and not FILE_NAME.search(low) and not re.fullmatch(r"[a-z]{0,2}\d+", low)
            and not re.search(r"\d{4,}", t) and not re.fullmatch(r"[0-9a-f]{10,}", low)
            and not (len(t) >= 16 and re.search(r"\d", t) and re.search(r"[A-Z]", t) and re.search(r"[a-z]", t)))


def voice_terms(words, fixes, limit=60):
    """Spelling hints, each once: the words you corrected before and Taska first, then the project's own words, unusual
    ones (CamelCase names, acronyms, snake_case) before capitalized names before plain words, most used first in each."""
    out, seen = [], set()
    picked = [t for t in (w.strip("._/-") for w, _ in words.most_common()) if voice_term_ok(t)]
    rank = lambda t: 0 if re.search(r"[A-Z0-9_./-]", t[1:]) else 1 if t[0].isupper() else 2
    for t in [c["right"] for c in reversed(fixes)] + ["Taska"] + sorted(picked, key=rank):
        if t.lower() not in seen:
            seen.add(t.lower())
            out.append(t)
    return out[:limit]


def voice_context(store, scope):
    """(the project's words, its open items as "B73 title", their titles): what the transcription is told."""
    with store.lock:
        pool = [store.items[scope]] if scope in store.items else []
        pool += [i for i in store.sorted(store.active()) if i["status"] in ("open", "doing") and i["n"] != scope][:80]
        words = Counter()
        for it in pool:
            words.update(re.findall(r"[A-Za-z_][A-Za-z0-9_./\-]{2,}", it["title"] + " " + it["body"]))
        # B73, not B073: the way people say it. No "src=r119" left over in a title.
        items = [f"{LETTER[it['type']]}{it['n']} " + " ".join(re.sub(r"\bsrc=r\d+", " ", it["title"]).split())[:100] for it in pool[:30]]
        # T271: everything about the item you speak to is context: its text, every message in its thread (the agents'
        # replies and yours), its subitems and its documents. Their words are hints first (Chinese names from headings and
        # bold text too); the text itself goes to the main model to recognize words, never to copy (about 6000 characters)
        it0 = store.items.get(scope)
        if it0:
            kids = [k for k in store.items.values() if k.get("parent") == scope]
            docs = [d for d in store.docs.values() if d["n"] == scope][-3:]
            parts = [it0["title"], it0.get("body") or "", it0.get("next") or ""] + [x.get("text") or "" for x in it0.get("thread", [])][-40:] \
                + [k["title"] for k in kids] + [d.get("md") or "" for d in docs]
            text = "\n".join(p for p in parts if p)
            for w in re.findall(r"[A-Za-z_][A-Za-z0-9_./\-]{2,}", text):
                words[w] += 3
            for w in re.findall(r"(?:^#+\s*|\*\*)([^*\n]{2,24}?)(?:\*\*|$)", text, re.M):
                for part in re.split(r"[\s\uff0c\u3002\u3001\uff1a:\uff1b;\uff08\uff09()\uff0f/\u00b7|+\uff0b-]+", w):
                    if re.search(r"[\u4e00-\u9fff]", part) and 2 <= len(part) <= 12:
                        words[part] += 3
            items.insert(0, f"{LETTER[it0['type']]}{it0['n']} (the item being discussed: its text, thread, subitems and documents) " + " ".join(re.sub(r"[#*`>|_-]+", " ", text).split())[-6000:])
        return words, items, [it["title"] for it in pool[:40]]


def voice_prompt(terms, items, fixes, prefs=VOICE_PREFS):
    lines = [VOICE_RULES]
    if prefs.strip():  # F183
        lines.append("The user's own preferences for the transcript (follow them, but never add words nobody said):\n" + prefs.strip())
    if any(c.get("wrong") for c in fixes):  # F144
        lines.append("Spellings the user corrected before (write the right form when you hear it): " +
                     "; ".join(f"{c['right']} (not {c['wrong']})" for c in [c for c in fixes if c.get("wrong")][-40:]))
    lines.append("Spelling hints, only for words you actually hear: " + ", ".join(terms))
    if items:
        lines.append("Open items, only to recognize names and codes (do not copy them): " + "; ".join(items))
    return "\n".join(lines)


def voice_main(audio, prompt, model=None):
    """The main transcript (VOICE_MODEL, in a JSON field so no preface or notes get in), or the strong model's. Gemini
    sometimes refuses a voice note for no reason it gives (promptFeedback.blockReason): asked once more, then left
    to the speech model."""
    for attempt in (1, 2):
        body = {"contents": [{"role": "user", "parts": [{"text": prompt}, audio]}],
                "systemInstruction": {"parts": [{"text": VOICE_SYSTEM}]},
                "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json",
                                     "responseSchema": {"type": "OBJECT", "properties": {"transcript": {"type": "STRING", "description": VOICE_HINT}},
                                                        "required": ["transcript"]}}}
        # The main one answers without thinking. The strong one thinks a little: on two phone notes it heard as much
        # as with more thinking, in 7 s instead of 16.
        body["generationConfig"]["thinkingConfig"] = {"thinkingLevel": "low"} if model else {"thinkingBudget": 0}
        text, why = reply_text(gemini_call(model or VOICE_MODEL, body, timeout=240 if model else 120))
        if why and attempt == 1:
            continue
        if why:
            raise Err(f"Gemini refused it twice ({why})")
        try:
            return str(json.loads(text).get("transcript") or "").strip()
        except (ValueError, AttributeError):
            raise Err("Gemini answered in an unexpected format")


def voice_asr(audio, vocab):
    """The second opinion: the dedicated speech-to-text model, with the project's words. "" = nobody spoke."""
    body = {"contents": [{"role": "user", "parts": [audio]}], "generationConfig": {"audioTranscriptionConfig": {
        "mode": "VERBATIM", "languageCodes": ["cmn-Hans-CN", "en-US"], "customVocabulary": vocab}}}
    text, why = reply_text(gemini_call(ASR_MODEL, body))
    if why:
        raise Err(f"the speech model refused it ({why})")
    return text


def together(*fns, wait=360):
    """The first function here and the others in threads, all at the same time -> [(result, None) or (None, error)]."""
    out = [(None, Err("no answer in time"))] * len(fns)

    def run(i, fn):
        try:
            out[i] = (fn(), None)
        except Exception as ex:  # one failing must not lose the others' answers
            out[i] = (None, ex)
    threads = [threading.Thread(target=run, args=(i, fn), daemon=True) for i, fn in enumerate(fns) if i]
    for t in threads:
        t.start()
    run(0, fns[0])
    end = time.time() + wait
    for t in threads:
        t.join(max(0, end - time.time()))
    return list(out)


def capped(fn, secs, what, times=None, key=None, keep=None):
    """fn() in a thread, given secs at most: its answer, or Err("<what> timed out after N s"); the thread is left to
    finish on its own, and keep (a dict) gets it and its box, to wait for it longer. times[key]: how long it took."""
    box, t0 = {}, time.time()

    def run():
        try:
            box["v"] = fn()
        except Exception as ex:
            box["e"] = ex
    t = threading.Thread(target=run, daemon=True)
    t.start()
    t.join(max(0.0, secs))
    if times is not None and key:
        times[key] = round(time.time() - t0, 1)
    if t.is_alive():
        if keep is not None:
            keep.update(thread=t, box=box)
        raise Err(f"{what} timed out after {secs:.0f} s")
    if "e" in box:
        raise box["e"]
    return box["v"]


def voice_gated(path, mime):
    """Seconds of exact digital silence inside the speech of a recording macOS can decode (an iPhone's m4a): the mark
    of a phone's voice processing. 0.0 when there is none, or when this machine cannot tell (no afconvert)."""
    tool = shutil.which("afconvert")
    if not tool or not path or mime.split(";")[0] not in ("audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac", "audio/wav", "audio/x-wav", "audio/mpeg"):
        return 0.0
    fd, wav = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        subprocess.run([tool, "-f", "WAVE", "-d", "LEI16@16000", "-c", "1", path, wav], capture_output=True, timeout=60, check=True)
        with open(wav, "rb") as f:
            raw = f.read()
    except (OSError, subprocess.SubprocessError):
        return 0.0
    finally:
        try:
            os.unlink(wav)
        except OSError:
            pass
    pos, data = 12, b""  # the samples are in the "data" chunk (Python 3.9's wave cannot read the header afconvert writes)
    while pos + 8 <= len(raw):
        size = int.from_bytes(raw[pos + 4:pos + 8], "little")
        if raw[pos:pos + 4] == b"data":
            data = raw[pos + 8:pos + 8 + size]
            break
        pos += 8 + size + (size & 1)
    a = array.array("h", data[:min(len(data) // 2, 16000 * 600) * 2])  # ten minutes is plenty to tell
    if sys.byteorder == "big":
        a.byteswap()
    n = 800  # 50 ms
    frames = [a[i:i + n] for i in range(0, len(a) - n + 1, n)]
    db = [20 * math.log10(max(1.0, math.sqrt(sum(v * v for v in f) / n)) / 32768) for f in frames]
    if not db:
        return 0.0
    top = sorted(db)[-max(1, len(db) // 20)]  # the loud end of the note, not one click
    voiced = [i for i, d in enumerate(db) if d > max(-60.0, top - 40)]
    if not voiced:
        return 0.0
    return sum(1 for f in frames[voiced[0]:voiced[-1] + 1] if not any(f)) * 0.05


def traditional(text):
    """The Traditional characters in text: CJK ones that GB2312 (Simplified) cannot encode but Big5 can."""
    out = []
    for ch in text or "":
        if "\u4e00" <= ch <= "\u9fff":
            try:
                ch.encode("gb2312")
            except UnicodeEncodeError:
                try:
                    ch.encode("big5")
                    out.append(ch)
                except UnicodeEncodeError:
                    pass
    return out


def simplified(text):
    """text with its Traditional characters made Simplified by one cheap text-only request, made only when there are
    any. Nothing else may change (the same Latin words and numbers, about the same length), or text stays as it was."""
    before = traditional(text)
    if not before:
        return text
    try:
        out = gemini(T2S_SYSTEM, [{"text": text}], think=0, temperature=0, timeout=60, field="text", hint=T2S_HINT, model=VOICE_MODEL)
    except Exception:
        return text
    latin = lambda s: re.findall(r"[A-Za-z0-9]+", s)
    same = latin(out) == latin(text) and abs(len(out) - len(text)) <= max(2, len(text) // 50)
    return out if out and same and len(traditional(out)) < len(before) else text


VOICE_TOKEN = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9_.+'/-]*[A-Za-z0-9])?|[\u3400-\u9fff]")  # a word, or one Chinese character
VOICE_FILLERS = {"\u55ef", "\u5443", "\u989d", "\u6b38", "\u8bf6", "um", "uh", "hmm", "er"}  # um, uh: the same in Chinese
NEGATION = set("\u4e0d\u6ca1\u672a\u522b\u65e0\u975e")  # not, have not, not yet, do not, without, non-
NUMBER = re.compile(r"[0-9\u96f6\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u4e24]+")  # digits; zero..nine, ten, hundred, two
UNSURE = re.compile(r"[ \t]*[(\uff08][?\uff1f][)\uff09]")  # "(?)": the model was unsure of the word before it


EN_NUMBERS = {"zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"}


def voice_tokens(text):
    return [(m.group().lower(), m.start(), m.end()) for m in VOICE_TOKEN.finditer(text) if m.group().lower() not in VOICE_FILLERS]


def voice_number(s):
    return bool(s) and (bool(NUMBER.fullmatch(s)) or s in EN_NUMBERS)


def voice_short(tr, alt):
    """The main transcript holds much less than the speech model heard: it stopped early (two iPhone notes kept only
    their first half-sentence). On 328 pairs from real notes the main one always held at least 90%."""
    a, b = len(voice_tokens(tr)), len(voice_tokens(alt))
    return b >= 10 and a < 0.7 * b


def voice_either(s):
    """"X not X" (can or cannot, is or is not, have or have not): a question in Chinese, not a negation."""
    return len(s) == 3 and s[1] in "\u4e0d\u6ca1" and s[0] == s[2]


def voice_doubts(tr, alt, most=4):
    """Spots where tr may be misheard: where the other transcript alt disagrees on something that changes the meaning
    (English words, numbers and codes such as P0 or B73, a negation, or 3+ characters on both sides), and words the
    model marked (?). -> [{"was": words of tr, "alt": what the other model heard there ("" for a mark alone), "why"}].
    Each "was" is widened with the words around it until it reads as words and occurs once in tr, so the page can swap
    it for "alt"."""
    A, spots = voice_tokens(tr), []
    marked = {max((i for i, t in enumerate(A) if t[2] <= m.start()), default=-1) for m in UNSURE.finditer(tr)}  # words before "(?)"
    if alt:
        B = voice_tokens(alt)
        ops = difflib.SequenceMatcher(None, [t for t, _, _ in A], [t for t, _, _ in B], autojunk=False).get_opcodes()
        for k, (tag, i1, i2, j1, j2) in enumerate(ops):
            if tag == "equal":
                continue
            x, y = (re.sub(r"[^a-z0-9\u3400-\u9fff]", "", "".join(t for t, _, _ in T[a:b])) for T, a, b in ((A, i1, i2), (B, j1, j2)))
            short, long_ = sorted((x, y), key=len)
            variant = (re.fullmatch(r"[a-z]{4,}", short) and re.fullmatch(r"[a-z]+", long_) and long_.startswith(short.rstrip("e"))
                       and len(long_) - len(short.rstrip("e")) <= 4)  # dialog / dialogue, organize / organizing
            n = 0  # what both sides share at the start and at the end is no difference (changelog / change log)
            while n < min(len(x), len(y)) and x[n] == y[n]:
                n += 1
            x, y = x[n:], y[n:]
            n = 0
            while n < min(len(x), len(y)) and x[-1 - n] == y[-1 - n]:
                n += 1
            x, y = x[:len(x) - n], y[:len(y) - n]
            unsure = any(i1 <= i < max(i2, i1 + 1) for i in marked)
            if not unsure:
                if x == y or variant or (voice_number(x) and voice_number(y)):
                    continue  # DevTools / Dev Tools, Shift+V / shift + V, 3 / three / 1-pager / one pager
                if not (x and y) and re.fullmatch(r"s|es|d|ed|ing|ly", x or y):
                    continue  # form / forms, approve / approved
                if re.search(r"[a-z]", x) and not re.search(r"[a-z0-9]", y):
                    continue  # English kept as spoken where the speech model put it in Chinese or left it out (merge, pull)
                if any(not v and len(u) == 2 and (voice_either(T[a - 1][0] + u if a else "") or voice_either(u + T[b][0] if b < len(T) else ""))
                       for u, v, T, a, b in ((x, y, A, i1, i2), (y, x, B, j1, j2))):
                    continue  # "can or cannot", "is or is not": a question, not a negation
                if any(u and not v and u in ("".join(t for t, _, _ in T[max(0, a - len(u)):a]), "".join(t for t, _, _ in T[b:b + len(u)]))
                       for u, v, T, a, b in ((x, y, A, i1, i2), (y, x, B, j1, j2))):
                    continue  # a word said twice on one side only: a stutter
            neg, latin = bool(set(x) & NEGATION) != bool(set(y) & NEGATION), re.search(r"[a-z0-9]", x + y)  # a "not" on one side only
            if not (unsure or latin or neg or (len(x) >= 3 and len(y) >= 3)):
                continue
            lo = ops[k - 1][1] if k else i1  # the same words on either side, to widen it with
            hi = ops[k + 1][2] if k + 1 < len(ops) else i2
            a1, a2, b1, b2 = i1, i2, j1, j2
            span = lambda T, s, e: (T[s][1], T[e - 1][2]) if e > s else (None, None)
            (cs, ce), (cbs, cbe) = span(A, i1, i2), span(B, j1, j2)  # the differing words alone, to show when they read well
            joined = lambda i: i <= 0 or i >= len(A) or not tr[A[i - 1][2]:A[i][1]].strip()  # no punctuation between A[i-1] and A[i]
            for _ in range(8):  # too short to read: the words next to it first; not the only one: the words before it
                s, e = span(A, a1, a2)
                readable = sum(1 if t >= "\u3400" else 3 for t, _, _ in A[a1:a2]) >= 3
                if readable and tr.count(tr[s:e]) == 1:
                    break
                right = a2 < hi and (a1 <= lo or (not readable and (joined(a2) or not joined(a1))))
                if right:
                    a2, b2 = a2 + 1, b2 + 1
                elif a1 > lo:
                    a1, b1 = a1 - 1, b1 - 1
                else:
                    break
            s, e = span(A, a1, a2)
            bs, be = span(B, b1, b2)
            if s is None or bs is None or e - s > 40 or be - bs > 40:
                continue  # nothing to swap, or too long to be a few words
            why = "negation" if neg else "english" if re.search(r"[a-z]", x + y) else "number" if latin else "unsure" if unsure else "words"
            same = next((o for o in spots if o["key"] == (x, y)), None) if not unsure else None
            if same:  # the same two words again: one line, and Use it changes every place
                same.setdefault("also", []).append({"was": tr[s:e], "alt": alt[bs:be]})
                continue
            show = cs is not None and cbs is not None and re.search(r"[A-Za-z0-9]", tr[cs:ce] + alt[cbs:cbe]) and (cs, ce) != (s, e)
            spots.append({"was": tr[s:e], "alt": alt[bs:be], "why": why, "s": s, "e": e, "key": (x, y), **({"unsure": True} if unsure else {}),
                          **({"show": [tr[cs:ce], alt[cbs:cbe]]} if show else {})})
    for m in UNSURE.finditer(tr):
        words = [t for t in A if t[2] <= m.start()]
        if not words:
            continue
        hit = next((x for x in spots if x["s"] <= words[-1][1] < x["e"]), None)
        if hit:
            if hit["e"] <= m.start():
                hit["e"], hit["was"] = m.end(), tr[hit["s"]:m.end()]  # "Use it" takes the mark away too
            hit["unsure"] = True
            continue
        k = len(words) - 1  # a Chinese word: up to three characters before the mark, to be read
        while k and words[k][0] >= "\u3400" and words[k - 1][2] == words[k][1] and m.start() - words[k - 1][1] <= 3:
            k -= 1
        spots.append({"was": tr[words[k][1]:m.end()], "alt": "", "why": "unsure", "unsure": True, "s": words[k][1], "e": m.end()})
    spots.sort(key=lambda x: x["s"])
    return [{k: v for k, v in x.items() if k not in ("s", "e", "key")} for x in spots[:most]]


# T256 (from Nota, T619): the words as said, made smooth to read. The fillers named are "en, a, e, jiu shi, zhe ge".
TIDY_SYSTEM = ("Below is a voice note as transcribed (Mandarin Chinese mixed with English). Rewrite it as smooth, easy to read "
               "written text: drop filler words (\u55ef, \u554a, \u5443, \u5c31\u662f, \u8fd9\u4e2a used as fillers), stutters, "
               "repetitions and false starts (keep only what the speaker settled on), join broken sentences, fix word order "
               "and punctuation. Keep every meaning and detail; add nothing; do not summarize or translate; keep the speaker's "
               "own words where you can; keep English words, names, links, numbers and item codes exactly as they are.")
TIDY_CAP, TIDY_TRIES = float(os.environ.get("TASKA_TIDY_CAP", 8)), 3


def tidy_ok(heard, out):
    """Tidied words count only when they keep the words: about as long as what was heard, and every link still in."""
    links = re.findall(r"https?://[^\s\uff0c\u3002\u3001\uff09)]+", heard)
    return bool(out) and 0.5 * len(heard) <= len(out) <= 1.15 * len(heard) and all(u in out for u in links)


def tidy(text):
    """text made smooth to read (TIDY_SYSTEM), or as it was: short words, no good answer within TIDY_CAP, or words lost.
    Asked TIDY_TRIES times at once; the first answer that keeps the words wins (Nota's T678)."""
    if len(text) < 12:
        return text
    got = queue.Queue()

    def one():
        try:
            out = gemini(TIDY_SYSTEM, [{"text": text}], think=0, temperature=0.2, timeout=60, field="text", hint="the tidied text", model=VOICE_MODEL)
        except Exception:
            out = ""
        got.put(out if tidy_ok(text, out) else None)
    for _ in range(TIDY_TRIES):
        threading.Thread(target=one, daemon=True).start()
    end = time.time() + TIDY_CAP
    for _ in range(TIDY_TRIES):
        try:
            out = got.get(timeout=max(0.0, end - time.time()))
        except queue.Empty:
            break
        if out:
            return out
    return text


def voice_pieces(path, most=12):
    """B277: a recording cut at its pauses into pieces of up to about 8 s, as 16 kHz mono WAV bytes -> (pieces, seconds).
    Needs ffmpeg; ([], 0) without it. On some iPhone notes the models keep only the first phrase of the whole note,
    yet hear each quiet later phrase when it comes alone."""
    tool = shutil.which("ffmpeg")
    if not tool or not path:
        return [], 0.0
    try:
        raw = subprocess.run([tool, "-v", "quiet", "-i", path, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True, timeout=60).stdout
    except (OSError, subprocess.SubprocessError):
        return [], 0.0
    a = array.array("h", raw[:len(raw) // 2 * 2])
    if sys.byteorder == "big":
        a.byteswap()
    n, secs = 800, len(a) / 16000  # 50 ms frames
    db = [20 * math.log10(max(1.0, math.sqrt(sum(v * v for v in a[i:i + n]) / n)) / 32768) for i in range(0, len(a) - n + 1, n)]
    if not db:
        return [], secs
    floor = sorted(db)[len(db) // 5]  # the room's own level
    loud = [d > max(floor + 12, -52) for d in db]
    spans, start, quiet = [], None, 0
    for i, on in enumerate(loud + [False] * 8):
        if on:
            start = i if start is None else start
            quiet = 0
        elif start is not None:
            quiet += 1
            if quiet >= 7 or i >= len(loud):  # a pause of 350 ms ends a phrase
                spans.append((start, i - quiet + 1))
                start, quiet = None, 0
    pieces = []
    for s0, s1 in spans:  # phrases joined into pieces of up to 8 s, each with a little room around it
        if pieces and s1 - pieces[-1][0] <= 160:
            pieces[-1][1] = s1
        else:
            pieces.append([s0, s1])
    out = []
    for s0, s1 in pieces[:most]:
        if s1 - s0 < 4:  # under 200 ms: a click
            continue
        b0, b1 = max(0, (s0 - 4) * n), min(len(a), (s1 + 4) * n)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes(a[b0:b1].tobytes())
        out.append(buf.getvalue())
    return out, secs


def voice_by_pieces(path, prompt, vocab):
    """B277: the note heard piece by piece (voice_pieces), both models on each at once. A piece counts only when the
    speech model heard words in it (it never makes words up from noise); the main model's words win there."""
    pieces, secs = voice_pieces(path)
    if len(pieces) < 2:
        return ""
    def one(wav):
        aud = {"inline_data": {"mime_type": "audio/wav", "data": base64.b64encode(wav).decode()}}
        (m, _), (a, _) = together(lambda: capped(lambda: voice_main(aud, prompt), 30, "the main model"), lambda: capped(lambda: voice_asr(aud, vocab), 30, "the speech model"))
        return (m or a or "").strip() if (a or "").strip() else ""
    got = together(*[(lambda w=w: one(w)) for w in pieces])
    parts = [t for t, e in got if t]
    return "".join(p if re.search(r"[\u3002\uff0c\uff1f\uff01.,?!]$", p) else p + "\uff0c" for p in parts).rstrip("\uff0c") + ("\u3002" if parts and not re.search(r"[\u3002\uff1f\uff01.?!]$", parts[-1]) else "")


def transcribe(store, data, mime, scope, path=None, later=None):
    """Voice note -> {"tr": its words ("" when nobody spoke), "tr_by": "main", "asr" or "pro", "alt": the other model's
    words, "doubts": what may be misheard}, biased toward the project's own vocabulary. path: the note on disk, to tell
    a phone's voice-processed recording, which the strong model hears too. Raises Err when no model answered.
    later(words or None): when the strong model ran out of time, it goes on for up to PRO_LATE; later gets its words
    once they are in, if they hold clearly more than the words given (these hold under 90% of them), else None. The
    answer then says "more": the words may be cut short, fuller ones may follow."""
    words, items, titles = voice_context(store, scope)
    fixes = HUB.corrections() if HUB else []
    terms = voice_terms(words, fixes)
    audio = {"inline_data": {"mime_type": mime.split(";")[0], "data": base64.b64encode(data).decode()}}
    vocab = list(dict.fromkeys(["Taska", "P0", "P1", "P2", "P3"] + terms))[:100]
    prompt = voice_prompt(terms, items, fixes, HUB.voice_prefs()["text"] if hasattr(HUB, "voice_prefs") else VOICE_PREFS)
    t0, times = time.time(), {}
    gated = voice_gated(path, mime) >= 0.5
    calls = [lambda: capped(lambda: voice_main(audio, prompt), VOICE_CAP, "the main model", times, "main"),
             lambda: capped(lambda: voice_asr(audio, vocab), VOICE_CAP, "the speech model", times, "asr")]
    slow = {}  # the strong model's run, when it ran out of time
    if gated:  # the strong model is slow at times: it gets PRO_CAP, then the others' words go on without it
        calls.append(lambda: capped(lambda: voice_main(audio, prompt, PRO_MODEL), PRO_CAP, "the strong model", times, "pro", slow))
    (tr, err), (alt, alt_err), *pro = together(*calls)
    out = {"tr": "", "tr_by": "asr", "times": times, **({"gated": True} if gated else {})}
    if err:
        out["main_error"] = str(err)
    if alt_err:
        out["asr_error"] = str(alt_err)
    if alt_err is None and not alt:  # the speech model heard nobody: what the other wrote was made up (B092)
        times["total"] = round(time.time() - t0, 1)
        return out
    if err is None and tr and not echoed(tr, titles) and alt_err is None and voice_short(tr, alt):
        left = VOICE_BUDGET - (time.time() - t0)
        try:  # it stopped early: asked once more (not when the strong model heard it too, nor past the budget), then the speech model's words
            again = "" if (pro and pro[0][0]) or left < 10 else capped(lambda: voice_main(audio, prompt), left, "the main model, asked again", times, "again")
        except Exception:
            again = ""
        if again and not voice_short(again, alt):
            tr = again
        else:
            out["main_error"] = f"the main transcript stopped early ({len(voice_tokens(tr))} of {len(voice_tokens(alt))} words)"
            tr = ""
    if err is None and tr and not echoed(tr, titles):
        out["tr_by"] = "main"
    elif alt_err is None:  # the main one refused, failed, stopped early, heard nothing or wrote only item titles: the speech model's words
        tr, alt = alt, ""
    elif err is None:  # nothing heard but item titles, and no second opinion
        out["tr_by"], tr = "main", ""
    else:
        tr = None
    if pro:  # a phone's processed voice: the strong model heard it too, and its words win when it heard as much or more
        ptr, perr = pro[0]
        if perr:
            out["pro_error"] = str(perr)
        elif ptr and not echoed(ptr, titles) and (not tr or len(voice_tokens(ptr)) >= 0.9 * len(voice_tokens(tr))):
            out["tr_by"], tr, alt = "pro", ptr, ""
    times["total"] = round(time.time() - t0, 1)
    if tr is None:
        raise Err(f"{err}; the speech model: {alt_err}")
    if not tr:
        return out
    try:  # B277: few words for a long note: heard again piece by piece, and those words win when clearly more
        dur = float(subprocess.run([shutil.which("ffprobe") or "ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, timeout=20).stdout or 0) if path else 0
    except (OSError, ValueError, subprocess.SubprocessError):
        dur = 0
    if dur >= 6 and len(voice_tokens(tr)) < 2.0 * dur and len(tr) < 2.0 * dur:
        t1 = time.time()
        try:
            pieced = voice_by_pieces(path, prompt, vocab)
        except Exception:
            pieced = ""
        times["pieces"] = round(time.time() - t1, 1)
        if pieced and len(pieced) >= 1.3 * len(tr) and not echoed(pieced, titles):
            out["tr_by"], alt, tr = "pieces", tr, pieced
        times["total"] = round(time.time() - t0, 1)
    cap = max(5.0, VOICE_BUDGET + 5 - (time.time() - t0))  # Traditional characters made Simplified, in what time is left
    (tr2, _), (alt2, _) = together(lambda: capped(lambda: simplified(tr), cap, "simplifying"), lambda: capped(lambda: simplified(alt or ""), cap, "simplifying"))
    tr, alt = tr2 if tr2 is not None else tr, alt2 if alt2 is not None else (alt or "")
    times["total"] = round(time.time() - t0, 1)
    for c in fixes:  # what the user fixed once stays fixed (F144)
        if c.get("wrong"):
            tr, alt = tr.replace(c["wrong"], c["right"]), alt.replace(c["wrong"], c["right"])
    if later and slow.get("thread"):  # its words may still come: wait for them in the background
        threading.Thread(target=pro_later, args=(slow, t0, tr, titles, fixes, later), daemon=True).start()
        out["more"] = True
    doubts = voice_doubts(tr, alt)
    if HUB and getattr(HUB, 'tidy_on', lambda: False)():  # T256: smooth to read, the words as said kept as "heard"
        t0_ = time.time()
        nice = tidy(tr)
        times["tidy"] = round(time.time() - t0_, 1)
        if nice != tr:
            out["heard"], tr = tr, nice
    return dict(out, tr=tr, alt=alt, doubts=doubts)


def fuller(tr, ptr):
    """The strong model's late words hold clearly more than those given: those hold under 90% of its words."""
    a, b = len(voice_tokens(tr)), len(voice_tokens(ptr))
    return b > a and a < 0.9 * b


def pro_later(slow, t0, tr, titles, fixes, later):
    """Wait for a strong model that ran out of time, up to PRO_LATE from the start; later(its words or None)."""
    slow["thread"].join(max(0.0, t0 + PRO_LATE - time.time()))
    ptr = slow["box"].get("v") if not slow["thread"].is_alive() else None
    if ptr and not echoed(ptr, titles):
        ptr = simplified(ptr)
        for c in fixes:
            if c.get("wrong"):
                ptr = ptr.replace(c["wrong"], c["right"])
    later(ptr if ptr and fuller(tr, ptr) else None)


def echoed(tr, titles):
    """A transcript made only of item titles was copied from the prompt: nobody spoke (B092)."""
    norm = lambda t: " ".join(re.sub(r"[\W_]+", " ", t.lower()).split())
    rest = norm(tr)
    if not rest:
        return False
    for t in sorted({norm(t) for t in titles if norm(t)}, key=len, reverse=True):
        rest = rest.replace(t, " ")
    return not rest.strip()


def voice_mime(fid):
    """The audio type of an uploaded voice note, by its name; "" for anything else."""
    mime = AUDIO_MIME.get(os.path.splitext(fid)[1].lower()) or (mimetypes.guess_type(fid)[0] or "").replace("video/webm", "audio/webm")
    return mime if mime.startswith("audio/") else ""


def voice_answer(fid, job):
    """What a page gets for a voice note: its words once they are in, which model's they are, what may be misheard."""
    res = (job or {}).get("res") or {}
    return {"f": fid, "done": not job or job["done"], "tr": job["tr"] if job else "",
            "tr_error": (job["err"] if job else "no such voice note") or "",
            **{k: res[k] for k in ("tr_by", "doubts", "gated", "main_error", "asr_error", "pro_error", "times", "more", "heard") if k in res}}


def voice_saved(store, fid):
    """The transcript kept next to a voice note (<file>.tr.json), or None (T101)."""
    try:
        with open(store.local(fid) + ".tr.json", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def voice_keep(store, fid, res):
    """Keep a voice note's transcript next to its audio, so it is not worked out again after a restart and a page
    that lost the answer gets it by file id (T101)."""
    side = store.local(fid) + ".tr.json"
    try:
        with open(side + ".tmp", "w", encoding="utf-8") as f:
            json.dump(dict(res, t=now()), f, ensure_ascii=False)
        os.replace(side + ".tmp", side)
    except OSError:
        pass


# --------------------------------------------------------------------------- http

HUB = None
ITEM_PATH = re.compile(r"/([A-Za-z]?\d+)")
VIEW_PATH = re.compile(r"/(inputs|archive|rules|new-rule|new|settings|agents|connect|phone|notifications|spellings|log|deleted|about|projects|organizer|[A-Za-z]\d+)")  # the page's views (T102, B162)
NAME = re.compile(r"[a-z0-9][a-z0-9-]{0,39}")  # a project's address and folder: made from its name once, never changed (F173)
TITLE_MAX = 60
SLUG_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"


def title_of(name):
    """A project's name for people (F173): any text, spaces, Chinese, emoji; one line, up to TITLE_MAX characters."""
    t = " ".join(str(name or "").split())
    if not t:
        raise Err("give the project a name")
    if len(t) > TITLE_MAX:
        raise Err(f"a project name is up to {TITLE_MAX} characters")
    return t


def slug_of(title):
    """The address a new project gets from its name (F173): Home Budget -> home-budget, Café -> cafe; "" for a name
    with no a-z or 0-9 in it (it gets a short code instead, see short_slug)."""
    t = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")[:40].strip("-")


def short_slug():
    return "p-" + "".join(secrets.choice(SLUG_CHARS) for _ in range(4))  # p-7k2m

CONNECT = """#!/bin/sh
# Connects the current folder to the Taska project {name}. Run it in the project's folder on the machine
# where your coding agent works:  curl -s {base}/connect | sh
set -e
printf '%s\\n' '{base}' > .taska
for d in "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.gemini/config/skills"; do
  if [ -d "$(dirname "$d")" ]; then
    mkdir -p "$d/taska" && curl -fsS '{host}/skill' -o "$d/taska/SKILL.md" && echo "skill: $d/taska/SKILL.md"
  fi
done
echo "This folder now points to Taska project {name}: {base} (saved in .taska)"
"""


KEY_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"  # no 0/o, 1/l/i: easy to type on a phone
plain_key = lambda k: re.sub(r"[^a-z0-9]", "", str(k or "").lower())


# Push to a phone (F195). A Home Screen Taska subscribes with the browser's push service; Taska tells that service
# "something needs you" with an empty push, signed with its own key (VAPID, RFC 8292: an ES256 token). The phone then
# asks Taska itself what needs you, so the push service never sees what it is. Only the standard library: P-256 ECDSA
# is a few lines of arithmetic.
P256_P = 2 ** 256 - 2 ** 224 + 2 ** 192 + 2 ** 96 - 1
P256_N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551
P256_G = (0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296,
          0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5)


def p256_add(a, b):
    if a is None:
        return b
    if b is None:
        return a
    if a[0] == b[0] and (a[1] + b[1]) % P256_P == 0:
        return None
    if a == b:
        m = (3 * a[0] * a[0] - 3) * pow(2 * a[1], -1, P256_P) % P256_P  # the curve's a is -3
    else:
        m = (b[1] - a[1]) * pow(b[0] - a[0], -1, P256_P) % P256_P
    x = (m * m - a[0] - b[0]) % P256_P
    return x, (m * (a[0] - x) - a[1]) % P256_P


def p256_mul(k, pt=P256_G):
    out = None
    while k:
        if k & 1:
            out = p256_add(out, pt)
        pt, k = p256_add(pt, pt), k >> 1
    return out


def b64u(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def es256(d, msg):
    """An ES256 signature of msg with private key d: r and s, 32 bytes each (JWS form)."""
    z = int.from_bytes(hashlib.sha256(msg).digest(), "big")
    while True:
        k = secrets.randbelow(P256_N - 1) + 1
        r = p256_mul(k)[0] % P256_N
        sig = pow(k, -1, P256_N) * (z + r * d) % P256_N
        if r and sig:
            return r.to_bytes(32, "big") + sig.to_bytes(32, "big")


def was_by(store, it):
    """Who last set an item's status (F197): an agent may not reopen what the user dropped."""
    for e in reversed(store.events):
        if e.get("n") == it["n"] and e["k"] == "set" and "status" in (e.get("f") or {}) and not isinstance(e.get("f"), str):
            return e.get("by")
        if e.get("n") == it["n"] and e["k"] == "add":
            return e.get("by")
    return None


class Push:
    """The phones that asked for pushes, Taska's push key, and the pushes themselves, for every project (F195)."""
    QUIET = (22, 8)  # local hours with no push, for a subscription that keeps quiet hours

    def __init__(self, root):
        self.dir = os.path.join(root, ".push")
        self.lock = threading.Lock()
        os.makedirs(self.dir, exist_ok=True)
        try:
            with open(os.path.join(self.dir, "vapid.json"), encoding="utf-8") as f:
                self.d = int(json.load(f)["d"], 16)
        except (FileNotFoundError, ValueError, KeyError):
            self.d = secrets.randbelow(P256_N - 1) + 1
            with open(os.path.join(self.dir, "vapid.json"), "w", encoding="utf-8") as f:
                json.dump({"d": format(self.d, "x")}, f)
            os.chmod(os.path.join(self.dir, "vapid.json"), 0o600)
        x, y = p256_mul(self.d)
        self.public = b64u(b"\x04" + x.to_bytes(32, "big") + y.to_bytes(32, "big"))
        try:
            with open(os.path.join(self.dir, "subs.json"), encoding="utf-8") as f:
                self.subs = [x for x in json.load(f) if isinstance(x, dict) and x.get("endpoint", "").startswith("https://")]
        except (FileNotFoundError, ValueError):
            self.subs = []
        self.seen = None  # what needed you at the last look: only what is new is pushed

    def save(self):
        with open(os.path.join(self.dir, "subs.json"), "w", encoding="utf-8") as f:
            json.dump(self.subs, f)

    def subscribe(self, sub, quiet=True):
        ep = str((sub or {}).get("endpoint", ""))
        if not ep.startswith("https://"):
            raise Err("a push subscription needs an https endpoint")
        with self.lock:
            self.subs = [x for x in self.subs if x["endpoint"] != ep] + [{"endpoint": ep, "quiet": bool(quiet), "t": int(time.time())}]
            self.save()

    def unsubscribe(self, ep):
        with self.lock:
            self.subs = [x for x in self.subs if x["endpoint"] != ep]
            self.save()

    def has(self, ep):
        with self.lock:
            return any(x["endpoint"] == ep for x in self.subs)

    def token(self, endpoint):
        """The VAPID header for a push service: who sends (this Taska), for 12 hours."""
        u = urlsplit(endpoint)
        claims = {"aud": f"{u.scheme}://{u.netloc}", "exp": int(time.time()) + 12 * 3600, "sub": "mailto:taska@example.invalid"}
        head = b64u(json.dumps({"typ": "JWT", "alg": "ES256"}).encode()) + "." + b64u(json.dumps(claims).encode())
        return f"vapid t={head}.{b64u(es256(self.d, head.encode()))}, k={self.public}"

    def send(self, sub):
        """An empty push to one phone. False when the push service says the subscription is gone."""
        req = urllib.request.Request(sub["endpoint"], data=b"", method="POST",
                                     headers={"Authorization": self.token(sub["endpoint"]), "TTL": "3600", "Urgency": "high", "Content-Length": "0"})
        try:
            with urllib.request.urlopen(req, timeout=15):
                return True
        except urllib.error.HTTPError as ex:
            return ex.code not in (404, 410)
        except OSError:
            return True  # the network: try again with the next news

    def check(self, needs):
        """needs: what needs you now (Hub.needs). New since the last look: one push to every phone not in quiet hours."""
        now = {(x["project"], x["code"], x["kind"]) for x in needs}
        new, self.seen = (now - self.seen if self.seen is not None else set()), now
        if not new:
            return 0
        hour = time.localtime().tm_hour
        quiet = hour >= self.QUIET[0] or hour < self.QUIET[1]
        with self.lock:
            subs = [x for x in self.subs if not (x.get("quiet", True) and quiet)]
        gone = [x["endpoint"] for x in subs if not self.send(x)]
        for ep in gone:
            self.unsubscribe(ep)
        return len(subs) - len(gone)


class Hub:
    """Projects: one folder each under the data root, holding taska.jsonl and its files."""

    def __init__(self, root, organizer, public=""):
        self.root = os.path.abspath(os.path.expanduser(root))
        self.organizer = organizer
        self.public = public.rstrip("/")  # the tunnel's address, for the phone link
        self.lock = threading.Lock()
        self.projects = {}
        self.trash = os.path.join(self.root, ".deleted")  # deleted projects, as they were: Restore brings one back (F173)
        os.makedirs(self.root, exist_ok=True)
        self.push = Push(self.root)  # phones that want a push when something needs you (F195)
        try:
            with open(os.path.join(self.root, "key"), encoding="utf-8") as f:
                self.key = f.read().strip()
        except FileNotFoundError:
            self.new_key()
        try:
            with open(os.path.join(self.root, "corrections.json"), encoding="utf-8") as f:
                self.fixes = [c for c in json.load(f) if isinstance(c, dict) and c.get("right")]  # T256: a right word alone is one to hear right
        except (FileNotFoundError, ValueError):
            self.fixes = []
        try:
            with open(os.path.join(self.root, "voice-prefs.txt"), encoding="utf-8") as f:
                self.prefs = f.read().strip() or None
        except FileNotFoundError:
            self.prefs = None
        try:  # F253: the order you dragged the projects into; one for every page that lists them
            with open(os.path.join(self.root, "project-order.json"), encoding="utf-8") as f:
                self.order = [n for n in json.load(f) if isinstance(n, str)]
        except (FileNotFoundError, ValueError):
            self.order = []
        for name in sorted(os.listdir(self.root)):
            if NAME.fullmatch(name) and os.path.isfile(os.path.join(self.root, name, "taska.jsonl")):
                self.open(name)
        if not self.projects:
            self.add("default")

    # Spelling fixes the user made to voice transcripts (F144): one list for every project, kept in the data root.
    # Transcription is told about them, and puts the right form in for a wrong one it still writes.
    def corrections(self):
        with self.lock:
            return [dict(c) for c in self.fixes]

    def voice_prefs(self):
        """F183: {"text": how voice notes are written down, "default": True while the user never changed it}."""
        with self.lock:
            return {"text": self.prefs or VOICE_PREFS, "default": self.prefs is None}

    def set_voice_prefs(self, text):
        """New preferences for every project; empty text goes back to the default."""
        text = "\n".join(line.rstrip() for line in str(text or "").strip().splitlines())
        if len(text) > MAX_PREFS:
            raise Err(f"keep the preferences under {MAX_PREFS} characters")
        path = os.path.join(self.root, "voice-prefs.txt")
        with self.lock:
            self.prefs = text if text and text != VOICE_PREFS else None
            if self.prefs is None:
                try:
                    os.remove(path)
                except FileNotFoundError:
                    pass
                return
            with open(path + ".tmp", "w", encoding="utf-8") as f:
                f.write(self.prefs + "\n")
            os.replace(path + ".tmp", path)

    def correct(self, wrong, right=None):
        """Remember wrong -> right (or forget wrong, when right is None)."""
        wrong = " ".join(str(wrong or "").split())
        if not wrong or len(wrong) > 60:
            raise Err("pick the wrong words: up to 60 characters")
        if right is not None:
            right = " ".join(str(right).split())
            if not right or len(right) > 60 or right == wrong:
                raise Err("write the right words: up to 60 characters, different from the wrong ones")
        with self.lock:
            self.fixes = [c for c in self.fixes if c.get("wrong") != wrong]
            if right is not None:
                self.fixes.append({"wrong": wrong, "right": right, "t": datetime.now().astimezone().isoformat(timespec="seconds")})
            tmp = os.path.join(self.root, "corrections.json.tmp")
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self.fixes, f, ensure_ascii=False, indent=1)
            os.replace(tmp, os.path.join(self.root, "corrections.json"))

    def tidy_on(self):
        """T256: voice notes are tidied unless the user turned it off (a file in the data root says off)."""
        return not os.path.exists(os.path.join(self.root, "voice-tidy-off"))

    def set_tidy(self, on):
        path = os.path.join(self.root, "voice-tidy-off")
        if on:
            try:
                os.remove(path)
            except FileNotFoundError:
                pass
        else:
            open(path, "w").close()

    def word(self, right, forget=False):
        """T256 (from Nota): a word to hear right, without a wrong form first; or forget it."""
        right = " ".join(str(right or "").split())
        if not right or len(right) > 60:
            raise Err("write the word: up to 60 characters")
        with self.lock:
            self.fixes = [c for c in self.fixes if c.get("wrong") or c["right"] != right]
            if not forget:
                self.fixes.append({"right": right, "t": datetime.now().astimezone().isoformat(timespec="seconds")})
            tmp = os.path.join(self.root, "corrections.json.tmp")
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self.fixes, f, ensure_ascii=False, indent=1)
            os.replace(tmp, os.path.join(self.root, "corrections.json"))

    def new_key(self):
        """The key that opens Taska from outside this machine and its network. A new one locks out every other device.
        8 characters (F61): short enough to type on a phone; 31^8 ≈ 10^12 guesses is far out of reach over the tunnel."""
        self.key = "-".join("".join(secrets.choice(KEY_CHARS) for _ in range(4)) for _ in range(2))
        path = os.path.join(self.root, "key")
        with open(path, "w", encoding="utf-8") as f:
            f.write(self.key + "\n")
        os.chmod(path, 0o600)

    def open(self, name):
        s = Store(os.path.join(self.root, name, "taska.jsonl"))
        s.name, s.org_on = name, self.organizer
        s.resume_words()  # before the organizer: an input waiting for its words is held for them again (B165)
        if s.org_on:
            Organizer(s).start()
        self.projects[name] = s
        return s

    # Projects have a name for people and an address (F173). The address (/p/<address>, also the folder) is made from
    # the name once and never changes, so agents, .taska files, phone links and bookmarks keep working through a
    # rename. A deleted project moves to .deleted/ with everything in it and keeps its address, so Restore is exact.
    def taken(self, slug):
        return slug in self.projects or os.path.exists(os.path.join(self.root, slug)) or os.path.exists(os.path.join(self.trash, slug))

    def clash(self, title, but=None):
        if any(s is not but and s.title.lower() == title.lower() for s in self.projects.values()):
            raise Err(f"a project called {title} exists already")

    def add(self, name):
        title = title_of(name)
        with self.lock:
            self.clash(title)
            base = slug_of(title)
            slug, k = base or short_slug(), 2
            while self.taken(slug):  # an address in use, also by a deleted project, is never given twice
                slug, k = f"{base[:36].rstrip('-')}-{k}" if base else short_slug(), k + 1
            os.makedirs(os.path.join(self.root, slug), exist_ok=True)
            s = self.open(slug)
        if title != slug:
            s.run_all([(0, {"op": "cfg", "name": title})], "you")
        return s

    def live(self, slug):
        s = self.projects.get(str(slug or ""))
        if not s:
            raise Err(f"no project {slug}")
        return s

    def rename(self, slug, name):
        title = title_of(name)
        with self.lock:
            s = self.live(slug)
            self.clash(title, but=s)
            was = s.title
        if title != was:
            s.run_all([(0, {"op": "cfg", "name": title})], "you")
        return s, was

    def delete(self, slug):
        """Out of the way, nothing lost: the folder moves to .deleted/; agents asking for work hear it was deleted."""
        with self.lock:
            s = self.live(slug)
            with s.cond:
                s.gone, info = True, {"t": now(), "title": s.title, "items": len(s.active())}
                s.bump()  # pages and agents waiting on it hear at once
                s.out.close()
            del self.projects[s.name]
            os.makedirs(self.trash, exist_ok=True)
            os.rename(os.path.join(self.root, s.name), os.path.join(self.trash, s.name))
            with open(os.path.join(self.trash, s.name, "deleted.json"), "w", encoding="utf-8") as f:
                json.dump(info, f, ensure_ascii=False)
            return s

    def restore(self, slug):
        slug = str(slug or "")
        with self.lock:
            src = os.path.join(self.trash, slug)
            if not NAME.fullmatch(slug) or not os.path.isfile(os.path.join(src, "taska.jsonl")):
                raise Err(f"no deleted project {slug}")
            if slug in self.projects or os.path.exists(os.path.join(self.root, slug)):
                raise Err(f"the address {slug} is in use")
            with contextlib.suppress(FileNotFoundError):
                os.remove(os.path.join(src, "deleted.json"))
            os.rename(src, os.path.join(self.root, slug))
            return self.open(slug)

    def purge(self, slug):
        """The one step that can't be undone: a deleted project's folder goes for good."""
        slug = str(slug or "")
        with self.lock:
            src = os.path.join(self.trash, slug)
            if not NAME.fullmatch(slug) or not os.path.isdir(src):
                raise Err(f"no deleted project {slug}")
            shutil.rmtree(src)

    def deleted(self):
        out = []
        for slug in sorted(os.listdir(self.trash)) if os.path.isdir(self.trash) else []:
            if not NAME.fullmatch(slug) or not os.path.isfile(os.path.join(self.trash, slug, "taska.jsonl")):
                continue
            try:
                with open(os.path.join(self.trash, slug, "deleted.json"), encoding="utf-8") as f:
                    info = json.load(f)
            except (OSError, ValueError):
                info = {}
            out.append({"name": slug, "title": info.get("title") or slug, "t": info.get("t") or "", "items": info.get("items", 0)})
        return sorted(out, key=lambda d: d["t"], reverse=True)

    def summary(self):
        out = []
        for name, s in sorted(self.projects.items()):
            with s.lock:
                live = [i for i in s.active() if i["status"] not in CLOSED]
                # "open" as the project's own page counts it (A18): what Items holds that isn't finished, rules an agent
                # proposed included, since they wait in Items too
                out.append({"name": name, "title": s.title, "open": sum(1 for i in live if not i["archived"] and (i["type"] != "rule" or i["status"] == "proposed")), "auto": s.cfg["auto"],
                            "needs": sum(1 for i in live if s.waiting(i) or i["status"] in ("proposed", "review")), **s.presence(),
                            "t": int(os.path.getmtime(s.path) * 1000), **({"pos": self.order.index(name)} if name in self.order else {})})
        return out

    def set_order(self, names):
        """F253: the projects in the order you put them; ones left out keep their places after these, by name."""
        if not isinstance(names, list) or not all(isinstance(n, str) for n in names):
            raise Err("give the projects' names in their new order")
        with self.lock:
            self.order = list(dict.fromkeys(n for n in names if n in self.projects))
            path = os.path.join(self.root, "project-order.json")
            with open(path + ".tmp", "w", encoding="utf-8") as f:
                json.dump(self.order, f)
            os.replace(path + ".tmp", path)

    def search(self, q, skip=""):
        """Words in every project but `skip` (F196): items by their code, title, text and thread, and what you said
        (inputs). Every word must be there. Newest first, at most 30."""
        words = [w for w in q.lower().split() if w][:8]
        out = []
        if not words:
            return out
        for name, s in sorted(self.projects.items()):
            if name == skip:
                continue
            with s.lock:
                for i in s.items.values():
                    if i["merged_into"] or i.get("deleted"):
                        continue
                    hay = " ".join([s.code(i["n"]), i["title"], i["body"], i.get("next", ""), *(x.get("text", "") for x in i["thread"])]).lower()
                    if all(w in hay for w in words):
                        out.append({"project": name, "ptitle": s.title, "kind": "item", "code": s.code(i["n"]), "title": i["title"],
                                    "status": i["status"], "archived": i["archived"], "t": i.get("t1") or i.get("t0") or ""})
                for r in s.inputs.values():
                    if not r.get("deleted") and all(w in (r["id"] + " " + r["text"]).lower() for w in words):
                        out.append({"project": name, "ptitle": s.title, "kind": "input", "code": r["id"], "title": r["text"][:200], "t": r["t"]})
        return sorted(out, key=lambda x: x["t"], reverse=True)[:30]

    def needs(self):
        """What needs you in every project (F193): an agent asks or is blocked, an item waits for approval or acceptance.
        Newest first, so the sidebar's list leads with what just came in."""
        out = []
        for name, s in sorted(self.projects.items()):
            with s.lock:
                for i in s.active():
                    if i["status"] in CLOSED or i.get("merged_into"):
                        continue
                    w = s.waiting(i)
                    kind = w["kind"] if w else i["status"] if i["status"] in ("proposed", "review") else None
                    if kind:
                        out.append({"project": name, "ptitle": s.title, "n": i["n"], "code": s.code(i["n"]), "title": i["title"],
                                    "kind": kind, "pri": i["pri"], "t": i.get("t1") or i.get("t") or ""})
        return sorted(out, key=lambda x: x["t"], reverse=True)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "Taska"

    def log_message(self, *args):
        pass

    def send(self, code, body, ctype="text/plain; charset=utf-8", extra=None):
        if isinstance(body, str):
            body = body.encode("utf-8")
        try:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):  # the caller left before the answer; what was done stays done
            self.close_connection = True

    def json(self, obj, code=200):
        self.send(code, json.dumps(obj, ensure_ascii=False), "application/json; charset=utf-8")

    def redirect(self, to, extra=None):
        self.send(302, "", extra=dict(extra or {}, Location=to))

    def guard(self):
        """This machine and its network come straight in. Through a tunnel or from the internet you need the key:
        a cookie (browsers), or /k/<key>/ in front of the path (agents, and the link that opens Taska on a phone)."""
        # Other websites' scripts and forms are refused. Opening Taska from another page (Local Hub at
        # localhost:7331 is another site to 127.0.0.1:7340) is just a visit, so a plain page load is fine.
        visit = self.command in ("GET", "HEAD") and self.headers.get("Sec-Fetch-Mode") == "navigate" \
            and self.headers.get("Sec-Fetch-Dest") in ("document", None)
        if self.headers.get("Sec-Fetch-Site") == "cross-site" and not visit:
            self.send(403, "cross-site request refused\n")
            return False
        self.prefix = ""
        if self.trusted():
            return True
        if self.command in ("GET", "HEAD") and self.path.split("?")[0] in APP_PATHS:  # F192: no data in them
            return True
        m = re.fullmatch(r"/k/([A-Za-z0-9-]+)(/.*)?", self.path.split("?")[0])
        if m:
            given, self.path = m.group(1), (m.group(2) or "/") + (self.path[len(m.group(0)):] or "")
        else:
            given = next((c.split("=", 1)[1] for c in (self.headers.get("Cookie") or "").split("; ") if c.startswith("taska_key=")), "")
        if not hmac.compare_digest(plain_key(given), plain_key(HUB.key)):
            if self.command == "POST" and self.path == "/login":
                return self.login()
            if "navigate" == self.headers.get("Sec-Fetch-Mode") or "text/html" in (self.headers.get("Accept") or ""):
                self.send(401, LOGIN.replace("{next}", quote(self.path, safe="/?=&-_.")).replace("{wrong}", ""), "text/html; charset=utf-8")
            else:
                self.send(401, "Taska: this address needs the key. Ask the user for Taska's connect command (it carries the key).\n")
            return False
        self.prefix = f"/k/{HUB.key}"
        if m and self.command == "GET" and self.headers.get("Sec-Fetch-Mode") == "navigate":
            self.redirect(self.path, self.cookie())  # the phone link: remember the key, then drop it from the address bar
            return False
        return True

    def trusted(self):
        """This machine or its local network (F27). Anything forwarded by a tunnel is not."""
        if self.headers.get("X-Forwarded-For") or self.headers.get("X-Forwarded-Host"):
            return False
        ip = ipaddress.ip_address(self.client_address[0])
        ip = getattr(ip, "ipv4_mapped", None) or ip
        return ip.is_loopback or ip.is_private or ip.is_link_local

    def cookie(self):
        secure = "; Secure" if self.host().startswith("https:") else ""
        return {"Set-Cookie": f"taska_key={HUB.key}; Path=/; Max-Age=34560000; HttpOnly; SameSite=Lax{secure}"}

    def login(self):
        form = parse_qs(self.body(10_000).decode("utf-8", "replace"))
        nxt = (form.get("next") or ["/"])[0]
        nxt = nxt if nxt.startswith("/") and not nxt.startswith("//") else "/"
        if hmac.compare_digest(plain_key((form.get("key") or [""])[0]), plain_key(HUB.key)):
            self.send(303, "", extra=dict(self.cookie(), Location=nxt))
        else:
            time.sleep(1)  # slows guessing; the key has ~79 bits anyway
            self.send(401, LOGIN.replace("{next}", quote(nxt, safe="/?=&-_.")).replace("{wrong}", "That key is not right. "), "text/html; charset=utf-8")
        return False

    def body(self, limit):
        if "chunked" in (self.headers.get("Transfer-Encoding") or "").lower():
            data = b""
            while True:
                size = int(self.rfile.readline().split(b";")[0].strip() or b"0", 16)
                if size == 0:
                    self.rfile.readline()
                    break
                data += self.rfile.read(size)
                self.rfile.readline()
                if len(data) > limit:
                    raise Err("body too large")
            return data
        n = int(self.headers.get("Content-Length") or 0)
        if n > limit:
            raise Err("body too large")
        return self.rfile.read(n)

    def url(self):
        # http.server decodes the request line as latin-1; curl sends raw UTF-8 (e.g. ?q= with Chinese words)
        return urlsplit(self.path.encode("latin-1", "replace").decode("utf-8", "replace"))

    def host(self):
        """The address the caller used. Behind a tunnel (VS Code, Cloudflare...) that is the public https one."""
        h = self.headers.get("X-Forwarded-Host") or self.headers.get("Host") or "localhost"
        proto = self.headers.get("X-Forwarded-Proto") or "http"
        return f"{proto.split(',')[0].strip()}://{h.split(',')[0].strip()}"

    def local(self):
        """A caller on this machine, not one coming in through a tunnel."""
        return (self.client_address[0] in ("127.0.0.1", "::1") and not self.headers.get("X-Forwarded-For")
                and not self.headers.get("X-Forwarded-Host"))

    def project(self, p):
        """/p/<name>/x is that project. Bare paths (/next, /B03 ...) work while there is only one project."""
        m = re.fullmatch(r"/p/([a-z0-9][a-z0-9-]*)(/.*)?", p)
        if m:
            s = HUB.projects.get(m.group(1))
            if not s and os.path.isdir(os.path.join(HUB.trash, m.group(1))):  # F173: agents asking for work hear why there is none
                raise Err(f"project {m.group(1)} was deleted: there is no work here. The user can restore it in Taska (Settings › Projects).")
            if not s:
                raise Err(f"no project {m.group(1)}. Projects: {', '.join(sorted(HUB.projects))}")
            return s, m.group(2) or "", f"{self.host()}{self.prefix}/p/{s.name}"
        if len(HUB.projects) == 1:
            s = next(iter(HUB.projects.values()))
            return s, p, f"{self.host()}{self.prefix}/p/{s.name}"
        raise Err("which project? Use one of: " + "  ".join(f"{self.host()}/p/{n}" for n in sorted(HUB.projects)))

    def scope_of(self, s, q):
        """The item a voice note is about (?scope=B03): its words are spelled like that item's."""
        try:
            return s.item(q["scope"][0], follow=False)["n"] if q.get("scope") else None
        except Err:
            return None

    def fileref(self, s):
        """Files as local paths for an agent on this machine, as URLs for one elsewhere."""
        if self.local():
            return lambda fid: os.path.join(s.fdir, fid)
        base = f"{self.host()}{self.prefix}/p/{s.name}/f/"
        return lambda fid: base + quote(fid)

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if not self.guard():
            return
        u = self.url()
        q, p = parse_qs(u.query), unquote(u.path)
        try:
            if p == "/":  # the front door (Local Hub links here): every project
                return self.send(200, INDEX, "text/html; charset=utf-8")
            if p in APP_PATHS:  # F192: Taska on the Home Screen
                if p == "/sw.js":
                    return self.send(200, SW, "text/javascript; charset=utf-8")
                if p == "/manifest.webmanifest":
                    return self.send(200, MANIFEST, "application/manifest+json")
                return self.send(200, ICONS[int(p[6:-4])], "image/png")
            if p == "/health":
                return self.json({"status": "ok", "app": "taska", "projects": len(HUB.projects)})
            if p == "/skill":
                return self.send(200, SKILL, "text/markdown; charset=utf-8")
            if p == "/api/projects":
                return self.json(HUB.summary())
            if p == "/api/needs":  # F193: what needs you, in every project
                return self.json(HUB.needs())
            if p == "/api/search":  # F196: the same words in the other projects
                return self.json(HUB.search((q.get("q") or [""])[0], (q.get("skip") or [""])[0]))
            if p == "/api/projects/deleted":  # F173: what Settings › Projects can restore
                return self.json(HUB.deleted())
            if p == "/api/corrections":
                return self.json(HUB.corrections())
            if p == "/api/voiceprefs":  # F183
                return self.json(dict(HUB.voice_prefs(), tidy=HUB.tidy_on()))
            if p == "/api/push":  # F195: the key a phone subscribes with, and whether this subscription is on
                return self.json({"key": HUB.push.public, "on": HUB.push.has((q.get("endpoint") or [""])[0])})
            s, sub, base = self.project(p)
            if sub == "":
                return self.redirect(p + "/")
            self.get(s, sub, q, base)
        except Err as ex:
            self.send(404, f"{ex}\n")

    def wants_page(self):
        """A person's browser opening an address, as opposed to an agent's curl (T102): the same /p/x/B03 shows the
        page to one and the item's text to the other."""
        accept, ua = self.headers.get("Accept") or "", self.headers.get("User-Agent") or ""
        return self.headers.get("Sec-Fetch-Mode") == "navigate" or ("text/html" in accept and "Mozilla" in ua)

    def get(self, s, p, q, base):
        ref = self.fileref(s)
        if p != "/" and VIEW_PATH.fullmatch(p) and self.wants_page():  # a view of the page: the page opens there
            return self.send(200, PAGE.replace("__TASKA_VERSION__", VERSION), "text/html; charset=utf-8")
        if (p in ("/agent", "/next", "/rules", "/inbox", "/items", "/log") or ITEM_PATH.fullmatch(p)) and "ui" not in q:  # ui=1: the page itself, not an agent
            s.saw((q.get("by") or ["agent"])[0], 1 if p == "/next" and q.get("wait") else 0)
        if p == "/":
            self.send(200, PAGE.replace("__TASKA_VERSION__", VERSION), "text/html; charset=utf-8")
        elif p == "/agent":
            with s.lock:
                n = len(s.rules())
            self.send(200, AGENT.format(base=base, grammar=GRAMMAR, mode=s.mode(),
                                        rules=f"{n} project rule{'s' if n != 1 else ''}, read GET /rules" if n else "no project rules yet"))
        elif p == "/next":
            wait = max(0, min(int((q.get("wait") or ["0"])[0] or 0), 540))
            end = time.time() + wait
            try:
                with s.cond:  # ?wait=N: while keep-going is on and there is nothing to do, hold until work arrives
                    who = (q.get("by") or [None])[0] if "ui" not in q else None  # each agent gets an item no other one is on (F194)
                    given = []
                    text, work = s.next_text(ref, who, given)
                    while not work and s.cfg["auto"] and not s.gone and time.time() < end:  # a deleted project lets its agents go (F173)
                        s.cond.wait(timeout=end - time.time())
                        given = []
                        text, work = s.next_text(ref, who, given)
            finally:
                if q.get("wait"):
                    s.saw((q.get("by") or ["agent"])[0], -1)
            if "ui" not in q:
                s.read_next((q.get("by") or ["agent"])[0])
                if given:  # F220: the item it was given, it has read
                    s.read_item(given[-1], (q.get("by") or ["agent"])[0])
            self.send(200, text)
        elif p == "/rules":
            with s.lock:
                self.send(200, s.rules_text())
        elif p == "/connect":
            self.send(200, CONNECT.format(name=s.name, base=base, host=self.host() + self.prefix))
        elif p in ("/inbox", "/inputs"):  # /inputs: the same address as the page's Inputs view
            with s.lock:
                self.send(200, s.inbox(ref))
        elif p == "/archive":
            with s.lock:
                self.send(200, s.listing({"archived": ["1"], **q}))
        elif p == "/items":
            with s.lock:
                self.send(200, s.listing(q))
        elif p == "/log":
            with s.lock:
                self.send(200, s.log(int((q.get("n") or ["30"])[0])))
        elif p == "/api/state":
            self.json(dict(s.state(), project=s.name, title=s.title, base=base, key=HUB.key,
                           remote=f"{HUB.public}/k/{HUB.key}/p/{s.name}" if HUB.public else ""))
        elif p == "/api/poll":
            rev, boot, pv = int((q.get("rev") or ["0"])[0]), (q.get("boot") or [""])[0], int((q.get("pv") or ["-1"])[0])
            with s.cond:
                s.cond.wait_for(lambda: s.rev != rev or (boot and boot != s.boot) or (pv >= 0 and pv != s.pv), timeout=25)
                self.json({"rev": s.rev, "boot": s.boot, "pv": s.pv, "ver": VERSION})
        elif p.startswith("/f/"):
            self.serve_file(s, os.path.basename(p[3:]))
        elif p == "/api/transcript":  # a voice note's words again, by file id, without waiting: POST waits for them (T101)
            fid = os.path.basename((q.get("f") or [""])[0])
            job = s.trs.get(fid) or (s.saved_job(fid) if fid else None)
            if not job:
                return self.json({"ok": False, "f": fid, "error": f"no words for {fid} yet: POST /api/transcript?f={fid} works them out"}, 404)
            self.json(voice_answer(fid, job))
        elif ITEM_PATH.fullmatch(p):
            ref_ = p[1:]
            with s.lock:
                if ref_[0] in "dD":
                    self.send(200, s.doc_text(s.doc(ref_)))
                elif ref_[0] in "rR":
                    inp = s.inputs.get("r" + ref_[1:].lstrip("0"))
                    if not inp:
                        raise Err(f"{ref_} not found")
                    self.send(200, s.input_card(inp, ref) + "\n")
                else:
                    it = s.item(ref_, follow=False)
                    self.send(200, s.card(it, ref))
            if ref_[0] not in "dDrR" and "ui" not in q:  # F220: an agent read the item, and so your words on it
                s.read_item(it["n"], (q.get("by") or ["agent"])[0])
        else:
            self.send(404, "not found\n")

    def serve_file(self, s, name):
        path = os.path.join(s.fdir, name)
        if not name or not os.path.isfile(path):
            return self.send(404, "not found\n")
        mime = mimetypes.guess_type(name)[0] or "application/octet-stream"
        with open(path, "rb") as f:
            data = f.read()
        self.send(200, data, mime, {"Content-Security-Policy": "sandbox", "Content-Disposition": f"inline; filename*=UTF-8''{quote(name)}"})

    def do_POST(self):
        with self.server.working():  # a stop waits for it (T101)
            self.handle_post()

    def handle_post(self):
        if not self.guard():
            return
        u = self.url()
        q, p = parse_qs(u.query), unquote(u.path)
        try:
            if p.startswith("/api/projects"):  # F173: new, rename, delete, restore, delete forever. name = the address
                d = json.loads(self.body(10_000) or b"{}")
                if p == "/api/projects":  # {title} (or {name}, as before): any name; the address is made from it
                    s = HUB.add(d.get("title") or d.get("name", ""))
                    return self.json({"ok": True, "name": s.name, "title": s.title})
                if p == "/api/projects/rename":
                    s, was = HUB.rename(d.get("name"), d.get("title"))
                    return self.json({"ok": True, "name": s.name, "title": s.title, "was": was})
                if p == "/api/projects/delete":
                    s = HUB.delete(d.get("name"))
                    return self.json({"ok": True, "name": s.name, "title": s.title})
                if p == "/api/projects/restore":
                    s = HUB.restore(d.get("name"))
                    return self.json({"ok": True, "name": s.name, "title": s.title})
                if p == "/api/projects/purge":
                    HUB.purge(d.get("name"))
                    return self.json({"ok": True, "name": d.get("name")})
                if p == "/api/projects/order":  # F253: {names: [...]} as you dragged them
                    HUB.set_order(d.get("names"))
                    return self.json({"ok": True})
                return self.send(404, "not found\n")
            if p == "/api/corrections":  # {wrong, right} remembers a spelling fix for every project; {wrong} forgets it
                d = json.loads(self.body(10_000) or b"{}")
                if "wrong" not in d:  # T256: {right} adds a word to hear right, {right, forget: true} forgets it
                    HUB.word(d.get("right"), bool(d.get("forget")))
                else:
                    HUB.correct(d.get("wrong"), d.get("right") if "right" in d else None)
                return self.json({"ok": True, "corrections": HUB.corrections()})
            if p == "/api/push":  # F195: {sub, quiet} turns pushes on for a phone; {endpoint, off: true} turns them off
                d = json.loads(self.body(10_000) or b"{}")
                if d.get("off"):
                    HUB.push.unsubscribe(str(d.get("endpoint", "")))
                else:
                    HUB.push.subscribe(d.get("sub"), d.get("quiet", True))
                return self.json({"ok": True})
            if p == "/api/voicetidy":  # T256: {on}
                HUB.set_tidy(bool(json.loads(self.body(1000) or b"{}").get("on")))
                return self.json({"ok": True, "tidy": HUB.tidy_on()})
            if p == "/api/voiceprefs":  # F183: {text} for every project's transcription; "" = the default again
                d = json.loads(self.body(20_000) or b"{}")
                HUB.set_voice_prefs(d.get("text", ""))
                return self.json({"ok": True, **HUB.voice_prefs()})
            if p == "/api/key":  # a new key; this device keeps working, every other one needs the new link
                HUB.new_key()
                return self.send(200, json.dumps({"ok": True, "key": HUB.key}), "application/json; charset=utf-8",
                                 {} if self.trusted() else self.cookie())
            s, sub, base = self.project(p)
            self.post(s, sub, q)
        except (Err, ValueError, KeyError) as ex:
            self.json({"ok": False, "error": str(ex)}, 400)

    def post(self, s, p, q):
        if p == "/do":
            text = self.body(1_000_000).decode("utf-8", "replace")
            by = (q.get("by") or ["agent"])[0][:20]
            if by not in PEOPLE:
                s.saw(by)
            lines, _ = s.run_all(parse_dsl(text), by)
            tail = "GET /next to continue" if s.cfg["auto"] else "stop after the current item"
            with s.lock:
                news = s.news_for(by) if by not in PEOPLE else []
            note = (f"\n{len(news)} new input{'s' if len(news) != 1 else ''} since your last /next: {' '.join(news)}."
                    " Finish the step you are on, then GET /next.") if news else ""
            self.send(200, "\n".join(lines) + f"\nrev {s.rev} · {s.mode()}: {tail}{note}\n")
        elif p == "/api/op":
            data = json.loads(self.body(1_000_000) or b"{}")
            ops = [(0, x) for x in (data if isinstance(data, list) else [data])]
            lines, _ = s.run_all(ops, "you")
            code = 400 if any(x.startswith("err") for x in lines) else 200
            self.json({"ok": code == 200, "res": lines, "rev": s.rev}, code)
        elif p == "/api/file":
            data = self.body(MAX_FILE)
            mime = (self.headers.get("Content-Type") or "application/octet-stream").split(";")[0]
            f = s.save_file((q.get("name") or ["file"])[0], mime, data)
            if q.get("transcribe") and mime.startswith("audio/"):  # the words come later: ask /api/transcript (B165)
                s.transcribe_later(f["f"], data, self.headers.get("Content-Type") or mime, self.scope_of(s, q))
                f["pending"] = True
            self.json(f)
        elif p == "/api/transcript":  # a voice note's words: waits for them a while, starts again after a restart (B165);
            fid = os.path.basename((q.get("f") or [""])[0])  # again=1 tries a failed one once more (T101)
            path, mime = s.local(fid), voice_mime(fid)
            job = s.trs.get(fid)
            if fid and mime and os.path.isfile(path) and (not job or (job["done"] and job["err"] and q.get("again"))):
                with open(path, "rb") as fh:
                    s.transcribe_later(fid, fh.read(), mime, self.scope_of(s, q))
            with s.cond:
                job = s.trs.get(fid)
                if job:  # more=1: waits for the fuller words of a note whose strong model ran out of time
                    s.cond.wait_for(lambda: job["done"] and not (q.get("more") and (job.get("res") or {}).get("more")), timeout=45)
            self.json(voice_answer(fid, job))
        elif p == "/api/undo":
            rid = (json.loads(self.body(10_000) or b"{}")).get("id")
            with s.cond:
                inp = s.inputs.get(rid)
                if not inp or inp.get("deleted") or not inp["org"] or inp["org"].get("undone"):
                    raise Err(f"nothing to undo for {rid}")
                f = s.filings().get(rid)
                if f and not f["can"]:  # T113 A4: only the organizer's own work, as it left it
                    raise Err(f"{f['why']}: undo that by hand")
                s.emit({"k": "undo", "src": rid, "by": "you"})
            self.json({"ok": True})
        elif p == "/api/redo":  # the filing "Undo filing" took back comes back (T113 A4), while nothing changed since
            rid = (json.loads(self.body(10_000) or b"{}")).get("id")
            with s.cond:
                why = s.redo_blocked(rid)
                if why:
                    raise Err(why)
                s.emit({"k": "redo", "src": rid, "by": "you"})
            self.json({"ok": True})
        elif p == "/api/revert":  # put back one of your changes (F80)
            seq = int((json.loads(self.body(10_000) or b"{}")).get("seq") or 0)
            with s.cond:
                u = next((u for u in s.undoable(50) if u["seq"] == seq), None)
                if not u:
                    raise Err("that change can't be undone any more: it was undone already, or changed again since")
                lines, _ = s.run_all([(0, {"op": "set", "ref": s.code(u["n"]), "f": u["was"], "undo_of": seq})], "you")
            self.json({"ok": lines[0].startswith("ok"), "res": lines})
        elif p == "/api/move":  # an input sent to the wrong project goes to another one (F79)
            data = json.loads(self.body(10_000) or b"{}")
            rid, t = data.get("id"), HUB.projects.get(str(data.get("to") or ""))
            if not t or t is s:
                raise Err("choose another project")
            with s.cond:
                inp = s.inputs.get(rid)
                if not inp:
                    raise Err(f"unknown input {rid}")
                if inp.get("moved") or inp.get("moving"):
                    raise Err(f"{rid} was moved already")
                if inp.get("deleted"):
                    raise Err(f"{rid} is deleted; restore it first")
                if s.org_busy == rid:
                    raise Err(f"{rid} is being organized right now; try again in a moment")
                inp["moving"] = True
                blobs = []
                for f in inp["files"]:
                    with open(os.path.join(s.fdir, f["f"]), "rb") as fh:
                        blobs.append((f, fh.read()))
            try:
                files = []
                for f, blob in blobs:  # the files are copied: the other project keeps its own
                    files.append(t.save_file(f.get("name"), f.get("mime"), blob))
                    if f.get("tr"):
                        files[-1]["tr"] = f["tr"]
                        continue
                    with s.cond:  # words still being worked out here go to the copy too, and hold it there (T101)
                        job = s.trs.get(f["f"])
                        if job:
                            s.fwd.setdefault(f["f"], []).append((t, files[-1]["f"]))
                    if job:
                        with t.cond:
                            t.trs[files[-1]["f"]] = job
                        t.hold_timer(job)
                lines, _ = t.run_all([(0, {"op": "input", "text": inp["text"], "files": files})], "you")
                if not lines[0].startswith("ok"):
                    raise Err(lines[0])
                new = lines[0].split()[-1]
                with s.cond:
                    made = [x for x in s.events if x.get("src") == rid and x.get("by") == "org" and x["k"] in ("add", "set", "say", "merge")]
                    if made and inp["org"] and not inp["org"].get("undone"):  # what the organizer made of it here is undone
                        s.emit({"k": "undo", "src": rid, "by": "you"})
                    s.emit({"k": "moved", "src": rid, "to": t.name, "as": new, "by": "you"})
            finally:
                inp.pop("moving", None)
            self.json({"ok": True, "to": t.name, "as": new})
        elif p == "/api/organize":
            rid = (json.loads(self.body(10_000) or b"{}")).get("id")
            with s.cond:
                if rid not in s.inputs:
                    raise Err(f"unknown input {rid}")
                if s.inputs[rid].get("deleted"):
                    raise Err(f"{rid} is deleted; restore it first")
                s.emit({"k": "org", "src": rid, "retry": True, "by": "you"})
            self.json({"ok": True})
        else:
            self.send(404, "not found\n")


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.busy, self.idle = 0, threading.Condition()

    @contextlib.contextmanager
    def working(self):
        """A request doing work (any POST: an upload, a transcription, a change), as opposed to one waiting for news."""
        with self.idle:
            self.busy += 1
        try:
            yield
        finally:
            with self.idle:
                self.busy -= 1
                self.idle.notify_all()

    def drain(self, wait=60):
        """Stop taking requests, then give the work at hand up to `wait` seconds to finish: requests being answered and
        voice notes being transcribed in the background. A restart (launchctl kickstart -k sends SIGTERM first) must
        not cut a transcription (T101)."""
        self.socket.close()
        end = time.time() + wait
        jobs = lambda: sum(1 for s in list(HUB.projects.values() if HUB else ()) for j in list(s.trs.values()) if not j["done"])
        if self.busy or jobs():
            print(f"taska: stopping after the work at hand: {self.busy} request(s), {jobs()} transcription(s)", flush=True)
        with self.idle:
            while (self.busy or jobs()) and time.time() < end:
                self.idle.wait(min(0.25, max(0.01, end - time.time())))


def main():
    global HUB
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", nargs="?", default="serve", choices=("serve", "install-skill"),
                    help="install-skill: teach Claude Code, Codex and Antigravity how to use Taska")
    ap.add_argument("--port", type=int, default=7340)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--root", default="~/.taska", help="data folder, one subfolder per project (default ~/.taska)")
    ap.add_argument("--organizer", choices=("auto", "off"), default="auto", help="auto = use Gemini when a key is set")
    ap.add_argument("--public", default="", help="the tunnel's public address, e.g. https://xxxx-7340.usw2.devtunnels.ms")
    args = ap.parse_args()
    if args.command == "install-skill":
        print("Installed the Taska skill:")
        install_skill()
        return
    HUB = Hub(args.root, args.organizer == "auto" and bool(api_key()), args.public)
    try:
        srv = Server((args.host, args.port), Handler)
    except OSError as ex:
        sys.exit(f"taska: cannot listen on {args.host}:{args.port}: {ex}")
    print(f"Taska  http://{args.host}:{args.port}/\n  data       {HUB.root}  ({', '.join(sorted(HUB.projects))})\n  organizer  "
          + (f"Gemini {MODEL}" if HUB.organizer else "off (set GEMINI_API_KEY to turn it on)")
          + f"\n  key        {HUB.key}  (needed from outside this machine and its network)", flush=True)
    def pushes():  # F195: every 15 s, what newly needs you goes to the phones that asked
        while True:
            time.sleep(15)
            try:
                if HUB.push.subs:
                    HUB.push.check(HUB.needs())
                else:
                    HUB.push.seen = None
            except Exception as ex:  # a push must never stop Taska
                print(f"taska: push: {ex}", file=sys.stderr)
    threading.Thread(target=pushes, daemon=True).start()
    # SIGTERM (a restart, a deploy): stop taking requests and finish the ones at work first (T101)
    signal.signal(signal.SIGTERM, lambda *_: threading.Thread(target=srv.shutdown, daemon=True).start())
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    srv.drain()


# Taska on a phone's Home Screen (F192): an app icon, a manifest and a service worker. They hold no data, so they need
# no key (a Home Screen app keeps its own cookies and asks for the key once, on the login page).
ICONS = {n: base64.b64decode(b) for n, b in {
    180: "iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAIAAACyr5FlAAALrklEQVR42u2de4gd1R3Hv78zc993780mbrQ+orFZNCZtWpVWRWNLS0spRitaH2C1Vu0DH1hTWyu0CiVYjaIUmoIiKFgsJNDS+sAGLPhAjVWrqU1ibBJJ0vgI693H3Z17Z86vf8zuZnezj7s3996Z3fv9MH9I4K6Hmc+cOec353xHun/wMQiZDMNTQCgHoRyEchDKQSgHoRyEchDKQSgHoRyEUA5COQjlIJSDUA5COQjlIJSDUA5COQihHIRyEMpBKAehHIRyEMpBKAehHIRyEEI5COUglINQDkI5COUglINQDkI5COUglIMQykEoB6EchHIQykEoB5kjuPNffwMBFFCFaj2/ajYi9bSQchzBGQeMQWDRP6hWIUA6KUkXdtoLcPivUglpthledRYtpBxH3FsIAkWpXwtZ+fIpiWxKrOLdD/z9B202LekEAlvDr9JiLXbu932L5gliFUuPdnNpCezMLaQcDXiOeFV1jdx+SfaCs9Ldxzrhvx/osf94u/Lgnwf2fmI7MjLh7E/1q76RLqRJqKKYk1paGEHvO88+AGgMKlV0ZOXRWwtnLEuEZ19HOgYAH5fs9Q/1btlRLWQPnX0j8HwUpv5VUxkd2UzTQs5WGvE0CWCtPn5b8YxliaoPqxCBERiBKvwAXUXz+Npi93FO2VNjhp/6gYVjMNWvmn0IZmgh5WiAGVYxMKT3Xdex6mTXD5Bwx933InAd+AEKWVl3dYdVhJ2DI+gt2xsvyK462a36k/yq2ceMLaQcDTCjf0gf/FHHpeel/QCuM8Ugy4FVnHVqYsUSt+zBGFQDFHPm4nNSqnBicD4ObyHlaIQZP+z47rRmDE8QLIzBVz6f9KrWdWSwoquWusd3OQqYeJyPsS1swaBnzsxWZluzmq0ZoxSyEv59q8hlJPw7sWK0he0uR301q7rNAFD1D/23H8SxRxzbwvaVo+6aVX1mGAMFXtlWSSQksJpJyr/3+J/02kUdRnXcCDHC7nO0hRF2Hm4cTkQ9Nat6zQhnrf89EGx5z8+lJAiQdLH/YPD825VLz01XAySciE/IxBZGV+owkfcZXhWFrHnyjuJPL851H+uowiqs4phOc/n56b/e1Xlmd6K3rGOvfd1mjI4q7n6if9DTcG5iFbm0Wb9xoKdfE07EjxhrJ2lhO8oxY/VptCL02c84oR96ZGYYgWNw52P9z/2zMlp/VEUqgX0H7fcfKJUGhi0MLPygpUdgoQpjJmlhVDiLTr89skeawacD9raLcxednQqrTxMqQuEQNZOUL52SePq1St+gZlIS2LrMsDAGvWW9/qHeTS95xbzYMeddFemk7DoQbH7LO3Gxc/xRjuvAmNYeAhFs3+uvfbhv44sTWxjN3Rvhu5Vw9Ld5XecJXU5400zzDN6627/y3lJPv1XFAzfUacZV60svv1vpKppJnx2OQdlTVSxf4q5emezICAStGZ4qEAR4ZVvljZ1+2dPI+4yI5XAM+gb17FMTf/rlAsz0fiv04N0P/CvuKd1xWe7y8+s049Vt1UUFmWaKaAQKDFbUq0BbPE8QSbrIpsQxsXhfH/Fspfbqk+vAWpy2xH1h/cJCVqzWa0aHTF88CFuSTUouBWn5pNYqrI2LGdFPZWufGhgDq8NFwxorypOYEdR6kRCzaml7zVasYrT6JKi1Ul57kapuM0j0cqgeqj6JwK+tL6UZ7VLnmFB9atSzlmbMBznGVZ/K2pBROs2YJ3KENYyOjGzZUV1zV8/WPb5jjqh6TTPmlRyhH8WcvP+/4Mp7Slt3+269bzdoxjyUI5zQFrJSKtsrf1unHzRj3soR+pFN1ekHzZjncoTPlzr8oBltIUcdftCMNpJjVn4ENKPd5Bjnx72ld3b7roNqMO7lXLgOyAnNuI9mNIv47pUNV1d05s3vftJx3ookDtu/uuej4OYNfa9ub7AZ4VI0BaCAtGKv7PB7vjClQ2O0QyLWG6kdA6+KwOotF2bXnJVeNn7t8b0bBz7sscWcNHDVZ/h/LHvqmOH3OBUfqtrEXfZAwpVQwaqPdBLZlMTkrX3cd9mHN3FpQAtZ+dxJ7thdC/mMJN1Grn5wDHr69YSjzFdXJb/2xVQhI4HVt3f5ftDE/QrWYvkStyMrvq8v/6f69zcrW3f7YShD5BEucyOCIXztUvaamIDjGPT06SWrU7+6Ir94QWRDsaqP3z9Vvn/TQCohxoA73moaogLIZ2R0p2RjO96wz7j2m5l11+QBjO0qWpMJduh6OLjlwuwxnWbtw33ZdMT7q+ZSsk+TVmMbg/4hPXt5Yt01+cBCMIs9lY0fgiiqPi5bnd6+19/w1OCCXBtvaorFsAvwA9z6nVx4baLdaC8Cx4FV3LQm11WQih/l9sx2l0MEgxV0H+ucvsyNST6HEUDRmZdzVybLnhrKEeGVqPi69BgnnxZFLHZRY2QR/IolbhAoe47o+w+2inIcNgAEXCMffWorPiRmWuw7aBkYF/EMKJPC1t3+jn3+6Jw5Yl81jDXG8/+qZJKGs5WIhx1+gEeeHRSJRbS0H8AINr00tOvDIJ2Msj1R7rJv0bUf2cA+zZ2aTsob7/vHLXJWLXXtSDZoJOPQwCLh4p3d/s0beo1ItMMOBuMPjzzyafnZI31lT6/9RiayO1XgAC9srdy0oa/saToZcQrDfIu3Hn1SBIq+8iSv66YKGQsr86Wyfv0LyYvOSZ1zWjKXamEEgyKwePP96tNbvE0vDRmRZAKW2efNeI6EIWM//nam9pCx4XvXoLesgcXiBSbZ2l5VFR9+av0AMXklCwbjT/oXBAgzqFo8fU24EMQogmFeyWEEgUXV17/8ujMMMnecQ0u5wq7bddBb1jV39+w6EGRSUz7UIxkJasxyHxiMP+V1av0Ru1M6n8yoLxifzGc5jiQY3wgdmDt1jtYH45O4yxFtMD6JrxwRBuOz84i1HBEH41s6ENc6x4yfZRytWY3dvHQk8efhWsCr7y9tfrMSk6BgzlYmLzTFIRifxFGOGT/L6DoILApZ2XBjYWHeDAxpOEStMxhf0FvW760vPfrcYDFPM+ItRy2fZQz3uq040f3jz4vFnOkta9mr/5MJV60vPfO61xmDDxJQjmm7DYMaP8sYRgyuPMl98hfFhXmz/rr6zXh1W3XxAuMzrCH+s5UYBuOPnUPJmA+JN3vsNau6X7tMZeMWjH94LS6VkGab4VWbuEF8TsoxNhi/xs8yNjsYf2ItLi3WYud+37dNXA9mFUuPdnNpCezMdb92kWNsMH7tn2VsohlT1OL6RrqQ5p2HcOkXalur1i5FMBFUfXQV5dnfLOzMS1jzaMC9WFefMX0trrn3ycjIpsa1am0xlY1JMP6MtbhmH4JJ6n7dxzllT9t6x1scgvFnrMU1+5hQ96txrdr8lwMxCMavpRbX0mFgbNaqtXswfu21uJZO5eKxVo3B+IdqcXEj8rVqDMafXS2ulUS+Vq3dg/Hr+EhlK65KPNaqtXswfn0fqWz2GTCCXTFYq8Zg/IkfqYz2ETO6luDuJ/oHPY129hTTfA5VpBLSP6jPvF5ZcZK79GhHZLhqGS4GMwZ7PgpueKi3IcH4CRef9OqWHdVvnZnKpiQU1FpYbd2hI6/9jODOx/o3vuAVcxFXSOMb3hL6Ufaw6cUhVXQVnUUFE1aNDvTYv73m3fyHvvf2BZ35BgTjh/ktuw4Em9/yTlzsHH+U4zowprWHQATb9/prH+7b+KJXjMGKJAbjj6t5lD1VxfIl7uqVyY5MC/M5gCDAK9sqb+z0y57GZH0rg/EncXGwol4Fqq3OYEi6yKakIe+YGgKD8ScOTgFkk5JLofWBXFZhbYzyORiMP4Ui3AnHqElCOQjlIJSDUA5COQjlIJSDUA5COQjlIIRyEMpBKAehHIRyEMpBKAehHIRyEMpBCOUglINQDkI5COUglINQDkI5COUglIMQykEoB6EchHIQykEoB6EchHIQykEoB6EchFAOQjkI5SCUg1AOQjnI3OH/obuQ0prLlWcAAAAASUVORK5CYII=",
    192: "iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAIAAADdvvtQAAANFUlEQVR42u2dbYxU1RnHn+fce+dtZ1gWtF1RU5YCapStvFhJVEpTWhNN20SIjWLUiNbYD20jDa1BQ4jatCQYE9Naa2uLgWIU+6EGa2qjjfjWFjRZVAxs3Y0aSn3bt9nZmbn3nKcfzuzssiwr7M7Lmd3/L/cTsMzZO7977jnPec55eNGGjwmAyaJwCwAEAhAIQCAAgQCAQAACAQgEIBAAEAhAIACBAAQCAAIBCAQgEIBAAEAgAIEABAIQCEAgACAQgEAAAgEIBAAEAhAIQCAAgQCAQAACAQgEIBAAEAhAIACBAAQCEAgACAQgEIBAAAIBAIEABAIQCEAgACAQgEAAAgEIBAAEAhXEn0HPCpNSZIRIiJgUkzFk5PN/kJkUExGJ1KflzERERurWAAhEnqJcQYaKFHjETCIUakrGKBVnbT7nBwshDRZEMXl16q+1ISPUFOd4QBO3FgJV6/HtyUp7m3/FRbGvLg5mpbg/J/86HO57q9jRFTU38cl6F09RT1bOPVOtXRJfeUEwb45X/g9rg23V0c/064fCfxwsfvCxaUmzUw7x9K4br5iMUL4oG9c2/eDqVHD88xJG9Ou9ue1PD8YDVmqsQ56ingFZtyp+z3XpL86u/2Dxf73m3t3ZPS8VWjIOOeTNXbZpetuTzcsDt2U2XJlUTNqQEImQCBlDvkcrzw/mzfWe3V8IfB5jT++gbLgyuf3WTDrBkR75wbpcxtCsFF91SbxnUF57N0zF2ZHx0LQVqGzPg7dnrl2VCDXZQYzi4UsREYWavtLmBx4//2ah/K14ivpz8s1lsYfumGWf9eN+sC6XIiNkhNYsjR3sjg59oJMxJxxS09+eKxKRLo2dTxweBR5pQ3dcnWpvC3KF0mxLa0oleMv6dPl/c+SXsmxZn04lWGvEgWplj+9NNMQWId+jr7fHhgpGKfIU5YrSPt9va/WM1G3mdbIpoRFqa/Xa5/u5orjQNjWT7Rk9TbtkceD7LELMFEayYlHARMY49wsaQ0y0YlEQRsIOdI2+yyowjwxdq2RPmdlp9hRZgUSoJc0uPyctaVcG0c4JxERKkTaUK0hkiIniAceC0sNXJXuIqDcr2pR6I2bqyYrLAvVkneh+nBNIMWmhvqxkknzhl/wzmpXWdORodPRToxSlEyeNf0zFHvso//twGEXCzCIU+Lz/SChUmqm5dYsUCdH+I2HgO9EJ+U7dmmJInqJN61LfvjTR1upZCXqy8kZn+Ktncq8eCseNw07RHmaKNL3YUUzGlV0dS8W4ozvqOqYXtHraODSOto1575ju6I5SMSfCicode/JFyST5ibua77ymadHZnu+VIh8taf7GxbGnNs++5VvJT/rNGDmm+OaKNHmKHt6b6+gKU/HS2qrnUS4vW3dlS+NWN95m5WZs3ZXN5cXznGiVE4FE2wckY7z7Z7MvXhCEmphHLhEyQoppzdJY36C8dLCYSbG9m1O3J/DpyX35LTuzmaQqf0MilIzx2+/rnqysWRqzzRsdwrZm1+Aa/aE2mLl5R3bPy4XmJldWM5x4hSmmXEHuvTGzZL4fagq8sXp5TCKkDd1/U5qIHnk294XZpdfNVOzxPXpyX/7HjwykE3ziy2J2E//+uaG+nMFa2EQPf90XU5mpENLZc9ULv5gT+MQnX+62XZGnaPOO7G//OjR3FvfnKmOP7cnGDdzZ1fjVS2J21Uwb6eiKIl31NXkb3mxv8z3FRz/Vr7/r6Gq870L3Uwhl+ULfJrtMMPFhJkUj/dBv9uYe+eGsdZdXyx7bD7Wk+dN+efyF/M4X83Y0XYxIRKo9iRYiZo75pWbYfCDX7HFCIGbSWhaf49MppPxZh4To3hvT31kZv/S8wC6qV8OeskOBT3OC4ZyhUnZijYIwNn+ynJGo3YuMN15CWTnWd+l5gZHTC9Wcrj3lt4mWkZ6hDl+iw0HN+o8NRcjz+PCHEZ1Osp8QGXN66+STswe4LpARigd8oDMqhKVJ+yn1Q1SLvgc0Rg+UjNF7x/TTr+QVU1SFNwTsmc4C2U4oFef7dmff6o4CjyINeyDQaXZCgU9DBbn+l31vdUd+5RyCPTNCICIyhhIx7suZCjoEe2aQQDbikopXzCHYM+MEqqBDsGeGClQRh2DPjBZoig7BHgg0eYdgDwSayKEwmigQEMIeCHRSh7b1HeyOAr+UVnbiPxOiwKMnX4I9EGg8h3oHzc3b+57al7cJZVajSJM2JMN/8tjfhjY+WkV7Slvr1XHpttW+7E5Z5fAetcY43kUpijT1D5rLLoxtvKbp8guD0X/78tvh9j8PvvpOcXZaUaXPESvvU8sXR/ap1ewXL4QiRL6iRIw9RcY4l9nRMOcDMZcOzfAULVsYrFgUZJI8MCT7j4RvdIbaUCZZ+Ww9u09tICeZJC+c553RrLSh/xyNrElVxXrz5Xm+p+iTPtN5VA8MSSbFnmNv5wY7YMoeAzWYl9DmlTIHPjUlmLny+9jL+9TuuDo5ep/awJAYqYVAiimTZDu77Dqmn/ln/uG9Q9pQLHBo035DnlCmVCn3XqSUWVaNj8gXpTmlHrtz1vKFpTdmeS9RzRjziQc6w1se6O/LmUSMHXGoIU/nMGZkEF2N+8hMYUSpOO/c1Lx8YRDqkS9ScU0PJlPDB8QaoVDT8oXBzk3NqTiHETmyNx7nRI8/9MkV5O7r0uV9aqN7nVrOwkY3KfAo1LRkvn/3delcQRQEcna0PlSkBa3e2ssSRsh36Q75iozQ2ssSC1q9oaITnRAEGqf7Ke9TE3HlTVGWW4TiAS1f6BdCJzohCDTOl3Tq+9Rqj23S4nN8rQU9EGj8Dhu34MRHfBL71GrZQRLR4Q8jz8Mxv27GCCa1T61mctuzKA50RvGADQRysweq9j61SRMZUkxPv5J/75hOxgg9kLudkN2ndrA7stGXuj/rNpAYeHSwO7pvdzYVZ0dWxGaQQIrJ90ipUuUA3zvpooTdp5YryA3b+g50huVAYs0OJhtz0XAg8UBneMO2vlxBbGqUE2Oy6V2tp8wk6oWNXUw9y6tXUDEy1PVfLKbWddrSNziZemEnpnOQ1LxeGCOdo66vrUnXCyvdoOMTyuqCywll/rS3J5uXB7+fuXZVQoRGn21oDyH80XdTrS3qJ78bSMXH71iESlnYqTjXKyxkD4d08Hiy6SzQmBOAQ02+GnsYnggVI/reqsRHveb+J7ItaTXBl1Sq1gtmwixsivXCwIwWaIr1wsCMFmjq9cLANBkD1ateGGhsgepfLwwONa5ALtQLgxONKpAj9cJAQwo0wT4sWy9sdXvsnsezjz6XO7NZjT7qpSIVnx76S66jK5w4DgTcFWj0Piy7k8aeKGCjMuV6YT+/Oc1cqvVkHapUvbBtewabm2BPw07jP3cfli2TY+v03H5V6qNeY5MxKlUvLBnD0Kdhe6BT3Ic1ptaTrReWHapuvTDQAAK5XC8MNEYP5HK9MNBIcaBTFI5qWy+MRw3nhwvO1YgxBeccDJTXX6BJ1wsTUwt7PEWFkAYLoobH8nUseWnf8hBo7ENW3odlc8VPRSMm4prYY4vurl0SR9Hd8b8IF1JaPUW9g7L9tsz1qxMnlv2eOpO3Z0DWrYqj7PdEd2nusk1OtEPxq+8Uv7YkdtYcFWmqYF7OpO3pHZQNVya335pJJzjSI3kBtl59ba7RHzorxVddEu8ZlNfeDVNxxrae4yfzigpFySTVn37afNF8/3Rn5hW3pz8na5bGdmxstkv0LmQq2kG0p+im7X1/f7M4K+VEP4R6YeOgNaUSvGV9uhypcuIZG27GlvXpVIK1dqNV7gzHHKkX5inKFaV9vt/W6tlzzd3BU2SE2lq99vl+rigutA31wsaJ+oSRrFgUMJGD2R3GEBOtWBSEEQ6Yqo5DU481i1BL2unl1Za0K4No1AsbvxPqyTq9wNGTFRzzW3mHKmKPCAU+7z8SCpGDu3yUIiHafyQMfJxQdpoO1aZemDaUinFHd9R1TCt2a+lAG1JMXcd0R3eUimEaf+oO1bZemOdRLi9bd2XLARgnhs/Dzdi6K5vLi+c50SpXItETdC3xgAeG5Pk3inMy6vxzfbt7y0jpqAq7DcgI/fH5obv+kG2qRIaGCCVj/Pb7uicra5bGbNZ9OShcl8uYUprv5h3ZPS8XmptcWc1AvbCJgi5YC5smAlGd6oWVV+NXL4mtvCCYN8cjqvkBU0RHP9OvH8JqfKXmILWqF1Z2aEw+UF3GgsgHqtBA0hARpZPMRMxcrhdWvQmtNhT4NCdgql/lg3JGooMbjxrygKkarzCIkK7vRMzhoCbOwwEQCEAgAIEABAIAAgEIBCAQgEAAQCAAgQAEAhAIAAgEIBCAQAACAQCBAAQCEAhAIACBAIBAAAIBCAQgEAAQCEAgAIEABAIAAgEIBCAQgEAAQCAAgQAEAhAIQCAAIBCAQAACAQgEAAQCEAhAIACBAIBAAAIBCAQgEAAQCFSS/wNvgNL0PZarrwAAAABJRU5ErkJggg==",
    512: "iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAIAAAB7GkOtAAApVklEQVR42u3de5Ad5X2n8e/7dvfpc86cmdFoJBBIIKEgCSPZBgEh4SInMWEF6/UWxBYGB2OMCVmXK/GSFKkY46o1MVmcCpXdJC4TqBBCwEF2cG0WYy22YyMuKSKuQWAjKbIEEhG6MLczM+fS/b77R88IQbCuM2d65jyfcrnKBRZD95nf02/fjlly3R4BANqPZRMAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAABAAAAABAAAQAAAADNayCbAVDFG1sgYOS95yYz9tzXyXs7L+yn+wfzU/QwzZhebqd6bIADI3dx3XvWmrzeVpL4QGmPG/qr3aiQ+DEwcKY5M9ne2ZnYYyVp5qdFUvemzHyNgkXwMUje2f+PIFCIZyTkRAgKANh39gVWtoZG6Lxa0YE5wxuLw1BPD008Ou8rGexmjwRH/ymvJljeSF7YmO/amtYbKsSkWlLrJzUBglaQaHPaB1bweu3xh9P5F4Snzgvm9QfaD4YhkG23nvvRnu9KXtiUvb0929bnUqVI0YaDUsYXy8Su55Lo9bAW0QGDVTDQ46hbODX59ZfwbF8SnnxSW4p87WUfr/pXXk394ov795+rb96RdJRuFkzI4rJX36q/6nk6zakVhzari2UuiWR2M/InUP+yf2dxcu762fmOjb8jPqhhj5MgAAUBbrDQD9VX93G77mYtLv/lrxTldYydWnJP7D8fX3ssa2fFzL3sH3d/9U+2vHx3dM+B6KiZJJ/gHq9a8ldasKn52dXnp/GDsB/NyjgP/iVkKWCs7viU37UzvXjeydn3NSZXiBO9NEADk7BNmJKmv6lafFX/l6sqi4wNJqZMZv0J4kMHhvbyUnYXf9mb65fuq656t91Rs9lcnZPrvG3Snnxx+5erKhSsKGj9DbQ2jf+Iz4PzYVRZJj29sfPm+6iuvJb1dlgZM5bq8d+VNbAVMkux+nlrD/8Gayu2f6ZxVsUkqY2TtIaa/xvOQ/Qmp0+xOe9l5xUJk1r/UCANjzbFeSwys+qr+4xcW7/rd7qULwiSVzNixKtN/Mo4D9t/xlTqdMi+47Lzirj737JakHBtuECIAmIHT33lVa/6O6zuv+0+l7PR9YI94vGbBcF7O65ffF83vDf7x6Xp0wI1DRzf99wy46y8p/+n1ncWCSZ3CgLnfqhJYpU6l2Fx6TtxX9es3NiolGkAAMBOn/5/d0LlmVbGZHuuEzQ4hm6k+cEp40tzguxvqUXiUf1xg1V/1119S/uo1lf1ZQus/Hs7rojMLAyP+n3/SZB1AADATp/+FxSRVFEzQ59WqmegDp4SFwPy/Z+uVknFHODXCQP3D/uKzCn/+37pSJ2vevj6JFi8FjMYa8NK25OXX0o7iEe9NHOuvKpsAkz39w2Ai//wwVJLq8x8tX3JO3Ff1R3Twbo1G61owx95xfWd2ozqnfaa4AUbe647rOxfMsaN1YkwAwPQ/+NTQ2Ji49VOVOV2mmRzJEDdqJP7Wqyu9XdZ5xk1ePjC9XfbWqyuNxIs9QgDA9D/EP8gqSXXy3OCGS8sDI+4wFwGB1eCw//AZhdVnx6njvH9eBFap0+qz4w+fUciexAYBANP/EFPDe33yV0sLjwtqjcNaBHivwOpzHylznjmHvPS5j5Sz3QoCAKb/wWR3lPdUzCVnx8O1Qy8CrNVw3X9wcXjO0kiew//cLQLkdc7S6IOLw+G6t+wdAgCm/+EcNn78wmIpNml66B+y3vSXn1/MTjggb7KTcpefX6w3PddmCACY/of+RxtpyfzgpLlBPTnEFd00VTk25y6LJK795vSDJOncZVH5MHIOAoC2nv6SjFHqVCqYMxeH9aY/yGUAa1RPtOj4YPG8wItbP/PIGHlp8bxg0fGHzjkIANp6+meyC4ZL5odperAAGKNG4k+aE5Riw8v98xsAr1JsTpoTNBLPPiIAYPofempIWrYgjMKDvUjAGKWpP+2kUOImk/zKds1pJx0i5yAAYPq/radisuPHgw+XnoohAPkPQE+FlwIRADD9D9thvlCe985PC+wmAgCm/xE4zJ8hDz8q2E0EAEz/idRX9Ye8tGuM+qpe3AKUY+NfHscFAAIApv9hyE4Wv7ojaR70vhHvFQTmp68nBCD/Afjp60kQcBmAAPD7YGSNAjv2H2unbHjl9tg/2yCbdx5iZHivQmhe35uO1v0hLxdjqlpujEbr/vW9aSEkAC0Ssgly12Qra+ScmqmaiU/G31tgpDgyQaDQSpLzLRpkuZ3+2cvdRhv++a1JHB1sZDivONS2N9Otu9LlC0PHowC5DIA12ror3fZmGod8MwwBaD+BlfOqjvpGU8WCZnfaE2YHc7ttdnCUOm15I+kf9m9VvZHKsYkjea9J/VXJ7fTPxro12rwzfX3PoUdGEGhk2D/9ajMLACvfvMl2ytOvNkfqvhwb7gUiAO01+pNUfVUfRzrvfdEFywvnLI2Wzg96KvbANyMOjvjd/e65Lc0Nm5uP/Wtj+25XLKgcm0laDeR5+u9fFX3r8droYYwM5xVH5qEna9dcVOJVoPn8FUidHnqyFkcc/hOAtpGd6B8c8R1Fc81FxStWFVeeGr1rcu3XVTZd5eDUE4M1q4p7B933n2vc+4PRF7cmHUUThRP8ksucT//sjEFf1X/vmXpH0R7y3905dcTmxa3Jhk3Nc0+L+EKYXEmdrNWGV5vZh9nxulYC0A6yIfvWsF99VuFLn6gsmR9ko8258a+rfedXlnsvP37ry5wue+WvFD92QfGBH4/+ybeH+6q+u2PCFs75P/ZPncJA9/9odPvudG63PZx/8ew02tcfHvml07r57OXuSEj6+sMjqZMxEiuAlo0gNsEUrnkbidJU//PTlXt/r3vJ/CB1Y6M/CMbu+THvtVzIbgryXqlTFOqai0oP/4+eX35f9NaQn5Axnf/p75zCQK/tSe98ZKS7bA9z6ZM6dXWYH77QWPdMnW8FyFXLA6t1z9R/+EKjq8OwXwhAW0z/kbrvLJlv3dx97cUl5+T82L2eh3vEZMZOYqROi44P1v7hrM9cXNoz4I5xWOd/+vvx02K3/G1176CPwiO5/uFVCM0t91X3Dbrs3xRT3HIva7Rv0N1yX7UQGo79CUAbbHSrWsN3d9j7b+peeWqUpGO3fh51S7J1w22frvzWJeXd/UffgPxPf0lJojDQX/zjyPc21HsqR3bA6LxKsXbsdTfeNZQ9EMD95lPZcj92+/+Ndw3t2OtKMUlu+ZFo78qb2AqtZIzSVIXQPPiHs1YsCidkyGZ3tTuvi84sDIz49S81OstHfCvF9Jj+qaJQax+vffnvql1lexRXC51XOTYvb0/7qv6iMwvZVuKxgCk59s+e5Lj53uq3H6/PqnDyhwC0wxa3Ghr1d1zf9aEPFCZwyGYXDI66AdNl+oeB1j5e+8KdQx2xOeqp7b3KsVm/sTEw4i86s5BdHOYrqFopO+9vjW6+t3rnIyO9XZbpTwBmvjBQX9V/4kPF/35ZecKH7FE3YNpN/0rR2GN7o4P3qpTMUz9pbnszPf/0Qil7jMCwFGjFgX92B9fAsP/9u4fu/1GN6U8A2oIxajR13Cx79xe6igVjJmHcHEUDpun0P/aTxd6ro2ie2dz84QuNXzghOGVeYIyyq/GGk0ITbeyRdS9rZa0e39i44c8HH3upwfSf4kNSNkHrYmvVX3M3Xl7p7bSJG3ulz2Rkxkqp01evqUi685GR42b93Nvk23b67/+Te7vsv+1Kr/6TgTWrip9dXV46P9h/oJpdWn/XFMPhfALftdGyexwCI0mbdqZ3rxtZu77mpN4uyysfpnhnLbluD1uhNb8VSapyrB/fPnt2p9UkH2NmB1zZFbaf14A2n/5vbwcr79Vf9T2dZtWKwppVxbOXRLM6WAJMpP5h/8zm5tr1tfUbG31DflbFZOstsAJoC9ZqeNhffn4xW/NO9nsIDrkOYPrvl42h2Z0mSfV/n64/sqE+r8cuXxi+f1F4yrxgfm+w/2V8L25tJilnhw522BEG+uDiKHtQ0Rjt3Jf+bFf60rbk5e3Jrj6XOlWKZnanSR3LKQLQXr8cMkarz4rVqgfdD9IApv9/lN0INKvDeOmtIf+D5xuPbKiHgTkw1Y1E3nvm/8//jMsYUwjfsVWT1BdCE0emUjJGco5nsAlAmzFGzURzuszyhaE0djJ0qhqQXedk+r/n/MpmUxQqjowx5h1Pio29l4n5f6gVlX/7GMcYZZsxu6YCAtCmAag1/QdOiY6bZX1rv43kXQ34q++N9naZ6ijT/xCnMlL/Hn1ggh1NVEEA2j0AUuq0YI61Rqlr3QrgPRvwje+O3Pk7XR+7gOkPEAC0ZASnqV+2INQU3UqYNcBLt36q8tFfis9dFmUv1GT6AwQArZBO6SzLzjsZo3OXRc4fwWtHmf7ATMXbQNuLl1wu33vD9AdYAcxkQQ7GrpEMx/4AWAG07rjbKwjMqzsS8ZIZpj9AANorAFJgtWOvy77/CEx/gAC00QqgGJnNbyS7+50xPATP9AcIQDsFIAq1d9C/vD3RVN8OxPQHQABay8h7rXu2Ll4mwPQHCEBbcU4dRbPumfq+QWfb+ywQ0x8gAO3Fe8WRdve7bz5WM6Z9zwIx/QEC0I5Sp46ivefR0X1Drj0HH9MfIADtuwgoFrRzn7v1gWHbfl+HxPQHCEBbS1L1VMyD62sPPVkPA7XPF6Iy/QECADmvjth88W+GNm5L2qQBTH+AAEDKvjc1VL3pr7p9oB0awPQHCAAOWAQ4FQtmYMTN+AYw/QECgHdLncrxDG8A0x8gAGjHBjD9AQKAdmwA0x8gAGjHBjD9AQKAdmwA0x8gAGjHBjD9AQKAdmwA0x8gAGjHBjD9AQKAdmwA0x8gAGjHBjD9AQKAdmwA0x8gAGjHBjD9AQKAdmwA0x8gAGjHBjD9AQKAdmwA0x8gAGjHBjD9AQKAdmwA0x8gAGjHBjD9AQKAdmwA0x8gAGjHBjD9AQKAdmwA0x8gAGjHBjD9AQKAtmuA90x/gABgOjTgk18beP7fkjCQ9xMwprM/IQz04HqmP0AAkO8GDI26K/64/3/cX3Ve1hzTUiBJlY37P/rm8O/dxfQHCADy3YBCaCT95cMjV/xx//bdaRjIeTl3hAf+Ts4rDLR9d3rFH/f/7/8zXCkaw/QHZq6gd+VNbIXpzktGqpTM5jfSh5+u93bZFQtDY8byIC9J2f989//Rj501skbGyBh964na5/9y6Cc70tmdNnVsWmAmM0uu28NWmDk9t2okqo66i86Mf/vS0nmnF4LxNZ7zY+N+bMcbGSNr3l5GPPVK4xuPjP7g+XqlZAuhmP7GyLwznCyGDuusgnnnEYbe/tSBAGDSx5Y1Ghzx1ur9i8LLziv+4tJo6YKgVHiPJcBow2/akf7LpuZ3nqq9tC1xTl1l43xb/8ZaK2vknJqpmolPxkNopDgyfMAOqd58++MTWkWhiQJZezSnJUEAcJRLAe81Uvf1pkqxFh4XLJgTnH5y2FU23ssYDY74V15LduxNt+9OR+uKI5VjY0xbH/gHVs5ruOYbTRULmt1pT5ht53bbbIulTlveSBInIvDzeCm0OvXEMPv4GaM9A+7f33JvDblaQ4VIHUVjDYtLAoBWLcazq7j1pm8mSlL58YMzY0wYKAoVR8aaibl/dFqP/iTV0KiPI527LLpgeeGcpdHS+UFPxdoD7pMYGvXOE4CDBcAadZbe3kLOqa/qNu1MN2xqPvFy4+lXm/WmOksmDMgAAUDLdvP46f79Z7SzELT52R4dcMaso2guOy++YlVx5anRgX/DgV20zP7DcJAt9tyW5oPra995qj5c85xsJADAFK+QnNfAiF99VuFLn6gsmR9kaXRu7CK5zDuO95lWh9nUA9cEGr/7wNqxv7R5Z/pHf19d92yju8xTJgQAmAqBVb0pI33pyo5rLy5JSp2MZHk2ZvIWB05eyu5Mu+fR0T/65rCX4ojTQQQAaO30H6n7WR32nhu7Vp4aOScZzvC0KgNe8rJWz21pXnvHYP+wK8eGBkzNIphNgLb70FvVGr67w95/U/fKU6MkHbv1Ey3a/kbWKkm18tTo/pu6uztsreFZeBEAYPLXvEZJojgyD9zUvWJRmL30FK2Xvb92xaLwgZu648gkyXs/rA4CAEzk4edw3d/26U6mf34acNunO4frnkUYAQAmd+L0Vf0Vq4qXnx8z/fPTgMvPj69YVeyrevYIAQAmhTGqNTS/195yVYfz3O2Tmxlk5bxuuapjfq+tNTgRRACASRBYDdfctReXejtt9gJU5GIGGTmv3k577cWl4ZoLmEkEAJjww/96U8fNsld+qOi9AqZ/rtps5L2u/FDxuFm23mQRQACAiT7PMFzzq8+Oe7us84yY3OXZefV22dVnx8M1bgklAMDE8jJGq8+KNfYFOcjb/pGk1WfFxrCHCAAwoQeYzURzuszyhaHE+Z88ynbK8oXhnC7T5JkAAgBMYABqTb/kxPC4WWMv90cO95H3Om6WXXJiWGt69hEBACZouEip04I5lndP5ll2a9aCOTblW3cIADCBR5dp6pctCMUrnXMs2zXLFoRpygqAAAATKmX0s5tAAAAABABthJt/2E0gAGg73isIzKs7EolbgPIr2zWv7kiCwHCphgAAExQAKbDasdfxCqBcDyMj57Vjrwssj4IRAGDiVgDFyGx+I9nd77L7zZHDfWSMdve7zW8kxYgVAAEAJm64RKH2DvqXtyfiPpNcynbKy9uTvYM+Cok0AQAmkJH3WvdsXeIho3zuH0la92zde/YQAQAmlHPqKJp1z9T3DTrLWaD8LdGs0b5Bt+6ZekfROMcmIQDAhI6YONLufvfNx2rGcBYoX1IvY/TNx2q7+10ckWcCAEz4lHHqKNp7Hh3dN+R4KVCOFmfZ4f+Qu+fR0Y6iTTn8JwDAZCwCigXt3OdufWDYGnGeIS8BcLJGtz4wvHOfKxY4/CcAwORIUvVUzIPraw89WQ8DJSmbZOr3SBjooSfrD66v9VQMe4QAAJN5vOnVEZsv/s3Qxm0JDcjD9N+4Lfni3wx1xIaTcgQAmFzeKwxVb/qrvjZAA/Iw/a/62kC96UPu/ScAQCsWAU7FghkYdp/82sBzW5phIOe4JtzSRZhzCgM9t6X5ya8NDAy7YoFbPwkA0CqpUzk2Q6P+418duOfRUWtljVLHleFJT2/qZI2s1T2Pjn78qwNDo74cG+78mSpB78qb2ApoQ94rDGSMvruhsXFbsmJhNKfbZm8KejsDhodSj20jS/Jjm9QYZaHdvDO98a6hb3xvtBSbMGDtNZXMkuv2sBUwNR8+I2tkslvysxcAeMkoe1LX+VacFM5+hsER31E0l50XX7GquPLU6F3nK3D0Zxje2c/ntjQfXF/7zlP14ZrvKpvW7GIQAORu7juvetPXm0pSXwjN/tf0e69G4sPAxJHiyGR/52SPicAqSTU06uNI5y6LLlheOGdptHR+0FOxlrOkx8A59VXdpp3phk3NJ15uPP1qs95UZ8mEgTjtQwDQdqM/sKo1NFL3xYIWzAnOWByeemJ4+slhV9lkLwQeHPGvvJZseSN5YWuyY29aa6gcm2JBqWtFBpzXcM03mioWNLvTnjDbzu222Q+GI5JttD0D7t/fcm8NuVpDhUgdRZNdawEBQHsJrJqJBkfdwrnBr6+Mf+OC+PSTwlL8cyfraN2/8nryD0/Uv/9cffuetKtko7AVsyM7T+2cmqmaiU+YVscgtIpCEwWyduzmHxAAtN8gCNRX9XO77WcuLv3mrxXndNn9pwjcfzi+zt4Nuf/cy95B93f/VPvrR0f3DLhWPixqjAxfIXnM6wAvTvQTALTtJ8xIUl/VrT4r/srVlUXHB5JSNzZbDzJevR8bH4GVpG1vpl++r7ru2XpPxYqZAkzIupzbQDF5svt5ag3/B2sqt3+mc1bFJunY7YAHn/4az0P2J6ROszvtZecVC5FZ/1IjDIw1fG0scMxLczYBJm/6O69qzf/Zb3WuWVVMnYxRGBzNGiK7W9x7/e5/LZ/QY7/wV0OVouHbfQECgHxP/xs611xYbKaKgmP9A2XUTLVmVVFGv3fXUDnm9DxwbL9WbAJM9vRPjnn67xcFaiZac2HxDz7W0TfkwoCNDRAA5Hj6T+yYDkMlqT7/0fIl58R9VR/wEQYIANph+ksy4y8YuPVTlTldpplwpyZAANAG03/sH2SVpDp5bnDDpeWBEcciACAAaIvpnwmsvNcnf7W08Lig1mARABAAtMf0l8beIdpTMZecHQ/XWAQABADtMf3389LHLyyWYpPytY4AAUD7TH9rZKQl84OT5gb15N2vngdAADAzp78kY5Q6lQrmzMVhvem5DAAQALTF9M9kr4JYMj9MUwIAEAC0zfTX+KtGly0Io9DwXiCAAKBdpv9+PRVeDAcQALTf9JeUcAsQQADQhtNfEq+EAwgA2nH6S+qrer63HSAAaK/pn533f3VH0ky4Cwg48tUzmyC33vWl5H78a3KZ/gduIkmbdyZBwF1AAAGYAcfaVtbIOTVTNROfuPFhJ8WRCQKFVtLYVyS28/T3XoHVaMM/vzWJIwIAEIDpLLByXtVR32iqWNDsTnvC7GBut81OcKdOW95I+of9W1VvpHJs4kjey03m4Mvt9M8SaI0270xf35PGoXEEACAA03T0J6n6qj6OdN77oguWF85ZGi2dH/RUrD3gMs3giN/d757b0tywufnYvza273bFgsqxmaTVQJ6n//5V0bcer43WfTk23AwKHPFv0JLr9rAVpnIHGFmjwRHfUTSXnRdfsaq48tToXce5B07k/fYOuu8/17j3B6Mvbk06iiYKlbo2mv5Z8PqH/a9/8a23hnwU8iAYwApgWsmG7FvDfvVZhS99orJkfpCNNudkjIyRzDuGvvdjl4IlzemyV/5K8WMXFB/48eiffHu4r+q7OybsKDj/x/6pUxjo/h+Nbt+dzu22HP4DrACmk8Cq3pSRvnRlx7UXl7KhZiR7eLfmZmf/sy9C2fZm+vt3Dz3xcnN25wQ0IP/T3zlZq9f2pP/5y32jdQUBh//AUf2yswmmavqP1H1nyXzr5u5rLy45NzbN7WHvEGPGpn/qtOj4YO0fzvrMxaU9A+4Yh3X+p78fPy12y99W9w5y8gcgANNro1vVGr67w95/U/fKU6MkHbv186hbkp0yuu3Tld+6pLy7/+gbkP/pLylJFAb6i38c+d6Gek/FTOyVD4AAYBIZoyRRHJkHbupesSickCFrx5cCX72mcsOlR9mA6TH9U0Wh1j5eu/3bwz2dnPoHCMD02uJGw3V/26c7J2r67++KNUffgOky/cNAax+vfeHOoVKBNz8ABGBaCQP1Vf0Vq4qXnx9P+JA96gZMu+lfKRrLFwAAxz6R2AQtY4xqDc3vtbdc1eH8EVzvPbIGjJ8LknTnIyPHzTrEeZJpOv157hdgBTCdBFbDNXftxaXeTpu9xmCSMnP46wCmP8AKAK04/K83ddwse+WHit4rMJP7zzqcdQDTH2AFgJZsaKvhml99dtzbZd3kf3vJIdcBTH8ArABaxcsYrT4rltSaIXaQdQDTHwABaBFj1Ew0p8ssXxhKk3v+55ANyJ46ZvoD4BRQiwZxremXnBgeN8u2+Ntr33UuaM+Al2H6A2AF0LIpLKVOC+bYbBYHrX2G6V3rgG98d+TO3+n62AVMf4AAoCUjOE39sgWhNDWPL2UN8NKtn6p89Jfic5dFzjH9AQKAVkmndJZl552M0bnLokl6DI3pD0wvXANoLz57mX7+3qPD9AdYAcxkQQ7GrpEMx/4AWAG07rjbKwjMqzsSqaW3AE0LTH+AAMzoAEiB1Y69bvJeAcT0B3CkOAXUohVAMTKb30h297t5Pa1+FIDpf6SyhyeMkfcH3LVliPdhcf7th93N+GZ0ntd3E4A2DkAUau+gf3l7Mq+nkHqFbT9Kcjj9jWStvNRoqt70jcSHgQkOWCQ3EnnvqcBBVrrGmMIBQyV1SlJfCE0cmUIkIzknQkAA2o+R91r3bP3DZ/BdVnmc/oFVkmpw2AdW83rs8oXR+xeFp8wL5vcG2YotdXpxazNJWb0d7EAnDPTBxVFglW20nfvSn+1KX9qWvLw92dXnUqdK0YSB+CbnvIylJdftYSu05qxCkqoc68e3z57dadXGV4PzNv2tlffqr/qeTrNqRWHNquLZS6JZHYz5idQ/7J/Z3Fy7vrZ+Y6NvyM+qGGPkyAABaKPVVqB9g+6Wqyqf/y/lxClsywvweZv+YaBqzVtpzariZ1eXl84fezzaeTn37khzFvswj3XetdGsffvyyaad6d3rRtaurzmpUjQH/7o6EIAZ9YvRTNRTMY/e1tNTsVLbXVTM4fTfN+hOPzn8ytWVC1cUNH6GOrsCjAmUXQfOrrJIenxj48v3VV95LentsjRgCgW9K29iK7RMIdLufv/WkL/k7Dh1eXwfQ/tM/8Cqr+o/fmHxrt/tXrogTFLJjB2rMv0n4+gn27DOK3U6ZV5w2XnFXX3u2S1JOTYsrQhAW3Be5dg8uyVZPC9cvjBM0nZpQA6n/54Bd/0l5T+9vrNYMKlTGDD3W1UCq9SpFJtLz4n7qn79xkalRAMIQNsIrfnRvzZ+5QOFebNtOzQgh9O/v+qvv6T81Wsq2e0oAQ9Etlb2GXBeF51ZGBjx//yTJuuAqdkRbIIW815hqHrTX3X7wMZtSRhoZp8DzeF5//5hf/FZhWz6Wx7vmroG7P+qoovPKvQP+xy+n5wAYOI5p2LBDIy4Gd+A3N3xaTRa14I59o7rO7Mb1TntM4X2Pyd8x/WdC+bY0ToxJgDtIXUqxzO8AXl804NRI/G3Xl3p7bK8lykn6wDn1dtlb7260ki82CMEgAYw/SdDYDU47D98RmH12XHqOO+fF4FV6rT67PjDZxSyJ7FBAGgA03+Cea/A6nMfKXOtMYe89LmPlLN3SIAA0ACm/4R+0K2G6/6Di8NzlkbyHP7nbhEgr3OWRh9cHA7XvWXvEAAawPSfyA+6Ub3pLz+/mJ1wQA5/CwKry88v1pueazMEgAYw/Sd0C6cqx+bcZZHEtd9cTiIjSecui8qxSXk5BAGgAdOrAXme/taonmjR8cHieYHnWzlzyRh5afG8YNHxQT0h0gSABkyfBuT8mx2NUSPxJ80JSrHh69jyGwCvUmxOmhM0Es8+IgA0YHo0IP/f62uM0tSfdlIoXumcY9muOe2kME0JAAGgAdOhAdPlW929V0/FEID8B6CnwkuBCAANmA4NmC7Tf/9Pi/xjNxEATIMGTK/pL4l3jU0L7CYCgLw3YNpNf2PUV/XiFqB87yNJfVUuABAA5LgB0276e68gMD99PSEA+Q/AT19PgoDLAAQAuWzAtJv+WQAKoXl9bzpa99nthsjhPjJGo3X/+t60EBIAAoD8NWA6Tn9JzisOte3NdOuu1HAjUG4DIG3dlW57M43D6fG5IgBoowZM0+mfCQKN1P3TrzazHiCHkZb09KvNkboPuA5MAJCrBkzr6T+2CIjMQ0/W+CaAnBbaKnV66MlaHBkKTQCQowZM9+kvyTl1xObFrcmGTU0ZXgiauw+2jDZsar64NemIjWPvEADkpAEzYPpnjFHq9PWHR7gPKI97R/r6wyOp4zYtAoDcNGDGTP9su3V1mB++0Fj3TJ1vBcjVfgms1j1T/+ELja4Ow34hAMhFA2bS9B/jVQjNLfdV9w26mfCvM/05L2u0b9Ddcl+1EBqxRwgAprwB3s/E6S85r1KsHXvdjXcNZQ8EcEvoVObYj93+f+NdQzv2ulJMkgkAjrwBn/zawPP/loSBvJ+AX6HsTwgDPbh+Rk3//cuaWR3m0WcbN99bDaycZ+hMWYydV2B1873VR59tzOowvAau9YLelTexFab1MVQcmZG6f+jJ+ltD7sIVhcAqSXXUX6udpMrG4m1/P3zbg8MdM2v6799o5dis39gYGPEXnVnILg7zFVQtPnYJrKzRzfdW73xkpLfLcuqfAOAox1kYGC89/nJjw6bmuadFszutG19cH8ERmZOXAqvtu9Pr/9fg2vW17g6rGfriBO9VKZmnftLc9mZ6/umFUmySVDLcgtKKA//UKQw0MOx//+6h+39UY/oTABzbOJOMVCmZzW+kDz9d7+2yKxaG2SxLnbILa+852rKTsNmFOGNkjL71RO3zfzn0kx3p7M4Z/mvpvTqK5pnNzR++0PiFE4JT5gXGyDk5L8M74yZhazsveVkra/X4xsYNfz742EsNpv/UMkuu28NWmDk9t2okqo66i86Mf/vS0nmnF/Y/9ZqtCfYfzmfjfv95j9TpqVca33hk9AfP1yslWwjb5S7JMFC15q20ZlXxs6vLS+cH+zeX4570CRr91r79Sdu0M7173cja9TUnVYqc9ycAmNg9amSNBke8tXr/ovCy84q/uDRauiAoFd5jmI02/KYd6b9san7nqdpL2xLn1FU2rs3ujbFW3qu/6ns6zaoVhTWrimcviWZ1MPsnUv+wf2Zzc+362vqNjb4hP6tisvUWCAAmZSngvUbqvt5UKdbC44IFc4LTTw67yia7NjA44l95LdmxN92+Ox2tK45Ujo1p43ckZBfPqzUfWM3rscsXhu9fFJ4yL5jfGxzp1RRo/PXOO/elP9uVvrQteXl7sqvPpU6VogkDnsIjAGjBsa2RMXJe9aZvJkpS+fFje2NMGCgKFUfGmom5f3Ta/zJkqwGp0VS96RuJDwPDm+OOReqUpL4QmjgyhUhm/F4D5ETIJpjBsstukuLIlApjc3//AZrGLwyk/EZm20RjR6ZZF40xPCl2rE01yjZjdk0FBABTsx5nyrO5piaqyPNJAjYBABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAABAAAQAAAAAQAADCj/X+e2j5tm6xHaAAAAABJRU5ErkJggg==",
}.items()}  # the favicon's glyph, white on blue, full bleed: the phone rounds the corners
MANIFEST = json.dumps({"name": "Taska", "short_name": "Taska", "start_url": "/", "scope": "/", "display": "standalone",
                       "background_color": "#ffffff", "theme_color": "#ffffff",
                       "icons": [{"src": f"/icon-{n}.png", "sizes": f"{n}x{n}", "type": "image/png", "purpose": "any"} for n in (192, 512)]})
SW = """// Taska's service worker (F192): it makes Taska installable and is where phone notifications will arrive (F195).
// It caches nothing: everything in Taska is live, so every request goes to the network as usual.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
// A push carries nothing (F195): what needs you is asked of Taska itself, so the push service never sees it.
const WORDS = {ask: 'asks you', block: 'is blocked', proposed: 'waits for approval', review: 'is ready to accept'};
self.addEventListener('push', e => e.waitUntil((async () => {
  let list = [];
  try { list = await (await fetch('/api/needs', {credentials: 'include', cache: 'no-store'})).json(); } catch (_) {}
  const one = list.length === 1 && list[0], say = x => `${x.code} ${WORDS[x.kind] || 'needs you'} · ${x.ptitle || x.project}`;
  await self.registration.showNotification(one ? `${one.code} ${WORDS[one.kind] || 'needs you'}` : list.length ? `${list.length} things need you` : 'Taska', {
    body: one ? `${one.title} · ${one.ptitle || one.project}` : list.length ? list.slice(0, 3).map(say).join('\\n') : 'Something new needs you',
    tag: 'taska-needs-you', renotify: true, icon: '/icon-192.png', badge: '/icon-192.png',
    data: {url: one ? `/p/${encodeURIComponent(one.project)}/${encodeURIComponent(one.code)}` : list.length ? `/p/${encodeURIComponent(list[0].project)}/` : '/'}});
})()));
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const url = e.notification.data?.url || '/', open = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    if (open[0]) { await open[0].focus(); return open[0].navigate(url); }
    return self.clients.openWindow(url);
  })());
});
"""
APP_PATHS = {"/manifest.webmanifest", "/sw.js"} | {f"/icon-{n}.png" for n in ICONS}
APP_HEAD = """<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/icon-180.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Taska">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)">"""

LOGIN = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Taska</title>
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.3/dist/index.global.js" integrity="sha384-2ql948lIdLcGEE0/qxNiudyTjgauA3RDJERu5xW75kFCvSl5a9odyQYCb6tEjnmB" crossorigin="anonymous"></script>
</head>
<body class="grid min-h-dvh place-items-center bg-white px-6 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
<form method="post" action="/login" class="w-full max-w-xs space-y-4">
  <h1 class="text-2xl font-semibold tracking-tight">Taska</h1>
  <p class="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{wrong}Enter the key. On your computer it is in Taska's menu under <b>Use on your phone</b>. You only do this once on each device.</p>
  <input type="hidden" name="next" value="{next}">
  <input name="key" required autofocus autocapitalize="none" autocorrect="off" autocomplete="off" spellcheck="false" placeholder="xxxx-xxxx" class="h-12 w-full rounded-xl border border-zinc-200 bg-white px-3 font-mono text-lg tracking-wider outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900">
  <button class="h-11 w-full rounded-xl bg-zinc-900 text-[15px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">Open Taska</button>
</form>
</body>
</html>
'''

INDEX = r'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>Taska</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%232563eb' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M13 5h8M13 12h8M13 19h8M3 17l2 2 4-4M3 7l2 2 4-4'/%3E%3C/svg%3E">
__APP_HEAD__
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.3/dist/index.global.js" integrity="sha384-2ql948lIdLcGEE0/qxNiudyTjgauA3RDJERu5xW75kFCvSl5a9odyQYCb6tEjnmB" crossorigin="anonymous"></script>
</head>
<body class="min-h-dvh bg-zinc-100 text-zinc-900 antialiased dark:bg-zinc-900 dark:text-zinc-100">
<main class="mx-auto max-w-3xl px-2 pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
  <h1 class="flex h-14 items-center gap-2 px-3 text-xl font-semibold tracking-tight"><svg class="size-6 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/></svg>Taska</h1>
  <h2 class="px-3 pb-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Projects</h2>
  <ul id="list" class="flex flex-col gap-0.5"><li class="px-3 py-3 text-sm text-zinc-500">Loading…</li></ul>
  <button id="new" class="mt-1 flex h-12 w-full items-center gap-3 rounded-2xl px-3 text-[15px] font-medium text-blue-600 dark:text-blue-400"><svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>New project</button>
  <div id="npRow" hidden class="mt-1 px-1"><div class="flex items-center gap-1.5"><input id="npName" class="h-11 w-full min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-base outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950" placeholder="Project name" aria-label="New project name" autocomplete="off" spellcheck="false"><button id="npCreate" class="h-11 shrink-0 rounded-xl bg-zinc-900 px-4 text-[15px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">Create</button><button id="npCancel" aria-label="Cancel" class="grid size-11 shrink-0 place-items-center rounded-xl text-zinc-500"><svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></div>
    <p id="npErr" hidden role="alert" class="px-2 pt-1.5 text-[13px] text-red-600 dark:text-red-400"></p></div>
</main>
<script>
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
function when(t) {
  const d = new Date(t), now = new Date(), hm = d.toTimeString().slice(0, 5);
  if (d.toDateString() === now.toDateString()) return hm;
  if (new Date(now - 864e5).toDateString() === d.toDateString()) return 'Yesterday ' + hm;
  return d.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
}
function agentLine(p) {  // the latest agent, or a red "No agent" when work waits for one
  const a = [...(p.agents || [])].sort((x, y) => y.t - x.t).find(x => x.waiting) || [...(p.agents || [])].sort((x, y) => y.t - x.t)[0];
  const name = a ? ({'claude-code': 'Claude Code', codex: 'Codex', antigravity: 'Antigravity', agent: 'Agent'}[a.name] || esc(a.name)) : '';
  const m = a ? Math.round((Date.now() - a.t) / 60000) : 0, ago = m < 1 ? 'now' : m < 60 ? m + 'm' : m < 1440 ? Math.round(m / 60) + 'h' : Math.round(m / 1440) + 'd';
  const dot = c => `<span class="size-1.5 shrink-0 rounded-full ${c}"></span>`;
  if (a && (a.waiting || m < 10)) return `${dot('bg-emerald-500')}<span class="shrink-0 whitespace-nowrap text-emerald-700 dark:text-emerald-400">${name} ${a.waiting ? 'ready' : '· ' + ago}</span>`;
  if (p.work) return `${dot('bg-red-500')}<span class="shrink-0 whitespace-nowrap text-red-600 dark:text-red-400">No agent${a ? ' · ' + ago : ''}</span>`;
  return `${dot('bg-zinc-300 dark:bg-zinc-600')}<span class="shrink-0 whitespace-nowrap">${a ? `${name} · ${ago}` : 'No agent yet'}</span>`;
}
async function load() {
  const list = (await (await fetch('/api/projects', {cache: 'no-store'})).json()).sort((a, b) => b.t - a.t);
  document.getElementById('list').innerHTML = list.map(p => `<li><a href="/p/${encodeURIComponent(p.name)}/" class="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-zinc-900/5 active:bg-zinc-50 dark:bg-zinc-800 dark:ring-white/5 dark:active:bg-zinc-700">
    <span class="min-w-0 flex-1"><span class="block truncate text-[17px] font-medium">${esc(p.title || p.name)}</span><span class="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">${agentLine(p)}<span class="min-w-0 truncate">· ${p.open} open · ${when(p.t)}${p.auto ? '' : ' · keep-going off'}</span></span></span>
    ${p.needs ? `<span class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">${p.needs} need you</span>` : ''}
    <svg class="size-4 shrink-0 text-zinc-300 dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></a></li>`).join('');
}
// New project: the button becomes a name field in place, as in a project's menu (B131, B156); Enter or Create makes it,
// × or Esc stops, and a name Taska refuses says why under the field. No browser dialog.
const $ = id => document.getElementById(id);
const npShow = on => { $('new').hidden = on; $('npRow').hidden = !on; $('npErr').hidden = true; if (on) $('npName').focus(); else $('npName').value = ''; };
async function npCreate() {
  const title = $('npName').value.trim();  // any name: spaces, Chinese, emoji; its address is made from it (F173)
  if (!title) return $('npName').focus();
  try {
    const d = await (await fetch('/api/projects', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({title})})).json();
    if (d.ok) location.href = `/p/${d.name}/`; else { $('npErr').textContent = d.error || 'Not created'; $('npErr').hidden = false; }
  } catch (_) { $('npErr').textContent = 'Connection lost; try again'; $('npErr').hidden = false; }
}
$('new').addEventListener('click', () => npShow(true));
$('npCancel').addEventListener('click', () => npShow(false));
$('npCreate').addEventListener('click', npCreate);
$('npName').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); npCreate(); } if (e.key === 'Escape') npShow(false); });
load();
addEventListener('pageshow', e => { if (e.persisted) load(); });  // back from a project: fresh counts
</script>
</body>
</html>
'''

PAGE = r'''<!doctype html>
<html lang="en" class="overflow-hidden lg:scrollbar-thumb-zinc-500/50 dark:lg:scrollbar-thumb-zinc-400/40">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
<meta name="color-scheme" content="light dark">
<title>Taska</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%232563eb' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M13 5h8M13 12h8M13 19h8M3 17l2 2 4-4M3 7l2 2 4-4'/%3E%3C/svg%3E">
__APP_HEAD__
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.3/dist/index.global.js" integrity="sha384-2ql948lIdLcGEE0/qxNiudyTjgauA3RDJERu5xW75kFCvSl5a9odyQYCb6tEjnmB" crossorigin="anonymous"></script>
</head>
<body class="h-dvh overflow-hidden bg-white text-zinc-900 antialiased [-webkit-tap-highlight-color:transparent] lg:flex dark:bg-zinc-950 dark:text-zinc-100 [&_:is(button,a[href],summary)[data-pressed]]:opacity-60 [&_[data-expand][data-pressed]]:opacity-70 [&_button:is(:disabled:not([aria-pressed]),[aria-busy=true])]:opacity-40 [&_button:disabled:not([aria-pressed])]:cursor-not-allowed [&_button[aria-busy=true]]:cursor-progress [&_:is(button,a[href],summary):focus-visible]:outline-2 [&_:is(button,a[href],summary):focus-visible]:outline-offset-2 [&_:is(button,a[href],summary):focus-visible]:outline-blue-500 dark:[&_:is(button,a[href],summary):focus-visible]:outline-blue-400 [&_:is(#list,#tabs,#projBar,#rail,#projectNav,#drawerSettings,#moveList,.overflow-x-auto,.truncate)_:is(button,a[href]):focus-visible]:-outline-offset-2 motion-reduce:[&_*]:transition-none motion-reduce:[&_*]:animate-none">
<nav id="drawer" hidden aria-label="Projects" class="fixed top-0 left-0 flex h-dvh w-80 max-w-[85vw] flex-col bg-zinc-100 pt-[env(safe-area-inset-top)] pb-[max(1rem,env(safe-area-inset-bottom))] lg:z-40 lg:w-[var(--side-w,15rem)] lg:max-w-none lg:shrink-0 lg:border-r lg:border-zinc-200 lg:bg-zinc-50 lg:pb-0 2xl:w-[var(--side-w,16rem)] dark:bg-zinc-900 dark:lg:border-zinc-800">
  <div data-grip="side" title="Drag to resize · double-click for the default" class="absolute inset-y-0 right-0 z-10 hidden w-2 translate-x-full cursor-col-resize hover:bg-blue-500/30 lg:block"></div>
  <div class="flex h-14 shrink-0 items-center gap-2 px-5 lg:pr-2 lg:pl-4"><a href="/" id="homeLink" title="All projects" class="-mx-1.5 flex h-11 items-center gap-2 rounded-lg px-1.5 hover:bg-zinc-200/60 lg:h-9 dark:hover:bg-zinc-800"><span id="drawerLogo" class="text-blue-600 dark:text-blue-400"></span><span class="text-xl font-semibold tracking-tight lg:text-[19px]">Taska</span></a>
    <button data-act="side" id="sideBtn" title="Hide the sidebar · [" aria-label="Hide the sidebar" class="ml-auto hidden size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-200/70 lg:grid dark:text-zinc-400 dark:hover:bg-zinc-800"></button></div>
  <button data-act="new-input" id="newInputBtn" title="New input to the project · C · by voice ⇧V" aria-pressed="false" class="mx-2.5 mb-3 hidden h-9 shrink-0 items-center gap-2 rounded-xl bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm ring-1 ring-zinc-900/10 hover:bg-zinc-50 lg:flex aria-pressed:bg-blue-50 aria-pressed:text-blue-700 aria-pressed:ring-blue-500/40 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/10 dark:hover:bg-zinc-700 dark:aria-pressed:bg-blue-400/10 dark:aria-pressed:text-blue-300 dark:aria-pressed:ring-blue-400/40"></button>
  <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 lg:pb-3 lg:scrollbar-thin lg:hover:scrollbar-thumb-zinc-500/80 dark:lg:hover:scrollbar-thumb-zinc-400/70">
    <div class="px-3 pb-1.5 text-xs font-semibold text-zinc-500 lg:text-[11px] lg:tracking-wider lg:uppercase dark:text-zinc-400">Projects</div>
    <div id="drawerList" class="flex flex-col gap-0.5"></div>
    <button data-act="new-project" id="drawerNew" class="mt-1 flex h-12 w-full items-center gap-3 rounded-2xl px-3 text-[15px] font-medium text-blue-600 hover:bg-zinc-200/60 lg:h-9 lg:rounded-xl lg:text-sm dark:text-blue-400 dark:hover:bg-zinc-800">New project</button>
  </div>
  <div id="drawerSettings" class="mx-2 mt-2 shrink-0 divide-y divide-zinc-100 overflow-hidden rounded-2xl bg-white lg:hidden dark:divide-zinc-700/60 dark:bg-zinc-800"></div>
  <div id="sideFoot" class="hidden shrink-0 flex-col gap-0.5 border-t border-zinc-200 p-2 lg:flex dark:border-zinc-800"></div>
</nav>
<nav id="rail" hidden aria-label="Projects" class="z-30 h-dvh w-14 shrink-0 flex-col items-center gap-1 border-r border-zinc-200 bg-zinc-50 py-2 lg:flex dark:border-zinc-800 dark:bg-zinc-900"></nav>
<div id="drawerShade" hidden class="fixed top-0 right-0 z-30 h-dvh lg:bg-zinc-900/20 dark:lg:bg-black/50" aria-label="Close projects"></div>
<div id="app" class="group/app relative z-10 mx-auto flex h-full max-w-3xl flex-col bg-white pt-[env(safe-area-inset-top)] md:border-x md:border-zinc-200 lg:mx-0 lg:grid lg:min-w-0 lg:max-w-none lg:flex-1 lg:grid-cols-[var(--list-w,360px)_minmax(0,1fr)] lg:grid-rows-[auto_auto_auto_minmax(0,1fr)_auto] lg:border-x-0 xl:grid-cols-[var(--list-w,420px)_minmax(0,1fr)] 2xl:grid-cols-[var(--list-w,460px)_minmax(0,1fr)] dark:bg-zinc-950 md:dark:border-zinc-800">

  <nav id="projBar" hidden aria-label="This project" class="h-12 min-w-0 items-stretch gap-1 border-b border-zinc-200 pr-3 pl-2 lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:flex dark:border-zinc-800"></nav>
  <header id="mainHead" class="flex h-14 shrink-0 items-center gap-1 px-2 lg:col-start-1 lg:row-start-2 lg:gap-2 lg:border-r lg:border-b lg:border-zinc-200 lg:px-3 dark:lg:border-zinc-800">
    <div id="headNormal" class="contents">
      <button id="projBtn" data-act="projects" aria-label="Projects and settings" class="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 text-left data-pressed:bg-zinc-100 dark:data-pressed:bg-zinc-800">
        <span class="relative text-zinc-700 dark:text-zinc-300"><span id="logo"></span><span id="otherDot" hidden title="Another project needs you" class="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:bg-amber-400 dark:ring-zinc-950"></span></span>
        <span id="projName" class="truncate text-[19px] font-semibold tracking-tight">Taska</span>
      </button>
      <button id="agentBtn" data-act="agent-info" aria-label="Agents" class="flex h-11 shrink-0 items-center px-1"></button>
      <button id="searchBtn" data-act="search" aria-label="Search" class="grid size-11 shrink-0 place-items-center rounded-full text-zinc-500 data-pressed:bg-zinc-100 dark:text-zinc-400 dark:data-pressed:bg-zinc-800"></button>
    </div>
    <div id="headSearch" hidden class="contents">
      <label class="ml-1 flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-zinc-100 pl-3 text-zinc-400 lg:ml-0 lg:h-9 lg:ring-blue-500/40 lg:focus-within:bg-white lg:focus-within:ring-2 dark:bg-zinc-800 dark:text-zinc-500 dark:lg:focus-within:bg-zinc-900"><span id="searchIcon"></span>
        <input id="q" type="search" autocomplete="off" placeholder="Search title, text or code" class="min-w-0 flex-1 bg-transparent text-base text-zinc-900 outline-none placeholder:text-zinc-400 lg:text-sm dark:text-zinc-100 [&::-webkit-search-cancel-button]:hidden">
        <kbd id="qKey" class="mr-2 hidden h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold text-zinc-400 ring-1 ring-zinc-300 lg:grid dark:ring-zinc-600">/</kbd>
        <button id="qX" data-act="search-clear" aria-label="Clear search" class="group -mr-1 grid size-11 shrink-0 place-items-center rounded-full lg:size-9"><span id="qClear" class="grid size-5 place-items-center rounded-full bg-zinc-400 text-white group-hover:bg-zinc-500 dark:bg-zinc-600 dark:text-zinc-900 dark:group-hover:bg-zinc-500"></span></button>
      </label>
      <button data-act="search-cancel" class="h-11 shrink-0 px-2.5 text-[15px] font-medium text-blue-600 lg:hidden dark:text-blue-400">Cancel</button>
    </div>
    <button id="deskFilterBtn" data-act="filters" title="Filter · F" aria-label="Filters" aria-expanded="false" class="relative hidden size-9 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 aria-expanded:bg-zinc-100 lg:grid dark:text-zinc-400 dark:hover:bg-zinc-800 dark:aria-expanded:bg-zinc-800"></button>
  </header>

  <nav id="tabs" class="flex h-11 shrink-0 items-stretch border-b border-zinc-200 pr-1 pl-4 lg:hidden dark:border-zinc-800">
    <div role="tablist" class="flex min-w-0 items-stretch gap-2 overflow-x-auto [scrollbar-width:none] min-[400px]:gap-4"><button data-act="tab" data-tab="items" role="tab" aria-selected="true" class="group -mb-px flex h-11 shrink-0 items-center gap-0.5 border-b-2 border-transparent text-[14px] font-medium text-zinc-500 min-[400px]:gap-1 min-[400px]:text-[15px] aria-selected:border-zinc-900 aria-selected:font-semibold aria-selected:text-zinc-900 dark:text-zinc-400 dark:aria-selected:border-zinc-100 dark:aria-selected:text-zinc-50">Items<span id="nItems" class="rounded-full px-1.5 py-px font-mono text-[11px] font-medium text-zinc-400 tabular-nums empty:hidden group-aria-[selected=false]:px-0.5 group-aria-selected:bg-zinc-900/7 min-[400px]:group-aria-[selected=false]:px-1 group-aria-selected:text-zinc-600 dark:text-zinc-500 dark:group-aria-selected:bg-white/10 dark:group-aria-selected:text-zinc-300"></span></button><button data-act="tab" data-tab="inputs" role="tab" aria-selected="false" class="group -mb-px flex h-11 shrink-0 items-center gap-0.5 border-b-2 border-transparent text-[14px] font-medium text-zinc-500 min-[400px]:gap-1 min-[400px]:text-[15px] aria-selected:border-zinc-900 aria-selected:font-semibold aria-selected:text-zinc-900 dark:text-zinc-400 dark:aria-selected:border-zinc-100 dark:aria-selected:text-zinc-50">Inputs<span id="nInputs" class="rounded-full px-1.5 py-px font-mono text-[11px] font-medium text-zinc-400 tabular-nums empty:hidden group-aria-[selected=false]:px-0.5 group-aria-selected:bg-zinc-900/7 min-[400px]:group-aria-[selected=false]:px-1 group-aria-selected:text-zinc-600 dark:text-zinc-500 dark:group-aria-selected:bg-white/10 dark:group-aria-selected:text-zinc-300"></span></button><button data-act="tab" data-tab="archive" role="tab" aria-selected="false" class="group -mb-px flex h-11 shrink-0 items-center gap-0.5 border-b-2 border-transparent text-[14px] font-medium text-zinc-500 min-[400px]:gap-1 min-[400px]:text-[15px] aria-selected:border-zinc-900 aria-selected:font-semibold aria-selected:text-zinc-900 dark:text-zinc-400 dark:aria-selected:border-zinc-100 dark:aria-selected:text-zinc-50">Archive<span id="nArchTab" class="rounded-full px-1.5 py-px font-mono text-[11px] font-medium text-zinc-400 tabular-nums empty:hidden group-aria-[selected=false]:px-0.5 group-aria-selected:bg-zinc-900/7 min-[400px]:group-aria-[selected=false]:px-1 group-aria-selected:text-zinc-600 dark:text-zinc-500 dark:group-aria-selected:bg-white/10 dark:group-aria-selected:text-zinc-300"></span></button><button data-act="tab" data-tab="rules" role="tab" aria-selected="false" class="group -mb-px flex h-11 shrink-0 items-center gap-0.5 border-b-2 border-transparent text-[14px] font-medium text-zinc-500 min-[400px]:gap-1 min-[400px]:text-[15px] aria-selected:border-zinc-900 aria-selected:font-semibold aria-selected:text-zinc-900 dark:text-zinc-400 dark:aria-selected:border-zinc-100 dark:aria-selected:text-zinc-50">Rules<span id="nRules" class="rounded-full px-1.5 py-px font-mono text-[11px] font-medium text-zinc-400 tabular-nums empty:hidden group-aria-[selected=false]:px-0.5 group-aria-selected:bg-zinc-900/7 min-[400px]:group-aria-[selected=false]:px-1 group-aria-selected:text-zinc-600 dark:text-zinc-500 dark:group-aria-selected:bg-white/10 dark:group-aria-selected:text-zinc-300"></span></button></div>
    <button id="filterBtn" data-act="filters" aria-label="Filters" class="relative ml-auto grid size-11 shrink-0 place-items-center text-zinc-500 dark:text-zinc-400"></button>
  </nav>
  <div id="filterStrip" hidden class="flex h-11 shrink-0 items-center gap-2 overflow-x-auto border-b border-zinc-100 px-4 [scrollbar-width:none] lg:hidden dark:border-zinc-800/70"></div>
  <div id="deskFilters" hidden class="border-zinc-200 lg:col-start-1 lg:row-start-3 lg:border-r lg:border-b dark:border-zinc-800"></div>

  <section id="itemsView" class="flex min-h-0 flex-1 flex-col lg:col-start-1 lg:row-span-2 lg:row-start-4 lg:border-r lg:border-zinc-200 dark:lg:border-zinc-800">
    <div id="list" class="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6 data-drop-out:bg-blue-50/60 dark:data-drop-out:bg-blue-400/5 lg:scrollbar-thin lg:scrollbar-gutter-stable lg:hover:scrollbar-thumb-zinc-500/80 dark:lg:hover:scrollbar-thumb-zinc-400/70"><div class="px-6 py-16 text-center text-sm text-zinc-400">Loading…</div></div>
  </section>

  <section id="inputsView" hidden class="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6 lg:mask-b-from-[calc(100%-2rem)] lg:scrollbar-gutter-both lg:hover:scrollbar-thumb-zinc-500/80 dark:lg:hover:scrollbar-thumb-zinc-400/70 lg:col-span-2 lg:col-start-1 lg:row-span-2 lg:row-start-3"></section>

  <section id="detailView" hidden class="flex min-h-0 flex-1 flex-col lg:col-start-2 lg:row-span-3 lg:row-start-2 lg:group-data-[compose]/app:row-span-1">
    <div id="goStrip" hidden class="flex h-11 shrink-0 items-center gap-3 border-b border-amber-200/70 bg-amber-50 px-4 text-[13px] dark:border-amber-400/15 dark:bg-amber-400/10"></div>
    <header class="flex h-14 shrink-0 items-center gap-1 border-b border-zinc-100 px-1 lg:border-zinc-200 lg:px-3 dark:border-zinc-800/70 dark:lg:border-zinc-800">
      <button data-act="back" id="backBtn" aria-label="Back" class="grid size-11 shrink-0 place-items-center rounded-full text-zinc-600 data-pressed:bg-zinc-100 lg:hidden dark:text-zinc-400 dark:data-pressed:bg-zinc-800"></button>
      <div id="dHead" class="flex min-w-0 flex-1 flex-col items-center leading-tight lg:flex-row lg:items-center lg:gap-2 lg:pl-2"></div>
      <div id="dActs" class="hidden items-center gap-0.5 lg:flex"></div>
      <button data-act="item-menu" id="itemMenuBtn" aria-label="Item actions" title="All actions · ." class="grid size-11 shrink-0 place-items-center rounded-full text-zinc-600 data-pressed:bg-zinc-100 lg:size-9 lg:rounded-lg lg:hover:bg-zinc-100 dark:text-zinc-400 dark:data-pressed:bg-zinc-800 dark:lg:hover:bg-zinc-800"></button>
      <div id="dNav" class="hidden items-center gap-0.5 border-l border-zinc-200 pl-2 lg:ml-1.5 lg:flex dark:border-zinc-800"></div>
    </header>
    <div id="detailBody" class="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:mask-b-from-[calc(100%-2rem)] lg:scrollbar-gutter-both lg:hover:scrollbar-thumb-zinc-500/80 dark:lg:hover:scrollbar-thumb-zinc-400/70 lg:group-data-[compose]/app:hidden"></div>
  </section>

  <section id="projectView" hidden aria-label="Settings" class="flex min-h-0 flex-1 flex-col bg-zinc-100 lg:col-span-2 lg:col-start-1 lg:row-span-5 lg:row-start-1 lg:flex-row lg:overflow-hidden lg:bg-transparent dark:bg-zinc-950 dark:lg:bg-transparent">
    <nav id="projectNav" aria-label="Sections of Settings" class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-10 lg:w-60 lg:flex-none lg:shrink-0 lg:border-r lg:border-zinc-200 lg:pb-4 lg:scrollbar-thin dark:lg:border-zinc-800"></nav>
    <div id="projectBody" class="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain lg:scrollbar-gutter-both lg:hover:scrollbar-thumb-zinc-500/80 dark:lg:hover:scrollbar-thumb-zinc-400/70"></div>
  </section>

  <div id="listGrip" data-grip="list" hidden title="Drag to resize · double-click for the default" class="z-30 cursor-col-resize hover:bg-blue-500/30 lg:col-start-1 lg:row-span-4 lg:row-start-2 lg:block lg:w-2 lg:translate-x-full lg:justify-self-end"></div>
  <footer id="foot" class="relative z-20 shrink-0 lg:scrollbar-gutter-both lg:hover:scrollbar-thumb-zinc-500/80 dark:lg:hover:scrollbar-thumb-zinc-400/70 px-3 pt-1 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:col-start-2 lg:row-start-5 lg:px-8 lg:pb-5 lg:group-data-[compose]/app:row-start-3 lg:group-data-[compose]/app:row-span-3 lg:group-data-[compose]/app:overflow-y-auto lg:group-data-[compose]/app:overscroll-contain lg:group-data-[compose]/app:pt-[9vh] lg:group-data-[compose]/app:pb-16">
    <div id="composeHead" class="hidden lg:group-data-[compose]/app:mx-auto lg:group-data-[compose]/app:mb-6 lg:group-data-[compose]/app:flex lg:group-data-[compose]/app:max-w-[42rem] lg:group-data-[compose]/app:flex-col lg:group-data-[compose]/app:items-center lg:group-data-[compose]/app:text-center"></div>
    <div id="feedback" hidden role="status" class="mb-1.5 flex min-h-7 items-center gap-2 pr-1 pl-2.5 text-[13px] text-zinc-600 lg:mx-auto lg:max-w-[42rem] dark:text-zinc-300 lg:group-data-[compose]/app:hidden"></div>
    <div id="composer" class="group/box rounded-4xl border border-zinc-200 bg-white shadow-lg shadow-black/5 focus-within:border-zinc-300 lg:mx-auto lg:max-w-[42rem] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40 dark:focus-within:border-zinc-700">
      <div id="scope" hidden class="flex h-8 items-center gap-1.5 pt-1 pr-1.5 pl-4 text-[13px] text-zinc-500 dark:text-zinc-400 lg:group-data-[compose]/app:hidden"></div>
      <div id="drafts" hidden class="flex gap-2.5 overflow-x-auto px-3 pt-3 pb-1 lg:scrollbar-thin"></div>
      <div id="doubts" hidden class="flex flex-col px-4 pt-1 text-[13px] leading-snug text-zinc-600 dark:text-zinc-300"></div>
      <div class="flex items-end gap-0.5 p-1.5 group-data-[multi]/box:flex-wrap">
        <button id="attachBtn" data-act="attach" aria-label="Add images or files" class="grid size-11 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 lg:m-1 lg:size-9 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 group-data-[multi]/box:mr-auto"></button>
        <div class="grid min-w-0 flex-1 group-data-[multi]/box:order-first group-data-[multi]/box:basis-full group-data-[multi]/box:px-2 group-data-[multi]/box:pt-1">
          <textarea id="text" rows="1" placeholder="Write anything…" aria-label="Input" class="col-start-1 row-start-1 max-h-48 min-h-11 w-full min-w-0 resize-none bg-transparent px-1 py-2.5 text-[17px] leading-6 outline-none placeholder:text-zinc-400 sm:text-[15px] lg:scrollbar-thin dark:placeholder:text-zinc-500"></textarea>
          <div id="boxView" hidden class="col-start-1 row-start-1 max-h-48 min-h-11 overflow-y-auto px-1 py-1.5 text-[17px] leading-8 whitespace-pre-wrap break-words text-zinc-900 sm:text-[15px] dark:text-zinc-100"></div>
          <div id="recBar" hidden role="status" aria-label="Recording" class="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5 px-1 lg:group-data-[compose]/app:px-3">
            <span class="size-2.5 shrink-0 animate-pulse rounded-full bg-red-500"></span>
            <span id="recTime" class="shrink-0 font-mono text-[15px] text-zinc-800 tabular-nums dark:text-zinc-100">0:00</span>
            <span id="recBars" class="flex h-8 min-w-0 flex-1 items-center justify-end gap-[3px] overflow-hidden lg:group-data-[compose]/app:h-14"></span>
          </div>
        </div>
        <button id="micBtn" data-act="mic" aria-label="Record a voice note" hidden class="grid size-11 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 lg:m-1 lg:size-9 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"></button>
        <button id="sendBtn" data-act="send" aria-label="Send (Shift + Enter)" class="grid size-11 shrink-0 place-items-center rounded-full bg-zinc-900 text-white disabled:opacity-25 lg:m-1 lg:size-9 lg:hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:lg:hover:bg-white"></button>
      </div>
      <input id="fileInput" type="file" multiple hidden>
    </div>
    <p id="boxHint" class="mt-1.5 hidden h-5 items-center justify-center gap-1 text-xs text-zinc-400 lg:mx-auto lg:flex lg:max-w-[42rem] dark:text-zinc-500"></p>
    <section id="composeList" aria-label="You said lately" class="hidden lg:group-data-[compose]/app:mx-auto lg:group-data-[compose]/app:mt-10 lg:group-data-[compose]/app:block lg:group-data-[compose]/app:max-w-[42rem]"></section>
  </footer>
</div>

<!-- B263: a sheet is never taller than the room above the input box, and stays clear of the iPhone's status bar -->
<div id="overlay" hidden class="fixed inset-0 z-40 flex items-end justify-center bg-black/40 pt-[max(env(safe-area-inset-top),0.75rem)] sm:items-center sm:p-6 dark:bg-black/60">
  <section id="dlg" role="dialog" aria-modal="true" aria-labelledby="dlgTitle" class="flex max-h-[min(88dvh,100%)] w-full max-w-2xl flex-col rounded-t-3xl bg-white shadow-xl transition-transform duration-150 sm:rounded-3xl dark:bg-zinc-900 dark:ring-1 dark:ring-white/10">
    <div data-handle class="flex shrink-0 touch-none justify-center pt-2 sm:hidden"><span class="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600"></span></div>
    <header class="flex shrink-0 touch-none items-center gap-2 py-1 pr-2 pl-5">
      <h2 id="dlgTitle" class="min-w-0 flex-1 truncate text-[17px] font-semibold"></h2>
      <span id="dlgExtra" class="contents"></span>
      <button data-act="close" aria-label="Close" class="group grid size-11 shrink-0 place-items-center rounded-full" id="dlgClose"></button>
    </header>
    <div id="dlgSub" hidden class="shrink-0"></div>
    <div id="dlgBody" class="min-h-0 flex-1 overflow-y-auto px-4 lg:scrollbar-thin lg:overscroll-contain lg:hover:scrollbar-thumb-zinc-500/80 dark:lg:hover:scrollbar-thumb-zinc-400/70 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]"></div>
    <div id="dlgFoot" hidden class="shrink-0"></div>
  </section>
</div>

<div id="viewer" hidden class="fixed inset-0 z-50 flex flex-col bg-black pt-[env(safe-area-inset-top)] text-white">
  <header class="flex items-center gap-2 px-2 py-1 text-sm">
    <span id="vName" class="min-w-0 flex-1 truncate pl-2"></span>
    <span id="vIdx" class="text-white/60"></span>
    <a id="vOpen" target="_blank" rel="noopener" class="flex h-11 items-center rounded-full px-3 text-white/80 hover:bg-white/10">Open file</a>
    <button data-act="v-close" aria-label="Close" class="grid size-11 place-items-center rounded-full hover:bg-white/10" id="vClose"></button>
  </header>
  <div id="vStage" class="flex min-h-0 flex-1 overflow-auto lg:scrollbar-thumb-white/40"><img id="vImg" alt="" class="m-auto max-h-full max-w-full object-contain"></div>
  <footer class="flex items-center justify-center gap-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-sm">
    <button data-act="v-prev" class="h-11 rounded-full px-4 hover:bg-white/10">Previous</button>
    <button data-act="v-zoom" id="vZoom" class="h-11 rounded-full bg-white/10 px-4 hover:bg-white/20">Zoom to 100%</button>
    <button data-act="v-next" class="h-11 rounded-full px-4 hover:bg-white/10">Next</button>
  </footer>
</div>

<div id="tip" role="tooltip" hidden class="pointer-events-auto fixed top-0 left-0 z-[80] max-w-[260px] rounded-lg bg-zinc-900 px-2 py-1.5 text-[13px] leading-snug text-white opacity-0 shadow-lg shadow-black/20 transition-[opacity,translate] duration-[120ms] data-[on]:opacity-100 motion-reduce:transition-none dark:bg-zinc-100 dark:text-zinc-900"><span id="tipText"></span><span id="tipArrow" class="absolute size-2 rotate-45 bg-inherit"></span></div>
<div id="vcBar" hidden role="toolbar" aria-label="On the selected text" class="fixed z-[65] flex rounded-full bg-zinc-900 p-1 shadow-lg ring-1 ring-black/10 dark:bg-zinc-100 dark:ring-white/10"><button id="vcBtn" data-act="vc" class="flex h-9 items-center gap-1.5 rounded-full pr-3.5 pl-2.5 text-sm font-semibold whitespace-nowrap text-white hover:bg-white/15 data-on:bg-red-600 data-on:text-white dark:text-zinc-900 dark:hover:bg-zinc-900/10 dark:data-on:bg-red-600 dark:data-on:text-white"></button><button id="fixBtn" data-act="vc-fix" hidden aria-label="Correct: write the right words for the selected ones" class="flex h-9 items-center gap-1.5 rounded-full pr-3.5 pl-2.5 text-sm font-semibold whitespace-nowrap text-white hover:bg-white/15 dark:text-zinc-900 dark:hover:bg-zinc-900/10"></button></div>
<div id="toast" hidden role="status" class="fixed inset-x-0 bottom-28 z-[60] mx-auto flex w-fit max-w-[92vw] lg:right-auto lg:bottom-5 lg:left-5 lg:mx-0 lg:max-w-md items-center gap-3 rounded-full bg-zinc-900 py-2 pr-4 pl-4 text-sm text-white shadow-lg has-[button]:py-1.5 has-[button]:pr-1.5 data-error:bg-red-600 data-error:text-white dark:bg-zinc-100 dark:text-zinc-900 dark:data-error:bg-red-600 dark:data-error:text-white"></div>

<script>
'use strict';
const ICON = {
  menu: '<path d="M4 9h16"/><path d="M4 15h11"/>',
  logo: '<path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  done: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  propose: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>',
  subitems: '<path d="M21 12h-8"/><path d="M21 6H8"/><path d="M21 18h-8"/><path d="M3 6v4c0 1.1.9 2 2 2h3"/><path d="M3 10v6c0 1.1.9 2 2 2h3"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  search: '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
  sliders: '<path d="M10 5H3"/><path d="M12 19H3"/><path d="M14 3v4"/><path d="M16 17v4"/><path d="M21 12h-9"/><path d="M21 19h-5"/><path d="M21 5h-7"/><path d="M8 10v4"/><path d="M8 12H3"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  scope: '<path d="m15 10 5 5-5 5"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  file: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/>',
  clip: '<path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/>',
  doc: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  comment: '<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>',
  ask: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  reply: '<path d="M9 17 4 12l5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
  thumb: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
  archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
  loop: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  lasso: '<path d="M7 22a5 5 0 0 1-2-4"/><path d="M3.3 14A6.8 6.8 0 0 1 2 10c0-4.4 4.5-8 10-8s10 3.6 10 8-4.5 8-10 8a12 12 0 0 1-5-1"/><path d="M5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  docplus: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M9 15h6"/><path d="M12 18v-6"/>',
  listplus: '<path d="M11 12H3"/><path d="M16 6H3"/><path d="M16 18H3"/><path d="M18 9v6"/><path d="M21 12h-6"/>',
  indent: '<path d="M21 12H11"/><path d="M21 18H11"/><path d="M21 6H11"/><path d="m3 8 4 4-4 4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  plug: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
  phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  open: '<path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/>',
  play: '<path d="M6 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L7.5 3.64A1 1 0 0 0 6 4.5z" fill="currentColor" stroke="none"/>',
  pausefill: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  reopen: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
  sparkle: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  start: '<circle cx="12" cy="12" r="10"/><path d="M10 8.5v7l5.5-3.5z" fill="currentColor"/>',
  pause: '<circle cx="12" cy="12" r="10"/><path d="M10 15V9"/><path d="M14 15V9"/>',
  spinner: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  mic: '<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/>',
  stop: '<rect width="12" height="12" x="6" y="6" rx="2" fill="currentColor"/>',
  chevup: '<path d="m18 15-6-6-6 6"/>',
  shrink: '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="m14 10 7-7"/><path d="m3 21 7-7"/>',
  panel: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
  keyboard: '<path d="M10 8h.01"/><path d="M12 12h.01"/><path d="M14 8h.01"/><path d="M16 12h.01"/><path d="M18 8h.01"/><path d="M6 8h.01"/><path d="M7 16h10"/><path d="M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/>',
  newinput: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
  items: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  folder: '<path d="M20 17a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.9a2 2 0 0 1-1.69-.9l-.81-1.2a2 2 0 0 0-1.67-.9H8a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2Z"/><path d="M2 8v11a2 2 0 0 0 2 2h14"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  updown: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
};
const ico = (n, c = 'size-5', sw = '1.75') => `<svg class="${c} shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const P = location.pathname.replace(/[^/]*$/, '');  // /p/<project>/
const HERE = decodeURIComponent(P.split('/')[2] || '');  // this project's address, known before its data arrives (B190)
const VER = '__TASKA_VERSION__';  // this page's code; the server sends its own with every poll
let BASE = location.origin + P.replace(/\/$/, '');  // what a coding agent calls BASE; from outside it carries the key
const sleep = ms => new Promise(r => setTimeout(r, ms));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const LETTER = {feature: 'F', bug: 'B', idea: 'I', task: 'T', rule: 'R'};
const TYPES = ['feature', 'bug', 'idea', 'task'];
const TYPE_TEXT = {feature: 'text-blue-700 dark:text-blue-300', bug: 'text-red-700 dark:text-red-300', idea: 'text-violet-700 dark:text-violet-300', task: 'text-teal-700 dark:text-teal-300', rule: 'text-zinc-700 dark:text-zinc-300'};
const RULE_STATUS = {proposed: 'Proposed', open: 'Active', dropped: 'Retired'};
const statusName = it => (it.type === 'rule' ? RULE_STATUS : STATUS)[it.status] || STATUS[it.status];
// Colors carry one meaning each: amber = needs you, blue = in progress, red = P0 / errors, green = done, faded = closed.
const PRI_TEXT = {P0: 'font-semibold text-red-600 dark:text-red-400', P1: 'font-semibold text-zinc-700 dark:text-zinc-200', P2: 'text-zinc-500 dark:text-zinc-400', P3: 'text-zinc-400 dark:text-zinc-500'};
const STATUS = {proposed: 'Proposed', open: 'Open', doing: 'In progress', review: 'In review', done: 'Done', dropped: "Won't do"};
const CLOSED = s => s === 'done' || s === 'dropped';
const WHEN = {now: 'Now', later: 'Later'};
const STATE_ICON = {
  proposed: ['<circle cx="12" cy="12" r="9" stroke-dasharray="3.5 3"/>', 'text-amber-600 dark:text-amber-400'],
  open: ['<circle cx="12" cy="12" r="9"/>', 'text-zinc-300 dark:text-zinc-600'],
  doing: ['<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>', 'text-blue-600 dark:text-blue-400'],
  review: ['<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9"/>', 'text-amber-600 dark:text-amber-400'],
  done: ['<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9"/>', 'text-emerald-600 dark:text-emerald-400'],
  dropped: ['<circle cx="12" cy="12" r="9"/><path d="M6.5 17.5 17.5 6.5"/>', 'text-zinc-400 dark:text-zinc-500'],
};
const stateIcon = (s, label = STATUS[s], cls = 'mt-px size-5', tone = STATE_ICON[s][1]) => `<svg class="${cls} shrink-0 ${tone}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${label}"><title>${label}</title>${STATE_ICON[s][0]}</svg>`;
const KIND = {ask: 'Question', block: 'Blocked', withdraw: 'Withdrawn', propose: 'Proposal', decide: 'Decision', progress: 'Progress'};
const who = b => b === 'you' ? 'You' : b === 'org' ? 'Organizer' : b === 'agent' ? 'Agent' : b;
const whoName = b => AGENT_NAME[b] || who(b);  // "claude-code" reads as "Claude Code"
const AVATAR = {'claude-code': 'C', codex: 'X', antigravity: 'A', org: 'O', agent: 'A'};
const avatar = b => `<span class="grid size-5 shrink-0 place-items-center rounded-md bg-zinc-900 text-[10px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">${esc(AVATAR[b] || String(b || '?')[0].toUpperCase())}</span>`;
const MSG = by => by === 'you' ? 'ml-8 rounded-xl bg-blue-100/80 px-3 py-2 dark:bg-blue-900/40' : 'mr-8 rounded-xl bg-white px-3 py-2 ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800';
const WHO = by => by === 'you' ? 'font-medium text-blue-700 dark:text-blue-300' : 'font-medium text-zinc-700 dark:text-zinc-300';
const HIT = 'relative after:absolute after:inset-x-0 after:-inset-y-1.5';  // a 32px control gets a 44px touch area
const BTN = 'rounded-lg px-2.5 py-2.5 sm:py-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800';
const LINK_BTN = `${HIT} flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10`;  // a quiet blue action
const PRIMARY_BASE = 'inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-[15px] font-semibold';  // disabled and busy look: the rule on <body>
const PRIMARY = PRIMARY_BASE + ' bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200';
const SECOND = 'inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 text-[15px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700';
const CHIP = `${HIT} flex h-8 items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 text-[13px] hover:bg-zinc-200/70 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80`;
const NEEDS_CARD = 'rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-400/25 dark:bg-amber-400/7';
const FIELD = 'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950';
const CLOSE_X = `<span class="grid size-8 place-items-center rounded-full bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200 group-hover:text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:group-hover:bg-zinc-700 dark:group-hover:text-zinc-200">${'<svg class="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'}</span>`;
const SECTION = (text, right = '') => `<div class="flex h-6 items-center justify-between"><h2 class="text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">${text}</h2>${right}</div>`;

let S = {rev: -1, boot: '', items: [], inputs: [], width: 1, org: {}};
let offline = 0;  // consecutive failed polls
const byN = new Map(), byR = new Map(), kids = new Map();
const U = {doc: null, docNew: null, docEdit: false, docText: null, docSel: new Set(), docQuote: null, docCircle: false, docThreads: new Set(), docDrafts: {}, docScroll: {}, peek: null, moreInputs: new Set(), tab: 'items', q: '', type: 'all', when: 'all', status: 'all', pri: 'all', undoArch: null, folded: new Set(), moreMsgs: new Set(), subFor: null, choice: null, choiceLabels: {}, go: null, sheet: null, searching: false, open: null, scopeOff: false, editing: null, files: [], sending: false, lastSent: null, more: new Set(), tabOpen: {}, settle: new Map(), tabTop: {}, stepFrom: null, mine: [], tabView: {}};
U.outbox = []; U.qn = 0;  // what you sent that hasn't reached the server yet (F85)
const groups = new Map();
let viewerGroup = [], viewerIdx = 0;
// The desktop layout (I70, design A "three panes"): 1024px and wider. Below that the phone layout, untouched.
const DESK = matchMedia('(min-width: 1024px)'), WIDE = matchMedia('(min-width: 1280px)');
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)');  // the system's "reduce motion": no slides (T160); a rule on <body> stops the CSS ones
const desk = () => DESK.matches;
const D = {page: null, full: false, sideHidden: (() => { try { return !!localStorage.getItem('taska.sideHidden'); } catch (_) { return false; } })(), sideOpen: false, filters: false, g: 0, undo: null, compose: false, prev: null};
const TIP = {el: null, t: 0, closedAt: 0, hush: null, fine: matchMedia('(hover: hover) and (pointer: fine)')};  // the one tooltip (T094)
// Every project has its own colour (B78): a letter tile that tells at a glance which project you are in, so an
// input doesn't land in the wrong one. The colour comes from the name, so it never changes.
const PROJ_TONES = ['bg-violet-600 dark:bg-violet-500', 'bg-teal-600 dark:bg-teal-500', 'bg-pink-600 dark:bg-pink-500', 'bg-blue-600 dark:bg-blue-500', 'bg-slate-600 dark:bg-slate-500', 'bg-fuchsia-600 dark:bg-fuchsia-500', 'bg-cyan-600 dark:bg-cyan-500', 'bg-indigo-600 dark:bg-indigo-500'];
const projHash = name => { let h = 0; for (const c of String(name)) h = (h * 31 + c.codePointAt(0)) >>> 0; return h; };
function projTone(name) {  // the name picks the colour; if another of your projects has it already, the next free one
  const names = [...new Set([S.project, ...(DR.list || []).map(p => p.name)].filter(Boolean))].sort(), L = PROJ_TONES.length;
  if (projTone.key !== names.join('\n')) {
    const taken = new Set(); projTone.map = new Map(); projTone.key = names.join('\n');
    for (const n of names) { let i = projHash(n) % L; for (let k = 0; k < L && taken.has(i); k++) i = (i + 1) % L; taken.add(i); projTone.map.set(n, i); }
  }
  return PROJ_TONES[projTone.map.get(name) ?? projHash(name) % L];
}
// A project has a name for people and an address (F173): it shows by its name; its address (S.project, p.name) stays for
// links, this browser's drafts and its colour, so a rename changes none of them.
const projTitle = () => S.title || S.project || titleOf((DR.list || []).find(p => p.name === HERE) || {name: HERE});  // before the data: as last seen (B190)
const titleOf = p => p.title || p.name;
const titleFor = slug => slug === S.project ? projTitle() : titleOf((DR.list || []).find(p => p.name === slug) || {name: slug});
const projTile = (name, cls = 'size-5 rounded-md text-[11px]') => `<span aria-hidden="true" class="grid shrink-0 place-items-center leading-none font-bold text-white uppercase ${cls} ${projTone(name)}">${esc([...String(titleFor(name) || '?')][0])}</span>`;
const KBD = k => `<kbd class="ml-1 hidden h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold opacity-70 ring-1 ring-current/30 lg:inline-grid">${k}</kbd>`;

const code = n => { const it = byN.get(n); return (it ? LETTER[it.type] : '?') + String(n).padStart(S.width, '0'); };
const parseRef = s => { const m = /^[A-Za-z]?0*(\d+)$/.exec(String(s).trim()); return m ? Number(m[1]) : null; };
// The user's move: an agent asked or is blocked, proposed an item, or wants a finished item accepted.
const needsYou = it => !it.merged_into && !CLOSED(it.status) && (!!it.wait || it.status === 'proposed' || it.status === 'review');

// Pushes to the phone (F195): Taska on the Home Screen subscribes with the browser's push service; Taska then pushes
// when something newly needs you in any project, and the phone shows what it is.
const PUSH = {sub: undefined};
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const pushable = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && isSecureContext;
const keyBytes = k => Uint8Array.from(atob(k.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((k.length + 3) % 4)), c => c.charCodeAt(0));
async function pushState() {
  try { PUSH.sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription(); } catch (_) { PUSH.sub = null; }
  renderProject();
}
async function pushOn() {
  try {
    if (Notification.permission !== 'granted' && await Notification.requestPermission() !== 'granted') return toast("Notifications are off for Taska in this phone's settings", null, {error: true});
    const reg = await navigator.serviceWorker.ready, {key} = await net('/api/push');
    const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: keyBytes(key)});
    await net('/api/push', JSON_POST({sub: sub.toJSON(), quiet: noticeRead('quiet', true)}), NET.op);
    if (!PUSH.sub) toast('Notifications are on for this phone');
    PUSH.sub = sub;
  } catch (ex) { toast(`Couldn't turn notifications on: ${ex.message || ex}`, null, {error: true}); }
  renderProject();
}
async function pushOff() {
  const sub = PUSH.sub;
  try { if (sub) { await net('/api/push', JSON_POST({endpoint: sub.endpoint, off: true}), NET.op); await sub.unsubscribe(); } } catch (_) {}
  PUSH.sub = null; renderProject(); toast('Notifications are off for this phone');
}
function phonePushBody() {
  if (!pushable() || !standalone()) return pPart(standalone() ? "This phone can't get notifications" : 'Add Taska to the Home Screen first',
    standalone() ? 'Its browser has no push service.' : 'Add Taska to the Home Screen (how: Use on your phone), open it from there, and turn notifications on here.',
    standalone() ? '' : `<a href="${P}phone" data-act="psec" data-sec="phone" class="${SECOND} mt-3">${ico('phone', 'size-4')}Use on your phone</a>`);  // T228 #15: a way there
  if (PUSH.sub === undefined) { pushState(); return P_LOADING; }
  const blocked = Notification.permission === 'denied';
  return pSetting(blocked ? 'Blocked by the phone' : PUSH.sub ? 'On' : 'Off', 'A notification when something needs you in any project, even with Taska closed.',
    PUSH.sub ? `<button data-act="push-off" class="${SECOND}">Turn off</button>` : `<button data-act="push-on" ${blocked ? 'disabled ' : ''}class="${PRIMARY}">Turn on</button>`)
    + (PUSH.sub ? pSetting('Quiet 22:00–08:00', 'Taska keeps them till the morning.', `<button data-act="notifications-quiet" aria-pressed="${noticeRead('quiet', true)}" aria-label="Quiet 22:00–08:00" class="group relative h-6.5 w-11 shrink-0 rounded-full after:absolute after:inset-x-0 after:-inset-y-[9px] bg-zinc-300 transition-colors hover:brightness-95 aria-pressed:bg-emerald-500 dark:bg-zinc-600 dark:hover:brightness-125"><span class="absolute top-0.75 left-0.75 size-5 rounded-full bg-white shadow transition-transform group-aria-pressed:translate-x-4.5"></span></button>`) : '');
}
// Desktop notifications (F191). Observe even while quiet or focused, so those events never become a backlog.
const NOTICE = {items: false, projects: false, pending: new Map(), timer: 0, memory: {}};
function noticeRead(key, fallback) {
  try { return JSON.parse(localStorage.getItem('taska.notifications.' + key)) ?? fallback; } catch (_) { return NOTICE.memory[key] ?? fallback; }
}
function noticeWrite(key, value) {
  NOTICE.memory[key] = value;
  try { localStorage.setItem('taska.notifications.' + key, JSON.stringify(value)); } catch (_) {}
}
const noticeOn = () => 'Notification' in window && Notification.permission === 'granted' && noticeRead('on', false);
const noticeState = () => !('Notification' in window) || Notification.permission === 'denied' ? 'Blocked by the browser' : noticeOn() ? 'On' : 'Off';
const noticeQuiet = () => noticeRead('quiet', true) && (new Date().getHours() >= 22 || new Date().getHours() < 8);
const noticeAllowed = () => desk() && noticeOn() && (document.hidden || !document.hasFocus()) && !noticeQuiet();
async function turnOnNotices() {
  if (!desk() || !('Notification' in window)) return;
  try { noticeWrite('on', await Notification.requestPermission() === 'granted'); } catch (_) {}
  renderProject();
}
function queueNotice(key, event) {
  if (!noticeAllowed()) return;
  const prev = NOTICE.pending.get(key);
  NOTICE.pending.set(key, {...event, count: event.code ? 1 : event.count + (prev?.count || 0)});
  if (!NOTICE.timer) NOTICE.timer = setTimeout(sendNotice, 8000);
}
function sendNotice() {
  const events = [...NOTICE.pending.values()]; NOTICE.pending.clear(); NOTICE.timer = 0;
  if (!events.length || !noticeAllowed()) return;
  const count = events.reduce((n, e) => n + e.count, 0), first = events[0];
  const labels = events.map(e => e.code ? `${e.code} ${e.kind === 'ask' ? 'asks' : e.kind === 'block' ? 'is blocked' : e.kind === 'review' ? 'is ready to accept' : 'needs approval'} in ${e.title}` : `${plural(e.count, 'new thing')} need${e.count === 1 ? 's' : ''} you in ${e.title}`);
  try {
    const notification = new Notification(count === 1 ? labels[0] : `${count} things need you: ${labels.slice(0, 3).join(', ')}${labels.length > 3 ? ', …' : ''}`, {tag: 'taska-needs-you'});
    notification.onclick = () => {
      notification.close(); window.focus();
      location.assign(`/p/${encodeURIComponent(first.project)}/${count === 1 && first.code ? encodeURIComponent(first.code) : ''}`);
    };
  } catch (_) {}  // a permission change or an unavailable desktop service must not interrupt polling
}
function noticeItems(d) {
  if (!desk()) return;
  const saved = 'items.' + d.project, before = noticeRead(saved, {}), next = {};
  for (const it of d.items.filter(needsYou)) {
    const kinds = [...(it.wait ? [it.wait.kind] : []), ...(['proposed', 'review'].includes(it.status) ? [it.status] : [])];
    let event = null;
    for (const kind of kinds) {
      const key = `${d.project}:${it.code}:${kind}`, token = kind === it.wait?.kind ? it.wait.id : kind;
      next[key] = token;
      if (NOTICE.items && before[key] !== token && !event) event = {project: d.project, title: d.title || d.project, code: it.code, kind, count: 1};
    }
    if (event) queueNotice(`${d.project}:${it.code}`, event);
  }
  for (const [key, e] of NOTICE.pending) if (e.project === d.project && e.code && !(`${e.project}:${e.code}:${e.kind}` in next)) NOTICE.pending.delete(key);
  noticeWrite(saved, next); NOTICE.items = true;
}
function noticeProjects(projects) {
  if (!desk()) return;
  const before = noticeRead('counts', {}), next = {};
  for (const p of projects) {
    next[p.name] = p.needs;
    if (NOTICE.projects && p.name !== HERE && p.needs > (before[p.name] ?? 0))
      queueNotice(`${p.name}:*:needs`, {project: p.name, title: titleOf(p), count: p.needs - (before[p.name] ?? 0)});
  }
  noticeWrite('counts', next); NOTICE.projects = true;
}

function when(t) {
  const d = new Date(t), now = new Date(), hm = d.toTimeString().slice(0, 5);
  if (d.toDateString() === now.toDateString()) return hm;
  if (new Date(now - 864e5).toDateString() === d.toDateString()) return 'Yesterday ' + hm;
  return d.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
}

const LAST = {pane: null};  // the pane you last acted in, for where feedback shows (B129)
document.addEventListener('pointerdown', e => { LAST.pane = e.target.closest?.('#list, #detailView, #drawer, #inputsView, #projectBody, #projectView, #foot') || LAST.pane; }, true);
document.addEventListener('keydown', e => { if (desk() && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) LAST.pane = $('detailView'); }, true);  // keys act on the open item
// What just happened, in one line. With `act` it carries a button for a few seconds: Undo, or `label`. An error is
// red, is read out at once (role=alert) and stays longer (T160).
const SAVE = {q: Promise.resolve(), pend: [], failed: [], last: '', down: 0};  // saving behind you: see "saving" below
function toast(text, act, {error = false, label = 'Undo', ms = 0} = {}) {  // ms: how long it stays, if not the usual
  const el = $('toast');
  if (act && label === 'Undo' && !act.entry) act = pushUndo(text, act);  // every Undo is also Z's, and runs once (T113 A7)
  if (!error) SAVE.failed = [];  // the red toast this one replaces takes its Retry along
  el.toggleAttribute('data-error', error); el.setAttribute('role', error ? 'alert' : 'status');
  el.innerHTML = `${error ? ico('alert', 'size-4', '2') : ''}<span class="line-clamp-2 min-w-0 leading-snug">${esc(text)}</span>${act ?`<button class="relative h-8 shrink-0 rounded-full px-3 text-sm font-semibold after:absolute after:-inset-1.5 ${error ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-white/15 text-white hover:bg-white/25 dark:bg-zinc-900/10 dark:text-zinc-900 dark:hover:bg-zinc-900/20'}">${label}</button>` : ''}`;
  el.classList.toggle('pointer-events-none', !act);
  placeToast(el);
  if (act) el.querySelector('button').onclick = () => { el.hidden = true; act(); };
  el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; if (error) SAVE.failed = []; }, ms || (error ? 8000 : act ? 5000 : 2600));
}
// Where the toast shows. On the phone it moves when a sheet opens or closes under it, so it never sits on the
// sheet's buttons (a Restore right after a Delete).
function placeToast(el = $('toast')) {
  const up = (!$('overlay').hidden && !desk()) || !!D.page;  // a sheet, the focus card or a Settings page: at the top, clear of their buttons (T228 #3, #5, #17)
  el.classList.toggle('bottom-28', !up); el.classList.toggle('top-[calc(env(safe-area-inset-top)+0.75rem)]', up); el.classList.toggle('lg:bottom-auto', up);
  if (desk()) {  // B129: on the desktop it shows in the pane you acted in, above the box if the box is there
    const pane = [LAST.pane, $('detailView'), $('inputsView'), $('projectBody')].find(p => p?.isConnected && p.offsetParent), r = pane?.getBoundingClientRect();
    const f = $('foot').getBoundingClientRect(), above = r && f.height < 300 && f.left < r.right && f.right > r.left;
    if (r) { el.style.left = `${r.left + r.width / 2}px`; el.style.bottom = up ? '' : `${above ? innerHeight - f.top + 12 : 20}px`; }
    el.classList.toggle('lg:-translate-x-1/2', !!r);
  } else {  // B158: on the phone it sits just above what you act on, the input box or an open card's bar, and never on it
    el.style.left = el.style.bottom = ''; el.classList.remove('lg:-translate-x-1/2');
    // The card (Go through, a row's Answer) has buttons from top to bottom: the toast goes above it, never on them (T225 #7).
    const bar = DR.open ? $('drawerSettings') : $('overlay').hidden ? !$('foot').hidden && $('foot') : $('overlay').dataset.card ? null : !$('dlgFoot').hidden && $('dlgFoot').offsetHeight && $('dlgFoot');
    if (bar) { el.style.bottom = `${Math.round(innerHeight - bar.getBoundingClientRect().top + 8)}px`; el.classList.remove('bottom-28', 'top-[calc(env(safe-area-inset-top)+0.75rem)]'); }
  }
}

async function copy(text, done = 'Copied') {
  try { await navigator.clipboard.writeText(text); }
  catch (_) { const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); }
  toast(done);
}

// ---------------------------------------------------------------- data

async function load() {
  const text = await net(P + 'api/state', {}, NET.state, 'text');
  if (/^project \S+ was deleted/.test(text)) { if (!U.leaving) location.replace('/'); return; }  // deleted on another device or tab (F173); this one moves on by itself
  SAVE.last = text; ingest(JSON.parse(text));
}
function ingest(d) {  // Taska's state on screen, with your changes that are still on their way (T160)
  noticeItems(d);
  S = d; BASE = d.base || BASE; byN.clear(); byR.clear();
  for (const it of S.items) { if (CLOSED(it.status)) it.wait = null; byN.set(it.n, it); }  // closed: its question is history, not a pending ask (B128)
  for (const r of S.inputs) byR.set(r.id, r);
  for (const p of SAVE.pend) patch(p);
  linkKids(); followCodes();
  const was = U.open && byN.get(U.open)?.merged_into ? U.open : null;
  if (was) { U.open = liveN(was); writeURL(false); }  // the item you look at was merged: the one it went into shows (B118)
  const moved = S.project ? mergeDrafts() : [], mine = was && moved.find(([f]) => f === code(was));
  if (was) toast(`${code(was)} was merged into ${code(U.open)}${mine ? '. What you wrote for it is in this box now' : ''}`);
  else if (moved.length) toast(`${moved.map(([f, t]) => `${f} → ${t}`).join(', ')}: merged, and what you wrote went along`, () => goDraft(moved[0][1]), {label: 'Go there'});
  if (U.open && !byN.has(U.open) && (S.deleted || []).some(x => x.items.some(i => i.n === U.open))) {  // deleted with its input (F177)
    if (desk()) { U.open = null; writeURL(false); } else closeItem();
  }
  render(); fixURL();
}
// An item's code follows its type: T13 becomes B13 (T113 S2). What you wrote to it goes along, and the address too.
function followCodes() {
  const now = k => { const m = /^[A-Z](\d+)$/.exec(k || ''), n = m && Number(m[1]); return n && byN.has(n) && code(n) !== k ? code(n) : null; };
  for (const k of Object.keys(draftStore()).filter(now)) draftStore(all => { if (!all[now(k)]) all[now(k)] = all[k]; delete all[k]; });
  for (const k of Object.keys(U.parked || {}).filter(now)) { U.parked[now(k)] ||= U.parked[k]; delete U.parked[k]; }
  if (now(U.draftKey)) U.draftKey = now(U.draftKey);
}
function fixURL() {
  const seg = decodeURIComponent(location.pathname.slice(P.length)).replace(/\/$/, '');
  if (U.open && parseRef(seg) === U.open && seg !== code(U.open) && !/^[Dd]\d+$/.test(seg)) writeURL(false);
}

async function poll() {
  for (;;) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 35000);  // a dead connection never answers
    try {
      const d = await (await fetch(`${P}api/poll?rev=${S.rev}&boot=${S.boot}&pv=${S.pv ?? -1}`, {cache: 'no-store', signal: ctl.signal})).json();
      if (offline) { offline = 0; renderLive(); resendOutbox(); }  // Taska is back: what you sent meanwhile goes now (B151)
      if (d.rev !== S.rev || d.boot !== S.boot || d.pv !== S.pv) await load();
      if (d.ver && d.ver !== VER) freshen();
      checkOthers();
    } catch (_) {
      offline += ctl.signal.aborted ? 2 : 1; renderLive();  // a timeout means a dead link: say so at once
      await sleep(offline > 1 ? Math.min(30000, 1500 * 2 ** Math.min(offline, 5)) : 500);  // back off while the server is away
    } finally { clearTimeout(timer); }
  }
}

function renderLive() { renderAgent(); }

// Is anyone working? (T58 #1) The latest agent, whether it waits for work right now, and a red flag when work
// waits and nobody has come for a while.
const AGENT_NAME = {'claude-code': 'Claude Code', codex: 'Codex', antigravity: 'Antigravity', agent: 'Agent'};
const QUIET_MS = 30 * 60 * 1000;  // the server's CLAIM_TTL: quiet longer than this, another agent may take the item (F194)
function workerMark(it) {  // F194: the agent working on an item in progress; amber once it has gone quiet
  const a = it.agent;
  if (!a) return '';
  const name = esc(AGENT_NAME[a.by] || a.by), quiet = Date.now() - new Date(a.t).getTime();
  // T229 #1: only the agent's small mark; its name and how long it has been quiet are in the tip (hover, long press)
  const tip = quiet > QUIET_MS ? `${name}: quiet ${agoShort(new Date(a.t).getTime())}, last wrote ${when(a.t)}; another agent may take it` : `${name} is on it`;
  return `<span title="${tip}" aria-label="${tip}" data-tip="${tip}" class="inline-flex shrink-0 rounded-md ${quiet > QUIET_MS ? 'ring-2 ring-amber-400 dark:ring-amber-500' : ''}">${avatar(a.by)}</span>`;
}
const agoShort = t => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'now' : m < 60 ? m + 'm' : m < 1440 ? Math.round(m / 60) + 'h' : Math.round(m / 1440) + 'd'; };
const agoLong = t => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${plural(Math.round(m / 1440), 'day')} ago`; };
function agentState(agents, work) {  // -> [tone: ok | bad | idle, short label, sentence]
  const list = [...(agents || [])].sort((a, b) => b.t - a.t), a = list.find(x => x.waiting) || list[0];
  const name = a ? AGENT_NAME[a.name] || a.name : '';
  if (a?.waiting) return ['ok', `${name} ready`, `${name} is connected and picks up new work right away.`];
  if (a && Date.now() - a.t < 10 * 60e3) return ['ok', `${name} · ${agoShort(a.t)}`, `${name} was here ${agoLong(a.t)}.`];
  const last = a ? `The last agent (${name}) was here ${agoLong(a.t)}.` : 'No agent has connected to this project yet.';
  return work ? ['bad', a ? `No agent · ${agoShort(a.t)}` : 'No agent', `Work is waiting, but no agent is here to take it. ${last}`]
    : ['idle', a ? `${name} · ${agoShort(a.t)}` : 'No agent', `Nothing is waiting for an agent. ${last}`];
}
const AGENT_TONE = {ok: ['bg-emerald-500', ''], bad: ['bg-red-500', 'text-red-600 dark:text-red-400'], idle: ['bg-zinc-300 dark:bg-zinc-600', '']};
// The pill in the header: green while an agent waits for work, grey when one was here a while ago, red when work
// waits and nobody is here. While the server is out of reach it says so instead.
const PILL = {
  ready: ['bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/25', 'bg-emerald-500 ring-3 ring-emerald-500/25 dark:bg-emerald-400 dark:ring-emerald-400/25'],
  recent: ['bg-zinc-100 text-zinc-700 ring-zinc-900/5 dark:bg-zinc-800/80 dark:text-zinc-300 dark:ring-white/5', 'bg-emerald-500 dark:bg-emerald-400'],
  idle: ['bg-zinc-100 text-zinc-600 ring-zinc-900/5 dark:bg-zinc-800/80 dark:text-zinc-400 dark:ring-white/5', 'bg-zinc-300 dark:bg-zinc-600'],
  bad: ['bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/25', 'bg-red-500 dark:bg-red-400'],
};
function renderAgent() {
  const [tone, label, line] = agentState(S.agents, S.work), b = $('agentBtn');
  const ready = tone === 'ok' && (S.agents || []).some(a => a.waiting), kind = tone === 'ok' ? (ready ? 'ready' : 'recent') : tone;
  b.innerHTML = offline >= 2
    ? `<span role="status" class="flex h-8 items-center gap-2 rounded-full bg-zinc-100 px-3 text-[13px] font-medium text-zinc-600 ring-1 ring-zinc-900/5 ring-inset dark:bg-zinc-800/80 dark:text-zinc-300 dark:ring-white/5">${ico('spinner', 'size-3.5 animate-spin', '2.25')}Offline, retrying…</span>`
    : `<span class="flex h-8 max-w-44 items-center gap-2 rounded-full px-3 text-[13px] font-medium ring-1 ring-inset ${PILL[kind][0]}"><span class="size-2 shrink-0 rounded-full ${PILL[kind][1]}"></span><span class="truncate">${esc(label)}</span></span>`;
  b.title = offline >= 2 ? 'Taska is out of reach. It reconnects by itself.' : line;
  if ($('deskAgent')) draw($('deskAgent'), `<button data-act="agent-info" title="${esc(b.title)}" class="flex rounded-full hover:brightness-95 dark:hover:brightness-125">${b.innerHTML}</button>`);
}
setInterval(() => { if (S.agents) renderAgent(); }, 30000);  // "2m" keeps counting between changes

// Taska was updated: load the new page once nothing would be lost. Busy now? The next poll tries again.
function freshen() {
  const busy = R.rec || U.outbox.length || U.files.length || SAVE.pend.length || SAVE.failed.length || U.editing || (U.open && !desk()) || D.full || U.doc || U.undoArch || (document.activeElement === $('text') && $('text').value.trim())
    || !$('overlay').hidden || !$('viewer').hidden || DR.open || U.searching || U.renaming || U.pNew;
  if (!busy) location.reload();
}

async function refresh() { try { await load(); if (offline) { offline = 0; renderLive(); } } catch (_) {} }

// ---------------------------------------------------------------- saving (T160)
// Every request has a time limit: a dead connection fails after a while instead of hanging for good, and the screen
// says so. One-tap changes show at once and are saved behind you, one save at a time and in order. Until Taska has a
// change it is kept as a patch over Taska's last state, so a refresh meanwhile doesn't take it off the screen. A save
// that fails takes its patch back (the screen shows Taska's state again), and a red toast says so, with Retry.
const NET = {op: 10000, state: 30000, get: 15000};  // ms
async function net(url, opts = {}, ms = NET.get, as = 'json') {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, {cache: 'no-store', ...opts, signal: ctl.signal});
    return as === 'text' ? await r.text() : await r.json();
  } catch (_) { throw Object.assign(new Error(ctl.signal.aborted ? 'No answer from Taska' : 'Taska is out of reach'), {net: true}); }
  finally { clearTimeout(t); }
}
const JSON_POST = body => ({method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
async function op(o) {
  const d = await net(P + 'api/op', JSON_POST(o), NET.op);
  if (!d.ok) { toast((d.res || []).find(x => x.startsWith('err')) || d.error || 'Not saved', null, {error: true}); throw new Error('op failed'); }
  try { await load(); } catch (_) {}  // it is saved; the next refresh brings the rest
  return d;
}
// A save that didn't reach Taska (one Taska refused, op() has explained in its own words). Several in a row are
// retried together, in order.
function notSaved(ex, retry) {
  if (!ex?.net) return;
  if (retry) SAVE.failed.push(retry);
  const k = SAVE.failed.length;
  toast(k > 1 ? `${k} changes not saved` : 'Not saved', k ? () => { for (const r of SAVE.failed.splice(0)) r(); } : null, {error: true, label: 'Retry'});
}
const notLoaded = (what, retry) => toast(`Couldn't load ${what}`, retry, {error: true, label: 'Retry'});
// Something that waits for Taska before it shows (it makes something new, or saves what you typed): its button stays
// busy meanwhile; if Taska can't be reached, a red toast says so, and Retry does it again.
async function save(o, retry) {
  try { return await op(o); } catch (ex) { notSaved(ex, retry); throw ex; }
}
function patch(p) {  // one change on screen: {n, f} for an item, {cfg} for the project
  if (p.cfg) { S.cfg = {...S.cfg, ...p.cfg}; return; }
  const it = byN.get(p.n);
  if (!it) return;
  const back = 'status' in p.f && !CLOSED(p.f.status) && it.archived && !('archived' in p.f);
  Object.assign(it, p.f);
  if (back) it.archived = false;  // reopening brings an archived item back, as Taska does
  if (CLOSED(it.status)) it.wait = null;
}
function linkKids() { kids.clear(); for (const it of S.items) if (it.parent && !it.merged_into) { if (!kids.has(it.parent)) kids.set(it.parent, []); kids.get(it.parent).push(it); } }
const restore = () => { if (SAVE.last) ingest(JSON.parse(SAVE.last)); };
// Show a change at once and save it behind you. patches: what changes on screen; send(): what goes to Taska, in turn;
// fail(ex): after it was taken back; needed(): false when, by its turn, there is nothing to send (an undo of a change
// that never reached Taska). -> a promise: true once saved, false if it couldn't be.
function optimistic(patches, send, fail = ex => notSaved(ex), needed = () => true) {
  const drop = () => { SAVE.pend = SAVE.pend.filter(p => !patches.includes(p)); };
  SAVE.pend.push(...patches);
  for (const p of patches) patch(p);
  linkKids(); followCodes(); render(); fixURL();
  const made = Date.now();
  return SAVE.q = SAVE.q.then(async () => {
    try {
      if (!needed()) return true;
      if (SAVE.down > made) throw Object.assign(new Error('Taska is out of reach'), {net: true});  // it waited behind a save that couldn't reach Taska: it fails with it, at once and in the same toast
      await send(); return true;
    }
    catch (ex) { if (ex.net) SAVE.down = Date.now(); drop(); try { restore(); fail(ex); } catch (_) {} return false; }
    finally { drop(); }
  });
}
// A one-tap change of an item's fields, without Undo.
const setNow = (n, f, retry) => { const ref = code(n); return optimistic([{n, f}], () => op({op: 'set', ref, f}), ex => notSaved(ex, retry)); };

// ---------------------------------------------------------------- items

const HAY = new WeakMap();  // an item's words, worked out once per load (each load brings new item objects)
function hay(it) {
  let h = HAY.get(it);
  if (h === undefined) HAY.set(it, h = (code(it.n) + ' ' + LETTER[it.type] + it.n + ' ' + it.title + ' ' + it.body + ' ' + it.next + ' ' + it.thread.map(x => x.text).join(' ')).toLowerCase());
  return h;
}
// A9, B15: a search looks in one tab. When it finds little there, the list says where else the words are, one click
// away: that tab, with the same search.
const searchWords = () => U.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
const inputMatch = (r, words) => words.every(w => (r.id + ' ' + r.text).toLowerCase().includes(w));
function searchHints(shown) {
  const words = searchWords();
  crossSearch();
  if (!words.length) return '';
  return (shown >= 5 ? '' : ['items', 'inputs', 'archive', 'rules'].filter(t => t !== U.tab)
    .map(t => [t, t === 'inputs' ? S.inputs.filter(r => inputMatch(r, words)).length : S.items.filter(it => !it.merged_into && inTab(it, t) && words.every(w => hay(it).includes(w))).length])
    .filter(([, n]) => n).map(([t, n]) => `<p class="flex items-center justify-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">${n === 1 ? '1 match' : `${n} matches`} in ${TAB_NAME[t]}<button data-act="search-in" data-tab="${t}" class="${LINK_BTN}">Show</button></p>`).join(''))
    + crossHits();
}
// F196: the same words in the other projects, asked of the server once the typing pauses, under what this one found
const XS = {q: '', list: null, timer: 0};
function crossSearch() {
  const q = searchWords().join(' ');
  if (q === XS.q) return;
  XS.q = q; XS.list = null; clearTimeout(XS.timer);
  if (!q) return;
  XS.timer = setTimeout(async () => {
    try { const r = await net(`/api/search?q=${encodeURIComponent(q)}&skip=${encodeURIComponent(S.project)}`); if (XS.q === q) { XS.list = r; render(); } } catch (_) {}
  }, 300);
}
function crossHits() {
  const list = XS.q === searchWords().join(' ') ? XS.list : null;
  if (!list?.length) return '';
  const row = x => `<a href="/p/${encodeURIComponent(x.project)}/${x.kind === 'input' ? 'inputs?q=' + encodeURIComponent(XS.q) : encodeURIComponent(x.code)}" title="${esc(x.ptitle || x.project)} · ${esc(x.code)}" class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900">${projTile(x.project, 'size-5 rounded text-[10px]')}<span class="min-w-0 flex-1"><span class="block truncate text-sm"><span class="font-mono text-xs font-bold text-zinc-500 dark:text-zinc-400">${esc(x.code)}</span> ${esc(x.title)}</span><span class="block truncate text-xs text-zinc-500 dark:text-zinc-400">${esc(x.ptitle || x.project)}${x.kind === 'input' ? ' · what you said' : x.archived ? ' · archived' : CLOSED(x.status) ? ` · ${STATUS[x.status] || x.status}` : ''}</span></span></a>`;
  return `<div class="mx-auto mt-4 w-full max-w-xl px-2 text-left"><p class="px-3 pb-1 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">In other projects · ${list.length}${list.length === 30 ? '+' : ''}</p>${list.slice(0, 8).map(row).join('')}${list.length > 8 ? `<p class="px-3 py-1 text-xs text-zinc-500 dark:text-zinc-400">and ${list.length - 8} more: a longer search narrows them</p>` : ''}</div>`;
}

const filtered = () => !!(U.q.trim() || U.type !== 'all' || U.when !== 'all' || U.status !== 'all' || U.pri !== 'all');
// While the search box has words, a tab's count is what that tab shows with them (T225 #13): its own filters, these
// words. Switching tabs then takes the words along (setTab), so the count is what you see when you open it.
function searchCount(t) {
  const words = searchWords();
  if (t === 'inputs') return S.inputs.filter(r => !r.deleted && inputMatch(r, words)).length;
  const keep = Object.fromEntries(VIEW_KEYS.map(k => [k, U[k]])), v = t === U.tab ? keep : U.tabView[t] || {};
  for (const k of VIEW_KEYS) if (k !== 'q') U[k] = v[k] ?? 'all';
  try { return visible(t).length; } finally { Object.assign(U, keep); }
}
const tabNum = n => n >= 1000 ? Math.floor(n / 1000) + 'k' : n || '';  // 1234 reads 1k: four counts fit a 360 px phone (T225 #12)
function phoneCounts(rows = visible()) {  // the tabs' counts: what is open or waiting; while you search, the matches
  const words = searchWords().length, pending = S.inputs.filter(r => !r.acked).length;
  $('nItems').textContent = tabNum(words ? searchCount('items') : U.tab === 'items' && filtered() ? rows.filter(it => !it.archived).length : openCount());  // B130
  $('nInputs').textContent = tabNum(words ? searchCount('inputs') : pending);
  $('nInputs').title = words ? '' : pending ? `${pending} not organized yet` : '';
  $('nRules').textContent = tabNum(words ? searchCount('rules') : S.items.filter(it => it.type === 'rule' && !it.merged_into && !it.archived && it.status !== 'dropped').length);
  $('nArchTab').textContent = tabNum(words ? searchCount('archive') : S.items.filter(it => it.archived && !it.merged_into).length);
  fitTabs();
  if (desk() && S.project) renderProjBar();  // the desktop's tabs say the same
}
const openCount = () => S.items.filter(it => !it.merged_into && inTab(it, 'items') && !CLOSED(it.status)).length;  // B130: one meaning of "open"
function visible(tab = U.tab) {
  const words = U.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  // Items shows the work, plus rules an agent proposed: they wait on you too (T65).
  const okTab = it => tab === 'rules' ? it.type === 'rule' && !it.archived : tab === 'archive' || it.type !== 'rule' || (it.status === 'proposed' && !it.archived);
  const okStatus = it => tab === 'rules' ? U.status === 'all' || it.status === U.status : tab === 'archive' ? it.archived && (U.status === 'all' || U.status === 'archived' || it.status === U.status)
    : U.status === 'archived' ? it.archived
    : !it.archived && (U.status === 'all' || (U.status === 'active' ? !CLOSED(it.status) : U.status === 'wait' ? needsYou(it) : it.status === U.status));
  return S.items.filter(it => !it.merged_into && okTab(it)
    && (U.type === 'all' || tab === 'rules' || it.type === U.type) && (U.when === 'all' || it.when === U.when) && (U.pri === 'all' || it.pri === U.pri) && okStatus(it) && words.every(w => hay(it).includes(w)))
    .sort((a, b) => a.pri.localeCompare(b.pri) || a.n - b.n);  // same priority: oldest first, like /next
}
// The agent's queue in the order it takes the work (/next): now before later, in progress first, then P0→P3, oldest first.
const queueOrder = (a, b) => (a.when !== 'now') - (b.when !== 'now') || (a.status !== 'doing') - (b.status !== 'doing') || a.pri.localeCompare(b.pri)
  || (a.rank == null) - (b.rank == null) || (a.rank || 0) - (b.rank || 0) || a.n - b.n;  // same priority: what you put next first (F197), then oldest
// The queue is one thing wherever it is counted (S3): the band in Items and This project's Agents both count every item in
// it and say how many of them are later (shown, but agents take them only once they are back to now).
const inQueue = it => !it.merged_into && !it.archived && it.type !== 'rule' && !needsYou(it) && !CLOSED(it.status);
const laterOf = q => q.filter(it => it.when === 'later').length;

// An item's own files: those of the inputs it was made from. A reply on it keeps its files to itself, in the thread
// with its words (B224), so they don't show again among the item's files.
function filesOf(it) {
  const replies = new Set(it.thread.filter(x => x.by === 'you' && x.src).map(x => x.src)), seen = new Set(), out = [];
  for (const rid of it.srcs) if (!replies.has(rid)) for (const f of byR.get(rid)?.files || []) if (!seen.has(f.f)) { seen.add(f.f); out.push(f); }
  return out;
}

const WAVE = 'h-2 h-3 h-4 h-2 h-5 h-3 h-2 h-4 h-3 h-2 h-1.5 h-3 h-4 h-2'.split(' ').map(h => `<span class="w-[2px] rounded-full bg-zinc-300 dark:bg-zinc-600 ${h}"></span>`).join('');
// T230 #1: pictures and files in one row you can slide (faded at the right when there are more), voice notes in a row
// of their own below, so tall pictures and short voice bars never sit side by side
function fileRows(files, gid, size, cls = '') {
  const audio = files.filter(f => (f.mime || '').startsWith('audio/')), rest = files.filter(f => !(f.mime || '').startsWith('audio/'));
  return `<div class="${cls} flex flex-col gap-2">${rest.length ? `<div class="flex items-end gap-2 overflow-x-auto lg:scrollbar-thin ${rest.length > 3 ? '[mask-image:linear-gradient(to_right,black_85%,transparent)]' : ''}">${thumbs(rest, gid, size)}</div>` : ''}${audio.length ? `<div class="flex flex-wrap gap-2">${thumbs(audio, gid + 'a', size)}</div>` : ''}</div>`;
}
function thumbs(files, gid, size = 'size-20') {
  const imgs = files.filter(f => (f.mime || '').startsWith('image/'));
  groups.set(gid, imgs.map(f => f.f));
  return files.map(f => (f.mime || '').startsWith('audio/')
    ? `<button data-act="play" data-src="${P}f/${encodeURIComponent(f.f)}" aria-label="Play ${esc(f.name)}" class="flex h-11 shrink-0 items-center gap-2 self-end rounded-full border border-zinc-200 pr-3.5 pl-1.5 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
        <span data-icon class="grid size-8 place-items-center rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">${ico('play', 'size-4')}</span><span class="flex h-5 items-center gap-[2px]">${WAVE}</span><span data-time class="font-mono tabular-nums">Voice</span></button>${P_CACHE.prefs?.tidy !== false ? `<button data-act="as-said" data-f="${esc(f.f)}" class="${HIT} h-8 shrink-0 self-end rounded-lg px-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">As said</button>` : ''}`
    : (f.mime || '').startsWith('image/')
    ? `<button data-act="view" data-g="${gid}" data-f="${esc(f.f)}" title="${esc(f.name)}" class="${size} shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 hover:brightness-95 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:brightness-110"><img src="${P}f/${encodeURIComponent(f.f)}" alt="${esc(f.name)}" loading="lazy" class="size-full object-contain"></button>`
    : `<a href="${P}f/${encodeURIComponent(f.f)}" target="_blank" rel="noopener" class="flex h-11 max-w-56 shrink-0 items-center gap-1.5 self-end rounded-xl border border-zinc-200 px-3 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">${ico('file', 'size-4')}<span class="truncate">${esc(f.name)}</span></a>`).join('');
}
// Voice notes play in place: one player for the page; each chip shows play / pause and the time.
const AUD = {el: null, src: ''};
function playAudio(b) {
  const src = b.dataset.src;
  if (AUD.src === src && !AUD.el.paused) return AUD.el.pause();
  if (AUD.src !== src) {
    AUD.el?.pause();
    AUD.el = new Audio(src); AUD.src = src;
    for (const ev of ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata']) AUD.el.addEventListener(ev, audioUi);
  }
  AUD.el.play().catch(() => toast('Could not play this recording'));
}
function audioUi() {
  for (const b of document.querySelectorAll('[data-act="play"]')) {
    const on = b.dataset.src === AUD.src, playing = on && !AUD.el.paused;
    b.querySelector('[data-icon]').innerHTML = ico(playing ? 'pausefill' : 'play', 'size-4');
    const d = AUD.el.duration, t = playing || (AUD.el.currentTime && !AUD.el.ended) ? AUD.el.currentTime : isFinite(d) ? d : null;  // recorded webm often has no length until played through
    if (on && t !== null) b.querySelector('[data-time]').textContent = clock(1000 * t);
  }
}

const SOFT = t => `<span class="rounded bg-zinc-100 px-1.5 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">${t}</span>`;
const cnt = (icon, n, label) => `<span class="flex items-center gap-1" title="${label}">${ico(icon, 'size-3.5')}${n}</span>`;
// What waits on you, in the word its button says (Answer, Reply, Approve, Accept). A row or card with that button shows
// no label beside it: the button says it, the band says it waits; where no button shows, this word does (T225 #9).
const needWord = it => needsYou(it) ? rowAction(it)[1] : '';
// Your words on an item: what you wrote there, or what the organizer filed there from one of your inputs (as your
// words, your decision or your idea). Any of them answers a question, picked choices or not (B163); the server's
// user_word is the same rule.
const userWord = x => x.by === 'you' || (x.by === 'org' && ['say', 'decide', 'propose'].includes(x.kind) && !!x.src);
const lastAgentMsg = it => [...it.thread].reverse().find(x => !userWord(x));
// One plain line of what the agent said: the conclusion it leads with (T58 #5).
const oneLine = t => (String(t || '').split('\n').map(l => l.replace(/^\s*(#+|>|[-*+]\s+(\(|\[)[ xX]?(\)|\])|[-*+]|\d+[.)])\s*/, '').replace(/[*`]/g, '').trim()).find(Boolean) || '');
const excerpt = it => oneLine(it.wait ? it.wait.text : it.status === 'review' ? lastAgentMsg(it)?.text : (lastAgentMsg(it)?.text || it.body));

// Desktop: the selected row (aria-current) is tinted, others on hover; hovering shows the phone's swipe actions as
// buttons. A row answers a press too (B159, T160); the short delay, for fingers only, keeps rows from flashing while
// a finger scrolls the list.
const rowTint = () => 'lg:hover:bg-zinc-50 dark:lg:hover:bg-zinc-900/70 lg:aria-[current=true]:bg-blue-50 dark:lg:aria-[current=true]:bg-blue-400/10 pointer-coarse:transition-colors pointer-coarse:delay-75 data-pressed:bg-zinc-100 lg:data-pressed:bg-zinc-100 dark:data-pressed:bg-zinc-900 dark:lg:data-pressed:bg-zinc-900';
const rowCur = it => U.open === it.n ? 'aria-current="true"' : '';
const ACT_KEY = {Done: 'D', Accept: 'A', Approve: 'A', Archive: 'E', Unarchive: 'E', Later: 'L', 'Back to now': 'L', "Won't do": 'W', 'Not yet': 'N',
  Start: 'S then 3', Pause: 'S then 2', Reopen: 'S then 2', Retire: 'W', Reactivate: 'D'};  // S then a digit: the ⋯ menu's status (T113 B30, A16)
const ACT_TONE = {Done: 'text-emerald-600 dark:text-emerald-400', Accept: 'text-emerald-600 dark:text-emerald-400', Approve: 'text-blue-600 dark:text-blue-400', Archive: 'text-emerald-600 dark:text-emerald-400', Start: 'text-blue-600 dark:text-blue-400', "Won't do": 'text-red-600 dark:text-red-400',
  Retire: 'text-red-600 dark:text-red-400', Reactivate: 'text-blue-600 dark:text-blue-400'};
// On the desktop the actions keep one order on every row (B128): forward · progress · Won't do · Later; the ones that
// do not apply are left out, with no gaps (B135). Rows waiting on your answer offer only Later: the pill answers.
// (The phone's swipes keep their own order.)
function deskSlots(it, needs) {
  const later = it.when === 'now' ? ['when', 'later', 'Later'] : ['when', 'now', 'Back to now'], drop = ['status', 'dropped', "Won't do"];
  if (it.archived) return [['archived', 'false', 'Unarchive'], null, null, null];
  if (it.wait) return [null, ['status', 'done', 'Done'], drop, later];  // T268: an agent asking doesn't stop you finishing or dropping it
  if (it.type === 'rule') return it.status === 'proposed' ? [needs ? null : ['status', 'open', 'Approve'], null, drop, null]  // a rule's own words (T113 B21)
    : it.status === 'open' ? [null, null, ['status', 'dropped', 'Retire'], null] : [['archived', 'true', 'Archive'], ['status', 'open', 'Reactivate'], null, null];
  const fwd = needs ? null : swipeRight(it);
  const prog = it.status === 'open' ? ['status', 'doing', 'Start'] : it.status === 'doing' ? ['status', 'open', 'Pause'] : it.status === 'review' ? ['reopen', '', 'Not yet'] : CLOSED(it.status) ? ['status', 'open', 'Reopen'] : null;
  return [fwd, prog, ['open', 'doing', 'proposed'].includes(it.status) ? drop : null, CLOSED(it.status) ? null : later];
}
function rowActs(it, needs = false) {
  const acts = deskSlots(it, needs);
  return `<div class="hidden shrink-0 items-center gap-0.5 self-center lg:group-hover:flex">${acts.filter(Boolean).map(a => a[0] === 'reopen'
    ? `<button data-act="reopen" data-n="${it.n}" title="Not yet · N" aria-label="Not yet" class="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:bg-zinc-800">${ico('reopen', 'size-[18px]')}</button>`
    : (([f, v, label]) => `<button data-act="swipe" data-n="${it.n}" data-f="${f}" data-v="${v}" title="${label}${ACT_KEY[label] ? ' · ' + ACT_KEY[label] : ''}" aria-label="${label}" class="grid size-8 place-items-center rounded-lg hover:bg-zinc-200/70 dark:hover:bg-zinc-800 ${ACT_TONE[label] || 'text-zinc-500 dark:text-zinc-400'}">${ico(ACT_ICON[label], 'size-[18px]')}</button>`)(a)).join('')}</div>`;
}

// A row you just acted on stays where it was, as one quiet line with Undo, while the pointer is over the list (or
// for 3 s after a key, or a finger's tap), so the next row never slides under a second click (B124, B148). Then the
// list rearranges. On a phone the line lets a double tap's second tap go by, so it neither opens nor undoes.
const LIST = {in: false, t: 0, until: 0, sig: '', at: null};  // at: the rows when the open item was last among them (T113 A14)
const listSig = () => [U.tab, U.q, U.type, U.when, U.status, U.pri].join('|');
function holding() {
  if (!U.settle.size) return false;
  if (LIST.sig !== listSig()) { U.settle.clear(); return false; }  // another search, filter or tab: show the list as it is now
  return !!$('list').querySelector('article[data-n]');
}
function holdRow(n, said, undo) {
  U.settle.set(n, {said, undo}); LIST.sig = listSig();
  LIST.until = Date.now() + (LIST.in ? 800 : 3000);
  clearTimeout(LIST.t); LIST.t = setTimeout(releaseList, LIST.until - Date.now());
}
function releaseList() {
  if (!U.settle.size || (LIST.in && Date.now() < LIST.until + 60000)) return;  // still over the list: wait until it leaves
  U.settle.clear(); renderItems();
}
function syncNeeds() {  // while rows hold still, the Needs you count and Go through follow at once (T225 #10)
  const z = $('list').querySelector('[data-zone="needs"]');
  if (!z) return;
  const n = visible().filter(needsYou).length;
  z.querySelector('[data-count]').textContent = n;
  z.querySelector('[data-act="go-through"]')?.toggleAttribute('hidden', !n);
}
function patchList() {
  for (const a of $('list').querySelectorAll('article[data-n]')) {
    const n = Number(a.dataset.n), it = byN.get(n), s = U.settle.get(n), row = a.querySelector('[data-act="open"]');
    if (s && it && !a.dataset.settled) {
      const h = a.offsetHeight - 1;
      a.dataset.settled = Date.now();
      a.innerHTML = `<div data-act="open" data-n="${n}" class="flex min-h-[${h}px] cursor-pointer items-center gap-3 py-2 pr-3 pl-4 text-sm text-zinc-500 hover:bg-zinc-50 data-pressed:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900/70 dark:data-pressed:bg-zinc-900">${stateIcon(it.status, statusName(it))}<span class="min-w-0 flex-1 truncate"><span class="mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[it.type]}">${code(n)}</span>${esc(s.said)}</span>${desk() ? `<button data-act="settle-undo" data-n="${n}" class="h-8 shrink-0 rounded-lg px-2.5 text-[13px] font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10">Undo</button>` : ''}</div>`;  // the phone's Undo is the toast's, at the thumb: one Undo (T225 #10)
    } else if (row && !a.dataset.settled) { if (U.open === n) row.setAttribute('aria-current', 'true'); else row.removeAttribute('aria-current'); }
  }
}
$('list').addEventListener('pointerenter', () => { LIST.in = true; });
$('list').addEventListener('pointerleave', () => {
  LIST.in = false;
  if (U.settle.size) { clearTimeout(LIST.t); LIST.t = setTimeout(releaseList, Math.max(0, LIST.until - Date.now())); }
  if (U.archHold && !U.undoArch) { U.archHold = null; renderItems(); }  // the place Archive N kept (B3)
});

// A row in a list: state icon, coloured code and title, one meta line. Tapping anywhere opens the item (B62);
// the image and the fold arrow keep their own taps. Nested subitems hang off an elbow line.
function itemRow(it, depth = 0, group = [], band = '') {  // band: the band it is in ('later': no Later chip there, T225 #11)
  const c = code(it.n), files = filesOf(it), children = kids.get(it.n) || [], closed = CLOSED(it.status), talk = it.thread.length, docs = docsOf(it.n).length;
  // Images count as images, other files as files; a voice note is not counted: its words are in the item (B223).
  const isImg = f => (f.mime || '').startsWith('image/'), imgs = files.filter(isImg).length, other = files.filter(f => !isImg(f) && !(f.mime || '').startsWith('audio/')).length;
  const meta = [
    it.type === 'rule' ? '' : `<span class="${PRI_TEXT[it.pri]}">${it.pri}</span>`,
    needsYou(it) ? `<span class="font-semibold text-amber-700 dark:text-amber-400">${needWord(it)}</span>` : it.reply && !closed ? '<span class="text-emerald-700 dark:text-emerald-400">Replied</span>' : '',
    hasDraft(c) ? DRAFT_MARK() : '',  // T113 B24: a reply you have not sent yet
    it.status === 'doing' ? '<span class="text-blue-600 dark:text-blue-400">In progress</span>' : closed && band !== 'retired' ? `<span>${statusName(it)}</span>` : '',  // the Retired band says it once (T225 #11 follow-up)
    it.archived && U.tab !== 'archive' ? SOFT('Archived') : '',
    it.when === 'later' && !closed && band !== 'later' ? SOFT('Later') : '',
    it.rank != null && inQueue(it) && it.when === 'now' ? '<span class="font-semibold text-blue-600 dark:text-blue-400" title="You put it first of its priority: agents take it next">Next</span>' : '',  // F197
    it.parent && !depth ? `<span>↳ ${code(it.parent)}</span>` : '',  // nested rows already hang under it
    children.length ? cnt('subitems', `${children.filter(k => CLOSED(k.status)).length}/${children.length}`, 'Subitems finished') : '',
    talk ? cnt('comment', talk, plural(talk, 'comment')) : '',
    docs ? cnt('doc', docs, plural(docs, 'doc')) : '',  // a document and a file each have their own icon (T225 #8)
    imgs ? cnt('image', imgs, plural(imgs, 'image')) : '',
    other ? cnt('clip', other, plural(other, 'file')) : '',
    it.status === 'doing' ? workerMark(it) : '',  // F194: which agent is on it, and whether it went quiet; last, so on a full line it is what shortens (T225 #8)
  ].join('');
  const img = files.find(f => (f.mime || '').startsWith('image/'));
  const foldable = group.some(k => k.parent === it.n);  // its subitems are in this list
  // B254: a subitem is set in 24 px a level, with no line beside it
  const top = `<div data-act="open" data-n="${it.n}" ${rowCur(it)} class="group relative flex cursor-pointer items-start gap-3 py-2.5 pr-3 pl-${4 + 6 * depth} ${closed ? 'opacity-55' : ''} ${rowTint(it)}">
      ${stateIcon(it.status, statusName(it))}
      <div class="min-w-0 flex-1">
        <p class="line-clamp-2 text-[15px] leading-snug font-medium lg:line-clamp-1 ${closed ? 'line-through decoration-zinc-400' : ''}"><span class="mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[it.type]}">${c}</span>${esc(it.title)}</p>
        ${meta ? `<div class="mt-1 flex items-center gap-x-2.5 overflow-hidden text-xs font-medium whitespace-nowrap text-zinc-500 dark:text-zinc-400">${meta}</div>` : ''}
      </div>
      ${it.type === 'rule' ? '' : rowActs(it)}
      ${img ? `<button data-act="view" data-g="row${it.n}" data-f="${esc(img.f)}" aria-label="View image" class="-my-0.5 grid size-11 shrink-0 place-items-center rounded-lg hover:brightness-95 dark:hover:brightness-110">${(groups.set('row' + it.n, [img.f]), '')}<img src="${P}f/${encodeURIComponent(img.f)}" alt="" loading="lazy" class="size-10 rounded-lg border border-zinc-200 bg-zinc-50 object-cover dark:border-zinc-700 dark:bg-zinc-900"></button>` : ''}
      ${foldable ? `<button data-act="fold" data-n="${it.n}" aria-expanded="${!U.folded.has(it.n)}" aria-label="${U.folded.has(it.n) ? 'Show' : 'Hide'} subitems" class="-my-2 -mr-1 grid size-11 shrink-0 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300">${ico(U.folded.has(it.n) ? 'right' : 'down', 'size-4', '2')}</button>` : ''}
    </div>`;
  return `<article data-n="${it.n}" class="relative border-b border-zinc-100 data-dragging:opacity-40 data-[drop=before]:shadow-[inset_0_2px_0_0_var(--color-blue-500)] data-[drop=after]:shadow-[inset_0_-2px_0_0_var(--color-blue-500)] data-[drop=into]:bg-blue-50 data-[drop=into]:ring-2 data-[drop=into]:ring-blue-500 data-[drop=into]:ring-inset dark:border-zinc-800/70 dark:data-[drop=into]:bg-blue-400/10">${it.type === 'rule' && desk() ? top : swipeRow(it, top)}</article>`;
}

// A row that waits on you (T65 "Needs you first"): an amber bar, what the agent said in one line, and the one
// action right there on the thumb side.
// Each kind of "needs you" has its own color and icon (B96), on the row's pill, its label and the card's main
// button: Accept green (it becomes done), Approve blue (work can start), Answer amber (a question), Reply red (stuck).
const NEED = {
  accept: {icon: 'check', pill: 'bg-emerald-100 text-emerald-900 ring-emerald-300/80 dark:bg-emerald-400/15 dark:text-emerald-100 dark:ring-emerald-400/30', text: 'text-emerald-700 dark:text-emerald-400', btn: 'bg-emerald-600 text-white hover:brightness-95 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:brightness-110'},
  approve: {icon: 'thumb', pill: 'bg-blue-100 text-blue-900 ring-blue-300/80 dark:bg-blue-400/15 dark:text-blue-100 dark:ring-blue-400/30', text: 'text-blue-700 dark:text-blue-400', btn: 'bg-blue-600 text-white hover:brightness-95 dark:bg-blue-500 dark:text-blue-950 dark:hover:brightness-110'},
  answer: {icon: 'ask', pill: 'bg-amber-100 text-amber-950 ring-amber-300/80 dark:bg-amber-400/15 dark:text-amber-100 dark:ring-amber-400/30', text: 'text-amber-700 dark:text-amber-400', btn: 'bg-amber-500 text-amber-950 hover:brightness-95 dark:bg-amber-400 dark:text-amber-950 dark:hover:brightness-110'},
  reply: {icon: 'reply', pill: 'bg-rose-100 text-rose-900 ring-rose-300/80 dark:bg-rose-400/15 dark:text-rose-100 dark:ring-rose-400/30', text: 'text-rose-700 dark:text-rose-400', btn: 'bg-rose-600 text-white hover:brightness-95 dark:bg-rose-500 dark:text-rose-950 dark:hover:brightness-110'},
};
const ACTION_PILL = v => `inline-flex h-8 min-w-18 items-center justify-center gap-1 rounded-full pr-3 pl-2.5 text-[13px] font-semibold ring-1 ring-inset ${NEED[v].pill}`;
const rowAction = it => it.wait ? (it.wait.kind === 'block' ? ['reply', 'Reply'] : ['answer', 'Answer']) : it.status === 'proposed' ? ['approve', 'Approve'] : ['accept', 'Accept'];
function needsRow(it) {
  const [v, label] = rowAction(it);
  const top = `<div data-act="open" data-n="${it.n}" ${rowCur(it)} class="group relative flex cursor-pointer items-center gap-2.5 py-2.5 pr-3 pl-4 ${rowTint(it)}">
      <span class="absolute inset-y-0 left-0 w-1 bg-amber-500 dark:bg-amber-400"></span>
      <span class="self-start">${stateIcon(it.status, statusName(it))}</span>
      <div class="min-w-0 flex-1">
        <p class="line-clamp-2 text-[15px] leading-snug font-medium lg:line-clamp-1"><span class="mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[it.type]}">${code(it.n)}</span>${esc(it.title)}</p>
        <div class="mt-1 flex min-w-0 items-center gap-2 text-xs font-medium">
          ${it.type === 'rule' ? '' : `<span class="shrink-0 ${PRI_TEXT[it.pri]}">${it.pri}</span>`}${hasDraft(code(it.n)) ? DRAFT_MARK() : ''}${it.when === 'later' ? `<span class="shrink-0">${SOFT('Later')}</span>` : ''}${it.parent ? `<span class="shrink-0 text-zinc-500 dark:text-zinc-400">↳ ${code(it.parent)}</span>` : ''}
          <span class="min-w-0 truncate font-normal text-zinc-500 dark:text-zinc-400">${esc(excerpt(it))}</span>
        </div>
      </div>
      ${it.type === 'rule' ? '' : rowActs(it, true)}
      <button data-act="row-act" data-n="${it.n}" data-v="${v}" title="${label} · A" class="group/pill -my-1 grid h-11 shrink-0 place-items-center"><span class="${ACTION_PILL(v)} group-hover/pill:brightness-95 dark:group-hover/pill:brightness-125">${ico(NEED[v].icon, 'size-3.5', '2.25')}${label}</span></button>
    </div>`;
  return `<article data-n="${it.n}" class="relative border-b border-zinc-100 data-dragging:opacity-40 data-[drop=before]:shadow-[inset_0_2px_0_0_var(--color-blue-500)] data-[drop=after]:shadow-[inset_0_-2px_0_0_var(--color-blue-500)] data-[drop=into]:bg-blue-50 data-[drop=into]:ring-2 data-[drop=into]:ring-blue-500 data-[drop=into]:ring-inset dark:border-zinc-800/70 dark:data-[drop=into]:bg-blue-400/10">${it.type === 'rule' && desk() ? top : swipeRow(it, top)}</article>`;
}

// A group header in a list: Needs you (amber), the agent's queue, finished work, and the rule groups.
function zone(kind, label, n, right = '') {
  const needs = kind === 'needs';
  const mark = needs ? '<span class="size-2 shrink-0 rounded-full bg-amber-500 ring-3 ring-amber-500/20 dark:bg-amber-400"></span>'
    : kind === 'rules' ? '<span class="mx-1 size-2 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-500"></span>'
    : kind === 'later' ? ico('clock', 'size-4 text-zinc-500 dark:text-zinc-400', '2')
    : stateIcon({queue: 'doing', done: 'done', retired: 'dropped', archived: 'done'}[kind], label, 'size-4');
  // F210: every group header has the same background, clearly darker than the rows; Needs you keeps its amber dot and count
  return `<div data-zone="${kind}" class="flex h-9 items-center gap-2 border-y border-zinc-200 bg-zinc-100 pr-1 pl-4 dark:border-zinc-700/70 dark:bg-zinc-800">
    ${mark}<h2 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">${label}</h2><span data-count class="grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${needs ? 'bg-amber-500 text-white dark:bg-amber-400 dark:text-amber-950' : 'bg-zinc-200/80 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}">${n}</span>${right}
  </div>`;
}
const goThroughBtn = () => `<button data-act="go-through" class="-my-1 ml-auto flex h-11 items-center gap-0.5 rounded-full pr-2 pl-3 text-[13px] font-semibold text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-400/15">Go through${ico('right', 'size-4', '2.25')}</button>`;
// T260: no Keep going switch: agents always take the next item
const archiveAllBtn = n => `<button data-act="archive-all" class="group/arch -my-1 ml-auto flex h-11 items-center pr-2"><span class="inline-flex h-8 items-center gap-1.5 rounded-full bg-emerald-50 px-3 text-[13px] font-semibold text-emerald-800 ring-1 ring-emerald-600/20 ring-inset group-hover/arch:bg-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/25 dark:group-hover/arch:bg-emerald-400/20">${ico('archive', 'size-4')}Archive ${n}</span></button>`;

// Phone quick actions: swipe right = the natural next step, swipe left = reveal buttons. Touch only.
// Swipe right all the way: the step forward you take most (F51). Archived items have none. On an item that waits on
// your answer the step forward is that answer, as on its pill and the desktop's A: Answer or Reply, never Done (B147).
function swipeRight(it) {
  return it.archived ? null
    : it.type === 'rule' && it.status === 'open' ? null  // an active rule has no step forward; Retire is a swipe left (B158)
    : it.wait ? ['need', ...rowAction(it)]
    : it.status === 'proposed' ? ['status', 'open', 'Approve', 'approved']
    : it.status === 'review' ? ['status', 'done', 'Accept', 'accepted']
    : CLOSED(it.status) ? ['archived', 'true', 'Archive', 'archived']
    : ['status', 'done', 'Done', 'done'];
}
// Swipe left: the way back. The one you want most sits at the edge, under your finger; a few more beside it. An item
// that waits on your answer keeps Done here, last, out of the way of the answer (B147).
function swipeLeft(it) {
  const later = it.when === 'now' ? ['when', 'later', 'Later'] : ['when', 'now', 'Back to now'], drop = ['status', 'dropped', "Won't do"];
  const done = it.wait ? [['status', 'done', 'Done']] : [];
  if (it.type === 'rule' && !it.archived) return it.status === 'proposed' ? [drop] : it.status === 'open' ? [['status', 'dropped', 'Retire']] : [['status', 'open', 'Reactivate']];  // a rule: no Later, no Start (B158)
  return it.archived ? [['archived', 'false', 'Unarchive']]
    : it.status === 'proposed' ? [later, drop]
    : it.status === 'review' ? [later, ['status', 'doing', 'Not yet']]
    : CLOSED(it.status) ? [['status', 'open', 'Reopen']]
    : it.status === 'doing' ? [drop, later, ['status', 'open', 'Pause'], ...done]
    : [['status', 'doing', 'Start'], drop, later, ...done];
}
const openKids = n => (kids.get(n) || []).filter(k => !CLOSED(k.status)).length;  // a parent done before its subitems says so (B147)
const ACT_ICON = {Approve: 'thumb', Accept: 'check', Done: 'done', Archive: 'archive', Later: 'clock', 'Back to now': 'clock', "Won't do": 'ban', 'Not yet': 'reopen', Pause: 'pause', Start: 'start', Reopen: 'reopen', Unarchive: 'archive', Answer: 'ask', Reply: 'reply', Retire: 'ban', Reactivate: 'reopen'};
const ACT_BG = {Start: 'bg-blue-600 dark:bg-blue-500', "Won't do": 'bg-red-600 dark:bg-red-500', Done: 'bg-emerald-600 dark:bg-emerald-500'};
function swipeRow(it, inner) {
  const fwd = swipeRight(it), back = swipeLeft(it), left = fwd?.[1] === 'done' ? openKids(it.n) : 0;
  return `<div class="relative overflow-hidden">
    <div data-swipe-left hidden class="absolute inset-0 flex items-center gap-2 pl-6 text-sm font-semibold ${fwd && FWD_NEED[fwd[2]] ? NEED[FWD_NEED[fwd[2]]].btn : 'bg-emerald-600 text-white dark:bg-emerald-500'}">${fwd ? ico(ACT_ICON[fwd[2]], 'size-5') + fwd[2] : ''}${left ? `<span class="font-normal">· ${plural(left, 'subitem')} still open</span>` : ''}</div>
    <div data-swipe-right hidden class="absolute inset-y-0 right-0 flex">${back.map(([f, v, label], i) => `<button data-act="${label === 'Not yet' ? 'reopen' : 'swipe'}" data-n="${it.n}" data-f="${f}" data-v="${v}" class="flex w-19 flex-col items-center justify-center gap-1 text-xs font-semibold text-white ${ACT_BG[label] || (i % 2 ? 'bg-zinc-500 dark:bg-zinc-600' : 'bg-zinc-600 dark:bg-zinc-700')}">${ico(ACT_ICON[label], 'size-5')}${label}</button>`).join('')}</div>
    <div data-swipe="${it.n}" class="relative touch-pan-y bg-white transition-transform duration-200 select-none [-webkit-touch-callout:none] dark:bg-zinc-950">${inner}</div>
  </div>`;
}

const SW = {el: null, open: null, swallow: 0};
function swipeTo(el, x) {
  el.style.transform = x ? `translateX(${x}px)` : '';
  if (!x) setTimeout(() => {  // hide the layers once the row has slid back, so their edges never show
    if (el.style.transform) return;
    el.parentElement?.querySelectorAll('[data-swipe-left], [data-swipe-right]').forEach(l => { l.hidden = true; });
  }, 250);
}
function closeSwipe() { if (SW.open) { swipeTo(SW.open, 0); SW.open = null; } }
// A finger on a row (B237): after it has moved 10 px the gesture is one thing for good. Within 45° of level it is the
// row's swipe: from then on only the sideways part counts, so a thumb that drifts up or down still finishes it, and
// the list neither scrolls nor takes the touch back (touch events, so a move can be kept from the browser). Steeper,
// it is the list's scroll and the row stays put. The screen edge belongs to the phone's "back"; the drawer is not
// touched by any of this.
function swipeStart(e) {
  SW.el = null;
  const t = e.touches[0];
  if (e.touches.length !== 1 || t.clientX <= EDGE_W || DR.open) return;
  const el = e.target.closest('[data-swipe]');
  if (!el) return;
  if (SW.open && SW.open !== el) closeSwipe();
  // Show nothing new until the finger really moves sideways: iPhone Safari treats a tap that reveals content
  // as a hover and never sends the click, so the row would not open (B62).
  const reveal = SW.open === el ? el.parentElement.querySelector('[data-swipe-right]').offsetWidth : 0;
  Object.assign(SW, {el, x0: t.clientX, y0: t.clientY, mode: null, dx: 0, reveal, base: -reveal});
}  // a finger held still does nothing special: a tap opens the item, which does all a preview did (T203)
function swipeMove(e) {
  if (!SW.el || e.touches.length !== 1) return;
  const t = e.touches[0], dx = t.clientX - SW.x0, dy = t.clientY - SW.y0;
  if (!SW.mode) {
    if (Math.hypot(dx, dy) < 10) return;
    SW.mode = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    if (SW.mode === 'v') { SW.el = null; return; }
    SW.el.style.transition = 'none';
    const right = SW.el.parentElement.querySelector('[data-swipe-right]');
    right.hidden = false; SW.reveal = right.offsetWidth;
  }
  if (e.cancelable) e.preventDefault();  // a sideways swipe: the list doesn't scroll under it
  SW.dx = Math.max(-SW.reveal - 30, Math.min(swipeRight(byN.get(Number(SW.el.dataset.swipe))) ? SW.el.offsetWidth * 0.7 : 0, SW.base + dx));
  SW.el.parentElement.querySelector('[data-swipe-left]').hidden = SW.dx < 0;
  SW.el.parentElement.querySelector('[data-swipe-right]').hidden = SW.dx > 0;
  swipeTo(SW.el, SW.dx);
}
async function swipeEnd() {
  const el = SW.el;
  if (!el) return;
  SW.el = null;
  if (SW.mode !== 'h') return;
  SW.swallow = Date.now();
  el.style.transition = '';
  const n = Number(el.dataset.swipe), it = byN.get(n);
  if (SW.dx > el.offsetWidth * 0.33) {
    const [f, v] = swipeRight(it);
    if (f === 'need') { swipeTo(el, 0); return ACT['row-act']({dataset: {n: String(n), v}}); }  // the answer, as its pill (B147)
    swipeTo(el, el.offsetWidth);
    setTimeout(() => change(n, f, f === 'archived' ? v === 'true' : v), REDUCE.matches ? 0 : 180);  // the row slides out first
  } else if (SW.dx < -SW.reveal / 2) { swipeTo(el, -SW.reveal); SW.open = el; }
  else { swipeTo(el, 0); if (SW.open === el) SW.open = null; }
}

// ---------------------------------------------------------------- documents
// A document is a note: its first line is the title. Agents write most of them; the user reviews them on a
// phone by picking paragraphs (tap), selecting text (long press) or circling an area, then commenting.

const docsOf = n => (S.docs || []).filter(d => d.n === n);
const docById = d => (S.docs || []).find(x => x.d === d);
function inlineMd(s, gid = '') {
  const codes = [], links = [];  // `code` and finished links are set aside until the rest is done
  const keep = html => `\u0001${links.push(html) - 1}\u0001`;
  const emph = t => t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return emph(esc(s)
    .replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => {  // ![alt](f12-a.png) for a file uploaded to Taska, or a web address
      if (/^https?:\/\//.test(src)) return keep(`<a href="${src}" target="_blank" rel="noopener"><img src="${src}" alt="${alt}" loading="lazy" class="my-1 max-h-96 max-w-full rounded-lg border border-zinc-200 dark:border-zinc-700"></a>`);
      if (gid) { if (!groups.has(gid)) groups.set(gid, []); groups.get(gid).push(src); }
      return keep(`<button data-act="view" data-g="${gid}" data-f="${src}" class="my-1 block max-w-full"><img src="${P}f/${encodeURIComponent(src)}" alt="${alt}" loading="lazy" class="max-h-96 max-w-full rounded-lg border border-zinc-200 dark:border-zinc-700"></button>`);
    })
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t, url) => keep(`<a href="${url}" target="_blank" rel="noopener" class="text-blue-600 underline underline-offset-2 dark:text-blue-400">${emph(t)}</a>`)))
    // A bare web address becomes a link wherever it stands, also right after Chinese text or punctuation (F76). It
    // ends at a space, a bracket or any character a URL can't hold; final punctuation stays outside the link.
    .replace(/https?:\/\/(?:&amp;|[A-Za-z0-9\-._~:/?#@!$+,;=%])+/g, m => {  // the text is escaped: & only as &amp;
      let url = m;
      while (/[.,;:!?]$/.test(url) && !/&amp;$/.test(url)) url = url.slice(0, -1);
      return `<a href="${url}" target="_blank" rel="noopener" class="break-all text-blue-600 underline decoration-blue-300 underline-offset-2 dark:text-blue-400">${url}</a>${m.slice(url.length)}`;
    })
    .replace(/\u0001(\d+)\u0001/g, (_, i) => links[i])
    .replace(/\u0000(\d+)\u0000/g, (_, i) => `<code class="rounded bg-zinc-100 px-1 font-mono text-[13px] dark:bg-zinc-800">${codes[i]}</code>`);
}
// Text the same way everywhere (messages, descriptions, inputs, comments): Markdown with paragraphs, lists,
// quotes, headings, code, links and images. Line breaks stay as written.
const rich = (text, gid = '', cls = '', form = 0, done = null) => `<div class="space-y-2 break-words [&_p]:leading-relaxed ${cls}">${mdHtml(text, gid, form, done)}</div>`;
// Choices in a question (F56): "- ( ) option" picks one, "- [ ] option" picks any. In the open question of item
// `form` they can be tapped and sent as the user's answer; elsewhere they just show.
const CHOICE = /^\s*[-*+]\s+(\(|\[)[ xX]?(\)|\])\s+/;
function choiceHtml(labels, multi, n, base, done = null) {  // done: the labels picked in the answer (I84)
  const picked = n && U.choice?.n === n ? U.choice.picked : new Set();
  return `<div class="space-y-1.5" role="group">${labels.map((l, k) => {
    const i = base + k, on = done ? done.includes(l.trim()) : picked.has(i);
    return `<button ${n ? `data-act="choice" data-n="${n}" data-i="${i}" data-multi="${multi ? 1 : ''}"` : 'disabled'} aria-pressed="${on}" class="group flex min-h-11 w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left text-[15px] leading-snug aria-pressed:border-blue-500 aria-pressed:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-900 dark:aria-pressed:border-blue-400 dark:aria-pressed:bg-blue-400/10 ${n ? 'hover:border-zinc-300 hover:bg-zinc-50 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/70' : ''} ${done && !on ? 'opacity-50' : ''}">
      <span class="grid size-5 shrink-0 place-items-center border-2 ${multi ? 'rounded-md' : 'rounded-full'} border-zinc-300 group-aria-pressed:border-blue-600 group-aria-pressed:bg-blue-600 group-aria-pressed:text-white dark:border-zinc-600 dark:group-aria-pressed:border-blue-400 dark:group-aria-pressed:bg-blue-400 dark:group-aria-pressed:text-zinc-900">${ico('check', 'size-3.5 invisible group-aria-pressed:visible', '3')}</span>
      <span class="min-w-0 flex-1">${inlineMd(l)}</span>${n && i < 9 ? KBD(i + 1) : ''}</button>`;
  }).join('')}</div>`;
}
const hasChoices = text => String(text || '').split('\n').some(l => CHOICE.test(l));
const sendAnswerBtn = (n, cls = 'w-full', key = false) => `<button data-act="choice-send" data-n="${n}" ${U.choice?.n === n && U.choice.picked.size ? '' : 'disabled'} class="${PRIMARY_BASE} ${NEED.answer.btn} ${cls}">Send answer${key ? KBD('⌘↵') : ''}</button>`;
const KIND_TAG = x => KIND[x.kind] ? `<span class="rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${x.kind === 'decide' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}">${KIND[x.kind]}</span>` : '';
// A long agent message shows its first line, the conclusion, until you ask for more (T58 #5). On the desktop it
// shows whole, in a box of limited height that scrolls; a fade at the bottom says there is more (F93).
function msgText(x, gid, form = 0, done = null) {
  const long = x.by !== 'you' && x.kind !== 'ask' && (x.text.length > 240 || x.text.trim().split('\n').length > 3);
  const open = U.moreMsgs.has(x.id), more = `data-act="more-msg" data-expand data-id="${x.id}"`;  // F106: a click on the words opens them
  if (long && desk() && !open) return `<div data-clip ${more} class="-mr-2 max-h-[min(24rem,50dvh)] cursor-pointer overflow-y-auto pr-2 lg:scrollbar-thin data-[over]:mask-b-from-80%">${rich(x.text, gid + 'md' + x.id, '', form, done)}</div>`;
  const folded = long && !desk() && !open;
  return (long ? `<div ${more} class="cursor-pointer">` : '') + rich(folded ? x.text.trim().split('\n')[0] : x.text, gid + 'md' + x.id, '', form, done) + (long ? '</div>' : '')
    + (long ? `<button data-act="more-msg" data-id="${x.id}" class="-mb-2 flex h-11 items-center text-sm font-medium text-blue-600 dark:text-blue-400">${folded ? 'Show more' : 'Show less'}</button>` : '');
}
// The fade shows while there is more below, and goes once you scroll to the end.
const clipFade = el => el.toggleAttribute('data-over', el.scrollTop + el.clientHeight < el.scrollHeight - 2);
document.addEventListener('scroll', e => { if (e.target.matches?.('[data-clip]')) clipFade(e.target); }, true);
// One message of a conversation, the same on the item page and in the preview: yours on the right in blue,
// an agent's on the left in a card under its name. An open question shows amber, with its options to tap.
// A question someone answered says so, with the picked options ticked (I84): the answer is your next message.
function answerOf(thread, x) {
  if (x.kind !== 'ask') return null;
  const a = thread.slice(thread.indexOf(x) + 1).find(userWord);
  return a ? a.text.split('\n').map(l => l.match(/^\s*✓\s*(.+)$/)?.[1]?.trim()).filter(Boolean) : null;
}
// An input you edited or added details to shows once, as it is now (B157, A24): the earlier version folds to a dim line,
// an edit says "edited", and added details show only what was added. Taska keeps every version for your agents.
function versions(thread) {  // message id -> {old, text, label}, for your words that changed since
  const by = new Map(), out = new Map(), plain = t => t.replace(/^r\d+ updated:\n/, '');
  for (const x of thread) if (x.by === 'you' && x.src && !x.change) { if (!by.has(x.src)) by.set(x.src, []); by.get(x.src).push(x); }  // S1: a note on an edit is not a version
  for (const list of by.values()) if (list.length > 1) {
    const info = list.map((x, i) => {
      const text = plain(x.text), prev = i ? plain(list[i - 1].text) : null;
      const added = prev !== null && text.startsWith(prev) && text.length > prev.length ? text.slice(prev.length).trim() : null;
      return {x, text: added ?? text, label: !i ? '' : added !== null ? 'added details' : 'edited', edit: i && added === null};
    });
    info.forEach((v, i) => out.set(v.x.id, {old: info.slice(i + 1).some(w => w.edit), text: v.text, label: v.label}));  // old: an edit since replaced it
  }
  return out;
}
// F220: what the thread knows about its messages: the questions an agent took back, and who read your last words.
function talkHtml(it, list, gid = '') {
  const th = it.thread, vers = versions(th), gone = new Set();
  th.forEach((x, i) => {  // a withdraw takes back the open question or block before it (nothing of yours in between)
    const q = x.kind === 'withdraw' && th.slice(0, i).reverse().find(y => y.kind === 'ask' || y.kind === 'block' || userWord(y));
    if (q && !userWord(q)) gone.add(q.id);
  });
  const mine = th.findLastIndex(x => x.by === 'you'), theirs = th.findLastIndex(x => x.by !== 'you' && x.by !== 'org'), t = mine >= 0 && Date.parse(th[mine].t);
  const readers = mine > theirs && it.read ? Object.entries(it.read).filter(([, ms]) => ms >= t).sort((a, b) => b[1] - a[1]) : [];  // no answer yet, but read after your words
  const read = readers.length ? {id: th[mine].id, names: readers.map(([n]) => whoName(n)), t: readers[0][1]} : null;
  return list.map(x => msgHtml(x, gid, 0, gone.has(x.id) ? null : answerOf(th, x), vers.get(x.id), {withdrawn: gone.has(x.id), read: read?.id === x.id ? read : null})).join('');
}
function msgHtml(x, gid, form = 0, done = null, ver = null, m = {}) {
  const you = x.by === 'you', src = you && x.src ? byR.get(x.src) : null, y = ver ? {...x, text: ver.text} : x;
  const strip = (files, g, size) => files?.length ? fileRows(files, g, size, you ? 'items-end max-w-full [&>div]:max-w-full' : 'mt-3') : '';  // T230: pictures and voice notes in their own rows
  if (you) return `<div ${x.src ? `data-src="${x.src}"` : ''} class="flex scroll-mb-4 flex-col items-end gap-1 rounded-2xl transition-colors duration-700 ${ver?.old ? 'opacity-60' : ''}">
      ${y.text ? `<div ${voiceAttr(src)} class="max-w-[85%] rounded-2xl rounded-tr-md bg-blue-600 px-4 py-2.5 text-[15px] leading-relaxed text-white dark:bg-blue-500 [&_a]:text-white [&_a]:decoration-white/60 [&_blockquote]:border-white/50 [&_blockquote]:text-white/85 [&_code]:bg-white/15 [&_code]:text-white [&_pre]:bg-white/15 [&_pre]:text-white [&_mark]:text-zinc-900">${ver?.old ? `<div class="line-clamp-2">${msgText(y, gid)}</div>` : msgText(y, gid)}</div>` : ''}
      ${ver?.old ? '' : strip(src?.files, gid + 't' + x.id)}
      <span class="px-1 text-[11px] text-zinc-400 dark:text-zinc-500">You · ${ver?.old ? 'earlier version · ' : ver?.label ? ver.label + ' · ' : ''}${when(x.t)}${x.edited && !ver?.old ? ` · ${src?.history?.length ? `<button data-act="input-history" data-id="${src.id}" title="See what changed" class="relative underline decoration-dotted underline-offset-2 after:absolute after:-inset-3 hover:text-zinc-700 dark:hover:text-zinc-300">edited ${when(x.edited)}</button>` : `edited ${when(x.edited)}`}` : ''}${src?.tr_wait ? ' · <span class="animate-pulse text-blue-600 dark:text-blue-400">transcribing the voice note…</span>' : ''}${m.read ? ` · <span title="${esc(m.read.names.join(', '))} read it ${when(new Date(m.read.t).toISOString())}" class="inline-flex items-center gap-0.5 font-medium text-zinc-500 dark:text-zinc-400">${ico('check', 'size-3', '2.5')}Read by ${esc(m.read.names.join(', '))}</span>` : ''}</span></div>`;
  if (x.kind === 'withdraw') return `<div class="flex items-start gap-2 px-1 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">${ico('undo', 'mt-0.5 size-3.5 shrink-0')}
      <div class="min-w-0 flex-1"><span class="font-medium text-zinc-600 dark:text-zinc-300">${esc(whoName(x.by))} took back its question</span> <span class="text-[11px] text-zinc-400 dark:text-zinc-500">${when(x.t)}</span>${x.text.trim() ? rich(x.text, gid + 'w' + x.id, 'mt-0.5') : ''}</div></div>`;  // F220: a line, not a message
  if (m.withdrawn) return `<div class="flex flex-col items-start gap-1.5 opacity-60">
      <div class="flex items-center gap-2 px-1 text-[11px] text-zinc-400 dark:text-zinc-500">${avatar(x.by)}<span class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">${esc(whoName(x.by))}</span><span class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase dark:bg-zinc-800 dark:text-zinc-400">Withdrawn</span><span>${when(x.t)}</span></div>
      <div class="w-full rounded-2xl rounded-tl-md border border-dashed border-zinc-300 px-4 py-3 text-[15px] leading-relaxed text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"><div class="line-clamp-2 line-through decoration-zinc-400 dark:decoration-zinc-500">${esc(oneLine(x.text))}</div></div></div>`;  // F220: taken back: dimmed, struck, two lines
  const card = form ? 'space-y-2.5 border-amber-200 bg-amber-50 p-3 text-zinc-900 dark:border-amber-400/25 dark:bg-amber-400/7 dark:text-zinc-100' : 'border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200';
  return `<div class="flex flex-col items-start gap-1.5">
      <div class="flex items-center gap-2 px-1 text-[11px] text-zinc-400 dark:text-zinc-500">${avatar(x.by)}<span class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">${esc(whoName(x.by))}</span>${done && !form ? `<span class="flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-800 uppercase dark:bg-emerald-400/15 dark:text-emerald-300">${ico('check', 'size-3', '3')}Answered</span>` : KIND_TAG(x)}<span>${when(x.t)}</span></div>
      <div class="w-full rounded-2xl rounded-tl-md border text-[15px] leading-relaxed ${card}">${form ? `<div class="px-1">${msgText(x, gid, form)}</div>${hasChoices(x.text) ? sendAnswerBtn(form) : ''}` : msgText(x, gid, 0, done)}${strip(x.files, gid + 'm' + x.id, 'h-48 w-24')}</div></div>`;
}
function mdHtml(text, gid = '', form = 0, done = null) {
  if (gid) groups.delete(gid);
  const lines = text.replace(/\r/g, '').split('\n'), blocks = [];
  let cur = null;
  const add = (kind, line) => { if (cur?.kind !== kind) blocks.push(cur = {kind, lines: []}); cur.lines.push(line); };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*```/.test(l)) { const a = i++; while (i < lines.length && !/^\s*```/.test(lines[i])) i++; blocks.push({kind: 'code', lines: lines.slice(a, i + 1)}); cur = null; }
    else if (!l.trim()) cur = null;
    else if (/^#{1,6}\s/.test(l)) { blocks.push({kind: 'heading', lines: [l]}); cur = null; }
    else if (/^\s*>/.test(l)) add('quote', l);
    else if (/^\s*([-*+]|\d+[.)])\s/.test(l)) add(/^\s*\d/.test(l) ? 'ol' : 'ul', l);  // a list may follow a line directly
    else if (/^(ol|ul)$/.test(cur?.kind) && /^\s{2,}\S/.test(l)) cur.lines.push(l);  // an item's next line
    else if (/^\s*\|/.test(l) && TABLE_SEP.test(lines[i + 1] || '')) { const a = i; i += 2; while (i < lines.length && /^\s*\|/.test(lines[i])) i++; blocks.push({kind: 'table', lines: lines.slice(a, i--)}); cur = null; }
    else add('para', l);
  }
  const labels = [];
  const html = blocks.map(b => {
    const items = b.kind === 'ul' ? b.lines.reduce((acc, l) => { if (/^\s*[-*+]\s/.test(l)) acc.push(l); else acc[acc.length - 1] += ' ' + l.trim(); return acc; }, []) : [];
    // In a question, choices can be picked also when its list has other points before them (B163)
    if (items.length && (items.every(l => CHOICE.test(l)) || ((form || done) && items.some(l => CHOICE.test(l))))) {
      const runs = [];
      for (const l of items) { const c = CHOICE.test(l); if (runs.at(-1)?.c !== c) runs.push({c, ls: []}); runs.at(-1).ls.push(l); }
      return runs.map(r => {
        if (!r.c) return blockHtml({kind: 'list', text: r.ls.join('\n')}, false, gid);
        const multi = r.ls[0].match(CHOICE)[1] === '[', base = labels.length;
        labels.push(...r.ls.map(l => l.replace(CHOICE, '')));
        return choiceHtml(labels.slice(base), multi, form, base, done);
      }).join('');
    }
    return blockHtml({kind: /^(ol|ul)$/.test(b.kind) ? 'list' : b.kind, text: b.lines.join('\n')}, false, gid);
  }).join('');
  if (form && labels.length) U.choiceLabels[form] = labels;  // the answer is sent with sendAnswerBtn, placed by the caller
  return html;
}
// A Markdown table: header, alignment row, body. Cells take inline Markdown; \| is a pipe inside a cell.
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
function tableHtml(text, gid) {
  const cells = l => l.trim().replace(/^\|/, '').replace(/\|$/, '').replace(/\\\|/g, '\u0002').split('|').map(c => c.trim().replace(/\u0002/g, '|'));
  const [head, sep, ...body] = text.trim().split('\n').map(cells);
  const align = (sep || []).map(c => /^:-+:$/.test(c) ? 'text-center' : /-:$/.test(c) ? 'text-right' : 'text-left');
  // F215: a framed table that fits its column: long words, code and links wrap anywhere, so no column pushes the
  // others out of sight; each column keeps room for a few words and the table scrolls sideways only when it must (B158)
  const cell = 'min-w-32 max-w-[28rem] border-r border-b px-3 py-2 wrap-anywhere last:border-r-0';
  // T252, B275: on a phone a table of 3 or more columns reads as cards, one per row: its first cell the title, the others
  // "column: value". No sideways scrolling inside the page, which the iPhone also failed to paint while scrolling
  const cards = head.length >= 3 ? `<div class="flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 text-[14.5px] leading-relaxed sm:hidden dark:divide-zinc-700 dark:border-zinc-700">${body.map(r => `<div class="px-3.5 py-3 even:bg-zinc-50/60 dark:even:bg-zinc-800/25">
      <div class="font-semibold wrap-anywhere text-zinc-900 dark:text-zinc-100">${inlineMd(r[0] || '', gid)}</div>${head.slice(1).map((h, i) => (r[i + 1] || '').trim() ? `<div class="mt-1.5"><div class="text-xs font-medium text-zinc-500 dark:text-zinc-400">${inlineMd(h, gid)}</div><div class="wrap-anywhere">${inlineMd(r[i + 1], gid)}</div></div>` : '').join('')}</div>`).join('')}</div>` : '';
  return cards + `<div class="${cards ? 'hidden sm:block ' : ''}overflow-x-auto rounded-lg border border-zinc-200 lg:scrollbar-thin dark:border-zinc-700"><table class="w-full border-collapse text-[13.5px] leading-relaxed">
    <thead class="bg-zinc-50 dark:bg-zinc-800/60"><tr>${head.map((c, i) => `<th class="${cell} border-zinc-200 align-bottom font-semibold text-zinc-800 dark:border-zinc-700 dark:text-zinc-100 ${align[i] || 'text-left'}">${inlineMd(c, gid)}</th>`).join('')}</tr></thead>
    <tbody>${body.map(r => `<tr class="even:bg-zinc-50/60 last:[&>td]:border-b-0 dark:even:bg-zinc-800/25">${head.map((_, i) => `<td class="${cell} border-zinc-100 align-top dark:border-zinc-800 ${align[i] || 'text-left'}">${inlineMd(r[i] || '', gid)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function blockHtml(b, isTitle, gid = '') {
  if (b.kind === 'table') return tableHtml(b.text, gid);
  if (isTitle) return `<div class="text-2xl leading-tight font-bold tracking-tight">${inlineMd(b.text.replace(/^#+\s*/, ''), gid)}</div>`;
  if (b.kind === 'heading') {
    const level = b.text.match(/^#+/)[0].length;
    return `<div class="${level <= 2 ? 'mt-2 text-xl' : 'mt-1 text-[17px]'} leading-snug font-semibold">${inlineMd(b.text.replace(/^#+\s*/, ''), gid)}</div>`;
  }
  if (b.kind === 'code') return `<pre class="overflow-x-auto whitespace-pre-wrap wrap-anywhere sm:whitespace-pre sm:[overflow-wrap:normal] lg:scrollbar-thin rounded-lg bg-zinc-100 p-3 font-mono text-[13px] leading-relaxed dark:bg-zinc-800"><code>${esc(b.text.replace(/^\s*```[^\n]*\n?/, '').replace(/\n?\s*```\s*$/, ''))}</code></pre>`;
  if (b.kind === 'quote') return `<blockquote class="border-l-[3px] border-zinc-300 pl-3 text-zinc-600 dark:border-zinc-600 dark:text-zinc-300">${inlineMd(b.text.replace(/^\s*>\s?/gm, ''), gid).replace(/\n/g, '<br>')}</blockquote>`;
  if (b.kind === 'list') {
    const ordered = /^\s*\d/.test(b.text);
    // T227 #3: an indented item is a level deeper, as written
    const items = b.text.split('\n').reduce((acc, l) => { const m = /^(\s*)([-*+]|\d+[.)])\s+/.exec(l); if (m) acc.push({lv: Math.floor(m[1].replace(/\t/g, '  ').length / 2), ol: /\d/.test(m[2]), t: l.slice(m[0].length)}); else if (acc.length) acc[acc.length - 1].t += ' ' + l.trim(); return acc; }, []);
    const nest = (from, lv) => { let html = '', i = from; const ol = items[from]?.ol; while (i < items.length && items[i].lv >= lv) { if (items[i].lv > lv) { const [h, j] = nest(i, items[i].lv); html = html.replace(/<\/li>$/, h + '</li>'); i = j; continue; } html += `<li>${inlineMd(items[i].t, gid)}</li>`; i++; } return [`<${ol ? 'ol' : 'ul'} class="${ol ? 'list-decimal' : 'list-disc'} space-y-1.5 pl-5 marker:text-zinc-400 [&_ol]:mt-1.5 [&_ul]:mt-1.5">${html}</${ol ? 'ol' : 'ul'}>`, i]; };
    return items.length ? nest(0, items[0].lv)[0] : '';
  }
  return `<p class="leading-[1.75] whitespace-pre-wrap">${inlineMd(b.text, gid)}</p>`;
}
const sameText = (a, b) => a.split(/\s+/).join(' ') === b.split(/\s+/).join(' ');
// A quote from a document reads as words, not Markdown: no ** or `, no table pipes or rules (B157).
const plainQuote = s => String(s || '').split('\n').filter(l => !TABLE_SEP.test(l)).map(l => l.replace(/^\s*(#+|>|[-*+]|\d+[.)])\s+/, '').replace(/\*\*|__|`/g, '').replace(/^\s*\||\|\s*$/g, '').replace(/\s*\|\s*/g, ' · ').trim()).filter(Boolean).join(' ');
// B258: your own comment can be changed or deleted, the way an input you sent can (Edit, Delete, and Undo after it);
// an agent's can be deleted, not edited (F262).
const DC_BTN = `${HIT} flex h-6 items-center gap-1 rounded-lg px-1.5 text-xs font-semibold text-zinc-500 hover:bg-blue-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-blue-400/10 dark:hover:text-zinc-200`;
const dcActs = (d, c) => `<div class="-mr-1.5 ml-auto flex gap-0.5 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100">${c.by === 'you' ? `<button data-act="dc-edit" data-d="${d.d}" data-id="${c.id}" class="${DC_BTN}">${ico('pencil', 'size-3.5')}Edit</button>` : ''}<button data-act="dc-delete" data-d="${d.d}" data-id="${c.id}" class="${DC_BTN}">${ico('trash', 'size-3.5')}Delete</button></div>`;
const dcFind = (dn, id) => { const d = docById(+dn); return d && [...d.whole || [], ...d.blocks.flatMap(b => b.comments), ...d.detached.flatMap(t => t.comments)].find(c => c.id === +id); };
function editComment(dn, id) {
  const c = dcFind(dn, id);
  if (!c) return;
  U.amend = {mode: 'dc', d: +dn, id: +id, was: c.text};
  renderComposer();
  const t = $('text');
  if (!t.value.trim()) { t.value = c.text; saveDraft(); grow(); renderComposer(); }
  t.focus(); t.selectionStart = t.selectionEnd = t.value.length;
}
async function deleteComment(dn, id) {
  try { await save({op: 'dcdel', d: +dn, id: +id}, () => deleteComment(dn, id)); } catch (_) { return; }
  renderDoc(); renderComposer();
  toast('Comment deleted', pushUndo(`Delete a comment on D${dn}`, async () => { await save({op: 'dcundel', d: +dn, id: +id}); renderDoc(); toast('Comment back'); }));
}
function threadHtml(d, key, comments, blockText) {
  return `<div class="mt-2 space-y-2 border-l-2 border-amber-300 pl-3 dark:border-amber-600">
    ${comments.map(c => `<div class="group text-sm ${MSG(c.by).replace(/\b(ml|mr)-8\b/, '')}">${blockText !== undefined && !sameText(c.quote, blockText) ? `<div class="mb-0.5 line-clamp-2 text-xs text-zinc-500">“${esc(plainQuote(c.quote))}”</div>` : ''}<div class="flex min-h-6 items-center gap-1"><span class="${WHO(c.by)}">${esc(whoName(c.by))}</span> <span class="text-xs text-zinc-400">${when(c.t)}${c.edited ? ` · edited ${when(c.edited)}` : ''}</span>${dcActs(d, c)}</div>${rich(c.text, 'dc' + c.t)}${c.files?.length ? `<div class="mt-1.5 flex gap-2 overflow-x-auto">${thumbs(c.files, 'dcf' + c.id, 'size-11')}</div>` : ''}</div>`).join('')}
    ${U.docReply === key ? '' : `<button data-act="doc-reply" data-key="${key}" class="${HIT} flex h-8 items-center gap-1 rounded-lg px-1.5 -mx-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 aria-pressed:underline dark:text-blue-400 dark:hover:bg-blue-400/10">${ico('reply', 'size-3.5')}Reply</button>`}
  </div>`;
}
const noteText = d => sameText(d.md.split('\n')[0].replace(/^#+\s*/, ''), d.title) ? d.md : `# ${d.title}\n\n${d.md}`;
// What a document comment goes to (I087): the picked paragraphs, the selected text, or a thread you reply in.
// The one input box takes it: its line says "Comment on D4 · “…”", and sending posts the comment.
// B2: while a document is open the box belongs to it. With nothing picked it says so and waits; it never turns into a
// reply to the item by itself. "Reply to F06 instead" (or Esc) closes the document, and only then is it a reply.
const docOpen = () => U.doc && !U.docEdit && (desk() || !$('overlay').hidden) ? docById(U.doc) : null;
function docTarget() {
  const d = docOpen();
  if (!d) return null;
  if (U.docReply) {
    const b = d.blocks.find(b => b.key === U.docReply), t = d.detached.find(t => t.key === U.docReply);
    return {d, key: U.docReply, reply: true, quote: b?.text || t?.quote || ''};
  }
  const blocks = d.blocks.filter(b => U.docSel.has(b.key));
  if (U.docQuote) return {d, key: U.docQuote.key, quote: U.docQuote.text};
  return blocks.length ? {d, key: blocks[0].key, quote: blocks.map(b => b.text).join('\n'), many: blocks.length} : null;
}
// B259: it takes what any box takes: words, pictures, files and voice notes ("Stop and send" too). The box is empty at
// once; a voice note's words go into the comment once they are in. Not saved: all of it comes back into the box.
async function sendDocComment(t) {
  const typed = $('text').value.trim(), drafts = [...U.files];
  if (!typed && !drafts.length) return;
  markSent(U.draftKey); $('text').value = ''; U.files = []; saveDraft(); grow(); renderComposer();
  const back = () => { $('text').value = [typed, $('text').value.trim()].filter(Boolean).join('\n'); U.files = [...drafts, ...U.files]; saveDraft(); grow(); renderComposer(); };
  let files;
  try {
    await Promise.all(drafts.map(f => f.done));
    if (drafts.some(f => f.transcribing)) toast('Posting as soon as the words of the voice note are in…');
    for (let i = 0; drafts.some(f => f.transcribing) && i < 240; i++) await sleep(500);
    files = drafts.filter(f => f.f && !f.failed);
    let text = typed;
    for (const f of files) if (f.tr && !text.includes(f.tr)) text = (text ? text + '\n' : '') + f.tr;
    if (!text && !files.length) return back();
    await save({op: 'dc', d: t.d.d, key: t.key, text, files: files.map(({f, name, mime, size, tr}) => ({f, name, mime, size, ...(tr ? {tr} : {})})), ...(t.reply ? {} : {quote: t.quote})},
      () => { const t2 = docTarget() || (docOpen() && {d: docOpen(), key: 'doc', whole: true}); if (t2) sendDocComment(t2); });
  } catch (_) { return back(); }
  for (const f of files) { f.sent = true; dropRec(f); }
  U.docThreads.add(t.key); U.docSel = new Set(); U.docQuote = null; U.docReply = t.whole ? null : t.key;  // B2: what you write next goes on in that thread (the whole document's: on the document)
  if (U.lastSent) { U.lastSent = null; renderFeedback(); }  // T113 A19: the toast says it; an older "Sent." line doesn't stay beside it
  getSelection()?.removeAllRanges(); renderDoc(); renderComposer(); toast(t.reply ? 'Reply added' : 'Comment added');
  if (desk()) $('text').focus({preventScroll: true});
}
function renderDocBar() { renderComposer(); }  // the comment target shows on the input box
const docSig = d => d ? `${d.title}|${d.md}|${[...d.whole || [], ...d.blocks.flatMap(b => b.comments), ...d.detached.flatMap(t => t.comments)].map(c => c.id + (c.edited || '')).join()}` : '';  // B258: an edit or a delete draws it again
// On the desktop a document opens in the item pane, like the item it belongs to (T110): its header has Circle,
// Edit and the way back to the item; the one input box below takes the comments (I087). It is drawn again only
// when the document or what you picked in it changes, so a refresh never swallows a click.
function docPane(d) {
  const body = $('detailBody'), key = [docSig(d), [...U.docSel], U.docQuote?.text, [...U.docThreads], U.docReply, U.docCircle].join('|');
  const b = (act, inner, title, attrs = '') => `<button data-act="${act}" ${attrs} title="${title}" class="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-100 aria-pressed:bg-amber-100 aria-pressed:text-amber-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:aria-pressed:bg-amber-900/60 dark:aria-pressed:text-amber-100">${inner}</button>`;
  $('itemMenuBtn').hidden = true;
  $('dHead').innerHTML = `<span class="flex min-w-0 items-center gap-2 text-sm">${ico('file', 'size-[18px] text-zinc-500 dark:text-zinc-400')}<span class="font-mono font-bold text-zinc-700 dark:text-zinc-200">D${d.d}</span><span class="truncate font-semibold">${esc(d.title)}</span></span>`;
  $('dActs').innerHTML = b('doc-circle', `${ico('lasso', 'size-4')}${U.docCircle ? 'Draw a circle…' : 'Circle'}`, 'Circle an area to comment on it', `aria-pressed="${!!U.docCircle}"`) + b('doc-edit', `${ico('pencil', 'size-4')}Edit`, 'Edit the text');
  $('dNav').innerHTML = b('doc-close', `${ico('left', 'size-4')}Back to ${code(liveN(d.n))}${KBD('Esc')}`, `Back to ${code(liveN(d.n))} · Esc`);
  if (D.docKey === key && body.querySelector('#docBlocks')) return;
  D.docKey = key;
  const top = body.querySelector('#docBlocks') ? body.scrollTop : (U.docScroll[d.d] || 0);
  body.innerHTML = `<div class="mx-auto w-full max-w-[46rem] px-8 pt-8 pb-12">${docViewHtml(d)}</div>`;
  body.scrollTop = top;
  if (U.docCircle) wireLasso();
}
function closeDoc() {  // the desktop's way back from a document to its item
  if (!U.doc) return;
  const d = U.doc;
  U.docScroll[d] = $('detailBody').scrollTop;
  Object.assign(U, {doc: null, docReply: null, docSel: new Set(), docQuote: null, docCircle: false});
  D.docKey = null; getSelection()?.removeAllRanges();
  renderDetail(); renderComposer();
  if (!leaveView(`D${d}`)) writeURL(false);
}
// A document's text with its comment threads: in a sheet on the phone, in the item pane on the desktop (T110).
function docViewHtml(d) {
  const titled = !!d.blocks[0] && sameText(d.blocks[0].text.replace(/^#+\s*/, ''), d.title);
  const [line0, ...rest0] = (d.blocks[0]?.text || '').split('\n'), titleLine = !titled && d.blocks[0]?.kind === 'para' && rest0.length && sameText(line0.replace(/^#+\s*/, ''), d.title);  // T227 #4
  const shown = (b, i) => i === 0 && titleLine ? {...b, text: rest0.join('\n')} : b;
  groups.delete('doc' + d.d);  // its images, refilled as the blocks render
  return `<div class="flex min-h-full flex-col"><div class="flex items-center gap-1 text-xs text-zinc-500"><span class="min-w-0 flex-1 truncate">on <button data-act="goto" data-n="${d.n}" class="text-blue-600 hover:underline dark:text-blue-400">${code(d.n)}</button> · ${esc(whoName(d.by))} · ${when(d.t1)}</span>
      <button data-act="doc-circle" aria-pressed="${!!U.docCircle}" class="${HIT} ${BTN} text-sm lg:hidden aria-pressed:bg-amber-100 aria-pressed:text-amber-900 dark:aria-pressed:bg-amber-900/60 dark:aria-pressed:text-amber-100">${U.docCircle ? 'Draw a circle…' : 'Circle'}</button><button data-act="doc-edit" class="${HIT} ${BTN} text-sm lg:hidden">Edit</button></div>
    ${titled ? '' : `<div class="mt-3 text-2xl leading-tight font-bold tracking-tight">${esc(d.title)}</div>`}
    <div id="docBlocks" class="relative mt-3 space-y-3 text-[15px] ${U.docCircle ? 'select-none' : ''}">
      ${d.blocks.map((b, i) => `<section data-act="doc-pick" data-key="${b.key}" ${U.docSel.has(b.key) ? 'data-picked' : ''} class="-mx-2 rounded-lg px-2 py-1 transition-colors hover:bg-zinc-50 data-picked:bg-amber-50 data-picked:ring-2 data-picked:ring-amber-300 data-pressed:opacity-70 dark:hover:bg-zinc-800/50 dark:data-picked:bg-amber-950/40 dark:data-picked:ring-amber-600">
        <div class="relative flex flex-col gap-1 lg:flex-row lg:items-start lg:gap-2"><div class="min-w-0 flex-1 break-words ${b.kind === 'heading' ? 'pr-14 lg:pr-0' : ''}">${blockHtml(shown(b, i), i === 0 && titled, 'doc' + d.d)}</div>
        ${b.comments.length ? `<button data-act="doc-thread" data-key="${b.key}" aria-label="${plural(b.comments.length, 'comment')}" class="${b.kind === 'heading' ? `absolute right-0 lg:relative lg:top-0 ${i === 0 && titled ? 'top-0.5' : (b.text.match(/^#+/) || ['#'])[0].length <= 2 ? 'top-2.5' : 'top-1'}` : 'relative self-end'} flex h-6 shrink-0 lg:mt-0.5 lg:self-start items-center gap-1 rounded-md bg-amber-100 px-1.5 text-xs font-medium text-amber-900 after:absolute after:-inset-2.5 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-100 dark:hover:bg-amber-900">${ico('comment', 'size-3.5')}${b.comments.length}</button>` : ''}</div>
        ${U.docThreads.has(b.key) ? threadHtml(d, b.key, b.comments, b.text) : ''}</section>`).join('')}
      ${U.docCircle ? `<svg id="lasso" class="absolute inset-0 z-10 h-full w-full touch-none" aria-label="Draw around the part you want to comment on"><path id="lassoPath" d="" fill="rgba(251,191,36,.15)" stroke="rgb(245,158,11)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>` : ''}
    </div>
    ${d.whole?.length ? `<section class="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800"><div class="text-xs font-medium text-zinc-500">On the whole document</div>${threadHtml(d, 'doc', d.whole)}</section>` : ''}
    ${d.detached.length ? `<div class="mt-6 space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-800"><div class="text-xs font-medium text-zinc-500">Original text changed</div>${d.detached.map(t => `<section>
      <div class="text-sm text-zinc-400 line-through">${esc(t.quote)}</div>${threadHtml(d, t.key, t.comments)}</section>`).join('')}</div>` : ''}
    <p class="mt-6 text-center text-xs text-zinc-400">${desk() ? 'Click' : 'Tap'} paragraphs, select text or circle an area to comment on them, or write in the box below about the whole document</p>
    </div>`;
}
function renderDoc({focus = false} = {}) {
  if (U.docEdit) {
    const d = docById(U.doc);
    const md = U.docText ?? (d ? noteText(d) : '');
    dialog(d ? `D${d.d}` : `New doc on ${code(U.docNew)}`, `<div class="flex min-h-full flex-col">
      <div class="sticky -top-2 z-10 -mx-4 -mt-2 mb-2 flex items-center gap-2 bg-white px-4 py-2 text-xs text-zinc-500 dark:bg-zinc-900"><span id="docHint" class="min-w-0 flex-1">The first line is the title. Esc keeps it as a draft.</span><button id="docMic" data-act="doc-mic" class="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-zinc-600 tabular-nums hover:bg-zinc-100 data-on:bg-red-600 data-on:text-white data-on:hover:bg-red-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:data-on:bg-red-600 dark:data-on:text-white">${ico('mic')}<span>Speak</span></button><button data-act="doc-discard" class="h-11 shrink-0 rounded-xl px-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">Discard</button><button data-act="doc-done" class="${PRIMARY}">${d ? 'Save' : 'Create'}</button></div>
      <textarea id="docMd" placeholder="Title on the first line&#10;&#10;Then anything: a plan, a design, notes. Markdown works." class="min-h-[40dvh] w-full flex-1 resize-none bg-transparent text-base leading-relaxed outline-none placeholder:text-zinc-400">${esc(md)}</textarea></div>`, {focus: false, tall: true});
    docMicShow();
    return;
  }
  const d = docById(U.doc);
  if (desk()) { if (!d) U.doc = null; renderDetail(); return renderComposer(); }  // the item pane shows it (T110)
  if (!d) return closeDialog();
  const a = document.activeElement, keep = a?.dataset?.docDraft ? [a.dataset.docDraft, a.value, a.selectionStart] : null;
  const top = $('dlgBody').scrollTop;
  dialog(`D${d.d}`, docViewHtml(d), {focus, tall: true, aboveComposer: true});
  U.docSig = docSig(d);
  renderComposer();
  if (!focus) $('dlgBody').scrollTop = top;
  if (keep) { const el = document.querySelector(`[data-doc-draft="${keep[0]}"]`); if (el) { el.value = keep[1]; el.focus({preventScroll: true}); try { el.setSelectionRange(keep[2], keep[2]); } catch (_) {} } }
  if (U.docCircle) wireLasso();
}
function openDoc(d) {
  if (U.doc !== d) setTimeout(() => !desk() && layersNow().at(-1) === 'sheet' && $('overlay').hidden === false ? writeURL(false, {v: `D${d}`}) : writeURL(true));  // after the sheet is up; a new document's editor gives it its step (B150)
  if (desk()) {  // T110: in the item pane, under its item (a merged one's: the item it went into, B5)
    const doc = docById(d), host = doc && liveN(doc.n);
    if (doc && U.open !== host && byN.has(host)) { U.open = host; renderItems(); }
    if (!$('overlay').hidden) { $('overlay').hidden = true; $('overlay').style.bottom = ''; U.sheet = null; }  // the editor, when you come back from it
    Object.assign(U, {peek: null, doc: d, docReply: null, docNew: null, docEdit: false, docText: null, docSel: new Set(), docQuote: null, docCircle: false});
    D.docKey = null; renderDetail(); renderComposer();
    return;
  }
  Object.assign(U, {peek: null, doc: d, docReply: null, docNew: null, docEdit: false, docText: null, docSel: new Set(), docQuote: null, docCircle: false});
  U.docDrafts.note = '';
  renderDoc({focus: true});
  $('dlgBody').scrollTop = U.docScroll[d] || 0;
}
const docKey = () => U.doc ? `D${U.doc}` : `new ${U.docNew}`;  // where a document's draft is kept
function newDoc(n) {
  Object.assign(U, {peek: null, doc: null, docNew: n, docEdit: true, docText: kept('docs')[`new ${n}`] || ''});
  renderDoc();
  if (U.docText) toast('Your draft is back');
  $('docMd').focus();
}
function keepDoc() {  // leaving the editor without Create or Save keeps the text as a draft (T113 B6)
  docRecStop();  // its words go into the draft when they come (F208)
  const d = docById(U.doc), md = ($('docMd')?.value ?? U.docText ?? '').trim(), key = docKey(), was = d ? noteText(d).trim() : '';
  kept('docs', all => { if (md && md !== was) all[key] = md; else delete all[key]; });
  if (md && md !== was) toast(d ? `Your edit of D${d.d} is kept as a draft: Edit brings it back` : `Your new document is kept as a draft: ${desk() ? '⇧D' : 'New doc'} brings it back`);
}
async function saveDoc() {  // leaving the editor saves; an empty new note is dropped
  const md = ($('docMd')?.value ?? U.docText ?? '').trim(), d = docById(U.doc), n = U.docNew, key = docKey();
  U.docEdit = false; U.docText = null;
  kept('docs', all => delete all[key]);  // saved, or nothing to save: no draft any more (if saving fails, the editor comes back)
  if (!md || (d && md === noteText(d).trim())) return d;
  return saveDocText(d, n, md);
}
async function saveDocText(d, n, md) {
  try {
    if (d) { await save({op: 'doc', d: d.d, md}); toast('Saved'); return docById(d.d); }
    await save({op: 'doc', ref: code(n), md}); toast('Document created');
    return docById(Math.max(...docsOf(n).map(x => x.d)));
  } catch (_) {  // not saved (T160): the editor comes back with your text, and Done tries again
    Object.assign(U, {doc: d ? d.d : null, docNew: d ? null : n, docEdit: true, docText: md});
    renderDoc();
    return null;
  }
}
// Circle to select: the paragraphs the loop goes around become the selection.
function wireLasso() {
  const svg = $('lasso'), path = $('lassoPath'), pts = [];
  svg.addEventListener('pointerdown', e => { pts.length = 0; add(e); try { svg.setPointerCapture(e.pointerId); } catch (_) {} });
  svg.addEventListener('pointermove', e => { if (pts.length) add(e); });
  svg.addEventListener('pointerup', () => {
    const box = svg.getBoundingClientRect(), poly = pts.map(([x, y]) => [x + box.left, y + box.top]);
    const inside = (x, y) => poly.reduce((c, [xi, yi], i) => { const [xj, yj] = poly[(i + poly.length - 1) % poly.length]; return ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ? !c : c; }, false);
    const ys = poly.map(p => p[1]);
    const picked = [...document.querySelectorAll('#docBlocks > section[data-key]')].filter(el => {
      const r = el.getBoundingClientRect(), cy = (r.top + r.bottom) / 2;
      return (inside((r.left + r.right) / 2, cy) || inside(r.left + 24, cy)) || (cy > Math.min(...ys) && cy < Math.max(...ys) && pts.length > 8);
    }).map(el => el.dataset.key);
    U.docCircle = false; U.docQuote = null; U.docSel = new Set(picked);
    renderDoc();
    if (!picked.length) toast('Nothing inside the circle');
  });
  function add(e) { const b = svg.getBoundingClientRect(); pts.push([e.clientX - b.left, e.clientY - b.top]); path.setAttribute('d', 'M' + pts.map(p => p.join(' ')).join(' L') + (pts.length > 2 ? ' Z' : '')); }
}

// ---------------------------------------------------------------- focus card
// A row's Answer or Reply, or "Go through" on Needs you (T65): the item in a card above the input
// box, with what it needs and its actions. A row opens the card of that item only; Go through steps through what
// waits on you, one card after another, and ends after the last (B153). While you go through, the card keeps its
// height and place, Previous and Next sit at the bottom under your thumb, and the actions keep their order, as on the
// desktop (B128): forward · progress · Won't do · Later · Copy; one a state has not leaves no gap (T225 #5).
// Opening the item or copying it leaves the walk where it was. A swipe on the card means what it means on a row: right is its step forward.
const laterLast = (a, b) => (a.when === 'later') - (b.when === 'later');  // Later moves an item that needs you down, out of the way (B153)
const walkTab = () => U.tab === 'rules' && !D.page && !D.compose && visible('rules').some(needsYou) ? 'rules' : 'items';  // on Rules, the rules waiting on you (T113 B29); none: Items'
// What needs you, newest first (B238): what changed last on top, the Later ones under the rest (B153). While you go
// through, the band keeps the walk's order, so nothing moves under you as you settle one.
const needsOrder = (a, b) => laterLast(a, b) || (b.t1 > a.t1 ? 1 : b.t1 < a.t1 ? -1 : b.n - a.n);
const walkOrder = g => (a, b) => ((g.list.indexOf(a.n) + 1 || 1e9) - (g.list.indexOf(b.n) + 1 || 1e9)) || needsOrder(a, b);
const needsList = (t = walkTab()) => visible(t).filter(needsYou).sort(needsOrder).map(it => it.n);
const FOCUS_TONE = {Start: 'text-blue-600 dark:text-blue-400', "Won't do": 'text-red-600 dark:text-red-400', Done: 'text-emerald-700 dark:text-emerald-400', Archive: 'text-emerald-700 dark:text-emerald-400', Unarchive: 'text-emerald-700 dark:text-emerald-400'};
const FWD_NEED = {Accept: 'accept', Approve: 'approve', Answer: 'answer', Reply: 'reply'};  // the forward step in the color of its kind, wherever it shows (B96, B41)
function cardSlots(it) {
  if (it.archived) return [['archived', 'false', 'Unarchive'], null, null, null];
  if (it.type === 'rule') return [swipeRight(it), null, swipeLeft(it)[0], null];  // a rule's own steps (B158)
  const [, prog, drop, later] = deskSlots({...it, wait: null}, false);
  return [swipeRight(it), prog, drop, later];
}
function peek(n, {focus = true} = {}) {
  const it = byN.get(n);
  if (!it) return;
  const moved = U.peek !== n;
  U.peek = n;
  const g = U.go && U.go.list.includes(n) ? U.go : null, files = filesOf(it), need = '', i = g ? g.list.indexOf(n) : -1;  // its button says what it needs (T225 #9)
  // What it needs from you comes right under the title, as on the item page: the question (B145), or for In review and
  // Proposed the agent's latest report, which Accept / Not yet / Approve are about (T225 #3). The talk before it follows.
  const pin = !it.wait && cardMsg(it), recent = it.thread.filter(x => x.id !== it.wait?.id && x.id !== pin?.id).slice(-3), talk = it.thread.length;
  const btn = (attrs, icon, label, tone) => `<button ${attrs} class="flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 ${tone}">${ico(icon, 'size-5')}<span class="max-w-full truncate">${label}</span></button>`;
  const slot = (a, k) => btn(`${k ? '' : 'data-slot="fwd" '}data-n="${n}" ${a[0] === 'need' ? 'data-act="card-answer"' : a[0] === 'reopen' ? 'data-act="reopen"' : `data-act="peek-set" data-f="${a[0]}" data-v="${a[1]}"`}`,
      ACT_ICON[a[2]], a[2], FWD_NEED[a[2]] ? NEED[FWD_NEED[a[2]]].text : FOCUS_TONE[a[2]] || 'text-zinc-700 dark:text-zinc-200');
  const last = g && !g.list.slice(i + 1).some(k => !g.done.has(k) && byN.get(k) && needsYou(byN.get(k)));  // nothing after this one: Next ends the walk
  const nav = g ? `<div class="flex items-center gap-1 px-2 pt-1">
      <button data-act="go-prev" ${i > 0 ? '' : 'disabled'} class="flex h-11 items-center gap-0.5 rounded-full pr-3 pl-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">${ico('left', 'size-4', '2.25')}Previous</button>
      <span class="min-w-0 flex-1"></span>
      <button data-act="go-next" class="flex h-11 items-center gap-0.5 rounded-full pr-1.5 pl-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">${last ? 'End' : `Next${ico('right', 'size-4', '2.25')}`}</button></div>` : '';
  // The item's code and Open sit in the card's header row beside ×, where a walk's "Needs you · 2 of 5" goes: no empty row on top (B158).
  // That "2 of 5" is the walk's one count: Previous and Next at the bottom don't repeat it (T225 #4).
  const idRow = `<div class="flex items-center gap-2">${stateIcon(it.status, statusName(it), 'size-5')}<span class="font-mono text-sm font-bold ${TYPE_TEXT[it.type]}">${code(n)}</span>${need ? `<span class="text-xs font-semibold text-amber-700 dark:text-amber-400">${need}</span>` : ''}
      <button data-act="goto" data-n="${n}" class="-my-2 ml-auto flex h-11 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10">${ico('open', 'size-4')}Open</button></div>`;
  const head = g ? `<span class="flex items-center gap-2"><span class="text-xs font-bold tracking-wide whitespace-nowrap text-amber-700 uppercase dark:text-amber-400">Needs you</span><span class="text-xs font-medium whitespace-nowrap text-zinc-500 tabular-nums dark:text-zinc-400">${i + 1} of ${g.list.length}</span></span>` : idRow;
  dialog('', `<div class="pb-1">
    ${g ? idRow : ''}
    <h2 class="${g ? 'mt-1' : ''} text-[19px] leading-snug font-semibold break-words">${esc(it.title)}</h2>
    <div class="mt-1 flex flex-wrap items-center gap-x-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">${it.type === 'rule' ? '' : `<span class="${PRI_TEXT[it.pri]}">${it.pri}</span>`}<span>${statusName(it)}</span><span>${WHEN[it.when]}</span><span>${it.type[0].toUpperCase() + it.type.slice(1)}</span>${talk ? cnt('comment', talk, plural(talk, 'comment')) : ''}</div>
    ${it.wait ? `<div data-need class="mt-4 scroll-mt-2">${needsCard(it, true)}</div>` : pin ? `<div data-need class="mt-4 flex flex-col gap-4">${talkHtml(it, [pin], 'p')}</div>` : ''}
    ${it.body ? rich(it.body, 'pbody' + n, 'mt-4 text-[15px] text-zinc-700 dark:text-zinc-300') : ''}
    ${it.next ? `<div class="mt-2 flex gap-2 text-sm"><span class="shrink-0 font-semibold text-zinc-500 dark:text-zinc-400">Next</span><span class="min-w-0 break-words">${inlineMd(it.next)}</span></div>` : ''}
    ${files.length ? fileRows(files, 'peek' + n, undefined, 'mt-3') : ''}
    ${recent.length ? `<div class="mt-4 flex flex-col gap-4">${talkHtml(it, recent, 'p')}</div>` : ''}
  </div>`, {
    aboveComposer: true, focus, card: true, head, walk: !!g,
    sub: g ? `<div class="flex gap-1 px-4 pb-1" aria-hidden="true">${g.list.map(k => `<span class="h-1 flex-1 rounded-full ${k === n ? 'bg-amber-500 dark:bg-amber-400' : g.done.has(k) ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-zinc-200 dark:bg-zinc-700'}"></span>`).join('')}</div>` : '',
    foot: `<div class="border-t border-zinc-100 dark:border-zinc-800">${nav}<div class="flex gap-1 px-2 py-1">${cardSlots(it).map((a, k) => a && slot(a, k)).filter(Boolean).join('')}
      ${btn(`data-act="card-copy" data-n="${n}"`, 'copy', 'Copy', 'text-zinc-700 dark:text-zinc-200')}</div></div>`,
  });
  if (moved) $('dlgBody').scrollTop = 0;
  renderComposer();
}
// After you act on an item while going through: the next one after it that still waits on you. After the last, the
// walk ends and says what is left: the ones you skipped still wait in the list (B153). A card of one item closes.
function advance(from, said = '') {  // said: what you just sent, for the toast, as the card it was on goes (B155)
  const g = U.go;
  if (!g) { closeDialog(); if (said) toast(said); return; }
  if (from) g.done.add(from);
  const next = g.list.slice(g.list.indexOf(from) + 1).find(k => !g.done.has(k) && byN.get(k) && needsYou(byN.get(k)));
  if (next) { peek(next, {focus: false}); if (said) toast(said); } else endWalk(said);
}
function endWalk(said = '') {
  const g = U.go, left = g ? g.list.filter(k => !g.done.has(k) && byN.get(k) && needsYou(byN.get(k))).length : 0;
  closeDialog();
  const end = left ? `that was the last one, ${left} still need${left === 1 ? 's' : ''} you` : 'nothing else needs you';
  toast(said ? `${said} · ${end}` : end[0].toUpperCase() + end.slice(1));
}

// ---------------------------------------------------------------- item page
// An item opens as a page of its own (T57): back arrow, code and status on top, the rarely used things behind
// "⋯". Reading order: title → what it needs from you → description → files → docs → subitems → conversation.

// The message the needs card shows: the question, or the agent's report or proposal (then not repeated below).
const cardMsg = it => it.wait ? it.thread.find(x => x.id === it.wait.id) || it.wait : (it.status === 'review' || it.status === 'proposed') ? lastAgentMsg(it) : null;
function needsCard(it, onCard = false) {  // onCard: in a Go through card, whose bottom bar has the Reply (T236 #1)
  const n = it.n, m = cardMsg(it), name = whoName(m?.by || it.wait?.by || (it.by && it.by !== 'you' ? it.by : 'agent'));  // one agent, one name (B157)
  // On the desktop the buttons sit on the right with their keys, and a hint says what the second one does.
  const card = (icon, title, body, buttons, hint = '') => `<section class="${NEEDS_CARD}">
      <div class="flex items-center gap-2.5 px-4 pt-3.5 lg:px-5 lg:pt-4">${ico(icon, 'size-5 text-amber-600 dark:text-amber-400')}<p class="min-w-0 flex-1 text-sm font-semibold text-amber-900 lg:text-[15px] dark:text-amber-200">${title}</p>${m?.t ? `<span class="text-xs text-amber-700/80 dark:text-amber-300/70">${when(m.t)}</span>` : ''}</div>
      ${body ? `<div class="space-y-2 px-4 pt-2 text-[15px] leading-relaxed text-zinc-800 lg:px-5 lg:pl-12 dark:text-zinc-200">${body}</div>` : ''}
      ${buttons ? `<div class="flex gap-2.5 p-3 pt-3.5 lg:items-center lg:justify-end lg:px-5 lg:pb-4">${hint ? `<p class="mr-auto hidden text-xs text-amber-700/80 xl:block dark:text-amber-300/70">${hint}</p>` : ''}${buttons}</div>` : '<div class="h-3.5"></div>'}</section>`;
  if (it.wait) {
    const w = it.wait, choices = w.kind === 'ask' && hasChoices(w.text);
    const body = rich(w.text, 'ask' + n, 'text-zinc-900 dark:text-zinc-100', w.kind === 'ask' ? n : 0)
      + (w.files?.length ? `<div class="flex gap-2 overflow-x-auto lg:scrollbar-thin">${thumbs(w.files, 'w' + n, 'h-48 w-24')}</div>` : '');
    return card(w.kind === 'block' ? 'alert' : 'ask', `${esc(whoName(w.by))} ${w.kind === 'block' ? 'is blocked and needs you' : 'asks you'}`, body,
      onCard ? (choices ? sendAnswerBtn(n, 'flex-1', true) : '')
        : choices ? `<button data-act="reply" class="${SECOND} flex-1 lg:flex-none">${ico('reply', 'size-4')}Reply${KBD('R')}</button>${sendAnswerBtn(n, 'flex-[1.4] lg:flex-none', true)}`
        : `<button data-act="reply" class="${PRIMARY_BASE} ${NEED.reply.btn} flex-1 lg:flex-none">${ico('reply', 'size-4')}Reply${KBD('R')}</button>`,
      choices ? 'Pick with 1–9, send with ⌘↵' : 'It continues after you reply');
  }
  if (it.status === 'proposed') return card('propose', `${esc(name)} proposed this`, m ? msgText(m, 'card' + n) : '<p class="text-sm text-amber-900/80 dark:text-amber-200/80">Nobody works on it until you approve.</p>',
    `<button data-act="status" data-n="${n}" data-v="dropped" class="${SECOND} flex-1 lg:flex-none">${ico('ban', 'size-4')}Won't do${KBD('W')}</button><button data-act="status" data-n="${n}" data-v="open" class="${PRIMARY_BASE} ${NEED.approve.btn} flex-[1.4] lg:flex-none">${ico('thumb', 'size-4.5')}Approve${KBD('A')}</button>`,
    'Nobody works on it until you approve');
  if (it.status === 'review') return card('done', `${esc(name)} finished this`, m ? msgText(m, 'card' + n) : '<p class="text-sm text-amber-900/80 dark:text-amber-200/80">Check its work, then accept or reopen.</p>',
    `<button data-act="reopen" data-n="${n}" class="${SECOND} flex-1 lg:flex-none">${ico('reopen', 'size-4')}Not yet${KBD('N')}</button><button data-act="status" data-n="${n}" data-v="done" class="${PRIMARY_BASE} ${NEED.accept.btn} flex-[1.4] lg:flex-none">${ico('check', 'size-4.5', '2.25')}Accept${KBD('A')}</button>`,
    'Not yet reopens it and asks what is missing');
  return it.reply ? `<div class="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">${ico('check', 'size-4', '2.25')}You replied. Waiting for your agent.</div>` : '';
}

const statusTone = it => it.status === 'doing' ? 'text-blue-600 dark:text-blue-400' : needsYou(it) ? 'text-amber-600 dark:text-amber-400' : it.status === 'done' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400';

function detailHtml(it) {
  const n = it.n, files = filesOf(it), children = kids.get(n) || [], parent = it.parent && byN.get(it.parent), shown = cardMsg(it);
  const thread = it.thread.filter(x => x.id !== it.wait?.id && x.id !== shown?.id), hidden = U.more.has(n) ? 0 : Math.max(0, thread.length - 8);
  const chips = [
    it.type === 'rule' ? '' : `<button data-act="item-menu" class="${CHIP.replace('after:inset-x-0', 'after:-inset-x-1.5')} shrink-0 ${it.pri === 'P0' ? 'font-semibold text-red-600 dark:text-red-400' : 'font-semibold text-zinc-700 dark:text-zinc-200'}">${it.pri}</button>`,
    it.when === 'later' && !CLOSED(it.status) ? `<span class="${CHIP} shrink-0 text-zinc-600 dark:text-zinc-300">${ico('clock', 'size-3.5 opacity-60')}Later</span>` : '',
    it.archived ? `<span class="${CHIP} shrink-0 text-zinc-600 dark:text-zinc-300">${ico('archive', 'size-3.5 opacity-60')}Archived</span>` : '',
    it.srcs.length ? `<button data-act="sources" data-n="${n}" class="${CHIP} shrink-0 text-zinc-600 dark:text-zinc-300">${plural(it.srcs.length, 'source')}</button>` : '',
    parent ? `<button data-act="goto" data-n="${parent.n}" class="${CHIP} min-w-0 flex-1 basis-32 text-zinc-700 dark:text-zinc-300">${ico('link', 'size-3.5 opacity-60')}<span class="truncate"><span class="mr-1 font-mono font-bold ${TYPE_TEXT[parent.type]}">${code(parent.n)}</span>${esc(parent.title)}</span></button>` : '',
  ].join('');
  const head = U.editing === n ? `<div class="flex flex-col gap-2">
      <input id="eTitle" class="${FIELD} font-medium" value="${esc(it.title)}" aria-label="Title">
      <textarea id="eBody" rows="8" class="${FIELD} leading-relaxed" aria-label="Details" placeholder="Details">${esc(it.body)}</textarea>
      <input id="eNext" class="${FIELD}" value="${esc(it.next)}" aria-label="Next step" placeholder="Next step (optional)">
      <div class="flex justify-end gap-2"><button data-act="edit-cancel" class="${SECOND}">Cancel</button><button data-act="edit-save" data-n="${n}" class="${PRIMARY}">Save</button></div></div>`
    : `<div class="flex flex-col gap-3"><h1 class="text-[22px] leading-[1.35] font-semibold break-words ${it.status === 'dropped' ? 'line-through' : ''}">${esc(it.title)}</h1>
      ${chips ? `<div class="flex flex-wrap items-center gap-2">${chips}</div>` : ''}</div>`;
  const desc = U.editing !== n && (it.body || it.next) ? `<div class="flex flex-col gap-3">
      ${it.body ? rich(it.body, 'body' + n, 'text-base text-zinc-800 dark:text-zinc-200') : ''}
      ${it.next ? `<div class="flex gap-2 text-sm"><span class="shrink-0 font-semibold text-zinc-500 dark:text-zinc-400">Next</span><span class="min-w-0 break-words text-zinc-700 dark:text-zinc-300">${inlineMd(it.next)}</span></div>` : ''}</div>` : '';
  const docs = docsOf(n).length ? `<section class="flex flex-col gap-2">${SECTION('Documents')}${docsOf(n).map(d => `<button data-act="doc-open" data-d="${d.d}" class="flex w-full items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">${ico('doc', 'size-5 text-zinc-500 dark:text-zinc-400')}<span class="min-w-0 flex-1"><span class="block truncate text-[15px] font-medium">${esc(d.title)}</span><span class="block text-xs text-zinc-500 dark:text-zinc-400">D${d.d} · ${plural(d.comments.length, 'comment')} · ${when(d.t1)}</span></span>${ico('right', 'size-4 text-zinc-300 dark:text-zinc-600')}</button>`).join('')}</section>` : '';
  const subs = children.length || U.subFor === n ? `<section class="flex flex-col gap-2">
      ${SECTION(`Subitems${children.length ? ` · ${children.filter(k => CLOSED(k.status)).length}/${children.length}` : ''}`, U.subFor === n ? '' : `<button data-act="sub-new" data-n="${n}" class="-my-2.5 flex h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10">${ico('plus', 'size-4', '2')}Add</button>`)}
      ${children.length ? `<div class="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">${children.map(k => `<button data-act="goto" data-n="${k.n}" class="flex w-full items-start gap-3 px-3 py-3 text-left first:rounded-t-xl last:rounded-b-xl hover:bg-zinc-50 data-pressed:bg-zinc-100 dark:hover:bg-zinc-900 dark:data-pressed:bg-zinc-800 ${CLOSED(k.status) ? 'opacity-55' : ''}">${stateIcon(k.status, statusName(k))}<span class="min-w-0 flex-1 text-[15px] leading-snug ${CLOSED(k.status) ? 'line-through' : ''}"><span class="mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[k.type]}">${code(k.n)}</span>${esc(k.title)}</span></button>`).join('')}</div>` : ''}
      ${U.subFor === n ? `<div class="flex items-center gap-2"><input id="subTitle" class="${FIELD} min-w-0 flex-1" placeholder="Subitem of ${code(n)}" aria-label="Subitem title"><button data-act="sub-add" data-n="${n}" class="${PRIMARY}">Add</button><button data-act="sub-cancel" aria-label="Cancel" class="grid size-11 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">${ico('x', 'size-5')}</button></div>` : ''}
    </section>` : '';
  const talk = thread.length ? `<div class="flex flex-col gap-6 border-t border-zinc-100 pt-6 dark:border-zinc-800/70">
      ${hidden ? `<button data-act="more" data-n="${n}" class="-my-1 h-11 self-center rounded-lg px-3 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10">Show ${hidden} earlier</button>` : ''}
      ${talkHtml(it, thread.slice(hidden))}</div>` : '';
  return `<div class="flex flex-col gap-6 px-5 pt-5 pb-10 lg:mx-auto lg:w-full lg:max-w-[46rem] lg:px-8 lg:pt-9">${[head, needsCard(it), desc,
    files.length ? fileRows(files, 'item' + n, 'h-24 w-16') : '', docs, subs, talk].filter(Boolean).join('')}</div>`;
}

function renderDetail() {
  settleOpen();  // B5: never a merged item, whichever way it came back (a tab's last item, a document's item)
  if (!desk()) $('foot').hidden = !!(U.editing && U.editing === U.open) || (!!D.page && !U.prefsEdit);  // editing an item: its form is the one place to type, the box steps aside (B156); Settings has no box but for F183
  const it = U.open && byN.get(U.open), body = $('detailBody');
  if (desk()) renderGoStrip();
  if (desk() && U.doc && !U.docEdit && docById(U.doc)) return docPane(docById(U.doc));
  if (!it) {  // the desktop's detail pane with nothing selected
    if (desk()) {
      const back = D.compose && D.prev && byN.has(D.prev);
      $('dActs').innerHTML = ''; $('itemMenuBtn').hidden = true;
      $('dHead').innerHTML = D.compose ? `<span class="flex items-center gap-2 text-sm font-semibold">${ico('newinput', 'size-[18px] text-blue-600 dark:text-blue-400')}${ruleMode() ? 'New rule' : 'New input'}</span>` : '';
      $('dNav').innerHTML = back ? `<button data-act="compose-back" class="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">${ico('left', 'size-4')}Back to ${D.prevDoc ? 'D' + D.prevDoc : code(D.prev)}${KBD('Esc')}</button>` : '';
      body.innerHTML = D.compose ? '' : noSelection();
      if (D.compose) {  // drawn again only when it changed, and not under a word you are correcting (I176): a redraw under a press loses the click
        $('composeHead').innerHTML = composeHead();
        const said = saidLately(), list = $('composeList');
        if (!U.fixEd && (list.dataset.html !== said || !list.firstChild)) { list.dataset.html = said; list.innerHTML = said; markCut(list); }
        renderDraft();  // the draft card has its own redraw, by what changed in it
      }
    }
    return;
  }
  $('itemMenuBtn').hidden = false;
  const top = body.scrollTop, keep = keepEdit();
  $('dHead').innerHTML = `<span class="hidden lg:inline">${stateIcon(it.status, statusName(it), 'size-[18px]')}</span><span class="font-mono text-sm font-bold ${TYPE_TEXT[it.type]}">${code(it.n)}</span><span class="text-[11px] font-semibold tracking-wider uppercase">${it.wait ? `<span class="text-amber-600 dark:text-amber-400">${it.wait.kind === 'block' ? 'Blocked' : 'Asks you'}</span>` : `<span class="${statusTone(it)}">${statusName(it)}</span>`}</span>`;  // T230 #2: a state, the card's and the row's word, not a button's
  if (desk()) renderDetailBar(it);
  body.innerHTML = detailHtml(it);
  body.scrollTop = top;
  requestAnimationFrame(() => body.querySelectorAll('[data-clip]').forEach(clipFade));  // measured once it shows
  restoreEdit(keep);
}

// "⋯": everything you change now and then, out of the way of reading. Tiles for actions, segmented controls
// for type and priority, and the status grid with the same icons as the list (T65).
const STATE_ON = {proposed: 'text-amber-400 dark:text-amber-600', review: 'text-amber-400 dark:text-amber-600', doing: 'text-blue-400 dark:text-blue-600', done: 'text-emerald-400 dark:text-emerald-600', open: 'text-zinc-400 dark:text-zinc-500', dropped: 'text-zinc-400 dark:text-zinc-500'};  // icons on the dark "selected" fill
// A status button in the ⋯ menu: the one the item has is aria-pressed, and its fill and icon follow that (T160).
const STAT_BTN = 'group flex min-w-0 items-center gap-1.5 bg-zinc-100 text-[13px] font-medium whitespace-nowrap text-zinc-700 hover:bg-zinc-200 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900';
const statIcon = (s, t, size) => stateIcon(s, t, size, STATE_ICON[s][1] + ' ' + STATE_ON[s].split(' ').map(c => c.replace(/^(dark:)?/, '$1group-aria-pressed:')).join(' '));
function itemMenu(n) {
  if (desk()) return itemMenuDesk(n);
  const it = byN.get(n);
  if (!it) return;
  U.sheet = 'menu';
  const tile = (act, icon, label, sub = '', attrs = '') => `<button data-act="${act}" data-n="${n}" ${attrs} class="flex h-19 flex-col items-center justify-center gap-1.5 rounded-2xl bg-zinc-100 px-1 text-[13px] leading-tight font-medium text-zinc-800 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">${ico(icon, 'size-5.5 text-zinc-600 dark:text-zinc-300')}<span class="text-center">${label}${sub ? `<span class="block text-[11px] font-normal text-zinc-500 dark:text-zinc-400">${sub}</span>` : ''}</span></button>`;
  const next = inQueue(it) && it.when === 'now' ? tile('do-next', 'up', it.rank == null ? 'Do this next' : 'Back in order', it.rank == null ? `first of the ${it.pri}s` : '') : '';  // F197
  const state = it.archived ? tile('archive', 'archive', 'Unarchive', '', 'data-on="0"')
    : CLOSED(it.status) ? tile('archive', 'archive', 'Archive', '', 'data-on="1"')
    : it.type === 'rule' ? '' : tile('swipe', 'clock', it.when === 'now' ? 'Later' : 'Back to now', '', `data-f="when" data-v="${it.when === 'now' ? 'later' : 'now'}"`);
  const lab = t => `<div class="px-1 pb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">${t}</div>`;
  const stat = ([s, t]) => { const on = it.status === s;
    return `<button data-act="set-field" data-n="${n}" data-f="status" data-v="${s}" aria-pressed="${on}" class="${STAT_BTN} h-11 rounded-xl px-2.5">${statIcon(s, t, 'size-4.5')}<span class="truncate">${t}</span></button>`; };
  const statuses = it.type === 'rule' ? Object.entries(RULE_STATUS).filter(([v]) => v !== 'proposed' || it.status === 'proposed') : Object.entries(STATUS);
  dialog('', `<div class="flex flex-col gap-5">
    <div class="grid grid-cols-3 gap-2">${tile('edit', 'pencil', 'Edit')}${tile('copy', 'copy', 'Copy for agent')}${tile('doc-new', 'docplus', 'New doc')}
      ${tile('sub-new', 'listplus', 'Add subitem')}${tile('reparent', 'indent', 'Move under…', it.parent ? `now under ${code(it.parent)}` : '')}${state}${next}</div>
    <div>${lab('Type')}${segctl('set-field', 'type', [...TYPES, 'rule'].map(t => [t, letterOf(t) + `<span class="truncate">${t[0].toUpperCase() + t.slice(1)}</span>`]), it.type).replaceAll('data-k="type"', `data-f="type" data-n="${n}"`)}</div>
    ${it.type === 'rule' ? '' : `<div>${lab('Priority')}${segctl('set-field', 'pri', ['P0', 'P1', 'P2', 'P3'].map(p => [p, p === 'P0' ? '<span class="font-semibold text-red-600 dark:text-red-400">P0</span>' : p]), it.pri).replaceAll('data-k="pri"', `data-f="pri" data-n="${n}"`)}</div>`}
    <div>${lab('Status')}<div class="grid grid-cols-3 gap-1.5">${statuses.map(stat).join('')}</div></div>
  </div>`, {head: `<span class="block truncate text-[15px] font-semibold"><span class="mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[it.type]}">${code(n)}</span>${esc(it.title)}</span>`, focus: false});
}

const STATUS_FILTER = {active: 'Not finished', wait: 'Needs you', proposed: 'Proposed', doing: 'In progress', review: 'In review', done: 'Done', dropped: "Won't do"};  // archived things live in the Archive tab (B130)
// Rows hang under their parent when both are in the same group (I59); one whose parent is elsewhere stands alone.
function tree(group, band = '') {
  const inG = new Set(group.map(it => it.n)), out = [];
  const add = (it, d) => { out.push(itemRow(it, d, group, band)); if (!U.folded.has(it.n) && d < 8) for (const k of group) if (k.parent === it.n) add(k, d + 1); };
  for (const it of group) if (!(it.parent && inG.has(it.parent))) add(it, 0);
  return out.join('');
}
const EMPTY = (text, extra = '') => `<div class="px-6 py-16 text-center text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">${text}${extra}</div>`;

// What waits on you, at the top of Items and of Rules: Go through, or while you go through, End and what you settled.
// F209: on the desktop it shows the first 5 and a row for the rest, so the queue stays in sight; not while you go
// through them, and not when the open item is among the rest.
const NEEDS_SHOWN = 5;
function needsBand(needs, going) {
  if (!needs.length) return '';  // nothing waiting: no band (I71)
  const long = desk() && !going && needs.length > NEEDS_SHOWN + 1, cut = long && !U.needsAll && !needs.slice(NEEDS_SHOWN).some(it => it.n === U.open);
  const rest = needs.length - NEEDS_SHOWN, toggle = (act, label, icon) => `<button data-act="${act}" class="flex h-10 w-full items-center gap-1.5 border-b border-zinc-100 pl-4 text-[13px] font-semibold text-amber-800 hover:bg-amber-50 dark:border-zinc-800/70 dark:text-amber-300 dark:hover:bg-amber-400/10">${ico(icon, 'size-4', '2.25')}${label}</button>`;
  return zone('needs', 'Needs you', needs.filter(needsYou).length, going ? `<span class="text-xs font-medium text-amber-700 dark:text-amber-400">· Going through</span><button data-act="go-end" class="-my-1 ml-auto flex h-11 items-center gap-1 rounded-full pr-2 pl-3 text-[13px] font-semibold text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-400/15">End${KBD('Esc')}</button>` : goThroughBtn())
    + (cut ? needs.slice(0, NEEDS_SHOWN) : needs).map(it => going && going.done.has(it.n) ? settledRow(it) : needsRow(it)).join('')
    + (cut ? toggle('needs-more', `Show ${rest} more`, 'down') : long && U.needsAll ? toggle('needs-more', 'Show fewer', 'chevup') : '');
}
function renderItems() {
  const list = $('list'), top = U.open && !desk() ? U.listTop?.[0] : list.scrollTop;  // under the phone's item page the list is hidden and reads 0
  SW.open = SW.el = null;  // rows are rebuilt closed; a stale reference would swallow the next tap
  const rows = visible();
  phoneCounts(rows);
  if (desk()) renderDeskHead();  // the title's count follows the search as you type
  renderFilters();
  if (holding()) { patchList(); return syncNeeds(); }  // B124: rows hold still under the pointer after you act on one
  let html = '';
  if (!S.items.length && U.tab === 'rules') html = EMPTY('No rules yet.<br>A rule is a standing instruction for the agents here: write one in the box below.');  // T233 #2
  else if (!S.items.length && U.tab === 'archive') html = EMPTY('Nothing archived yet.<br>Finished items you archive show here.');
  else if (!S.items.length) {
    html = EMPTY(`No items yet.<br>Write your first thought below${S.org.on ? ' and the organizer turns it into items' : ' and your coding agent turns it into items'}.`, `<br><button data-act="guide" class="mt-3 h-11 text-blue-600 hover:underline dark:text-blue-400">Connect a coding agent</button>`);
  } else if (!rows.length && filtered()) {
    const more = searchHints(0);
    html = EMPTY('No matching items', `${more ? `<span class="mt-3 flex flex-col">${more}</span>` : '<br>'}<button data-act="reset" class="mt-3 h-11 text-blue-600 hover:underline dark:text-blue-400">Clear search and filters</button>`);
  } else if (U.tab === 'rules') {
    // Rules: the ones an agent proposed wait on you; then the rules in force, then the retired ones.
    // Their Needs you band works like Items' (T113 B29): Go through, and what you settle stays in it while you go.
    const going = desk() && U.go, settled = it => going && going.done.has(it.n) && going.list.includes(it.n);
    const wait = rows.filter(it => it.status === 'proposed' || settled(it)).sort(going ? walkOrder(going) : needsOrder), on = rows.filter(it => it.status === 'open' && !settled(it)), off = rows.filter(it => it.status === 'dropped' && !settled(it));
    html = !rows.length ? EMPTY('No rules yet.<br>Rules are standing instructions for agents in this project,<br>for example how to write commit messages or who reviews.<br>Say one in the box below and it is filed here.')
      : needsBand(wait, going)
      + (on.length ? zone('rules', 'Active', on.length) + on.map(it => itemRow(it)).join('') : '')
      + (off.length ? zone('retired', 'Retired', off.length) + off.map(it => itemRow(it, 0, [], 'retired')).join('') : '');
  } else if (U.tab === 'archive') {
    html = rows.length ? rows.map(it => itemRow(it)).join('') : EMPTY('Nothing archived yet.<br>Archive finished items from the end of the Items list, or from an item\'s ⋯.');
  } else {
    // Items, in the order of your loop (T65 "Needs you first"): what waits on you, the agent's queue, finished work.
    const going = desk() && U.go, needs = rows.filter(it => needsYou(it) || (going && going.done.has(it.n) && going.list.includes(it.n))).sort(going ? walkOrder(going) : needsOrder);  // newest first (B238); Later below the rest (B153)
    if (U.archHold?.sig !== listSig()) U.archHold = null;  // another tab, search or filter: no need to hold the place
    const hold = U.archHold ? 'data-hold' : '';  // B3: the finished band keeps its height after Archive N, under the pointer
    const settled = it => going && going.done.has(it.n) && going.list.includes(it.n);
    const queued = rows.filter(it => inQueue(it) && !settled(it)).sort(queueOrder);
    const queue = queued.filter(it => it.when !== 'later'), later = queued.filter(it => it.when === 'later');  // F212: Later is its own group, under the queue
    const done = rows.filter(it => CLOSED(it.status) && !it.archived && !settled(it)), arch = rows.filter(it => it.archived);
    html = needsBand(needs, going)
      + (queue.length ? zone('queue', 'Agent queue', queue.length, '') + tree(queue) : '')  // what agents take
      + (later.length ? zone('later', 'Later', later.length, `<span class="hidden text-xs font-medium text-zinc-500 lg:inline dark:text-zinc-400">· agents wait until it is back to now</span>`) + tree(later, 'later') : '')
      + (U.undoArch ? `<div ${hold}><div class="flex items-center gap-3 border-b border-blue-100 bg-blue-50 py-2 pr-2 pl-4 dark:border-blue-400/15 dark:bg-blue-400/10">
          ${ico('archive', 'size-5 text-blue-600 dark:text-blue-400')}
          <p class="min-w-0 flex-1 text-sm text-blue-950 dark:text-blue-100"><span class="font-semibold">Archived ${plural(U.undoArch.ids.length, 'finished item')}.</span> They are under Archive.</p>
          <button data-act="archive-undo" class="flex h-11 shrink-0 items-center gap-2 rounded-full bg-blue-600 pr-1.5 pl-4 text-[15px] font-semibold text-white shadow-sm shadow-blue-600/30 dark:bg-blue-500">${ico('undo', 'size-4.5', '2.25')}Undo
            <span id="undoLeft" class="grid size-8 place-items-center rounded-full bg-white/20 text-sm font-bold tabular-nums ring-2 ring-white/60">${U.undoArch.left}</span></button></div></div>`
        : done.length ? zone('done', 'Finished', done.length, archiveAllBtn(done.length)) + tree(done) : hold ? `<div aria-hidden="true" ${hold}></div>` : '')
      + (arch.length ? zone('archived', 'Archived', arch.length) + arch.map(it => itemRow(it)).join('') : '');
  }
  const more = rows.length ? searchHints(rows.length) : '';  // where else the words are: other tabs for a short result (A9), other projects (F196)
  list.innerHTML = html + (more ? `<div class="flex flex-col py-4">${more}</div>` : '');
  const hd = list.querySelector('[data-hold]');
  if (hd) hd.style.minHeight = U.archHold.h + 'px';  // a measured height: set before the scroll position comes back, so it isn't cut short
  list.scrollTop = top || 0;
  if (desk() && U.open) { const rows = [...list.querySelectorAll('[data-act="open"][data-n]')].map(el => Number(el.dataset.n)); if (rows.includes(U.open)) LIST.at = {n: U.open, rows}; }
}

// The filters that are set, as [key, label] pairs.
const filtersSet = () => [
  U.type !== 'all' && U.tab !== 'rules' ? ['type', `<span class="font-mono text-xs font-bold ${TYPE_TEXT[U.type]}">${LETTER[U.type]}</span>${U.type[0].toUpperCase() + U.type.slice(1)}`] : null,
  U.when !== 'all' ? ['when', WHEN[U.when]] : null,
  U.status !== 'all' ? ['status', U.tab === 'rules' ? RULE_STATUS[U.status] || STATUS[U.status] : STATUS_FILTER[U.status]] : null,
  U.pri !== 'all' ? ['pri', U.pri] : null,
].filter(Boolean);
const filterChips = set => set.map(([k, label]) => `<button data-act="unfilter" data-k="${k}" class="${HIT} flex h-8 shrink-0 items-center gap-1 rounded-full bg-blue-50 pr-2 pl-3 text-[13px] font-medium text-blue-800 ring-1 ring-blue-200 ring-inset hover:bg-blue-100 lg:h-7 dark:bg-blue-400/10 dark:text-blue-200 dark:ring-blue-400/25 dark:hover:bg-blue-400/20">${label}${ico('x', 'size-3.5', '2.25')}</button>`).join('');
// The filter button and, under the tabs, the filters that are set as chips you can remove one by one. On the
// desktop the same controls open in place under the list header instead of a sheet.
function renderFilters() {
  const set = filtersSet(), dot = set.length ? '<span class="absolute top-2 right-2 size-2 rounded-full bg-blue-600 ring-2 ring-white dark:bg-blue-400 dark:ring-zinc-950"></span>' : '';
  $('filterBtn').hidden = U.tab === 'inputs';
  $('filterBtn').innerHTML = ico('sliders', 'size-5') + dot;
  $('deskFilterBtn').hidden = U.tab === 'inputs';
  $('deskFilterBtn').innerHTML = ico('sliders', 'size-[18px]') + dot;
  $('deskFilterBtn').setAttribute('aria-expanded', String(!!D.filters));
  const strip = $('filterStrip');
  strip.hidden = !set.length || U.tab === 'inputs' || !!U.open || !!D.page;
  strip.innerHTML = filterChips(set) + `<button data-act="reset" class="ml-auto h-11 shrink-0 px-1 text-[13px] font-semibold text-blue-600 hover:underline dark:text-blue-400">Clear</button>`;
  if (!desk()) return;  // the count is in the list's title, right above (A18)
  $('deskFilters').innerHTML = !set.length && !D.filters ? '' : `<div class="flex min-h-11 flex-wrap items-center gap-2 px-3 py-1.5">${filterChips(set)}
      ${set.length ? `<button data-act="reset" class="ml-auto h-8 px-1 text-[13px] font-semibold text-blue-600 hover:underline dark:text-blue-400">Clear</button>` : '<span class="ml-auto"></span>'}
      <button data-act="filters" aria-label="${D.filters ? 'Fold the filters' : 'Show the filters'}" class="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">${ico(D.filters ? 'chevup' : 'down', 'size-4', '2')}</button></div>
    ${D.filters ? `<div class="flex flex-col gap-3 px-3 pb-3">${filterControls(true)}</div>` : ''}`;
}

// Filters live in a sheet: segmented controls and pills instead of dropdowns (T65).
const SEG_ON = 'aria-pressed:bg-white aria-pressed:text-zinc-900 aria-pressed:shadow-sm aria-pressed:ring-1 aria-pressed:ring-zinc-900/5 dark:aria-pressed:bg-zinc-600 dark:aria-pressed:text-white dark:aria-pressed:ring-white/10';  // the one picked (aria-pressed)
const segctl = (act, key, opts, on, small = false) => `<div class="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">${opts.map(([v, t]) =>
  `<button data-act="${act}" data-k="${key}" data-v="${v}" aria-pressed="${v === on}" class="relative flex ${small ? 'h-7' : 'h-9'} min-w-0 flex-1 items-center justify-center gap-1 rounded-lg text-[13px] font-medium text-zinc-600 after:absolute after:inset-x-0 after:-inset-y-1 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700/70 dark:hover:text-zinc-100 ${SEG_ON}">${t}</button>`).join('')}</div>`;
const letterOf = t => `<span class="font-mono text-xs font-bold ${TYPE_TEXT[t]}">${LETTER[t]}</span>`;
function filterControls(small = false) {
  const lab = t => `<div class="px-1 ${small ? 'pb-1 text-[11px]' : 'pb-2 text-xs'} font-semibold text-zinc-500 dark:text-zinc-400">${t}</div>`;
  const pill = (v, t) => `<button data-act="set-filter" data-k="status" data-v="${v}" aria-pressed="${U.status === v}" class="relative ${small ? 'h-7 px-2.5' : 'h-9 px-3.5'} rounded-full bg-zinc-100 text-[13px] font-medium text-zinc-700 after:absolute after:inset-x-0 after:-inset-y-1 hover:bg-zinc-200 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900">${t}</button>`;
  const statuses = U.tab === 'rules' ? [['all', 'All'], ...Object.entries(RULE_STATUS)] : [['all', 'All'], ...Object.entries(STATUS_FILTER)];
  return `${U.tab === 'rules' ? '' : `<div>${lab('Type')}${segctl('set-filter', 'type', [['all', 'All'], ...TYPES.map(t => [t, letterOf(t) + `<span class="truncate">${t[0].toUpperCase() + t.slice(1)}</span>`])], U.type, small)}</div>`}
    <div>${lab('When')}${segctl('set-filter', 'when', [['all', 'Any time'], ['now', 'Now'], ['later', 'Later']], U.when, small)}</div>
    <div>${lab('Status')}<div class="flex flex-wrap gap-1.5">${statuses.map(([v, t]) => pill(v, t)).join('')}</div></div>
    ${U.tab === 'rules' ? '' : `<div>${lab('Priority')}${segctl('set-filter', 'pri', [['all', 'Any'], ['P0', '<span class="font-semibold text-red-600 dark:text-red-400">P0</span>'], ['P1', 'P1'], ['P2', 'P2'], ['P3', 'P3']], U.pri, small)}</div>`}`;
}
function showFilters() {
  if (desk()) { D.filters = !D.filters; return render(); }
  const rows = visible(), n = rows.length, open = rows.filter(it => !CLOSED(it.status) && !it.archived).length;  // the open ones, as the Items tab counts them (B158, B130)
  U.sheet = 'filter';
  dialog('Filter', `<div class="flex flex-col gap-5">${filterControls()}
    <button data-act="close" class="${PRIMARY} w-full">Show ${U.tab === 'items' && open !== n ? `${open} open, ${n - open} finished` : plural(n, U.tab === 'rules' ? 'rule' : 'item')}</button>
  </div>`, {extra: filtered() ? `<button data-act="reset" class="h-11 rounded-full px-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10">Clear all</button>` : '', focus: false});
}

// Leaving the editor any way but Cancel keeps what you typed (B122); I on that item brings it back.
// Half-written text has one rule (T113 B6): leaving it any way but Cancel or Discard keeps it as a draft, until you
// save, send or discard it: an item's edit, a subitem's title, a document. Drafts are kept in this browser per
// project, like the box's, so they survive a reload and a switch to another project.
function kept(kind, change) {  // -> {key: draft}; change(all) edits and saves them
  const key = `taska.${kind}.${S.project}`;
  try {
    const all = JSON.parse(localStorage.getItem(key) || '{}');
    if (change) { change(all); localStorage.setItem(key, JSON.stringify(all)); }
    return all;
  } catch (_) { return {}; }
}
function editNow() {  // the item editor's text, and whether it differs from the item
  const n = U.editing, it = n && byN.get(n);
  if (!it || !$('eTitle')) return null;
  const d = {title: $('eTitle').value, body: $('eBody').value, next: $('eNext').value};
  return {n, d, changed: d.title !== it.title || d.body !== it.body || d.next !== (it.next || '')};
}
function keepItemEdit() { const e = editNow(); if (e) kept('edits', all => { if (e.changed) all[e.n] = e.d; else delete all[e.n]; }); return e; }
function stashEdit() {
  const e = keepItemEdit();
  if (e?.changed) toast(`Your changes to ${code(e.n)} are kept: ${desk() ? 'press I' : 'Edit'} to go on`);
}
function keepEdit() {
  const a = document.activeElement;
  const k = {focus: a && a.id && $('detailBody').contains(a) ? a.id : null, start: a?.selectionStart, end: a?.selectionEnd,
    choice: a?.dataset?.act === 'choice' && $('detailBody').contains(a) ? [a.dataset.n, a.dataset.i] : null};  // a focused answer stays focused (B125)
  for (const id of ['eTitle', 'eBody', 'eNext', 'subTitle']) if ($(id)) k[id] = $(id).value;
  return k;
}

function restoreEdit(k) {
  for (const id of ['eTitle', 'eBody', 'eNext', 'subTitle']) if ($(id) && k[id] !== undefined) $(id).value = k[id];
  if (k.focus && $(k.focus)) { const el = $(k.focus); el.focus({preventScroll: true}); try { el.setSelectionRange(k.start, k.end); } catch (_) {} }
  if (k.choice) document.querySelector(`#detailBody [data-act="choice"][data-n="${k.choice[0]}"][data-i="${k.choice[1]}"]`)?.focus({preventScroll: true});
}

// ---------------------------------------------------------------- inputs

const isVoice = r => !!r?.files?.some(f => (f.mime || '').startsWith('audio/'));
const voiceAttr = r => isVoice(r) ? `data-voice="${r.id}"` : '';  // F144: words selected here can be corrected
const canUndoInput = r => r.org && r.org.ok && !r.org.undone && r.touched.length && (!r.org.keep || (r.history?.length && r.org.changed)) && r.filing?.can;  // T113 A4: while its work is as it left it
const filingTip = r => `Undo what the organizer did with ${r.id}: ${r.filing?.what || ''}`;

function inputActions(r, cls = LINK_BTN) {
  if (r.moved) return '';
  return `<button data-act="input-edit" data-id="${r.id}" class="${cls}">${ico('pencil', 'size-3.5')}Edit</button><button data-act="input-append" data-id="${r.id}" class="${cls}">${ico('plus', 'size-3.5')}Add details</button>`
    + `<button data-act="input-delete" data-id="${r.id}" title="${esc(deleteTip(r))}" class="${cls}${cls === LINK_BTN ? ' text-zinc-600 dark:text-zinc-300' : ''}">${ico('trash', 'size-3.5')}Delete</button>`  // T268: also while it is organized or its words are still coming
    + (r.history?.length ? `<button data-act="input-history" data-id="${r.id}" class="${cls}">History</button>` : '');  // last: the ones every input has keep their places (T113 A21)
}
// What became of an input, and what you can do about it now: the same on Inputs and in "You said lately" (T113 A26,
// B32), all in sight. -> [the actions for its state, the actions every input has], each a line of its own.
function inputActs(r, cls = LINK_BTN) {
  if (r.moved) return [`<a href="/p/${encodeURIComponent(r.moved.to)}/" class="${cls}">${ico('arrow', 'size-3.5', '2')}Open ${esc(r.moved.to)} · ${esc(r.moved.as)}</a>`, ''];
  const busy = S.org.busy === r.id || (!r.acked && S.org.on && !r.org), quiet = cls === LINK_BTN ? ' text-zinc-600 dark:text-zinc-300' : '';
  const now = (!r.acked && S.org.on && r.org && (!r.org.ok || r.org.undone) ? `<button data-act="retry" data-id="${r.id}" class="${cls}">${ico('loop', 'size-3.5', '2')}${r.org.undone ? 'Organize again' : 'Retry'}</button>` : '')
    + (!r.acked && !r.scope && !busy ? `<button data-act="make-item" data-id="${r.id}" class="${cls.replace(/text-zinc-500|hover:text-zinc-800/g, 'text-blue-600').replace(/dark:text-zinc-400|dark:hover:text-zinc-200/g, 'dark:text-blue-400')}">${ico('plus', 'size-3.5', '2')}Make item</button>` : '')
    + (canUndoInput(r) ? `<button data-act="undo" data-id="${r.id}" title="${esc(filingTip(r))}" class="${cls}${quiet}">${ico('undo', 'size-3.5', '2')}Undo filing</button>` : '')
    + (otherProjects().length && !busy ? `<button data-act="move-input" data-id="${r.id}" title="Sent to the wrong project? Move it" class="${cls}${quiet}">${ico('arrow', 'size-3.5', '2')}Move to…</button>` : '');
  return [now, inputActions(r, cls)];
}
// Make item's title (T113 A25): the first line, or when that is long, its first sentence, or its first words.
function shortTitle(s) {
  s = String(s || '').trim();
  if (s.length <= 80) return s;
  const m = s.slice(0, 81).match(/^.{12,79}?(?:[.!?](?=\s)|[。！？])/u);
  if (m) return m[0].replace(/[.。]$/u, '');
  const cut = s.slice(0, 80), sp = cut.lastIndexOf(' ');
  return (sp > 40 ? cut.slice(0, sp) : cut).replace(/[\s,;:，；：]+$/u, '') + '…';
}
// F177: Delete moves an input to Deleted (Settings), with the items only it made that no agent has worked on. The
// others stay and only lose it from their sources. The toast says which, with Undo; Z and Settings put it back.
const codes = ns => ns.map(code).join(', ');
const deleteTip = r => `Delete ${r.id}` + (r.drop?.go.length ? ` and ${codes(r.drop.go)}` : '') + (r.drop?.keep.length ? `; ${codes(r.drop.keep.map(k => k[0]))} ${r.drop.keep.length === 1 ? 'stays' : 'stay'}` : '');
function deletedSaid(x, id) {  // "Deleted r5 and T12, T13 · T14 kept: it has other inputs"
  if (!x) return `Deleted ${id}`;
  const k = x.kept;
  return `Deleted ${id}${x.items.length ? ` and ${x.items.map(i => i.code).join(', ')}` : ''}${k.length ? ` · ${k[0].code} kept: ${k[0].why}${k.length > 1 ? ` · ${k.length - 1} more kept` : ''}` : ''}`;
}

// Edit or add details to an input you sent (B136): the one input box does it, like a reply or a comment (I087).
// The line above the box names the input; Send saves; Esc or × stops, and what you wrote waits for next time.
function editInput(id, mode) {
  const r = byR.get(id);
  if (!r || r.moved) return;
  U.amend = {id, mode, v: r.v || 0};
  renderComposer();
  const t = $('text');
  if (mode === 'edit' && !t.value.trim()) { t.value = r.text; saveDraft(); grow(); renderComposer(); }
  if (desk() && D.compose) renderDetail();
  t.focus(); t.selectionStart = t.selectionEnd = t.value.length;
}
async function sendCorrect() {
  const c = U.correct, right = $('text').value.replace(/\s+/g, ' ').trim();
  if (!right) return $('text').focus();
  try {
    const before = byR.get(c.id)?.text, had = (await (await fetch('/api/corrections', {cache: 'no-store'})).json()).find(x => x.wrong === c.wrong);  // A3: what Undo puts back
    const d = await (await fetch(P + 'api/op', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({op: 'correct', id: c.id, wrong: c.wrong, right, v: c.v})})).json();
    if (!d.ok) return toast((d.res || []).find(x => x.startsWith('err')) || d.error || 'Not saved');
    $('text').value = ''; saveDraft(); grow(); U.correct = null; getSelection()?.removeAllRanges();
    await load();
    const run = pushUndo(`Fix “${c.wrong}” → “${right}” in ${c.id}`, async () => {  // A3: Z puts back the words and the spelling
      const r = byR.get(c.id);
      if (r && before != null && r.text !== before) await op({op: 'amend', id: c.id, mode: 'edit', v: r.v || 0, text: before});
      await setFix(had ? {wrong: c.wrong, right: had.right} : {wrong: c.wrong});
      toast(`Put back “${c.wrong}” in ${c.id}${had ? '' : ', and forgot the spelling'}`);
    });
    toast(`Fixed ${c.id}. Voice notes will write “${right}” from now on`, run);
    if (desk() && D.compose) renderDetail();
    if (desk()) $('text').focus({preventScroll: true});
    P_CACHE.fixes = null;
  } catch (_) { toast('Connection lost. Your words are still in the box; try again.'); }
}
function cancelCorrect() { U.correct = null; getSelection()?.removeAllRanges(); renderComposer(); if (desk() && D.compose) renderDetail(); }
function cancelAmend() {
  U.amend = null; renderComposer();
  if (desk() && D.compose) renderDetail();
}
async function sendAmend() {
  const a = U.amend, text = $('text').value.trim(), drafts = [...U.files];
  if (a.mode === 'dc') {  // B258
    if (!text && !dcFind(a.d, a.id)?.files?.length) return toast('Write something, or delete the comment instead');
    try { await save({op: 'dcedit', d: a.d, id: a.id, text}); } catch (_) { return; }
    $('text').value = ''; saveDraft(); grow(); U.amend = null;
    renderDoc(); renderComposer(); toast('Comment updated');
    if (desk()) $('text').focus({preventScroll: true});
    return;
  }
  if (!text && !drafts.length) return $('text').focus();
  await Promise.all(drafts.map(f => f.done));  // a voice note or screenshot goes along once uploaded (B168)
  const files = drafts.filter(f => f.f && !f.failed).map(f => ({f: f.f, name: f.name, mime: f.mime, size: f.size, tr: f.tr}));
  try {
    const d = await (await fetch(P + 'api/op', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({op: 'amend', id: a.id, mode: a.mode, v: a.v, text, files})})).json();
    if (!d.ok) return toast((d.res || []).find(x => x.startsWith('err')) || d.error || 'Not saved');
    for (const f of drafts) { f.sent = true; dropRec(f); }  // words still to come go onto the input, on the server (B165); this browser lets the recording go (T101)
    $('text').value = ''; U.files = []; saveDraft(); grow(); U.amend = null;
    await load(); toast(a.mode === 'edit' ? `${a.id} updated` : `Added to ${a.id}`);
    if (desk() && D.compose) renderDetail();
    if (desk()) $('text').focus({preventScroll: true});
  } catch (_) { toast('Connection lost. Your words are still in the box; try again.'); }
}

function inputHistory(id) {
  const r = byR.get(id);
  if (!r) return;
  const versions = [{text: r.text, t: r.updated || r.t, label: 'Current'}, ...(r.history || []).map((h, i) => ({...h, t: i ? r.history[i - 1].t : r.t, label: i ? `Version ${i + 1}` : 'Original'})).reverse()];
  dialog(`${id} history`, versions.map(h => `<section class="mb-5"><h3 class="mb-2 text-sm font-semibold">${h.label}<span class="ml-2 font-normal text-zinc-400">${when(h.t)}</span></h3><p class="whitespace-pre-wrap break-words text-[15px]">${esc(h.text)}</p></section>`).join(''));
}

function inputState(r) {  // -> [label, tone, icon]
  if (r.moved) return [`Moved to ${r.moved.to}`, 'text-zinc-500 dark:text-zinc-400', ico('arrow', 'size-3.5', '2')];
  if (r.tr_wait) return ['Transcribing…', 'text-blue-600 dark:text-blue-400', '<span class="size-1.5 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400"></span>'];  // sent before its words were in (B165)
  if (S.org.busy === r.id) return ['Organizing…', 'text-blue-600 dark:text-blue-400', '<span class="size-1.5 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400"></span>'];
  if (r.org?.undone) return ['Undone', 'text-zinc-500 dark:text-zinc-400', ico('undo', 'size-3.5', '2')];
  if (r.acked) return r.org?.keep ? ['Handled by your agent', 'text-zinc-400 dark:text-zinc-500', ico('check', 'size-3.5', '2.25')]
    : !r.org && !r.touched.length ? ['Seen by your agent', 'text-zinc-500 dark:text-zinc-400', ico('check', 'size-3.5', '2.25')] : ['Organized', 'text-emerald-700 dark:text-emerald-400', ico('check', 'size-3.5', '2.25')];
  if (r.org && !r.org.ok) return ['Organizer failed', 'text-red-600 dark:text-red-400', ico('alert', 'size-3.5', '2')];  // T232 #5: only while nobody handled it
  if (r.org) return ['Left for your agent', 'text-zinc-600 dark:text-zinc-300', ico('arrow', 'size-3.5', '2')];
  return [S.org.on ? 'Queued' : 'Waiting for your agent', 'text-zinc-600 dark:text-zinc-300', ico('hourglass', 'size-3.5', '2')];
}

const long = r => r.text.length > 160 || r.text.split('\n').length > 4;  // show four lines, the rest on demand
const dayOf = t => { const d = new Date(t), now = new Date(); return d.toDateString() === now.toDateString() ? 'Today' : new Date(now - 864e5).toDateString() === d.toDateString() ? 'Yesterday' : d.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}); };
// What you said, newest first, under day headers: your words in a light blue bubble, what became of them under it.
function renderInputs() {
  const words = searchWords(), v = $('inputsView');
  // On the desktop the newest input sits at the bottom, next to the box you write in, as in a chat (F121); the page
  // opens at the end and stays there while you are at the end. The phone keeps the newest on top.
  const chat = desk(), atEnd = U.inputsEnd || v.scrollHeight - v.scrollTop - v.clientHeight < 48;
  const rows = (chat ? [...S.inputs] : [...S.inputs].reverse()).filter(r => inputMatch(r, words)), more = searchHints(rows.length);  // more: A9
  if (desk()) renderDeskHead();  // the title's count follows the search as you type (B18)
  let day = '';
  $('inputsView').innerHTML = rows.length ? rows.map(r => {
    const [label, tone, icon] = inputState(r), scope = r.scope ? byN.get(r.scope) : null, d = dayOf(r.t);
    const head = d !== day ? `<div class="px-4 pt-2.5 pb-0.5 text-xs font-semibold text-zinc-500 lg:px-0 lg:pt-5 lg:pb-1 dark:text-zinc-400">${(day = d)}</div>` : '';
    // The organizer's "Created B224" over a B224 chip named the item twice (T225 #18 follow-up): the chip says what was
    // done with its item ("Created B224 …"), and the line above keeps only what no chip says.
    const shown = r.moved ? [] : r.touched.filter(n => byN.has(n) && n !== r.scope), did = {}, rest = [];
    for (const part of (r.org?.msg || '').split(' · ').map(p => p.trim()).filter(Boolean)) {
      const m = /^(.+?) ([A-Z]\d+)$/.exec(part), n = m && parseRef(m[2]);
      if (n && shown.includes(n)) did[n] ||= m[1]; else rest.push(part);  // the same item said again ("Updated R141 · Updated R141"): once
    }
    const org = !r.moved && r.org && !(r.acked && r.org.keep);
    const told = p => p.toLowerCase() === label.toLowerCase() || (/^Left for your/.test(p) && /^Left for your/.test(label));  // the status at the top says it already (T225 #18 follow-up 2)
    const left = rest.filter(p => !told(p));
    const note = org && left.length ? `<div class="mt-1.5 flex min-h-5 items-center gap-1 text-xs ${r.org.ok ? 'text-zinc-500 dark:text-zinc-400' : 'text-red-600 dark:text-red-400'}">${ico('sparkle', 'size-3.5')}<span class="min-w-0">${esc(left.join(' · '))}</span></div>` : '';
    const spark = org && !note && shown.some(n => did[n]) ? `<span class="grid h-8 shrink-0 place-items-center text-zinc-400 dark:text-zinc-500">${ico('sparkle', 'size-3.5')}</span>` : '';  // the organizer's mark, on the chips' first line
    const chips = shown.map(n => `<button data-act="goto" data-n="${n}" class="${HIT} flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-lg bg-zinc-100 px-2 text-[13px] hover:bg-zinc-200/70 dark:bg-zinc-800 dark:hover:bg-zinc-700">${did[n] ? `<span class="shrink-0 text-zinc-500 dark:text-zinc-400">${esc(did[n])}</span>` : ''}<span class="font-mono text-xs font-bold ${TYPE_TEXT[byN.get(n).type]}">${code(n)}</span><span class="truncate">${esc(byN.get(n).title)}</span></button>`).join('');
    // T232 #1: on the phone one row of actions (a row of its own for Move to… cost each input a line); the desktop
    // keeps two lines, so Edit and Add details stay in their places (T113 A21)
    const parts = inputActs(r).filter(Boolean);
    const acts = parts.length ? `<div class="mt-1 flex flex-wrap items-center gap-y-1.5 max-lg:[&_:is(button,a)]:px-1.5 lg:block">${parts.map(a => `<div class="contents lg:mt-1 lg:flex lg:flex-wrap lg:items-center lg:gap-x-1 lg:gap-y-1.5">${a}</div>`).join('')}</div>` : '';
    // On the desktop each input is a ledger line: what you said on the left, what became of it on the right.
    return `${head}<article data-r="${r.id}" class="border-b border-zinc-100 px-4 py-2 transition-colors duration-700 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10 lg:px-0 lg:py-4 dark:border-zinc-800/70"><div class="min-w-0">
      <div class="flex min-h-5 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400"><span class="shrink-0 font-mono">${r.id}</span><span class="shrink-0 whitespace-nowrap">${when(r.t)}</span>${r.from === 'rules' ? '<span class="font-medium">as a rule</span>' : ''}
        ${scope ? `<button data-act="goto" data-n="${scope.n}" class="relative min-w-0 truncate text-blue-600 after:absolute after:inset-x-0 after:-inset-y-3.5 hover:underline dark:text-blue-400">↳ ${code(scope.n)} ${esc(scope.title)}</button>` : ''}
        <span class="ml-auto flex shrink-0 items-center gap-1 font-medium lg:hidden ${tone}">${icon}${label}</span></div>
      <div ${long(r) ? `data-act="more-input" data-expand data-id="${r.id}"` : ''} ${voiceAttr(r)} class="mt-1.5 rounded-2xl rounded-tr-md bg-blue-50 px-3.5 py-2 text-[15px] leading-relaxed text-zinc-900 dark:bg-blue-400/10 dark:text-zinc-100 ${long(r) ? 'cursor-pointer' : ''}">
        ${r.text ? rich(r.text, 'in' + r.id, long(r) && !U.moreInputs.has(r.id) ? 'max-h-28 overflow-hidden' : '') : ''}
        ${long(r) ? `<button data-act="more-input" data-id="${r.id}" class="-my-2 flex h-11 items-center text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">${U.moreInputs.has(r.id) ? 'Less' : 'More'}</button>` : ''}
        ${r.files.length ? `<div class="mt-2 flex items-end gap-2 overflow-x-auto lg:scrollbar-thin">${thumbs(r.files, 'in' + r.id, 'size-11')}</div>` : ''}
      </div></div><div class="min-w-0 lg:pt-6">
      <div class="hidden items-center gap-1.5 text-[13px] font-semibold lg:flex ${tone}">${icon}${label}</div>
      ${note}${chips ? `<div class="mt-1 flex items-start gap-1.5">${spark}<div class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">${chips}</div></div>` : ''}${acts}
    </div></article>`;
  }).join('') + (more ? `<div class="flex flex-col py-4">${more}</div>` : '') : U.outbox.length ? '' : EMPTY(words.length ? 'No matching inputs' : 'No inputs yet.', more ? `<span class="mt-3 flex flex-col">${more}</span>` : '');
  if (U.outbox.length && !words.length) $('inputsView').innerHTML = chat ? $('inputsView').innerHTML + outboxRows(true) : outboxRows() + $('inputsView').innerHTML;
  if (chat && atEnd) requestAnimationFrame(() => { v.scrollTop = v.scrollHeight; });
  U.inputsEnd = false;
  if (desk() && (rows.length || U.outbox.length)) $('inputsView').innerHTML = `<div class="mx-auto max-w-5xl px-8 pb-6"><div class="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_20rem] gap-10 border-b border-zinc-200 bg-white pt-5 pb-2 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase dark:border-zinc-800 dark:bg-zinc-950"><span>You said</span><span>What became of it</span></div>${$('inputsView').innerHTML}</div>`;
}

// ---------------------------------------------------------------- composer

// On the desktop the selected item counts only while its pane shows (not on Inputs or the project page).
const detailShown = () => !desk() || (U.tab !== 'inputs' && !D.page);
// A new input written on the Rules tab is a new rule unless you switch that off; the box and the New input page
// say which, and only "New rule" tells the organizer it is a rule (F121).
const ruleMode = () => U.asRule ?? U.tab === 'rules';
const ruleFlip = () => U.tab === 'rules' ? scopeLink('as-rule', ruleMode() ? 'Plain input instead' : 'As a rule instead') : '';
const inTab = (it, t) => t === 'rules' ? it.type === 'rule' && !it.archived : t === 'archive' ? it.archived : !it.archived && (it.type !== 'rule' || it.status === 'proposed');
const scopeN = () => (U.peek && byN.has(U.peek)) ? U.peek : (U.open && !U.scopeOff && byN.has(U.open) && detailShown()) ? U.open : null;
// Voice notes work wherever the browser lets a page use the microphone: https (the phone link goes through the
// tunnel) or localhost. On plain http, such as a LAN address like http://server.local:7340, no page gets it (B166):
// the mic still shows, in its place, and a press says so and offers Taska's https link.
const canRecord = () => !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
function voiceWhy() {  // why the mic can't record here, in the line above the box (no popup: R139)
  if (window.isSecureContext) return toast('This browser can’t record voice notes');
  const link = S.remote ? S.remote + '/' : '', a = 'flex h-11 shrink-0 items-center rounded-full px-2 font-semibold text-blue-600 dark:text-blue-400';
  U.note = `${ico('mic', 'size-4 shrink-0 text-zinc-500 dark:text-zinc-400')}<span class="min-w-0 flex-1 py-1 leading-snug">${link
    ? 'Voice needs a secure link, and this address is plain http. Open Taska’s https link to record:'
    : 'Voice needs a secure link: https, or localhost on this computer. This address is plain http, and Taska has no https link yet (start it with <code class="whitespace-nowrap">--public</code>).'}</span>`
    + (link ? `<a href="${esc(link)}" target="_blank" rel="noopener" class="-my-2 ${a}">Open</a><button data-act="copy-text" data-text="${esc(link)}" class="-my-2 ${a}">Copy</button>` : '');
  renderFeedback();
}

// The one input box (B164), built like ChatGPT's or Codex's and the same in every state: the line on top says what it
// writes to, then the files, then one row. On the left + (× while recording: discard); in the middle the text, or
// the recording in the very same place and size; on the right one round button that never moves: the mic while
// the box is empty, Send as soon as there is something to send, ✓ while recording (stop, the words go into the
// box). The quiet button next to it does the other thing: the mic while you write, send-at-once while recording.
// On the desktop one line under the box says what the keys do right now.
const scopeLink = (act, text, key = '', title = '') => `<button data-act="${act}" ${title ? `title="${title}"` : ''} class="${HIT} -my-1 flex h-8 shrink-0 items-center rounded-full px-2 text-[13px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">${text}${key ? KBD(key) : ''}</button>`;
const scopeX = (act, label) => `<button data-act="${act}" aria-label="${label}" title="${label} · Esc" class="-my-1.5 grid size-11 shrink-0 place-items-center rounded-full text-zinc-400 hover:text-zinc-800 lg:size-8 lg:hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-zinc-200 dark:lg:hover:bg-zinc-800">${ico('x', 'size-4')}</button>`;
function scopeLine(icon, label, detail, right = '') {  // on the desktop it starts with the project (B78): "[M] my-app ›"
  const proj = desk() && S.project ? `<span class="mr-0.5 flex shrink-0 items-center gap-1.5 font-semibold text-zinc-800 dark:text-zinc-100">${projTile(S.project, 'size-[18px] rounded-[5px] text-[10px]')}<span class="max-w-40 truncate">${esc(projTitle())}</span><span class="font-normal text-zinc-300 dark:text-zinc-600">›</span></span>` : '';
  return `${proj}${ico(icon, 'size-3.5 text-zinc-400 dark:text-zinc-500')}<span class="min-w-0 flex-1 truncate"><span class="font-medium text-zinc-800 dark:text-zinc-100">${label}</span>${detail ? ` ${detail}` : ''}</span>${right}`;
}
function boxBtn(b, act, icon, label, tip, iconCls = 'size-6 lg:size-5', sw = '1.75') {  // one of the box's three buttons takes a role
  if (b.dataset.act !== act || b.dataset.icon !== icon) { b.dataset.act = act; b.dataset.icon = icon; b.innerHTML = ico(icon, iconCls, sw); }
  b.setAttribute('aria-label', label); b.dataset.tip = desk() ? tip : '';
}
const boxKeys = (keys, rest = '') => keys.map(([k, what]) => `${KBD(k)}<span>${what}</span>`).join('<span class="px-0.5">·</span>') + (rest ? `<span class="px-0.5">·</span><span>${rest}</span>` : '');
const ticked = n => n && U.choice?.n === n && U.choice.picked.size ? [...U.choice.picked].sort((a, c) => a - c).map(i => (U.choiceLabels[n] || [])[i]).filter(Boolean) : [];

// Drawn again only when it changed: the box is drawn on every keystroke and every refresh, and a redraw between the
// press and the release of a button loses the click (the "... instead" links, a voice note's x, a toggle).
function paint(el, html) { if (el.dataset.html !== html || el.innerHTML === '' && html) { el.dataset.html = html; el.innerHTML = html; } }
function renderComposer() {
  if (S.project && draftKey() !== U.draftKey) swapDraft(draftKey());
  const n = scopeN(), it = n && byN.get(n), dt = docTarget(), dOpen = !U.correct && !U.amend && !dt && docOpen(), t = $('text'), ticks = U.correct || U.amend || dt || dOpen ? [] : ticked(n);
  if (U.fbFor !== (n || null)) { U.fbFor = n || null; renderFeedback(); }  // T225 #1: the box writes elsewhere now: the "Sent" line about the other item goes
  const vcd = !U.correct && !U.amend && docOpen(), vcN = vcd ? vcCount(t.value) : 0;  // F184: voice comments collected in the box
  let line = '', ph = S.project ? `Write to ${projTitle()}…` : 'Write anything…', send = 'Send';  // the box says whom it writes to, on the phone too (B157)
  if (U.prefsEdit) {  // F183: how voice notes are written down, for every project
    line = scopeLine('pencil', 'Edit transcription preferences', '· every project', scopeX('prefs-cancel', 'Stop editing'));
    ph = 'How voice notes should be written down…'; send = 'Save';
  } else if (U.correct && byR.has(U.correct.id)) {  // F144: correcting a few words of a voice note
    const right = t.value.replace(/\s+/g, ' ').trim();  // A3: before → after, as you type
    line = scopeLine('pencil', `Correct “${esc(U.correct.wrong)}”${right ? ` → “${esc(right.slice(0, 60))}”` : ''}`, `in ${U.correct.id} · remembered for every project`, scopeX('correct-cancel', 'Stop correcting'));
    ph = `The right words for “${U.correct.wrong}”…`; send = 'Save';
  } else if (U.amend?.mode === 'dc') {  // B258: editing a comment of yours on a document
    line = scopeLine('pencil', `Edit your comment on D${U.amend.d}`, oneLine(U.amend.was) ? `“${esc(oneLine(U.amend.was).slice(0, 120))}”` : '', scopeX('amend-cancel', 'Stop editing'));
    ph = 'Edit your comment…'; send = 'Save';
  } else if (U.amend && byR.has(U.amend.id)) {  // B136: editing or adding to an input you sent
    const r = byR.get(U.amend.id), edit = U.amend.mode === 'edit';
    line = scopeLine(edit ? 'pencil' : 'listplus', `${edit ? 'Edit' : 'Add details to'} ${r.id}`, oneLine(r.text) ? `“${esc(oneLine(r.text).slice(0, 120))}”` : `· ${isVoice(r) ? 'a voice note' : plural(r.files.length, 'file')}`, scopeX('amend-cancel', edit ? 'Stop editing' : 'Stop adding details'));
    ph = edit ? `Edit ${r.id}…` : `Add details to ${r.id}…`; send = 'Save';
  } else if (vcN) {  // F184: one send posts each quote's words as a comment on its passage
    line = scopeLine('comment', `${plural(vcN, 'comment')} on D${vcd.d}`, '· one send posts each on its passage', '');
    ph = 'Words for the comments…'; send = vcN > 1 ? `Post ${vcN} comments` : 'Post the comment';
  } else if (dt) {  // I087: a comment on a document
    line = scopeLine(dt.reply ? 'reply' : 'comment', `${dt.reply ? 'Reply in' : 'Comment on'} D${dt.d.d}`, dt.many > 1 ? `· ${dt.many} paragraphs` : dt.quote ? `“${esc(plainQuote(dt.quote).slice(0, 120))}”` : '', scopeX('doc-unpick', 'Cancel the comment'));
    ph = `${dt.reply ? 'Reply in' : 'Comment on'} D${dt.d.d}…`; send = dt.reply ? 'Reply' : 'Comment';  // the same words as the line (T225 #16)
  } else if (dOpen) {  // B247: a document open and nothing picked: a comment on the whole document (never a reply to the item, B2)
    const host = liveN(dOpen.n);
    line = desk() ? scopeLine('comment', `Comment on D${dOpen.d}`, '· the whole document, or click a paragraph', byN.has(host) ? scopeLink('doc-to-item', `Reply to ${code(host)} instead`) : '')
      : scopeLine('comment', `Comment on D${dOpen.d}`, '· or tap a part', byN.has(host) ? scopeLink('doc-to-item', `Reply to ${code(host)}`, '', `Reply to ${code(host)} instead`) : '');  // fits a phone (T225 #14)
    ph = `Comment on D${dOpen.d}…`; send = 'Comment';
  } else if (n) {  // B83: a reply says so; the choices you ticked go with it (B145)
    // B266: the box itself says "Reply to F06…": the line above it doesn't say it again; it keeps the choices you ticked
    // and the way to send it to the whole project instead
    const instead = desk() ? scopeLink('new-input-instead', 'New input instead', '', 'What you wrote becomes a new input to the whole project') : scopeLink('unscope', 'New input instead', '', 'Send to the whole project instead');  // a word, not a bare ×
    line = ticks.length ? scopeLine(desk() ? 'reply' : 'scope', `Reply to ${code(n)}`, ticks.map(l => '✓ ' + esc(oneLine(l))).join(' · '), instead) : `<span class="min-w-0 flex-1"></span>${instead}`;
    ph = `Reply to ${code(n)}…`;
    if (U.ask === n) ph = `What is missing in ${code(n)}?`;  // after Not yet (B153)
    if (ticks.length) send = 'Send answer';
  } else if (ruleMode()) {
    line = scopeLine('scope', 'New rule for this project', '', ruleFlip());  // the phone has the switch too (B156)
    if (S.project) ph = `New rule for ${projTitle()}…`;
  } else if (desk()) line = scopeLine('inbox', 'New input', `· ${S.org?.on ? 'the organizer files it' : 'your agent files it'}`,
    ruleFlip() + (U.open && detailShown() ? scopeLink('reply-instead', `Add to ${code(U.open)} instead`, 'R') : ''));
  else if (U.tab === 'rules') line = scopeLine('inbox', 'New input', '· not a rule', ruleFlip());
  if (R.rec && R.key && R.key !== U.draftKey) line = scopeLine('mic', `Recording for ${esc(draftName(R.key))}`, '· it goes there when you stop');  // B1
  $('scope').hidden = !line; paint($('scope'), line); t.placeholder = ph;
  const d = $('drafts');
  d.hidden = !U.files.length;
  paint(d, U.files.map((f, i) => `<div class="relative shrink-0">${(f.mime || '').startsWith('audio/')
      ? `<div class="flex h-16 items-center gap-2 rounded-xl border border-zinc-200 px-3 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">${ico('mic', 'size-4')}<span class="font-mono tabular-nums">${clock(f.ms || 0)}</span><span class="font-semibold ${f.transcribing ? 'animate-pulse text-blue-600 dark:text-blue-400' : f.more ? 'max-w-40 leading-snug text-amber-700 dark:text-amber-400' : f.tr ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'}">${f.transcribing ? (f.retrying ? 'Retrying…' : 'Transcribing…') : f.more ? 'May be cut short · fuller words on the way' : f.tr ? 'Transcribed' : f.tr_error ? 'No transcript, audio still sent' : 'No words heard, audio still sent'}</span></div>`
      : (f.mime || '').startsWith('image/')
      ? `<button data-act="view-draft" data-i="${i}" aria-label="Look at ${esc(f.name)}" class="block cursor-zoom-in rounded-xl"><img src="${f.preview || P + 'f/' + encodeURIComponent(f.f)}" alt="" class="size-16 rounded-xl border border-zinc-200 object-cover dark:border-zinc-700 ${f.f ? '' : 'opacity-40'}"></button>`
      : `<div class="flex h-16 w-28 items-center gap-1 rounded-xl border border-zinc-200 px-2 text-xs dark:border-zinc-700 ${f.f ? '' : 'opacity-40'}">${ico('file', 'size-4')}<span class="line-clamp-2 break-all">${esc(f.name)}</span></div>`}
    <button data-act="unfile" data-i="${i}" aria-label="Remove ${esc(f.name)}" class="absolute -top-3.5 -right-3.5 grid size-11 place-items-center"><span class="grid size-6 place-items-center rounded-full bg-zinc-900 text-white ring-2 ring-white dark:bg-zinc-100 dark:text-zinc-900 dark:ring-zinc-900">${ico('x', 'size-3.5', '2.5')}</span></button></div>`).join(''));
  // T101: where the two transcriptions disagree on what changes the meaning, said under the voice note before you send
  // F186: on the New input page they are marked in the draft below, on the phone in the box itself, both as toggles;
  // a reply box on the desktop (no draft there) keeps one line each.
  const words = $('text').value, spots = U.files.flatMap((f, i) => (f.doubts || []).map((x, k) => ({i, k, x}))).filter(({x}) => !x.pick && words.includes(x.was));
  const toCheck = spots.filter(({x}) => x.alt).length, alert = ico('alert', 'size-3.5 shrink-0 text-amber-600 dark:text-amber-400', '2');
  const pickable = !desk() && draftSpots(words).some(p => p.x.alt), view = pickable && U.boxView && !R.rec;
  paint($('doubts'), desk() && D.compose ? (toCheck ? `<p class="flex min-h-8 items-center gap-1.5">${alert}<span class="min-w-0">${plural(toCheck, 'word')} may be misheard. They are marked in the draft below: pick there.</span></p>` : '')
    : !desk() ? (pickable ? `<p class="flex min-h-8 items-start gap-1.5 py-1">${alert}<span class="min-w-0">${toCheck ? `<b class="font-semibold text-zinc-800 dark:text-zinc-100">${plural(toCheck, 'word')} to check.</b> Left: main model, right: the other. A tap changes every place.` : 'Picked. Tap the other side to switch back before you send.'}${view ? '' : ` <button data-act="box-view" class="${LINK_BTN} -my-2 inline-flex">Show them</button>`}</span></p>` : '')
    : spots.map(({i, k, x}) => { const [said, heard] = x.show || [x.was, x.alt]; return `<p class="flex min-h-8 items-center gap-1.5">${alert}<span class="min-w-0">Maybe misheard: “${esc(unmarked(said))}”${x.alt ? ` — the other model heard “${esc(heard)}”${x.also?.length ? ` (${x.also.length + 1} places)` : ''} ·` : ' — the model was not sure'}</span>${x.alt ? `<button data-act="doubt-use" data-i="${i}" data-k="${k}" class="${LINK_BTN} -my-1 -ml-1.5 shrink-0">Use it</button>` : ''}</p>`; }).join(''));
  $('doubts').hidden = !$('doubts').innerHTML;
  $('boxView').hidden = !view;
  if (view) paint($('boxView'), draftHtml(words));
  // The three buttons. While recording the textarea keeps its place (unseen), so the box keeps its size.
  const rec = !!R.rec, has = !!(t.value.trim() || U.files.length);  // T225 #19: ticked choices alone are sent by the question's own Send answer, not a second button here
  const micTip = !window.isSecureContext ? 'Voice needs an https link here: press for it' : D.compose ? 'Record a voice note · ⌥V' : 'Record a voice note · V, or ⌥V while typing';
  boxBtn($('attachBtn'), rec ? 'rec-cancel' : 'attach', rec ? 'x' : 'plus', rec ? 'Discard the recording' : 'Add images or files', rec ? 'Discard · Esc' : 'Add images or files');
  const sb = $('sendBtn'), recSend = [aux => boxBtn(aux, 'rec-send', 'up', 'Stop and send', 'Stop and send · ⇧↵', 'size-5', '2'), b => boxBtn(b, 'rec-stop', 'check', 'Stop recording, words into the box', 'Words into the box · ↵', 'size-5', '2.5')];
  // F221, B248: a second tap or click where you started recording sends it, in every box, on the phone and the desktop;
  // the other button stops it into the box (Enter does that too, ⇧Enter sends).
  const sendAtStart = rec, started = R.from === 'aux' ? 'aux' : 'main';
  if (rec) recSend[sendAtStart && started === 'main' ? 0 : 1](sb);
  else if (has) boxBtn(sb, 'send', 'up', `${send} (Shift + Enter)`, `${send} · ⇧↵`, 'size-5', '2.25');
  else boxBtn(sb, 'mic', 'mic', 'Record a voice note', micTip);
  const aux = $('micBtn'), quiet = rec || has;
  if (rec) recSend[sendAtStart && started === 'main' ? 1 : 0](aux);
  else if (quiet) boxBtn(aux, 'mic', 'mic', 'Record a voice note', micTip, 'size-5');
  aux.hidden = !quiet;  // only beside a box with something in it: the round button never moves, the text never jumps
  t.classList.toggle('invisible', rec || view); $('recBar').hidden = !rec;
  $('boxHint').innerHTML = !desk() ? '' : rec ? boxKeys([['↵', 'words into the box'], ['⇧↵', 'stop and send'], ['Esc', 'discard']])
    : U.correct || U.amend || U.prefsEdit ? boxKeys([['⇧↵', 'save'], ['Esc', 'stop']])
    : vcN ? boxKeys([['⇧↵', send.toLowerCase()]], 'select more text for another voice comment')
    : dt ? boxKeys([['⇧↵', send.toLowerCase()], ['Esc', 'cancel']])
    : dOpen ? boxKeys([['⇧↵', 'comment on the whole document'], ['Esc', `back to ${code(liveN(dOpen.n))}`]], 'or click a paragraph first')
    : U.files.some(f => f.transcribing) ? boxKeys([['⇧↵', 'send now']], 'the words follow by themselves')
    : boxKeys([['⇧↵', ticks.length ? 'send the answer' : 'send'], ['↵', 'new line'], ['⌥V', 'voice']], 'paste or drop screenshots');
  if ($('overlay').dataset.above && !$('overlay').hidden) $('overlay').style.bottom = $('composer').parentElement.offsetHeight + 'px';  // a sheet over the page stays above the box: its line too
  vcPlace(); renderDraft();
}

const outboxLine = q => q.text.split('\n')[0] || (q.files.some(f => (f.mime || '').startsWith('audio/')) ? 'Voice note' : `${q.files.length} file${q.files.length === 1 ? '' : 's'}`);
// What is still on its way, shown first where your inputs are listed (F85).
const outboxRows = (oldestFirst = false) => (oldestFirst ? [...U.outbox] : [...U.outbox].reverse()).map(q => `<article class="border-b border-zinc-100 px-4 py-2 lg:px-0 lg:py-4 dark:border-zinc-800/70">
    <div class="flex min-h-5 items-center gap-2 text-xs ${q.failed ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}">${q.failed ? ico('alert', 'size-3.5', '2') : '<span class="size-1.5 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400"></span>'}<span class="font-medium">${q.failed ? 'Not sent' : q.files.some(f => !f.f && !f.failed) ? 'Uploading…' : 'Sending…'}</span>${q.scope ? `<span class="min-w-0 truncate text-zinc-500 dark:text-zinc-400">↳ ${esc(q.scope)}</span>` : ''}</div>
    <div class="mt-1.5 rounded-2xl rounded-tr-md bg-blue-50 px-3.5 py-2 text-[15px] leading-relaxed whitespace-pre-wrap text-zinc-900 opacity-70 lg:max-w-[calc(100%-22.5rem)] dark:bg-blue-400/10 dark:text-zinc-100">${esc(q.text || outboxLine(q))}${q.files.some(f => f.preview) ? `<div class="mt-2 flex gap-2">${q.files.filter(f => f.preview).map(f => `<img src="${f.preview}" alt="" class="size-11 rounded-lg border border-zinc-200 object-cover dark:border-zinc-700">`).join('')}</div>` : ''}</div></article>`).join('');
const otherProjects = () => (DR.list || []).filter(p => p.name !== S.project);
// An input sent to the wrong project goes to another one (F79). It is organized again there; what the organizer
// made of it here is undone. Items your agent made from it stay, and the dialog says so.
async function moveInput(rid) {
  const r = byR.get(rid);
  if (!r) return;
  checkOthers.t = 0; await checkOthers();
  const others = otherProjects(), made = r.touched.filter(n => n !== r.scope && byN.has(n) && !byN.get(n).archived);
  const byOrg = r.org && r.org.ok && !r.org.undone && !r.org.keep;
  const list = made.map(n => `${code(n)} ${esc(byN.get(n).title)}`).join(', ');
  dialog(`Move ${rid} to another project`, `<div class="flex flex-col gap-3">
    <p class="line-clamp-3 rounded-xl bg-blue-50 px-3 py-2 text-[15px] leading-snug break-words text-zinc-900 dark:bg-blue-400/10 dark:text-zinc-100">${esc(r.text) || `${r.files.length} file${r.files.length === 1 ? '' : 's'}`}</p>
    <div class="-mx-1 flex flex-col gap-0.5">${others.map(p => `<button data-act="move-input-to" data-id="${rid}" data-to="${esc(p.name)}" class="flex h-12 items-center gap-3 rounded-xl px-3 text-left hover:bg-zinc-100 data-pressed:bg-zinc-100 dark:hover:bg-zinc-800 dark:data-pressed:bg-zinc-800">${projTile(p.name, 'size-7 rounded-lg text-xs')}<span class="min-w-0 flex-1 truncate font-medium">${esc(titleOf(p))}</span><span class="text-xs text-zinc-400">${p.open} open</span></button>`).join('') || '<p class="px-3 text-sm text-zinc-500">There is no other project.</p>'}</div>
    <p class="text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">It goes there with its files and is organized again.${made.length ? byOrg ? ` What the organizer made of it here is undone: ${list}.` : ` Items made from it here stay: ${list}.` : ''}${r.scope && byN.has(r.scope) ? ` It also leaves the conversation of ${code(r.scope)}.` : ''}</p></div>`);
}

function renderFeedback() {
  const fb = $('feedback'), q = U.outbox[0]?.quiet && !U.outbox[0].failed ? null : U.outbox[0];  // a note that went with a decision: its toast said it (T113 A19)
  fb.classList.toggle('lg:group-data-[compose]/app:hidden', !U.note);  // the New input page shows its own list, but not this
  if (U.note) { fb.hidden = false; fb.innerHTML = U.note + `<button data-act="dismiss" aria-label="Dismiss" class="-my-2 grid size-11 shrink-0 place-items-center rounded-full text-zinc-400">${ico('x', 'size-3.5', '2')}</button>`; return; }
  let r = U.lastSent && byR.get(U.lastSent);
  if (r && (r.scope && byN.has(r.scope) ? code(r.scope) : null) !== (scopeN() ? code(scopeN()) : null)) r = null;  // B129: only where it went
  const link = (act, label, attrs) => `<button data-act="${act}" ${attrs} class="-my-2 h-11 shrink-0 rounded-full px-2 font-semibold text-blue-600 dark:text-blue-400">${label}</button>`;
  fb.hidden = !r && !q;
  if (q) {  // still on its way (F85): say so, and never lose it
    const more = U.outbox.length > 1 ? ` (+${U.outbox.length - 1})` : '';
    clearTimeout(renderFeedback.t);
    fb.innerHTML = q.failed
      ? `${ico('alert', 'size-4 text-red-600 dark:text-red-400', '2')}<span class="min-w-0 flex-1 truncate text-red-600 dark:text-red-400">Not sent${more}: ${esc(outboxLine(q))}</span>${link('outbox-retry', 'Retry', '')}${link('outbox-edit', 'Edit', '')}`
      : `<span class="size-2 shrink-0 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400"></span><span class="min-w-0 flex-1 truncate">${q.files.some(f => !f.f && !f.failed) ? 'Uploading, then sending' : 'Sending'}${more}: ${esc(outboxLine(q))}</span>${unsendBtn(q)}`;
    return;
  }
  if (!r) return;
  let html;
  const move = otherProjects().length && !r.scope ? link('move-input', 'Move to…', `data-id="${r.id}"`) : '';  // sent to the wrong project? (F79) Not a reply: it went to an item here (T113 A19)
  if (r.moved) html = `${ico('arrow', 'size-4 text-zinc-500', '2')}<span class="min-w-0 flex-1 truncate">Moved ${r.id} to ${esc(r.moved.to)} as ${esc(r.moved.as)}</span><a href="/p/${encodeURIComponent(r.moved.to)}/" class="-my-2 flex h-11 shrink-0 items-center rounded-full px-2 font-semibold text-blue-600 dark:text-blue-400">Open</a>`;
  else if (r.tr_wait) html = `<span class="size-2 shrink-0 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400"></span><span class="min-w-0 flex-1 truncate">Sent. Its voice note's words come next…</span>`;  // sent before they were in (B165)
  else if (S.org.busy === r.id || (!r.acked && S.org.on && !r.org)) html = `<span class="size-2 shrink-0 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400"></span><span class="min-w-0 flex-1 truncate">Sent, organizing…</span>`;
  else if (r.org && !r.org.ok) html = `${ico('alert', 'size-4 text-red-600 dark:text-red-400', '2')}<span class="min-w-0 flex-1 truncate text-red-600 dark:text-red-400">Organizer failed: ${esc(r.org.msg)}</span>${link('retry', 'Retry', `data-id="${r.id}"`)}`;
  else if (r.org?.undone) html = `<span class="min-w-0 flex-1 truncate">Undid the changes for ${r.id}</span>`;
  else if (r.acked) html = `<span class="grid size-4 shrink-0 place-items-center rounded-full bg-emerald-500 text-white dark:bg-emerald-400 dark:text-emerald-950">${ico('check', 'size-3', '3')}</span><span class="min-w-0 flex-1 truncate">${esc(r.org?.msg || (r.touched.length ? 'Organized' : 'Seen by your agent, no item made'))}</span>${r.touched.length ? link('goto', 'View', `data-n="${r.touched[0]}"`) : ''}${r.org && r.org.ok && !r.org.undone && !r.org.keep && r.touched.length ? link('undo', 'Undo', `data-id="${r.id}"`) : ''}${move}`;
  else html = `<span class="size-2 shrink-0 rounded-full bg-zinc-400"></span><span class="line-clamp-2 min-w-0 flex-1 leading-snug">Sent. ${r.org ? 'Left for your agent' : 'Waiting for your agent'}</span>${unsendBtn((U.sentJobs || []).find(j => j.rid === r.id))}${move}`;  // T113 A27
  const final = r.acked || (r.org && r.org.ok) || r.moved;
  clearTimeout(renderFeedback.t);
  if (final) renderFeedback.t = setTimeout(() => { if (U.lastSent === r.id) { U.lastSent = null; renderFeedback(); } }, 6000);
  fb.innerHTML = html + `<button data-act="dismiss" aria-label="Dismiss" class="-my-2 grid size-11 shrink-0 place-items-center rounded-full text-zinc-400">${ico('x', 'size-3.5', '2')}</button>`;
}

function grow() {  // empty = one line from the classes; measuring a placeholder before styles load makes it tall
  const t = $('text'); t.style.height = '';
  if (t.value) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, desk() && D.compose ? 320 : 192) + 'px'; }
  // T231: past one line the words take the box's whole width; + and the buttons go to a row under them
  const multi = !!t.value && (t.value.includes('\n') || t.scrollHeight > 52);
  if (multi !== $('composer').hasAttribute('data-multi')) { $('composer').toggleAttribute('data-multi', multi); if (multi) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 192) + 'px'; } }
}

async function addFiles(list) {
  for (const file of list) {
    const f = {name: file.name || 'paste.png', mime: file.type || 'application/octet-stream'};
    let settle; f.done = new Promise(r => { settle = r; });  // a sent input waits for its files, not the box (F85)
    if (f.mime.startsWith('image/')) f.preview = URL.createObjectURL(file);
    U.files.push(f); renderComposer();
    try {
      const r = await fetch(P + 'api/file?name=' + encodeURIComponent(f.name), {method: 'POST', headers: {'Content-Type': f.mime}, body: file});
      if (!r.ok) throw new Error();
      Object.assign(f, await r.json());
    } catch (_) { const i = U.files.indexOf(f); if (i >= 0) U.files.splice(i, 1); f.failed = true; toast('Upload failed: ' + f.name); }
    settle(); renderComposer();
  }
}

// Sending never holds the box (F85): what you wrote goes into the outbox, the box is empty at once for the next
// thought, and the outbox sends in order as soon as each input's uploads and transcripts are in.
async function send() {
  if (R.rec) return finishRec(true);
  if (U.prefsEdit) return sendPrefs();  // F183
  if (U.correct) return sendCorrect();  // F144
  if (U.amend) return sendAmend();  // details for an input you sent (B136)
  if (docOpen() && vcCount($('text').value)) return sendVoiceComments();  // F184
  const dt = docTarget();
  if (dt) return sendDocComment(dt);  // a document comment (I087)
  const od = docOpen();
  if (od) return sendDocComment({d: od, key: 'doc', whole: true});  // B247: nothing picked: on the whole document (never a reply to the item, B2)
  const n = scopeN(), ch = n && U.choice?.n === n && U.choice.picked.size  // B145: ticked choices go with what you wrote
    ? [...U.choice.picked].sort((a, c) => a - c).map(i => '✓ ' + (U.choiceLabels[n] || [])[i]).join('\n') : '';
  const text = [ch, $('text').value.trim()].filter(Boolean).join('\n\n');
  if (!text && !U.files.length) return;
  if (ch) U.choice = null;
  U.note = null;
  const job = outboxPush({text, files: U.files, scope: n ? code(n) : null, from: !n && ruleMode() ? 'rules' : null});
  unsendable(job);
  if (desk() && D.compose) toast(job.from ? 'Sent as a new rule' : 'Sent', job.undo);  // the New input page has no line under the box: the toast's Undo (A27)
  $('text').value = ''; U.files = []; saveDraft(); grow();
  if (U.ask === n) U.ask = null;
  // Going through what needs you, your reply settles this one (B118), but the box stays on it (A2, B146): what you write
  // next still goes here. Next (⇧J, or Next on the card) is yours to press. A card of one item closes (B153).
  const going = U.go && n && U.go.list.includes(n) && (n === U.peek || (desk() && n === U.open));
  if (going) {
    U.go.done.add(n); if (U.go.how) U.go.how[n] = 'Replied';  // T225 #6: the line under the box says it was sent, with Undo: no toast besides
    if (U.peek) peek(U.peek, {focus: false});
  } else if (U.peek && n === U.peek) advance(U.peek, `Sent to ${code(n)}`);  // the toast says where it went (B155)
  else if (!desk() && !n && U.tab === 'inputs' && !U.open) $('inputsView').scrollTop = 0;  // it shows at the top of Inputs (B155)
  if (desk()) $('text').focus({preventScroll: true});  // A1: sent from the button, the box is where you go on writing, not the keys
  render(); flushOutbox();
  if (desk() && D.compose) $('foot').scrollTop = 0;
  else if (desk() && n && n === U.open && !U.go) requestAnimationFrame(() => { $('detailBody').scrollTop = $('detailBody').scrollHeight; });  // B124
}
// Each input carries the page's own id for it (q): sent again after its answer got lost, it still goes in once. When
// Taska does not answer at all (no connection, a restart), it is tried again by itself, with growing pauses (T101),
// and at once when the connection is back (B151).
function outboxPush(job) {
  Object.assign(job, {id: 'q' + ++U.qn, q: Date.now().toString(36) + Math.random().toString(36).slice(2, 10), t: Date.now()});
  for (const f of job.files) if (f.rid) { f.job = {id: job.q, text: job.text}; keepRec(f); }  // its words come back with it after a reload
  U.outbox.push(job);
  keepJob(job);
  markSent(jobKey(job));  // T113 A10: the other tabs drop it from their box
  return job;
}
const jobKey = job => job.scope || (job.from === 'rules' ? 'rule' : 'new');  // the box it was written in
// T113 A27: what you just sent can be taken back for a short while, with Undo on the line under the box or Z. Still
// on its way, it doesn't go; already in, it goes to Deleted (F177), with what was made of it alone. Either way your
// words and files come back into the box they were written in. Once your agent or the organizer has it, Undo is gone.
const UNSEND_MS = 10000;
function unsendable(job) {
  let run;
  run = job.undo = pushUndo(`Send to ${draftName(jobKey(job))}`, () => unsend(job, run));
  U.sentJobs = [...(U.sentJobs || []), job];
  setTimeout(() => { forget(run); job.undo = null; U.sentJobs = U.sentJobs.filter(j => j !== job); renderFeedback(); }, UNSEND_MS);
}
const unsendBtn = job => job?.undo && !job.undo.entry.done ? `<button data-act="unsend" data-q="${job.q}" class="-my-2 h-11 shrink-0 rounded-full px-2 font-semibold text-blue-600 dark:text-blue-400">Undo</button>` : '';
async function unsend(job, run) {
  const key = jobKey(job), i = U.outbox.indexOf(job);
  if (i >= 0 && !job.sending) { U.outbox.splice(i, 1); dropJob(job); }  // not gone yet: it stays here
  else {
    for (let t = 0; t < 100 && U.outbox.includes(job); t++) await new Promise(r => setTimeout(r, 100));  // on its way: wait for Taska's answer
    const r = job.rid && byR.get(job.rid);
    if (!job.rid || U.outbox.includes(job)) return toast('It could not be taken back: try again', null, {error: true}), false;
    if (r && (r.acked || S.org.busy === r.id || r.org)) return toast(`${job.rid} is already with ${r.org ? 'the organizer' : 'your agent'}: delete it from Inputs`), true;
    try { await save({op: 'delete', id: job.rid}, run); } catch (_) { return false; }
    if (U.lastSent === job.rid) U.lastSent = null;
  }
  const files = job.files.filter(f => !f.failed).map(f => Object.assign(f, {sent: false, job: null}));
  const was = key === U.draftKey ? $('text').value : String(draftStore()[key] || ''), wasFiles = key === U.draftKey ? U.files : U.parked[key] || [];
  setDraft(key, was.trim() ? job.text + '\n\n' + was : job.text, [...files, ...wasFiles]); draftMarks();
  render();
  if (key === U.draftKey) { renderComposer(); $('text').focus({preventScroll: true}); }
  toast(key === U.draftKey ? 'Not sent: your words are back in the box' : `Not sent: your words are back in the box of ${draftName(key)}`, key === U.draftKey ? null : () => goDraft(key), {label: 'Open'});
}
// B151: an input that has not reached Taska yet is kept in this browser too, per project, so a reload, a closed page or
// a phone that ends the tab never loses it: the next time the project opens, it goes out by itself. A voice note keeps
// its audio and words its own way and comes back into the box (T101); a file still uploading has nothing to keep yet.
function outboxStore(change) {
  const key = 'taska.outbox.' + S.project;
  try {
    const all = JSON.parse(localStorage.getItem(key) || '{}');
    if (change) { change(all); if (Object.keys(all).length) localStorage.setItem(key, JSON.stringify(all)); else localStorage.removeItem(key); }
    return all;
  } catch (_) { return {}; }
}
const keepable = job => job.files.every(f => f.f && !f.rid);
function keepJob(job) {
  if (S.project && keepable(job)) outboxStore(all => { all[job.q] = {text: job.text, scope: job.scope, from: job.from, t: job.t, files: job.files.map(({f, name, mime, size}) => ({f, name, mime, size}))}; });
}
const dropJob = job => outboxStore(all => { delete all[job.q]; });
function restoreOutbox() {  // what did not go out last time goes now, in the order you sent it
  const mine = new Set(U.outbox.map(j => j.q));
  const back = Object.entries(outboxStore()).filter(([q]) => !mine.has(q)).sort((a, b) => (a[1].t || 0) - (b[1].t || 0));
  for (const [q, j] of back) U.outbox.push({id: 'q' + ++U.qn, q, t: j.t, text: j.text || '', scope: j.scope || null, from: j.from || null, files: (j.files || []).map(f => ({...f, done: Promise.resolve()}))});
  if (back.length) { renderFeedback(); flushOutbox(); }
}
function resendOutbox() {  // the connection is back: what failed for want of it goes now, not at its next try
  let again = false;
  for (const j of U.outbox) if (j.failed && j.net) { j.failed = false; again = true; }
  if (again) { renderFeedback(); flushOutbox(); }
}
async function sendInput(o) {
  let d;
  try { d = await (await fetch(P + 'api/op', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(o)})).json(); }
  catch (_) { throw Object.assign(new Error('no answer'), {again: true}); }
  if (!d.ok) { toast((d.res || []).find(x => x.startsWith('err')) || d.error || 'Not saved'); throw new Error('op failed'); }
  try { await load(); } catch (_) {}  // it is in; the next poll shows it
  return d;
}
// B155: what you sent shows up where you are, in view and lit up for a moment: your reply at the end of the item's
// page, just above the box; a new input at the top of Inputs (the phone's newest is first).
// The desktop too (T113 B19): the reply lands after the line under it ("Sent. Waiting…") made the pane shorter.
function showSent(rid, scope) {
  if (!rid) return;
  const el = scope && U.open && code(U.open) === scope ? document.querySelector(`#detailBody [data-src="${rid}"]`)
    : U.tab === 'inputs' && !U.open ? document.querySelector(`#inputsView [data-r="${rid}"]`) : null;
  if (!el) return;
  el.scrollIntoView({block: 'nearest'});
  el.classList.add('bg-blue-50', 'dark:bg-blue-400/10');
  setTimeout(() => el.classList.remove('bg-blue-50', 'dark:bg-blue-400/10'), 1500);
}
async function flushOutbox() {
  if (flushOutbox.busy) return;
  flushOutbox.busy = true;
  let sent = null;
  try {
    while (U.outbox.length && !U.outbox[0].failed) {
      const job = U.outbox[0];
      await Promise.all(job.files.map(f => f.done));
      if (job.files.length) keepJob(job);  // its files are up now: kept with them (B151)
      const files = job.files.filter(f => f.f && !f.failed);
      let text = job.text;
      for (const f of files) if (f.tr && !f.trAdded && !text.includes(f.tr)) text = (text ? text + '\n' : '') + f.tr;  // a transcript that came after you sent
      if (!text && !files.length) { U.outbox.shift(); dropJob(job); continue; }
      job.sending = true; renderFeedback();
      try {
        const d = await sendInput({op: 'input', text, scope: job.scope, q: job.q, ...(job.from ? {from: job.from} : {}), files: files.map(({f, name, mime, size, tr}) => ({f, name, mime, size, ...(tr ? {tr} : {})}))});
        job.rid = d.res[0].split(' ')[1]; U.lastSent = job.quiet ? null : job.rid; U.outbox.shift(); dropJob(job); sent = [job.rid, job.scope];  // quiet: its toast said it (T113 A19)
        for (const f of files) { f.sent = true; dropRec(f); }  // words still to come go onto this input, on the server (B165); this browser lets the recording go (T101)
      } catch (e) {
        job.failed = true; job.sending = false; job.net = !!e.again;
        if (e.again) setTimeout(() => { if (job.failed && U.outbox[0] === job) { job.failed = false; renderFeedback(); flushOutbox(); } }, Math.min(30000, 2000 * 2 ** Math.min(job.tries = (job.tries || 0) + 1, 4)));
      }
    }
  } finally { flushOutbox.busy = false; render(); if (sent) showSent(...sent); }
}
addEventListener('beforeunload', e => {  // unsent words this browser can't keep (B151), a recording, or a voice note still in the box (B149)
  if (U.outbox.some(j => !keepable(j)) || R.rec || U.files.some(f => (f.mime || '').startsWith('audio/'))) { e.preventDefault(); e.returnValue = ''; }
});

// ---------------------------------------------------------------- voice

const R = {rec: null, chunks: [], stream: null, t0: 0, tick: 0, ctx: null, levels: []};
const clock = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

// A voice note as the microphone hears it (B182). By default a browser treats the microphone like a phone call: echo
// cancelling, noise suppression and automatic gain. On an iPhone that turned pauses into digital silence and pushed
// later speech down, so notes sounded wrong and transcribed badly; desktop Chrome did the same, only less. A browser
// that refuses these asks records the default way.
async function micStream() {
  if (MIC.stream?.getAudioTracks().some(t => t.readyState === 'live' && !t.muted)) return MIC.stream;  // B217: the one kept open (B277: not one the phone has muted)
  if (MIC.stream) { MIC.stream.getTracks().forEach(t => t.stop()); MIC.stream = null; }
  const md = navigator.mediaDevices;
  let s;
  try { s = await md.getUserMedia({audio: {echoCancellation: false, noiseSuppression: false, autoGainControl: false}}); }
  catch (e) { if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') throw e; s = await md.getUserMedia({audio: true}); }
  if (standalone()) MIC.stream = s;
  return s;
}
// B217: Taska from the Home Screen asks for the microphone each time it is opened again, and a page asks again for
// every new recording. There it keeps the microphone it was given while it is on screen (nothing is recorded or sent
// until you record) and lets it go when it goes to the background; in a browser tab each recording opens and closes it.
const MIC = {stream: null};
const micDone = s => {  // after a recording
  if (s && s !== MIC.stream) s.getTracks().forEach(t => t.stop());
  else if (document.visibilityState === 'hidden') setTimeout(micRelease);  // it ended in the background
};
function micRelease() {
  if (!MIC.stream || R.rec || DV.rec) return;
  MIC.stream.getTracks().forEach(t => t.stop()); MIC.stream = null;
}
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') micRelease(); });
addEventListener('pagehide', micRelease);
async function startRec() {
  if (!canRecord()) return voiceWhy();  // B166
  // B1: the note belongs where you started it, whatever is open when it stops: taken before the microphone is asked,
  // which can take a moment (a J pressed meanwhile must not move it)
  const key = U.draftKey, scope = scopeN() ? code(scopeN()) : null, typing = document.activeElement === $('text');
  try { R.stream = await micStream(); }
  catch (e) { return toast(micError(e), null, {error: true}); }
  R.chunks = []; R.levels = [];
  R.typing = typing;  // the box hides its text while recording; the caret comes back after
  R.key = key; R.scope = scope;
  if (R.typing) $('text').blur();
  R.muted = false;  // B277: the phone took the microphone away mid-note (a call, a sound, another app): say so when it stops
  for (const t of R.stream.getAudioTracks()) { t.onmute = () => { R.muted = true; }; t.onended = () => { R.muted = true; }; }
  R.rec = new MediaRecorder(R.stream);
  R.rec.ondataavailable = e => { if (e.data.size) R.chunks.push(e.data); };
  R.rec.start(1000);
  R.t0 = Date.now();
  try {
    R.ctx = new AudioContext();
    const an = R.ctx.createAnalyser(); an.fftSize = 512;
    R.ctx.createMediaStreamSource(R.stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    R.meter = () => { an.getByteTimeDomainData(buf); let sum = 0; for (const v of buf) sum += (v - 128) ** 2; return Math.min(1, Math.sqrt(sum / buf.length) / 40); };
  } catch (_) { R.meter = () => 0.2; }
  R.tick = setInterval(() => {
    $('recTime').textContent = clock(Date.now() - R.t0);
    R.levels.push(R.meter()); if (R.levels.length > 40) R.levels.shift();
    $('recBars').innerHTML = R.levels.map(l => `<span class="w-[3px] shrink-0 rounded-full bg-zinc-500 dark:bg-zinc-400" style="height:${Math.round(4 + l * 24)}px"></span>`).join('');
  }, 100);
  renderComposer();
}

function stopRec() {
  return new Promise(done => {
    const rec = R.rec;
    if (!rec) return done(null);
    rec.onstop = () => done(new Blob(R.chunks, {type: rec.mimeType || 'audio/webm'}));
    rec.stop();
    if (R.muted) { R.muted = false; if (MIC.stream) { MIC.stream.getTracks().forEach(t => t.stop()); MIC.stream = null; } toast('The phone muted the microphone during this note: what you said after that was not recorded', null, {error: true}); }
    clearInterval(R.tick);
    micDone(R.stream);
    R.ctx?.close();
    R.rec = null; R.from = null;
    $('recBars').innerHTML = ''; $('recTime').textContent = '0:00';
    renderComposer();
    if (R.typing) { R.typing = false; $('text').focus(); }  // you were typing when you started: go on typing
  });
}

async function finishRec(andSend, kept) {
  const key = kept ? kept.key : R.key ?? U.draftKey, scope = kept ? kept.scope : R.key ? R.scope : scopeN() ? code(scopeN()) : null;
  const vc = kept ? kept.vc : R.vc; R.vc = null;
  const ms = kept?.ms ?? Date.now() - R.t0, blob = kept?.blob ?? await stopRec();
  if (!blob) return;
  if (ms < 800 || !blob.size) return toast('Too short, discarded');
  const label = vc && vcQuote(vc, key);  // F184: the quote first, then its words
  const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  // B165: the note is in the box at once and the box is yours: type, send. Its words come when they come: into the
  // box where you recorded, or, if you sent it already, onto that message (the server adds them). T101: from the
  // moment it stops it is also kept in this browser, until it is sent.
  const f = voiceFile({name: `voice ${clock(ms).replace(':', '-')}.${ext}`, mime: blob.type || 'audio/webm', ms, blob, at: $('text').value.length, key, scope, ...(label ? {vc: label} : {})});
  if (key && key !== U.draftKey) {  // B1, B185: you moved on while recording: the note goes into the box where you started it
    (U.parked[key] ||= []).push(f); renderComposer();
    if (andSend && (key === 'new' || key === 'rule' || /^[A-Z]\d+$/.test(key))) sendParked(key);
    else toast(`The voice note is in the box for ${draftName(key)}, where you started it`, () => goDraft(key), {label: 'Go there'});
  } else {
    U.files.push(f); renderComposer();
    if (andSend) send();
    else if (desk() && !kept) $('text').focus({preventScroll: true});  // A1: words into the box, and the box is where you go on
  }
  keepRec(f).then(() => hear(f));  // kept before anything goes over the network; not awaited: nothing is held up meanwhile
}

// A voice note is kept in this browser (IndexedDB) from the moment the recording stops until the input it belongs to
// is in, so a restart, a dropped connection or a closed tab never loses it: when the project opens again, it is back
// in the box it was recorded in, and its words are worked out if they were not yet (T101).
const VPROJ = decodeURIComponent(P.split('/')[2] || '');
const VDB = {
  open: () => VDB.db ||= new Promise((ok, no) => {
    const r = indexedDB.open('taska-voice', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('notes', {keyPath: 'id'});
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  }),
  async run(mode, fn) {
    try {
      const db = await VDB.open();
      return await new Promise((ok, no) => { const t = db.transaction('notes', mode), q = fn(t.objectStore('notes')); t.oncomplete = () => ok(q.result); t.onerror = t.onabort = () => no(t.error); });
    } catch (_) { return null; }  // no storage here (a private window...): voice notes still work, they are just not kept
  },
  put: rec => VDB.run('readwrite', s => s.put(rec)),
  del: id => VDB.run('readwrite', s => s.delete(id)),
  all: () => VDB.run('readonly', s => s.getAll()).then(a => a || []),
};
// T256 (from Nota, B731): why the microphone did not start, and what to do, instead of one line for every reason
function micError(e) {
  const name = e?.name || '';
  if (!window.isSecureContext) return 'The microphone only works on a secure address: open Taska from its https link.';
  if (name === 'NotAllowedError' || name === 'SecurityError') return standalone()
    ? 'Taska may not use the microphone. On iPhone: Settings › Apps › Safari › Microphone › Allow, then open Taska again.'
    : 'Taska may not use the microphone. Allow it for this site (Safari: aA › Website Settings › Microphone), then try again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone was found on this device.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'The microphone is busy (a call, another app or tab). Stop that, then try again.';
  return `The microphone did not start (${name || 'unknown error'}). Try again.`;
}
function voiceFile(o) {
  const f = {transcribing: true, t: Date.now(), rid: 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), ...o};
  f.done = new Promise(r => { f.settle = r; });  // uploaded: all that sending waits for (B165)
  holdRec(f);
  return f;
}
async function keepRec(f) {  // what is known about a voice note, kept with its audio
  if (!f.rid || f.gone || f.sent) return;
  try { f.data ||= await f.blob.arrayBuffer(); } catch (_) { return; }
  if (f.gone || f.sent) return;  // let go of meanwhile: it must not come back
  await VDB.put({id: f.rid, project: VPROJ, key: f.key, scope: f.scope, name: f.name, mime: f.mime, ms: f.ms, t: f.t, data: f.data, f: f.f || null,
                 tr: f.transcribing ? null : f.tr || '', tr_error: f.tr_error || '', doubts: f.doubts || [], added: f.trAdded || null, job: f.job || null, vc: f.vc || null});
}
function dropRec(f, sent = true) {  // sent, or removed from the box: this browser lets it go
  if (!f.rid) return;
  if (sent) f.sent = true;
  VDB.del(f.rid); f.release?.(); f.release = f.held = null;
}
function holdRec(f) {  // while this page has the voice note, another tab of the project leaves it alone
  if (!f.rid || f.held || !navigator.locks) return;
  f.held = navigator.locks.request('taska-voice-' + f.rid, () => new Promise(r => { f.release = r; if (f.sent || f.gone) r(); })).catch(() => {});
}
// Upload a voice note, then wait for its words, in the background (B165). When Taska does not answer (no connection,
// a restart) both are tried again with growing pauses for as long as it takes, and a transcription that failed a few
// more times (T101). Taska keeps the words next to the audio, so asking again after a lost answer costs nothing.
async function hear(f) {
  if (f.loop) return;
  f.loop = true;
  const scope = f.scope ? '&scope=' + encodeURIComponent(f.scope) : '';
  let d = null;
  if (f.f) f.settle();  // uploaded before (put back after a reload): sending does not wait for its words
  for (let n = 0, tries = 0, waits = 0; !f.gone; n++) {
    try {
      if (!f.f) {
        const r = await fetch(`${P}api/file?name=${encodeURIComponent(f.name)}&transcribe=1${scope}`, {method: 'POST', headers: {'Content-Type': f.mime}, body: f.blob});
        if (r.status === 400 || r.status === 413) { f.failed = true; break; }  // refused (too big): trying again will not help
        if (!r.ok) throw new Error();
        const u = await r.json(); Object.assign(f, {f: u.f, size: u.size}); keepRec(f);
        f.settle(); renderComposer();
      }
      const r = await fetch(`${P}api/transcript?f=${encodeURIComponent(f.f)}${scope}${tries ? '&again=1' : ''}`, {method: 'POST'});
      if (!r.ok) throw new Error();
      d = await r.json();
      if (d.tr_error === 'no such voice note') { f.f = null; throw new Error(); }  // the audio is not there any more: up again
      if (!d.done && ++waits < 20) continue;  // still working: the server answers after 45 s for another ask
      if (d.done && d.tr_error && ++tries < 4) throw new Error();  // the models had trouble: a few more tries
      break;
    } catch (_) {
      if (f.gone) break;
      f.retrying = true; renderComposer(); renderFeedback();
      await sleep(Math.min(30000, 2000 * 2 ** Math.min(n, 4)));
    }
  }
  f.loop = false;
  if (f.gone) return;  // removed from the box meanwhile; its Undo starts it again
  f.transcribing = f.retrying = false; f.settle();
  if (f.failed) {
    for (const list of [U.files, ...Object.values(U.parked || {})]) { const i = list.indexOf(f); if (i >= 0) list.splice(i, 1); }
    dropRec(f, false); renderComposer();
    return toast('Could not upload the recording');
  }
  Object.assign(f, {tr: d?.tr || '', tr_error: d?.tr_error || (d?.done ? '' : 'no answer'), doubts: d?.doubts || [], more: !!d?.more});
  placeWords(f); keepRec(f);
  renderComposer(); renderFeedback();
  if (f.more) hearMore(f);
}
// The strong model ran out of time on this note (a phone's, with digital silence): the words may be cut short, and
// its fuller words may come within a few minutes. Taska puts them into the input if the note was sent meanwhile; while
// the note is still in a box, they take the place of the shorter ones there.
async function hearMore(f) {
  for (let n = 0, t0 = Date.now(); f.more && !f.gone && Date.now() - t0 < 5 * 60000; n++) {
    let d = null;
    try { d = await net(`${P}api/transcript?f=${encodeURIComponent(f.f)}&more=1`, {method: 'POST'}, 60000); } catch (_) { await sleep(Math.min(30000, 2000 * 2 ** Math.min(n, 4))); continue; }
    if (d.more) continue;
    f.more = false;
    if (d.tr && d.tr !== f.tr && !f.sent) fullerWords(f, d.tr);
    if (!f.sent) { keepRec(f); renderComposer(); }
    return;
  }
  f.more = false; renderComposer();
}
function fullerWords(f, words) {
  const key = U.files.includes(f) ? U.draftKey : Object.keys(U.parked || {}).find(k => U.parked[k].includes(f));
  if (!key) return;
  const was = f.trAdded || f.tr, put = v => was && v.includes(was) ? v.replace(was, words) : (v.trim() ? v.trimEnd() + '\n' : '') + words;
  if (key === U.draftKey) { const t = $('text'); t.value = put(t.value); saveDraft(); grow(); }
  else draftStore(all => { all[key] = put(all[key] || ''); });
  Object.assign(f, {tr: words, trAdded: words, doubts: []});
  toast('The fuller words of the voice note are in');
}
// Speaking into a document (F208). In the editor the microphone puts its words where the caret is: a mark holds the
// place while you speak and while the words are worked out, so you can go on typing anywhere; the words take the mark's
// place when they come. Leaving the editor keeps the mark in the draft and the words land there; Save waits for them.
const DV = {rec: null, n: 0, notes: []};
const dvMark = i => `⟦🎙 ${i}⟧`;  // the place the words will go
const docScope = () => { const d = docById(U.doc), n = d ? liveN(d.n) : U.docNew; return n ? code(n) : null; };
function docMicShow() {
  const b = $('docMic'), h = $('docHint');
  if (!b) return;
  const key = U.docEdit ? docKey() : null, waiting = DV.notes.filter(v => v.key === key).length;
  b.toggleAttribute('data-on', !!DV.rec);
  b.lastElementChild.textContent = DV.rec ? `Stop ${clock(Date.now() - DV.rec.t0)}` : 'Speak';
  b.setAttribute('aria-label', DV.rec ? 'Stop: the words go where the mark is' : 'Speak: the words go where the caret is');
  b.dataset.tip = desk() ? (DV.rec ? 'Stop · ⌥V' : 'Speak at the caret · ⌥V') : '';
  if (h) h.textContent = DV.rec ? 'Listening. Your words go where the mark is; you can go on typing.'
    : waiting ? `Working out the words of ${waiting > 1 ? waiting + ' voice notes' : 'the voice note'}…`
    : desk() ? 'The first line is the title. Esc keeps it as a draft.' : 'The first line is the title.';  // T227 #5
}
async function docRecStart() {
  if (DV.rec || !$('docMd')) return;
  if (R.rec) return toast('A voice note is recording for the box: stop it first');
  if (!canRecord()) return toast('This browser cannot record here');
  let stream;
  try { stream = await micStream(); } catch (e) { return toast(micError(e), null, {error: true}); }
  const t = $('docMd');
  if (!t || !U.docEdit || DV.rec) { micDone(stream); return; }  // the editor closed meanwhile
  const mark = dvMark(++DV.n), a = t.selectionStart, b = t.selectionEnd;
  t.focus({preventScroll: true});
  t.setRangeText(mark, a, b, 'end');  // like dictation: what you selected is what you speak over
  const rec = new MediaRecorder(stream), chunks = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  rec.start(1000);
  DV.rec = {rec, stream, chunks, mark, t0: Date.now(), key: docKey(), scope: docScope()};
  DV.rec.tick = setInterval(docMicShow, 500);
  docMicShow();
}
function docRecStop(keep = true) {
  const r = DV.rec;
  if (!r) return;
  DV.rec = null; clearInterval(r.tick);
  const ms = Date.now() - r.t0, note = {...r, key: keep ? r.key : null, ms};
  let stopped;
  DV.stopping = new Promise(res => { stopped = res; });
  r.rec.onstop = () => {
    DV.stopping = null; stopped();
    note.blob = new Blob(r.chunks, {type: r.rec.mimeType || 'audio/webm'});
    if (ms < 800 || !note.blob.size) { dvPut(note, ''); return toast('Too short, discarded'); }
    DV.notes.push(note);
    note.done = dvHear(note).then(words => {
      DV.notes.splice(DV.notes.indexOf(note), 1);
      if (words == null) toast('Could not work out the words of the voice note');
      dvPut(note, words || '');
      docMicShow();
    });
    docMicShow();
  };
  r.rec.stop(); micDone(r.stream);
  docMicShow();
}
async function dvHear(note) {  // upload, then wait for the words; tried again with growing pauses, as for the box (B165)
  const ext = note.blob.type.includes('mp4') ? 'm4a' : note.blob.type.includes('ogg') ? 'ogg' : 'webm';
  const scope = note.scope ? '&scope=' + encodeURIComponent(note.scope) : '', t0 = Date.now();
  for (let n = 0, tries = 0, waits = 0; Date.now() - t0 < 10 * 60000; ) {
    try {
      if (!note.f) {
        const r = await fetch(`${P}api/file?name=${encodeURIComponent(`voice ${clock(note.ms).replace(':', '-')}.${ext}`)}&transcribe=1${scope}`, {method: 'POST', headers: {'Content-Type': note.blob.type || 'audio/webm'}, body: note.blob});
        if (r.status === 400 || r.status === 413) return null;  // refused (too big): trying again will not help
        if (!r.ok) throw new Error();
        note.f = (await r.json()).f;
      }
      const r = await fetch(`${P}api/transcript?f=${encodeURIComponent(note.f)}${scope}${tries ? '&again=1' : ''}`, {method: 'POST'});
      if (!r.ok) throw new Error();
      const d = await r.json();
      if (d.tr_error === 'no such voice note') { note.f = null; throw new Error(); }
      if (!d.done && ++waits < 20) continue;  // still working: the server answers after a while for another ask
      if (d.done && d.tr_error && ++tries < 4) throw new Error();
      return d.done ? d.tr || '' : null;
    } catch (_) { await sleep(Math.min(30000, 2000 * 2 ** Math.min(n++, 4))); }
  }
  return null;
}
function dvPut(note, words) {  // the words take the mark's place: in the editor, or in the draft it was left as
  const t = $('docMd');
  if (t && U.docEdit && docKey() === note.key) {
    const at = t.value.indexOf(note.mark);
    if (at < 0) {  // the mark was deleted: the words still go in, at the end
      if (words) { t.value = t.value.trimEnd() + '\n\n' + words; toast('The mark was gone: the words are at the end'); }
      return;
    }
    const end = at + note.mark.length, caretAfter = t.selectionStart === end && t.selectionEnd === end;
    t.setRangeText(words, at, end, caretAfter ? 'end' : 'preserve');
    return;
  }
  if (!note.key) return;
  kept('docs', all => {
    const v = all[note.key];
    if (v == null) return;
    all[note.key] = v.includes(note.mark) ? v.replace(note.mark, words) : words ? v.trimEnd() + '\n\n' + words : v;
  });
  if (words) toast('The words of your voice note are in the draft');
}
async function docVoiceSettled() {  // before Save: stop the microphone, wait for the words still coming
  docRecStop();
  const key = docKey(), mine = () => DV.notes.filter(v => v.key === key);
  if (DV.stopping) await DV.stopping;  // a recording that just stopped joins the list
  if (mine().length) { toast('Saving once the words of your voice note are in…'); await Promise.all(mine().map(v => v.done)); }
  return U.docEdit && !!$('docMd') && docKey() === key;
}

function addWords(key, words) {  // into the box, or into the draft of the target it waits for
  if (key === U.draftKey) { const t = $('text'); t.value = (t.value.trim() ? t.value.trimEnd() + '\n' : '') + words; grow(); saveDraft(); }
  else draftStore(all => { all[key] = (all[key]?.trim() ? all[key].trimEnd() + '\n' : '') + words; });
}
function placeWords(f) {  // B165: a voice note's words go where you recorded it, around what you typed since; one sent already gets them on the server
  if (!desk() && f.doubts?.some(x => x.alt)) U.boxView = true;  // F186: the words to check show in the box on the phone
  const key = U.files.includes(f) ? U.draftKey : Object.keys(U.parked || {}).find(k => U.parked[k].includes(f));
  if (key && f.tr && !f.trAdded) {
    if (U.files.includes(f)) {
      const t = $('text'), q = f.vc ? vcLineEnd(t.value, f.vc) : -1;  // F184: under its quote, wherever that is now
      const at = q >= 0 ? q : Math.min(f.at ?? t.value.length, t.value.length), before = t.value.slice(0, at), after = t.value.slice(at);
      const caretHere = t.selectionStart === at && t.selectionEnd === at;
      t.setRangeText((before.trim() && !before.endsWith('\n') ? '\n' : '') + f.tr + (after.trim() && !after.startsWith('\n') ? '\n' : ''), at, at, caretHere ? 'end' : 'preserve');
      grow(); saveDraft();
    } else addWords(key, f.tr);  // its box shows another target now
    f.trAdded = f.tr;
  } else if (key && !f.tr) toast(f.tr_error ? 'Transcription failed. The audio is kept and can be sent as is.' : 'No words heard. The audio is kept and can be sent as is.');
  else if (!key && f.sent && !f.tr) toast(f.tr_error ? 'Transcription failed. The audio was sent as is.' : 'No words heard. The audio was sent as is.');
}
const unmarked = s => s.replace(/\s*[(\uff08][?\uff1f][)\uff09]/g, '');  // without the model's "(?)"
// Voice notes this browser kept that never went out (the page was closed, Taska restarted...) come back into the box
// they were recorded in, with the words that were on their way with them. One that went out already is let go.
async function restoreVoice() {
  const sent = new Set(S.inputs.flatMap(r => r.files.map(x => x.f)));
  const here = new Set([...U.files, ...Object.values(U.parked).flat(), ...U.outbox.flatMap(q => q.files)].map(f => f.rid));
  const jobs = new Set(), back = [];
  for (const r of (await VDB.all()).sort((a, b) => a.t - b.t)) {
    if (r.project !== VPROJ || here.has(r.id)) continue;
    if (r.f && sent.has(r.f)) { VDB.del(r.id); continue; }  // it went out already
    if (navigator.locks && !await navigator.locks.request('taska-voice-' + r.id, {ifAvailable: true}, l => !!l)) continue;  // another tab has it
    // B185: back into the box it was recorded in, never the one open now: the item's (or the one it was merged into), a
    // new input or rule, an edit; a new input when that item or input is gone
    const n = /^[A-Z]\d+$/.test(r.key || '') ? parseRef(r.key) : 0, inp = /^(edit|append|correct) (r\d+)$/.exec(r.key || '');
    const key = n ? (byN.has(n) ? code(liveN(n)) : 'new') : r.key === 'rule' || (inp && byR.has(inp[2])) ? r.key : 'new';
    const f = voiceFile({rid: r.id, name: r.name, mime: r.mime, ms: r.ms, t: r.t, data: r.data, blob: new Blob([r.data], {type: r.mime}), key, scope: /^[A-Z]\d+$/.test(key) ? key : null,
                         f: r.f || null, transcribing: r.tr == null && !r.tr_error, tr: r.tr || '', tr_error: r.tr_error || '', doubts: r.doubts || [], trAdded: r.added || undefined, ...(r.vc ? {vc: r.vc} : {})});
    if (key === U.draftKey) U.files.push(f); else (U.parked[key] ||= []).push(f);
    if (r.job && !jobs.has(r.job.id)) { jobs.add(r.job.id); if (r.job.text) addWords(key, r.job.text); }  // what was sent with it
    if (f.transcribing) hear(f); else { f.settle(); placeWords(f); }
    keepRec(f); back.push(key);
  }
  if (!back.length) return;
  renderComposer();
  const away = back.find(k => k !== U.draftKey);
  const say = `${back.length === 1 ? 'A voice note that did not go out is' : back.length + ' voice notes that did not go out are'} back in the box${away ? ` for ${draftName(away)}` : ''}`;
  if (away) toast(say, () => goDraft(away), {label: 'Go there'}); else toast(say);
}

async function cancelRec() {  // B149: discarding can be undone for a few seconds
  const ms = Date.now() - R.t0, key = R.key, scope = R.scope, vc = R.vc, blob = await stopRec();
  R.vc = null; vcPlace();
  if (!blob || ms < 800 || !blob.size) return;
  toast('Recording discarded', () => finishRec(false, {blob, ms, key, scope, vc}));
}
// F184: a voice comment on what you selected in a document. A small button by the selection starts recording at once;
// the same button stops it. The quote ("> “…”") and the voice note go into the box after what is there, its words
// under its quote when they come, and nothing is sent: select, speak, select, speak..., then one Send posts each
// quote's words (and its recording) as a comment on its passage.
const VC_MARK = /^> “(.+)”[ \t]*$/;
const vcCount = text => text.split('\n').filter(l => VC_MARK.test(l)).length;
function vcLineEnd(text, label) {  // where a quote's words go: right under its line, or -1
  const lines = text.split('\n'); let at = 0;
  for (const l of lines) { at += l.length + 1; if (VC_MARK.exec(l)?.[1] === label) return Math.min(at, text.length); }
  return -1;
}
function vcQuote(vc, key) {  // puts the quote line into the box the note belongs to -> its label
  let label = plainQuote(vc.quote).replace(/\s+/g, ' ');
  if (label.length > 300) label = label.slice(0, 300) + '…';
  const add = v => (v.trim() ? v.trimEnd() + '\n\n' : '') + `> “${label}”\n`;
  if (!key || key === U.draftKey) { const t = $('text'); t.value = add(t.value); saveDraft(); grow(); }
  else draftStore(all => { all[key] = add(all[key] || ''); });
  U.vcMarks = [...U.vcMarks.filter(m => m.label !== label), {label, d: vc.d, key: vc.key, quote: vc.quote}];
  U.docQuote = null; getSelection()?.removeAllRanges();
  return label;
}
function vcSelection() {  // the text selected right now that a voice comment can be about, or null
  const sel = getSelection();
  if (U.docCircle || !sel?.rangeCount || sel.isCollapsed) return null;
  const text = sel.toString().trim(), node = sel.anchorNode?.nodeType === 1 ? sel.anchorNode : sel.anchorNode?.parentElement;
  if (text.length < 2 || !node) return null;
  if (docOpen()) {  // a document: the comment goes on that passage (F184)
    const sec = node.closest('#docBlocks > section[data-key]');
    return sec ? {key: sec.dataset.key, text: text.slice(0, 500), range: sel.getRangeAt(0)} : null;
  }
  // F199: anything else worth talking about: an item's text and its thread, what you said in Inputs. The quote and
  // the voice note go into the box, to whatever it writes to (a reply to that item, a new input).
  if (node.closest('#composer, input, textarea, [contenteditable], button, #vcBar, #toast')) return null;
  return node.closest('#detailBody, #dlgBody, #inputsView') ? {key: null, text: text.slice(0, 500), range: sel.getRangeAt(0)} : null;
}
const vcScroller = () => desk() ? $('detailBody') : $('dlgBody');
function vcPlace() {  // the button by the selection, or by the passage you are speaking about
  const bar = $('vcBar'), on = !!(R.vc && R.rec), s = on || R.rec ? null : vcSelection(), range = on ? R.vc.range : s?.range;
  let r = range?.getBoundingClientRect();
  if (on && !r?.width && !r?.height) {  // the page was drawn again meanwhile: where the selection was, as the page scrolled since
    const dy = vcScroller().scrollTop - R.vc.top, o = R.vc.rect;
    r = {top: o.top - dy, bottom: o.bottom - dy, left: o.left, width: o.width, height: o.height};
  }
  bar.hidden = !r || (!r.width && !r.height);
  if (bar.hidden) return;
  const fix = !on && !R.rec && U.fixCand && getSelection()?.toString().replace(/\s+/g, ' ').trim() === U.fixCand.wrong;  // F204
  $('fixBtn').hidden = !fix;
  if (fix && !$('fixBtn').innerHTML) $('fixBtn').innerHTML = `${ico('pencil', 'size-4')}Correct`;
  const b = $('vcBtn');
  if (b.dataset.rec !== String(on)) {
    b.dataset.rec = String(on); b.toggleAttribute('data-on', on);
    b.innerHTML = on ? '<span class="size-2 animate-pulse rounded-full bg-white"></span>Stop' : `${ico('mic', 'size-4')}Voice comment`;
    b.setAttribute('aria-label', on ? 'Stop: the quote and the voice note go into the box' : 'Voice comment: record a comment on the selected text');
  }
  const below = r.bottom + 8 + bar.offsetHeight < innerHeight - 8;
  bar.style.top = `${below ? r.bottom + 8 : Math.max(8, r.top - bar.offsetHeight - 8)}px`;
  bar.style.left = `${Math.max(8, Math.min(innerWidth - bar.offsetWidth - 8, r.left + r.width / 2 - bar.offsetWidth / 2))}px`;
}
async function vcToggle() {
  if (R.vc) return R.rec ? finishRec(false) : undefined;  // starting: the microphone is on its way
  if (R.rec) return;
  const s = vcSelection();
  if (!s) return;
  R.vc = {d: U.doc, key: s.key, quote: s.text, range: s.range.cloneRange(), rect: s.range.getBoundingClientRect(), top: vcScroller().scrollTop};
  await startRec();
  if (!R.rec) R.vc = null;
  vcPlace();
}
// The box as comments: each quote line, the words under it (words above the first quote go with the first).
function vcSegments(text, d) {
  const segs = [], pre = [];
  for (const l of text.split('\n')) { const m = VC_MARK.exec(l); if (m) segs.push({label: m[1], lines: []}); else (segs.at(-1)?.lines || pre).push(l); }
  if (pre.join('').trim()) segs[0].lines.unshift(...pre, '');
  for (const s of segs) {
    const m = U.vcMarks.find(x => x.label === s.label && x.d === d.d), b = !m && d.blocks.find(b => plainQuote(b.text).replace(/\s+/g, ' ').includes(s.label.replace(/…$/, '')));
    if (!m && !b) return {err: `“${s.label.slice(0, 60)}” is not in D${d.d} any more: change or remove that quote line`};
    Object.assign(s, {key: m ? m.key : b.key, quote: m ? m.quote : s.label, text: s.lines.join('\n').trim()});
  }
  return {segs};
}
async function sendVoiceComments() {
  const d = docOpen();
  if (!d || U.vcSending) return;
  U.vcSending = true;
  try {
    const files = [...U.files];
    await Promise.all(files.map(f => f.done));
    if (files.some(f => f.transcribing)) toast('Posting as soon as the words of the voice notes are in…');
    for (let i = 0; files.some(f => f.transcribing) && i < 240; i++) await sleep(500);  // their words go into the comments, under their quotes
    const {segs, err} = vcSegments($('text').value, d);
    if (err) return toast(err, null, {error: true});
    const ups = fs => fs.filter(f => f.f && !f.failed).map(({f, name, mime, size, tr}) => ({f, name, mime, size, ...(tr ? {tr} : {})}));
    const ops = segs.map(s => ({op: 'dc', d: d.d, key: s.key, quote: s.quote, text: s.text, files: ups(files.filter(f => f.vc === s.label))}));
    ops.at(-1).files.push(...ups(files.filter(f => !segs.some(s => s.label === f.vc))));  // other files go with the last
    const send = ops.filter(o => o.text || o.files.length);
    if (!send.length) return toast('Nothing to post yet: say or write something under a quote');
    await save(send, () => sendVoiceComments());
    for (const f of files) { f.sent = true; dropRec(f); }
    $('text').value = ''; U.files = []; U.vcMarks = U.vcMarks.filter(m => m.d !== d.d); saveDraft(); grow();
    for (const s of segs) U.docThreads.add(s.key);
    Object.assign(U, {docQuote: null, docSel: new Set(), docReply: null});
    renderDoc(); renderComposer(); toast(`Posted ${plural(send.length, 'comment')} on D${d.d}`);
  } catch (_) {} finally { U.vcSending = false; }
}
// The name of a draft's target, for what the box says about it (B1, B185).
const draftName = key => key === 'new' ? 'a new input' : key === 'rule' ? 'a new rule' : /^[A-Z]\d+$/.test(key) ? key : key.replace(/^(\w+) /, (_, m) => ({edit: 'the edit of ', append: 'the details for ', correct: 'the correction in ', dc: 'the edit of comment '}[m] || ''));
function goDraft(key) {  // to the box a draft belongs to
  if (key === 'new' || key === 'rule') { if (key === 'rule' && U.tab !== 'rules') setTab('rules'); U.asRule = key === 'rule' ? null : U.tab === 'rules' ? false : null; return ACT['new-input'](); }
  const n = /^[A-Z]\d+$/.test(key) && parseRef(key);
  if (n && byN.has(n)) { if (desk() && !inTab(byN.get(n), U.tab)) setTab(tabOf(byN.get(n))); openItem(n); $('text').focus({preventScroll: true}); }
}
// Stop and send, after you moved on while recording: what waits in the box where you started goes there, with the note.
function sendParked(key) {
  const files = U.parked[key] || [], text = (draftStore()[key] || '').trim();
  delete U.parked[key]; draftStore(all => { delete all[key]; });
  outboxPush({text, files, scope: /^[A-Z]\d+$/.test(key) ? key : null, from: key === 'rule' ? 'rules' : null});
  toast(`Sent to ${draftName(key)}, where you started the voice note`);
  render(); flushOutbox();
}

// A draft belongs to what it is written to (B118): an item (a reply, or a comment on one of its documents), or a new
// input (a new rule too). Each project keeps them by target in this browser; when the box changes target, the words and
// files stay with the old target and the new target's own draft comes back. So unsent words never go elsewhere.
const draftKey = () => { if (U.prefsEdit) return 'prefs'; if (U.correct) return `correct ${U.correct.id}`; if (U.amend) return `${U.amend.mode} ${U.amend.id}`; const od = docOpen(), n = scopeN(); return od ? code(liveN(od.n)) : n ? code(n) : ruleMode() ? 'rule' : 'new'; };  // B10: a new rule has its own draft  // a document's box shares its item's draft
function draftStore(change) {
  const key = 'taska.drafts.' + S.project;
  try {
    const all = JSON.parse(localStorage.getItem(key) || '{}');
    if (U.oldDraft) { all.new = all.new || U.oldDraft; U.oldDraft = ''; change ||= () => {}; }  // the one draft from before goes to New input
    if (change) { change(all); localStorage.setItem(key, JSON.stringify(all)); }
    return all;
  } catch (_) { return {}; }
}
function saveDraft() { const k = U.draftKey, v = $('text').value; if (k) draftStore(all => { if (v.trim()) all[k] = v; else delete all[k]; }); draftMarks(); }
// T113 A10, B11, B24: every tab of this browser shows the same drafts. What you write in one tab shows in the others as
// you type, a draft sent in one tab leaves the others' boxes (so it can't go twice), and an item or a project with an
// unsent draft says "Draft" on its row. A draft's files and voice notes stay in the tab that has them.
const DRAFTS = {raw: {}, val: {}, sig: ''};
function draftsOf(slug) {  // -> {key: text} of any project, read again only when it changed
  let raw = null; try { raw = localStorage.getItem('taska.drafts.' + slug); } catch (_) {}
  if (DRAFTS.raw[slug] !== raw || !DRAFTS.val[slug]) { DRAFTS.raw[slug] = raw; try { DRAFTS.val[slug] = JSON.parse(raw || '{}') || {}; } catch (_) { DRAFTS.val[slug] = {}; } }
  return DRAFTS.val[slug];
}
function draftCodes() {  // -> the items of this project with an unsent draft (words in any tab, or files in this one)
  const d = draftsOf(S.project), out = new Set();
  for (const k of [...Object.keys(d), ...Object.keys(U.parked), U.draftKey]) if (/^[A-Z]\d+$/.test(k || '') && hasDraft(k, d)) out.add(k);
  return out;
}
const hasDraft = (c, d = draftsOf(S.project)) => c === U.draftKey ? !!($('text').value.trim() || U.files.length) : !!(String(d[c] || '').trim() || U.parked[c]?.length);
const projDraft = slug => Object.values(draftsOf(slug)).some(v => String(v || '').trim())
  || (slug === S.project && !!(U.files.length || $('text').value.trim() || Object.values(U.parked).some(f => f.length)));
const DRAFT_MARK = (small = false) => `<span data-draft title="Not sent yet: kept in this browser" class="inline-flex shrink-0 items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">${ico('pencil', small ? 'size-2.5' : 'size-3', '2.25')}Draft</span>`;
function draftMarks() {  // a draft started or went: the rows and the sidebar say so
  if (!S.project) return;
  const sig = [S.project, ...draftCodes(), '|', ...sideProjects().filter(p => projDraft(p.name)).map(p => p.name)].join(' ');
  if (sig === DRAFTS.sig) return;
  DRAFTS.sig = sig; renderItems();
  if (desk()) { renderSidebar(); renderRail(); }
}
function markSent(key) {  // the other tabs: this draft went out from here
  try { if (S.project && key) localStorage.setItem('taska.sent.' + S.project, JSON.stringify({k: key, t: Date.now()})); } catch (_) {}
}
addEventListener('storage', e => {
  if (!S.project || !e.key) return;
  if (e.key === 'taska.sent.' + S.project) {
    let x = null; try { x = JSON.parse(e.newValue || 'null'); } catch (_) {}
    if (x && x.k === U.draftKey && ($('text').value.trim() || (U.boxGone?.k === x.k && Date.now() - U.boxGone.t < 3000)))
      toast(`${/^[A-Z]\d+$/.test(x.k) ? `Your reply to ${x.k}` : x.k === 'rule' ? 'Your new rule' : x.k === 'new' ? 'Your new input' : 'What you wrote'} was sent from another tab`);
    return;
  }
  if (e.key === 'taska.drafts.' + S.project && U.draftKey && !R.rec) {
    const t = $('text'), was = t.value, now = String(draftsOf(S.project)[U.draftKey] || '');
    if (now !== was && now.trim() !== was.trim()) {
      const [s, en] = [t.selectionStart, t.selectionEnd];
      t.value = now;
      if (now.startsWith(was)) { t.selectionStart = s; t.selectionEnd = en; } else t.selectionStart = t.selectionEnd = now.length;
      if (was.trim() && !now.trim()) U.boxGone = {k: U.draftKey, t: Date.now()};
      grow(); renderComposer();
    }
  }
  if (e.key.startsWith('taska.drafts.')) draftMarks();
});
// A8, B185: "New input instead", "Add to F06 instead", "As a rule instead": what you wrote (words, files, voice notes)
// goes to the other target, after its own draft, and Undo puts both back.
// A2: an item with an unsent draft was merged: the words and files go after the draft of the item it went into, and the
// page says so. -> [[from, to]]
function mergeDrafts() {
  const keys = new Set([...Object.keys(draftStore()), ...Object.keys(U.parked), U.draftKey].filter(k => /^[A-Z]\d+$/.test(k || ''))), moved = [];
  for (const key of keys) {
    const n = parseRef(key);
    if (!byN.get(n)?.merged_into || liveN(n) === n) continue;
    const to = code(liveN(n));
    if (key === U.draftKey) { saveDraft(); U.parked[key] = U.files; U.files = []; $('text').value = ''; U.draftKey = null; }
    const text = draftStore()[key] || '', files = U.parked[key] || [];
    draftStore(all => { delete all[key]; }); delete U.parked[key];
    if (!text.trim() && !files.length) continue;
    const was = to === U.draftKey ? $('text').value : draftStore()[to] || '', wasFiles = to === U.draftKey ? U.files : U.parked[to] || [];
    for (const f of files) { f.key = to; f.scope = to; f.at = undefined; keepRec(f); }
    setDraft(to, was.trim() ? was.trimEnd() + '\n\n' + text : text, [...wasFiles, ...files]);
    moved.push([key, to]);
  }
  return moved;
}
function setDraft(key, text, files) {
  if (key === U.draftKey) { $('text').value = text; U.files = files; saveDraft(); grow(); }
  else { draftStore(all => { if (text.trim()) all[key] = text; else delete all[key]; }); if (files.length) U.parked[key] = files; else delete U.parked[key]; }
}
function carry(go) {
  const from = U.draftKey, text = $('text').value, files = U.files;
  if (!from || (!text.trim() && !files.length)) return go();
  setDraft(from, '', []);
  go();
  const to = U.draftKey;
  if (to === from) return setDraft(to, text, files), renderComposer();
  const was = $('text').value, wasFiles = [...U.files];
  for (const f of files) { f.key = to; f.scope = /^[A-Z]\d+$/.test(to) ? to : null; f.at = undefined; keepRec(f); }  // its words, and a restored note, follow
  setDraft(to, was.trim() ? was.trimEnd() + '\n\n' + text : text, [...wasFiles, ...files]); renderComposer();
  toast(`What you wrote moved to ${draftName(to)}`, () => {
    for (const f of files) { f.key = from; f.scope = /^[A-Z]\d+$/.test(from) ? from : null; keepRec(f); }
    setDraft(to, was, wasFiles); setDraft(from, text, files);
    goDraft(from); renderComposer();
  });
  $('text').focus({preventScroll: true});
}
function swapDraft(key) {
  const left = (U.draftKey === 'new' || U.draftKey === 'rule') && ($('text').value.trim() || U.files.length) ? U.draftKey : null;  // B185: a new input you leave waits, and you are told where
  if (U.draftKey) { saveDraft(); U.parked[U.draftKey] = U.files; }
  if (left && !R.rec) setTimeout(() => toast(`Your ${left === 'rule' ? 'new rule' : 'new input'} is kept, not sent`, () => goDraft(left), {label: 'Open'}));
  const t = $('text'); t.value = draftStore()[key] || ''; t.selectionStart = t.selectionEnd = t.value.length;  // the caret after your words
  U.files = U.parked[key] || []; delete U.parked[key];
  U.draftKey = key; grow();
}

// ---------------------------------------------------------------- dialogs + viewer

// Every sheet: a handle, a title row (or `head`), optional `extra` buttons beside the close button, an optional
// `sub` line under it and a fixed `foot`. The focus card (`card`) floats above the input box instead.
function dialog(title, html, {aboveComposer = false, focus = true, tall = false, card = false, head = '', extra = '', sub = '', foot = '', pop = false, walk = false} = {}) {
  $('dlg').classList.toggle('h-[92%]', walk);  // going through, every card has the same height: nothing moves under your thumb (B153)
  if (head) $('dlgTitle').innerHTML = head; else $('dlgTitle').textContent = title;
  $('dlgExtra').innerHTML = extra;
  $('dlgSub').innerHTML = sub; $('dlgSub').hidden = !sub;
  $('dlgFoot').innerHTML = foot; $('dlgFoot').hidden = !foot || (card && !desk() && document.activeElement === $('text'));  // typing on the card: room for the question (B153)
  $('dlgBody').classList.toggle('pb-[max(1.25rem,env(safe-area-inset-bottom))]', !foot); $('dlgBody').classList.toggle('pb-3', !!foot);
  if ($('overlay').hidden && !U.doc) layerOpen('sheet');  // one step Back closes it (B150); a document has its own address
  $('dlgBody').innerHTML = html; $('overlay').hidden = false; $('overlay').dataset.card = card ? '1' : '';
  for (const c of ['h-[88dvh]', 'sm:h-[85dvh]']) $('dlg').classList.toggle(c, tall);  // documents get the whole screen
  const flush = card && aboveComposer;  // the card above the input box sits on it, as a sheet does: no strip of the list between them (T225 #2)
  for (const c of ['shadow-2xl', 'overflow-hidden', 'max-h-[92%]']) $('dlg').classList.toggle(c, card);
  $('dlg').classList.toggle('rounded-3xl', card && !flush); $('dlg').classList.toggle('rounded-t-3xl', !card || flush);
  $('dlg').classList.toggle('max-h-[88dvh]', !card);
  $('overlay').classList.toggle('px-2', card); $('overlay').classList.toggle('pb-2', card && !flush);
  for (const c of ['lg:items-start', 'lg:justify-end', 'lg:bg-transparent', 'dark:lg:bg-transparent', 'lg:pt-[3.75rem]', 'lg:pr-3']) $('overlay').classList.toggle(c, pop && desk());
  for (const c of ['lg:w-[24rem]', 'lg:max-h-[80dvh]', 'lg:rounded-2xl', 'lg:ring-1', 'lg:ring-zinc-900/10', 'dark:lg:ring-white/10']) $('dlg').classList.toggle(c, pop && desk());
  $('overlay').style.bottom = aboveComposer ? $('composer').parentElement.offsetHeight + 'px' : '';  // keep the input box usable
  $('overlay').dataset.above = aboveComposer ? '1' : '';  // and follow it when its line or files come and go
  $('overlay').style.paddingLeft = $('overlay').style.paddingTop = ''; $('overlay').classList.remove('lg:justify-start');  // set again by popAt
  if (!desk() && !$('toast').hidden) placeToast();  // once the sheet or card has its place
  if (focus && desk()) $('dlgClose').focus({preventScroll: true, focusVisible: false});  // T227 #1: no ring on opening
}
// A second click within 3 s confirms (B127, B131): the page asks in place, never in a browser dialog.
function confirmClick(b, ask) {
  if (b.dataset.armed) return true;
  b.dataset.armed = '1'; const was = b.innerHTML; b.textContent = ask;
  setTimeout(() => { if (b.isConnected && b.dataset.armed) { delete b.dataset.armed; b.innerHTML = was; } }, 3000);
  return false;
}
function popAt(x, y, again = 2) {  // B129: a menu opened by right-click sits at the pointer, kept on screen
  const o = $('overlay'), d = $('dlg'), xy = U.popXY = [x, y];  // a redraw of the same menu stays there (itemMenuDesk)
  o.classList.remove('lg:justify-end', 'lg:pt-[3.75rem]', 'lg:pr-3'); o.classList.add('lg:justify-start');
  o.style.paddingLeft = `${Math.max(8, Math.min(x, innerWidth - d.offsetWidth - 8))}px`;
  o.style.paddingTop = `${Math.max(8, Math.min(y, innerHeight - d.offsetHeight - 8))}px`;
  if (again) requestAnimationFrame(() => { if (U.popXY === xy && !o.hidden) popAt(x, y, again - 1); });  // its width may come a frame later: measure again
}
const closeDialog = () => {
  const edit = U.docEdit;
  if (edit) keepDoc();  // closing the editor keeps what you wrote, as a draft: only Create or Save publish it (T113 B6)
  if (desk()) {  // a document lives in the item pane (T110): closing a sheet or the editor leaves it open there
    U.docNew = null; U.docEdit = false; U.sheet = null; U.menuArm = null;  // Go through goes on after a menu or a sheet (T113 B17)
    $('overlay').hidden = true; $('overlay').style.bottom = '';
    if (U.peek) { U.peek = null; renderComposer(); }
    if (edit && U.doc) { D.docKey = null; renderDetail(); renderComposer(); }
    return;
  }
  if (U.doc) U.docScroll[U.doc] = $('dlgBody').scrollTop;
  const hadDoc = U.doc, sheet = !$('overlay').hidden && !hadDoc;
  U.doc = null; U.docNew = null; U.docEdit = false; U.sheet = null; U.go = null; U.docReply = null;
  $('overlay').hidden = true; $('overlay').style.bottom = '';
  if (!$('toast').hidden) placeToast();
  U.menuArm = null;
  if (U.peek) { U.peek = null; renderComposer(); }
  else if (hadDoc) { renderComposer(); if (!leaveView(`D${hadDoc}`)) writeURL(false); }  // the box goes back to the item or the project
  if (sheet) layerShut('sheet');  // its step in the history goes too (B150)
};

const agentAsk = () => `This project tracks work in Taska. Run \`curl -s ${BASE}/agent\` to learn the interface, then follow \`curl -s ${BASE}/next\` and write your progress back to the items.`;
// One change, as a sentence (B131): who, then what, with item codes and inputs as links; the time in grey.
function logLine(l) {
  const m = /^#(\d+) (\S+ \S+) (\S+) (.*)$/s.exec(l);
  if (!m) return esc(l);
  // T113 A22: in plain words, not the agents' shorthand (archived False→True, keep-going ON, new I15 idea P2 now …)
  const FIELD = 'status|when|pri|type|archived|parent|title|body|next', cap = s => s.replace(/^./, c => c.toUpperCase());
  const setPart = (f, a, b) => f === 'status' ? `${STATUS[a] || a} → ${STATUS[b] || b}` : f === 'when' ? `${WHEN[a] || a} → ${WHEN[b] || b}`
    : f === 'archived' ? (b === 'True' ? 'archived' : 'unarchived') : f === 'pri' ? `priority ${a} → ${b}` : f === 'type' ? `type ${cap(a)} → ${cap(b)}`
    : f === 'parent' ? (/^\d+$/.test(b) ? `moved under ${code(Number(b))}` : /^\d+$/.test(a) ? `taken out from under ${code(Number(a))}` : 'parent changed')
    : f === 'title' ? `renamed “${b}”` : f === 'body' ? 'description edited' : 'next step edited';
  const plain = String(m[4]).replace(/\*\*|__|`/g, '').replace(/\[src=[^\]]*\]/g, '').replace(/(^|\s)- (?:\( \)|\[ \]) /g, '$1').replace(/ ''$/, ' a voice note');  // T228 #11, #12
  let what = esc(plain)
    .replace(/^in (r\d+)(?: →([A-Z]\d+))? /, (_, r, c) => c ? `wrote ${r} to ${c} ` : `wrote ${r} `)
    .replace(/^new ([A-Z]\d+) (\w+) (P\d) (now|later) (.*?)(?: ←(r\d+))?$/s, (_, c, t, p, w, title, r) => `made ${c}, ${/^[aeiou]/.test(t) ? 'an' : 'a'} ${t} (${p}${w === 'later' ? ', later' : ''}): ${title}${r ? ` from ${r}` : ''}`)
    .replace(new RegExp(`\\b(${FIELD}) (.*?)→(.*?)(?=, (?:${FIELD}) |$| \\(undo #)`, 'gs'), (_, f, a, b) => setPart(f, a, b))
    .replace(/ \(undo #(\d+)\)$/, ' (undoing #$1)')
    .replace(/^keep-going (ON|OFF)$/, (_, v) => `turned Keep going ${v.toLowerCase()}`)
    .replace(/^ack (.+)$/, (_, rs) => `saw ${rs.split(' ').join(', ')}`)
    .replace(/^doc (D\d+) on ([A-Z]\d+) /, 'wrote $1 on $2: ').replace(/^(D\d+) comment /, 'commented on $1: ')
    .replace(/^(undo|redo) organizer changes for (r\d+)$/, (_, k, r) => k === 'undo' ? `undid the filing of ${r}` : `put back the filing of ${r}`)
    .replace(/^(r\d+) (edit|append): /, (_, r, k) => k === 'edit' ? `edited ${r}: ` : `added details to ${r}: `)
    .replace(/^organizer (r\d+) retry$/, 'filed $1 again').replace(/^organizer (r\d+) (ok|FAILED): /, (_, r, k) => k === 'ok' ? `filed ${r}: ` : `could not file ${r}: `)
    .replace(/\b(say|ask|block|propose|progress|decide|withdraw) (?=&#39;|&#x27;|'|&quot;|")/g, (_, k) => `${{say: 'said', ask: 'asked', block: 'is blocked:', propose: 'proposed', progress: 'progress:', decide: 'decided', withdraw: 'took back the question:'}[k]} `)  // the quote is escaped by now
    .replace(/\b([A-Z]\d{1,5})\b/g, (c, x) => { const n = parseRef(c); return n && byN.has(n) && code(n) === c ? `<button data-act="goto" data-n="${n}" class="font-semibold text-blue-600 hover:underline dark:text-blue-400">${c}</button>` : c; })
    .replace(/\b(r\d+)\b/g, (r) => byR.has(r) ? `<button data-act="go-input" data-id="${r}" class="font-mono text-blue-600 hover:underline dark:text-blue-400">${r}</button>` : r);
  return `<span class="font-medium text-zinc-800 dark:text-zinc-100">${esc(whoName(m[3]))}</span> ${what} <span class="font-mono text-[11px] whitespace-nowrap text-zinc-400">${esc(m[2])}</span>`;
}
const logHtml = lines => `<ol class="divide-y divide-zinc-100 text-[13px] leading-relaxed text-zinc-600 dark:divide-zinc-800 dark:text-zinc-300">${lines.map(l => {
  const u = (S.undo || []).find(u => l.startsWith(`#${u.seq} `));  // one of your changes that can still be put back (F80)
  return `<li class="flex items-start gap-2 py-1.5"><span class="min-w-0 flex-1 break-words">${logLine(l)}</span>${u ? `<button data-act="revert" data-seq="${u.seq}" class="relative -my-1 shrink-0 rounded-md px-2 py-1 after:absolute after:-inset-x-1 after:-inset-y-2.5 lg:after:hidden font-sans text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10">Undo</button>` : ''}</li>`;
}).join('')}</ol>`;
// How the agents are doing, in one coloured card, on top of Settings › Agents.
function agentCard() {
  const [tone, , line] = agentState(S.agents, S.work);
  const queue = S.items.filter(inQueue), later = laterOf(queue);  // the same count as the band in Items (S3)
  const look = {bad: ['bg-red-50 dark:bg-red-400/10', 'bg-red-500 ring-4 ring-red-500/20 dark:bg-red-400', 'text-red-800 dark:text-red-200', 'text-red-700/80 dark:text-red-300/80'],
    ok: ['bg-emerald-50 dark:bg-emerald-400/10', 'bg-emerald-500 ring-4 ring-emerald-500/20 dark:bg-emerald-400', 'text-emerald-900 dark:text-emerald-100', 'text-emerald-800/80 dark:text-emerald-300/80'],
    idle: ['bg-zinc-100 dark:bg-zinc-800', 'bg-zinc-400 ring-4 ring-zinc-400/20', 'text-zinc-800 dark:text-zinc-100', 'text-zinc-500 dark:text-zinc-400']}[tone];
  return `<div class="flex gap-3 rounded-2xl p-4 ${look[0]}"><span class="mt-1.5 size-2.5 shrink-0 rounded-full ${look[1]}"></span>
      <div><p class="text-[15px] leading-snug font-semibold ${look[2]}">${esc(line)}</p><p class="mt-1 text-[13px] leading-snug ${look[3]}">${plural(queue.length, 'item')} in the queue${later ? ` (${later} later)` : ''}</p></div></div>`;  // Keep going: its switch is right below (T228 #9)
}
const agentsSeen = () => [...(S.agents || [])].sort((a, b) => b.t - a.t).map(a => `<li class="flex h-11 items-center gap-3">${avatar(a.name)}<span class="min-w-0 flex-1 text-[15px]">${esc(AGENT_NAME[a.name] || a.name)}</span><span class="text-sm text-zinc-500 dark:text-zinc-400">${a.waiting ? 'waiting for work' : agoLong(a.t)}</span></li>`).join('');
const deletedRows = () => (S.deleted || []).map(x => `<li class="flex items-start gap-3 py-3.5">
    <div class="min-w-0 flex-1"><p class="text-xs text-zinc-500 dark:text-zinc-400"><span class="font-mono">${x.id}</span> · ${when(x.t)} · deleted ${when(x.at)}</p>
      <p class="mt-1 line-clamp-3 text-[15px] leading-snug break-words">${esc(x.text || (x.files ? plural(x.files, 'file') : ''))}</p>
      ${x.items.length ? `<p class="mt-1.5 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">With ${x.items.map(i => `<span class="font-mono text-xs font-bold ${TYPE_TEXT[i.type]}">${i.code}</span> ${esc(i.title)}`).join(' · ')}</p>` : ''}</div>
    <button data-act="input-restore" data-id="${x.id}" class="${SECOND} shrink-0">${ico('undo', 'size-4')}Restore</button></li>`).join('');

function showSources(n) {
  const it = byN.get(n);
  dialog(`Sources of ${code(n)}`, `<div class="flex flex-col gap-4">${it.srcs.map(id => byR.get(id)).filter(Boolean).map(r => `<div>
      <div class="px-1 text-xs text-zinc-500 dark:text-zinc-400"><button data-act="go-input" data-id="${r.id}" class="font-mono text-blue-600 hover:underline dark:text-blue-400">${r.id}</button> · ${when(r.t)} · ${esc(whoName(r.by))}</div>
      <div class="mt-1.5 rounded-2xl rounded-tr-md bg-blue-50 px-3.5 py-2 text-[15px] leading-relaxed dark:bg-blue-400/10">${r.text ? rich(r.text, 'src' + r.id) : ''}
      ${r.files.length ? `<div class="mt-2 flex items-end gap-2 overflow-x-auto lg:scrollbar-thin">${thumbs(r.files, 'src' + r.id)}</div>` : ''}</div>
      ${r.org ? `<div class="mt-1.5 flex items-center gap-1 px-1 text-xs text-zinc-500 dark:text-zinc-400">${ico('sparkle', 'size-3.5')}${esc(r.org.msg)}</div>` : ''}</div>`).join('') || '<p class="text-sm text-zinc-500">No sources.</p>'}</div>`);
}

function copyItem(n) {
  const it = byN.get(n), c = code(n), base = BASE;
  const text = it.type === 'task'
    ? `${it.title}\n\n${it.body}\n\nCarry this out in the current project. Write the result and how you checked it back to Taska item ${c} (usage: curl -s ${base}/agent).`
    : `Work on Taska item ${c}: ${it.title}\nDetails: curl -s ${base}/${c}\nUsage: curl -s ${base}/agent`;
  copy(text, 'Copied. Paste it to your agent.');
}

function openViewer(gid, f) {
  viewerGroup = groups.get(gid) || [f]; viewerIdx = Math.max(0, viewerGroup.indexOf(f));
  if ($('viewer').hidden) layerOpen('viewer');  // Back closes it (B150)
  $('viewer').hidden = false; showImage(); $('vClose').focus();
}
function closeViewer() { $('viewer').hidden = true; $('vImg').removeAttribute('src'); }
function showImage() {
  const f = viewerGroup[viewerIdx], url = P + 'f/' + encodeURIComponent(f), img = $('vImg');
  img.className = 'm-auto max-h-full max-w-full object-contain'; $('vZoom').textContent = 'Zoom to 100%';
  img.src = url; $('vOpen').href = url; $('vName').textContent = f.replace(/^f\d+-/, '');
  $('vIdx').textContent = viewerGroup.length > 1 ? `${viewerIdx + 1} / ${viewerGroup.length}` : '';
  document.querySelector('[data-act="v-prev"]').disabled = viewerIdx === 0;
  document.querySelector('[data-act="v-next"]').disabled = viewerIdx === viewerGroup.length - 1;
}

// Closing and moving like a photo app (B140): a tap on the dark area closes; on a phone, at fit-to-screen size, a
// sideways swipe goes to the next or previous image and a swipe down closes. Zoomed in, a swipe just scrolls.
$('vStage').addEventListener('click', e => { if (e.target === e.currentTarget) ACT['v-close'](); });
const VS = {x: 0, y: 0, on: false};
$('vStage').addEventListener('touchstart', e => {
  VS.on = e.touches.length === 1 && $('vImg').classList.contains('max-w-full');
  if (VS.on) { VS.x = e.touches[0].clientX; VS.y = e.touches[0].clientY; }
}, {passive: true});
$('vStage').addEventListener('touchend', e => {
  if (!VS.on) return;
  VS.on = false;
  const t = e.changedTouches[0], dx = t.clientX - VS.x, dy = t.clientY - VS.y;
  if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) ACT[dx < 0 ? 'v-next' : 'v-prev']();
  else if (dy > 80 && dy > 1.5 * Math.abs(dx)) ACT['v-close']();
}, {passive: true});

// ---------------------------------------------------------------- wiring

function render() {
  if (TIP.el && !TIP.el.isConnected) tipHide();  // its trigger was redrawn
  settleOpen();  // B5
  if (desk() && S.project && !U.open && !D.page && !D.full && U.tab !== 'inputs') D.compose = true;  // B269: nothing open is the New input page, the same as clicking New input
  showView(); renderItems(); renderDetail(); renderComposer(); renderFeedback(); renderAgent();
  if (desk()) { renderProjBar(); renderDeskHead(); renderSidebar(); renderRail(); renderFilters(); }
  if (D.page) renderProject();
  if (U.peek && !$('overlay').hidden) { const top = $('dlgBody').scrollTop; peek(U.peek, {focus: false}); $('dlgBody').scrollTop = top; }
  if (U.doc && !U.docEdit && !U.docQuote && !$('overlay').hidden && docSig(docById(U.doc)) !== U.docSig) renderDoc();  // only when it changed: a redraw under a tap loses the tap
  if (U.tab === 'inputs') renderInputs();
  phoneCounts();
  if (S.project && !filtered()) try { localStorage.setItem('taska.counts.' + S.project, JSON.stringify(COUNTS.map(id => $(id).textContent))); } catch (_) {}  // for the next page's first paint (B190)
  fitTabs();
  const waiting = S.items.filter(needsYou).length, sec = D.page ? (D.section ? PSEC[D.section][2] : 'Settings') + ' · ' : '';  // each section is a page of its own (B162)
  $('projName').textContent = S.project ? projTitle() : 'Taska';
  document.title = (waiting ? `(${waiting}) ` : '') + sec + (S.project ? `${projTitle()} · Taska` : 'Taska');
  if (DR.open) renderDrawerSettings();
  if (AUD.el) audioUi();
}

// The item page covers the list and its tabs; the input box stays, now adding to that item. While you swipe the
// page away (F63) it floats above the list, so the list shows underneath.
// B152: the tab bar follows what shows (a reload, Back, a link), and a search in use is always in sight: its field
// stays open while a word searches the list, also after a reload or when you come back to a tab that has one.
function showView() {
  if (desk()) return showDesk();
  const page = !!D.page, d = !!U.open && !page, lift = d && BK.pull, under = (!d || lift) && !page, v = $('detailView'), sq = !!(U.searching || U.q);
  $('projectView').hidden = !page; $('projectNav').hidden = !!D.section; $('projectBody').hidden = !D.section;  // Settings: a page at a time (B162)
  if (page) { $('filterStrip').hidden = true; $('foot').hidden = !U.prefsEdit; }  // the box only while you edit the voice preferences (F183)
  $('projectBody').classList.toggle('pb-64', page && !!U.prefsEdit);
  $('mainHead').hidden = $('tabs').hidden = !under;
  $('headNormal').hidden = sq; $('headSearch').hidden = !sq;
  for (const b of document.querySelectorAll('#tabs [data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === U.tab));
  $('itemsView').hidden = !under || U.tab === 'inputs';
  $('inputsView').hidden = !under || U.tab !== 'inputs';
  v.hidden = !d;
  for (const c of ['absolute', 'inset-x-0', 'top-[env(safe-area-inset-top)]', 'z-20', 'bg-white', 'dark:bg-zinc-950', 'shadow-2xl']) v.classList.toggle(c, lift);
  v.style.bottom = lift ? $('composer').parentElement.offsetHeight + 'px' : '';
  if (!lift) { v.style.transform = ''; v.style.transition = ''; }
}

// B5: a merged item lives on in the one it went into. Opened by a link, its address, a reload or Back, it opens that
// one and says so, as when the merge happens while it is open (B118): the merged one never shows, or takes replies.
const liveN = n => { let it = byN.get(n); for (let i = 0; it?.merged_into && byN.has(it.merged_into) && i < 50; i++) it = byN.get(it.merged_into); return it ? it.n : n; };
function mergedTo(n) {
  const to = liveN(n);
  if (to !== n) toast(`${code(n)} was merged into ${code(to)}`);
  return to;
}
function settleOpen() {  // the item on screen was merged: the one it went into takes its place
  if (!U.open || !byN.get(U.open)?.merged_into) return;
  U.open = mergedTo(U.open);
  if (!URLS.applying) writeURL(false);
}

// Opening an item is a step in the browser's history, so Back, the back button and the phone's back swipe
// all return to the list where you were.
// On the desktop opening an item only selects it: the list stays, the detail pane shows it, and the address
// follows without adding history. Full width (O) is the step Back undoes there, and so is a link (B9: goto).
function openItem(n, push = true) {
  if (!n || !byN.has(n)) return closeItem();
  const asked = n;
  n = mergedTo(n);
  if (n !== asked && URLS.applying) history.replaceState(desk() ? history.state : {n}, '', P + code(n) + viewQuery());  // the address names what shows
  if (!U.open && !desk()) U.listTop = [$('list').scrollTop, $('inputsView').scrollTop];
  if (U.open !== n) { stashEdit(); U.editing = null; U.subFor = null; U.amend = null; U.correct = null; U.prefsEdit = null; }
  const fresh = U.open !== n;
  U.open = n; U.scopeOff = false;
  if (desk() && U.doc && !U.docEdit) { U.docScroll[U.doc] = $('detailBody').scrollTop; Object.assign(U, {doc: null, docReply: null, docSel: new Set(), docQuote: null, docCircle: false}); D.docKey = null; }  // another item: the document closes
  if (desk() && U.tab === 'inputs') { const it = byN.get(n); U.tab = it.archived ? 'archive' : it.type === 'rule' ? 'rules' : 'items'; }  // Inputs has no item pane
  if (desk()) { D.page = null; D.compose = false; writeURL(false, history.state?.full ? {...history.state, n} : null); }
  else if (push && !URLS.applying) hist(() => { if (location.pathname !== P + code(n)) history.pushState({n, ...searchStep()}, '', P + code(n) + viewQuery()); });  // after a sheet's step back (B150)
  render();
  if (fresh) $('detailBody').scrollTop = 0;
  if (desk()) document.querySelector(`#list [data-act="open"][data-n="${n}"]`)?.scrollIntoView({block: 'nearest'});
}

function closeItem() {
  if (!U.open) return;
  stashEdit(); U.open = null; U.editing = null; U.subFor = null; BK.pull = false; D.full = false;
  if (desk() && U.doc && !U.docEdit) { U.doc = null; U.docReply = null; D.docKey = null; }
  writeURL(false, null);
  render();
  if (!desk()) [$('list').scrollTop, $('inputsView').scrollTop] = U.listTop || [0, 0];
  if (!desk() && U.goBack) {  // back from the item you opened while going through: the walk goes on where it was (B153)
    const w = U.goBack; U.goBack = null;
    requestAnimationFrame(() => { U.go = w.go; const it = byN.get(w.n); if (it && needsYou(it) && !w.go.done.has(w.n)) peek(w.n, {focus: false}); else advance(w.n); });
  }
}

function clearSearch() { U.q = ''; $('q').value = ''; qSync(); writeURL(false); renderItems(); if (U.tab === 'inputs') renderInputs(); }
const VIEW_KEYS = ['q', 'type', 'when', 'status', 'pri'];
function setTab(t) {
  const was = U.tab, away = desk() && (t !== was || !!D.page || D.compose);  // another tab, or out of This project or New input: a step Back undoes (B9)
  if (away) keepPlace();
  let carried = false;  // a search came along: the tab opens at the top of its results, not where you left it (T225 #13 follow-up)
  if (t !== was) {  // B130: each tab keeps its own search and filters; nothing leaks from one tab to another
    const words = U.q.trim() ? U.q : '';  // T225 #13: but words in the search box go along, as the tabs' counts promised
    U.tabView[was] = Object.fromEntries(VIEW_KEYS.map(k => [k, U[k]]));
    const v = U.tabView[t] || {};
    for (const k of VIEW_KEYS) U[k] = v[k] ?? (k === 'q' ? '' : 'all');
    if (words) { U.q = words; carried = true; }
    $('q').value = U.q; qSync();
  }
  U.asRule = null; U.amend = null; U.correct = null; U.prefsEdit = null; U.goBack = null; if (t === 'inputs' && was !== 'inputs') U.inputsEnd = true;
  if (!desk() && t !== was && !U.open) U.tabTop[was] = tabScroll(was).scrollTop;  // where you were in this tab (B152)
  U.tab = t;
  if (t !== was && !desk()) writeURL(true);
  if (desk()) {
    if (t !== was) {  // B120: the open item belongs to a tab; each tab keeps its own (Inputs shows none, so it keeps the last)
      if (was !== 'inputs') U.tabOpen[was] = U.open;
      if (t !== 'inputs') {
        const back = [U.tabOpen[t], U.open].find(k => k && byN.has(k) && inTab(byN.get(k), t));
        if (back !== U.open) U.open = back || null;  // Go through waits for you to come back (T113 B17)
      }
    }
    U.tabTop[was] = $('list').scrollTop;  // each tab keeps its place in the list (B124)
    D.page = null; D.sideOpen = false; D.compose = false; U.settle.clear(); render(); $('list').scrollTop = carried ? 0 : U.tabTop[t] || 0; return writeURL(away);
  }
  showView(); renderFilters();  // the tab bar follows there (B152)
  if (t === 'inputs') renderInputs(); else renderItems();
  if (t !== was) tabScroll(t).scrollTop = carried ? 0 : U.tabTop[t] || 0;  // each tab keeps its place, as on the desktop (B152)
  renderComposer();
}
const tabScroll = t => t === 'inputs' ? $('inputsView') : $('list');
// From 360 px the four tabs fit with their counts (smaller text and closer spacing below 400 px, 1k for 1000 and more).
// Narrower than that, only the open tab keeps its count: no tab lacks a count the others show (T225 #12), and a count
// is never cut into a smaller number (B158: "Rules 13" read "Rules 1").
function fitTabs() {
  if (desk()) return;
  const list = document.querySelector('#tabs [role=tablist]'), counts = ['nItems', 'nInputs', 'nArchTab', 'nRules'].map($);
  for (const c of counts) c.hidden = false;
  if (list.scrollWidth > list.clientWidth + 1) for (const c of counts) c.hidden = !c.closest('[aria-selected="true"]');
}

// B4: words (and files) you wrote in the box for an item go with your decision on it (Accept, Approve, Not yet, Won't do),
// as they go with an answer (B145): one decision, one send. Undoing the decision leaves the note sent.
function noteWith(n) {
  if (scopeN() !== n || U.amend || U.correct || docOpen() || R.rec) return false;
  const text = $('text').value.trim(), files = U.files;
  if (!text && !files.length) return false;
  outboxPush({text, files, scope: code(n), from: null, quiet: true});  // the decision's toast says "with your note" (T113 A19)
  $('text').value = ''; U.files = []; saveDraft(); grow(); renderComposer(); flushOutbox();
  return true;
}
const SAID = {open: 'is open', doing: 'is in progress', done: 'is done', dropped: "is marked won't do", later: 'moved to Later', now: 'is back to now', review: 'is in review', proposed: 'is proposed'};
const saidOf = (f, v, before, ref) => f === 'archived' ? (v ? 'archived' : 'unarchived') : f === 'status' && v === 'done' && before === 'review' ? 'accepted'
  : f === 'status' && v === 'open' && before === 'proposed' ? 'approved' : f === 'pri' ? `is now ${v}` : f === 'type' ? `is now ${LETTER[v]}${ref.slice(1)}, ${/^[aeiou]/.test(v) ? 'an' : 'a'} ${v}`
  : f === 'parent' ? (v ? `is now under ${code(v)}` : 'stands on its own') : f === 'rank' ? (v == null ? 'is back in order' : 'goes next in its priority') : SAID[v];
const wire = (f, v) => f === 'parent' ? (v ? String(v) : 'none') : v;  // a parent goes to Taska as an item ref
// One-tap changes (swipes, row pills, the focus card, keys, the ⋯ menu): they show at once and are saved behind you
// (T160), say what happened and offer Undo, which puts the old value back; Z does the same (T113 A7). said / note:
// other words for the toast. -> a promise: true once saved, false if it couldn't be.
function change(n, f, v, {said, note} = {}) {
  const it = byN.get(n);
  if (!it || it[f] === v) return Promise.resolve(!!it);
  const before = it[f], ref = code(n), job = {saved: false, undone: false};
  said ||= it.type === 'rule' && f === 'status' && before !== 'proposed' && {open: 'is active again', dropped: 'is retired'}[v] || saidOf(f, v, before, ref);  // a rule's words (B158)
  let run;
  const undo = () => {
    job.undone = true;
    if (U.go) { U.go.done.delete(n); delete U.go.how?.[n]; }
    toast(`${ref} put back`);
    return optimistic([{n, f: {[f]: before}}], () => {
      const u = (S.undo || []).find(u => u.n === n && f in u.f);  // the recorded change, so the change log knows it was undone (F80)
      return u ? revert(u.seq) : op({op: 'set', ref, f: {[f]: wire(f, before)}});
    }, ex => notSaved(ex, run), () => job.saved);  // a change that never reached Taska has nothing to put back there
  };
  run = pushUndo(`${ref} ${said}`, undo);
  const settles = desk() && U.go && U.go.list.includes(n) && f === 'status';
  if (desk() && n === U.open) U.stepFrom = {n, rows: [...document.querySelectorAll('#list [data-act="open"][data-n]')].map(el => Number(el.dataset.n))};  // J goes on from here (B124)
  if (settles) { U.go.done.add(n); U.go.how[n] = said.replace(/^is (marked )?/, '').replace(/^./, c => c.toUpperCase()); U.go.undo[n] = run; }
  if (!settles && (n !== U.open || desk())) holdRow(n, `${said.replace(/^./, c => c.toUpperCase())}`, run);  // the phone's list is under the card or the row you swiped (B148)
  const left = f === 'status' && v === 'done' ? openKids(n) : 0;  // done before its subitems: say so (B147)
  const noted = f === 'status' && noteWith(n);  // B4: what you wrote for it goes with your decision
  // T113 B28: one Undo in sight. On the desktop the row you acted on holds in place with its Undo (or Go through's row
  // does), and the sidebar keeps it for Z: the toast then only says what happened.
  const inPlace = desk() && !!document.querySelector(`#list article[data-n="${n}"]`);
  toast(`${ref} ${said}${noted ? ', with your note' : ''}${left ? ` · ${plural(left, 'subitem')} still open` : ''}${note && !noted ? `. ${note}.` : ''}`, inPlace ? null : run);
  const saved = optimistic([{n, f: {[f]: v}}], () => op({op: 'set', ref, f: {[f]: wire(f, v)}}), ex => {  // taken back
    forget(run);
    if (U.settle.delete(n)) renderItems();
    if (U.go?.done.has(n)) { U.go.done.delete(n); delete U.go.how?.[n]; delete U.go.undo?.[n]; render(); }
    if (!job.undone) notSaved(ex, () => change(n, f, v, {said, note}));
  });
  saved.then(ok => { job.saved = ok; });
  if (settles && U.open === n) advanceDesk(n, U.go.how[n]);
  return saved;
}
// On the desktop the search box is always there: the clear button shows only with a query, the / hint only without.
const qSync = () => { $('qX').classList.toggle('lg:hidden', !U.q); $('qKey').classList.toggle('lg:grid', !U.q); };
const searchMode = on => {
  if (on !== !!U.searching) { if (on) layerOpen('search'); else layerShut('search'); }  // Back closes it (B150)
  U.searching = on;
  if (!on) {  // Cancel ends the search: on every tab, and in the address, so nothing filters the list unseen (B152)
    U.q = ''; $('q').value = ''; for (const v of Object.values(U.tabView)) v.q = '';
    if (!LAY.popping) writeURL(false);
  }
  if (!desk()) showView();
  if (on) $('q').focus();
  renderItems(); if (U.tab === 'inputs') renderInputs();
};
const ACT = {
  search: () => searchMode(!U.searching),
  'search-cancel': () => searchMode(false),  // also a search that came with the address or a tab (B152)
  'search-clear': () => { clearSearch(); $('q').focus(); },
  reply: () => { U.scopeOff = false; renderComposer(); $('text').focus(); },
  'reply-instead': () => carry(ACT.reply),  // A8: what you wrote goes along
  'new-input-instead': () => carry(ACT['new-input']),
  'card-answer': b => {  // the card's step forward on an item that waits on you (B147): its question, and the box to reply in
    const it = byN.get(Number(b.dataset.n));
    $('dlgBody').querySelector('[data-need]')?.scrollIntoView({block: 'start', behavior: 'smooth'});
    if (it?.wait && (it.wait.kind === 'block' || !hasChoices(it.wait.text))) ACT.reply();  // with choices: tick them first
  },
  status: b => {
    const n = Number(b.dataset.n);
    change(n, 'status', b.dataset.v); if (U.peek === n) advance(n);  // the next card, or the card of one item closes (B153)
  },
  // The action on a row that waits on you: Accept and Approve happen at once (with Undo); Answer and Reply open
  // the focus card on that item, Reply with the input box ready.
  'settle-undo': b => { const s = U.settle.get(Number(b.dataset.n)); U.settle.clear(); s?.undo(); renderItems(); },
  'row-act': b => {
    const n = Number(b.dataset.n), v = b.dataset.v;
    if (v === 'accept' || v === 'approve') { change(n, 'status', v === 'accept' ? 'done' : 'open'); return; }
    if (!desk()) U.go = null;  // a row's card is that item's only (B153); the desktop's Go through goes on (T113 B17)
    if (desk()) {  // B125: on the desktop the item opens in its pane: Answer goes to the first choice, Reply to the box
      openItem(n);
      const first = v === 'answer' && document.querySelector(`#detailBody [data-act="choice"][data-n="${n}"]`);
      return first ? first.focus() : $('text').focus();
    }
    peek(n);
    if (v === 'reply' || !hasChoices(byN.get(n)?.wait?.text)) $('text').focus();
  },
  'go-through': () => { if (desk()) return startGoDesk(); const list = needsList(); if (!list.length) return toast('Nothing needs you right now'); U.go = {list, done: new Set()}; peek(list[0]); },
  'go-prev': () => {
    const g = U.go; if (!g) return;
    if (!desk()) { const i = g.list.indexOf(U.peek); if (i > 0 && byN.get(g.list[i - 1])) peek(g.list[i - 1], {focus: false}); return; }  // the card before, as you left it (B153)
    if (!g.list.includes(U.open) || U.tab !== 'items' || D.page || D.compose) return ACT['go-resume']();
    const i = g.list.indexOf(U.open); if (i <= 0) return toast('This is the first one'); openItem(g.list[i - 1]);
  },
  'go-resume': () => {  // back to where you left off, in Items (T113 A13)
    const g = U.go;
    if (!g) return;
    if (U.tab !== 'items' || D.page || D.compose) setTab('items');
    const waits = k => byN.get(k) && needsYou(byN.get(k)) && !g.done.has(k), i = g.list.indexOf(g.at);
    const next = waits(g.at) ? g.at : g.list.slice(i + 1).find(waits);
    return next ? openItem(next) : endGoDesk('last');
  },
  'go-end': () => { if (desk()) return endGoDesk('end'); U.go = null; render(); },
  'go-undo': b => { const n = Number(b.dataset.n); U.go?.undo[n]?.(); },
  prev: () => stepItem(-1),
  next: () => stepItem(1),
  full: () => fullWidth(!D.full),
  side: () => {
    if (WIDE.matches) { D.sideHidden = !D.sideHidden; try { localStorage.setItem('taska.sideHidden', D.sideHidden ? '1' : ''); } catch (_) {} }  // T113 B25: a reload keeps it hidden
    else D.sideOpen = !D.sideOpen;
    render();
  },
  keys: () => showKeys(),
  switch: () => projectSwitcher(),
  'as-rule': () => carry(() => { U.asRule = !ruleMode(); renderComposer(); if (desk() && D.compose) renderDetail(); writeURL(false); }),
  'new-input': () => {
    U.amend = null; U.correct = null; U.prefsEdit = null;  // New input is always a fresh new input (B168)
    D.sideOpen = false; if (D.page) D.page = null;
    if (desk()) {  // its own page in the detail pane (B73), not under the open item; from Inputs too (F121)
      if (U.tab === 'inputs') { D.prevTab = 'inputs'; U.tab = 'items'; }
      if (U.open) D.prev = U.open;
      D.prevDoc = U.doc && !U.docEdit && docById(U.doc) ? U.doc : null;  // B14: from a document, the page is the same New input page, and Back goes to the document
      if (D.prevDoc) { U.docScroll[U.doc] = $('detailBody').scrollTop; Object.assign(U, {doc: null, docReply: null, docSel: new Set(), docQuote: null, docCircle: false}); D.docKey = null; }
      U.open = null; U.editing = null; U.subFor = null; D.full = false; D.compose = true;
      writeURL(true);
    }
    U.scopeOff = true; render(); $('text').focus();
  },
  'compose-back': () => leaveCompose(),
  // Back where you came from (B162): the sections you went through here were steps in the history; they go at once.
  'project-back': () => {
    if (!desk()) return pageUp();
    const k = !URLS.applying && history.state?.page; D.page = null; render(); if (k) { URLS.selfBack = true; history.go(-k); } else writeURL(false);
  },
  project: () => { if (!desk()) closeDrawer(); openProject(desk() ? 'agents' : null); },  // the phone: the Settings page with its list of sections
  psec: (b, e) => e?.metaKey || e?.ctrlKey || e?.shiftKey ? window.open(b.href, '_blank') : openProject(b.dataset.sec),  // ⌘-click: in a new tab
  'notifications-on': () => turnOnNotices(),
  'notifications-quiet': () => { noticeWrite('quiet', !noticeRead('quiet', true)); renderProject(); if (!desk() && PUSH.sub) pushOn(); },  // the phone: Taska keeps the quiet hours (F195)
  'push-on': () => pushOn(),
  'push-off': () => pushOff(),
  'go-next': () => {
    if (desk()) {
      const g = U.go; if (!g) return startGoDesk();
      if (!g.list.includes(U.open) || U.tab !== 'items' || D.page || D.compose) return ACT['go-resume']();  // paused: back to it first
      const i = g.list.indexOf(U.open), next = g.list.slice(i + 1).find(k => byN.get(k) && needsYou(byN.get(k)) && !g.done.has(k));
      return next ? openItem(next) : endGoDesk('last');  // no going round (T113 A13)
    }
    const g = U.go, i = g ? g.list.indexOf(U.peek) : -1;
    const next = g && g.list.slice(i + 1).find(k => byN.get(k) && needsYou(byN.get(k)) && !g.done.has(k));  // no going round: after the last, the walk ends (B153)
    if (next) peek(next, {focus: false}); else if (g) endWalk();
  },
  // Not yet reopens and asks what is missing, wherever you tap it (B153): on the phone a row's Not yet opens its card.
  reopen: b => {  // with Undo and Z (T113 A7)
    const n = Number(b.dataset.n);
    if (desk() && U.open !== n) openItem(n);
    if (!desk() && U.open !== n && U.peek !== n) { closeSwipe(); peek(n, {focus: false}); }
    const typed = scopeN() === n && !!($('text').value.trim() || U.files.length);  // B4: what you wrote already is what is missing: it goes with it
    change(n, 'status', 'doing', {said: 'is back in progress', note: 'Say what is missing'}); if (!typed) U.ask = n; U.scopeOff = false; renderComposer(); $('text').focus();
  },
  'card-copy': b => copyItem(Number(b.dataset.n)),  // the card stays: copying is no reason to lose your place (B153)
  projects: () => openDrawer(),
  'new-project': () => {  // B131: the button becomes a name field in place; Enter makes it, Esc stops
    if (desk() && $('drawer').hidden && !D.page) { D.sideOpen = true; render(); }  // from the rail or the bar's menu: the sidebar comes over the page (F173)
    if ($('npName')) return $('npName').focus();
    $('drawerNew').hidden = true;
    $('drawerNew').insertAdjacentHTML('afterend', `<div id="npRow" class="mt-1 px-1"><div class="flex items-center gap-1.5"><input id="npName" class="${FIELD} h-10 py-1.5 text-sm" placeholder="Project name" aria-label="New project name" autocomplete="off" spellcheck="false"><button data-act="np-create" class="h-10 shrink-0 rounded-xl bg-zinc-900 px-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">Create</button><button data-act="np-cancel" aria-label="Cancel" class="grid size-10 shrink-0 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-800">${ico('x', 'size-4')}</button></div><p id="npErr" hidden class="px-2 pt-1 text-xs text-red-600 dark:text-red-400"></p></div>`);
    $('npName').focus();
  },
  'np-create': async () => {
    const title = ($('npName')?.value || '').trim();  // any name (F173)
    if (!title) return $('npName')?.focus();
    try {
      const d = await net('/api/projects', JSON_POST({title}), NET.op);
      if (d.ok) location.href = `/p/${d.name}/`; else { $('npErr').textContent = d.error || 'Not created'; $('npErr').hidden = false; }
    } catch (_) { $('npErr').textContent = 'Connection lost; try again'; $('npErr').hidden = false; }
  },
  'go-input': b => {  // B131: from an item's source to that input in Inputs, lit up for a moment
    const id = b.dataset.id;
    closeDialog(); if (D.page && !desk()) keepPlace(); if (D.page) D.page = null;  // on the phone a page of Settings keeps its step and its place: Back comes back to it (B150)
    if (!desk() && U.open) { stashEdit(); U.open = null; U.editing = null; U.subFor = null; showView(); [$('list').scrollTop, $('inputsView').scrollTop] = U.listTop || [0, 0]; }  // the phone leaves the item page for Inputs; Back comes back to it (B152)
    if (U.tab !== 'inputs') setTab('inputs'); else { render(); if (!desk()) writeURL(true); }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const a = document.querySelector(`#inputsView [data-r="${id}"]`);
      if (!a) return;
      a.scrollIntoView({block: 'center'}); a.classList.add('bg-blue-50', 'dark:bg-blue-400/10');
      setTimeout(() => a.classList.remove('bg-blue-50', 'dark:bg-blue-400/10'), 1600);
    }));
  },
  'np-cancel': () => { $('npRow')?.remove(); $('drawerNew').hidden = false; },
  // The project's menu on the bar, and Settings › Projects (F173)
  'proj-menu': () => projectMenu(),
  'proj-up': b => { closeDialog(); projMove(b.dataset.slug, -1); },  // F253: when dragging is awkward
  'proj-down': b => { closeDialog(); projMove(b.dataset.slug, 1); },
  'proj-open': b => { closeDialog(); location.assign(`/p/${encodeURIComponent(b.dataset.slug)}/`); },
  'proj-settings': b => { closeDialog(); location.assign(`/p/${encodeURIComponent(b.dataset.slug)}/settings`); },
  'proj-rename': async b => {  // this project: its name on the bar becomes the field; another one: its row in Settings › Projects
    const slug = b.dataset.slug || S.project;
    closeDialog();
    if (slug !== S.project) { openProject('projects'); if (!P_CACHE.projects) await loadProjects(); return ACT['p-rename']({dataset: {slug}}); }
    U.renaming = slug; render(); const f = $('pRename'); if (f) { f.focus(); f.select(); }
  },
  'proj-new': () => { closeDialog(); ACT['new-project'](); },
  'proj-delete': async b => { closeDialog(); try { await deleteProject(b.dataset.slug || S.project); } catch (ex) { toast(ex.message); } },
  'p-new': () => { U.pNew = true; U.pErr = ''; U.renaming = null; U.pMenu = null; renderProject(); $('pNewName')?.focus(); },
  'p-new-cancel': () => { U.pNew = false; U.pNewText = ''; U.pErr = ''; renderProject(); },
  'p-create': async () => {
    const title = ($('pNewName')?.value || '').trim();
    if (!title) return $('pNewName')?.focus();
    try { const d = await projectCall('', {title}); location.assign(`/p/${encodeURIComponent(d.name)}/`); }  // made: open it
    catch (ex) { U.pErr = ex.message; U.pNewText = title; renderProject(); $('pNewName')?.focus(); }
  },
  'p-rename': b => { U.renaming = b.dataset.slug; U.pNew = false; U.pMenu = null; renderProject(); const f = $('pRename'); if (f) { f.focus(); f.select(); } },
  'p-rename-save': () => saveRename($('pRename')),  // the phone's Save; Enter does the same
  'p-rename-cancel': () => { U.renaming = null; renderProject(); if (desk()) renderProjBar(); },
  'p-more': b => { const k = b.dataset.key; U.pMenu = U.pMenu === k ? null : k; U.renaming = null; renderProject(); },  // the phone: a row's ⋯ opens a line of its actions
  'p-delete': async b => { U.pMenu = null; try { await deleteProject(b.dataset.slug); } catch (ex) { toast(ex.message); } },
  'p-restore': async b => {
    try { const d = await projectCall('restore', {name: b.dataset.slug}); U.pMenu = null; await loadProjects(); toast(`${d.title} is back`); } catch (ex) { toast(ex.message); }
  },
  'p-purge': async b => {
    if (!confirmClick(b, `${desk() ? 'Click' : 'Tap'} again: it can't be undone`)) return;
    try { await projectCall('purge', {name: b.dataset.slug}); U.pMenu = null; await loadProjects(); toast('Deleted for good'); } catch (ex) { toast(ex.message); }
  },
  guide: () => openProject('connect'),
  'agent-info': () => openProject('agents'),
  about: () => openProject('about'),
  phone: () => openProject('phone'),
  'new-key': async b => {
    if (!confirmClick(b, `${desk() ? 'Click' : 'Tap'} again: other devices will need the new link`)) return;
    try { await net('/api/key', {method: 'POST'}, NET.op); } catch (ex) { return notSaved(ex); }
    try { await load(); } catch (_) {}
    renderProject(); toast('New key made');
  },
  log: () => openProject('log'),
  deleted: () => openProject('deleted'),
  'input-delete': async b => {  // F177: to Deleted, with the items only it made; the toast says what went and what stayed, Undo and Z put it back
    const id = b.dataset.id;
    try { await save({op: 'delete', id}, () => ACT['input-delete'](b)); } catch (_) { return; }
    const x = (S.deleted || []).find(x => x.id === id);
    let run;
    run = pushUndo(`${id} deleted`, async () => {
      try { await save({op: 'restore', id}, run); } catch (_) { return false; }
      toast(`${id} is back${x?.items.length ? ` with ${x.items.map(i => i.code).join(', ')}` : ''}`);
    });
    toast(deletedSaid(x, id), run);
  },
  'input-restore': async b => {  // from Settings › Deleted: back as it was; Undo or Z deletes it again
    const id = b.dataset.id, x = (S.deleted || []).find(x => x.id === id);
    try { await save({op: 'restore', id}, () => ACT['input-restore'](b)); } catch (_) { return; }
    let run;
    run = pushUndo(`${id} restored`, async () => {
      try { await save({op: 'delete', id}, run); } catch (_) { return false; }
      toast(deletedSaid((S.deleted || []).find(x => x.id === id), id));
    });
    toast(`${id} is back${x?.items.length ? ` with ${x.items.map(i => i.code).join(', ')}` : ''}`, run);
  },
  tab: b => setTab(b.dataset.tab),
  filters: () => showFilters(),
  'set-filter': b => { U[b.dataset.k] = b.dataset.v; writeURL(false); if (desk()) return render(); renderItems(); $('list').scrollTop = 0; showFilters(); },
  unfilter: b => { U[b.dataset.k] = 'all'; writeURL(false); if (desk()) return render(); renderItems(); },
  reset: () => {
    U.q = ''; U.type = 'all'; U.when = 'all'; U.status = 'all'; U.pri = 'all'; $('q').value = ''; writeURL(false);
    if (desk()) return render();
    renderItems(); if (U.tab === 'inputs') renderInputs(); if (U.sheet === 'filter') showFilters();
  },
  open: b => openItem(Number(b.dataset.n)),
  back: () => desk() ? fullWidth(false) : hist(() => history.state?.n ? history.back() : closeItem()),
  'item-menu': () => itemMenu(U.open),
  'do-next': b => {  // F197: first of its priority in the agent's queue, or back where it was; with Undo and Z
    const n = Number(b.dataset.n), it = byN.get(n);
    if (!it) return;
    change(n, 'rank', it.rank == null ? -Math.round(Date.now() / 1000) : null);  // the latest "next" goes first
    if (U.sheet === 'menu' && !$('overlay').hidden) closeDialog();
  },
  'set-field': b => {  // type, priority and status from the ⋯ menu: with Undo and Z (T113 A7)
    const n = Number(b.dataset.n), menu = () => { if (U.sheet === 'menu' && !$('overlay').hidden) itemMenu(n); };
    change(n, b.dataset.f, b.dataset.v).then(ok => { if (!ok) menu(); });
    menu();
  },
  goto: b => {  // from a chip, a source, a subitem, the change log or Make item: to the item, leaving pages that hide it
    const walk = !desk() && U.go && U.peek && !$('overlay').hidden ? {go: U.go, n: U.peek} : null;  // Open on a card while going through: back from the item, the walk goes on (B153)
    closeDialog();
    const n = Number(b.dataset.n), it = byN.get(liveN(n));
    if (!desk()) { if (D.page) { keepPlace(); D.page = null; } openItem(n); U.goBack = walk; return; }  // from a page of Settings: Back comes back to it, where it was (B150)
    keepPlace();  // B9: one step in the history, so Back comes back here, scrolled as it was
    URLS.hold = true;
    try {
      D.page = null; D.compose = false;
      if (it && (U.tab === 'inputs' || !inTab(it, U.tab))) setTab(tabOf(it));
      openItem(n);
    } finally { URLS.hold = false; }
    writeURL(true, D.full ? {n: U.open, full: true, link: true} : undefined);
  },
  more: b => { U.more.add(Number(b.dataset.n)); renderDetail(); },
  'more-input': b => { const id = b.dataset.id; if (U.moreInputs.has(id)) U.moreInputs.delete(id); else U.moreInputs.add(id); renderInputs(); if (desk() && D.compose) renderDetail(); },
  edit: b => {
    closeDialog(); const n = U.editing = Number(b.dataset.n); renderDetail();
    const d = kept('edits')[n], body = $('eBody');
    if (d && $('eTitle')) { $('eTitle').value = d.title; body.value = d.body; $('eNext').value = d.next; toast('Your unsaved changes are back'); }
    if (body) { body.focus(); body.selectionStart = body.selectionEnd = body.value.length; }  // write on after the text, not before it
  },
  'edit-cancel': () => { const n = U.editing; kept('edits', all => delete all[n]); U.editing = null; renderDetail(); },
  'edit-save': async b => {
    const n = Number(b.dataset.n);
    try { await save({op: 'set', ref: code(n), f: {title: $('eTitle').value, body: $('eBody').value, next: $('eNext').value}}, () => $('eTitle') && ACT['edit-save'](b)); kept('edits', all => delete all[n]); U.editing = null; render(); toast('Saved'); } catch (_) {}
  },
  copy: b => { closeDialog(); copyItem(Number(b.dataset.n)); },
  'peek-set': b => {
    const n = Number(b.dataset.n), f = b.dataset.f, going = !!U.go;
    if (!going) closeDialog();
    change(n, f, f === 'archived' ? b.dataset.v === 'true' : b.dataset.v); if (going) advance(n);
  },
  play: b => playAudio(b),
  'doc-open': b => openDoc(Number(b.dataset.d)),
  'doc-new': b => newDoc(Number(b.dataset.n)),
  'doc-edit': () => { const was = kept('docs')[`D${U.doc}`]; U.docEdit = true; U.docText = was ?? null; renderDoc(); if (was) toast('Your draft is back'); $('docMd').focus(); },
  'doc-done': async () => { if (!await docVoiceSettled()) return; const d = await saveDoc(); if (d) openDoc(d.d); else if (!U.docEdit) closeDialog(); },  // Create or Save; F208: the words you spoke go in first
  'doc-mic': () => DV.rec ? docRecStop() : docRecStart(),
  'needs-more': () => { U.needsAll = !U.needsAll; renderItems(); },  // F209 (B250: its own name; it once took the sidebar's "Needs you" over)
  'doc-discard': () => {  // the draft goes; the document stays as it is
    const d = U.doc, key = docKey();
    docRecStop(false); DV.notes.forEach(v => { if (v.key === key) v.key = null; });  // F208: words still coming have nowhere to go
    kept('docs', all => delete all[key]); U.docEdit = false; U.docText = null;
    if (d && docById(d)) openDoc(d); else closeDialog();
  },
  'doc-pick': (b, e) => {
    if (U.docCircle || e.target.closest('textarea, button, a') || getSelection()?.toString().trim()) return;
    const k = b.dataset.key;
    if (U.docSel.has(k)) U.docSel.delete(k); else U.docSel.add(k);
    U.docQuote = null; U.docReply = null;
    renderDoc();
    if (desk() && docTarget()) $('text').focus({preventScroll: true});  // A1: you picked what to comment on: now write
  },
  'doc-unpick': () => { U.docSel = new Set(); U.docQuote = null; U.docReply = null; U.docDrafts.note = ''; getSelection()?.removeAllRanges(); renderDoc(); },
  'doc-close': () => closeDoc(),
  vc: () => vcToggle(),  // F184
  'vc-fix': () => {  // F204: the words you selected in a voice note get corrected in the box, and remembered
    const c = U.fixCand;
    if (!c) return;
    U.correct = c; U.amend = null; U.correctSel = true; U.fixCand = null;
    $('vcBar').hidden = true; renderComposer(); if (desk() && D.compose) renderDetail(); $('text').focus();
  },
  'doc-to-item': () => {  // B2: the words stay, now a reply to the document's item
    const n = liveN(docById(U.doc)?.n);
    if (desk()) closeDoc(); else { if (byN.has(n) && U.open !== n) openItem(n); closeDialog(); }
    $('text').focus({preventScroll: true});
  },  // B2: the words stay, now a reply to the item
  'doc-reply': b => { U.docReply = b.dataset.key; U.docSel = new Set(); U.docQuote = null; renderDoc(); $('text').focus(); },
  'doc-circle': () => { U.docCircle = !U.docCircle; renderDoc(); },
  'dc-edit': b => editComment(b.dataset.d, b.dataset.id),
  'dc-delete': b => deleteComment(b.dataset.d, b.dataset.id),
  'doc-thread': b => { const k = b.dataset.key; if (U.docThreads.has(k)) U.docThreads.delete(k); else U.docThreads.add(k); renderDoc(); },
  swipe: b => {
    const n = Number(b.dataset.n), f = b.dataset.f;
    SW.open = null; closeDialog();
    change(n, f, f === 'archived' ? b.dataset.v === 'true' : b.dataset.v);
  },
  archive: b => {  // E: with Undo and Z (T113 A7)
    const on = b.dataset.on === '1', n = Number(b.dataset.n);
    closeDialog();
    change(n, 'archived', on, {note: on ? 'Find it under Archive' : ''});
    if (on && U.open === n) ACT.back();
  },
  choice: b => {
    const n = Number(b.dataset.n), i = Number(b.dataset.i);
    if (U.choice?.n !== n) U.choice = {n, picked: new Set()};
    const p = U.choice.picked;
    if (b.dataset.multi) p.has(i) ? p.delete(i) : p.add(i); else { p.clear(); p.add(i); }
    if (U.peek === n && !$('overlay').hidden) { const top = $('dlgBody').scrollTop; peek(n, {focus: false}); $('dlgBody').scrollTop = top; }
    else { renderDetail(); renderComposer(); }  // the box says what goes with your words, and can send it (B164)
  },
  'choice-send': async b => {  // the answer is an ordinary reply on the item: one line per pick
    const n = Number(b.dataset.n), labels = U.choiceLabels[n] || [], picked = U.choice?.n === n ? [...U.choice.picked].sort((a, c) => a - c) : [];
    if (!picked.length) return;
    const picks = picked.map(i => '✓ ' + labels[i]).join('\n');
    // B145: what you wrote in the box for this item goes with the answer, files too: one answer, one send
    const withBox = scopeN() === n && !U.amend && !U.correct && !docOpen(), note = withBox ? $('text').value.trim() : '', files = withBox ? U.files : [];
    try {
      let rid = null;
      if (note || files.length) {
        outboxPush({text: picks + (note ? '\n\n' + note : ''), files, scope: code(n), from: null, quiet: true});  // the toast says it (T113 A19)
        $('text').value = ''; U.files = []; saveDraft(); grow(); flushOutbox();
      } else rid = (await save({op: 'input', text: picks, scope: code(n)}, () => ACT['choice-send'](b))).res[0].split(' ')[1];
      const said = `Answer sent to ${code(n)}${note || files.length ? ' with your note' : ''}`;  // where it went (B155)
      U.choice = null; if (U.peek === n) advance(n, said); else { toast(said); showSent(rid, code(n)); } if (desk() && U.go && U.open === n && U.go.list.includes(n)) advanceDesk(n, 'Answered');  // only an item of the walk moves it on (T113 A13)
    } catch (_) {}
  },
  'more-msg': b => {
    const id = Number(b.dataset.id);
    U.moreMsgs.has(id) ? U.moreMsgs.delete(id) : U.moreMsgs.add(id);
    if (U.peek && !$('overlay').hidden) { const top = $('dlgBody').scrollTop; peek(U.peek, {focus: false}); $('dlgBody').scrollTop = top; } else renderDetail();
  },
  fold: b => { const n = Number(b.dataset.n); U.folded.has(n) ? U.folded.delete(n) : U.folded.add(n); renderItems(); },
  'sub-new': b => {
    closeDialog(); const n = U.subFor = Number(b.dataset.n); renderDetail();
    const f = $('subTitle'), was = kept('subs')[n];
    if (f && was) { f.value = was; toast('Your subitem title is back'); }
    f?.focus();
  },
  'sub-cancel': () => { const n = U.subFor; kept('subs', all => delete all[n]); U.subFor = null; renderDetail(); },
  'sub-add': async b => {  // same kind, priority and now/later as the parent; change them after if needed
    const n = Number(b.dataset.n), p = byN.get(n), title = ($('subTitle')?.value || '').trim();
    if (!title) return $('subTitle')?.focus();
    try { await save({op: 'new', title, parent: code(n), type: p.type === 'rule' ? 'task' : p.type, pri: p.pri, when: p.when}, () => ACT['sub-add'](b)); kept('subs', all => delete all[n]); U.folded.delete(n); render(); toast(`Added under ${code(n)}`); const f = $('subTitle'); if (f) { f.value = ''; f.focus(); } flashRow(Math.max(...(kids.get(n) || []).map(k => k.n))); } catch (_) {}  // the field stays for the next one (B123)
  },
  'move-to': b => {  // M: with Undo and Z (T113 A7)
    const n = Number(b.dataset.n), to = b.dataset.to;
    closeDialog();
    change(n, 'parent', to === 'none' ? null : parseRef(to));
  },
  reparent: b => {  // the phone picks from the same list as the desktop, in the menu's sheet: no typing a code (B156, R139)
    if (desk()) closeDialog();
    movePicker(Number(b.dataset.n));
  },
  'make-item': async b => {  // no organizer and no agent around: turn the input into an item yourself
    const r = byR.get(b.dataset.id), lines = r.text.trim().split('\n'), first = lines[0].trim();
    const title = shortTitle(first) || `Files from ${r.id}`, body = title !== first ? r.text.trim() : lines.slice(1).join('\n').trim();  // a long first line stays whole in the body (T113 A25)
    try {
      const d = await save({op: 'new', title, body, src: r.id}, () => ACT['make-item'](b));
      const n = Number((d.res[0].match(/[A-Z](\d+) new/) || [])[1]);
      if (!n) return;
      let run;  // Undo and Z: the item goes, and the input waits again (T113 A7)
      run = pushUndo(`${code(n)} made from ${r.id}`, () => { toast(`${code(n)} undone: ${r.id} waits again`); return optimistic([{n, f: {status: 'dropped', archived: true}}], () => op({op: 'unmake', ref: code(n)}), ex => notSaved(ex, run)); });
      // T113 A25: you stay where you were; the new item's type and priority open right there, by its chip
      toast(`${code(n)} made from ${r.id}: set its type and priority`, run);
      if (!desk()) return itemMenu(n);
      const chip = [...document.querySelectorAll(`:is(#inputsView, #composeList) [data-act="goto"][data-n="${n}"]`)].find(el => el.offsetParent), at = chip?.getBoundingClientRect();
      itemMenuDesk(n, 't');
      if (at) popAt(at.left, at.bottom + 6);
    } catch (_) {}
  },
  'archive-all': () => {  // no question first: it happens at once; Undo stays 10 seconds in the same spot and in the toast (B154), then Z or the menu's Undo
    const ids = visible().filter(it => !it.archived && CLOSED(it.status)).map(it => it.n);
    if (!ids.length) return;
    const all = on => ({op: 'archive', refs: ids.map(code), on});  // one change, however many (T113 A5)
    clearInterval(U.undoArch?.timer);
    const z = document.querySelector('#list [data-zone="done"]');
    let h = 0;
    for (let x = z; x && (x === z || !x.dataset.zone); x = x.nextElementSibling) h += x.offsetHeight;
    U.archHold = h ? {h, sig: listSig()} : null;  // B3: the rows above don't slide under the pointer, so a second click lands where it was aimed
    const u = U.undoArch = {ids, left: 10}, gone = () => { clearInterval(u.timer); if (U.undoArch === u) U.undoArch = null; U.archHold = null; };  // 3 s was too short to reach on a phone (B154)
    u.run = pushUndo(`${plural(ids.length, 'item')} archived`, () => {  // the bar and Z put the whole batch back
      gone(); toast(`Put back ${plural(ids.length, 'item')}`);
      return optimistic(ids.map(n => ({n, f: {archived: false}})), () => op(all(false)), ex => notSaved(ex, u.run));
    });
    u.timer = setInterval(() => {
      if (--u.left > 0) { const el = $('undoLeft'); if (el) el.textContent = u.left; return; }
      clearInterval(u.timer);
      if (U.undoArch === u) { U.undoArch = null; if (!LIST.in) U.archHold = null; renderItems(); }  // under the pointer the place stays until it leaves
    }, 1000);
    optimistic(ids.map(n => ({n, f: {archived: true}})), async () => {
      const left = ((await op(all(true))).res[0].match(/not archived: (.+)$/) || [])[1];  // reopened meanwhile: they stay
      if (left) toast(`${left.split(' ').length === 1 ? `${left} isn't` : `${left.split(' ').join(', ')} aren't`} finished any more, so ${left.split(' ').length === 1 ? 'it stays' : 'they stay'}`);
    }, ex => { gone(); forget(u.run); renderItems(); notSaved(ex, () => ACT['archive-all']()); });
    toast(`Archived ${plural(ids.length, 'item')}`, u.run, {ms: 10000});  // where every Undo is, at the thumb on a phone (B154)
  },
  'archive-undo': () => U.undoArch?.run(),
  'search-in': b => { U.tabView[b.dataset.tab] = {q: U.q}; setTab(b.dataset.tab); },  // A9: the same search there, as the hint counted it (no filters)
  'copy-text': b => copy(b.dataset.text),
  sources: b => showSources(Number(b.dataset.n)),
  close: closeDialog,
  attach: () => $('fileInput').click(),
  mic: b => { R.from = b?.id === 'micBtn' ? 'aux' : 'main'; return startRec(); },  // F221: where you started is where a second tap sends
  // These hand back no promise: a button stays dimmed and deaf while its promise runs (B159), and the round button
  // is Send right after it stops a recording: the words must not hold it (B165).
  'rec-stop': () => { finishRec(false); },
  'rec-send': () => { finishRec(true); },
  'rec-cancel': () => { cancelRec(); },
  unfile: b => {  // B149: removing a voice note also removes the words it put in the box; both come back with Undo
    const i = Number(b.dataset.i), f = U.files[i], t = $('text'), before = t.value;
    U.files.splice(i, 1);
    if (f?.rid) { f.gone = true; dropRec(f, false); }  // T101: no longer kept in this browser either
    if (f?.trAdded && t.value.includes(f.trAdded)) {
      t.value = t.value.replace(f.trAdded, '').replace(/\n{3,}/g, '\n\n').trim(); saveDraft(); grow();
      toast('Removed the voice note and its words', () => {
        U.files.splice(i, 0, f); t.value = before; saveDraft(); grow(); renderComposer();
        if (f.rid) { f.gone = false; holdRec(f); keepRec(f); if (f.transcribing) hear(f); }
      });
    }
    renderComposer();
  },
  'doubt-use': b => {  // T101: the other transcription's words in place of the ones that may be misheard, in every place
    const f = U.files[Number(b.dataset.i)], x = f?.doubts?.[Number(b.dataset.k)];
    if (!x || !doubtPick(f, x, 'alt')) return;
    toast(`Changed to “${(x.show || [])[1] || x.alt}”`, () => { doubtPick(f, x, 'was'); delete x.pick; keepRec(f); renderComposer(); });
  },
  'doubt-pick': b => { const f = U.files[Number(b.dataset.i)], x = f?.doubts?.[Number(b.dataset.k)]; if (x) doubtPick(f, x, b.dataset.side); },  // F186
  'box-view': () => { U.boxView = true; renderComposer(); },
  'view-draft': b => {  // a screenshot in the box: a tap looks at it, it does not remove it
    const imgs = U.files.filter(f => f.f && (f.mime || '').startsWith('image/')).map(f => f.f), f = U.files[Number(b.dataset.i)];
    if (!f?.f) return;
    groups.set('draft', imgs); openViewer('draft', f.f);
  },
  unscope: () => carry(() => { U.scopeOff = true; renderComposer(); $('text').focus(); }),
  send,
  dismiss: () => { U.lastSent = null; U.note = null; renderFeedback(); },
  undo: async b => {  // Undo filing (T113 A4): what the organizer did with an input, as it left it; it says what changed, and Z puts it back
    const id = b.dataset.id, what = byR.get(id)?.filing?.what;
    let d;
    try { d = await net(P + 'api/undo', JSON_POST({id}), NET.op); } catch (ex) { return notSaved(ex, () => ACT.undo(b)); }
    if (!d.ok) return toast(d.error || 'Could not undo', null, {error: true});
    if (U.lastSent === id) U.lastSent = null;  // T113 A19: the toast says it; the line under the box doesn't say it again
    try { await load(); } catch (_) {}
    let run;
    run = pushUndo(`Filing of ${id} undone`, async () => {
      let r;
      try { r = await net(P + 'api/redo', JSON_POST({id}), NET.op); } catch (ex) { notSaved(ex, run); return false; }
      if (!r.ok) { toast(r.error || 'Could not put it back', null, {error: true}); return false; }
      try { await load(); } catch (_) {}
      toast(`The filing of ${id} is back`);
    });
    toast(`Undid the filing of ${id}${what ? `: ${what}` : ''}`, run);
  },
  'move-input': b => moveInput(b.dataset.id),
  'input-edit': b => editInput(b.dataset.id, 'edit'),
  'input-append': b => editInput(b.dataset.id, 'append'),
  'input-history': b => inputHistory(b.dataset.id),
  'amend-cancel': () => cancelAmend(),
  'prefs-edit': () => editPrefs(),  // F183
  'prefs-cancel': () => cancelPrefs(),
  'correct-cancel': () => cancelCorrect(),
  fixes: () => openProject('fixes'),
  'tidy-toggle': async () => {  // T256
    try { const d = await net('/api/voicetidy', JSON_POST({on: !P_CACHE.prefs.tidy}), NET.op); P_CACHE.prefs.tidy = d.tidy; renderProject(); toast(d.tidy ? 'Voice notes are tidied' : 'Voice notes are kept word for word'); } catch (ex) { notSaved(ex); }
  },
  'as-said': async b => {  // T256: the words of a tidied voice note as they were said
    try { const d = await net(`${P}api/transcript?f=${encodeURIComponent(b.dataset.f)}`, {method: 'POST'}); dialog('As said', `<p class="whitespace-pre-wrap break-words text-[15px]">${esc(d.heard || d.tr || 'No words were heard.')}</p>${d.heard ? '' : '<p class="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Nothing was tidied in this one: the words are as said.</p>'}`); } catch (_) { notLoaded('the words as said', () => ACT['as-said'](b)); }
  },
  'fix-add': async () => {  // T256: a word to hear right, no wrong form needed
    const right = ($('fixWord')?.value || '').trim();
    if (!right) return $('fixWord')?.focus();
    try { await setFix({right}); toast(`Voice notes will hear “${right}”`); } catch (_) {}
  },
  'fix-remove': async b => {
    if (!b.dataset.wrong) { const right = b.dataset.right; try { await setFix({right, forget: true}); toast(`Forgot “${right}”`, () => setFix({right}).catch(ex => notSaved(ex))); } catch (ex) { notSaved(ex, () => ACT['fix-remove'](b)); } return; }
    const wrong = b.dataset.wrong, c = (P_CACHE.fixes || []).find(x => x.wrong === wrong);
    try { await setFix({wrong}); toast(`Forgot “${wrong}”`, () => setFix({wrong, right: c.right}).catch(ex => notSaved(ex))); } catch (ex) { notSaved(ex, () => ACT['fix-remove'](b)); }
  },
  'undo-mine': () => undoMine(),
  unsend: b => [...U.outbox, ...(U.sentJobs || [])].find(j => j.q === b.dataset.q)?.undo?.(),  // T113 A27
  revert: b => {
    if (!confirmClick(b, `${desk() ? 'Click' : 'Tap'} again to undo`)) return;  // B127: an older change goes back only on a second click
    return revertNow(Number(b.dataset.seq));
  },
  'outbox-retry': () => { for (const q of U.outbox) q.failed = false; renderFeedback(); flushOutbox(); },
  'outbox-edit': () => {  // the unsent input back in the box, as long as the box is empty
    const q = U.outbox[0];
    if ($('text').value.trim() || U.files.length) return toast('Send or clear what is in the box first');
    U.outbox.shift(); dropJob(q); $('text').value = q.text; U.files = q.files; grow(); saveDraft(); render(); $('text').focus();
    for (const f of q.files) if (f.rid) { f.job = null; f.key = U.draftKey; keepRec(f); }  // T101: kept as a draft in this box again
  },
  'move-input-to': async b => {
    const id = b.dataset.id, to = b.dataset.to;
    b.disabled = true;
    try {
      const d = await net(P + 'api/move', JSON_POST({id, to}), NET.op);
      if (!d.ok) return toast(d.error || 'Could not move it', null, {error: true});
      closeDialog(); if (U.lastSent === id) U.lastSent = null;  // T113 A19: one message, the toast, with Open
      try { await load(); } catch (_) {}
      toast(`Moved ${id} to ${to} as ${d.as}`, () => location.assign(`/p/${encodeURIComponent(to)}/`), {label: 'Open'});
    } catch (ex) { notSaved(ex, () => ACT['move-input-to'](b)); }
    finally { b.disabled = false; }
  },
  retry: async b => {
    try { await net(P + 'api/organize', JSON_POST({id: b.dataset.id}), NET.op); U.lastSent = b.dataset.id; } catch (ex) { notSaved(ex, () => ACT.retry(b)); }
  },
  view: b => openViewer(b.dataset.g, b.dataset.f),
  'v-close': () => { if ($('viewer').hidden) return; closeViewer(); layerShut('viewer'); },
  'v-prev': () => { if (viewerIdx > 0) { viewerIdx--; showImage(); } },
  'v-next': () => { if (viewerIdx < viewerGroup.length - 1) { viewerIdx++; showImage(); } },
  'v-zoom': b => { const img = $('vImg'), fit = img.classList.contains('max-w-full'); img.className = fit ? 'm-auto max-w-none' : 'm-auto max-h-full max-w-full object-contain'; b.textContent = fit ? 'Fit to screen' : 'Zoom to 100%'; },
};

const drag = {};
$('dlg').addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' || !e.target.closest('[data-handle], header') || e.target.closest('button')) return;
  Object.assign(drag, {id: e.pointerId, y0: e.clientY, dy: 0, on: true});
  $('dlg').style.transition = 'none';
});
$('dlg').addEventListener('pointermove', e => {
  if (!drag.on || e.pointerId !== drag.id) return;
  drag.dy = Math.max(0, e.clientY - drag.y0);
  $('dlg').style.transform = drag.dy ? `translateY(${drag.dy}px)` : '';
});
const dragEnd = () => {
  if (!drag.on) return;
  drag.on = false;
  $('dlg').style.transition = '';
  $('dlg').style.transform = '';
  if (drag.dy > 80) closeDialog();
};
$('dlg').addEventListener('pointerup', dragEnd);
$('dlg').addEventListener('pointercancel', dragEnd);

// ---------------------------------------------------------------- desktop (I70, design A "three panes")
// From 1024px: a sidebar (projects, the tabs, this project's settings), the list, and the selected item beside
// it. Below 1280px the sidebar folds to a rail of icons. Every step works from the keyboard. The phone layout
// below 1024px is not touched by any of this.

function showDesk() {
  const inputs = U.tab === 'inputs', page = !!D.page, full = D.full && !!U.open && !inputs && !page, wide = inputs || full;
  $('headNormal').hidden = true; $('headSearch').hidden = false;
  $('mainHead').hidden = page || full;
  $('itemsView').hidden = page || inputs || full;
  $('inputsView').hidden = page || !inputs;
  $('detailView').hidden = page || inputs;
  $('projectView').hidden = !page; $('projectNav').hidden = $('projectBody').hidden = false;  // the phone shows one of the two at a time
  $('foot').hidden = page && !U.prefsEdit;  // the one box shows on Voice spellings while you edit the preferences (F183)
  $('projectBody').classList.toggle('pb-64', page && !!U.prefsEdit);  // and the page's end stays clear of it
  $('deskFilters').hidden = page || full || inputs || !(D.filters || filtersSet().length);
  $('listGrip').hidden = page || full || inputs;
  $('app').toggleAttribute('data-compose', D.compose && !page && !inputs);  // New input: the one box moves to the middle (B73)
  $('mainHead').classList.toggle('lg:col-span-2', inputs);
  for (const el of [$('detailView'), $('foot')]) {  // one wide page: the inputs, or an item at full width
    el.classList.toggle('lg:col-start-1', wide); el.classList.toggle('lg:col-start-2', !wide); el.classList.toggle('lg:col-span-2', wide);
  }
  const rail = !WIDE.matches || D.sideHidden, over = rail && D.sideOpen;
  $('rail').hidden = !rail || page;  // Settings take the sidebar's place while open (B162): one column of places
  $('projBar').hidden = page;
  $('drawer').hidden = (rail && !over) || page;
  $('drawer').classList.toggle('lg:relative', !over);
  for (const c of ['lg:fixed', 'lg:shadow-2xl']) $('drawer').classList.toggle(c, over);
  $('drawerShade').hidden = !over; $('drawerShade').style.left = over ? $('drawer').offsetWidth + 'px' : '';
}

const TAB_NAME = {items: 'Items', inputs: 'Inputs', archive: 'Archive', rules: 'Rules'};
const TAB_ICON = {items: 'items', inputs: 'inbox', archive: 'archive', rules: 'book'};
// One count per thing, the same wherever it shows (A18, B18). A project's row in the sidebar says how many of its items
// are open, whatever you search or filter. The tabs on the bar, as on the phone, say what each tab holds: Items the
// open ones, Inputs those not organized yet, Archive all, Rules those not retired; while you search or filter Items,
// how many match (B130). The bar's tabs are the list's title (B162).
const tabRows = t => t === 'inputs' ? S.inputs : S.items.filter(it => !it.merged_into && inTab(it, t));
const tabCount = t => t === 'items' ? openCount() : t === 'inputs' ? S.inputs.filter(r => !r.acked).length || ''
  : t === 'archive' ? tabRows('archive').length || '' : tabRows('rules').filter(it => it.status !== 'dropped').length || '';
function renderDeskHead() {
  $('q').placeholder = U.tab === 'inputs' ? 'Search what you said' : 'Search items';
  qSync();
  $('headSearch').firstElementChild.classList.toggle('lg:max-w-sm', U.tab === 'inputs');
  $('headSearch').firstElementChild.classList.toggle('lg:ml-auto', U.tab === 'inputs');
}

// The sidebar: this project as a card with its agent and its tabs, the other projects, and this project's settings.
// The desktop, option B (B162): the sidebar holds New input and the projects, each with its agent and what needs you;
// this project's tabs and its agent sit in a bar on top of the list and the item, as on the phone. Its name opens the
// project's menu: settings, rename, switch, new, delete. Below 1280px the sidebar folds to a rail of project tiles.
function renderProjBar() {
  if (U.renaming === S.project && document.activeElement?.id === 'pRename') return renderAgent();  // a refresh must not take the name you are typing
  const pre = !S.project && sideProjects()[0];  // before the data (B190): the frame as it will be, with what this browser last saw
  const kept = pre && keptCounts(), tab = t => { const n = pre ? (t === 'archive' ? '' : kept ? kept[TABS.indexOf(t)] : t === 'items' ? pre.open : '') : searchWords().length ? searchCount(t) || '' : t === 'archive' ? '' : t === 'items' && filtered() && U.tab === 'items' ? visible().filter(it => !it.archived).length : tabCount(t);
    return `<button data-act="tab" data-tab="${t}" role="tab" aria-selected="${U.tab === t && !D.page}" class="group -mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-0.5 text-sm font-medium text-zinc-500 hover:text-zinc-800 aria-selected:border-zinc-900 aria-selected:font-semibold aria-selected:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 dark:aria-selected:border-zinc-100 dark:aria-selected:text-zinc-50">${TAB_NAME[t]}<span class="font-mono text-[11px] font-medium text-zinc-400 tabular-nums">${n}</span></button>`; };
  const name = U.renaming && U.renaming === S.project
    ? `<div class="flex min-w-0 items-center gap-2 px-1">${projTile(S.project, 'size-6 rounded-md text-xs')}<input id="pRename" data-slug="${esc(S.project)}" class="${FIELD} h-8 w-64 py-1 text-[15px] font-semibold" value="${esc(projTitle())}" aria-label="New name for ${esc(projTitle())}" autocomplete="off" spellcheck="false"><span class="text-xs whitespace-nowrap text-zinc-500 dark:text-zinc-400">${KBD('↵')} save · ${KBD('Esc')} cancel</span></div>`
    : `<button data-act="proj-menu" id="projMenuBtn" aria-haspopup="menu" title="${esc(pre ? titleOf(pre) : projTitle())}: settings, rename, switch, delete" class="my-1.5 flex min-w-0 max-w-72 items-center gap-2 rounded-lg px-2 hover:bg-zinc-100 data-pressed:bg-zinc-200/70 dark:hover:bg-zinc-800">${projTile(S.project || HERE, 'size-6 rounded-md text-xs')}<span class="truncate text-[15px] font-semibold">${esc(pre ? titleOf(pre) : projTitle())}</span>${ico('down', 'size-4 shrink-0 text-zinc-400', '2')}</button>`;
  draw($('projBar'), `${name}<span class="mx-2 my-3.5 w-px shrink-0 bg-zinc-200 dark:bg-zinc-800"></span>
    <div role="tablist" class="flex min-w-0 items-stretch gap-5">${['items', 'inputs', 'archive', 'rules'].map(tab).join('')}</div>
    <div id="deskAgent" class="ml-auto flex shrink-0 items-center pl-3"></div>`);
  if (S.project) renderAgent();  // the agent's pill comes with the data
}
// F253: the projects in the order you dragged them into (the same on every page that lists them), the rest by name
const projOrder = (a, b) => (a.pos ?? 1e9) - (b.pos ?? 1e9) || titleOf(a).localeCompare(titleOf(b));
function sideProjects() {  // every project in your order, this one with what this page knows now: no row moves when you pick one (B12, B200)
  const seen = (DR.list || []).find(p => p.name === (S.project || HERE));
  const here = S.project ? {name: S.project, title: S.title, open: openCount(), needs: S.items.filter(needsYou).length, agents: S.agents, work: S.work, pos: seen?.pos}
    : seen || {name: HERE, title: '', open: '…', needs: 0};  // before the data (B190): as this browser last saw it
  return [here, ...(DR.list || []).filter(p => p.name !== here.name)].sort(projOrder);
}
function renderSidebar() {
  draw($('drawerList'), sideProjects().map(p => { const cur = p.name === (S.project || HERE), [tone, label] = agentState(p.agents, p.work);
    return `<a href="/p/${encodeURIComponent(p.name)}/" data-slug="${esc(p.name)}" ${cur ? 'aria-current="page" data-act="new-input"' : ''} class="flex items-center gap-2.5 rounded-xl px-2.5 py-2 select-none [-webkit-touch-callout:none] data-dragging:bg-zinc-200/70 data-dragging:ring-0 data-dragging:[&>*]:invisible dark:data-dragging:bg-zinc-800/70 hover:bg-zinc-200/60 data-pressed:bg-zinc-200/80 aria-[current=page]:bg-blue-100 aria-[current=page]:ring-1 aria-[current=page]:ring-blue-200 aria-[current=page]:hover:bg-blue-100 dark:hover:bg-zinc-800 dark:aria-[current=page]:bg-blue-400/15 dark:aria-[current=page]:ring-blue-400/30 dark:aria-[current=page]:hover:bg-blue-400/20">${projTile(p.name, 'size-6 rounded-md text-xs')}
      <span class="min-w-0 flex-1"><span class="flex items-center gap-1.5"><span class="min-w-0 flex-1 truncate text-sm ${cur ? 'font-semibold' : 'font-medium'}">${esc(titleOf(p))}</span>${p.needs ? `<span title="${plural(p.needs, 'item')} need you" class="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-amber-100 px-1 text-[11px] font-bold text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">${p.needs}</span>` : ''}</span><span class="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400"><span class="size-1.5 shrink-0 rounded-full ${AGENT_TONE[tone][0]}"></span><span class="truncate ${tone === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : AGENT_TONE[tone][1]}">${esc(label)}</span><span class="shrink-0">· ${p.open} open</span></span></span></a>`; }).join(''));
  $('newInputBtn').setAttribute('aria-pressed', String(D.compose && !D.page));
  const nb = $('newInputBtn').querySelector('span'), rule = U.tab === 'rules' && !D.page;  // on Rules it makes a new rule, and says so (T113 A22)
  if (nb && nb.textContent !== (rule ? 'New rule' : 'New input')) { nb.textContent = rule ? 'New rule' : 'New input'; $('newInputBtn').title = rule ? 'New rule for the project · C' : 'New input to the project · C · by voice ⇧V'; }
  if (S.project) renderAgent();
  renderDrawerSettings();
}
const othersNeeding = () => (DR.list || []).filter(p => p.name !== (S.project || HERE) && p.needs).sort(projOrder);
// Go through goes on in the next project that has something for you (F193): ⇧J in a project with nothing left
// for you, or Go on at the end of a walk, opens it and starts going through there.
const nextNeeding = () => { const others = othersNeeding(); return others.find(p => titleOf(p).localeCompare(projTitle()) > 0) || others[0]; };  // the one after this, by name
function goNextProject() {
  const after = nextNeeding();
  if (!after) return false;
  try { sessionStorage.setItem('taska.go.start', after.name); } catch (_) {}
  location.assign(`/p/${encodeURIComponent(after.name)}/`);
  return true;
}
function startGoFromAnotherProject() {
  try {
    if (sessionStorage.getItem('taska.go.start') !== S.project) return;
    sessionStorage.removeItem('taska.go.start');
  } catch (_) { return; }
  if (desk() && !U.go) startGoDesk();
}
function renderSideFoot() {  // the sidebar's foot: Undo (when there is one), Settings, the keys
  const foot = (act, icon, label, key, attrs = '') => `<button data-act="${act}" ${attrs} class="flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800">${ico(icon, 'size-4 shrink-0 text-zinc-500 dark:text-zinc-400', '2')}<span class="min-w-0 flex-1 truncate">${label}</span>${KBD(key)}</button>`;
  const u = U.mine.at(-1);
  draw($('sideFoot'), foot('undo-mine', 'undo', u ? `Undo: ${esc(u.label)}` : 'Nothing to undo', 'Z', u ? 'title="Undo · Z"' : 'disabled')  // always there: the sidebar never moves (T113 B28)
    + `<div class="flex items-center gap-0.5">${foot('project', 'gear', 'Settings', 'G S', 'title="Settings · G S"')}<button data-act="keys" title="Keyboard shortcuts · ?" aria-label="Keyboard shortcuts" class="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800">${ico('keyboard', 'size-4')}</button></div>`);
}
function renderRail() {
  const b = (act, inner, title, attrs = '') => `<button data-act="${act}" ${attrs} title="${title}" aria-label="${title.split(' · ')[0]}" class="relative grid size-10 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-200/60 aria-pressed:bg-zinc-200/80 aria-pressed:text-zinc-900 aria-[current=page]:bg-zinc-200/80 aria-[current=page]:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:aria-pressed:bg-zinc-700 dark:aria-pressed:text-zinc-50 dark:aria-[current=page]:bg-zinc-700 dark:aria-[current=page]:text-zinc-50">${inner}</button>`;
  const proj = p => { const cur = p.name === (S.project || HERE);
    return `<a href="/p/${encodeURIComponent(p.name)}/" data-slug="${esc(p.name)}" ${cur ? 'aria-current="page" data-act="new-input"' : ''} title="${esc(titleOf(p))}${p.needs ? ` · ${plural(p.needs, 'item')} need you` : ''}" aria-label="${esc(titleOf(p))}" class="relative grid size-10 place-items-center rounded-xl hover:bg-zinc-200/60 aria-[current=page]:bg-blue-100 aria-[current=page]:ring-1 aria-[current=page]:ring-blue-300 dark:hover:bg-zinc-800 dark:aria-[current=page]:bg-blue-400/20 dark:aria-[current=page]:ring-blue-400/40">${projTile(p.name, 'size-7 rounded-lg text-xs')}${p.needs ? `<span class="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white dark:bg-amber-400 dark:text-amber-950">${p.needs}</span>` : ''}</a>`; };
  draw($('rail'), b('side', `<span class="text-blue-600 dark:text-blue-400">${ico('logo', 'size-6', '2.25')}</span>`, 'Show the sidebar · [')
    + b('new-input', ico('newinput', 'size-5'), U.tab === 'rules' && !D.page ? 'New rule · C' : 'New input · C', `aria-pressed="${D.compose && !D.page}"`)
    + `<div class="my-1 h-px w-8 bg-zinc-200 dark:bg-zinc-800"></div>`
    + `<div class="-my-1 flex min-h-0 flex-col items-center gap-1 overflow-y-auto p-1 [scrollbar-width:none]">${sideProjects().map(proj).join('')}</div>`  // room for the badges
    + b('new-project', ico('plus', 'size-5'), 'New project')
    + `<div class="flex-1"></div>`
    + b('project', ico('gear', 'size-5'), 'Settings · G S', D.page ? 'aria-current="page"' : '')
    + b('keys', ico('keyboard', 'size-5'), 'Keyboard shortcuts · ?'));
}
// The project's menu (F173), from its name on the bar, or for any project by right-clicking it in the sidebar or the
// rail: its settings, rename it, switch or open, make a new one, delete it (Undo, or Restore in Settings › Projects).
function projectMenu(slug = S.project, at = null) {
  const here = slug === S.project, p = here ? {name: S.project, title: S.title, open: openCount()} : (DR.list || []).find(p => p.name === slug);
  if (!p) return;
  const r = !at && $('projMenuBtn')?.getBoundingClientRect(), on = `data-slug="${esc(slug)}"`;
  const row = (act, icon, label, key = '', tone = '') => `<button data-act="${act}" ${on} class="flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${tone}">${ico(icon, `size-[18px] ${tone || 'text-zinc-500 dark:text-zinc-400'}`)}<span class="min-w-0 flex-1 truncate">${label}</span>${key ? `<kbd class="grid h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold text-zinc-400 ring-1 ring-zinc-300 dark:ring-zinc-600">${key}</kbd>` : ''}</button>`;
  U.sheet = 'projmenu';
  dialog('', `<div class="-mx-1 flex flex-col">${here ? '' : row('proj-open', 'arrow', 'Open')}${row(here ? 'project' : 'proj-settings', 'gear', 'Project settings', here ? 'G S' : '')}${row('proj-rename', 'pencil', 'Rename')}${here ? row('switch', 'updown', 'Switch project', 'G P') : ''}${(DR.list || []).length > 1 ? row('proj-up', 'chevup', 'Move up') + row('proj-down', 'down', 'Move down') : ''}${row('proj-new', 'plus', 'New project')}
    <div class="my-1.5 border-t border-zinc-100 dark:border-zinc-800"></div>${row('proj-delete', 'trash', 'Delete project', '', 'text-red-600 dark:text-red-400')}
    <p class="px-2.5 pt-0.5 pb-1 text-xs leading-snug text-zinc-500 dark:text-zinc-400">Goes to Settings › Projects › Deleted. Restore it any time.</p></div>`,
    {pop: true, focus: false, head: `<span class="flex items-center gap-2.5">${projTile(slug, 'size-8 rounded-lg text-sm')}<span class="min-w-0"><span class="block truncate text-sm font-semibold">${esc(titleOf(p))}</span><span class="block truncate font-mono text-xs font-normal text-zinc-500 dark:text-zinc-400">/p/${esc(slug)} · ${p.open} open</span></span></span>`});
  if (at) popAt(...at); else if (r) popAt(r.left, r.bottom + 6);
}

// The desktop's New input page (B73): the one input box moves to the middle of the right pane, under the project's
// tile and name, and what you said lately runs below it as a timeline of what each input became. A reply keeps
// the box at the bottom of the item, so the two never look alike. Only the head and the list are drawn here;
// the box itself is the same element as always, restyled by the data-compose switch on #app.
function composeHead() {
  if (U.correct && byR.has(U.correct.id)) return `<div class="flex items-center gap-3">${projTile(S.project, 'size-11 rounded-xl text-xl shadow-sm')}<h1 class="text-[28px] leading-none font-semibold tracking-tight">Correct “${esc(U.correct.wrong)}”</h1></div>
    <p class="mt-3.5 text-[15px] text-zinc-500 dark:text-zinc-400">in ${U.correct.id}; voice notes in every project will write it your way from now on</p>
    <button data-act="correct-cancel" class="mt-2 h-8 rounded-full px-3 text-[13px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">Back to a new input${KBD('Esc')}</button>`;
  const a = U.amend && byR.get(U.amend.id);
  if (a) return `<div class="flex items-center gap-3">${projTile(S.project, 'size-11 rounded-xl text-xl shadow-sm')}<h1 class="text-[28px] leading-none font-semibold tracking-tight">${U.amend.mode === 'edit' ? 'Edit' : 'Add details to'} ${a.id}</h1></div>
    <p class="mt-3.5 line-clamp-2 max-w-full text-[15px] text-zinc-500 dark:text-zinc-400">“${esc(oneLine(a.text))}”</p>
    <button data-act="amend-cancel" class="mt-2 h-8 rounded-full px-3 text-[13px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">Back to a new input${KBD('Esc')}</button>`;
  return `<div class="flex items-center gap-3">${projTile(S.project, 'size-11 rounded-xl text-xl shadow-sm')}<h1 class="text-[28px] leading-none font-semibold tracking-tight">${esc(projTitle())}</h1></div>
    <p class="mt-3.5 flex items-center justify-center gap-0 text-[15px] text-zinc-500 dark:text-zinc-400">${ruleMode() ? '<span class="font-medium text-zinc-700 dark:text-zinc-200">New rule</span>&nbsp;for the whole project' : 'New input to the whole project'}<span class="px-1.5 text-zinc-300 dark:text-zinc-600">·</span><span class="inline-flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-200">${ico('sparkle', 'size-4 text-blue-600 dark:text-blue-400')}${S.org?.on ? 'the organizer files it' : 'your agent files it'}</span></p>${ruleFlip() ? `<div class="mt-2 flex justify-center">${ruleFlip()}</div>` : ''}`;
}
const DOT = {
  pulse: '<span class="relative flex size-2.5"><span class="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75"></span><span class="relative inline-flex size-2.5 rounded-full bg-blue-500 dark:bg-blue-400"></span></span>',
  ok: '<span class="size-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/15 dark:bg-emerald-400 dark:ring-emerald-400/15"></span>',
  bad: '<span class="size-2.5 rounded-full bg-red-500 ring-4 ring-red-500/15 dark:bg-red-400 dark:ring-red-400/15"></span>',
  idle: '<span class="size-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600"></span>',
  wait: '<span class="size-2.5 rounded-full border-2 border-zinc-300 dark:border-zinc-600"></span>'};
const dotOf = r => r.moved ? 'wait' : S.org.busy === r.id || r.tr_wait ? 'pulse' : r.org && !r.org.ok ? 'bad' : r.org?.undone ? 'idle' : r.acked ? 'ok' : !r.org && S.org.on ? 'idle' : 'wait';
const SMALL_BTN = 'flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200';
// One step of the timeline: a dot, your words in a bubble, and the line saying what became of them.
function saidStep(dot, bubble, meta, result, last, attrs = '') {
  return `<li class="group/row relative flex gap-3 pb-5">${last ? '' : '<span aria-hidden="true" class="absolute top-7.5 -bottom-1.5 left-[11.5px] w-px bg-zinc-200 dark:bg-zinc-800"></span>'}<span class="relative mt-1.5 grid size-6 shrink-0 place-items-center">${dot}</span>
    <div class="min-w-0 flex-1"><div class="flex items-start gap-3"><div ${attrs} class="w-fit max-w-full min-w-0 rounded-2xl rounded-tl-md bg-blue-50 px-3.5 py-1.5 text-[15px] leading-6 text-zinc-900 dark:bg-blue-400/10 dark:text-zinc-100">${bubble}</div>
      <span class="ml-auto shrink-0 pt-1.5 text-xs whitespace-nowrap text-zinc-400 tabular-nums dark:text-zinc-500">${meta}</span></div>
      <div class="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">${result}</div></div></li>`;
}
function saidRow(r, k, last) {
  const [label, tone] = inputState(r), scope = r.scope && byN.get(r.scope);
  const said = r.text || (r.files.some(f => (f.mime || '').startsWith('audio/')) ? 'Voice note' : '');
  const bubble = (scope ? `<button data-act="goto" data-n="${scope.n}" class="mb-0.5 flex max-w-full items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">${ico('reply', 'size-3.5')}<span class="truncate">Reply to ${code(scope.n)} · ${esc(scope.title)}</span></button>` : '')
    + (said ? `<p data-cut class="${U.moreInputs.has(r.id) ? 'whitespace-pre-line' : 'line-clamp-2'} break-words">${esc(said)}</p>` : '') + (r.files.length ? `<div class="mt-2 flex items-end gap-2">${thumbs(r.files, 'cl' + r.id, 'size-12')}</div>` : '');
  const chips = r.moved ? '' : r.touched.filter(n => byN.has(n) && n !== r.scope).map(n => { const it = byN.get(n); return `<button data-act="goto" data-n="${n}" title="Open ${code(n)}" class="flex h-7 max-w-60 min-w-0 items-center gap-1.5 rounded-lg bg-zinc-100 pr-2.5 pl-1.5 text-[13px] text-zinc-800 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">${stateIcon(it.status, statusName(it), 'size-4')}<span class="font-mono text-xs font-bold ${TYPE_TEXT[it.type]}">${code(n)}</span><span class="truncate">${esc(it.title)}</span></button>`; }).join('');
  const busy = S.org.busy === r.id || (!r.acked && S.org.on && !r.org);
  // The same actions as on Inputs, in the same order and always in sight (T113 A26, B32): what its state allows on
  // one line, then what every input has.
  const acts = (busy ? '<span class="h-7 w-44 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"></span>' : '')
    + (r.org && !r.org.ok ? `<span class="min-w-0 basis-full truncate text-[13px] text-red-600/80 dark:text-red-400/80">${esc(r.org.msg)}</span>` : '')
    + inputActs(r, SMALL_BTN).filter(Boolean).map(a => `<div class="flex basis-full flex-wrap items-center gap-1">${a}</div>`).join('');
  return saidStep(DOT[dotOf(r)], bubble, `<span class="font-mono">${r.id}</span> · ${when(r.t)}${r.from === 'rules' ? ' · as a rule' : ''}`, `<span class="mr-1 text-[13px] font-semibold ${tone}">${label}</span>${chips}${acts}`, last, `data-expand data-id="${r.id}" ${voiceAttr(r)}`);
}
function outboxStep(q, last) {  // still on its way (F85)
  const state = q.failed ? 'Not sent' : q.files.some(f => !f.f && !f.failed) ? 'Uploading…' : 'Sending…';  // the words never hold it up (B165)
  const bubble = (q.text ? `<p class="line-clamp-2 break-words">${esc(q.text)}</p>` : `<p>${esc(outboxLine(q))}</p>`) + (q.files.some(f => f.preview) ? `<div class="mt-2 flex gap-2">${q.files.filter(f => f.preview).map(f => `<img src="${f.preview}" alt="" class="size-12 rounded-lg border border-zinc-200 object-cover dark:border-zinc-700">`).join('')}</div>` : '');
  return saidStep(q.failed ? DOT.bad : DOT.pulse, bubble, 'Just now', `<span class="mr-1 text-[13px] font-semibold ${q.failed ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}">${state}</span>${q.failed ? `<button data-act="outbox-retry" class="${SMALL_BTN} text-blue-600 dark:text-blue-400">Retry</button><button data-act="outbox-edit" class="${SMALL_BTN}">Edit</button>` : ''}`, last);
}
// I176: on the New input page what is in the box shows at the top of "You said lately" as a Draft card, kept in step
// with the box both ways. F186: each word the two transcriptions heard differently is a toggle there, the main model's
// word on the left (in the text at first), the other model's on the right; amber until you pick, grey with a check after,
// and switchable until you send; a pick changes every place of it, in the box too. Words of a voice note can be selected
// in the card and corrected in place: the box follows, and Taska remembers the spelling (F144), with Undo. Words typed in
// the box are just words. The draft stays in this browser until you send it.
const dForm = (x, o) => x.pick === 'alt' ? o.alt : o.was;  // what is in the text now, at one place of a doubt
function draftSpots(text) {  // -> the places of each doubt in the text now, in order, not overlapping
  const out = [];
  U.files.forEach((f, i) => (f.doubts || []).forEach((x, k) => {
    for (const o of [x, ...(x.also || [])]) {  // every place it is in the text now, typed again or pasted too
      const cur = dForm(x, o);
      for (let at = cur ? text.indexOf(cur) : -1; at >= 0; at = text.indexOf(cur, at + cur.length)) out.push({s: at, e: at + cur.length, f, i, k, x, o});
    }
  }));
  out.sort((a, b) => a.s - b.s);
  return out.filter((p, j) => !out.slice(0, j).some(q => q.e > p.s));
}
function draftHtml(text, fix = false) {  // the text, with the toggles; fix: the voice note's words can be selected to correct them
  const vr = U.files.filter(f => f.trAdded).map(f => { const at = text.indexOf(f.trAdded); return at < 0 ? null : [at, at + f.trAdded.length]; }).filter(Boolean);
  const inV = o => vr.some(([a, b]) => o >= a && o < b);
  const plain = (a, b) => { let out = ''; for (let i = a; i < b;) { const v = inV(i); let j = i + 1; while (j < b && inV(j) === v) j++; out += `<span data-o="${i}"${v && fix ? ' data-v' : ''}>${esc(text.slice(i, j))}</span>`; i = j; } return out; };
  let html = '', at = 0;
  for (const p of draftSpots(text)) {
    const {x, o, i, k} = p, cur = text.slice(p.s, p.e);
    html += plain(at, p.s); at = p.e;
    if (!x.alt) { html += `<span data-o="${p.s}"${fix ? ' data-v data-unsure' : ''} title="The model was not sure of these words" class="underline decoration-amber-500 decoration-dotted decoration-2 underline-offset-4 ${fix ? 'cursor-text' : ''}">${esc(cur)}</span>`; continue; }
    let [c0, c1] = x.show && o.was.includes(x.show[0]) && o.alt.includes(x.show[1]) ? x.show : [o.was, o.alt];  // just the words that differ
    const core = x.pick === 'alt' ? c1 : c0, ix = core ? cur.indexOf(core) : -1;
    if (ix < 0) [c0, c1] = [o.was, o.alt];
    const pre = ix < 0 ? '' : cur.slice(0, ix), post = ix < 0 ? '' : cur.slice(ix + core.length), side = x.pick || 'was';
    const btn = (sd, label) => { const on = side === sd; return `<button data-act="doubt-pick" data-i="${i}" data-k="${k}" data-side="${sd}" aria-pressed="${on}" tabindex="${on ? 0 : -1}" title="${sd === 'was' ? 'Main model' : 'Other model'}${on ? ' · in the text now' : ''} · ← → or 1 2 to pick, Esc to the box" class="inline-flex items-center gap-1 rounded-md px-1.5 leading-6 ${on ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-900/10 dark:bg-zinc-700 dark:text-zinc-50 dark:ring-white/10' : 'text-zinc-500 hover:bg-white/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-100'}">${on && x.pick ? ico('check', 'size-3.5 text-emerald-600 dark:text-emerald-400', '2.5') : ''}${esc(unmarked(label))}</button>`; };
    html += plain(p.s, p.s + pre.length) + `<span data-tog role="group" aria-label="Maybe misheard: two versions" class="mx-0.5 inline-flex items-center gap-px rounded-lg p-0.5 align-baseline whitespace-nowrap ring-1 ${x.pick ? 'bg-zinc-100 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700' : 'bg-amber-100/80 ring-amber-300 dark:bg-amber-400/15 dark:ring-amber-400/40'}">${btn('was', c0)}${btn('alt', c1)}</span>` + plain(p.e - post.length, p.e);
  }
  return html + plain(at, text.length);
}
function doubtPick(f, x, side) {  // -> true if the text changed
  const t = $('text'), from = x.pick === 'alt' ? 'alt' : 'was';
  let text = t.value, vAt = f.trAdded ? text.indexOf(f.trAdded) : -1, vLen = f.trAdded?.length || 0, done = 0;
  if (from !== side) for (const o of [x, ...(x.also || [])]) {  // every place, the voice note's stretch kept in step
    const a = o[from], b = o[side];
    for (let at = a ? text.indexOf(a) : -1; at >= 0; at = text.indexOf(a, at + b.length)) {
      text = text.slice(0, at) + b + text.slice(at + a.length); done++;
      if (vAt >= 0 && at >= vAt && at < vAt + vLen) vLen += b.length - a.length; else if (vAt >= 0 && at < vAt) vAt += b.length - a.length;
    }
  }
  if (done) { t.value = text; if (vAt >= 0) f.trAdded = text.slice(vAt, vAt + vLen); saveDraft(); grow(); }
  x.pick = side; keepRec(f); renderComposer();
  return !!done;
}
// F186 keys, in the draft or the phone's box: Tab goes from toggle to toggle (one stop each), ← or 1 picks the main
// model's word, → or 2 the other model's, and the toggle keeps the focus; Esc goes back to the box.
document.addEventListener('keydown', e => {
  const b = e.target.closest?.('[data-act="doubt-pick"]'), box = b?.closest('#draftText, #boxView');
  if (!box || e.metaKey || e.ctrlKey || e.altKey) return;
  const side = {ArrowLeft: 'was', 1: 'was', ArrowRight: 'alt', 2: 'alt'}[e.key];
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return $('text').focus(); }
  if (!side) return;
  e.preventDefault(); e.stopPropagation();
  const n = [...box.querySelectorAll('[data-tog]')].indexOf(b.closest('[data-tog]')), f = U.files[Number(b.dataset.i)], x = f?.doubts?.[Number(b.dataset.k)];
  if (!x) return;
  doubtPick(f, x, side);
  const again = $(box.id).querySelectorAll('[data-tog]')[n];  // drawn again: the same toggle, on the side now in the text
  again?.querySelector(`[aria-pressed="true"]`)?.focus({preventScroll: true});
}, true);
function draftCard() {
  const t = $('text'), text = t.value;
  if (!desk() || !D.compose || U.amend || U.correct || (!text.trim() && !U.files.length)) return '';
  const voice = U.files.filter(f => (f.mime || '').startsWith('audio/')), other = U.files.length - voice.length, ms = voice.reduce((a, f) => a + (f.ms || 0), 0);
  const spots = draftSpots(text), open = new Set(spots.filter(p => p.x.alt && !p.x.pick).map(p => p.x)).size, picked = spots.some(p => p.x.pick);
  const fixable = U.files.some(f => f.trAdded && text.includes(f.trAdded));
  const hint = open ? `<b class="font-semibold text-zinc-700 dark:text-zinc-200">${plural(open, 'word')} to check.</b> Left: the main model, in the text now. Right: the other model. A click picks it in every place; click again to switch back, any time before you send.`
    : picked ? 'Picked. Click the other side to switch back, any time before you send.' : fixable ? 'Select words of the voice note to correct them here: Taska remembers the spelling.' : '';
  return `<li class="group/row relative flex gap-3 pb-6"><span class="relative mt-1.5 grid size-6 shrink-0 place-items-center"><span class="size-3 rounded-full border-2 border-dashed border-blue-400 dark:border-blue-400/80"></span></span>
    <div class="min-w-0 flex-1">
      <div class="flex h-7 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400"><span class="font-semibold tracking-wider text-blue-700 uppercase dark:text-blue-300">Draft</span><span>· not sent</span>${voice.length ? `<span class="flex items-center gap-1">· ${ico('mic', 'size-3.5')}<span class="font-mono tabular-nums">${clock(ms)}</span> voice note${voice.length > 1 ? 's' : ''}</span>` : ''}${other ? `<span>· ${plural(other, 'file')}</span>` : ''}
        <span class="ml-auto flex items-center gap-1 text-zinc-400 dark:text-zinc-500">${KBD('⇧↵')}<span>send</span></span></div>
      <div id="draftText" class="mt-1 w-full rounded-2xl rounded-tl-md border border-dashed border-blue-300 bg-blue-50/60 px-4 py-2.5 text-[15px] leading-8 whitespace-pre-wrap break-words text-zinc-900 dark:border-blue-400/40 dark:bg-blue-400/5 dark:text-zinc-100">${text.trim() ? draftHtml(text, true) : `<span class="text-zinc-400 dark:text-zinc-500">${U.files.some(f => f.transcribing) ? 'The words of the voice note are on their way…' : 'No words yet'}</span>`}</div>
      ${hint ? `<div class="mt-2 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400"><p class="flex items-start gap-1.5">${open ? ico('alert', 'mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-400', '2') : ico('pencil', 'mt-px size-3.5 shrink-0')}<span>${hint}</span></p></div>` : ''}
    </div></li>`;
}
function renderDraft() {  // the card follows the box as you type (not while you correct a word in it)
  const el = $('draftSlot');
  if (!el || U.fixEd || !(desk() && D.compose)) return;
  const html = draftCard();
  if (el.dataset.html === html) return;
  el.dataset.html = html; el.innerHTML = html; el.className = html ? 'mt-4' : '';
  if ($('saidNone')) $('saidNone').hidden = !!html;
}
function draftFix() {  // the voice note's words you selected in the card turn into a small field, right there
  const sel = getSelection();
  if (U.fixEd || !sel?.rangeCount || sel.isCollapsed) return;
  const a = sel.anchorNode?.parentElement?.closest?.('#draftText [data-o]'), b = sel.focusNode?.parentElement?.closest?.('#draftText [data-o]');
  if (!a || a !== b || !a.hasAttribute('data-v')) return;  // within one stretch of the voice note's own words
  const text = $('text').value, o = Number(a.dataset.o);
  let s = o + Math.min(sel.anchorOffset, sel.focusOffset), e = o + Math.max(sel.anchorOffset, sel.focusOffset);
  while (s < e && /\s/.test(text[s])) s++;
  while (e > s && /\s/.test(text[e - 1])) e--;
  const wrong = text.slice(s, e);
  if (!wrong) return;
  if (wrong.length > 60) return toast('Select up to 60 characters to correct');
  U.fixEd = {s, e, wrong};
  const r = sel.getRangeAt(0), ed = document.createElement('span');
  r.deleteContents();
  ed.id = 'fixEd'; ed.contentEditable = 'plaintext-only'; ed.textContent = wrong; ed.title = 'The right words · Enter keeps them, Esc stops';
  ed.className = 'rounded-md bg-white px-1 py-0.5 text-zinc-900 outline-none ring-2 ring-amber-400 dark:bg-zinc-800 dark:text-zinc-50';
  r.insertNode(ed); ed.focus();
  const all = document.createRange(); all.selectNodeContents(ed); sel.removeAllRanges(); sel.addRange(all);
  ed.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); ev.stopPropagation(); draftFixSave(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); U.fixEd = null; renderDraft(); }
  });
  ed.addEventListener('blur', () => { if (U.fixEd) { U.fixEd = null; renderDraft(); } });
}
async function draftFixSave() {
  const ed = $('fixEd'), x = U.fixEd, right = (ed?.textContent || '').replace(/\s+/g, ' ').trim(), t = $('text'), before = t.value;
  U.fixEd = null;
  if (!x || !right || right === x.wrong || before.slice(x.s, x.e) !== x.wrong) { $('draftSlot').dataset.html = ''; return renderDraft(); }
  for (const f of U.files) {  // the voice note's words keep their stretch
    const at = f.trAdded ? before.indexOf(f.trAdded) : -1;
    if (at >= 0 && x.s >= at && x.e <= at + f.trAdded.length) f.trAdded = f.trAdded.slice(0, x.s - at) + right + f.trAdded.slice(x.e - at);
  }
  t.value = before.slice(0, x.s) + right + before.slice(x.e); saveDraft(); grow(); $('draftSlot').dataset.html = ''; renderComposer();
  let had = null;
  try { had = (await (await fetch('/api/corrections', {cache: 'no-store'})).json()).find(c => c.wrong === x.wrong) || null; } catch (_) {}
  try { await setFix({wrong: x.wrong, right}); } catch (_) { return; }  // setFix said why; the draft keeps your words
  toast(`Remembered: “${x.wrong}” → “${right}”`, async () => {
    const cur = $('text').value;
    if (cur.slice(x.s, x.s + right.length) === right) { $('text').value = cur.slice(0, x.s) + x.wrong + cur.slice(x.s + right.length); saveDraft(); grow(); renderComposer(); }
    await setFix(had ? {wrong: x.wrong, right: had.right} : {wrong: x.wrong});
  });
}
function saidLately() {
  const recent = [...S.inputs].reverse().slice(0, 5), queued = [...U.outbox].reverse(), n = queued.length + recent.length;
  return `<div class="flex h-8 items-center justify-between"><h2 class="text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">You said lately</h2>
      ${S.inputs.length ? `<button data-act="tab" data-tab="inputs" title="All inputs · G N" class="flex h-8 items-center gap-1 rounded-lg pr-1.5 pl-2 text-[13px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10">All ${S.inputs.length} input${S.inputs.length === 1 ? '' : 's'}${KBD('G N')}</button>` : ''}</div>
    <ol id="draftSlot"></ol>
    ${n ? `<ol class="mt-4">${queued.map((q, k) => outboxStep(q, k === n - 1)).join('')}${recent.map((r, k) => saidRow(r, queued.length + k, queued.length + k === n - 1)).join('')}</ol>`
      : '<p id="saidNone" class="mt-3 text-sm text-zinc-400 dark:text-zinc-500">What you say shows up here, with the items it turns into.</p>'}`;
}
// F106: a bubble whose two lines cut the words opens on a click, and closes the same way.
function markCut(root) {
  for (const el of root.querySelectorAll('[data-expand]:not([data-act])')) {
    const cut = el.querySelector('[data-cut]');
    if (U.moreInputs.has(el.dataset.id) || (cut && cut.scrollHeight > cut.clientHeight + 1)) { el.dataset.act = 'more-input'; el.classList.add('cursor-pointer'); }
  }
}
function leaveCompose() {  // back where you were: the Inputs page, or the item you had open
  $('text').blur();  // the box now points elsewhere: keys are keys again, not letters (B123)
  const p = D.prev, tab = D.prevTab, doc = D.prevDoc; D.compose = false; D.prev = null; D.prevTab = null; D.prevDoc = null;
  if (tab) { U.tab = tab; U.open = p && byN.has(p) ? p : null; U.inputsEnd = true; }
  const back = leaveView(/^new(-rule)?$/.test(history.state?.v) ? history.state.v : 'new');  // the step into the page goes; the address then follows what shows
  if (p && byN.has(p) && !tab) openItem(p); else { render(); if (!back) writeURL(false); }
  if (doc && docById(doc) && U.open === liveN(docById(doc).n)) {  // B14: back into the document you came from
    Object.assign(U, {doc, docReply: null, docSel: new Set(), docQuote: null, docCircle: false}); D.docKey = null;
    renderDetail(); renderComposer(); $('detailBody').scrollTop = U.docScroll[doc] || 0;
    if (!back) writeURL(false);
  }
}
const noSelection = () => `<div class="grid h-full place-items-center p-8 text-center"><div>
  <p class="text-[15px] text-zinc-500 dark:text-zinc-400">Select an item</p>
  <p class="mt-2 flex items-center justify-center gap-1 text-[13px] text-zinc-400">${KBD('J')}${KBD('K')}<span class="ml-1">to move</span>${S.items.some(needsYou) ? `<span>·</span>${KBD('⇧J')}<span class="ml-1">to go through what needs you</span>` : ''}</p></div></div>`;

function renderDetailBar(it) {
  const b = (act, icon, title, attrs = '') => `<button data-act="${act}" ${attrs} title="${title}" aria-label="${title.split(' · ')[0]}" class="grid size-9 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">${ico(icon, 'size-[18px]')}</button>`;
  const gap = '<span class="size-9"></span>';  // B128: Later and Archive each keep their own place
  $('dActs').innerHTML = b('copy', 'copy', 'Copy for agent · ⇧C', `data-n="${it.n}"`)
    + (it.type === 'rule' || it.archived || CLOSED(it.status) ? gap : b('swipe', 'clock', it.when === 'now' ? 'Later · L' : 'Back to now · L', `data-n="${it.n}" data-f="when" data-v="${it.when === 'now' ? 'later' : 'now'}"`))
    + (it.archived ? b('archive', 'archive', 'Unarchive · E', `data-n="${it.n}" data-on="0"`) : CLOSED(it.status) ? b('archive', 'archive', 'Archive · E', `data-n="${it.n}" data-on="1"`) : gap);
  $('dNav').innerHTML = b('prev', 'chevup', 'Previous · K') + b('next', 'down', 'Next · J') + b('full', D.full ? 'shrink' : 'open', D.full ? 'Back to the list · Esc' : 'Full width · O');
}

// Going through what needs you on the desktop: an amber strip on the detail pane; what you settle stays in the
// list, green, with Undo, until you end it.
// It keeps its place while you look elsewhere (another item, tab or page, New input) and across a reload; the strip
// then says where you left off, and ⇧J goes back there. It ends when you end it, or after the last one, with what
// you settled and what still needs you. Started under a search or filter, it says how many that hides (T113 A13, B17).
function renderGoStrip() {
  const g = U.go, el = $('goStrip');
  if (g?.list.includes(U.open)) g.at = U.open;
  if (desk()) keepGo();
  el.hidden = !(g && desk() && !D.compose);
  if (el.hidden) return;
  const i = g.list.indexOf(U.open), here = i >= 0, at = g.list.indexOf(g.at);
  const b = (act, label, key) => `<button data-act="${act}" class="flex h-8 items-center gap-1 rounded-lg px-2 font-medium text-zinc-700 hover:bg-amber-100 dark:text-zinc-200 dark:hover:bg-amber-400/15">${label}${KBD(key)}</button>`;
  const hidden = g.hidden ? `<span class="min-w-0 truncate text-xs text-zinc-500 dark:text-zinc-400">· ${g.hidden} more hidden by your ${g.by}</span>` : '';
  el.innerHTML = `<span class="shrink-0 text-xs font-bold tracking-wide text-amber-700 uppercase dark:text-amber-400">${here ? 'Needs you' : 'Going through'}</span><span class="shrink-0 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">${here ? `${i + 1} of ${g.list.length}` : `paused at ${at + 1} of ${g.list.length}`}</span>
    <span class="flex w-40 shrink-0 gap-1">${g.list.map(k => `<span class="h-1 flex-1 rounded-full ${k === g.at ? (here ? 'bg-amber-500 dark:bg-amber-400' : 'bg-amber-300 dark:bg-amber-400/50') : g.done.has(k) ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-zinc-200 dark:bg-zinc-700'}"></span>`).join('')}</span>${hidden}
    <span class="ml-auto flex shrink-0 items-center gap-0.5">${here ? b('go-prev', 'Previous', '⇧K') + b('go-next', g.done.has(U.open) ? 'Next' : 'Skip', '⇧J') : b('go-resume', 'Back to it', '⇧J')}${b('go-end', 'End', 'Esc')}</span>`;
}
const GO_KEY = () => 'taska.go.' + S.project, GO = {ready: false};  // ready: after the start looked for a walk to go on with
function keepGo() {  // the walk, for a reload (sessionStorage: this tab only)
  if (!GO.ready) return;
  try {
    const g = U.go;
    if (g) sessionStorage.setItem(GO_KEY(), JSON.stringify({list: g.list, done: [...g.done], how: g.how, at: g.at, hidden: g.hidden, by: g.by}));
    else sessionStorage.removeItem(GO_KEY());
  } catch (_) {}
}
function restoreGo() {
  GO.ready = true;
  if (!desk() || U.go) return;
  try {
    const x = JSON.parse(sessionStorage.getItem(GO_KEY()) || 'null');
    if (x?.list?.length) U.go = {list: x.list.filter(n => byN.has(n)), done: new Set(x.done || []), how: x.how || {}, undo: {}, at: x.at, hidden: x.hidden || 0, by: x.by || 'filter'};
  } catch (_) {}
}
function endGoDesk(how) {  // 'end': you ended it; 'last': after the last one
  const g = U.go;
  if (!g) return;
  const settled = g.done.size, left = g.list.filter(k => !g.done.has(k) && byN.get(k) && needsYou(byN.get(k))).length;
  const tally = `${settled} settled${left ? ` · ${left} still need${left === 1 ? 's' : ''} you` : ''}`;
  U.go = null; render();
  const next = how !== 'end' && !left && nextNeeding();  // F193: another project has something for you, the one Go on opens
  if (next) return toast(`Nothing else needs you here · ${tally} · ${titleOf(next)} has ${next.needs}`, () => goNextProject(), {label: 'Go on ⇧J'});
  toast(how === 'end' ? `Stopped going through · ${tally}` : left ? `That was the last one · ${tally}` : `Nothing else needs you · ${tally}`);
}
function settledRow(it) {
  const how = U.go.how[it.n] || 'Done';
  return `<article data-n="${it.n}" class="relative border-b border-zinc-100 dark:border-zinc-800/70"><div data-act="open" data-n="${it.n}" ${rowCur(it)} class="group relative flex cursor-pointer items-center gap-2.5 py-2.5 pr-3 pl-4 ${rowTint(it)}">
      <span class="absolute inset-y-0 left-0 w-1 bg-emerald-500 dark:bg-emerald-400"></span>
      <span class="self-start">${stateIcon('done', how)}</span>
      <div class="min-w-0 flex-1"><p class="line-clamp-1 text-[15px] leading-snug font-medium text-zinc-500 dark:text-zinc-400"><span class="mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[it.type]}">${code(it.n)}</span>${esc(it.title)}</p>
        <div class="mt-1 flex min-w-0 items-center gap-2 text-xs font-medium"><span class="shrink-0 font-semibold text-emerald-700 dark:text-emerald-400">✓ ${how}</span><span class="min-w-0 truncate font-normal text-zinc-500 dark:text-zinc-400">${esc(excerpt(it))}</span></div></div>
      ${U.go.undo[it.n] ? `<button data-act="go-undo" data-n="${it.n}" class="flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10">${ico('undo', 'size-4', '2')}Undo</button>` : ''}</div></article>`;
}
function startGoDesk(from) {
  const t = walkTab(), list = needsList(t), all = S.items.filter(it => needsYou(it) && inTab(it, t)).length, by = U.q.trim() ? (filtersSet().length ? 'search and filter' : 'search') : 'filter';
  if (!list.length && !all && goNextProject()) return;  // F193: nothing here, so on to the next project with something for you
  if (!list.length) return toast(all ? `Nothing that needs you is in this ${by} (${all} hidden)` : 'Nothing needs you right now');  // B15: say so when your search or filter hides what needs you
  U.go = {list, done: new Set(), how: {}, undo: {}, at: null, hidden: all - list.length, by};
  if (U.go.hidden) toast(`Going through the ${list.length} your ${by} shows · ${U.go.hidden} more need${U.go.hidden === 1 ? 's' : ''} you`);  // it runs over this search or filter (T113 A13)
  openItem(list.includes(from) ? from : list[0]);
}
function advanceDesk(from, how) {  // after you settle one: the next that still waits on you
  const g = U.go;
  if (!g) return;
  g.done.add(from); g.how[from] = how;
  const next = g.list.slice(g.list.indexOf(from) + 1).find(k => !g.done.has(k) && byN.get(k) && needsYou(byN.get(k)));  // no going round: it ends after the last one
  if (next) openItem(next); else endGoDesk('last');
}
// F187: drag a row on the desktop. Onto another row's top or bottom edge, in the agent's queue: before or after it, at its
// priority (the queue's order is kept as ranks, F197). Onto the middle of a row: under it, as a subitem. Onto the
// list's empty space: on its own again. Each with Undo and Z.
const DRAG = {n: 0, at: null};
function dropAt(e) {  // -> {el, n, how: 'before' | 'after' | 'into'} under the pointer, or {how: 'out'}, or null
  const it = byN.get(DRAG.n), el = e.target.closest('#list article[data-n]');
  if (!it) return null;
  if (!el) return it.parent && e.target.closest('#list') ? {how: 'out'} : null;
  const n = Number(el.dataset.n), t = byN.get(n);
  if (!t || n === DRAG.n || t.type === 'rule' || CLOSED(t.status)) return null;
  for (let p = t.parent; p; p = byN.get(p)?.parent) if (p === DRAG.n) return null;  // not under one of its own subitems
  const r = el.getBoundingClientRect(), y = (e.clientY - r.top) / r.height, line = queued(it) && queued(t);
  return {el, n, how: line && y < 0.3 ? 'before' : line && y > 0.7 ? 'after' : 'into'};
}
const queued = it => inQueue(it) && it.when === 'now';
function dropMark(at) {
  if (DRAG.at?.el && DRAG.at.el !== at?.el) delete DRAG.at.el.dataset.drop;
  if (at?.el) at.el.dataset.drop = at.how;
  $('list').toggleAttribute('data-drop-out', at?.how === 'out');
  DRAG.at = at;
}
function dragMove(n, at) {  // put n where the drop says, as one change with one Undo
  const it = byN.get(n), ref = code(n);
  if (at.how === 'into') return change(n, 'parent', at.n);
  if (at.how === 'out') return change(n, 'parent', null);
  const t = byN.get(at.n), group = S.items.filter(x => queued(x) && x.pri === t.pri && x.n !== n).sort(queueOrder);
  group.splice(group.indexOf(t) + (at.how === 'after' ? 1 : 0), 0, it);
  const patches = group.map((x, i) => ({n: x.n, f: {rank: i, ...(x.n === n && it.pri !== t.pri ? {pri: t.pri} : {})}}))
    .filter(p => byN.get(p.n).rank !== p.f.rank || p.f.pri);
  const before = patches.map(p => ({n: p.n, f: Object.fromEntries(Object.keys(p.f).map(k => [k, byN.get(p.n)[k] ?? null]))}));
  const send = list => () => op(list.map(p => ({op: 'set', ref: code(p.n), f: p.f})));
  let run;
  const undo = () => { toast(`${ref} put back`); return optimistic(before, send(before), ex => notSaved(ex, run)); };
  run = pushUndo(`${ref} moved`, undo);
  toast(`${ref} ${at.how === 'after' ? 'after' : 'before'} ${code(at.n)}${it.pri !== t.pri ? `, now ${t.pri}` : ''}`, run);
  return optimistic(patches, send(patches), ex => notSaved(ex, () => dragMove(n, at)));
}
$('list').addEventListener('pointerdown', e => {  // only a mouse drags a row (a finger scrolls and swipes)
  const a = e.target.closest('#list article[data-n]');
  if (a) a.draggable = desk() && e.pointerType === 'mouse' && !e.target.closest('button, a, input, textarea, [data-act="fold"]');
});
$('list').addEventListener('dragstart', e => {
  const a = e.target.closest?.('#list article[data-n]'), it = a && byN.get(Number(a.dataset.n));
  if (!it || it.type === 'rule' || CLOSED(it.status)) { e.preventDefault(); return; }
  DRAG.n = it.n; a.dataset.dragging = '';
  e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', code(it.n));
});
$('list').addEventListener('dragover', e => {
  if (!DRAG.n) return;
  const at = dropAt(e);
  if (at) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
  dropMark(at);
});
$('list').addEventListener('drop', e => {
  if (!DRAG.n) return;
  e.preventDefault();
  const n = DRAG.n, at = dropAt(e);
  dropMark(null);
  if (at) dragMove(n, at);
});
$('list').addEventListener('dragend', () => {
  dropMark(null);
  $('list').querySelector('[data-dragging]')?.removeAttribute('data-dragging');
  DRAG.n = 0;
});
// J / K and the arrows in the detail bar walk the rows as the list shows them.
function flashRow(n) {  // B124: something new in the list: bring it into view and light it up for a moment
  const a = desk() && document.querySelector(`#list article[data-n="${n}"]`);
  if (!a) return;
  a.scrollIntoView({block: 'nearest'});
  a.classList.add('bg-blue-50', 'dark:bg-blue-400/10', 'transition-colors', 'duration-700');
  setTimeout(() => a.classList.remove('bg-blue-50', 'dark:bg-blue-400/10'), 1500);
}
function stepItem(dir) {
  const now = [...document.querySelectorAll('#list [data-act="open"][data-n]')].map(el => Number(el.dataset.n));
  const from = U.stepFrom?.n === U.open ? U.stepFrom.rows  // you just settled it and it moved: go on from where it was (B124)
    : !now.includes(U.open) && LIST.at?.n === U.open ? LIST.at.rows : null;  // it left the list some other way: the same (T113 A14)
  U.stepFrom = null;
  if (from) { const i = from.indexOf(U.open), next = (dir > 0 ? from.slice(i + 1) : from.slice(0, i).reverse()).find(k => now.includes(k)); if (next) return openItem(next); }
  const rows = now;
  if (!rows.length) return;
  const i = rows.indexOf(U.open), n = rows[i < 0 ? (dir > 0 ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, i + dir))];
  if (n !== U.open) openItem(n); else hint(dir < 0 ? 'This is the first item' : 'This is the last item');  // a key that does nothing says why (T113 B26)
}
function fullWidth(on) {
  if (!U.open || on === D.full) return;
  const doc = desk() && U.doc && !U.docEdit ? `D${U.doc}` : null;  // a document open over its item goes full width itself (T113 B20)
  if (on) { keepPlace(); D.full = true; history.pushState({n: U.open, full: true, ...(doc ? {v: doc} : {})}, '', P + (doc || code(U.open)) + viewQuery()); render(); }
  else if (history.state?.full && !history.state.link) history.back();  // popstate leaves full width
  else { D.full = false; render(); if (history.state?.full) writeURL(false, null); }  // reached by a link (B9): Back goes to where it was
}

// Settings (B162, option B): one page for everything you change now and then, like Linear's or macOS's. While it is
// open it takes the sidebar's place, so there is only ever one column of places on the left. Its sections come in two
// groups: this project (Agents, with connecting one; the Change log; the inputs you deleted, F177) and all projects
// (Projects, Use on your phone, Voice spellings, the Organizer). The right shows one section at a time under its
// heading: what it is for, then its parts, with at most one main action. Each section has its own address, so Back,
// Forward and reload work; Agents is /agents, /settings leads to it, and the old /connect and /about lead to Agents and
// Projects. G S opens it. The phone shows the same as pages: /settings is the list of sections, each section a page.
const PSEC = {  // section: [address, icon, name, what it is for]
  agents: ['agents', 'bot', 'Agents', () => `The coding agents that work on ${esc(projTitle())}: who is here, whether they go on by themselves, and how to connect one more.`],
  log: ['log', 'history', 'Change log', 'Every change to this project, newest first. Undo puts back one of your own changes.'],
  deleted: ['deleted', 'trash', 'Deleted', 'Inputs you deleted, with the items that went with them. Restore puts them back as they were.'],
  projects: ['projects', 'folder', 'Projects', 'Every project on this Taska. Give a project any name; its address never changes, so agents and phone links keep working.'],
  phone: ['phone', 'phone', 'Use on your phone', 'Open Taska on your phone from anywhere, with a link or with the key.'],
  notifications: ['notifications', 'alert', 'Notifications', 'An alert when something needs you in any project: on a computer while Taska is open, on the phone even when it is closed.'],
  fixes: ['spellings', 'pencil', 'Voice spellings', "Every project's voice notes write these your way. To add one, select the wrong words in a voice note."],
  organizer: ['organizer', 'sparkle', 'Organizer', 'What turns what you say into items, for every project.'],
};
const PSEC_THIS = ['agents', 'log', 'deleted'];  // the rest are for all projects
const PSEC_AT = {...Object.fromEntries(Object.entries(PSEC).map(([sec, [path]]) => [path, sec])), settings: 'agents', connect: 'connect', about: 'projects'};  // address -> section; /settings: Agents (the phone: the list), /connect: Agents, at Connect
const P_CACHE = {guide: null, log: null, logRev: -1, fixes: null, prefs: null, nav: '', body: '', projects: null, trash: null};
const LOG_N = 300;  // the change log shows the latest 300 changes, here and on the phone
// The voice spellings you corrected (F144): the same list in every project, each one can be forgotten.
async function loadFixes() { try { [P_CACHE.fixes, P_CACHE.prefs] = await Promise.all(['/api/corrections', '/api/voiceprefs'].map(u => net(u))); } catch (_) { notLoaded('the voice spellings', loadFixes); } refreshFixes(); }
// F183: how voice notes are written down, for every project. Edit puts the text into the one box; Save keeps it.
const prefsBox = (cls = 'mt-3') => `<div class="${cls} rounded-xl bg-zinc-100 px-3.5 py-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">${esc(P_CACHE.prefs?.text || '')}</div>`;
const prefsEditBtn = () => U.prefsEdit ? '<p class="mt-3 text-[13px] text-blue-600 dark:text-blue-400">Editing in the box below</p>' : `<button data-act="prefs-edit" class="${SECOND} mt-3">${ico('pencil', 'size-4')}Edit</button>`;
function editPrefs() {
  if (!P_CACHE.prefs) return;
  U.prefsEdit = {was: P_CACHE.prefs.text}; U.amend = null; U.correct = null;
  render();
  const t = $('text');
  if (!t.value.trim()) { t.value = P_CACHE.prefs.text; saveDraft(); grow(); renderComposer(); }
  t.focus(); t.selectionStart = t.selectionEnd = t.value.length;
}
function cancelPrefs() { U.prefsEdit = null; render(); refreshFixes(); }
async function sendPrefs() {
  const text = $('text').value.trim(), was = U.prefsEdit?.was ?? '';
  if (!text) return toast('Write how voice notes should be written down, or Esc to stop');
  try {
    const d = await net('/api/voiceprefs', JSON_POST({text}), NET.op);
    if (!d.ok) return toast(d.error || 'Not saved', null, {error: true});
    P_CACHE.prefs = d; U.prefsEdit = null; $('text').value = ''; saveDraft(); grow(); render(); refreshFixes();
    toast("Saved: every project's voice notes follow these from now on", async () => {
      const b = await net('/api/voiceprefs', JSON_POST({text: was}), NET.op); if (b.ok) { P_CACHE.prefs = b; refreshFixes(); }
    });
  } catch (_) { toast('Connection lost. Your words are still in the box; try again.', null, {error: true}); }
}
function refreshFixes() { if (D.page) renderProject(); }
async function setFix(body) {
  const d = await net('/api/corrections', JSON_POST(body), NET.op);
  if (!d.ok) { toast(d.error || 'Not saved', null, {error: true}); throw new Error(); }
  P_CACHE.fixes = d.corrections; refreshFixes();
}
function loadLog() {  // the log as it is now: when it opens, and after each change to the project
  P_CACHE.logRev = S.rev;
  net(P + `log?n=${LOG_N}&ui=1`, {}, NET.get, 'text').then(l => { P_CACHE.log = l.trim().split('\n').filter(Boolean).reverse(); renderProject(); }, () => { if (D.page) notLoaded('the change log', loadLog); });
}
// Every project and the deleted ones, for Projects (F173). After a change the sidebar's list follows too.
async function loadProjects() {
  try {
    const [live, gone] = await Promise.all(['/api/projects', '/api/projects/deleted'].map(u => net(u, {}, NET.get)));
    P_CACHE.projects = live; P_CACHE.trash = gone; DR.list = [...live].sort((a, b) => b.t - a.t); keepProjects();
  } catch (_) { return; }
  if (D.page) renderProject();
  if (desk()) { renderSidebar(); renderRail(); }
}
// Opening a section is a step Back undoes; history.state.page counts the steps, so Back to Items undoes them all.
// sec null: the phone's Settings page, the list of sections (on the desktop that list is always beside the section).
function openProject(sec) {
  const part = sec === 'connect' ? 'pConnect' : null;  // the old Connect is a part of Agents now
  sec = sec === 'connect' ? 'agents' : sec === 'about' ? 'projects' : Object.hasOwn(PSEC, sec) ? sec : desk() ? 'agents' : null;
  const was = !!D.page, from = was ? D.section : undefined;
  if (from !== sec) keepPlace();  // B9
  if (!desk() && !was && U.open) { stashEdit(); U.open = null; U.editing = null; U.subFor = null; }  // the phone: a page of its own
  D.page = 'project'; D.sideOpen = false; D.section = sec;
  if (sec !== 'projects') { U.pMenu = null; U.pNew = false; U.renaming = null; }
  render();
  if (from !== sec) { (sec || desk() ? $('projectBody') : $('projectNav')).scrollTop = 0; writeURL(true, {v: viewPath(), page: was ? (history.state?.page || 0) + 1 : 1, tab: U.tab}); }  // tab: what Back to … goes to
  if (sec === 'agents' && !P_CACHE.guide) net(P + 'agent?ui=1', {}, NET.get, 'text').then(g => { P_CACHE.guide = g; renderProject(); }, () => {});
  if (!P_CACHE.fixes) loadFixes();  // its count shows in the list of sections
  if (sec === 'projects' || !P_CACHE.projects) loadProjects();
  if (part) requestAnimationFrame(() => $(part)?.scrollIntoView({block: 'start'}));
}
// The phone's ‹ on a page of Settings: back where you came from when that was a step here, else one level up, from a
// section to the list of sections and from there to the list of items (a reload, or a link from outside).
function pageUp() {
  if (history.state?.page) return hist(() => history.back());
  if (D.section) D.section = null; else D.page = null;
  render(); writeURL(false);
}
// Redraw only what changed: a redraw on every poll would drop the focus, a selection or a half-done second click.
// The sidebar, the rail and the drawer are drawn again only when they changed (T160): a refresh that replaces them
// while a button in them is held down (as when a click also brings the window to the front) loses the click.
const DRAWN = new WeakMap();
function draw(el, html) { if (DRAWN.get(el) === html && el.firstChild) return; DRAWN.set(el, html); el.innerHTML = html; }
function setHtml(el, key, html) {
  if (P_CACHE[key] === html) return;
  const sig = x => [x.dataset.act, x.dataset.sec, x.dataset.text, x.dataset.wrong, x.dataset.seq, x.dataset.slug].join('|');
  const had = el.contains(document.activeElement) && sig(document.activeElement);
  P_CACHE[key] = html; el.innerHTML = html;
  if (had) [...el.querySelectorAll('[data-act]')].find(x => sig(x) === had)?.focus({preventScroll: true});
}
// The parts of a section, under thin rules: a title and what it is for, then its box and button.
const pPart = (title, about, body = '', id = '') => `<section ${id ? `id="${id}" ` : ''}class="scroll-mt-16 border-t lg:scroll-mt-6 border-zinc-200 py-6 dark:border-zinc-800"><h2 class="text-[15px] font-semibold">${title}</h2>${about ? `<p class="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">${about}</p>` : ''}${body}</section>`;
const pSetting = (title, about, control) => `<section class="flex items-center gap-6 border-t border-zinc-200 py-6 dark:border-zinc-800"><div class="min-w-0 flex-1"><h2 class="text-[15px] font-semibold">${title}</h2><p class="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">${about}</p></div>${control}</section>`;
const pBox = (t, mono = true) => `<div class="mt-3 rounded-xl bg-zinc-100 px-3.5 py-3 leading-relaxed text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 ${mono ? 'font-mono text-[13px] break-words' : 'text-sm break-words'}">${esc(mono ? t : t.replace(/`/g, ''))}</div>`;  // T228 #6, #7: no word cut in two, no backticks shown
const pCopy = (t, label, main = false) => `<button data-act="copy-text" data-text="${esc(t)}" class="${main ? PRIMARY : SECOND} mt-3">${ico('copy', main ? 'size-4.5' : 'size-4')}${label}</button>`;
const pRuled = html => `<div class="border-t border-zinc-200 dark:border-zinc-800">${html}</div>`;
const P_LOADING = pRuled('<p class="py-6 text-sm text-zinc-400">Loading…</p>');
const P_BTN = 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100';
const dayShort = t => t ? new Date(t).toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) : '';
const PBODY = {
  notifications: () => !desk() ? phonePushBody()
    : pSetting(noticeState(), 'For this browser.', noticeOn() ? '' : `<button data-act="notifications-on" ${noticeState() === 'Blocked by the browser' ? 'disabled ' : ''}class="${PRIMARY}">Turn on</button>`)
      + (noticeOn() ? pSetting('Quiet 22:00–08:00', 'Your local time.', `<button data-act="notifications-quiet" aria-pressed="${noticeRead('quiet', true)}" aria-label="Quiet 22:00–08:00" class="group relative h-6.5 w-11 shrink-0 rounded-full after:absolute after:inset-x-0 after:-inset-y-[9px] bg-zinc-300 transition-colors hover:brightness-95 aria-pressed:bg-emerald-500 dark:bg-zinc-600 dark:hover:brightness-125"><span class="absolute top-0.75 left-0.75 size-5 rounded-full bg-white shadow transition-transform group-aria-pressed:translate-x-4.5"></span></button>`) : ''),
  agents: () => {
    const cmd = `curl -s ${BASE}/connect | sh`, far = S.remote && S.remote !== BASE ? `curl -s ${S.remote}/connect | sh` : '', ask = agentAsk(), seen = agentsSeen();
    return pRuled(`<div class="py-6">${agentCard()}</div>`)
      + pPart('Connect a machine', `Once on each machine where a coding agent works, in the project's folder. It saves this project's address in <code class="font-mono text-[13px]">.taska</code> and installs the Taska skill for Claude Code, Codex and Antigravity.`, pBox(cmd) + pCopy(cmd, 'Copy command', true), 'pConnect')
      + (far ? pPart('From another network', 'On a machine outside this network, run this one instead. It carries the key.', pBox(far) + pCopy(far, 'Copy')) : '')
      + pPart('Or send it to the agent', "Open your coding agent in the project's folder and send it this. It reads the rest from Taska.", pBox(ask, false) + pCopy(ask, 'Copy'))
      + (seen ? pPart('Seen in this project', '', `<ul class="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">${seen}</ul>`) : '')
      + `<details class="group border-t border-zinc-200 py-6 dark:border-zinc-800"><summary class="-my-2.5 flex min-h-11 cursor-pointer items-center gap-1.5 text-[15px] font-semibold lg:my-0 lg:min-h-0 hover:text-zinc-600 dark:hover:text-zinc-300">${ico('right', 'size-4 text-zinc-400 transition-transform group-open:rotate-90')}What the agent reads</summary>
        <pre class="mt-3 overflow-x-auto rounded-xl bg-zinc-50 p-3.5 text-xs leading-relaxed whitespace-pre-wrap wrap-anywhere lg:scrollbar-thin dark:bg-zinc-900">${esc(P_CACHE.guide || 'Loading…')}</pre></details>`;
  },
  log: () => !P_CACHE.log ? P_LOADING : !P_CACHE.log.length ? pRuled(EMPTY('Nothing has changed yet.'))
    : pRuled(`<div class="pt-2">${logHtml(P_CACHE.log)}</div>`) + (P_CACHE.log.length >= LOG_N ? `<p class="pt-4 text-[13px] text-zinc-400 dark:text-zinc-500">The latest ${LOG_N} changes</p>` : ''),
  projects: () => {
    if (!P_CACHE.projects) return P_LOADING;
    const live = [...P_CACHE.projects].sort(projOrder), gone = P_CACHE.trash || [];
    const add = U.pNew ? `<div class="flex min-w-0 flex-1 flex-col gap-1.5"><div class="flex items-center gap-1.5"><input id="pNewName" class="${FIELD} h-10 py-1.5 text-sm" placeholder="Project name" aria-label="New project name" autocomplete="off" spellcheck="false" value="${esc(U.pNewText || '')}"><button data-act="p-create" class="h-10 shrink-0 rounded-xl bg-zinc-900 px-3.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">Create</button><button data-act="p-new-cancel" aria-label="Cancel" class="grid size-10 shrink-0 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">${ico('x', 'size-4')}</button></div>
        ${U.pErr ? `<p class="px-1 text-xs text-red-600 dark:text-red-400">${esc(U.pErr)}</p>` : `<p class="px-1 text-xs text-zinc-500 dark:text-zinc-400">${KBD('↵')} create and open it · ${KBD('Esc')} cancel</p>`}</div>`
      : `<button data-act="p-new" class="${SECOND} shrink-0">${ico('plus', 'size-4', '2')}New project</button><p class="min-w-0 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">Any name: spaces, \u4e2d\u6587, emoji. Its address is made from the name once, e.g. <code class="font-mono">/p/home-budget</code>.</p>`;
    const row = p => { const cur = p.name === S.project, ren = U.renaming === p.name;
      return `<li class="flex min-h-16 items-center gap-3 py-3">${projTile(p.name, 'size-8 rounded-lg text-sm')}<div class="min-w-0 flex-1">${ren
        ? `<input id="pRename" data-slug="${esc(p.name)}" class="${FIELD} h-10 max-w-[22rem] py-1.5 text-[15px] font-medium" value="${esc(titleOf(p))}" aria-label="New name for ${esc(titleOf(p))}" autocomplete="off" spellcheck="false">
          <p class="mt-1.5 flex items-center gap-1 px-0.5 text-xs text-zinc-500 dark:text-zinc-400">${KBD('↵')}<span>save ·</span>${KBD('Esc')}<span>cancel · the address stays <code class="font-mono">/p/${esc(p.name)}</code></span></p>`
        : `<a href="/p/${encodeURIComponent(p.name)}/" class="block rounded-lg hover:opacity-80"><p class="flex min-w-0 items-center gap-2"><span class="truncate text-[15px] font-semibold">${esc(titleOf(p))}</span>${cur ? '<span class="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">This project</span>' : ''}</p>
          <p class="mt-0.5 truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">/p/${esc(p.name)} · ${p.open} open${cur && S.file ? ` · ${esc(S.file)}` : ''}</p></a>`}</div>
        ${ren ? '' : `<button data-act="p-rename" data-slug="${esc(p.name)}" class="${P_BTN}">${ico('pencil', 'size-4')}Rename</button><button data-act="p-delete" data-slug="${esc(p.name)}" class="${P_BTN}">${ico('trash', 'size-4')}Delete</button>`}</li>`; };
    return `<section class="flex items-center gap-4 border-t border-zinc-200 py-5 dark:border-zinc-800">${add}</section>
      <ul class="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">${live.map(row).join('')}</ul>
      ${gone.length ? `<section class="pt-8"><h2 class="text-[15px] font-semibold">Deleted projects</h2><p class="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">A deleted project leaves the sidebar and stops giving work to agents. Nothing in it is lost: Restore brings it back as it was.</p>
        <ul class="mt-3 flex flex-col gap-2">${gone.map(d => `<li class="flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-900"><span aria-hidden="true" class="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-400 text-sm leading-none font-bold text-white uppercase dark:bg-zinc-600">${esc([...String(d.title || '?')][0])}</span>
          <div class="min-w-0 flex-1"><p class="text-[15px] font-medium break-words text-zinc-600 dark:text-zinc-300">${esc(d.title)}</p><p class="text-xs break-words text-zinc-500 dark:text-zinc-400">Deleted ${dayShort(d.t)} · ${plural(d.items, 'item')} · <span class="font-mono">/p/${esc(d.name)}</span></p></div>
          <button data-act="p-restore" data-slug="${esc(d.name)}" class="${P_BTN}">${ico('undo', 'size-4', '2')}Restore</button><button data-act="p-purge" data-slug="${esc(d.name)}" class="${P_BTN} hover:text-red-600 dark:hover:text-red-400">Delete forever</button></li>`).join('')}</ul>
        <p class="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Delete forever asks for a second click. It is the only step that cannot be undone.</p></section>` : ''}`;
  },
  phone: () => {
    const link = S.remote ? S.remote + '/' : '';
    return (link ? pPart('Link', 'Send this link to your phone and open it once. From then on Taska opens there just like here, from anywhere.', pBox(link) + pCopy(link, 'Copy link', true))
      : pPart('Link', 'Taska has no public address yet (start it with <code class="font-mono whitespace-nowrap">--public</code>). On the same network your phone needs no key.'))
      + pPart('On the Home Screen', 'Open the link, then on iPhone tap Share and Add to Home Screen; on Android, the menu and Install app. Taska then opens full screen, like an app, and can record voice notes.')
      + pPart('Key', `${link ? 'Or type' : 'Type'} the key once on the device. Taska on the Home Screen needs it.`,
        `<div class="mt-3 flex items-center gap-4"><span class="font-mono text-2xl tracking-wider select-all">${esc(S.key)}</span><button data-act="copy-text" data-text="${esc(S.key)}" class="${SECOND}">${ico('copy', 'size-4')}Copy key</button></div>`)
      + pSetting('New key', 'This computer and your local network never need the key. A new key signs out every other device.',
        '<button data-act="new-key" class="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-[15px] font-semibold text-red-600 hover:bg-red-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-red-400 dark:hover:bg-red-400/10">New key</button>');
  },
  fixes: () => !P_CACHE.fixes ? P_LOADING : (P_CACHE.prefs ? pPart(`Transcription preferences${P_CACHE.prefs.default ? '<span class="ml-2 text-[13px] font-normal text-zinc-400">default</span>' : ''}`, "How every project's voice notes are written down, in your own words. Transcription follows them after its own rules.", (U.prefsEdit ? '<p class="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Editing in the box below.</p>' : prefsBox() + prefsEditBtn())) + pSetting('Tidy voice notes', P_CACHE.prefs.tidy ? 'On: fillers and repeats out, sentences joined, every detail kept. The words as said stay one tap away (As said, on the voice note).' : 'Off: voice notes are written down word for word.',
      `<button data-act="tidy-toggle" role="switch" aria-checked="${!!P_CACHE.prefs.tidy}" class="${SECOND}">${P_CACHE.prefs.tidy ? 'Turn off' : 'Turn on'}</button>`) + pPart('Spellings', P_CACHE.fixes.length ? 'Words voice notes hear your way: ones you corrected, and ones you added here.' : 'None yet. Add a word below, or select wrong words in a voice note and write the right ones.',
      `<div class="mt-3 flex items-center gap-1.5"><input id="fixWord" class="${FIELD} h-10 py-1.5 text-sm" placeholder="A name or term to hear right, e.g. Needs you" aria-label="A word to hear right" autocomplete="off" spellcheck="false"><button data-act="fix-add" class="h-10 shrink-0 rounded-xl bg-zinc-900 px-3.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">Add</button></div>`) : '') + (!P_CACHE.fixes.length ? (P_CACHE.prefs ? '' : pRuled(EMPTY('None yet. When a voice note gets words wrong, select them in the input and write the right ones: from then on every project writes them your way.')))
    : `<ul class="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">${P_CACHE.fixes.map(c => `<li class="flex min-h-13 items-center gap-3 py-1.5 text-[15px]"><span class="min-w-0 flex-1 break-words">${c.wrong ? `<span class="text-zinc-400 line-through decoration-zinc-400 dark:text-zinc-500">${esc(c.wrong)}</span><span class="px-2 text-zinc-400 dark:text-zinc-500">→</span>` : ''}<span class="font-medium">${esc(c.right)}</span></span>
      <button data-act="fix-remove" data-wrong="${esc(c.wrong || '')}" data-right="${esc(c.right)}" aria-label="Forget this spelling" title="Forget this spelling" class="grid size-11 shrink-0 lg:size-9 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">${ico('x', 'size-4')}</button></li>`).join('')}</ul>`),
  deleted: () => (S.deleted || []).length ? `<ul class="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">${deletedRows()}</ul>`
    : pRuled(EMPTY('Nothing deleted. An input you delete comes here, with the items that went with it.')),
  organizer: () => S.org?.on
    ? pPart('On', `Gemini (${esc(S.org.model)}) reads each input you send and turns it into items, or updates the ones that exist, in every project. What it does with an input shows under it in Inputs, with Undo.`)
    : pPart('Off', 'Your coding agent files what you send: it reads new inputs first when it asks for work. To have them filed as soon as you send them, set GEMINI_API_KEY where Taska runs and restart it.'),
};
const PSEC_RIGHT = {  // what a section's row in the list says on its right
  notifications: () => desk() ? noticeState() : PUSH.sub ? 'On' : 'Off',
  agents: () => esc(agentState(S.agents, S.work)[1]), projects: () => P_CACHE.projects ? P_CACHE.projects.length : '',
  fixes: () => P_CACHE.fixes?.length || '', organizer: () => S.org?.on ? 'On' : 'Off', deleted: () => (S.deleted || []).length || '',
};
function renderProject() {
  if (!D.page) return;
  const sec = D.section;
  if (sec === 'log' && S.project && P_CACHE.logRev !== S.rev) loadLog();  // the project changed, so did its log
  const typing = {pRename: U.renaming, pNewName: U.pNew}[document.activeElement?.id];
  if (!desk()) {  // the phone: the list of sections, or one section, each a page of its own
    if (!sec) return setHtml($('projectNav'), 'nav', phoneIndex());
    if (typing && $('projectBody').contains(document.activeElement)) return;
    setHtml($('projectBody'), 'body', phoneSection(sec));
    if (U.renaming && P_CACHE.projects && !$('pRename') && sec === 'projects') U.renaming = null;
    return;
  }
  const [, , name, about] = PSEC[sec];
  const row = k => { const [path, icon, label] = PSEC[k], on = k === sec;
    return `<a href="${P}${path}" data-act="psec" data-sec="${k}" ${on ? 'aria-current="page" ' : ''}class="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 data-pressed:bg-zinc-200/80 aria-[current=page]:bg-zinc-200/70 aria-[current=page]:font-semibold aria-[current=page]:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100 dark:aria-[current=page]:bg-zinc-800 dark:aria-[current=page]:text-zinc-50">${ico(icon, 'size-4 opacity-70')}<span class="min-w-0 flex-1 truncate">${label}</span><span class="max-w-28 truncate text-xs font-normal text-zinc-400 tabular-nums dark:text-zinc-500">${S.project ? PSEC_RIGHT[k]?.() ?? '' : ''}</span></a>`; };
  const group = t => `<div class="px-3.5 pt-5 pb-1.5 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">${t}</div>`;
  setHtml($('projectNav'), 'nav', `<div class="flex h-14 shrink-0 items-center px-2"><button data-act="project-back" class="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800">${ico('left', 'size-4')}Back to ${D.compose ? 'New input' : TAB_NAME[U.tab]}${KBD('Esc')}</button></div>
    <h1 class="px-4 pt-1 text-[19px] font-semibold tracking-tight">Settings</h1>
    ${group('This project')}<div class="flex items-center gap-2 px-3.5 pb-1.5">${projTile(S.project || HERE, 'size-5 rounded-md text-[11px]')}<span class="min-w-0 truncate text-sm font-semibold">${esc(projTitle())}</span></div>
    <div class="flex flex-col gap-0.5 px-2">${PSEC_THIS.map(row).join('')}</div>
    ${group('All projects')}<div class="flex flex-col gap-0.5 px-2">${Object.keys(PSEC).filter(k => !PSEC_THIS.includes(k)).map(row).join('')}</div>
    <button data-act="keys" class="mt-auto flex h-12 shrink-0 items-center gap-2 border-t border-zinc-200 px-4 text-[13px] text-zinc-500 hover:text-zinc-800 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200">${ico('keyboard', 'size-4')}<span class="flex-1 text-left">Keyboard shortcuts</span>${KBD('?')}</button>`);
  if (typing && $('projectBody').contains(document.activeElement)) return;  // typing a name: a refresh waits; saved or stopped, the field goes
  setHtml($('projectBody'), 'body', `<div class="mx-auto w-full max-w-[46rem] px-8 pt-9 pb-16"><header class="pb-6"><h1 class="text-[22px] leading-tight font-semibold tracking-tight">${name}</h1>
    <p class="mt-2 text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">${typeof about === 'function' ? about() : about}</p></header>${S.project ? PBODY[sec]() : P_LOADING}</div>`);  // before the data: the frame (B190)
  if (U.renaming && P_CACHE.projects && !$('pRename') && sec === 'projects') U.renaming = null;  // that project is gone
}
// Settings on the phone (B162): pages in the grouped style of a phone's own settings. /settings lists the sections in
// two groups, as the desktop's column does; each section is a page with ‹ and its name, what it is for, then the same
// parts as on the desktop in a card. Projects has its own phone layout: a ⋯ on each row holds Rename and Delete, and
// a deleted project's ⋯ holds Delete forever. A phone has no Esc, so a name field comes with Save and Cancel buttons.
const PH_GROUP = 'mx-3 divide-y divide-zinc-100 overflow-hidden rounded-2xl bg-white dark:divide-zinc-800 dark:bg-zinc-900';
const phHead = title => `<header class="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-1 bg-zinc-100/90 px-1 backdrop-blur dark:bg-zinc-950/90"><button data-act="project-back" aria-label="Back" class="grid size-11 shrink-0 place-items-center rounded-full text-zinc-600 dark:text-zinc-400">${ico('left', 'size-6')}</button><h1 class="min-w-0 truncate text-[17px] font-semibold">${title}</h1></header>`;
const phLabel = t => `<div class="flex min-w-0 items-center gap-1.5 px-5 pt-6 pb-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">${t}</div>`;
const phNote = t => `<p class="px-5 pt-2 text-xs leading-snug text-zinc-500 dark:text-zinc-400">${t}</p>`;
function phoneIndex() {
  const row = k => { const [path, icon, label] = PSEC[k], [tone, agent] = agentState(S.agents, S.work);
    const right = !S.project ? '' : k === 'agents' ? `<span class="size-2 shrink-0 rounded-full ${AGENT_TONE[tone][0]}"></span><span class="truncate">${esc(agent)}</span>` : `<span class="truncate">${PSEC_RIGHT[k]?.() ?? ''}</span>`;
    return `<a href="${P}${path}" data-act="psec" data-sec="${k}" class="flex min-h-12 items-center gap-3 px-3.5 py-2.5 text-[15px]">${ico(icon, 'size-5 shrink-0 text-zinc-500 dark:text-zinc-400')}<span class="shrink-0">${label}</span><span class="ml-auto flex min-w-0 items-center gap-1.5 text-[13px] text-zinc-500 tabular-nums dark:text-zinc-400">${right}</span>${ico('right', 'size-4 shrink-0 text-zinc-300 dark:text-zinc-600')}</a>`; };
  return phHead('Settings')
    + phLabel(`<span class="shrink-0">This project ·</span>${projTile(S.project || HERE, 'size-4 rounded text-[9px]')}<span class="truncate font-semibold text-zinc-700 dark:text-zinc-200">${esc(projTitle())}</span>`)
    + `<div class="${PH_GROUP}">${PSEC_THIS.map(row).join('')}</div>` + phNote('Connecting an agent is in Agents. The agent pill on the list opens it too.')
    + phLabel('All projects') + `<div class="${PH_GROUP}">${Object.keys(PSEC).filter(k => !PSEC_THIS.includes(k)).map(row).join('')}</div>` + phNote('Projects: new, rename, delete and restore.');
}
function phoneSection(sec) {
  const [, , name, about] = PSEC[sec];
  return phHead(name) + `<p class="px-5 pt-1 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">${typeof about === 'function' ? about() : about}</p>`
    + (sec === 'projects' ? phoneProjects() : `<div class="mx-3 mt-4 rounded-2xl bg-white px-4 dark:bg-zinc-900 [&>:first-child]:border-t-0 [&>:last-child]:border-b-0">${S.project ? PBODY[sec]() : P_LOADING}</div>`)
    + '<div class="h-10"></div>';
}
function phoneProjects() {
  if (!P_CACHE.projects) return '<p class="px-5 py-6 text-sm text-zinc-400">Loading…</p>';
  const live = [...P_CACHE.projects].sort(projOrder), gone = P_CACHE.trash || [];
  const pill = 'flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-zinc-100 px-3.5 text-sm font-medium dark:bg-zinc-800';
  const more = (key, title) => `<button data-act="p-more" data-key="${esc(key)}" aria-label="More for ${esc(title)}" aria-expanded="${U.pMenu === key}" class="grid size-11 shrink-0 place-items-center rounded-full text-zinc-400 aria-expanded:bg-zinc-100 aria-expanded:text-zinc-700 dark:text-zinc-500 dark:aria-expanded:bg-zinc-800 dark:aria-expanded:text-zinc-200">${ico('more', 'size-5')}</button>`;
  const twoButtons = (save, saveLabel, cancel, slug = '') => `<div class="mt-2 flex gap-2"><button data-act="${save}" ${slug ? `data-slug="${esc(slug)}" ` : ''}class="h-11 shrink-0 rounded-xl bg-zinc-900 px-4 text-[15px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">${saveLabel}</button><button data-act="${cancel}" class="h-11 shrink-0 rounded-xl px-4 text-[15px] font-medium text-zinc-600 dark:text-zinc-300">Cancel</button></div>`;
  const add = U.pNew
    ? `<div class="px-3.5 py-3"><input id="pNewName" class="${FIELD} h-11 py-2" placeholder="Project name" aria-label="New project name" autocomplete="off" spellcheck="false" value="${esc(U.pNewText || '')}">${twoButtons('p-create', 'Create', 'p-new-cancel')}
        <p class="mt-2 text-xs leading-snug ${U.pErr ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'}">${U.pErr ? esc(U.pErr) : 'Any name: spaces, \u4e2d\u6587, emoji. Its address is made from the name once.'}</p></div>`
    : `<button data-act="p-new" class="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left text-[15px] font-medium text-blue-600 dark:text-blue-400">${ico('plus', 'size-5')}New project</button>`;
  const row = p => { const cur = p.name === S.project, t = titleOf(p);
    if (U.renaming === p.name) return `<div class="flex items-start gap-3 px-3.5 py-3">${projTile(p.name, 'mt-1.5 size-8 rounded-lg text-sm')}<div class="min-w-0 flex-1"><input id="pRename" data-slug="${esc(p.name)}" class="${FIELD} h-11 py-2 font-medium" value="${esc(t)}" aria-label="New name for ${esc(t)}" autocomplete="off" spellcheck="false">
        ${twoButtons('p-rename-save', 'Save', 'p-rename-cancel', p.name)}<p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">The address stays <span class="font-mono">/p/${esc(p.name)}</span></p></div></div>`;
    return `<div><div class="flex min-h-14 items-center gap-3 py-2 pr-1.5 pl-3.5"><a href="/p/${encodeURIComponent(p.name)}/" class="flex min-w-0 flex-1 items-center gap-3">${projTile(p.name, 'size-8 rounded-lg text-sm')}<span class="min-w-0 flex-1"><span class="flex min-w-0 items-center gap-2 text-[15px] font-semibold"><span class="truncate">${esc(t)}</span>${cur ? '<span class="shrink-0 rounded-md bg-zinc-100 px-1.5 py-px text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">This project</span>' : ''}</span>
        <span class="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400"><span class="font-mono">/p/${esc(p.name)}</span> · ${p.open} open</span></span></a>${more(p.name, t)}</div>
      ${U.pMenu === p.name ? `<div class="flex gap-2 pr-3.5 pb-3 pl-[3.75rem]"><button data-act="p-rename" data-slug="${esc(p.name)}" class="${pill}">${ico('pencil', 'size-4')}Rename</button><button data-act="p-delete" data-slug="${esc(p.name)}" class="${pill} text-red-600 dark:text-red-400">${ico('trash', 'size-4')}Delete</button></div>` : ''}</div>`; };
  const was = d => `<div><div class="flex min-h-14 items-center gap-3 py-2 pr-1.5 pl-3.5"><span aria-hidden="true" class="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-400 text-sm leading-none font-bold text-white uppercase dark:bg-zinc-600">${esc([...String(d.title || '?')][0])}</span>
      <span class="min-w-0 flex-1"><span class="block text-[15px] font-medium break-words text-zinc-500 dark:text-zinc-400">${esc(d.title)}</span><span class="mt-0.5 block truncate text-xs text-zinc-400 dark:text-zinc-500">Deleted ${dayShort(d.t)} · ${plural(d.items, 'item')}</span></span>
      <button data-act="p-restore" data-slug="${esc(d.name)}" class="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-blue-50 px-3 text-sm font-semibold text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">${ico('undo', 'size-4', '2')}Restore</button>${more('gone:' + d.name, d.title)}</div>
    ${U.pMenu === 'gone:' + d.name ? `<div class="flex pr-3.5 pb-3 pl-[3.75rem]"><button data-act="p-purge" data-slug="${esc(d.name)}" class="${pill} text-red-600 dark:text-red-400">${ico('trash', 'size-4')}Delete forever</button></div>` : ''}</div>`;
  return `<div class="${PH_GROUP} mt-4">${add}</div>` + phLabel('Projects') + `<div class="${PH_GROUP}">${live.map(row).join('')}</div>`
    + (gone.length ? phLabel('Deleted') + `<div class="${PH_GROUP}">${gone.map(was).join('')}</div>` + phNote('Nothing in a deleted project is lost. Delete forever is in its ⋯ and needs a second tap.') : '');
}
// Projects (F173): new, rename, delete, restore and delete forever, in place. Rename and New project use a field in
// the row (R139: no browser dialogs); every change says so with Undo where there is one.
async function projectCall(what, body) {
  const d = await (await fetch(`/api/projects${what ? '/' + what : ''}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})).json();
  if (!d.ok) throw new Error(d.error || 'Not saved');
  return d;
}
async function renameProject(slug, title) {
  const d = await projectCall('rename', {name: slug, title});
  if (slug === S.project) { S.title = d.title; render(); }
  await loadProjects();
  return d;
}
// The projects you opened, the latest first, kept in this browser (T228 #2)
function recentProjects(add) {
  let list = [];
  try { list = JSON.parse(localStorage.getItem('taska.recent') || '[]'); } catch (_) {}
  if (add) { list = [add, ...list.filter(n => n !== add)].slice(0, 20); try { localStorage.setItem('taska.recent', JSON.stringify(list)); } catch (_) {} }
  return list;
}
if (HERE) recentProjects(HERE);
async function deleteProject(slug) {
  if (slug === S.project) U.leaving = true;
  let d;
  try { d = await projectCall('delete', {name: slug}); } catch (ex) { U.leaving = false; throw ex; }
  if (slug === S.project) {  // this project is gone: on to another one, whose Projects offers it back
    const all = P_CACHE.projects || DR.list || [], seen = recentProjects().filter(n => n !== slug && all.some(p => p.name === n));
    const next = all.find(p => p.name === seen[0]) || [...all].filter(p => p.name !== slug).sort((a, b) => b.t - a.t)[0];  // T228 #2: the one you had open before
    try { sessionStorage.setItem('taska.deleted', JSON.stringify({name: slug, title: d.title})); } catch (_) {}
    return location.assign(next ? `/p/${encodeURIComponent(next.name)}/projects` : '/');
  }
  await loadProjects();
  toast(`Deleted ${d.title}`, () => projectCall('restore', {name: slug}).then(loadProjects).then(() => toast(`${d.title} is back`), ex => toast(ex.message)));
}
// The ⋯ menu on the desktop: a popover with the actions as rows, each with its key, then type, priority, status.
function itemMenuDesk(n, arm = U.menuArm) {  // arm: 's', 'p' or 't', the part the next digit or letter sets (T113 A16)
  const it = byN.get(n);
  if (!it) return;
  const pick = x => x?.dataset?.act ? `[data-act="${x.dataset.act}"]${x.dataset.f ? `[data-f="${x.dataset.f}"]` : ''}${x.dataset.v ? `[data-v="${CSS.escape(x.dataset.v)}"]` : ''}` : '';
  const again = U.sheet === 'menu' && !$('overlay').hidden && $('dlgBody').contains(document.activeElement) ? pick(document.activeElement) : '';  // redrawn after a change: the key stays where it was
  const xy = U.sheet === 'menu' && !$('overlay').hidden && U.menuFor === n ? U.popXY : null;  // and a menu opened at a spot stays at it
  U.sheet = 'menu'; U.menuFor = n; U.menuArm = arm;
  const row = (act, icon, label, key, attrs = '', sub = '') => `<button data-act="${act}" data-n="${n}" ${attrs} class="flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">${ico(icon, 'size-[18px] text-zinc-500 dark:text-zinc-400')}<span class="min-w-0 flex-1 truncate">${label}${sub ? `<span class="ml-2 text-xs text-zinc-400">${sub}</span>` : ''}</span>${key ? `<kbd class="grid h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold text-zinc-400 ring-1 ring-zinc-300 dark:ring-zinc-600">${key}</kbd>` : ''}</button>`;
  const lab = (t, keys, on) => `<div class="flex items-center justify-between px-1 pb-1.5 text-xs font-semibold ${on ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400'}">${t}<span class="font-normal ${on ? '' : 'text-zinc-400'}">${keys}</span></div>`;
  const stat = ([v, t], i) => { const on = it.status === v;
    return `<button data-act="set-field" data-n="${n}" data-f="status" data-v="${v}" aria-pressed="${on}" class="${STAT_BTN} h-8 rounded-lg px-2">${statIcon(v, t, 'size-4')}<span class="truncate">${t}</span>${arm === 's' ? `<span class="ml-auto pl-1 font-mono text-[11px] text-zinc-400 group-aria-pressed:text-white/70 dark:group-aria-pressed:text-zinc-900/60">${i + 1}</span>` : ''}</button>`; };  // after S: the digit that sets it
  const statuses = it.type === 'rule' ? Object.entries(RULE_STATUS).filter(([v]) => v !== 'proposed' || it.status === 'proposed') : Object.entries(STATUS);
  const next = inQueue(it) && it.when === 'now' ? row('do-next', 'up', it.rank == null ? 'Do this next' : 'Back in order', '', '', it.rank == null ? `first of the ${it.pri}s in the queue` : 'where it was, by age') : '';  // F197
  const state = it.archived ? row('archive', 'archive', 'Unarchive', 'E', 'data-on="0"') : CLOSED(it.status) ? row('archive', 'archive', 'Archive', 'E', 'data-on="1"')
    : it.type === 'rule' ? '' : row('swipe', 'clock', it.when === 'now' ? 'Later' : 'Back to now', 'L', `data-f="when" data-v="${it.when === 'now' ? 'later' : 'now'}"`);
  dialog('', `<div class="flex flex-col gap-3">
    <div class="-mx-1">${row('edit', 'pencil', 'Edit', 'I')}${row('copy', 'copy', 'Copy for agent', '⇧C')}${it.type === 'rule' ? '' : row('doc-new', 'docplus', 'New doc', '⇧D') + row('sub-new', 'listplus', 'Add subitem', '⇧A') + row('reparent', 'indent', 'Move under…', 'M', '', it.parent ? 'now under ' + code(it.parent) : 'stands on its own')}${state}${next}</div>
    <div class="border-t border-zinc-100 pt-3 dark:border-zinc-800">${lab('Type', 'T then F B I T R', arm === 't')}${segctl('set-field', 'type', [...TYPES, 'rule'].map(t => [t, letterOf(t) + `<span class="truncate">${t[0].toUpperCase() + t.slice(1)}</span>`]), it.type, true).replaceAll('data-k="type"', `data-f="type" data-n="${n}"`)}</div>
    ${it.type === 'rule' ? '' : `<div>${lab('Priority', 'P then 0–3', arm === 'p')}${segctl('set-field', 'pri', ['P0', 'P1', 'P2', 'P3'].map(p => [p, p === 'P0' ? '<span class="font-semibold text-red-600 dark:text-red-400">P0</span>' : p]), it.pri, true).replaceAll('data-k="pri"', `data-f="pri" data-n="${n}"`)}</div>`}
    <div>${lab('Status', `S then 1–${statuses.length}`, arm === 's')}<div class="grid grid-cols-3 gap-1">${statuses.map(stat).join('')}</div></div>
  </div>`, {pop: true, focus: false, head: `<span class="block truncate text-sm font-semibold"><span class="mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[it.type]}">${code(n)}</span>${esc(it.title)}</span>`});
  if (xy) popAt(...xy); else U.popXY = null;
  const box = $('dlgBody'), f = {t: 'type', p: 'pri', s: 'status'}[arm];  // the keys stay in the menu (B8)
  ((again && box.querySelector(again)) || (f && (box.querySelector(`[data-f="${f}"][aria-pressed="true"]`) || box.querySelector(`[data-f="${f}"]`))) || box.querySelector('button'))?.focus({preventScroll: true});
}
// The ⋯ menu's own keys (T113 A16, B8): ↑ ↓ ← → and Tab move in it and never leave it; after S, P or T a digit or a
// letter sets that part, as the menu shows (S then 1–6, P then 0–3, T then F B I T R); S, P or T again switch part.
// -> true when the menu took the key; other letters close it and do what they do (B131).
const TYPE_OF_LETTER = Object.fromEntries(Object.entries(LETTER).map(([t, l]) => [l.toLowerCase(), t]));
function menuKey(e) {
  const k = e.key, box = $('dlgBody');
  if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(k)) {
    const btns = [...box.querySelectorAll('button:not(:disabled)')], i = btns.indexOf(document.activeElement);
    const d = k === 'ArrowDown' || k === 'ArrowRight' || (k === 'Tab' && !e.shiftKey) ? 1 : -1;
    e.preventDefault();
    btns[i < 0 ? (d > 0 ? 0 : btns.length - 1) : (i + d + btns.length) % btns.length]?.focus();
    return true;
  }
  if (k.length !== 1 || (e.shiftKey && k !== k.toLowerCase())) return false;  // ⇧C, ⇧D, ⇧A: the menu's own shortcuts (B131)
  const low = k.toLowerCase(), f = {p: 'pri', t: 'type', s: 'status'}[U.menuArm];
  const v = U.menuArm === 'p' && /^[0-3]$/.test(k) ? 'P' + k : U.menuArm === 't' ? TYPE_OF_LETTER[low]
    : U.menuArm === 's' && /^[1-9]$/.test(k) ? box.querySelectorAll('[data-f="status"]')[Number(k) - 1]?.dataset.v : null;
  const b = f && v && box.querySelector(`[data-f="${f}"][data-v="${v}"]`);
  if (b) { e.preventDefault(); b.focus({preventScroll: true}); b.click(); return true; }  // the key stays on what it set
  if (['s', 'p', 't'].includes(low)) { e.preventDefault(); itemMenuDesk(U.menuFor, low); return true; }
  if (/^[0-9]$/.test(k)) { e.preventDefault(); hint(f ? `${{pri: 'Priority', type: 'Type', status: 'Status'}[f]}: ${{pri: '0–3', type: 'F B I T R', status: `1–${box.querySelectorAll('[data-f="status"]').length}`}[f]}` : 'First S, P or T: then a digit'); return true; }
  return false;
}
// Move under…: pick the parent from a list you can type into, instead of typing a code. On the phone it is a sheet
// with finger-sized rows, and the list shows before the keyboard does (B156).
function movePicker(n) {
  const it = byN.get(n), below = new Set([n]);
  const walk = k => { for (const c of kids.get(k) || []) if (!below.has(c.n)) { below.add(c.n); walk(c.n); } };
  walk(n);
  U.sheet = 'move'; U.moveFor = n;
  dialog('', `<div class="flex flex-col gap-2"><input id="moveQ" class="${FIELD} lg:h-9 lg:py-0 lg:text-sm" placeholder="Put ${code(n)} under…" autocomplete="off">
    <div id="moveList" class="-mx-1 max-h-[55dvh] overflow-y-auto lg:max-h-80 lg:scrollbar-thin"></div></div>`, {pop: true, focus: false, head: `<span class="text-[15px] font-semibold lg:text-sm">Move ${code(n)} under…</span>`});
  const draw = () => {
    const words = $('moveQ').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const cands = S.items.filter(c => !below.has(c.n) && !c.merged_into && !c.archived && c.type !== 'rule' && words.every(w => hay(c).includes(w)))
      .sort((a, b) => CLOSED(a.status) - CLOSED(b.status) || a.n - b.n).slice(0, 40);  // open items first
    $('moveList').innerHTML = cands.map(c => `<button data-act="move-to" data-n="${n}" data-to="${code(c.n)}" ${c.n === it.parent ? 'aria-current="true"' : ''} class="flex h-12 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[15px] hover:bg-zinc-100 aria-[current=true]:bg-blue-50 lg:h-9 lg:text-sm dark:hover:bg-zinc-800 dark:aria-[current=true]:bg-blue-400/10">${stateIcon(c.status, statusName(c), 'size-4')}<span class="font-mono text-xs font-bold ${TYPE_TEXT[c.type]}">${code(c.n)}</span><span class="min-w-0 flex-1 truncate">${esc(c.title)}</span></button>`).join('')
      + `<button data-act="move-to" data-n="${n}" data-to="none" class="mt-1 flex h-12 w-full items-center gap-2.5 rounded-lg border-t border-zinc-100 px-2.5 text-left text-[15px] hover:bg-zinc-100 lg:h-9 lg:text-sm dark:border-zinc-800 dark:hover:bg-zinc-800">${ico(it.parent ? 'x' : 'check', 'size-4 text-zinc-500')}Stands on its own</button>`;
  };
  draw();
  $('moveQ').addEventListener('input', draw);
  if (desk()) $('moveQ').focus();
}

const KEYS = [
  ['Move', [['J / K', 'Next or previous item'], ['⇧J / ⇧K', 'Next or previous item that needs you (Go through)'], ['O or ↵', 'Full width; Esc goes back'], ['Space', 'Scroll the item'], ['G then I N A R', 'Items, Inputs, Archive, Rules'], ['G then P', 'Switch project (type to find it)'], ['G then S', 'Settings'], ['[', 'Show or hide the sidebar']]],
  ['Act on the selected item', [['A', "The item's next step: Accept, Approve, Answer or Reply"], ['R', 'Reply or add to it'], ['N', 'Not yet: reopen and say what is missing'], ['1–9, ⌘↵', 'Pick a choice, send the answer'], ['D · W · L', "Done · Won't do · Later / Now"], ['E / ⇧E', 'Archive or unarchive / archive every finished item'], ['S · P · T', 'Status, priority, type: then the digit or letter the ⋯ menu shows'], ['M · ⇧C', 'Move under… · Copy for agent'], ['I · ⇧D · ⇧A', 'Edit · New doc · Add subitem'], ['.', 'All actions'], ['Z', 'Undo your last action here, again for the one before; older changes: Change log']]],
  ['Mouse', [['Hover a row', 'Its quick actions, always in the same places'], ['Right-click a row', 'Its menu, at the pointer'], ['Click cut-off words', 'Show them all'], ['Drag a pane edge', 'Resize; double-click for the default']]],
  ['Write and find', [['C', 'New input to the project (on Rules, a new rule)'], ['V', 'Voice note for the selected item; V again stops'], ['⇧V', 'New input by voice; ⇧V again stops and sends'], ['⌥V', 'Voice note while typing in the box'], ['↵', 'While recording: stop, into the box'], ['⇧↵ or ⌘↵', 'Send; while recording: stop and send'], ['/', 'Search'], ['F', 'Filters'], ['?', 'This sheet'], ['Esc', 'Step back one level']]],
];
function showKeys() {
  const sec = ([group, keys]) => `<section class="mb-5"><h3 class="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">${group}</h3>
    <dl class="flex flex-col gap-1.5 text-sm">${keys.map(([k, what]) => `<div class="flex items-baseline gap-3"><dt class="w-28 shrink-0 font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-200">${k}</dt><dd class="text-zinc-600 dark:text-zinc-300">${what}</dd></div>`).join('')}</dl></section>`;
  dialog('Keyboard shortcuts', `<div class="grid gap-x-8 sm:grid-cols-2"><div>${sec(KEYS[0])}${sec(KEYS[3])}</div><div>${sec(KEYS[1])}${sec(KEYS[2])}</div></div>`);  // moving and writing | acting
}
// F253: put the projects in your order. Drag a row in the sidebar (the phone's menu: hold it still, then drag), or
// Move up / Move down in its menu. The order is kept with Taska, for every page that lists projects; Undo puts it back.
async function saveProjOrder(names, said) {
  const was = [...(DR.list || [])].sort(projOrder).map(p => p.name);
  const put = list => { for (const p of DR.list || []) { const i = list.indexOf(p.name); if (i >= 0) p.pos = i; else delete p.pos; } keepProjects(); if (desk()) { renderSidebar(); renderRail(); } else drawDrawer(); };
  put(names);
  try { await net('/api/projects/order', JSON_POST({names}), NET.op); } catch (_) { put(was); return toast('Order not saved', () => saveProjOrder(names, said), {error: true, label: 'Retry'}); }
  toast(said, pushUndo(said, async () => { put(was); try { await net('/api/projects/order', JSON_POST({names: was}), NET.op); } catch (_) {} }));
}
function projMove(slug, dir) {
  const names = [...(DR.list || [])].sort(projOrder).map(p => p.name), i = names.indexOf(slug), j = i + dir;
  if (i < 0 || j < 0 || j >= names.length) return hint(dir < 0 ? 'It is the first project' : 'It is the last project');
  names.splice(j, 0, names.splice(i, 1)[0]);
  saveProjOrder(names, `${titleOf(DR.list.find(p => p.name === slug))} moved ${dir < 0 ? 'up' : 'down'}`);
}
const PDRAG = {};
$('drawerList').addEventListener('dragstart', e => { if (e.target.closest?.('a[data-slug]')) e.preventDefault(); });  // not the browser's own link dragging
$('drawerList').addEventListener('pointerdown', e => {
  const a = e.target.closest('a[data-slug]');
  if (!a || e.button || (DR.list || []).length < 2) return;
  clearTimeout(PDRAG.t);
  Object.assign(PDRAG, {a, id: e.pointerId, x: e.clientX, y: e.clientY, on: false, touch: e.pointerType !== 'mouse'});
  if (PDRAG.touch) PDRAG.t = setTimeout(() => { if (PDRAG.a === a) pdragStart(); }, 450);  // a finger holds still first; moving at once scrolls
});
// As drag and drop usually looks: the row you hold follows the pointer, lifted; where it would land is an empty slot;
// the other rows slide out of its way; on release it settles into the slot.
function pdragStart() {
  const a = PDRAG.a, r = a.getBoundingClientRect(), g = a.cloneNode(true);
  PDRAG.on = true; PDRAG.from = [...$('drawerList').querySelectorAll('a[data-slug]')].map(r => r.dataset.slug);
  g.removeAttribute('href'); g.removeAttribute('data-act'); g.setAttribute('aria-hidden', 'true');
  g.classList.add('pointer-events-none', 'fixed', 'z-50', 'm-0', 'bg-white', 'shadow-xl', 'ring-1', 'ring-black/10', 'dark:bg-zinc-800', 'dark:ring-white/10');
  Object.assign(g.style, {left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', transform: 'scale(1.03)', transition: 'transform 120ms'});
  document.body.append(g);
  PDRAG.ghost = g; PDRAG.dy = PDRAG.y - r.top;
  a.dataset.dragging = ''; navigator.vibrate?.(10);
}
function pdragSlide(rows, change) {  // the rows move to their new places smoothly (they are measured before and after)
  const before = new Map(rows.map(r => [r, r.getBoundingClientRect().top]));
  change();
  for (const r of rows) { const d = before.get(r) - r.getBoundingClientRect().top; if (d && !REDUCE.matches) r.animate([{transform: `translateY(${d}px)`}, {transform: 'none'}], {duration: 160, easing: 'ease-out'}); }
}
addEventListener('pointermove', e => {
  const g = PDRAG;
  if (!g.a || e.pointerId !== g.id) return;
  if (!g.on) {
    if (Math.hypot(e.clientX - g.x, e.clientY - g.y) < 6) return;
    if (g.touch) { clearTimeout(g.t); g.a = null; return; }
    pdragStart();
  }
  g.ghost.style.top = (e.clientY - g.dy) + 'px';
  const rows = [...$('drawerList').querySelectorAll('a[data-slug]')], over = rows.find(r => { const b = r.getBoundingClientRect(); return r !== g.a && e.clientY >= b.top + b.height / 4 && e.clientY < b.bottom - b.height / 4; });
  if (over && !over.getAnimations().length) { const down = rows.indexOf(over) > rows.indexOf(g.a); pdragSlide(rows, () => over.parentNode.insertBefore(g.a, down ? over.nextSibling : over)); }
});
$('drawerList').addEventListener('touchmove', e => { if (PDRAG.on) e.preventDefault(); }, {passive: false});  // dragging, not scrolling
function pdragEnd(e) {
  const g = PDRAG;
  clearTimeout(g.t);
  if (!g.a || (e && e.pointerId !== g.id)) return;
  const a = g.a, on = g.on;
  g.a = null; g.on = false;
  if (!on) return;
  const ghost = g.ghost, to = a.getBoundingClientRect(); g.ghost = null;
  const done = () => { ghost.remove(); delete a.dataset.dragging; };
  if (REDUCE.matches) done(); else { Object.assign(ghost.style, {transition: 'top 150ms ease-out, left 150ms ease-out, transform 150ms ease-out', top: to.top + 'px', left: to.left + 'px', transform: 'none'}); setTimeout(done, 160); }
  const eat = ev => { ev.preventDefault(); ev.stopPropagation(); };  // the drop is not a click on the row
  addEventListener('click', eat, {capture: true, once: true}); setTimeout(() => removeEventListener('click', eat, true), 400);
  const names = [...$('drawerList').querySelectorAll('a[data-slug]')].map(r => r.dataset.slug);
  if (names.join() !== g.from.join()) saveProjOrder(names, `${titleOf((DR.list || []).find(p => p.name === a.dataset.slug) || {name: a.dataset.slug})} moved`);
}
addEventListener('pointerup', pdragEnd);
addEventListener('pointercancel', pdragEnd);
$('drawerList').addEventListener('contextmenu', e => { if (PDRAG.a && PDRAG.touch) e.preventDefault(); });  // a long press is for dragging here

// G P: pick another project by typing (B126). The list loads once; ↑↓ choose, Enter opens, Esc closes.
const PS = {q: '', i: -1};
function projectSwitcher(fresh = true) {
  if (fresh) { PS.q = ''; PS.i = -1; }
  const q = PS.q.trim().toLowerCase(), rows = (DR.list || []).filter(p => (titleOf(p) + ' ' + p.name).toLowerCase().includes(q)).sort(projOrder);
  if (PS.i < 0 || PS.i >= rows.length) PS.i = Math.max(0, rows.findIndex(p => p.name !== S.project));
  const list = rows.map((p, i) => `<a href="/p/${encodeURIComponent(p.name)}/" data-i="${i}" aria-selected="${i === PS.i}" class="flex h-11 items-center gap-3 rounded-xl px-3 hover:bg-zinc-100 aria-selected:bg-zinc-100 aria-selected:ring-1 aria-selected:ring-zinc-300 dark:hover:bg-zinc-800 dark:aria-selected:bg-zinc-800 dark:aria-selected:ring-zinc-600">${projTile(p.name, 'size-6 rounded-md text-xs')}<span class="min-w-0 flex-1 truncate ${p.name === S.project ? 'font-semibold' : ''}">${esc(titleOf(p))}</span>${p.name === S.project ? '<span class="text-xs text-zinc-400">this one</span>' : ''}${p.needs ? `<span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">${p.needs} need you</span>` : ''}</a>`).join('')
    || `<p class="px-3 py-2 text-sm text-zinc-500">${DR.list ? 'No project matches' : 'Loading…'}</p>`;
  if (!fresh && $('projList')) { $('projList').innerHTML = list; $('projList').querySelector('[aria-selected=true]')?.scrollIntoView({block: 'nearest'}); return; }
  dialog('Switch project', `<input id="projFilter" class="${FIELD}" placeholder="Type to find a project" aria-label="Find a project" autocomplete="off"><div id="projList" class="-mx-1 mt-2 flex flex-col gap-0.5">${list}</div>`, {focus: false});
  $('projFilter').focus();
  if (fresh) { checkOthers.t = 0; checkOthers().then(() => { if (!$('overlay').hidden && $('projList')) projectSwitcher(false); }); }  // once: no loop
}
document.addEventListener('input', e => { if (e.target.id === 'projFilter') { PS.q = e.target.value; PS.i = -1; projectSwitcher(false); } });
document.addEventListener('keydown', e => {
  if (e.target.id !== 'projFilter') return;
  const rows = $('projList').querySelectorAll('a[data-i]');
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && rows.length) { e.preventDefault(); PS.i = (PS.i + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length; projectSwitcher(false); }
  else if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); rows[PS.i]?.click(); }
});

// One table drives the keys. Single keys only act while you are not typing; Esc first leaves a text field.
const ITEM_KEYS = new Set([...'arndwle.sptmiCDA']);  // the keys that act on the selected item
const hint = t => toast(t);  // a key that can't act here says why, in a few words (T113 B26)
function deskKey(e) {
  if (!desk() || e.defaultPrevented) return;
  const el = document.activeElement, typing = /INPUT|TEXTAREA|SELECT/.test(el?.tagName) || el?.isContentEditable;
  // ⌥V records even while you type in the box (B91): there a plain V is a letter. In the document editor it speaks
  // into the document, where the caret is (F208).
  if (e.altKey && e.code === 'KeyV' && !e.metaKey && !e.ctrlKey && U.docEdit && $('docMd')) { e.preventDefault(); return DV.rec ? docRecStop() : docRecStart(); }
  if (e.altKey && e.code === 'KeyV' && !e.metaKey && !e.ctrlKey && $('viewer').hidden && $('overlay').hidden) { e.preventDefault(); return R.rec ? finishRec(false) : startRec(); }
  if (typing || e.altKey || !$('viewer').hidden) return;
  // A1: while the box waits for words (a correction, an edit, a comment on what you picked) a letter is a word, not a
  // command: it goes into the box, which takes the key as it is pressed.
  if (!R.rec && $('overlay').hidden && e.key.length === 1 && !e.metaKey && !e.ctrlKey && (U.correct || U.amend || U.prefsEdit || docTarget())) return $('text').focus({preventScroll: true});
  // While recording, the keys of the box (F095): ↵ stops into the box, ⇧↵ or ⌘↵ stops and sends, Esc discards.
  // ⇧↵ means send even on the button you just clicked (B164); a plain ↵ there presses that button, as below.
  if (R.rec && e.key === 'Enter' && !e.isComposing && (e.shiftKey || e.metaKey || e.ctrlKey)) { e.preventDefault(); return finishRec(true); }
  // Enter and Space press the button, link or choice you are on (B123); they are shortcuts only on the page or a row.
  if ((e.key === 'Enter' || e.key === ' ') && el && el !== document.body && !el.closest('#list') && el.closest('button, a[href], [role=button], summary')) return;
  if (R.rec && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); return finishRec(false); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && U.choice && U.choice.n === U.open) { e.preventDefault(); return document.querySelector(`[data-act="choice-send"][data-n="${U.open}"]`)?.click(); }
  if (e.metaKey || e.ctrlKey) return;
  if (U.sheet === 'menu' && !$('overlay').hidden && menuKey(e)) return;  // S P T then a digit or letter; arrows and Tab stay in it (T113 A16, B8)
  if (U.sheet === 'menu' && !$('overlay').hidden && /^[a-zA-Z]$/.test(e.key)) closeDialog();  // the keys the menu shows work from it (B131)
  if (!$('overlay').hidden) return;  // a sheet or menu is open: it has its own keys (Esc closes it)
  const k = e.key, one = /^[a-zA-Z0-9./[?]$/.test(k);  // a key that does something here; one that can't says why (T113 B26, A20)
  if (D.sideOpen && k !== '[') { if (one) hint('The sidebar is over the page: [ closes it'); return; }  // keys don't reach behind it (B120)
  // Item keys act only on an item you can see (B120): not from Inputs, the project page or New input; on a document
  // open over its item, I edits the document and O shows it full width, and the others wait for Esc (T113 B20).
  const n = detailShown() && !D.compose ? U.open : null, it = n && byN.get(n), lists = U.tab !== 'inputs' && !D.page;
  const doc = desk() && U.doc && !U.docEdit && docById(U.doc), back = n ? `Back to ${code(n)} first: Esc` : '';
  if (D.g && Date.now() - D.g < 1000) {  // G then a letter
    D.g = 0;
    const tab = {i: 'items', n: 'inputs', a: 'archive', r: 'rules'}[k.toLowerCase()];
    if (tab) { e.preventDefault(); return setTab(tab); }
    if (k.toLowerCase() === 'p') { e.preventDefault(); return projectSwitcher(); }
    if (k.toLowerCase() === 's') { e.preventDefault(); return openProject(D.page ? D.section : 'agents'); }  // Settings (B162)
  }
  const act = (name, data = {}) => { e.preventDefault(); ACT[name]({dataset: {n: String(n), ...data}}, e); };
  const status = v => it && act('status', {v});
  const arm = U.armKey; U.armKey = null;
  if (arm && arm.n === n && Date.now() - arm.t < 3000) {  // B264: S, P or T, then the key that says what to set
    const sts = (it.type === 'rule' ? Object.keys(RULE_STATUS) : Object.keys(STATUS));
    const [f, v] = arm.k === 'p' ? ['pri', /^[0-3]$/.test(k) && 'P' + k] : arm.k === 't' ? ['type', TYPE_OF_LETTER[k.toLowerCase()]] : ['status', /^[1-9]$/.test(k) && sts[Number(k) - 1]];
    if (v) { e.preventDefault(); return f === 'status' ? status(v) : change(n, f, v); }
  }
  switch (k) {
    case 'j': case 'ArrowDown': case 'k': case 'ArrowUp': {
      const dir = k === 'j' || k === 'ArrowDown' ? 1 : -1, letter = k === 'j' || k === 'k';
      if (doc) { if (letter) hint(back); return; }
      if (lists) { e.preventDefault(); return stepItem(dir); }
      if (letter) hint(D.page ? 'J and K move in a list: Esc goes back to it' : 'J and K move in Items, Archive and Rules');
      return;
    }
    case 'J': case 'K':  // what needs you lives in Items (and Rules has its own): from another tab or page, go to Items first
      e.preventDefault();
      if (U.go) return ACT[k === 'J' ? 'go-next' : 'go-prev']();
      if (walkTab() !== U.tab || D.page) setTab('items');  // the New input page is any tab's page with nothing open (B269)
      return startGoDesk(U.open);
    case 'o': case 'Enter': if (it) { e.preventDefault(); fullWidth(!D.full); } else if (k === 'o') hint('First pick an item: J or a click'); return;
    case ' ': if (it) { e.preventDefault(); $('detailBody').scrollBy({top: (e.shiftKey ? -0.8 : 0.8) * $('detailBody').clientHeight, behavior: REDUCE.matches ? 'auto' : 'smooth'}); } return;
    case 'g': D.g = Date.now(); return;
    case '[': e.preventDefault(); return ACT.side();
    case '/': e.preventDefault(); toList(); return requestAnimationFrame(() => $('q').focus());  // T268: from anywhere, back to the list and search
    case 'f':
      e.preventDefault();
      toList(); return showFilters();  // T268: from anywhere, back to the list and its filters
    case '?': e.preventDefault(); return showKeys();
    case 'c': e.preventDefault(); return ACT['new-input']();
    case 'z': e.preventDefault(); return undoMine();  // your own last action here; older ones: the change log (B127)
    case 'E': e.preventDefault(); return ACT['archive-all']();
    case 'v': e.preventDefault(); return R.rec ? finishRec(false) : startRec();
    case 'V':  // a new input by voice in one key (B91); again stops and sends it
      e.preventDefault();
      if (R.rec) return finishRec(true);
      ACT['new-input'](); return startRec();
  }
  if (!it) { if (ITEM_KEYS.has(k)) hint(U.tab === 'inputs' || D.page || D.compose ? 'Item keys work on an item: open one in Items, Archive or Rules' : 'First pick an item: J or a click'); return; }
  if (doc) {
    if (k === 'i') { e.preventDefault(); return ACT['doc-edit'](); }
    if (k === 'r') { e.preventDefault(); return ACT.reply(); }  // the box writes on the document
    if (ITEM_KEYS.has(k)) hint(back);
    return;
  }
  const ruleTo = v => it.status === v ? hint(`${code(n)} is ${v === 'open' ? 'active' : 'retired'} already`) : status(v);  // a rule: D makes it active, W retires it (T113 B21)
  switch (k) {
    case 'a':  // the amber action
      if (it.status === 'review') return status('done');
      if (it.status === 'proposed') return status('open');
      if (it.wait?.kind === 'ask' && hasChoices(it.wait.text)) { e.preventDefault(); return document.querySelector(`#detailBody [data-act="choice"][data-n="${n}"]`)?.focus(); }
      if (it.wait) { e.preventDefault(); return ACT.reply(); }
      return toast(`Nothing waits on you in ${code(n)}`);
    case 'r': e.preventDefault(); return ACT.reply();
    case 'n': if (it.status === 'review') return act('reopen'); return toast('Not yet works on items in review');
    case 'd': return it.type === 'rule' ? ruleTo('open') : CLOSED(it.status) ? hint(`${code(n)} is ${it.status === 'done' ? 'done' : "marked won't do"} already`) : status('done');
    case 'w': return it.type === 'rule' ? ruleTo('dropped') : it.status === 'dropped' ? hint(`${code(n)} is marked won't do already`) : status('dropped');
    case 'l': if (it.type !== 'rule' && !CLOSED(it.status)) act('swipe', {f: 'when', v: it.when === 'now' ? 'later' : 'now'}); else hint(it.type === 'rule' ? 'Rules have no Later' : 'Later works on open items'); return;
    case 'e': if (it.archived || CLOSED(it.status)) act('archive', {on: it.archived ? '0' : '1'}); else { e.preventDefault(); toast('Archive works on finished items'); } return;
    case '.': e.preventDefault(); return itemMenuDesk(n, null);
    case 's': case 'p': case 't': e.preventDefault(); U.armKey = {k, n, t: Date.now()}; return hint({s: 'Status: 1–6', p: 'Priority: 0–3', t: 'Type: F B I T R'}[k]);  // B264: the next key sets it, no menu; the toast says what changed
    case 'm': e.preventDefault(); return movePicker(n);
    case 'C': return act('copy');
    case 'i': return act('edit');
    case 'D': return act('doc-new');
    case 'A': return act('sub-new');
  }
  if (/^[1-9]$/.test(k) && it.wait?.kind === 'ask') {  // pick an answer
    const b = document.querySelector(`#detailBody [data-act="choice"][data-n="${n}"][data-i="${Number(k) - 1}"]`);
    if (b) { e.preventDefault(); b.click(); }
  }
}

function layoutChange() {  // crossing 1024px: each layout puts back what it owns
  if (desk()) { DR.open = false; if (D.page && !D.section) D.section = 'agents'; $('app').style.transform = ''; for (const c of ['rounded-l-3xl', 'overflow-hidden', 'shadow-2xl']) $('app').classList.remove(c); }
  else { $('drawer').hidden = !DR.open; $('rail').hidden = true; $('projBar').hidden = true; $('drawerShade').hidden = !DR.open; $('headNormal').hidden = !!U.searching; $('headSearch').hidden = !U.searching; $('projectView').hidden = true; D.page = null; D.full = false; D.compose = false; $('app').removeAttribute('data-compose'); $('q').placeholder = 'Search title, text or code'; }
  closeDialog(); render();
}
// Drag the right edge of the sidebar or the list to resize it (F89). The width goes into a CSS variable that the
// grid classes read; it is kept in this browser, and a double-click on the edge gives the default back.
const GRIP = {side: ['drawer', '--side-w', 200, 360], list: ['app', '--list-w', 280, 720]};
function setGrip(kind, px) { const [el, v] = GRIP[kind]; if (px) $(el).style.setProperty(v, px + 'px'); else $(el).style.removeProperty(v); }
try { for (const k in GRIP) { const w = Number(localStorage.getItem('taska.w.' + k)); if (w) setGrip(k, w); } } catch (_) {}
document.addEventListener('pointerdown', e => {
  const g = desk() && e.target.closest('[data-grip]');
  if (!g || e.button) return;
  const kind = g.dataset.grip, [el, , min, max] = GRIP[kind], left = $(el).getBoundingClientRect().left;
  const most = kind === 'list' ? Math.min(max, innerWidth - left - 480) : max;  // the item keeps room to read
  let w = 0;
  e.preventDefault(); g.setPointerCapture(e.pointerId); document.body.classList.add('select-none', 'cursor-col-resize');
  const move = ev => { w = Math.round(Math.min(most, Math.max(min, ev.clientX - left))); setGrip(kind, w); };
  const up = () => {
    g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); document.body.classList.remove('select-none', 'cursor-col-resize');
    if (w) try { localStorage.setItem('taska.w.' + kind, w); } catch (_) {}
  };
  g.addEventListener('pointermove', move); g.addEventListener('pointerup', up);
});
document.addEventListener('dblclick', e => {
  const g = desk() && e.target.closest('[data-grip]');
  if (g) { setGrip(g.dataset.grip, 0); try { localStorage.removeItem('taska.w.' + g.dataset.grip); } catch (_) {} }
});
DESK.addEventListener('change', layoutChange);
WIDE.addEventListener('change', () => { D.sideOpen = false; if (desk()) render(); });
document.addEventListener('keydown', deskKey);
document.addEventListener('click', e => {  // a double click: the first click redraws the row, so no dblclick event comes
  const r = desk() && e.detail === 2 && e.target.closest('#list [data-act="open"][data-n]');
  if (r && !e.target.closest('button')) { openItem(Number(r.dataset.n)); fullWidth(true); }
});
document.addEventListener('contextmenu', e => {
  const r = desk() && e.target.closest('#list [data-act="open"][data-n]');
  if (r) { e.preventDefault(); openItem(Number(r.dataset.n)); itemMenuDesk(Number(r.dataset.n)); popAt(e.clientX, e.clientY); }
  const p = desk() && e.target.closest('#drawerList a[data-slug], #rail a[data-slug]');  // a project: its menu (F173)
  if (p) { e.preventDefault(); projectMenu(p.dataset.slug, [e.clientX, e.clientY]); }
});

// ---------------------------------------------------------------- projects drawer
// The project list lives in a drawer under the page (F54): tap the menu icon and the page slides right; swipe
// it back, or tap what is left of the page, to close. The swipe in from the left edge stays the phone's "back",
// so row swipes start away from the edge.
const EDGE_W = 24, DR = {open: false, g: null};
// B190: the projects as this browser last saw them, so the next page (a reload, another project) draws its sidebar at once
function keepProjects() { noticeProjects(DR.list); try { localStorage.setItem('taska.projects', JSON.stringify(DR.list)); } catch (_) {} }
try { DR.list = JSON.parse(localStorage.getItem('taska.projects') || 'null'); } catch (_) {}
const drawerW = () => Math.min(innerWidth * 0.85, 320);
function setDrawer(x, animate = true) {  // x: how far the page is pushed right
  const app = $('app'), shade = $('drawerShade');
  if (x > 0) $('drawer').hidden = false;
  app.style.transition = animate && !REDUCE.matches ? 'transform 220ms ease-out' : 'none';
  app.style.transform = x > 0 ? `translateX(${x}px)` : '';
  for (const c of ['rounded-l-3xl', 'overflow-hidden', 'shadow-2xl']) app.classList.toggle(c, x > 0);
  shade.hidden = x <= 0; shade.style.left = x + 'px';
  if (x <= 0 && animate) setTimeout(() => { if (!DR.open && !app.style.transform) $('drawer').hidden = true; }, 240);
}
async function fillDrawer() {
  if (!DR.list) draw($('drawerList'), '<div class="px-3 py-3 text-sm text-zinc-400">Loading…</div>');
  try { DR.list = (await net('/api/projects')).sort((a, b) => b.t - a.t); keepProjects(); } catch (_) { if (!DR.list) draw($('drawerList'), `<div class="px-3 py-3 text-sm text-zinc-500 dark:text-zinc-400">Couldn't load the projects</div>`); return; }
  drawDrawer();
}
function drawDrawer() {  // the phone's menu of projects, from what DR.list holds now
  draw($('drawerList'), [...DR.list].sort(projOrder).map(p => { const cur = p.name === S.project, [tone, label] = agentState(p.agents, p.work);  // one order, yours (F253): rows don't move as projects get busy or when you pick one (B158, B200)
    return `<a href="/p/${encodeURIComponent(p.name)}/" data-slug="${esc(p.name)}" ${cur ? 'aria-current="page"' : ''} class="group flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 select-none [-webkit-touch-callout:none] data-dragging:bg-zinc-200/70 data-dragging:ring-0 data-dragging:[&>*]:invisible dark:data-dragging:bg-zinc-800/70 hover:bg-zinc-200/50 data-pressed:bg-zinc-200/70 aria-[current=page]:bg-blue-100 aria-[current=page]:ring-1 aria-[current=page]:ring-blue-200 dark:hover:bg-zinc-800/60 dark:data-pressed:bg-zinc-800 dark:aria-[current=page]:bg-blue-400/15 dark:aria-[current=page]:ring-blue-400/30">${projTile(p.name, 'size-8 rounded-lg text-sm')}
    <span class="min-w-0 flex-1"><span class="flex items-center gap-2"><span class="min-w-0 flex-1 truncate text-[17px] font-medium group-aria-[current=page]:font-semibold">${esc(titleOf(p))}</span>${p.needs ? `<span class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">${p.needs} need you</span>` : ''}</span>
    <span class="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400"><span class="size-1.5 shrink-0 rounded-full ${AGENT_TONE[tone][0]}"></span><span class="truncate ${tone === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : AGENT_TONE[tone][1]}">${esc(label)}</span><span class="shrink-0">· ${p.open} open</span></span></span></a>`; }).join(''));  // T234: the draft mark (a quiet word, not an edit button) and the count on the name's line, the agent's state on a line of its own
  $('otherDot').hidden = !DR.list.some(p => p.name !== S.project && p.needs);
}
// Undo your last changes (F80): the server lists the ones nobody changed again since; each says what it did.
function undoLabel(u) {
  const f = u.f, w = u.was, c = code(u.n);
  if ('status' in f) return f.status === 'done' && w.status === 'review' ? `${c} accepted` : f.status === 'open' && w.status === 'proposed' ? `${c} approved` : `${c} ${SAID[f.status] || f.status}`;
  if ('archived' in f) return `${c} ${f.archived ? 'archived' : 'unarchived'}`;
  if ('when' in f) return `${c} ${SAID[f.when]}`;
  if ('pri' in f) return `${c} ${w.pri} → ${f.pri}`;
  if ('type' in f) return `${c} became a ${f.type}`;
  if ('parent' in f) return f.parent ? `${c} moved under ${code(f.parent)}` : `${c} stands on its own`;
  return `${c} ${Object.keys(f).join(' and ')} edited`;
}
// Z and the sidebar's Undo mean one thing (B127): put back your own last action on this page, newest first, a batch
// as a batch. Anything older, or done elsewhere, is undone from the change log, after a second click to confirm.
function pushUndo(label, undo) {  // -> the one way to undo it, from Z, the sidebar, the toast or a bar; it runs once
  const e = {label, done: false};
  e.run = async () => {
    if (e.done) return;
    e.done = true; U.mine = U.mine.filter(x => x !== e); renderDrawerSettings();
    const ok = await undo();
    if (ok === false) { e.done = false; U.mine.push(e); renderDrawerSettings(); }  // it couldn't be put back: Z can try again (T160)
    return ok;
  };
  e.run.entry = e;
  U.mine.push(e); if (U.mine.length > 30) U.mine.shift();
  renderDrawerSettings();
  return e.run;
}
function forget(run) { const e = run?.entry; if (!e || e.done) return; e.done = true; U.mine = U.mine.filter(x => x !== e); renderDrawerSettings(); }  // it never happened
async function undoMine() {
  const e = U.mine.at(-1);
  if (!e) return toast('Nothing of yours to undo on this page. Older changes: Change log');
  try { await e.run(); } catch (_) {}
}
async function revert(seq) {
  const d = await net(P + 'api/revert', JSON_POST({seq}), NET.op);
  if (!d.ok) { toast(d.error || (d.res || [])[0] || 'Could not undo', null, {error: true}); throw new Error('revert failed'); }
  try { await load(); } catch (_) {}
}
async function revertNow(seq) {  // one of your changes, from the change log
  const u = (S.undo || []).find(u => u.seq === seq);
  try { await revert(seq); } catch (ex) { return notSaved(ex, () => revertNow(seq)); }
  toast(`Undid: ${u ? undoLabel(u) : 'the change'}`); renderDrawerSettings();
}
const undoRow = () => { const u = U.mine.at(-1); return u ? `<button data-act="undo-mine" class="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left text-[15px]">${ico('undo', 'size-5 shrink-0 text-zinc-500 dark:text-zinc-400', '2')}<span class="min-w-0 flex-1 leading-snug">Undo: ${esc(u.label)}</span></button>` : ''; };
function renderDrawerSettings() {
  if (desk()) return renderSideFoot();  // Undo comes and goes with each change
  // The phone's drawer ends in a card (B162): Undo, while there is one (a phone has no Z), and Settings, whose pages hold
  // the rest. Keep going stays on the list's Agent queue and in Settings › Agents.
  draw($('drawerSettings'), `${undoRow()}<button data-act="project" class="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left text-[15px]">${ico('gear', 'size-5 shrink-0 text-zinc-500 dark:text-zinc-400')}<span class="min-w-0 flex-1">Settings</span>${ico('right', 'size-4 shrink-0 text-zinc-300 dark:text-zinc-600')}</button>`);
}
// The amber dot on the menu icon: another project waits on you. Checked now and then, not on every change.
async function checkOthers() {
  if (Date.now() - (checkOthers.t || 0) < 20000) return;
  checkOthers.t = Date.now();
  const names = () => (DR.list || []).map(p => p.name).sort().join('\n'), had = names();
  try { DR.list = (await net('/api/projects')).sort((a, b) => b.t - a.t); keepProjects(); } catch (_) { return; }  // it tries again soon
  $('otherDot').hidden = !DR.list.some(p => p.name !== S.project && p.needs);
  if (names() !== had && S.rev >= 0) return render();  // A12, B13: Move… on Inputs and New input needs the other projects, the tiles' colours too
  if (desk()) { renderSidebar(); renderRail(); }
}
function openDrawer() { if (!DR.open) layerOpen('drawer'); DR.open = true; renderDrawerSettings(); fillDrawer(); setDrawer(drawerW()); if (!$('toast').hidden) placeToast(); }  // Back closes it (B150); a toast moves above its card
function closeDrawer() { if (desk()) { if (D.sideOpen) { D.sideOpen = false; render(); } return; } if (DR.open) layerShut('drawer'); DR.open = false; setDrawer(0); if (!$('toast').hidden) placeToast(); }
$('drawerShade').addEventListener('click', closeDrawer);
// Another project takes the drawer's step, so Back from there comes to this page as you left it, not to the drawer.
$('drawerList').addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (a && !desk() && layersNow().includes('drawer') && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); location.replace(a.href); }
});
document.addEventListener('touchstart', e => {
  const t = e.touches[0];
  DR.g = null;
  if (e.touches.length !== 1 || !$('overlay').hidden || !$('viewer').hidden) return;
  if (DR.open && e.target.closest('#drawer, #drawerShade')) DR.g = {x0: t.clientX, y0: t.clientY, from: drawerW()};
}, {passive: true});
document.addEventListener('touchmove', e => {
  const g = DR.g;
  if (!g) return;
  const t = e.touches[0], dx = t.clientX - g.x0, dy = t.clientY - g.y0;
  if (!g.pull && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { DR.g = null; return; }  // scrolling, not the drawer
  g.pull = g.pull || Math.abs(dx) > 10;
  if (g.pull) setDrawer(g.x = Math.max(0, Math.min(drawerW(), g.from + dx)), false);
}, {passive: true});
document.addEventListener('touchend', () => {
  const g = DR.g;
  DR.g = null;
  if (!g?.pull) return;
  if (g.x > drawerW() * 0.7) openDrawer(); else closeDrawer();
});
addEventListener('pageshow', () => {  // back from another project
  if (desk()) return;  // the desktop's sidebar is not a drawer: it stays (B190)
  DR.open = false; setDrawer(0, false); $('drawer').hidden = true;
  if (layersNow().includes('drawer')) history.replaceState({...history.state, layers: layersNow().filter(k => k !== 'drawer')}, '');  // its step is not open any more (B150)
});

// Swipe right on an item page to go back (F63): the page follows the finger, the list shows underneath. The
// first 24px from the edge stay the phone's own back; strips that scroll sideways keep their own swipe.
const BK = {on: false, pull: false};
$('detailView').addEventListener('touchstart', e => {
  const t = e.touches[0];
  BK.on = e.touches.length === 1 && t.clientX > EDGE_W && $('overlay').hidden && !e.target.closest('.overflow-x-auto, pre, input, textarea');
  Object.assign(BK, {x0: t.clientX, y0: t.clientY, dx: 0, t0: Date.now()});
}, {passive: true});
$('detailView').addEventListener('touchmove', e => {
  if (!BK.on) return;
  const t = e.touches[0], dx = t.clientX - BK.x0, dy = t.clientY - BK.y0, v = $('detailView');
  if (!BK.pull) {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    if (dx < 0 || Math.abs(dy) > Math.abs(dx)) { BK.on = false; return; }  // scrolling, or a swipe the other way
    BK.pull = true; showView();
    [$('list').scrollTop, $('inputsView').scrollTop] = U.listTop || [0, 0];
    v.style.transition = 'none';
  }
  if (e.cancelable) e.preventDefault();  // the page moves sideways, not up and down
  BK.dx = Math.max(0, dx);
  v.style.transform = `translateX(${BK.dx}px)`;
}, {passive: false});
function backEnd() {
  if (!BK.pull) return;
  BK.on = false;
  const v = $('detailView'), w = v.offsetWidth, go = BK.dx > w * 0.3 || (BK.dx > 60 && Date.now() - BK.t0 < 300);  // far enough, or a flick
  v.style.transition = REDUCE.matches ? 'none' : 'transform 180ms ease-out';
  v.style.transform = go ? `translateX(${w}px)` : '';
  setTimeout(() => { if (go) ACT.back(); else { BK.pull = false; showView(); } }, 180);
}
$('detailView').addEventListener('touchend', backEnd);
$('detailView').addEventListener('touchcancel', () => { BK.dx = 0; backEnd(); });

// A swipe on the card means what it means on a row (B153): right is its step forward (Accept, Approve, Answer, Reply,
// Done), left skips to the next card while you go through. The card follows the finger, and the button that letting
// go will press lights up first.
const FC = {x: null};
function cardAim(dx) {
  const f = $('dlgFoot').querySelector('[data-slot="fwd"]'), nx = $('dlgFoot').querySelector('[data-act="go-next"]');
  for (const [b, on] of [[f, dx > 80], [nx, dx < -80]]) if (b) for (const c of ['bg-zinc-100', 'dark:bg-zinc-800']) b.classList.toggle(c, on);
}
$('dlgBody').addEventListener('touchstart', e => {
  FC.x = U.peek && e.touches.length === 1 && !e.target.closest('.overflow-x-auto, pre, textarea, input') ? e.touches[0].clientX : null;
  FC.y = e.touches[0].clientY; FC.dx = 0; FC.on = false;
}, {passive: true});
$('dlgBody').addEventListener('touchmove', e => {
  if (FC.x === null) return;
  const t = e.touches[0], dx = t.clientX - FC.x, dy = t.clientY - FC.y;
  if (!FC.on) {
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { FC.x = null; return; }  // scrolling the card
    if (Math.abs(dx) < 12) return;
    FC.on = true; $('dlg').style.transition = 'none';
  }
  FC.dx = dx; $('dlg').style.transform = `translateX(${dx}px)`; cardAim(dx);
}, {passive: true});
function cardLetGo() {
  if (FC.x === null) return;
  const dx = FC.dx, on = FC.on;
  FC.x = null; FC.on = false; $('dlg').style.transition = ''; $('dlg').style.transform = ''; cardAim(0);
  if (on && Math.abs(dx) > 80) $('dlgFoot').querySelector(dx > 0 ? '[data-slot="fwd"]' : '[data-act="go-next"]')?.click();
}
$('dlgBody').addEventListener('touchend', cardLetGo, {passive: true});
$('dlgBody').addEventListener('touchcancel', () => { FC.dx = 0; cardLetGo(); }, {passive: true});
// While you type with the card open, what you answer stays in sight (B153): the card scrolls to the question, and its
// buttons make room until the keyboard goes.
$('text').addEventListener('focus', () => {
  if (desk() || !U.peek || $('overlay').hidden) return;
  $('dlgFoot').hidden = true;
  requestAnimationFrame(() => $('dlgBody').querySelector('[data-need]')?.scrollIntoView({block: 'start'}));
});
$('text').addEventListener('blur', () => { if (!desk() && U.peek && !$('overlay').hidden && $('dlgFoot').innerHTML) $('dlgFoot').hidden = false; });

$('list').addEventListener('touchstart', swipeStart, {passive: true});
$('list').addEventListener('touchmove', swipeMove, {passive: false});  // not passive: a sideways swipe keeps the list still
$('list').addEventListener('touchend', swipeEnd);
$('list').addEventListener('touchcancel', () => { if (SW.el) { swipeTo(SW.el, SW.el === SW.open ? -SW.reveal : 0); SW.el.style.transition = ''; SW.el = null; } });

// ---------------------------------------------------------------- press feedback (T160)
// Anything you can press answers the moment a finger or the mouse goes down: it gets data-pressed, and the classes
// give the look (a rule on <body> dims buttons and links; rows and other tappable areas darken). It stays at least
// 130 ms, so a quick tap shows too. A finger that moves is scrolling or swiping: the press ends at once, as it does
// when the mouse leaves. :active alone came too late on phones: Chrome shows it only once the finger lifts.
// The other rules on <body> keep every control alike: disabled and busy buttons at 40 %, one focus ring for the
// keyboard (drawn inside where an edge would cut it off), and no transitions or animations with "reduce motion".
// scripts/feedback_check.py checks all of this on every screen.
const PRESS = {el: null, id: null, x: 0, y: 0, t: 0, off: 0, mouse: false};
const PRESSABLE = 'button, a[href], summary, [data-act], [role=button]';
function press(el) {
  clearTimeout(PRESS.off);
  if (PRESS.el && PRESS.el !== el) PRESS.el.removeAttribute('data-pressed');
  PRESS.el = el; PRESS.t = performance.now(); el.setAttribute('data-pressed', '');
}
function unpress(tap = false) {  // tap: it ends in a tap, so it stays the 130 ms; otherwise it goes now
  const el = PRESS.el;
  PRESS.id = null;
  if (!el) return;
  clearTimeout(PRESS.off);
  const end = () => { el.removeAttribute('data-pressed'); if (PRESS.el === el) PRESS.el = null; };
  const left = tap ? 130 - (performance.now() - PRESS.t) : 0;
  if (left > 0) PRESS.off = setTimeout(end, left); else end();
}
document.addEventListener('pointerdown', e => {
  if (!e.isPrimary || e.button > 0) return;
  const el = e.target.closest?.(PRESSABLE);
  unpress();
  if (!el || el.disabled || el.matches('[aria-busy=true], [aria-disabled=true]')) return;
  press(el); Object.assign(PRESS, {id: e.pointerId, x: e.clientX, y: e.clientY, mouse: e.pointerType === 'mouse'});
}, true);
document.addEventListener('pointermove', e => {
  if (e.pointerId !== PRESS.id) return;
  if (Math.hypot(e.clientX - PRESS.x, e.clientY - PRESS.y) > 10 || (PRESS.mouse && !PRESS.el?.contains(e.target))) unpress();
}, true);
document.addEventListener('pointerup', e => { if (e.pointerId === PRESS.id) unpress(true); }, true);
document.addEventListener('pointercancel', () => unpress(), true);
document.addEventListener('scroll', e => { if (PRESS.id !== null && e.target.contains?.(PRESS.el)) unpress(); }, true);  // what it sits in scrolled
document.addEventListener('contextmenu', () => { if (PRESS.id !== null) unpress(); }, true);
addEventListener('blur', () => unpress());
document.addEventListener('click', e => {  // Enter or Space on a button, or a key that clicks one, shows the press too
  const el = !e.detail && e.target.closest?.(PRESSABLE);
  if (el && !el.disabled) { press(el); unpress(true); }
}, true);

document.addEventListener('click', e => {
  if (e.target.closest('a[href]:not([data-act])')) return;  // a link inside a tappable paragraph still opens
  if (Date.now() - SW.swallow < 400) { e.preventDefault(); e.stopPropagation(); return; }
  if (SW.open && !e.target.closest('[data-swipe-right]')) { closeSwipe(); e.preventDefault(); return; }
  const b = e.target.closest('[data-act]');
  if (b?.getAttribute('aria-busy') === 'true') { e.preventDefault(); return; }  // still waiting on the server: a second tap does nothing, and doesn't fall through (B159)
  const held = !desk() && b?.closest('article[data-settled]');
  if (held && Date.now() - Number(held.dataset.settled) < 600) { e.preventDefault(); return; }  // a double tap's second tap, on the row it just settled (B148)
  if (b?.hasAttribute('data-expand') && !getSelection().isCollapsed) return;  // selecting words to copy them
  if (e.target === $('overlay')) return closeDialog();
  if (b && ACT[b.dataset.act]) {
    e.preventDefault();
    const r = ACT[b.dataset.act](b, e);
    if (r?.finally && b.tagName === 'BUTTON') { b.setAttribute('aria-busy', 'true'); r.finally(() => b.removeAttribute('aria-busy')); }  // waiting on the server: dim, no second tap (B159)
  }
});
// One tooltip for the whole page (T094, design in D4), on devices with a mouse or trackpad. It reads a trigger's
// data-tip, else its title (moved to data-tip so the browser's own tooltip stays away), else the aria-label of
// an icon-only button; "Label · key" shows the key as a key cap. It opens after 500ms of rest, or at once when
// another one closed less than 300ms ago, or on keyboard focus; it stays while the pointer is on it; Esc, a
// click, a key, a scroll or leaving closes it. It sits on the side with room, and its arrow points at the trigger.
function tipText(el) {
  if (el.title) { el.dataset.tip = el.title; el.removeAttribute('title'); }
  return el.dataset.tip || (!el.textContent.trim() && el.getAttribute('aria-label')) || '';
}
function tipShow(el, quick) {
  const text = tipText(el);
  if (!text || !el.isConnected) return;
  const tip = $('tip'), parts = text.split(' · '), key = parts.length > 1 && /^(\S{1,4}|G [A-Z]|Esc)$/.test(parts.at(-1)) ? parts.pop() : '';
  $('tipText').innerHTML = esc(parts.join(' · ')) + (key ? `<kbd class="ml-1.5 inline-grid h-[18px] min-w-[18px] place-items-center rounded px-1 font-sans text-[11px] font-semibold ring-1 ring-current/30">${esc(key)}</kbd>` : '');
  TIP.el = el; tip.hidden = false; tip.removeAttribute('data-on'); tip.style.transition = quick ? 'none' : '';
  const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, gap = 8, pad = 8;
  let side = el.dataset.tipSide || (el.closest('#drawer, #rail') ? 'right' : el.closest('header, #goStrip') ? 'bottom' : 'top');
  const room = {top: r.top - h - gap, bottom: innerHeight - r.bottom - h - gap, right: innerWidth - r.right - w - gap, left: r.left - w - gap};
  const flip = {top: 'bottom', bottom: 'top', right: 'left', left: 'right'};
  if (room[side] < pad && room[flip[side]] > room[side]) side = flip[side];  // no room: the other side
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  let x, y;
  if (side === 'top' || side === 'bottom') { x = clamp(r.left + r.width / 2 - w / 2, pad, innerWidth - w - pad); y = side === 'top' ? r.top - h - gap : r.bottom + gap; }
  else { y = clamp(r.top + r.height / 2 - h / 2, pad, innerHeight - h - pad); x = side === 'right' ? r.right + gap : r.left - w - gap; }
  tip.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
  const a = $('tipArrow'), ax = clamp(r.left + r.width / 2 - x - 4, 8, w - 16), ay = clamp(r.top + r.height / 2 - y - 4, 8, h - 16);
  Object.assign(a.style, side === 'top' ? {left: ax + 'px', top: h - 4 + 'px'} : side === 'bottom' ? {left: ax + 'px', top: '-4px'} : side === 'right' ? {top: ay + 'px', left: '-4px'} : {top: ay + 'px', left: w - 4 + 'px'});
  el.setAttribute('aria-describedby', 'tip');
  requestAnimationFrame(() => tip.setAttribute('data-on', ''));
}
function tipHide() {
  clearTimeout(TIP.t);
  if (!TIP.el) return;
  TIP.el.removeAttribute('aria-describedby'); TIP.el = null; TIP.closedAt = Date.now();
  $('tip').hidden = true; $('tip').removeAttribute('data-on');
}
const tipTarget = t => t?.closest?.('[data-tip], [title], button[aria-label], a[aria-label]');
// T229 #1: on a touch screen, holding a mark with a tip (a row's agent) says it in a toast
document.addEventListener('pointerdown', e => {
  const el = e.pointerType !== 'mouse' && e.target.closest?.('#list [data-tip]');
  if (!el) return;
  const t = setTimeout(() => { hint(el.dataset.tip); const eat = ev => { ev.preventDefault(); ev.stopPropagation(); }; addEventListener('click', eat, {capture: true, once: true}); setTimeout(() => removeEventListener('click', eat, true), 600); }, 450);
  const stop = () => { clearTimeout(t); removeEventListener('pointerup', stop); removeEventListener('pointercancel', stop); removeEventListener('pointermove', move); };
  const move = ev => { if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > 8) stop(); };
  addEventListener('pointerup', stop); addEventListener('pointercancel', stop); addEventListener('pointermove', move);
});
document.addEventListener('pointerover', e => {
  if (!TIP.fine.matches || e.pointerType === 'touch') return;
  if (e.target.closest('#tip')) { clearTimeout(TIP.t); return; }  // on the tooltip itself: it stays
  const el = tipTarget(e.target);
  if (el === TIP.el) { clearTimeout(TIP.t); return; }
  if (!el || el === TIP.hush || e.buttons) { if (TIP.el) { clearTimeout(TIP.t); TIP.t = setTimeout(tipHide, 100); } return; }
  tipText(el);  // the browser's own tooltip must not start
  const quick = Date.now() - TIP.closedAt < 300 || !!TIP.el;
  clearTimeout(TIP.t);
  if (quick) { tipHide(); tipShow(el, true); } else TIP.t = setTimeout(() => tipShow(el, false), 500);
});
document.addEventListener('pointerout', e => {
  const to = e.relatedTarget;
  if (TIP.hush && !TIP.hush.contains(to)) TIP.hush = null;
  if (to && (to.closest?.('#tip') || (TIP.el && TIP.el.contains(to)))) return;
  clearTimeout(TIP.t);
  if (TIP.el) TIP.t = setTimeout(tipHide, 100);
});
document.addEventListener('focusin', e => { const el = tipTarget(e.target); if (TIP.fine.matches && el && e.target.matches(':focus-visible')) { tipHide(); tipShow(el, true); } });
document.addEventListener('focusout', () => tipHide());
document.addEventListener('pointerdown', e => { if (TIP.el || TIP.t) { TIP.hush = tipTarget(e.target); tipHide(); } }, true);  // you acted: no tooltip until you leave
document.addEventListener('scroll', () => tipHide(), true);
addEventListener('resize', () => tipHide());
addEventListener('resize', () => fitTabs());  // a phone turned sideways has room for every count (B158)
document.addEventListener('keydown', e => {
  if (!TIP.el && !TIP.t) return;
  tipHide();  // any key closes the tooltip; Esc also goes on to close what is below it (B122)
}, true);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (DR.open) return closeDrawer();
    if (!$('viewer').hidden) return ACT['v-close']();
    if (R.rec) return cancelRec();  // the recording first: it is what you are doing
    if (U.correct && !(document.activeElement === $('text') && $('text').value.trim() && desk())) return cancelCorrect();  // F144
    if (U.amend && !(document.activeElement === $('text') && $('text').value.trim() && desk())) return cancelAmend();  // B136
    if (U.prefsEdit && !(document.activeElement === $('text') && $('text').value.trim() && desk())) return cancelPrefs();  // F183
    if (U.doc && U.docCircle) { U.docCircle = false; return renderDoc(); }
    if (U.doc && (U.docQuote || U.docSel.size || U.docReply)) return ACT['doc-unpick']();  // first Escape drops the selection
    if (desk() && U.doc && !U.docEdit && $('overlay').hidden && D.full && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return fullWidth(false);  // one level: full width first (T113 B20)
    if (desk() && U.doc && !U.docEdit && $('overlay').hidden && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return closeDoc();  // then back to the item
    if (!$('overlay').hidden) return closeDialog();
    if (document.activeElement?.id === 'subTitle') {  // done adding subitems; a title you started is kept (T113 A15)
      const n = U.subFor, v = $('subTitle').value.trim();
      kept('subs', all => { if (v) all[n] = v; else delete all[n]; });
      if (v) toast(`Your subitem title is kept: ${desk() ? '⇧A' : 'Add'} brings it back`);
      U.subFor = null; return renderDetail();
    }
    if (U.editing) { stashEdit(); U.editing = null; return renderDetail(); }
    if (desk()) {
      if (D.compose && document.activeElement === $('text') && !$('text').value.trim() && !U.files.length) return leaveCompose();  // nothing to lose
      if (document.activeElement === $('q')) { if (U.q) clearSearch(); return $('q').blur(); }  // one Esc: no search, no filter (B122)
      if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return document.activeElement.blur();
      if (D.sideOpen) { D.sideOpen = false; return render(); }
      if (D.page) return ACT['project-back']();  // This project covers the filters and the item: it goes first (B162)
      if (D.filters) { D.filters = false; return render(); }  // the panel you opened last goes first (B122)
      if (U.go) return ACT['go-end']();
      if (D.full) return fullWidth(false);
      if (D.compose) return leaveCompose();
      if (U.q) return clearSearch();
      if (U.open && U.tab !== 'inputs') return closeItem();  // last: back to nothing selected, the box a new input again (F119)
      return;
    }
    if (U.open && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return ACT.back();
  }
  if (!$('viewer').hidden && e.key === 'ArrowLeft') ACT['v-prev']();
  if (!$('viewer').hidden && e.key === 'ArrowRight') ACT['v-next']();
  if (e.key === '/' && !desk() && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); if (!U.searching) ACT.search(); else $('q').focus(); }
  if (e.key === 'Escape' && (U.searching || U.q) && document.activeElement === $('q') && !desk()) searchMode(false);
});

document.addEventListener('keydown', e => { if (e.target.id === 'fixWord' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); ACT['fix-add'](); } });  // T256
document.addEventListener('keydown', async e => {  // Settings › Projects: Enter makes or saves, Esc stops (F173)
  const id = e.target.id;
  if (id !== 'pNewName' && id !== 'pRename') return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); ACT[id === 'pNewName' ? 'p-new-cancel' : 'p-rename-cancel'](); return; }
  if (e.key !== 'Enter' || e.isComposing) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (id === 'pNewName') return ACT['p-create']();
  saveRename(e.target);
}, true);
async function saveRename(f) {  // Enter, or Save on the phone: the new name, with Undo
  if (!f) return;
  const slug = f.dataset.slug, title = f.value.trim(), was = slug === S.project ? projTitle() : titleOf((P_CACHE.projects || []).find(p => p.name === slug) || {name: slug});
  if (!title || title === was) return ACT['p-rename-cancel']();
  try {
    U.renaming = null; await renameProject(slug, title);
    toast(`Renamed to ${title}`, () => renameProject(slug, was).then(() => toast(`Back to ${was}`), ex => toast(ex.message)));
  } catch (ex) { U.renaming = slug; renderProject(); if (desk()) renderProjBar(); toast(ex.message); const g = $('pRename'); if (g) { g.value = title; g.focus(); } }
}
document.addEventListener('keydown', e => {  // the new project field: Enter makes it, Esc stops (B131)
  if (e.target.id !== 'npName') return;
  if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); ACT['np-create'](); }
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); ACT['np-cancel'](); }
}, true);
$('q').addEventListener('keydown', e => {  // B130: from the search, Down or Enter goes to the first result
  if (!desk() || !(e.key === 'ArrowDown' || (e.key === 'Enter' && !e.isComposing))) return;
  const first = U.tab === 'inputs' ? null : document.querySelector('#list [data-act="open"][data-n]');
  e.preventDefault(); $('q').blur();
  if (first) openItem(Number(first.dataset.n));
});
$('q').addEventListener('input', e => { U.q = e.target.value; qSync(); writeURL(false); if (U.tab === 'inputs') { renderInputs(); phoneCounts(); } else { renderItems(); $('list').scrollTop = 0; } });
$('q').addEventListener('focus', () => { if (!desk() && !U.searching) searchMode(true); });  // a search that came with the address: in your hands now, Cancel or Back ends it (B152)
$('text').addEventListener('input', () => { saveDraft(); renderComposer(); grow(); });  // the buttons first: the mic showing up narrows the box
document.addEventListener('input', e => {
  const k = e.target.dataset?.docDraft, id = e.target.id;
  if (k) U.docDrafts[k] = e.target.value;
  if (id === 'docMd') { U.docText = e.target.value; const key = docKey(), v = U.docText.trim(), d = docById(U.doc); kept('docs', all => { if (v && v !== (d ? noteText(d).trim() : '')) all[key] = U.docText; else delete all[key]; }); }
  if (/^e(Title|Body|Next)$/.test(id)) keepItemEdit();  // T113 A6: the edit survives a reload or a switch of project
  if (id === 'subTitle' && U.subFor) { const n = U.subFor, v = e.target.value.trim(); kept('subs', all => { if (v) all[n] = v; else delete all[n]; }); }
});
document.addEventListener('keydown', e => {  // ⌘↵ (Ctrl+↵) saves the item you edit (T113 A6)
  if (/^e(Title|Body|Next)$/.test(e.target.id) && e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.isComposing && U.editing) {
    e.preventDefault(); ACT['edit-save']({dataset: {n: String(U.editing)}});
  }
});
addEventListener('beforeunload', e => {  // leaving with an edit or a document not saved: the browser asks first (T113 A6)
  const d = U.docEdit && docById(U.doc), md = ($('docMd')?.value || '').trim();
  if (editNow()?.changed || (U.docEdit && md && md !== (d ? noteText(d).trim() : ''))) { e.preventDefault(); e.returnValue = ''; }
});
// Selecting words in what a voice note became offers to correct them, in the one box (F144). The fix goes into
// that input and is remembered for every project's transcriptions.
document.addEventListener('selectionchange', () => {
  const sel = getSelection(), text = sel?.toString().replace(/\s+/g, ' ').trim();
  // A3: the selection went (a click elsewhere) before you wrote anything into the box: no more correcting, so the next
  // thing you write is not taken for the right words
  if (U.correct && U.correctSel && !text && !$('text').value.trim() && !$('composer').contains(document.activeElement)) { U.correctSel = false; return cancelCorrect(); }
  U.fixCand = null;
  if (!text || text.length > 60) return;
  const el = (sel.anchorNode?.nodeType === 1 ? sel.anchorNode : sel.anchorNode?.parentElement)?.closest('[data-voice]');
  const r = el && el.contains(sel.focusNode) && byR.get(el.dataset.voice);
  if (!r || !r.text.includes(text) || (U.correct?.id === r.id && U.correct.wrong === text)) return;
  U.fixCand = {id: r.id, wrong: text, v: r.v || 0};  // words of a voice note: Correct by the selection arms it (F204)
});
// Selecting text inside an open document offers to comment on exactly that text.
document.addEventListener('selectionchange', () => {
  if (!U.doc || U.docEdit || U.docCircle) return;
  const sel = getSelection(), text = sel?.toString().trim();
  if (!text || text.length < 2) return;  // a collapsed selection keeps the last quote until you comment or cancel
  const sec = (sel.anchorNode?.nodeType === 1 ? sel.anchorNode : sel.anchorNode?.parentElement)?.closest('#docBlocks > section[data-key]');
  if (!sec) return;
  U.docQuote = {key: sec.dataset.key, text: text.slice(0, 500)}; U.docSel = new Set(); U.docReply = null;
  renderDocBar();
});
document.addEventListener('selectionchange', () => vcPlace());  // F184: the button follows the selection
document.addEventListener('mouseup', e => { if (e.target.closest?.('#draftText')) setTimeout(draftFix); });  // I176
document.addEventListener('click', e => {  // I176: a word the model was not sure of: correct it with one click
  const u = e.target.closest?.('#draftText [data-unsure]');
  if (!u || U.fixEd) return;
  const r = document.createRange(); r.selectNodeContents(u); getSelection().removeAllRanges(); getSelection().addRange(r); draftFix();
});
$('boxView').addEventListener('click', e => { if (e.target.closest('button')) return; U.boxView = false; renderComposer(); $('text').focus(); });  // F186: plain text: back to typing
for (const t of ['pointerdown', 'mousedown']) $('vcBar').addEventListener(t, e => e.preventDefault());  // a press keeps the selection
document.addEventListener('scroll', () => { if (!$('vcBar').hidden) vcPlace(); }, true);
addEventListener('resize', () => vcPlace());
// Enter is a new line; Shift+Enter (or ⌘/Ctrl+Enter) sends. Not while an input method is still composing.
document.addEventListener('keydown', e => {  // Enter in the subitem box adds it
  if (e.target.id === 'subTitle' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); document.querySelector('[data-act="sub-add"]')?.click(); }
});
$('text').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing && (e.shiftKey || e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } });
$('text').addEventListener('paste', e => { const files = [...(e.clipboardData?.files || [])]; if (files.length) { e.preventDefault(); addFiles(files); } });
$('foot').addEventListener('dragover', e => e.preventDefault());  // on the New input page #foot is the whole pane
$('foot').addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files.length) addFiles([...e.dataTransfer.files]); });
$('fileInput').addEventListener('change', e => { addFiles([...e.target.files]); e.target.value = ''; });
const comeBack = () => { refresh(); checkOthers.t = 0; checkOthers(); resendOutbox(); };  // B129: the sidebar is fresh when you come back; B151: unsent inputs go
document.addEventListener('visibilitychange', () => { if (!document.hidden) comeBack(); });
window.addEventListener('focus', comeBack);
window.addEventListener('online', () => { refresh(); resendOutbox(); });
// The sheet sits above the input box; follow the box whenever it changes size (styles loading, keyboard, scope line).
new ResizeObserver(() => { if ($('overlay').dataset.above && !$('overlay').hidden) $('overlay').style.bottom = $('composer').parentElement.offsetHeight + 'px'; })
  .observe($('composer').parentElement);
window.addEventListener('pageshow', e => { if (e.persisted) refresh(); });
addEventListener('pagehide', () => {  // where you were in the list, for the reload (B152)
  if (desk() || !S.project) return;
  const top = U.open ? (U.listTop || [])[U.tab === 'inputs' ? 1 : 0] : tabScroll(U.tab).scrollTop;
  if (typeof top === 'number') U.tabTop[U.tab] = top;
  try { sessionStorage.setItem('taska.top.' + S.project, JSON.stringify(U.tabTop)); } catch (_) {}
});
// ---------------------------------------------------------------- the address (T102)
// The address says what you look at: /p/<project>/ is Items; /inputs /archive /rules a tab; /B03 an item; /D4 a
// document; /new the New input page; /agents /log /projects /phone /spellings … the sections of Settings, /settings their list
// (B162); ?q= and the filters ride along. The server sends the page for these when a browser asks, and text when an
// agent does (/connect and /log mean something to agents too). Changing tab, opening a document, a section of This
// project or New input, an item on the phone and full width are steps Back can undo, and so is a link to an item (B9);
// choosing items in the list on the desktop (a click, J/K), search and filters only rewrite the address.
const VIEW = /^(inputs|archive|rules|new-rule|new|settings|agents|connect|phone|notifications|spellings|log|deleted|about|projects|organizer)$/;
const URLS = {applying: false, selfBack: false, hold: false};  // hold: a link is on its way, its step is written once it is there
// Each page of Settings has its own address on the phone too (B150, B162): /settings is its list of sections there.
const viewPath = () => D.page ? (D.section ? PSEC[D.section][0] : 'settings') : U.doc && !U.docEdit ? `D${U.doc}` : desk() && D.compose ? (ruleMode() ? 'new-rule' : 'new')
  : desk() && U.tab === 'inputs' ? 'inputs' : U.open ? code(U.open) : U.tab === 'items' ? '' : U.tab;  // on the desktop Inputs hides the item
function viewQuery() {
  const q = new URLSearchParams();
  if (U.q) q.set('q', U.q);
  for (const k of ['type', 'when', 'status', 'pri']) if (U[k] && U[k] !== 'all') q.set(k, U[k]);
  const s = q.toString();
  return s ? '?' + s : '';
}
// Back on the phone (B150): every sheet, the Go through card, the image viewer, the projects drawer and search is one
// step in the history, as a document is, so Back closes what is on top and only that. The step keeps the address of
// the page under it (history.state.layers lists what is open over it), so nothing behind moves. Closed by its own
// button, a tap outside or a swipe, a layer takes its step back. Going back takes a moment: what wants to write the
// address meanwhile waits for it (hist), or it would land before the step and the step back would take it away.
const LAY = {back: 0, q: [], t: 0, at: '', popping: false};
const here = () => location.pathname + location.search;
function hist(fn) { if (LAY.back) LAY.q.push(fn); else { fn(); LAY.at = here(); } }
function histBack() {  // a step back the page takes itself: its popstate changes nothing
  LAY.back++; history.back();
  clearTimeout(LAY.t); LAY.t = setTimeout(histDone, 1500);  // no step to go back to: go on anyway
}
function histDone() {
  LAY.back = 0; clearTimeout(LAY.t);
  while (!LAY.back && LAY.q.length) LAY.q.shift()();
  LAY.at = here();
}
const layersNow = () => history.state?.layers || [];
const searchStep = () => !desk() && U.searching ? {layers: ['search']} : {};  // pages you open while searching keep the search open under them
function layerOpen(kind) {
  if (desk() || URLS.applying) return;
  hist(() => { if (!layersNow().includes(kind)) history.pushState({...(history.state || {}), layers: [...layersNow(), kind]}, '', location.href); });
}
function layerShut(kind) {  // closed by its own button: its step goes too
  if (desk() || LAY.popping) return;
  hist(() => {
    const l = layersNow();
    if (l.at(-1) === kind) histBack();
    else if (l.includes(kind)) history.replaceState({...history.state, layers: l.filter(k => k !== kind)}, '');
  });
}
function closeLayers() {  // Back: what is open but has no step any more closes, top first -> whether anything closed
  const keep = layersNow();
  let shut = false;
  LAY.popping = true;
  try {
    if (!$('viewer').hidden && !keep.includes('viewer')) { closeViewer(); shut = true; }
    if (!$('overlay').hidden && !U.doc && !keep.includes('sheet')) { closeDialog(); shut = true; }
    if (DR.open && !keep.includes('drawer')) { closeDrawer(); shut = true; }
    if (U.searching && !keep.includes('search')) { searchMode(false); shut = true; }
  } finally { LAY.popping = false; }
  return shut;
}
function writeURL(push = false, state) {
  if (URLS.applying || URLS.hold) return;
  hist(() => {
    const url = P + viewPath() + viewQuery(), now = location.pathname + location.search + location.hash;
    if (push && url !== now) history.pushState(state ?? {v: viewPath(), ...searchStep()}, '', url);
    else if (url !== now || state !== undefined) history.replaceState(state === undefined ? history.state : state, '', url);
  });
}
// A view you leave by Esc or ×: if it was a step in the history, step back (the page then rewrites the address to
// whatever shows by then, so an item opened in the same breath is kept); otherwise just rewrite the address. On the
// phone what writes the address waits for the step back instead (B150), so a step like an item's keeps its place.
function toList() {  // T268: Settings, full width or Inputs give way to the list
  if (!desk()) return;
  if (D.page) D.page = null;
  if (D.full) D.full = false;
  if (U.tab === 'inputs') return setTab('items');
  render(); writeURL(false);
}
function leaveView(v) {
  if (URLS.applying) return false;
  if (!desk()) { hist(() => { if (history.state?.v === v) histBack(); else writeURL(false); }); return true; }
  if (history.state?.v === v) { URLS.selfBack = true; history.back(); return true; }
  return false;
}
function readURL() {
  const seg = decodeURIComponent(location.pathname.slice(P.length)).replace(/\/$/, '');
  const old = location.hash.slice(1);  // links from before: #B03
  return {seg: seg || (parseRef(old) ? old : ''), qs: new URLSearchParams(location.search)};
}
// The tab an item lives in (an item outside the tab you are in opens there).
const tabOf = it => it.archived ? 'archive' : it.type === 'rule' ? 'rules' : 'items';
// B9: a step you leave keeps how far its page was scrolled, and Back puts it there again. The desktop redraws its lists
// as you go, so the browser can't; the Inputs page would otherwise jump to its end.
// On the phone the pages of Settings do the same (the list and the tabs keep their places their own way, B152).
const scroller = () => D.page ? (D.section || desk() ? $('projectBody') : $('projectNav')) : U.tab === 'inputs' ? $('inputsView') : $('list');
function keepPlace() {
  if (URLS.applying || URLS.hold || !(desk() || D.page)) return;
  const top = scroller().scrollTop, keep = () => history.replaceState({...history.state, top}, '');
  if (desk()) keep(); else hist(keep);  // after a step back that is on its way (B150)
}
function restorePlace() {
  const top = history.state?.top, el = (desk() || D.page) && typeof top === 'number' && scroller();
  if (el) requestAnimationFrame(() => { el.scrollTop = top; });  // after the Inputs page's own jump to its end
}
function applyURL() {  // the page follows the address: when it loads, and on Back / Forward
  URLS.applying = true;
  try { showURL(); } finally { URLS.applying = false; }
  restorePlace();
}
function showURL() {
  const {seg, qs} = readURL();
  U.q = qs.get('q') || ''; $('q').value = U.q;
  for (const k of ['type', 'when', 'status', 'pri']) U[k] = qs.get(k) || 'all';
  if (desk()) { D.full = !!history.state?.full; D.compose = false; }
  D.page = null;
  const doc = /^[Dd](\d+)$/.exec(seg), n = doc ? 0 : parseRef(seg);
  if (!doc && U.doc && !$('overlay').hidden) closeDialog();
  if (doc) { const d = docById(Number(doc[1])); if (d && !U.open && desk()) openItem(d.n, false); return openDoc(Number(doc[1])); }
  if (n && byN.has(n)) { U.tab = tabOf(byN.get(liveN(n))); return openItem(n, false); }  // a merged item: the one it went into (B5)
  closeItem();
  if (Object.hasOwn(PSEC_AT, seg)) {  // a page of Settings; /settings is Agents on the desktop, the list of sections on the phone
    if (desk()) { if (history.state?.tab) U.tab = history.state.tab; } else U.tab = history.state?.tab || 'items';  // Back into it from a tab (B9); on the phone, the tab its ‹ goes up to
    return openProject(seg === 'settings' && !desk() ? null : PSEC_AT[seg]);
  }
  if (seg === 'new-rule') { U.tab = 'rules'; U.asRule = null; }  // B10: New rule has its own address; a reload stays a rule
  else if (seg === 'new' && U.tab === 'rules') U.asRule = false;  // and New input stays an input
  if (seg === 'new' || seg === 'new-rule') { if (desk()) return ACT['new-input'](); render(); return $('text').focus(); }
  const was = U.tab;
  if (!desk()) U.tabTop[was] = tabScroll(was).scrollTop;  // Back or Forward to another tab: each keeps its place (B152)
  U.tab = /^(inputs|archive|rules)$/.test(seg) ? seg : 'items'; U.asRule = null; U.inputsEnd = seg === 'inputs' && typeof history.state?.top !== 'number';
  render();
  if (!desk() && U.tab !== was) tabScroll(U.tab).scrollTop = U.tabTop[U.tab] || 0;
}
window.addEventListener('popstate', () => {
  if (LAY.back) { if (--LAY.back === 0) histDone(); return; }  // a step the page took back itself (B150)
  if (URLS.selfBack) { URLS.selfBack = false; return writeURL(false, history.state?.full ? history.state : null); }  // our own step back
  if (!desk() && closeLayers() && here() === LAY.at) return writeURL(false);  // Back closed what was on top, and only that (B150); a closed search leaves the address too (B152)
  applyURL(); LAY.at = here();
});

$('logo').innerHTML = ico('menu', 'size-6');
$('drawerLogo').innerHTML = ico('logo', 'size-6', '2.25');
$('drawerNew').insertAdjacentHTML('afterbegin', ico('plus', 'size-5'));
$('sideBtn').innerHTML = ico('panel', 'size-[18px]');
$('newInputBtn').innerHTML = `${ico('newinput', 'size-4')}<span class="flex-1 text-left">New input</span>${KBD('C')}`;
$('searchBtn').innerHTML = ico('search', 'size-5.5');
$('searchIcon').innerHTML = ico('search', 'size-4.5');
$('qClear').innerHTML = ico('x', 'size-3', '3');
$('dlgClose').innerHTML = CLOSE_X;
$('vClose').innerHTML = ico('x');
$('backBtn').innerHTML = ico('left', 'size-6');
$('itemMenuBtn').innerHTML = ico('more', 'size-6');
U.draftKey = null; U.parked = {}; U.vcMarks = [];
try { U.oldDraft = localStorage.getItem('taska.draft') || ''; localStorage.removeItem('taska.draft'); } catch (_) {}
$('projName').textContent = decodeURIComponent(P.split('/')[2] || 'Taska');  // right away, before the data arrives
grow();
renderComposer();  // the box's buttons, before data arrives
// B190: before the data arrives the desktop already shows its frame where it will be: the sidebar (or the rail), the
// project's bar with its tabs, the list's head, the empty item pane and the box. The data then fills it; nothing moves.
// The phone's frame is the page as written. The tabs' counts are the ones this browser last saw, so the tabs keep their
// widths; a tab or filters in the address are read now too, as showURL does later. A page of Settings opened by its
// address shows its own frame: the column of sections and the page's head (the phone: the page's head).
const COUNTS = ['nItems', 'nInputs', 'nArchTab', 'nRules'], TABS = ['items', 'inputs', 'archive', 'rules'];
function keptCounts() { try { return JSON.parse(localStorage.getItem('taska.counts.' + HERE) || 'null'); } catch (_) { return null; } }
function shell() {
  const kept = keptCounts();
  if (kept) COUNTS.forEach((id, i) => { $(id).textContent = kept[i] ?? ''; });
  const {seg, qs} = readURL();
  if (Object.hasOwn(PSEC_AT, seg)) {  // a page of Settings: its frame, as openProject will draw it once the data is here
    const sec = PSEC_AT[seg];
    D.page = 'project'; D.section = seg === 'settings' && !desk() ? null : sec === 'connect' ? 'agents' : sec;
    if (desk()) { showDesk(); renderSidebar(); } else showView();
    return renderProject();
  }
  if (!desk()) return;
  U.q = qs.get('q') || ''; $('q').value = U.q;
  for (const k of ['type', 'when', 'status', 'pri']) U[k] = qs.get(k) || 'all';
  if (/^(inputs|archive|rules)$/.test(seg)) U.tab = seg;
  showDesk(); renderProjBar(); renderSidebar(); renderRail(); renderDeskHead(); renderFilters();
}
shell();
window.addEventListener('load', grow);  // a restored draft is measured again once styles are in
if ('serviceWorker' in navigator && isSecureContext) navigator.serviceWorker.register('/sw.js').catch(() => {});  // Taska can go on the Home Screen (F192)

load().then(() => {
  checkOthers();  // the other projects: the sidebar, and Move… on your inputs (A12)
  const {seg} = readURL(), n = /^[Dd]\d+$/.test(seg) ? 0 : parseRef(seg);  // D1 is a document, not item 1
  if (history.state?.layers) history.replaceState({...history.state, layers: undefined}, '');  // a sheet open before a reload is not open now (B150)
  if (n && byN.has(n) && !desk() && !history.state?.n) {  // a link to an item on the phone: put the list under it, so Back lands there
    history.replaceState(null, '', P + viewQuery()); history.pushState({n}, '', P + code(n) + viewQuery());
  }
  restoreGo();  // a walk you were on goes on after a reload (T113 B17)
  startGoFromAnotherProject();  // or one that came over from another project (F193)
  applyURL();
  if (!desk()) {  // a reload keeps your place in each tab of the list, as it keeps your drafts (B152)
    try { Object.assign(U.tabTop, JSON.parse(sessionStorage.getItem('taska.top.' + S.project) || '{}')); } catch (_) {}
    const top = U.tabTop[U.tab] || 0;
    if (U.open) U.listTop = U.tab === 'inputs' ? [U.tabTop.items || 0, top] : [top, U.tabTop.inputs || 0]; else tabScroll(U.tab).scrollTop = top;
  }
  writeURL(false);  // tidy the address: #B03 becomes /B03. Nothing is picked for you: the box is a new input until you open an item (F119)
  restoreOutbox();  // inputs that did not go out last time (B151)
  try {  // you deleted the project you were in: this is where you landed, and Undo brings it back (F173)
    const gone = JSON.parse(sessionStorage.getItem('taska.deleted') || 'null');
    if (gone) { sessionStorage.removeItem('taska.deleted'); toast(`Deleted ${gone.title}`, () => projectCall('restore', {name: gone.name}).then(() => location.assign(`/p/${encodeURIComponent(gone.name)}/`), ex => toast(ex.message))); }
  } catch (_) {}
  restoreVoice();  // voice notes that did not go out last time (T101)
  poll();
});
</script>
</body>
</html>
'''

INDEX, PAGE = INDEX.replace("__APP_HEAD__", APP_HEAD), PAGE.replace("__APP_HEAD__", APP_HEAD)  # F192
VERSION = hashlib.sha1(PAGE.encode()).hexdigest()[:10]  # open pages compare it and reload after an update

if __name__ == "__main__":
    main()
