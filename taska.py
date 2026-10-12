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
import base64
import hashlib
import hmac
import ipaddress
import json
import mimetypes
import os
import re
import secrets
import sys
import textwrap
import threading
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
PEOPLE = ("you", "org")  # the organizer writes down what the user said, so it acts for the user
KINDS = ("say", "ask", "block", "withdraw", "propose", "decide", "progress")
WORK_TYPES = ("bug", "feature", "task", "idea")  # what keep-going picks up
TEXT_VERBS = KINDS + ("title", "body", "next")
MAX_TEXT = 200_000
MAX_FILE = 25 * 1024 * 1024
MAX_OPS = 50
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
        kind = "list" if re.match(r"\s*([-*+]|\d+[.)])\s", line) else "quote" if line.lstrip().startswith(">") else "para"
        j = i + 1
        while j < len(lines) and lines[j].strip() and not lines[j].lstrip().startswith("```") and not re.match(r"#{1,6}\s", lines[j]):
            if kind == "para" and re.match(r"\s*([-*+]|\d+[.)])\s|\s*>", lines[j]):
                break
            j += 1
        out.append((kind, "\n".join(lines[i:j])))
        i = j
    return out


def block_key(text):
    return hashlib.sha1(" ".join(text.split()).encode("utf-8")).hexdigest()[:10]


# --------------------------------------------------------------------------- store


class Store:
    """All state, rebuilt by replaying the log. `apply` never validates; `run` does."""

    def __init__(self, path):
        self.path = os.path.abspath(path)
        self.fdir = os.path.splitext(self.path)[0] + "-files"
        self.lock = threading.RLock()
        self.cond = threading.Condition(self.lock)
        self.items, self.inputs, self.events = {}, {}, []
        self.rev = 0  # bumps on every change, including transient organizer state
        self.boot = format(int(time.time() * 1000), "x")  # rev restarts with the process; boot tells pages apart
        self.maxn = self.nin = self.nfile = 0
        self.cfg = {"auto": True}  # auto = keep-going: agents keep taking the next item (on unless turned off)
        self.docs, self.maxd = {}, 0
        self.org_on, self.org_busy = False, None
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
            it = self.items.get(inp["scope"])
            if it:
                self.entry(it, e, "say", inp["text"], inp["id"])
                self.touch(it["n"], inp["id"], ack=False)
        elif k == "add":
            n = e["n"]
            self.maxn = max(self.maxn, n)
            self.items[n] = {"n": n, "type": e["type"], "title": e["title"], "body": e.get("body", ""),
                             "pri": e["pri"], "when": e["when"], "status": e["status"], "parent": e.get("parent"),
                             "next": e.get("next", ""), "thread": [], "srcs": [], "merged_into": None, "archived": False,
                             "t0": e["t"], "t1": e["t"]}
            self.touch(n, e.get("src"), ack=not e.get("keep"))
        elif k == "set":
            it = self.items[e["n"]]
            it.update(e["f"])
            it["t1"] = e["t"]
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
        elif k == "undo":
            self.undo(e)
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
                inp["org"] = None if e.get("retry") else {"ok": e["ok"], "msg": e["msg"], "t": e["t"], "keep": e.get("keep", "Left for your coding agent" in e["msg"])}
        elif k == "cfg":
            self.cfg.update(e["f"])
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
            self.docs[e["d"]]["comments"].append({"id": e["seq"], "key": e["key"], "quote": e["quote"], "text": e["text"], "by": e["by"], "t": e["t"]})

    def undo(self, e):
        """Revert the organizer's changes for input e["src"]; fields changed again since stay as they are."""
        rid = e["src"]
        for x in [x for x in self.events if x.get("src") == rid and x.get("by") == "org"]:
            k = x["k"]
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

    def emit(self, e):
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
            if c["key"] not in keys:
                detached.setdefault(c["key"], {"key": c["key"], "quote": c["quote"], "comments": []})["comments"].append(c)
        return blocks, list(detached.values())

    def doc_open(self, d):
        """Threads whose last word is the user's: the agent should answer them."""
        last = {}
        for c in d["comments"]:
            last[c["key"]] = c["by"]
        return sum(1 for by in last.values() if by == "you")

    def doc_text(self, d):
        blocks, detached = self.doc_view(d)
        titled = blocks and " ".join(blocks[0]["text"].lstrip("#").split()) == d["title"]
        out = [f"D{d['d']} on {self.code(d['n'])}{'' if titled else ': ' + d['title']}  (updated {hm(d['t1'])} by {d['by']}; reply with: D{d['d']} reply ¶N <text>)"]
        for i, b in enumerate(blocks, 1):
            out.append(f"¶{i} " + b["text"].replace("\n", "\n   "))
            for c in b["comments"]:
                part = "" if " ".join(c["quote"].split()) == " ".join(b["text"].split()) else f"on \"{first_line(c['quote'], 120)}\": "
                out.append(f"   > {c['by']} {hm(c['t'])}: {part}{c['text']}")
        if detached:
            out.append("comments whose paragraph was rewritten or removed:")
            for t in detached:
                out.append(f"   on \"{first_line(t['quote'], 80)}\"")
                for c in t["comments"]:
                    out.append(f"   > {c['by']} {hm(c['t'])}: {c['text']}")
        return "\n".join(out) + "\n"

    @staticmethod
    def waiting(it):
        """The open ask/block an agent posted that the user has not answered yet."""
        for x in reversed(it["thread"]):
            if x["by"] == "you" or x["kind"] == "withdraw":
                return None
            if x["kind"] in ("ask", "block"):
                return x
        return None

    @staticmethod
    def replied(it):
        """The user wrote after an agent's last word on this item: the agent should pick it up."""
        user = False
        for x in reversed(it["thread"]):
            if x["by"] == "org":
                continue
            if x["by"] != "you":
                return user
            user = True
        return False

    def for_agent(self):
        """Inputs a coding agent should handle (the organizer, when on, sees them first)."""
        return [i for i in self.pending() if (not self.org_on or i["org"]) and not (i["org"] or {}).get("undone")]  # undone: parked until the user asks again

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

    def next_text(self, ref=None):
        """-> (text, has_work)"""
        auto = self.cfg["auto"]
        out = [self.mode() + (": keep working without stopping. After each item, write back, then GET /next again."
                              if auto else ": finish what you are doing, write back, then stop and wait for the user.")]
        if self.rules():
            out.append(f"{len(self.rules())} project rule{'s' if len(self.rules()) != 1 else ''}: read GET /rules once per session and follow those that apply.")
        live = self.sorted(i for i in self.active() if i["status"] not in CLOSED)
        for label, rows in (("waiting on the user (skip)", [i for i in live if self.waiting(i)]),
                            ("proposed, the user has not approved yet (skip)", [i for i in live if i["status"] == "proposed"]),
                            ("in review, the user accepts them (skip)", [i for i in live if i["status"] == "review"])):
            if rows:
                out.append(f"{label}: " + " ".join(self.code(i["n"]) for i in rows))
        inbox = self.for_agent()
        if inbox:
            return "\n".join(out) + f"\nfirst handle the inbox ({len(inbox)}):\n" + "".join(self.input_card(i, ref) + "\n" for i in sorted(inbox, key=lambda i: int(i["id"][1:]))), True
        docs = [d for d in self.docs.values() if self.doc_open(d) and self.items.get(d["n"]) and not self.items[d["n"]]["merged_into"]]
        if docs:
            d = min(docs, key=lambda d: d["t1"])
            return "\n".join(out) + f"\nanswer the user's comments on D{d['d']} (GET /D{d['d']}):\n" + self.doc_text(d), True
        back = sorted((i for i in live if self.replied(i)), key=lambda i: i["t1"])
        if back:
            return "\n".join(out) + f"\nresume {self.code(back[0]['n'])}: the user replied\n" + self.card(back[0], ref), True
        queue = sorted((i for i in live if i["when"] == "now" and i["type"] in WORK_TYPES and i["status"] in ("open", "doing") and not self.waiting(i)
                        and not self.open_kids(i)),  # subitems first: the parent comes when they are finished
                       key=lambda i: (i["status"] != "doing", i["pri"], i["n"]))  # same priority: oldest first
        if queue:
            it = queue[0]
            how = ("\nan idea: think it through first. Small and clear: do it. Bigger, or more than one way to go: "
                   f"post your plan ({self.code(it['n'])} propose ...) and ask before building.") if it["type"] == "idea" else ""
            return "\n".join(out) + f"\nnext {self.code(it['n'])} ({len(queue)} in queue: doing first, then P0→P3, oldest first){how}\n" + self.card(it, ref), True
        idle = "nothing to do now." + (" Wait for work: GET /next?wait=540 (returns as soon as something comes in)." if auto else "")
        return "\n".join(out) + "\n" + idle + "\n", False

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
            if waiting or now - self.saved > 60:
                self.saved = now
                try:
                    with open(self.agents_file, "w", encoding="utf-8") as f:
                        json.dump({k: v["t"] for k, v in self.agents.items()}, f)
                except OSError:
                    pass

    def presence(self):
        """What the page shows about agents: who came when, who waits now, and whether work is waiting for them."""
        return {"agents": [{"name": k, "t": int(v["t"] * 1000), "waiting": v["waiting"] > 0} for k, v in self.agents.items()],
                "work": bool(self.cfg["auto"] and self.next_text()[1])}

    def active(self):
        return [i for i in self.items.values() if not i["merged_into"]]

    def open_kids(self, it):
        """Subitems not finished yet (any depth): a parent is done when they are."""
        out, todo = [], [it["n"]]
        while todo:
            n = todo.pop()
            for k in self.items.values():
                if k["parent"] == n and not k["merged_into"]:
                    todo.append(k["n"])
                    if k["status"] not in CLOSED:
                        out.append(k)
        return out

    def sorted(self, items):
        return sorted(items, key=lambda i: (i["when"] != "now", i["pri"], i["n"]))  # same priority: oldest first

    def pending(self):
        return [i for i in self.inputs.values() if not i["acked"]]

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

    def run(self, op, by, ctx):
        """Validate and apply one op. Returns (result line, label) or raises Err."""
        name, src = op.get("op"), op.get("src") or ctx.get("src")
        keep = {"keep": True} if ctx.get("keep") else {}  # linked to src, but src stays unhandled
        if src and src not in self.inputs:
            raise Err(f"unknown input {src}")
        if name == "input":
            text = str(op.get("text") or "").strip()[:MAX_TEXT]
            files = []
            for f in op.get("files") or []:
                fid = os.path.basename(str(f.get("f", "")))
                if not os.path.isfile(os.path.join(self.fdir, fid)):
                    raise Err(f"unknown file {fid}")
                files.append({k: f[k] for k in ("f", "name", "mime", "size", "tr") if k in f})
                files[-1]["f"] = fid
            if not text and not files:
                raise Err("empty input")
            scope = self.item(op["scope"], follow=False)["n"] if op.get("scope") else None
            rid = f"r{self.nin + 1}"
            e = {"k": "in", "id": rid, "by": by, "text": text, "scope": scope, "files": files}
            if op.get("from") == "rules":
                e["from"] = "rules"
            self.emit(e)
            return f"ok {rid}", "Received"
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
                return f"ok D{d['d']} updated", f"Updated D{d['d']}"
            it = self.item(op.get("ref", ""), ctx)
            dn = self.maxd + 1
            self.emit({"k": "doc", "d": dn, "n": it["n"], "title": title, "md": md, "by": by})
            return f"ok D{dn} new on {self.code(it['n'])}", f"Wrote D{dn}"
        if name == "dc":  # a comment on one paragraph of a document
            d = self.doc(op.get("d"))
            blocks = md_blocks(d["md"])
            if op.get("para"):
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
            body = str(op.get("text", "")).strip()[:MAX_TEXT]
            if not body:
                raise Err("empty comment")
            quote = " ".join(str(op.get("quote") or "").split()) or text_  # what the user selected, else the paragraph
            self.emit({"k": "dc", "d": d["d"], "key": key, "quote": quote[:500], "text": body, "by": by})
            return f"ok D{d['d']} comment", f"Commented on D{d['d']}"
        if name == "cfg":
            f = {"auto": bool(op["auto"])} if "auto" in op else {}
            if not f:
                raise Err("cfg needs auto")
            self.emit({"k": "cfg", "f": f, "by": by})
            return f"ok {self.mode()}", ""
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
            self.emit({"k": "set", "n": it["n"], "by": by, "f": f, "was": was, "src": src, **keep})
            return f"ok {code} " + " ".join(f"{k}={v}" if k in ("pri", "when", "status", "type", "parent", "archived") else k for k, v in f.items()) + note, "Updated " + code
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
                    raise Err(f"unknown file {fid}: upload it first with POST /api/file?name=<name>")
                files.append({"f": fid, "name": fid.split("-", 1)[-1], "mime": mimetypes.guess_type(fid)[0] or "application/octet-stream"})
            self.emit({"k": "say", "n": it["n"], "by": by, "kind": kind, "text": text, "src": src, **({"files": files} if files else {}), **keep})
            return f"ok {code} {kind}", {"ask": "Asked on ", "block": "Blocked on ", "decide": "Decided on "}.get(kind, "Noted on ") + code
        if name == "merge":
            into = self.item(op.get("into", ""), ctx)
            if into["n"] == it["n"]:
                raise Err("cannot merge into itself")
            self.emit({"k": "merge", "n": it["n"], "into": into["n"], "by": by, "src": src, **keep})
            return f"ok {code} merged into {self.code(into['n'])}", f"Merged {code}"
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
            items = []
            for it in self.items.values():
                d = dict(it)
                d["code"] = self.code(it["n"])
                w = self.waiting(it)
                d["wait"] = {"id": w["id"], "kind": w["kind"], "text": w["text"], "by": w["by"], "files": w.get("files", [])} if w else None
                d["reply"] = self.replied(it)
                items.append(d)
            return {"rev": self.rev, "boot": self.boot, "pv": self.pv, **self.presence(), "width": len(str(self.maxn)), "file": home_short(self.path), "cfg": self.cfg,
                    "org": {"on": self.org_on, "model": MODEL, "busy": self.org_busy},
                    "items": items, "inputs": list(self.inputs.values()),
                    "docs": [dict(d, blocks=self.doc_view(d)[0], detached=self.doc_view(d)[1], open=self.doc_open(d)) for d in self.docs.values()]}

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
                out.append(f"#{x['id']} {hm(x['t'])} {tag}: {x['text']}" + "".join(f" [{(ref or self.local)(f['f'])}]" for f in x.get("files", [])))
        return "\n".join(out) + "\n"

    def input_card(self, inp, ref=None):
        ref = ref or self.local
        scope = f" →{self.code(inp['scope'])} {self.items[inp['scope']]['title']}" if inp["scope"] else ""
        head = f"{inp['id']} {hm(inp['t'])} {inp['by']}{scope}" + ("" if not inp["acked"] else " [handled]")
        out = [head]
        if inp["text"]:
            out.append(textwrap.indent(inp["text"], "  "))
        if inp["files"]:
            out.append("  files: " + " ".join(ref(f["f"]) for f in inp["files"]))
        if inp["org"]:
            out.append(f"  organizer: {inp['org']['msg']}")
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
                s = f"{self.code(e['n'])} " + ", ".join(f"{a} {first_line(e['was'].get(a, ''), 24)}→{first_line(b, 24)}" for a, b in e["f"].items())
            elif k == "say":
                s = f"{self.code(e['n'])} {e['kind']} {first_line(e['text'])!r}"
            elif k == "merge":
                s = f"{self.code(e['n'])} merged into {self.code(e['into'])}"
            elif k == "ack":
                s = "ack " + " ".join(e["ids"])
            elif k == "cfg":
                s = "keep-going " + ("ON" if e["f"].get("auto") else "OFF")
            elif k == "doc":
                s = f"doc D{e['d']} on {self.code(e['n'])} {first_line(e.get('title', ''))!r}"
            elif k == "dc":
                s = f"D{e['d']} comment {first_line(e['text'])!r}"
            elif k == "undo":
                s = f"undo organizer changes for {e['src']}"
            elif k == "moved":
                s = f"{e['src']} moved to {e['to']} as {e['as']}"
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
  new [feature|bug|idea|task|rule] [P0-P3] [now|later] [parent=B03] [src=r12] <title>
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
      Big items have subitems (parent=B03): /next gives you the subitems first and the parent once they are
      finished; split big work the same way with `new ... parent=B03`.
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


ATTR = re.compile(r"(?i)(?:(?P<kv>(?:src|parent|pri|when|status|type|files)=\S+)|(?P<pri>P[0-3])|(?P<when>now|later)"
                  r"|(?P<st>open|doing|review|done|drop|dropped)|(?P<type>feature|bug|idea|task|rule)|(?P<arch>archive|unarchive))(?=\s|$)")


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


def gemini(system, parts, think=0, temperature=0.2, timeout=120, field=None, hint=""):
    """field: answer as JSON {field: "..."} (hint describes it) and return that string; keeps prefaces and notes out."""
    body = {"contents": [{"role": "user", "parts": parts}],
            "generationConfig": {"temperature": temperature, "thinkingConfig": {"thinkingBudget": think}}}
    if field:
        body["generationConfig"].update(responseMimeType="application/json", responseSchema={
            "type": "OBJECT", "properties": {field: {"type": "STRING", "description": hint}}, "required": [field]})
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    for attempt in range(3):
        req = urllib.request.Request(
            f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
            data=json.dumps(body).encode(), headers={"x-goog-api-key": api_key(), "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = json.load(r)
            parts_out = (data.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
            text = "".join(p.get("text", "") for p in parts_out if not p.get("thought")).strip()
            if field:
                try:
                    return str(json.loads(text).get(field) or "").strip()
                except (ValueError, AttributeError):
                    raise Err("Gemini answered in an unexpected format")
            return text
        except urllib.error.HTTPError as ex:
            detail = ex.read().decode("utf-8", "replace")
            if ex.code == 400 and "hinking" in detail and "thinkingConfig" in body["generationConfig"]:
                del body["generationConfig"]["thinkingConfig"]  # model without a thinking switch
                continue
            if ex.code in (429, 500, 502, 503, 504) and attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            raise Err(f"Gemini HTTP {ex.code}: {first_line(detail, 160)}")
        except (urllib.error.URLError, TimeoutError) as ex:
            if attempt < 2:
                time.sleep(2)
                continue
            raise Err(f"Gemini unreachable: {ex}")
    raise Err("Gemini failed")


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
- If it is new, `new <type> [P0-P3] [now|later] <short title>` with the user's own wording as the body.
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
                    todo = [i for i in s.pending() if not i["org"]]  # org is set (and logged) once tried
                    if todo:
                        break
                    s.cond.wait(timeout=30)
                inp = min(todo, key=lambda i: int(i["id"][1:]))
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
        out.append(f"New input {inp['id']} at {hm(inp['t'])}{scope}:\n{inp['text'] or '(no text)'}")
        return "\n\n".join(out)

    def process(self, inp):
        s, t0 = self.s, time.time()
        with s.lock:  # writes may land while we build the prompt
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
            if err:
                s.emit({"k": "org", "src": inp["id"], "ok": False, "msg": err, "by": "org"})
                return
            keep = bool(re.search(r"(?im)^\s*pass\s*$", plan))
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
            s.emit({"k": "org", "src": inp["id"], "ok": not bad, "msg": msg, "plan": plan, "keep": keep, "ms": int((time.time() - t0) * 1000), "by": "org"})


def transcribe(store, data, mime, scope):
    """Voice note -> text, biased toward the project's own vocabulary."""
    with store.lock:
        words = Counter()
        pool = [store.items[scope]] if scope in store.items else []
        pool += [i for i in store.sorted(store.active()) if i["status"] in ("open", "doing")][:80]
        for it in pool:
            words.update(re.findall(r"[A-Za-z_][\w./\-]{2,}", it["title"] + " " + it["body"]))
        titles = [it["title"] for it in pool[:40]]
    prompt = ("Transcribe this voice note verbatim. The speaker mixes Chinese and English while talking about software work. "
              "Write code identifiers, file paths, commands and product names the way they are normally written "
              "(Codex, pytest, tests/test_export.py). Do not summarize, translate or tidy the wording. "
              "Write Chinese in Simplified characters. If a word is unclear, give your best guess followed by (?). "
              "Put only the spoken words in transcript: no preface, notes or timestamps.\n"
              "Terms from the project (prefer these spellings): " + ", ".join(w for w, _ in words.most_common(60)) +
              "\nRelated item titles: " + "; ".join(titles))
    # The model drifts into Traditional characters unless told so in Chinese, in the schema itself. The source stays
    # free of Chinese (R66), so the two Chinese strings are escaped. They say: "You transcribe speech. Always write
    # Chinese in Simplified characters, never Traditional." and "Transcribe word for word, Chinese in Simplified".
    return gemini("\u4f60\u662f\u8bed\u97f3\u8f6c\u5199\u5458\u3002\u4e2d\u6587\u4e00\u5f8b\u7528\u7b80\u4f53\u5b57\u4e66\u5199\uff0c\u7edd\u4e0d\u7528\u7e41\u4f53\u5b57\u3002",
                  [{"text": prompt}, {"inline_data": {"mime_type": mime.split(";")[0], "data": base64.b64encode(data).decode()}}], think=0, field="transcript",
                  hint="\u9010\u5b57\u8f6c\u5199\uff0c\u4e2d\u6587\u7528\u7b80\u4f53\u5b57")


# --------------------------------------------------------------------------- http

HUB = None
ITEM_PATH = re.compile(r"/([A-Za-z]?\d+)")
NAME = re.compile(r"[a-z0-9][a-z0-9-]{0,39}")

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


class Hub:
    """Projects: one folder each under the data root, holding taska.jsonl and its files."""

    def __init__(self, root, organizer, public=""):
        self.root = os.path.abspath(os.path.expanduser(root))
        self.organizer = organizer
        self.public = public.rstrip("/")  # the tunnel's address, for the phone link
        self.lock = threading.Lock()
        self.projects = {}
        os.makedirs(self.root, exist_ok=True)
        try:
            with open(os.path.join(self.root, "key"), encoding="utf-8") as f:
                self.key = f.read().strip()
        except FileNotFoundError:
            self.new_key()
        for name in sorted(os.listdir(self.root)):
            if NAME.fullmatch(name) and os.path.isfile(os.path.join(self.root, name, "taska.jsonl")):
                self.open(name)
        if not self.projects:
            self.add("default")

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
        if s.org_on:
            Organizer(s).start()
        self.projects[name] = s
        return s

    def add(self, name):
        name = str(name).strip().lower()
        if not NAME.fullmatch(name):
            raise Err("a project name uses a-z, 0-9 and -, up to 40 characters")
        with self.lock:
            if name in self.projects:
                raise Err(f"project {name} already exists")
            os.makedirs(os.path.join(self.root, name), exist_ok=True)
            return self.open(name)

    def summary(self):
        out = []
        for name, s in sorted(self.projects.items()):
            with s.lock:
                live = [i for i in s.active() if i["status"] not in CLOSED]
                out.append({"name": name, "open": sum(1 for i in live if i["type"] != "rule"), "auto": s.cfg["auto"],
                            "needs": sum(1 for i in live if s.waiting(i) or i["status"] in ("proposed", "review")), **s.presence(),
                            "t": int(os.path.getmtime(s.path) * 1000)})
        return out


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "Taska"

    def log_message(self, *args):
        pass

    def send(self, code, body, ctype="text/plain; charset=utf-8", extra=None):
        if isinstance(body, str):
            body = body.encode("utf-8")
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
            if not s:
                raise Err(f"no project {m.group(1)}. Projects: {', '.join(sorted(HUB.projects))}")
            return s, m.group(2) or "", f"{self.host()}{self.prefix}/p/{s.name}"
        if len(HUB.projects) == 1:
            s = next(iter(HUB.projects.values()))
            return s, p, f"{self.host()}{self.prefix}/p/{s.name}"
        raise Err("which project? Use one of: " + "  ".join(f"{self.host()}/p/{n}" for n in sorted(HUB.projects)))

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
            if p == "/health":
                return self.json({"status": "ok", "app": "taska", "projects": len(HUB.projects)})
            if p == "/skill":
                return self.send(200, SKILL, "text/markdown; charset=utf-8")
            if p == "/api/projects":
                return self.json(HUB.summary())
            s, sub, base = self.project(p)
            if sub == "":
                return self.redirect(p + "/")
            self.get(s, sub, q, base)
        except Err as ex:
            self.send(404, f"{ex}\n")

    def get(self, s, p, q, base):
        ref = self.fileref(s)
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
                    text, work = s.next_text(ref)
                    while not work and s.cfg["auto"] and time.time() < end:
                        s.cond.wait(timeout=end - time.time())
                        text, work = s.next_text(ref)
            finally:
                if q.get("wait"):
                    s.saw((q.get("by") or ["agent"])[0], -1)
            self.send(200, text)
        elif p == "/rules":
            with s.lock:
                self.send(200, s.rules_text())
        elif p == "/connect":
            self.send(200, CONNECT.format(name=s.name, base=base, host=self.host() + self.prefix))
        elif p == "/inbox":
            with s.lock:
                self.send(200, s.inbox(ref))
        elif p == "/items":
            with s.lock:
                self.send(200, s.listing(q))
        elif p == "/log":
            with s.lock:
                self.send(200, s.log(int((q.get("n") or ["30"])[0])))
        elif p == "/api/state":
            self.json(dict(s.state(), project=s.name, base=base, key=HUB.key,
                           remote=f"{HUB.public}/k/{HUB.key}/p/{s.name}" if HUB.public else ""))
        elif p == "/api/poll":
            rev, boot, pv = int((q.get("rev") or ["0"])[0]), (q.get("boot") or [""])[0], int((q.get("pv") or ["-1"])[0])
            with s.cond:
                s.cond.wait_for(lambda: s.rev != rev or (boot and boot != s.boot) or (pv >= 0 and pv != s.pv), timeout=25)
                self.json({"rev": s.rev, "boot": s.boot, "pv": s.pv, "ver": VERSION})
        elif p.startswith("/f/"):
            self.serve_file(s, os.path.basename(p[3:]))
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
                    self.send(200, s.card(s.item(ref_, follow=False), ref))
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
        if not self.guard():
            return
        u = self.url()
        q, p = parse_qs(u.query), unquote(u.path)
        try:
            if p == "/api/projects":
                s = HUB.add(json.loads(self.body(10_000) or b"{}").get("name", ""))
                return self.json({"ok": True, "name": s.name})
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
            self.send(200, "\n".join(lines) + f"\nrev {s.rev} · {s.mode()}: {tail}\n")
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
            if q.get("transcribe") and mime.startswith("audio/"):
                try:
                    scope = s.item((q.get("scope") or [""])[0], follow=False)["n"] if q.get("scope") else None
                    f["tr"] = transcribe(s, data, (self.headers.get("Content-Type") or mime), scope)
                except Exception as ex:
                    f["tr_error"] = str(ex)
            self.json(f)
        elif p == "/api/undo":
            rid = (json.loads(self.body(10_000) or b"{}")).get("id")
            with s.cond:
                inp = s.inputs.get(rid)
                if not inp or not inp["org"] or inp["org"].get("undone"):
                    raise Err(f"nothing to undo for {rid}")
                s.emit({"k": "undo", "src": rid, "by": "you"})
            self.json({"ok": True})
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
                s.emit({"k": "org", "src": rid, "retry": True, "by": "you"})
            self.json({"ok": True})
        else:
            self.send(404, "not found\n")


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


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
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


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
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.3/dist/index.global.js" integrity="sha384-2ql948lIdLcGEE0/qxNiudyTjgauA3RDJERu5xW75kFCvSl5a9odyQYCb6tEjnmB" crossorigin="anonymous"></script>
</head>
<body class="min-h-dvh bg-zinc-100 text-zinc-900 antialiased dark:bg-zinc-900 dark:text-zinc-100">
<main class="mx-auto max-w-3xl px-2 pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
  <h1 class="flex h-14 items-center gap-2 px-3 text-xl font-semibold tracking-tight"><svg class="size-6 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/></svg>Taska</h1>
  <h2 class="px-3 pb-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Projects</h2>
  <ul id="list" class="flex flex-col gap-0.5"><li class="px-3 py-3 text-sm text-zinc-500">Loading…</li></ul>
  <button id="new" class="mt-1 flex h-12 w-full items-center gap-3 rounded-2xl px-3 text-[15px] font-medium text-blue-600 dark:text-blue-400"><svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>New project</button>
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
  if (a && (a.waiting || m < 10)) return `${dot('bg-emerald-500')}<span class="text-emerald-700 dark:text-emerald-400">${name} ${a.waiting ? 'ready' : '· ' + ago}</span>`;
  if (p.work) return `${dot('bg-red-500')}<span class="text-red-600 dark:text-red-400">No agent${a ? ' · ' + ago : ''}</span>`;
  return `${dot('bg-zinc-300 dark:bg-zinc-600')}<span>${a ? `${name} · ${ago}` : 'No agent yet'}</span>`;
}
async function load() {
  const list = (await (await fetch('/api/projects', {cache: 'no-store'})).json()).sort((a, b) => b.t - a.t);
  document.getElementById('list').innerHTML = list.map(p => `<li><a href="/p/${encodeURIComponent(p.name)}/" class="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-zinc-900/5 active:bg-zinc-50 dark:bg-zinc-800 dark:ring-white/5 dark:active:bg-zinc-700">
    <span class="min-w-0 flex-1"><span class="block truncate text-[17px] font-medium">${esc(p.name)}</span><span class="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">${agentLine(p)}<span class="shrink-0">· ${p.open} open · ${when(p.t)}${p.auto ? '' : ' · keep-going off'}</span></span></span>
    ${p.needs ? `<span class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">${p.needs} need you</span>` : ''}
    <svg class="size-4 shrink-0 text-zinc-300 dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></a></li>`).join('');
}
document.getElementById('new').addEventListener('click', async () => {
  const name = (prompt('Project name (a-z, 0-9 and -):') || '').trim().toLowerCase();
  if (!name) return;
  const d = await (await fetch('/api/projects', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name})})).json();
  if (d.ok) location.href = `/p/${d.name}/`; else alert(d.error || 'Not created');
});
load();
addEventListener('pageshow', e => { if (e.persisted) load(); });  // back from a project: fresh counts
</script>
</body>
</html>
'''

PAGE = r'''<!doctype html>
<html lang="en" class="overflow-hidden">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
<meta name="color-scheme" content="light dark">
<title>Taska</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%232563eb' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M13 5h8M13 12h8M13 19h8M3 17l2 2 4-4M3 7l2 2 4-4'/%3E%3C/svg%3E">
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.3/dist/index.global.js" integrity="sha384-2ql948lIdLcGEE0/qxNiudyTjgauA3RDJERu5xW75kFCvSl5a9odyQYCb6tEjnmB" crossorigin="anonymous"></script>
</head>
<body class="h-dvh overflow-hidden bg-white text-zinc-900 antialiased lg:flex dark:bg-zinc-950 dark:text-zinc-100">
<nav id="drawer" hidden aria-label="Projects" class="fixed top-0 left-0 flex h-dvh w-80 max-w-[85vw] flex-col bg-zinc-100 pt-[env(safe-area-inset-top)] pb-[max(1rem,env(safe-area-inset-bottom))] lg:z-40 lg:w-60 lg:max-w-none lg:shrink-0 lg:border-r lg:border-zinc-200 lg:bg-zinc-50 lg:pb-0 2xl:w-64 dark:bg-zinc-900 dark:lg:border-zinc-800">
  <div class="flex h-14 shrink-0 items-center gap-2 px-5 lg:pr-2 lg:pl-4"><span id="drawerLogo" class="text-blue-600 dark:text-blue-400"></span><span class="text-xl font-semibold tracking-tight lg:text-[19px]">Taska</span>
    <button data-act="side" id="sideBtn" title="Hide the sidebar · [" aria-label="Hide the sidebar" class="ml-auto hidden size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-200/70 lg:grid dark:text-zinc-400 dark:hover:bg-zinc-800"></button></div>
  <button data-act="new-input" id="newInputBtn" title="New input to the project · C" aria-pressed="false" class="mx-2.5 mb-3 hidden h-9 shrink-0 items-center gap-2 rounded-xl bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm ring-1 ring-zinc-900/10 hover:bg-zinc-50 lg:flex aria-pressed:bg-blue-50 aria-pressed:text-blue-700 aria-pressed:ring-blue-500/40 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/10 dark:hover:bg-zinc-700 dark:aria-pressed:bg-blue-400/10 dark:aria-pressed:text-blue-300 dark:aria-pressed:ring-blue-400/40"></button>
  <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 lg:pb-3">
    <div class="px-3 pb-1.5 text-xs font-semibold text-zinc-500 lg:text-[11px] lg:tracking-wider lg:uppercase dark:text-zinc-400">Projects</div>
    <div id="drawerList" class="flex flex-col gap-0.5"></div>
    <button data-act="new-project" id="drawerNew" class="mt-1 flex h-12 w-full items-center gap-3 rounded-2xl px-3 text-[15px] font-medium text-blue-600 lg:h-9 lg:rounded-xl lg:text-sm dark:text-blue-400">New project</button>
    <div class="mt-4 px-3 pb-1.5 text-xs font-semibold text-zinc-500 lg:text-[11px] lg:tracking-wider lg:uppercase dark:text-zinc-400">This project</div>
    <div id="drawerSettings" class="divide-y divide-zinc-100 overflow-hidden rounded-2xl bg-white lg:divide-y-0 lg:rounded-none lg:bg-transparent dark:divide-zinc-700/60 dark:bg-zinc-800 dark:lg:bg-transparent"></div>
    <dl id="menuInfo" class="mt-3 space-y-0.5 px-3 pb-2 text-xs leading-relaxed break-all text-zinc-500 lg:text-[11px] dark:text-zinc-400"></dl>
  </div>
  <button data-act="keys" id="keysBtn" class="hidden h-12 shrink-0 items-center gap-2 border-t border-zinc-200 px-4 text-[13px] text-zinc-500 hover:text-zinc-800 lg:flex dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"></button>
</nav>
<nav id="rail" hidden aria-label="Projects and views" class="z-30 h-dvh w-14 shrink-0 flex-col items-center gap-1 border-r border-zinc-200 bg-zinc-50 py-2 lg:flex dark:border-zinc-800 dark:bg-zinc-900"></nav>
<div id="drawerShade" hidden class="fixed top-0 right-0 z-30 h-dvh lg:bg-zinc-900/20 dark:lg:bg-black/50" aria-label="Close projects"></div>
<div id="app" class="relative z-10 mx-auto flex h-full max-w-3xl flex-col bg-white pt-[env(safe-area-inset-top)] md:border-x md:border-zinc-200 lg:mx-0 lg:grid lg:min-w-0 lg:max-w-none lg:flex-1 lg:grid-cols-[360px_minmax(0,1fr)] lg:grid-rows-[auto_auto_minmax(0,1fr)_auto] lg:border-x-0 xl:grid-cols-[420px_minmax(0,1fr)] 2xl:grid-cols-[460px_minmax(0,1fr)] dark:bg-zinc-950 md:dark:border-zinc-800">

  <header id="mainHead" class="flex h-14 shrink-0 items-center gap-1 px-2 lg:col-start-1 lg:row-start-1 lg:gap-2 lg:border-r lg:border-b lg:border-zinc-200 lg:px-3 dark:lg:border-zinc-800">
    <div id="deskTitle" class="hidden min-w-0 shrink-0 items-baseline gap-2 pl-1 lg:flex"></div>
    <div id="headNormal" class="contents">
      <button id="projBtn" data-act="projects" aria-label="Projects and settings" class="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 text-left active:bg-zinc-100 dark:active:bg-zinc-800">
        <span class="relative text-zinc-700 dark:text-zinc-300"><span id="logo"></span><span id="otherDot" hidden title="Another project needs you" class="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:bg-amber-400 dark:ring-zinc-950"></span></span>
        <span id="projName" class="truncate text-[19px] font-semibold tracking-tight">Taska</span>
      </button>
      <button id="agentBtn" data-act="agent-info" aria-label="Agents" class="flex h-11 shrink-0 items-center px-1"></button>
      <button id="searchBtn" data-act="search" aria-label="Search" class="grid size-11 shrink-0 place-items-center rounded-full text-zinc-500 active:bg-zinc-100 dark:text-zinc-400 dark:active:bg-zinc-800"></button>
    </div>
    <div id="headSearch" hidden class="contents">
      <label class="ml-1 flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-zinc-100 pl-3 text-zinc-400 lg:ml-0 lg:h-9 lg:ring-blue-500/40 lg:focus-within:bg-white lg:focus-within:ring-2 dark:bg-zinc-800 dark:text-zinc-500 dark:lg:focus-within:bg-zinc-900"><span id="searchIcon"></span>
        <input id="q" type="search" autocomplete="off" placeholder="Search title, text or code" class="min-w-0 flex-1 bg-transparent text-base text-zinc-900 outline-none placeholder:text-zinc-400 lg:text-sm dark:text-zinc-100 [&::-webkit-search-cancel-button]:hidden">
        <kbd id="qKey" class="mr-2 hidden h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold text-zinc-400 ring-1 ring-zinc-300 lg:grid dark:ring-zinc-600">/</kbd>
        <button id="qX" data-act="search-clear" aria-label="Clear search" class="-mr-1 grid size-11 shrink-0 place-items-center rounded-full lg:size-9"><span id="qClear" class="grid size-5 place-items-center rounded-full bg-zinc-400 text-white dark:bg-zinc-600 dark:text-zinc-900"></span></button>
      </label>
      <button data-act="search" class="h-11 shrink-0 px-2.5 text-[15px] font-medium text-blue-600 lg:hidden dark:text-blue-400">Cancel</button>
    </div>
    <button id="deskFilterBtn" data-act="filters" title="Filter · F" aria-label="Filters" class="relative hidden size-9 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 lg:grid dark:text-zinc-400 dark:hover:bg-zinc-800"></button>
  </header>

  <nav id="tabs" class="flex h-11 shrink-0 items-stretch border-b border-zinc-200 pr-1 pl-4 lg:hidden dark:border-zinc-800">
    <div role="tablist" class="flex min-w-0 items-stretch gap-4 overflow-x-auto [scrollbar-width:none]"><button data-act="tab" data-tab="items" role="tab" aria-selected="true" class="group -mb-px flex h-11 shrink-0 items-center gap-1 border-b-2 border-transparent text-[15px] font-medium text-zinc-500 aria-selected:border-zinc-900 aria-selected:font-semibold aria-selected:text-zinc-900 dark:text-zinc-400 dark:aria-selected:border-zinc-100 dark:aria-selected:text-zinc-50">Items<span id="nItems" class="rounded-full px-1.5 py-px font-mono text-[11px] font-medium text-zinc-400 tabular-nums empty:hidden group-aria-selected:bg-zinc-900/7 group-aria-selected:text-zinc-600 dark:text-zinc-500 dark:group-aria-selected:bg-white/10 dark:group-aria-selected:text-zinc-300"></span></button><button data-act="tab" data-tab="inputs" role="tab" aria-selected="false" class="group -mb-px flex h-11 shrink-0 items-center gap-1 border-b-2 border-transparent text-[15px] font-medium text-zinc-500 aria-selected:border-zinc-900 aria-selected:font-semibold aria-selected:text-zinc-900 dark:text-zinc-400 dark:aria-selected:border-zinc-100 dark:aria-selected:text-zinc-50">Inputs<span id="nInputs" class="rounded-full px-1.5 py-px font-mono text-[11px] font-medium text-zinc-400 tabular-nums empty:hidden group-aria-selected:bg-zinc-900/7 group-aria-selected:text-zinc-600 dark:text-zinc-500 dark:group-aria-selected:bg-white/10 dark:group-aria-selected:text-zinc-300"></span></button><button data-act="tab" data-tab="archive" role="tab" aria-selected="false" class="group -mb-px flex h-11 shrink-0 items-center gap-1 border-b-2 border-transparent text-[15px] font-medium text-zinc-500 aria-selected:border-zinc-900 aria-selected:font-semibold aria-selected:text-zinc-900 dark:text-zinc-400 dark:aria-selected:border-zinc-100 dark:aria-selected:text-zinc-50">Archive<span id="nArchTab" class="rounded-full px-1.5 py-px font-mono text-[11px] font-medium text-zinc-400 tabular-nums empty:hidden group-aria-selected:bg-zinc-900/7 group-aria-selected:text-zinc-600 dark:text-zinc-500 dark:group-aria-selected:bg-white/10 dark:group-aria-selected:text-zinc-300"></span></button><button data-act="tab" data-tab="rules" role="tab" aria-selected="false" class="group -mb-px flex h-11 shrink-0 items-center gap-1 border-b-2 border-transparent text-[15px] font-medium text-zinc-500 aria-selected:border-zinc-900 aria-selected:font-semibold aria-selected:text-zinc-900 dark:text-zinc-400 dark:aria-selected:border-zinc-100 dark:aria-selected:text-zinc-50">Rules<span id="nRules" class="rounded-full px-1.5 py-px font-mono text-[11px] font-medium text-zinc-400 tabular-nums empty:hidden group-aria-selected:bg-zinc-900/7 group-aria-selected:text-zinc-600 dark:text-zinc-500 dark:group-aria-selected:bg-white/10 dark:group-aria-selected:text-zinc-300"></span></button></div>
    <button id="filterBtn" data-act="filters" aria-label="Filters" class="relative ml-auto grid size-11 shrink-0 place-items-center text-zinc-500 dark:text-zinc-400"></button>
  </nav>
  <div id="filterStrip" hidden class="flex h-11 shrink-0 items-center gap-2 overflow-x-auto border-b border-zinc-100 px-4 [scrollbar-width:none] lg:hidden dark:border-zinc-800/70"></div>
  <div id="deskFilters" hidden class="border-zinc-200 lg:col-start-1 lg:row-start-2 lg:border-r lg:border-b dark:border-zinc-800"></div>

  <section id="itemsView" class="flex min-h-0 flex-1 flex-col lg:col-start-1 lg:row-span-2 lg:row-start-3 lg:border-r lg:border-zinc-200 dark:lg:border-zinc-800">
    <div id="list" class="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6"><div class="px-6 py-16 text-center text-sm text-zinc-400">Loading…</div></div>
  </section>

  <section id="inputsView" hidden class="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6 lg:col-span-2 lg:col-start-1 lg:row-span-2 lg:row-start-2"></section>

  <section id="detailView" hidden class="flex min-h-0 flex-1 flex-col lg:col-start-2 lg:row-span-3 lg:row-start-1">
    <div id="goStrip" hidden class="flex h-11 shrink-0 items-center gap-3 border-b border-amber-200/70 bg-amber-50 px-4 text-[13px] dark:border-amber-400/15 dark:bg-amber-400/10"></div>
    <header class="flex h-14 shrink-0 items-center gap-1 border-b border-zinc-100 px-1 lg:border-zinc-200 lg:px-3 dark:border-zinc-800/70 dark:lg:border-zinc-800">
      <button data-act="back" id="backBtn" aria-label="Back" class="grid size-11 shrink-0 place-items-center rounded-full text-zinc-600 active:bg-zinc-100 lg:hidden dark:text-zinc-400 dark:active:bg-zinc-800"></button>
      <div id="dHead" class="flex min-w-0 flex-1 flex-col items-center leading-tight lg:flex-row lg:items-center lg:gap-2 lg:pl-2"></div>
      <div id="dActs" class="hidden items-center gap-0.5 lg:flex"></div>
      <button data-act="item-menu" id="itemMenuBtn" aria-label="Item actions" title="All actions · ." class="grid size-11 shrink-0 place-items-center rounded-full text-zinc-600 active:bg-zinc-100 lg:size-9 lg:rounded-lg lg:hover:bg-zinc-100 dark:text-zinc-400 dark:active:bg-zinc-800 dark:lg:hover:bg-zinc-800"></button>
      <div id="dNav" class="hidden items-center gap-0.5 border-l border-zinc-200 pl-2 lg:ml-1.5 lg:flex dark:border-zinc-800"></div>
    </header>
    <div id="detailBody" class="min-h-0 flex-1 overflow-y-auto overscroll-contain"></div>
  </section>

  <section id="projectView" hidden class="min-h-0 overflow-y-auto overscroll-contain lg:col-span-2 lg:col-start-1 lg:row-span-4 lg:row-start-1"></section>

  <footer id="foot" class="relative z-20 shrink-0 px-3 pt-1 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:col-start-2 lg:row-start-4 lg:px-8 lg:pb-5">
    <div id="feedback" hidden role="status" class="mb-1.5 flex min-h-7 items-center gap-2 pr-1 pl-2.5 text-[13px] text-zinc-600 lg:mx-auto lg:max-w-[42rem] dark:text-zinc-300"></div>
    <div id="composer" class="rounded-4xl border border-zinc-200/80 bg-white shadow-lg shadow-black/5 focus-within:border-zinc-300 lg:mx-auto lg:max-w-[42rem] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40 dark:focus-within:border-zinc-700">
      <div id="scope" hidden class="flex h-8 items-center gap-1.5 pt-1 pr-1 pl-4 text-[13px] text-blue-700 dark:text-blue-300"></div>
      <div id="drafts" hidden class="flex gap-2.5 overflow-x-auto px-3 pt-3 pb-1"></div>
      <div class="flex items-end gap-0.5 p-1.5">
        <button id="attachBtn" data-act="attach" aria-label="Add images or files" class="grid size-11 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"></button>
        <textarea id="text" rows="1" placeholder="Write anything…" aria-label="Input" class="max-h-48 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-1 py-2.5 text-[17px] leading-6 outline-none placeholder:text-zinc-400 sm:text-[15px] dark:placeholder:text-zinc-500"></textarea>
        <div id="recBar" hidden class="flex h-11 min-w-0 flex-1 items-center gap-2" role="status" aria-label="Recording">
          <button data-act="rec-cancel" aria-label="Cancel recording" id="recCancel" class="grid size-11 shrink-0 place-items-center rounded-full text-zinc-500 dark:text-zinc-400"></button>
          <span class="size-2.5 shrink-0 animate-pulse rounded-full bg-red-500"></span>
          <span id="recTime" class="w-10 shrink-0 font-mono text-[15px] text-zinc-700 tabular-nums dark:text-zinc-200">0:00</span>
          <span id="recBars" class="flex h-8 min-w-0 flex-1 items-center justify-end gap-[3px] overflow-hidden"></span>
          <button data-act="rec-stop" aria-label="Stop recording" id="recStop" class="grid size-11 shrink-0 place-items-center rounded-full bg-red-600 text-white dark:bg-red-500"></button>
        </div>
        <button id="micBtn" data-act="mic" aria-label="Record a voice note" hidden class="grid size-11 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"></button>
        <button id="sendBtn" data-act="send" aria-label="Send (Shift + Enter)" class="grid size-11 shrink-0 place-items-center rounded-full bg-zinc-900 text-white disabled:opacity-25 dark:bg-zinc-100 dark:text-zinc-900"></button>
      </div>
      <input id="fileInput" type="file" multiple hidden>
    </div>
  </footer>
</div>

<div id="overlay" hidden class="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-6 dark:bg-black/60">
  <section id="dlg" role="dialog" aria-modal="true" aria-labelledby="dlgTitle" class="flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-t-3xl bg-white shadow-xl transition-transform duration-150 sm:rounded-3xl dark:bg-zinc-900 dark:ring-1 dark:ring-white/10">
    <div data-handle class="flex shrink-0 touch-none justify-center pt-2 sm:hidden"><span class="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600"></span></div>
    <header class="flex shrink-0 touch-none items-center gap-2 py-1 pr-2 pl-5">
      <h2 id="dlgTitle" class="min-w-0 flex-1 truncate text-[17px] font-semibold"></h2>
      <span id="dlgExtra" class="contents"></span>
      <button data-act="close" aria-label="Close" class="grid size-11 shrink-0 place-items-center rounded-full outline-none" id="dlgClose"></button>
    </header>
    <div id="dlgSub" hidden class="shrink-0"></div>
    <div id="dlgBody" class="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]"></div>
    <div id="dlgFoot" hidden class="shrink-0"></div>
  </section>
</div>

<div id="viewer" hidden class="fixed inset-0 z-50 flex flex-col bg-black pt-[env(safe-area-inset-top)] text-white">
  <header class="flex items-center gap-2 px-2 py-1 text-sm">
    <span id="vName" class="min-w-0 flex-1 truncate pl-2"></span>
    <span id="vIdx" class="text-white/60"></span>
    <a id="vOpen" target="_blank" rel="noopener" class="flex h-11 items-center rounded-full px-3 text-white/80 hover:bg-white/10">Original</a>
    <button data-act="v-close" aria-label="Close" class="grid size-11 place-items-center rounded-full hover:bg-white/10" id="vClose"></button>
  </header>
  <div id="vStage" class="flex min-h-0 flex-1 overflow-auto"><img id="vImg" alt="" class="m-auto max-h-full max-w-full object-contain"></div>
  <footer class="flex items-center justify-center gap-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-sm">
    <button data-act="v-prev" class="h-11 rounded-full px-4 hover:bg-white/10 disabled:opacity-30">Previous</button>
    <button data-act="v-zoom" id="vZoom" class="h-11 rounded-full bg-white/10 px-4">Actual size</button>
    <button data-act="v-next" class="h-11 rounded-full px-4 hover:bg-white/10 disabled:opacity-30">Next</button>
  </footer>
</div>

<div id="toast" hidden role="status" class="fixed inset-x-0 bottom-28 z-[60] mx-auto flex w-fit max-w-[92vw] lg:right-auto lg:bottom-5 lg:left-5 lg:mx-0 lg:max-w-md items-center gap-3 rounded-full bg-zinc-900 py-2 pr-4 pl-4 text-sm text-white shadow-lg has-[button]:py-1.5 has-[button]:pr-1.5 dark:bg-zinc-100 dark:text-zinc-900"></div>

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
  doc: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  comment: '<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>',
  ask: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  reply: '<path d="M9 17 4 12l5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
  thumb: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
  archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
  loop: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  docplus: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M9 15h6"/><path d="M12 18v-6"/>',
  listplus: '<path d="M11 12H3"/><path d="M16 6H3"/><path d="M16 18H3"/><path d="M18 9v6"/><path d="M21 12h-6"/>',
  indent: '<path d="M21 12H11"/><path d="M21 18H11"/><path d="M21 6H11"/><path d="m3 8 4 4-4 4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  plug: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
  phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
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
};
const ico = (n, c = 'size-5', sw = '1.75') => `<svg class="${c} shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const P = location.pathname.replace(/[^/]*$/, '');  // /p/<project>/
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
const LINK_BTN = `${HIT} flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-blue-600 dark:text-blue-400`;  // a quiet blue action
const PRIMARY = 'inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-[15px] font-semibold text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900';
const SECOND = 'inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 text-[15px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200';
const CHIP = `${HIT} flex h-8 items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 text-[13px] dark:bg-zinc-800/80`;
const NEEDS_CARD = 'rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-400/25 dark:bg-amber-400/7';
const FIELD = 'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950';
const CLOSE_X = `<span class="grid size-8 place-items-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">${'<svg class="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'}</span>`;
const SECTION = (text, right = '') => `<div class="flex h-6 items-center justify-between"><h2 class="text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">${text}</h2>${right}</div>`;

let S = {rev: -1, boot: '', items: [], inputs: [], width: 1, org: {}};
let offline = 0;  // consecutive failed polls
const byN = new Map(), byR = new Map(), kids = new Map();
const U = {doc: null, docNew: null, docEdit: false, docText: null, docSel: new Set(), docQuote: null, docCircle: false, docThreads: new Set(), docDrafts: {}, docScroll: {}, peek: null, moreInputs: new Set(), tab: 'items', q: '', type: 'all', when: 'all', status: 'all', pri: 'all', undoArch: null, folded: new Set(), moreMsgs: new Set(), subFor: null, choice: null, choiceLabels: {}, go: null, sheet: null, searching: false, open: null, scopeOff: false, editing: null, files: [], sending: false, lastSent: null, more: new Set()};
const groups = new Map();
let viewerGroup = [], viewerIdx = 0;
// The desktop layout (I70, design A "three panes"): 1024px and wider. Below that the phone layout, untouched.
const DESK = matchMedia('(min-width: 1024px)'), WIDE = matchMedia('(min-width: 1280px)');
const desk = () => DESK.matches;
const D = {page: null, full: false, sideHidden: false, sideOpen: false, filters: false, g: 0, undo: null, compose: false, prev: null};
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
const projTile = (name, cls = 'size-5 rounded-md text-[11px]') => `<span aria-hidden="true" class="grid shrink-0 place-items-center leading-none font-bold text-white uppercase ${cls} ${projTone(name)}">${esc([...String(name || '?')][0])}</span>`;
const KBD = k => `<kbd class="ml-1 hidden h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold opacity-70 ring-1 ring-current/30 lg:inline-grid">${k}</kbd>`;

const code = n => { const it = byN.get(n); return (it ? LETTER[it.type] : '?') + String(n).padStart(S.width, '0'); };
const parseRef = s => { const m = /^[A-Za-z]?0*(\d+)$/.exec(String(s).trim()); return m ? Number(m[1]) : null; };
// The user's move: an agent asked or is blocked, proposed an item, or wants a finished item accepted.
const needsYou = it => !it.merged_into && !CLOSED(it.status) && (!!it.wait || it.status === 'proposed' || it.status === 'review');

function when(t) {
  const d = new Date(t), now = new Date(), hm = d.toTimeString().slice(0, 5);
  if (d.toDateString() === now.toDateString()) return hm;
  if (new Date(now - 864e5).toDateString() === d.toDateString()) return 'Yesterday ' + hm;
  return d.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
}

function toast(text, undo) {  // with `undo`, the toast carries an Undo button for a few seconds
  const el = $('toast');
  el.innerHTML = `<span class="min-w-0 truncate">${esc(text)}</span>${undo ? '<button class="relative h-8 shrink-0 rounded-full bg-white/15 px-3 text-sm font-semibold text-white after:absolute after:-inset-1.5 dark:bg-zinc-900/10 dark:text-zinc-900">Undo</button>' : ''}`;
  el.classList.toggle('pointer-events-none', !undo);
  const up = !$('overlay').hidden && !desk();  // a sheet or the focus card is open: say it at the top, clear of its buttons (the desktop says it bottom left)
  el.classList.toggle('bottom-28', !up); el.classList.toggle('top-[calc(env(safe-area-inset-top)+0.75rem)]', up);
  if (undo) el.querySelector('button').onclick = () => { el.hidden = true; undo(); };
  el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, undo ? 5000 : 2600);
}

async function copy(text, done = 'Copied') {
  try { await navigator.clipboard.writeText(text); }
  catch (_) { const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); }
  toast(done);
}

// ---------------------------------------------------------------- data

async function load() {
  const d = await (await fetch(P + 'api/state', {cache: 'no-store'})).json();
  S = d; BASE = d.base || BASE; byN.clear(); byR.clear(); kids.clear();
  for (const it of S.items) byN.set(it.n, it);
  for (const r of S.inputs) byR.set(r.id, r);
  for (const it of S.items) if (it.parent && !it.merged_into) { if (!kids.has(it.parent)) kids.set(it.parent, []); kids.get(it.parent).push(it); }
  if (U.open && byN.get(U.open)?.merged_into) U.open = byN.get(U.open).merged_into;
  render();
}

async function poll() {
  for (;;) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 35000);  // a dead connection never answers
    try {
      const d = await (await fetch(`${P}api/poll?rev=${S.rev}&boot=${S.boot}&pv=${S.pv ?? -1}`, {cache: 'no-store', signal: ctl.signal})).json();
      if (offline) { offline = 0; renderLive(); }
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
const agoShort = t => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'now' : m < 60 ? m + 'm' : m < 1440 ? Math.round(m / 60) + 'h' : Math.round(m / 1440) + 'd'; };
const agoLong = t => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };
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
  if ($('deskAgent')) $('deskAgent').innerHTML = `<button data-act="agent-info" title="${esc(b.title)}" class="flex">${b.innerHTML}</button>`;
}
setInterval(() => { if (S.agents) renderAgent(); }, 30000);  // "2m" keeps counting between changes

// Taska was updated: load the new page once nothing would be lost. Busy now? The next poll tries again.
function freshen() {
  const busy = R.rec || U.sending || U.files.length || U.editing || (U.open && !desk()) || D.full || U.doc || U.undoArch || (document.activeElement === $('text') && $('text').value.trim())
    || !$('overlay').hidden || !$('viewer').hidden || DR.open || U.searching;
  if (!busy) location.reload();
}

async function refresh() { try { await load(); if (offline) { offline = 0; renderLive(); } } catch (_) {} }

async function op(o) {
  const r = await fetch(P + 'api/op', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(o)});
  const d = await r.json();
  if (!d.ok) { toast((d.res || []).find(x => x.startsWith('err')) || d.error || 'Not saved'); throw new Error('op failed'); }
  await load();
  return d;
}

const setStatus = (n, status) => op({op: 'set', ref: code(n), f: {status}});

// ---------------------------------------------------------------- items

function hay(it) {
  return (code(it.n) + ' ' + LETTER[it.type] + it.n + ' ' + it.title + ' ' + it.body + ' ' + it.next + ' ' + it.thread.map(x => x.text).join(' ')).toLowerCase();
}

const filtered = () => !!(U.q.trim() || U.type !== 'all' || U.when !== 'all' || U.status !== 'all' || U.pri !== 'all');
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
const queueOrder = (a, b) => (a.when !== 'now') - (b.when !== 'now') || (a.status !== 'doing') - (b.status !== 'doing') || a.pri.localeCompare(b.pri) || a.n - b.n;

function filesOf(it) {
  const seen = new Set(), out = [];
  for (const rid of it.srcs) for (const f of byR.get(rid)?.files || []) if (!seen.has(f.f)) { seen.add(f.f); out.push(f); }
  return out;
}

const WAVE = 'h-2 h-3 h-4 h-2 h-5 h-3 h-2 h-4 h-3 h-2 h-1.5 h-3 h-4 h-2'.split(' ').map(h => `<span class="w-[2px] rounded-full bg-zinc-300 dark:bg-zinc-600 ${h}"></span>`).join('');
function thumbs(files, gid, size = 'size-20') {
  const imgs = files.filter(f => (f.mime || '').startsWith('image/'));
  groups.set(gid, imgs.map(f => f.f));
  return files.map(f => (f.mime || '').startsWith('audio/')
    ? `<button data-act="play" data-src="${P}f/${encodeURIComponent(f.f)}" aria-label="Play ${esc(f.name)}" class="flex h-11 shrink-0 items-center gap-2 self-end rounded-full border border-zinc-200 pr-3.5 pl-1.5 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        <span data-icon class="grid size-8 place-items-center rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">${ico('play', 'size-4')}</span><span class="flex h-5 items-center gap-[2px]">${WAVE}</span><span data-time class="font-mono tabular-nums">Voice</span></button>`
    : (f.mime || '').startsWith('image/')
    ? `<button data-act="view" data-g="${gid}" data-f="${esc(f.f)}" title="${esc(f.name)}" class="${size} shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"><img src="${P}f/${encodeURIComponent(f.f)}" alt="${esc(f.name)}" loading="lazy" class="size-full object-contain"></button>`
    : `<a href="${P}f/${encodeURIComponent(f.f)}" target="_blank" rel="noopener" class="flex h-11 max-w-56 shrink-0 items-center gap-1.5 self-end rounded-xl border border-zinc-200 px-3 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">${ico('file', 'size-4')}<span class="truncate">${esc(f.name)}</span></a>`).join('');
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
const needLabel = it => it.wait ? (it.wait.kind === 'block' ? 'Blocked' : 'Needs reply') : it.status === 'proposed' ? 'Approve?' : it.status === 'review' ? 'Review' : '';
const lastAgentMsg = it => [...it.thread].reverse().find(x => x.by !== 'you');
// One plain line of what the agent said: the conclusion it leads with (T58 #5).
const oneLine = t => (String(t || '').split('\n').map(l => l.replace(/^\s*(#+|>|[-*+]\s+(\(|\[)[ xX]?(\)|\])|[-*+]|\d+[.)])\s*/, '').replace(/[*`]/g, '').trim()).find(Boolean) || '');
const excerpt = it => oneLine(it.wait ? it.wait.text : it.status === 'review' ? lastAgentMsg(it)?.text : (lastAgentMsg(it)?.text || it.body));

// Desktop: the selected row is tinted, others on hover; hovering shows the phone's swipe actions as buttons.
const rowTint = it => U.open === it.n ? 'lg:bg-blue-50 dark:lg:bg-blue-400/10' : 'lg:hover:bg-zinc-50 dark:lg:hover:bg-zinc-900/70';
const ACT_KEY = {Done: 'D', Accept: 'A', Approve: 'A', Archive: 'E', Unarchive: 'E', Later: 'L', Now: 'L', "Won't do": 'W', 'Not yet': 'N'};
const ACT_TONE = {Done: 'text-emerald-600 dark:text-emerald-400', Accept: 'text-emerald-600 dark:text-emerald-400', Approve: 'text-emerald-600 dark:text-emerald-400', Archive: 'text-emerald-600 dark:text-emerald-400', Start: 'text-blue-600 dark:text-blue-400', "Won't do": 'text-red-600 dark:text-red-400'};
function rowActs(it, needs = false) {
  const acts = [...(needs ? [] : [swipeRight(it)].filter(Boolean)), ...swipeLeft(it)];  // the amber pill already is the forward step
  return `<div class="hidden shrink-0 items-center gap-0.5 self-center lg:group-hover:flex">${acts.map(([f, v, label]) =>
    `<button data-act="swipe" data-n="${it.n}" data-f="${f}" data-v="${v}" title="${label}${ACT_KEY[label] ? ' · ' + ACT_KEY[label] : ''}" aria-label="${label}" class="grid size-8 place-items-center rounded-lg hover:bg-zinc-200/70 dark:hover:bg-zinc-800 ${ACT_TONE[label] || 'text-zinc-500 dark:text-zinc-400'}">${ico(ACT_ICON[label], 'size-[18px]')}</button>`).join('')}</div>`;
}

// A row in a list: state icon, coloured code and title, one meta line. Tapping anywhere opens the item (B62);
// the image and the fold arrow keep their own taps. Nested subitems hang off an elbow line.
function itemRow(it, depth = 0, group = []) {
  const c = code(it.n), files = filesOf(it), children = kids.get(it.n) || [], closed = CLOSED(it.status), talk = it.thread.length, docs = docsOf(it.n).length;
  const meta = [
    it.type === 'rule' ? '' : `<span class="${PRI_TEXT[it.pri]}">${it.pri}</span>`,
    needsYou(it) ? `<span class="font-semibold text-amber-700 dark:text-amber-400">${needLabel(it)}</span>` : it.reply && !closed ? '<span class="text-emerald-700 dark:text-emerald-400">Replied</span>' : '',
    it.status === 'doing' ? '<span class="text-blue-600 dark:text-blue-400">In progress</span>' : closed ? `<span>${statusName(it)}</span>` : '',
    it.archived && U.tab !== 'archive' ? SOFT('Archived') : '',
    it.when === 'later' && !closed ? SOFT('Later') : '',
    it.parent && !depth ? `<span>↳ ${code(it.parent)}</span>` : '',  // nested rows already hang under it
    children.length ? cnt('subitems', `${children.filter(k => CLOSED(k.status)).length}/${children.length}`, 'Subitems finished') : '',
    talk ? cnt('comment', talk, plural(talk, 'comment')) : '',
    docs ? cnt('file', docs, plural(docs, 'doc')) : '',
    files.length ? cnt(files.some(f => (f.mime || '').startsWith('image/')) ? 'image' : 'file', files.length, plural(files.length, 'file')) : '',
  ].join('');
  const img = files.find(f => (f.mime || '').startsWith('image/'));
  const foldable = group.some(k => k.parent === it.n);  // its subitems are in this list
  const top = `<div data-act="open" data-n="${it.n}" class="group relative flex cursor-pointer items-start gap-3 py-2.5 pr-3 pl-${4 + 8 * depth} ${closed ? 'opacity-55' : ''} ${rowTint(it)}">
      ${depth ? `<span class="absolute top-0 left-[${25 + 32 * (depth - 1)}px] h-6.25 w-4.5 rounded-bl-lg border-b-2 border-l-2 border-zinc-200 dark:border-zinc-700"></span>` : ''}
      ${stateIcon(it.status, statusName(it))}
      <div class="min-w-0 flex-1">
        <p class="line-clamp-2 text-[15px] leading-snug font-medium lg:line-clamp-1 ${closed ? 'line-through decoration-zinc-400' : ''}"><span class="mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[it.type]}">${c}</span>${esc(it.title)}</p>
        ${meta ? `<div class="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">${meta}</div>` : ''}
      </div>
      ${it.type === 'rule' ? '' : rowActs(it)}
      ${img ? `<button data-act="view" data-g="row${it.n}" data-f="${esc(img.f)}" aria-label="View image" class="-my-0.5 grid size-11 shrink-0 place-items-center">${(groups.set('row' + it.n, [img.f]), '')}<img src="${P}f/${encodeURIComponent(img.f)}" alt="" loading="lazy" class="size-10 rounded-lg border border-zinc-200 bg-zinc-50 object-cover dark:border-zinc-700 dark:bg-zinc-900"></button>` : ''}
      ${foldable ? `<button data-act="fold" data-n="${it.n}" aria-expanded="${!U.folded.has(it.n)}" aria-label="${U.folded.has(it.n) ? 'Show' : 'Hide'} subitems" class="-my-2 -mr-1 grid size-11 shrink-0 place-items-center rounded-full text-zinc-400 dark:text-zinc-500">${ico(U.folded.has(it.n) ? 'right' : 'down', 'size-4', '2')}</button>` : ''}
    </div>`;
  return `<article data-n="${it.n}" class="relative border-b border-zinc-100 dark:border-zinc-800/70">${it.type === 'rule' ? top : swipeRow(it, top)}</article>`;
}

// A row that waits on you (T65 "Needs you first"): an amber bar, what the agent said in one line, and the one
// action right there on the thumb side.
const ACTION_PILL = 'inline-flex h-8 min-w-18 items-center justify-center rounded-full bg-amber-100 px-3 text-[13px] font-semibold text-amber-950 ring-1 ring-amber-300/80 ring-inset dark:bg-amber-400/15 dark:text-amber-100 dark:ring-amber-400/30';
const rowAction = it => it.wait ? (it.wait.kind === 'block' ? ['reply', 'Reply'] : ['answer', 'Answer']) : it.status === 'proposed' ? ['approve', 'Approve'] : ['accept', 'Accept'];
function needsRow(it) {
  const [v, label] = rowAction(it);
  const top = `<div data-act="open" data-n="${it.n}" class="group relative flex cursor-pointer items-center gap-2.5 py-2.5 pr-3 pl-4 ${rowTint(it)}">
      <span class="absolute inset-y-0 left-0 w-1 bg-amber-500 dark:bg-amber-400"></span>
      <span class="self-start">${stateIcon(it.status, statusName(it))}</span>
      <div class="min-w-0 flex-1">
        <p class="line-clamp-2 text-[15px] leading-snug font-medium lg:line-clamp-1"><span class="mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[it.type]}">${code(it.n)}</span>${esc(it.title)}</p>
        <div class="mt-1 flex min-w-0 items-center gap-2 text-xs font-medium">
          ${it.type === 'rule' ? '' : `<span class="shrink-0 ${PRI_TEXT[it.pri]}">${it.pri}</span>`}<span class="shrink-0 font-semibold text-amber-700 dark:text-amber-400">${needLabel(it)}</span>${it.parent ? `<span class="shrink-0 text-zinc-500 dark:text-zinc-400">↳ ${code(it.parent)}</span>` : ''}
          <span class="min-w-0 truncate font-normal text-zinc-500 dark:text-zinc-400">${esc(excerpt(it))}</span>
        </div>
      </div>
      ${it.type === 'rule' ? '' : rowActs(it, true)}
      <button data-act="row-act" data-n="${it.n}" data-v="${v}" title="${label} · A" class="-my-1 grid h-11 shrink-0 place-items-center"><span class="${ACTION_PILL}">${label}</span></button>
    </div>`;
  return `<article data-n="${it.n}" class="relative border-b border-zinc-100 dark:border-zinc-800/70">${it.type === 'rule' ? top : swipeRow(it, top)}</article>`;
}

// A group header in a list: Needs you (amber), the agent's queue, finished work, and the rule groups.
function zone(kind, label, n, right = '') {
  const needs = kind === 'needs';
  const mark = needs ? '<span class="size-2 shrink-0 rounded-full bg-amber-500 ring-3 ring-amber-500/20 dark:bg-amber-400"></span>'
    : kind === 'rules' ? '<span class="mx-1 size-2 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-500"></span>'
    : stateIcon({queue: 'doing', done: 'done', retired: 'dropped', archived: 'done'}[kind], label, 'size-4');
  return `<div class="flex h-9 items-center gap-2 border-b pr-1 pl-4 ${needs ? 'border-amber-200/70 bg-amber-50 dark:border-amber-400/15 dark:bg-amber-400/10' : 'border-zinc-100 bg-zinc-50 dark:border-zinc-800/70 dark:bg-zinc-900/60'}">
    ${mark}<h2 class="text-sm font-semibold ${needs ? 'text-amber-950 dark:text-amber-100' : 'text-zinc-800 dark:text-zinc-200'}">${label}</h2><span class="grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${needs ? 'bg-amber-500 text-white dark:bg-amber-400 dark:text-amber-950' : 'bg-zinc-200/80 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}">${n}</span>${right}
  </div>`;
}
const goThroughBtn = () => `<button data-act="go-through" class="-my-1 ml-auto flex h-11 items-center gap-0.5 rounded-full pr-2 pl-3 text-[13px] font-semibold text-amber-800 dark:text-amber-300">Go through${ico('right', 'size-4', '2.25')}</button>`;
const keepGoingSwitch = () => `<button data-act="auto" aria-pressed="${!!S.cfg?.auto}" title="Agents take the next item without stopping" class="group -my-1 ml-auto flex h-11 items-center gap-2 rounded-full pr-2.5 pl-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300">${ico('loop', 'size-3.5 text-emerald-600 dark:text-emerald-400', '2')}Keep going
    <span class="relative h-5.5 w-9.5 shrink-0 rounded-full bg-zinc-300 transition-colors group-aria-pressed:bg-emerald-500 dark:bg-zinc-600 dark:group-aria-pressed:bg-emerald-500"><span class="absolute top-0.75 left-0.75 size-4 rounded-full bg-white shadow-sm transition-transform group-aria-pressed:translate-x-4"></span></span></button>`;
const archiveAllBtn = n => `<button data-act="archive-all" class="-my-1 ml-auto flex h-11 items-center pr-2"><span class="inline-flex h-8 items-center gap-1.5 rounded-full bg-emerald-50 px-3 text-[13px] font-semibold text-emerald-800 ring-1 ring-emerald-600/20 ring-inset dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/25">${ico('archive', 'size-4')}Archive ${n}</span></button>`;

// Phone quick actions: swipe right = the natural next step, swipe left = reveal buttons. Touch only.
// Swipe right all the way: the step forward you take most (F51). Archived items have none.
function swipeRight(it) {
  return it.archived ? null
    : it.status === 'proposed' ? ['status', 'open', 'Approve', 'approved']
    : it.status === 'review' ? ['status', 'done', 'Accept', 'accepted']
    : CLOSED(it.status) ? ['archived', 'true', 'Archive', 'archived']
    : ['status', 'done', 'Done', 'done'];
}
// Swipe left: the way back. The one you want most sits at the edge, under your finger; a few more beside it.
function swipeLeft(it) {
  const later = it.when === 'now' ? ['when', 'later', 'Later'] : ['when', 'now', 'Now'], drop = ['status', 'dropped', "Won't do"];
  return it.archived ? [['archived', 'false', 'Unarchive']]
    : it.status === 'proposed' ? [later, drop]
    : it.status === 'review' ? [later, ['status', 'doing', 'Not yet']]
    : CLOSED(it.status) ? [['status', 'open', 'Reopen']]
    : it.status === 'doing' ? [drop, later, ['status', 'open', 'Pause']]
    : [['status', 'doing', 'Start'], drop, later];
}
const ACT_ICON = {Approve: 'thumb', Accept: 'check', Done: 'done', Archive: 'archive', Later: 'clock', Now: 'clock', "Won't do": 'ban', 'Not yet': 'reopen', Pause: 'pause', Start: 'start', Reopen: 'reopen', Unarchive: 'archive'};
const ACT_BG = {Start: 'bg-blue-600 dark:bg-blue-500', "Won't do": 'bg-red-600 dark:bg-red-500'};
function swipeRow(it, inner) {
  const fwd = swipeRight(it), back = swipeLeft(it);
  return `<div class="relative overflow-hidden">
    <div data-swipe-left hidden class="absolute inset-0 flex items-center gap-2 bg-emerald-600 pl-6 text-sm font-semibold text-white dark:bg-emerald-500">${fwd ? ico(ACT_ICON[fwd[2]], 'size-5') + fwd[2] : ''}</div>
    <div data-swipe-right hidden class="absolute inset-y-0 right-0 flex">${back.map(([f, v, label], i) => `<button data-act="swipe" data-n="${it.n}" data-f="${f}" data-v="${v}" class="flex w-19 flex-col items-center justify-center gap-1 text-xs font-semibold text-white ${ACT_BG[label] || (i % 2 ? 'bg-zinc-500 dark:bg-zinc-600' : 'bg-zinc-600 dark:bg-zinc-700')}">${ico(ACT_ICON[label], 'size-5')}${label}</button>`).join('')}</div>
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
function swipeStart(e) {
  if (e.pointerType === 'mouse' || e.clientX <= EDGE_W || DR.open) return;  // the screen edge belongs to the phone's "back"
  const el = e.target.closest('[data-swipe]');
  if (!el) return;
  if (SW.open && SW.open !== el) closeSwipe();
  // Show nothing new until the finger really moves sideways: iPhone Safari treats a tap that reveals content
  // as a hover and never sends the click, so the row would not open (B62).
  const reveal = SW.open === el ? el.parentElement.querySelector('[data-swipe-right]').offsetWidth : 0;
  Object.assign(SW, {el, id: e.pointerId, x0: e.clientX, y0: e.clientY, mode: null, dx: 0, reveal, base: -reveal});
  clearTimeout(SW.press);
  SW.press = setTimeout(() => {  // held still: show the whole item without leaving the list
    if (SW.el !== el || SW.mode) return;
    SW.el = null; SW.pressed = true;
    navigator.vibrate?.(8);
    $('dlg').classList.add('select-none', '[-webkit-touch-callout:none]');
    peek(Number(el.dataset.swipe));
    const lift = () => setTimeout(() => {
      $('dlg').classList.remove('select-none', '[-webkit-touch-callout:none]');
      getSelection()?.removeAllRanges();
    }, 60);
    document.addEventListener('pointerup', lift, {once: true, capture: true});
    document.addEventListener('touchend', lift, {once: true, capture: true});
  }, 450);
}
function swipeMove(e) {
  if (!SW.el || e.pointerId !== SW.id) return;
  const dx = e.clientX - SW.x0, dy = e.clientY - SW.y0;
  if (!SW.mode) {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    clearTimeout(SW.press);
    SW.mode = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'h' : 'v';
    if (SW.mode === 'v') { SW.el = null; return; }
    try { SW.el.setPointerCapture(e.pointerId); } catch (_) {}  // the pointer may already be gone
    SW.el.style.transition = 'none';
    const right = SW.el.parentElement.querySelector('[data-swipe-right]');
    right.hidden = false; SW.reveal = right.offsetWidth;
  }
  SW.dx = Math.max(-SW.reveal - 30, Math.min(swipeRight(byN.get(Number(SW.el.dataset.swipe))) ? SW.el.offsetWidth * 0.7 : 0, SW.base + dx));
  SW.el.parentElement.querySelector('[data-swipe-left]').hidden = SW.dx < 0;
  SW.el.parentElement.querySelector('[data-swipe-right]').hidden = SW.dx > 0;
  swipeTo(SW.el, SW.dx);
}
async function swipeEnd(e) {
  clearTimeout(SW.press);
  if (SW.pressed) { SW.pressed = false; SW.swallow = Date.now(); return; }  // the finger lifts after a long press: no tap
  const el = SW.el;
  if (!el || e.pointerId !== SW.id) return;
  SW.el = null;
  if (SW.mode !== 'h') return;
  SW.swallow = Date.now();
  el.style.transition = '';
  const n = Number(el.dataset.swipe), it = byN.get(n);
  if (SW.dx > el.offsetWidth * 0.33) {
    swipeTo(el, el.offsetWidth);
    const [f, v] = swipeRight(it);
    try { await change(n, f, f === 'archived' ? v === 'true' : v); } catch (_) { swipeTo(el, 0); }
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
    return `<button ${n ? `data-act="choice" data-n="${n}" data-i="${i}" data-multi="${multi ? 1 : ''}"` : 'disabled'} aria-pressed="${on}" class="flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-[15px] leading-snug ${on ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-400/10' : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'} ${done && !on ? 'opacity-50' : ''}">
      <span class="grid size-5 shrink-0 place-items-center border-2 ${multi ? 'rounded-md' : 'rounded-full'} ${on ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-400 dark:text-zinc-900' : 'border-zinc-300 dark:border-zinc-600'}">${on ? ico('check', 'size-3.5', '3') : ''}</span>
      <span class="min-w-0 flex-1">${inlineMd(l)}</span>${n && i < 9 ? KBD(i + 1) : ''}</button>`;
  }).join('')}</div>`;
}
const hasChoices = text => String(text || '').split('\n').some(l => CHOICE.test(l));
const sendAnswerBtn = (n, cls = 'w-full', key = false) => `<button data-act="choice-send" data-n="${n}" ${U.choice?.n === n && U.choice.picked.size ? '' : 'disabled'} class="${PRIMARY} ${cls}">Send answer${key ? KBD('⌘↵') : ''}</button>`;
const KIND_TAG = x => KIND[x.kind] ? `<span class="rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${x.kind === 'decide' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}">${KIND[x.kind]}</span>` : '';
// A long agent message shows its first line, the conclusion, until you ask for more (T58 #5).
function msgText(x, gid, form = 0, done = null) {
  const long = x.by !== 'you' && x.kind !== 'ask' && (x.text.length > 240 || x.text.trim().split('\n').length > 3), folded = long && !U.moreMsgs.has(x.id);
  return rich(folded ? x.text.trim().split('\n')[0] : x.text, gid + 'md' + x.id, '', form, done)
    + (long ? `<button data-act="more-msg" data-id="${x.id}" class="-mb-2 flex h-11 items-center text-sm font-medium text-blue-600 dark:text-blue-400">${folded ? 'Show more' : 'Show less'}</button>` : '');
}
// One message of a conversation, the same on the item page and in the preview: yours on the right in blue,
// an agent's on the left in a card under its name. An open question shows amber, with its options to tap.
// A question someone answered says so, with the picked options ticked (I84): the answer is your next message.
function answerOf(thread, x) {
  if (x.kind !== 'ask') return null;
  const a = thread.slice(thread.indexOf(x) + 1).find(y => y.by === 'you');
  return a ? a.text.split('\n').map(l => l.match(/^\s*✓\s*(.+)$/)?.[1]?.trim()).filter(Boolean) : null;
}
function msgHtml(x, gid, form = 0, done = null) {
  const you = x.by === 'you', src = you && x.src ? byR.get(x.src) : null;
  const strip = (files, g, size) => files?.length ? `<div class="flex gap-2 overflow-x-auto ${you ? 'justify-end' : 'mt-3'}">${thumbs(files, g, size)}</div>` : '';
  if (you) return `<div class="flex flex-col items-end gap-1">
      ${x.text ? `<div class="max-w-[85%] rounded-2xl rounded-tr-md bg-blue-600 px-4 py-2.5 text-[15px] leading-relaxed text-white dark:bg-blue-500 [&_a]:text-white [&_a]:decoration-white/60">${msgText(x, gid)}</div>` : ''}
      ${strip(src?.files, gid + 't' + x.id)}
      <span class="px-1 text-[11px] text-zinc-400 dark:text-zinc-500">You · ${when(x.t)}</span></div>`;
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
    else add('para', l);
  }
  const labels = [];
  const html = blocks.map(b => {
    const items = b.kind === 'ul' ? b.lines.reduce((acc, l) => { if (/^\s*[-*+]\s/.test(l)) acc.push(l); else acc[acc.length - 1] += ' ' + l.trim(); return acc; }, []) : [];
    if (items.length && items.every(l => CHOICE.test(l))) {
      const multi = items[0].match(CHOICE)[1] === '[', base = labels.length;
      labels.push(...items.map(l => l.replace(CHOICE, '')));
      return choiceHtml(labels.slice(base), multi, form, base, done);
    }
    return blockHtml({kind: /^(ol|ul)$/.test(b.kind) ? 'list' : b.kind, text: b.lines.join('\n')}, false, gid);
  }).join('');
  if (form && labels.length) U.choiceLabels[form] = labels;  // the answer is sent with sendAnswerBtn, placed by the caller
  return html;
}
function blockHtml(b, isTitle, gid = '') {
  if (isTitle) return `<div class="text-2xl leading-tight font-bold tracking-tight">${inlineMd(b.text.replace(/^#+\s*/, ''), gid)}</div>`;
  if (b.kind === 'heading') {
    const level = b.text.match(/^#+/)[0].length;
    return `<div class="${level <= 2 ? 'mt-2 text-xl' : 'mt-1 text-[17px]'} leading-snug font-semibold">${inlineMd(b.text.replace(/^#+\s*/, ''), gid)}</div>`;
  }
  if (b.kind === 'code') return `<pre class="overflow-x-auto rounded-lg bg-zinc-100 p-3 font-mono text-[13px] leading-relaxed dark:bg-zinc-800"><code>${esc(b.text.replace(/^\s*```[^\n]*\n?/, '').replace(/\n?\s*```\s*$/, ''))}</code></pre>`;
  if (b.kind === 'quote') return `<blockquote class="border-l-[3px] border-zinc-300 pl-3 text-zinc-600 dark:border-zinc-600 dark:text-zinc-300">${inlineMd(b.text.replace(/^\s*>\s?/gm, ''), gid).replace(/\n/g, '<br>')}</blockquote>`;
  if (b.kind === 'list') {
    const ordered = /^\s*\d/.test(b.text);
    const items = b.text.split('\n').reduce((acc, l) => { if (/^\s*([-*+]|\d+[.)])\s/.test(l)) acc.push(l.replace(/^\s*([-*+]|\d+[.)])\s+/, '')); else if (acc.length) acc[acc.length - 1] += ' ' + l.trim(); return acc; }, []);
    return `<${ordered ? 'ol' : 'ul'} class="${ordered ? 'list-decimal' : 'list-disc'} space-y-1.5 pl-5 marker:text-zinc-400">${items.map(x => `<li>${inlineMd(x, gid)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`;
  }
  return `<p class="leading-[1.75] whitespace-pre-wrap">${inlineMd(b.text, gid)}</p>`;
}
const sameText = (a, b) => a.split(/\s+/).join(' ') === b.split(/\s+/).join(' ');
function threadHtml(d, key, comments, blockText) {
  return `<div class="mt-2 space-y-2 border-l-2 border-amber-300 pl-3 dark:border-amber-600">
    ${comments.map(c => `<div class="text-sm ${MSG(c.by)}">${blockText !== undefined && !sameText(c.quote, blockText) ? `<div class="mb-0.5 line-clamp-2 text-xs text-zinc-500">“${esc(c.quote)}”</div>` : ''}<span class="${WHO(c.by)}">${esc(who(c.by))}</span> <span class="text-xs text-zinc-400">${when(c.t)}</span>${rich(c.text, 'dc' + c.t)}</div>`).join('')}
    <div class="flex items-end gap-2"><textarea data-doc-draft="${key}" rows="1" placeholder="Reply…" class="${FIELD} min-w-0 flex-1 text-sm">${esc(U.docDrafts[key] || '')}</textarea><button data-act="doc-send" data-d="${d.d}" data-key="${key}" class="${PRIMARY}">Send</button></div>
  </div>`;
}
const noteText = d => sameText(d.md.split('\n')[0].replace(/^#+\s*/, ''), d.title) ? d.md : `# ${d.title}\n\n${d.md}`;
function docBarHtml(d) {
  if (!d || U.docEdit) return '';
  const blocks = d.blocks.filter(b => U.docSel.has(b.key));
  if (!blocks.length && !U.docQuote) return '';
  const what = U.docQuote ? `“${esc(U.docQuote.text)}”` : blocks.length === 1 ? `“${esc(blocks[0].text)}”` : `${blocks.length} paragraphs selected`;
  return `<div class="space-y-2 border-t border-zinc-200 bg-white/95 px-1 pt-2.5 pb-1 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
    <div class="line-clamp-2 text-xs text-zinc-500">${what}</div>
    <div class="flex items-end gap-2"><textarea id="docNote" data-doc-draft="note" rows="1" placeholder="Comment on this…" class="${FIELD} min-w-0 flex-1 text-sm">${esc(U.docDrafts.note || '')}</textarea>
    <button data-act="doc-comment" class="${PRIMARY}">Comment</button><button data-act="doc-unpick" aria-label="Clear selection" class="${BTN} text-sm">${ico('x', 'size-4')}</button></div></div>`;
}
function renderDocBar() { const bar = $('docBar'); if (bar) bar.innerHTML = docBarHtml(docById(U.doc)); }
function renderDoc({focus = false} = {}) {
  if (U.docEdit) {
    const d = docById(U.doc);
    const md = U.docText ?? (d ? noteText(d) : '');
    dialog(d ? `D${d.d}` : `New doc on ${code(U.docNew)}`, `<div class="flex min-h-full flex-col">
      <div class="sticky -top-2 z-10 -mx-4 -mt-2 mb-2 flex items-center gap-2 bg-white px-4 py-2 text-xs text-zinc-500 dark:bg-zinc-900"><span class="min-w-0 flex-1">The first line is the title. Saved when you are done.</span><button data-act="doc-done" class="${PRIMARY}">Done</button></div>
      <textarea id="docMd" placeholder="Title on the first line&#10;&#10;Then anything: a plan, a design, notes. Markdown works." class="min-h-[40dvh] w-full flex-1 resize-none bg-transparent text-base leading-relaxed outline-none placeholder:text-zinc-400">${esc(md)}</textarea></div>`, {focus: false, tall: true});
    return;
  }
  const d = docById(U.doc);
  if (!d) return closeDialog();
  const a = document.activeElement, keep = a?.dataset?.docDraft ? [a.dataset.docDraft, a.value, a.selectionStart] : null;
  const top = $('dlgBody').scrollTop;
  const titled = !!d.blocks[0] && sameText(d.blocks[0].text.replace(/^#+\s*/, ''), d.title);
  groups.delete('doc' + d.d);  // its images, refilled as the blocks render
  dialog(`D${d.d}`, `<div class="flex min-h-full flex-col"><div class="flex items-center gap-1 text-xs text-zinc-500"><span class="min-w-0 flex-1 truncate">on <button data-act="goto" data-n="${d.n}" class="text-blue-600 dark:text-blue-400">${code(d.n)}</button> · ${esc(who(d.by))} · ${when(d.t1)}</span>
      <button data-act="doc-circle" aria-pressed="${!!U.docCircle}" class="${BTN} text-sm aria-pressed:bg-amber-100 aria-pressed:text-amber-900 dark:aria-pressed:bg-amber-900/60 dark:aria-pressed:text-amber-100">${U.docCircle ? 'Draw a circle…' : 'Circle'}</button><button data-act="doc-edit" class="${BTN} text-sm">Edit</button></div>
    ${titled ? '' : `<div class="mt-3 text-2xl leading-tight font-bold tracking-tight">${esc(d.title)}</div>`}
    <div id="docBlocks" class="relative mt-3 space-y-3 text-[15px] ${U.docCircle ? 'select-none' : ''}">
      ${d.blocks.map((b, i) => `<section data-act="doc-pick" data-key="${b.key}" class="-mx-2 rounded-lg px-2 py-1 transition-colors ${U.docSel.has(b.key) ? 'bg-amber-50 ring-2 ring-amber-300 dark:bg-amber-950/40 dark:ring-amber-600' : ''}">
        <div class="flex items-start gap-2"><div class="min-w-0 flex-1 break-words">${blockHtml(b, i === 0 && titled, 'doc' + d.d)}</div>
        ${b.comments.length ? `<button data-act="doc-thread" data-key="${b.key}" aria-label="${plural(b.comments.length, 'comment')}" class="mt-0.5 flex h-6 shrink-0 items-center gap-1 rounded-md bg-amber-100 px-1.5 text-xs font-medium text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">${ico('comment', 'size-3.5')}${b.comments.length}</button>` : ''}</div>
        ${U.docThreads.has(b.key) ? threadHtml(d, b.key, b.comments, b.text) : ''}</section>`).join('')}
      ${U.docCircle ? `<svg id="lasso" class="absolute inset-0 z-10 h-full w-full touch-none" aria-label="Draw around the part you want to comment on"><path id="lassoPath" d="" fill="rgba(251,191,36,.15)" stroke="rgb(245,158,11)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>` : ''}
    </div>
    ${d.detached.length ? `<div class="mt-6 space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-800"><div class="text-xs font-medium text-zinc-500">Original text changed</div>${d.detached.map(t => `<section>
      <div class="text-sm text-zinc-400 line-through">${esc(t.quote)}</div>${threadHtml(d, t.key, t.comments)}</section>`).join('')}</div>` : ''}
    <p class="mt-6 text-center text-xs text-zinc-400">Tap paragraphs, select text or circle an area to comment</p>
    <div id="docBar" class="sticky bottom-0 -mx-4 mt-auto px-4">${docBarHtml(d)}</div></div>`, {focus, tall: true});
  if (!focus) $('dlgBody').scrollTop = top;
  if (keep) { const el = document.querySelector(`[data-doc-draft="${keep[0]}"]`); if (el) { el.value = keep[1]; el.focus({preventScroll: true}); try { el.setSelectionRange(keep[2], keep[2]); } catch (_) {} } }
  if (U.docCircle) wireLasso();
}
function openDoc(d) {
  Object.assign(U, {peek: null, doc: d, docNew: null, docEdit: false, docText: null, docSel: new Set(), docQuote: null, docCircle: false});
  U.docDrafts.note = '';
  renderDoc({focus: true});
  $('dlgBody').scrollTop = U.docScroll[d] || 0;
}
function newDoc(n) {
  Object.assign(U, {peek: null, doc: null, docNew: n, docEdit: true, docText: ''});
  renderDoc();
  $('docMd').focus();
}
async function saveDoc() {  // leaving the editor saves; an empty new note is dropped
  const md = ($('docMd')?.value ?? U.docText ?? '').trim(), d = docById(U.doc);
  U.docEdit = false; U.docText = null;
  if (!md || (d && md === noteText(d).trim())) return d;
  try {
    if (d) { await op({op: 'doc', d: d.d, md}); toast('Saved'); return docById(d.d); }
    const n = U.docNew; await op({op: 'doc', ref: code(n), md}); toast('Document created');
    return docById(Math.max(...docsOf(n).map(x => x.d)));
  } catch (_) { return d; }
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
// Long press on a row, or "Go through" on Needs you (T65): the item in a card above the input box, with what it
// needs and its actions. For things that wait on you it steps through them one by one: act, and the next comes.
const needsList = () => visible('items').filter(needsYou).map(it => it.n);
const FOCUS_TONE = {Start: 'text-blue-600 dark:text-blue-400', "Won't do": 'text-red-600 dark:text-red-400'};
function peek(n, {focus = true} = {}) {
  const it = byN.get(n);
  if (!it) return;
  const moved = U.peek !== n;
  if (needsYou(it) && !U.go) U.go = {list: needsList(), done: new Set()};  // something that waits on you: step through all of them
  U.peek = n;
  const g = U.go && U.go.list.includes(n) ? U.go : null, files = filesOf(it), fwd = swipeRight(it), need = needLabel(it);
  const recent = it.thread.slice(-3), talk = it.thread.length;
  const act = (f, v, label, tone) => `<button data-act="peek-set" data-n="${n}" data-f="${f}" data-v="${v}" class="flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold ${tone}">${ico(ACT_ICON[label], 'size-5')}<span class="max-w-full truncate">${label}</span></button>`;
  const head = g ? `<span class="flex items-center gap-2"><span class="text-xs font-bold tracking-wide whitespace-nowrap text-amber-700 uppercase dark:text-amber-400">Needs you</span><span class="text-xs font-medium whitespace-nowrap text-zinc-500 tabular-nums dark:text-zinc-400">${g.list.indexOf(n) + 1} of ${g.list.length}</span></span>` : '';
  dialog('', `<div class="pb-1">
    <div class="flex items-center gap-2">${stateIcon(it.status, statusName(it), 'size-5')}<span class="font-mono text-sm font-bold ${TYPE_TEXT[it.type]}">${code(n)}</span>${need ? `<span class="text-xs font-semibold text-amber-700 dark:text-amber-400">${need}</span>` : ''}
      <button data-act="goto" data-n="${n}" class="-my-2 ml-auto flex h-11 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-blue-600 dark:text-blue-400">${ico('open', 'size-4')}Open</button></div>
    <h2 class="mt-1 text-[19px] leading-snug font-semibold break-words">${esc(it.title)}</h2>
    <div class="mt-1 flex flex-wrap items-center gap-x-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">${it.type === 'rule' ? '' : `<span class="${PRI_TEXT[it.pri]}">${it.pri}</span>`}<span>${statusName(it)}</span><span>${WHEN[it.when]}</span><span>${it.type[0].toUpperCase() + it.type.slice(1)}</span>${talk ? cnt('comment', talk, plural(talk, 'comment')) : ''}</div>
    ${it.body ? rich(it.body, 'pbody' + n, 'mt-2.5 text-[15px] text-zinc-700 dark:text-zinc-300') : ''}
    ${it.next ? `<div class="mt-2 flex gap-2 text-sm"><span class="shrink-0 font-semibold text-zinc-500 dark:text-zinc-400">Next</span><span class="min-w-0 break-words">${inlineMd(it.next)}</span></div>` : ''}
    ${files.length ? `<div class="mt-3 flex items-end gap-2 overflow-x-auto">${thumbs(files, 'peek' + n)}</div>` : ''}
    ${recent.length ? `<div class="mt-4 flex flex-col gap-4">${recent.map(x => msgHtml(x, 'p', it.wait?.kind === 'ask' && it.wait.id === x.id ? n : 0, answerOf(it.thread, x))).join('')}</div>` : ''}
  </div>`, {
    aboveComposer: true, focus, card: true, head,
    extra: g ? `<button data-act="go-next" class="ml-auto flex h-11 items-center gap-0.5 rounded-full pr-1.5 pl-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">Next${ico('right', 'size-4', '2.25')}</button>` : '',
    sub: g ? `<div class="flex gap-1 px-4 pb-1" aria-hidden="true">${g.list.map(k => `<span class="h-1 flex-1 rounded-full ${k === n ? 'bg-amber-500 dark:bg-amber-400' : g.done.has(k) ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-zinc-200 dark:bg-zinc-700'}"></span>`).join('')}</div>` : '',
    foot: `<div class="flex gap-1 border-t border-zinc-100 px-2 py-1 dark:border-zinc-800">
      ${fwd ? act(fwd[0], fwd[1], fwd[2], 'text-emerald-700 dark:text-emerald-400') : ''}${swipeLeft(it).map(([f, v, label]) => act(f, v, label, FOCUS_TONE[label] || 'text-zinc-700 dark:text-zinc-200')).join('')}
      <button data-act="copy" data-n="${n}" class="flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">${ico('copy', 'size-5')}Copy</button></div>`,
  });
  if (moved) $('dlgBody').scrollTop = 0;
  renderComposer();
}
// After you act on an item while going through: the next one that still waits on you, or done.
function advance(from) {
  const g = U.go;
  if (!g) return closeDialog();
  if (from) g.done.add(from);
  const left = g.list.filter(k => !g.done.has(k) && byN.get(k) && needsYou(byN.get(k)) && k !== from);
  const next = left.find(k => g.list.indexOf(k) > g.list.indexOf(from)) ?? left[0];
  if (next) peek(next, {focus: false});
  else { closeDialog(); toast('Nothing else needs you'); }
}

// ---------------------------------------------------------------- item page
// An item opens as a page of its own (T57): back arrow, code and status on top, the rarely used things behind
// "⋯". Reading order: title → what it needs from you → description → files → docs → subitems → conversation.

// The message the needs card shows: the question, or the agent's report or proposal (then not repeated below).
const cardMsg = it => it.wait ? it.thread.find(x => x.id === it.wait.id) || it.wait : (it.status === 'review' || it.status === 'proposed') ? lastAgentMsg(it) : null;
function needsCard(it) {
  const n = it.n, m = cardMsg(it), name = whoName(m?.by || it.wait?.by || 'agent');
  // On the desktop the buttons sit on the right with their keys, and a hint says what the second one does.
  const card = (icon, title, body, buttons, hint = '') => `<section class="${NEEDS_CARD}">
      <div class="flex items-center gap-2.5 px-4 pt-3.5 lg:px-5 lg:pt-4">${ico(icon, 'size-5 text-amber-600 dark:text-amber-400')}<p class="min-w-0 flex-1 text-sm font-semibold text-amber-900 lg:text-[15px] dark:text-amber-200">${title}</p>${m?.t ? `<span class="text-xs text-amber-700/80 dark:text-amber-300/70">${when(m.t)}</span>` : ''}</div>
      ${body ? `<div class="space-y-2 px-4 pt-2 text-[15px] leading-relaxed text-zinc-800 lg:px-5 lg:pl-12 dark:text-zinc-200">${body}</div>` : ''}
      <div class="flex gap-2.5 p-3 pt-3.5 lg:items-center lg:justify-end lg:px-5 lg:pb-4">${hint ? `<p class="mr-auto hidden text-xs text-amber-700/80 xl:block dark:text-amber-300/70">${hint}</p>` : ''}${buttons}</div></section>`;
  if (it.wait) {
    const w = it.wait, choices = w.kind === 'ask' && hasChoices(w.text);
    const body = rich(w.text, 'ask' + n, 'text-zinc-900 dark:text-zinc-100', w.kind === 'ask' ? n : 0)
      + (w.files?.length ? `<div class="flex gap-2 overflow-x-auto">${thumbs(w.files, 'w' + n, 'h-48 w-24')}</div>` : '');
    return card(w.kind === 'block' ? 'alert' : 'ask', `${esc(whoName(w.by))} ${w.kind === 'block' ? 'is blocked and needs you' : 'asks you'}`, body,
      choices ? `<button data-act="reply" class="${SECOND} flex-1 lg:flex-none">${ico('reply', 'size-4')}Reply${KBD('R')}</button>${sendAnswerBtn(n, 'flex-[1.4] lg:flex-none', true)}`
        : `<button data-act="reply" class="${PRIMARY} flex-1 lg:flex-none">${ico('reply', 'size-4')}Reply${KBD('R')}</button>`,
      choices ? 'Pick with 1–9, send with ⌘↵' : 'It continues after you reply');
  }
  if (it.status === 'proposed') return card('propose', `${esc(name)} proposed this`, m ? msgText(m, 'card' + n) : '<p class="text-sm text-amber-900/80 dark:text-amber-200/80">Nobody works on it until you approve.</p>',
    `<button data-act="status" data-n="${n}" data-v="dropped" class="${SECOND} flex-1 lg:flex-none">${ico('ban', 'size-4')}Won't do${KBD('W')}</button><button data-act="status" data-n="${n}" data-v="open" class="${PRIMARY} flex-[1.4] lg:flex-none">${ico('thumb', 'size-4.5')}Approve${KBD('A')}</button>`,
    'Nobody works on it until you approve');
  if (it.status === 'review') return card('done', `${esc(name)} finished this`, m ? msgText(m, 'card' + n) : '<p class="text-sm text-amber-900/80 dark:text-amber-200/80">Check its work, then accept or reopen.</p>',
    `<button data-act="reopen" data-n="${n}" class="${SECOND} flex-1 lg:flex-none">${ico('reopen', 'size-4')}Not yet${KBD('N')}</button><button data-act="status" data-n="${n}" data-v="done" class="${PRIMARY} flex-[1.4] lg:flex-none">${ico('check', 'size-4.5', '2.25')}Accept${KBD('A')}</button>`,
    'Not yet reopens it and asks what is missing');
  return it.reply ? `<div class="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">${ico('check', 'size-4', '2.25')}You replied. Waiting for your agent.</div>` : '';
}

const statusTone = it => it.status === 'doing' ? 'text-blue-600 dark:text-blue-400' : needsYou(it) ? 'text-amber-600 dark:text-amber-400' : it.status === 'done' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400';

function detailHtml(it) {
  const n = it.n, files = filesOf(it), children = kids.get(n) || [], parent = it.parent && byN.get(it.parent), shown = cardMsg(it);
  const thread = it.thread.filter(x => x.id !== it.wait?.id && x.id !== shown?.id), hidden = U.more.has(n) ? 0 : Math.max(0, thread.length - 8);
  const chips = [
    it.type === 'rule' ? '' : `<button data-act="item-menu" class="${CHIP} shrink-0 ${it.pri === 'P0' ? 'font-semibold text-red-600 dark:text-red-400' : 'font-semibold text-zinc-700 dark:text-zinc-200'}">${it.pri}</button>`,
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
  const docs = docsOf(n).length ? `<section class="flex flex-col gap-2">${SECTION('Documents')}${docsOf(n).map(d => `<button data-act="doc-open" data-d="${d.d}" class="flex w-full items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 text-left dark:border-zinc-800">${ico('doc', 'size-5 text-zinc-500 dark:text-zinc-400')}<span class="min-w-0 flex-1"><span class="block truncate text-[15px] font-medium">${esc(d.title)}</span><span class="block text-xs text-zinc-500 dark:text-zinc-400">D${d.d} · ${plural(d.comments.length, 'comment')} · ${when(d.t1)}</span></span>${ico('right', 'size-4 text-zinc-300 dark:text-zinc-600')}</button>`).join('')}</section>` : '';
  const subs = children.length || U.subFor === n ? `<section class="flex flex-col gap-2">
      ${SECTION(`Subitems${children.length ? ` · ${children.filter(k => CLOSED(k.status)).length}/${children.length}` : ''}`, U.subFor === n ? '' : `<button data-act="sub-new" data-n="${n}" class="-my-2.5 flex h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-blue-600 dark:text-blue-400">${ico('plus', 'size-4', '2')}Add</button>`)}
      ${children.length ? `<div class="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">${children.map(k => `<button data-act="goto" data-n="${k.n}" class="flex w-full items-start gap-3 px-3 py-3 text-left ${CLOSED(k.status) ? 'opacity-55' : ''}">${stateIcon(k.status, statusName(k))}<span class="min-w-0 flex-1 text-[15px] leading-snug ${CLOSED(k.status) ? 'line-through' : ''}"><span class="mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[k.type]}">${code(k.n)}</span>${esc(k.title)}</span></button>`).join('')}</div>` : ''}
      ${U.subFor === n ? `<div class="flex items-center gap-2"><input id="subTitle" class="${FIELD} min-w-0 flex-1" placeholder="Subitem of ${code(n)}" aria-label="Subitem title"><button data-act="sub-add" data-n="${n}" class="${PRIMARY}">Add</button><button data-act="sub-cancel" aria-label="Cancel" class="grid size-11 shrink-0 place-items-center rounded-full text-zinc-500">${ico('x', 'size-5')}</button></div>` : ''}
    </section>` : '';
  const talk = thread.length ? `<div class="flex flex-col gap-6 border-t border-zinc-100 pt-6 dark:border-zinc-800/70">
      ${hidden ? `<button data-act="more" data-n="${n}" class="-my-1 h-11 self-center rounded-lg px-3 text-sm font-medium text-blue-600 dark:text-blue-400">Show ${hidden} earlier</button>` : ''}
      ${thread.slice(hidden).map(x => msgHtml(x, '', 0, answerOf(thread, x))).join('')}</div>` : '';
  return `<div class="flex flex-col gap-6 px-5 pt-5 pb-10 lg:mx-auto lg:w-full lg:max-w-[46rem] lg:px-8 lg:pt-9">${[head, needsCard(it), desc,
    files.length ? `<div class="flex items-end gap-2 overflow-x-auto">${thumbs(files, 'item' + n, 'h-24 w-16')}</div>` : '', docs, subs, talk].filter(Boolean).join('')}</div>`;
}

function renderDetail() {
  const it = U.open && byN.get(U.open), body = $('detailBody');
  if (desk()) renderGoStrip();
  if (!it) {  // the desktop's detail pane with nothing selected
    if (desk()) {
      const back = D.compose && D.prev && byN.has(D.prev);
      $('dActs').innerHTML = ''; $('itemMenuBtn').hidden = true;
      $('dHead').innerHTML = D.compose ? `<span class="flex items-center gap-2 text-sm font-semibold">${ico('newinput', 'size-[18px] text-blue-600 dark:text-blue-400')}New input</span>` : '';
      $('dNav').innerHTML = back ? `<button data-act="compose-back" class="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">${ico('left', 'size-4')}Back to ${code(D.prev)}${KBD('Esc')}</button>` : '';
      body.innerHTML = D.compose ? composePane() : noSelection();
    }
    return;
  }
  $('itemMenuBtn').hidden = false;
  const top = body.scrollTop, keep = keepEdit();
  $('dHead').innerHTML = `<span class="hidden lg:inline">${stateIcon(it.status, statusName(it), 'size-[18px]')}</span><span class="font-mono text-sm font-bold ${TYPE_TEXT[it.type]}">${code(it.n)}</span><span class="text-[11px] font-semibold tracking-wider uppercase"><span class="${statusTone(it)}">${statusName(it)}</span>${it.wait ? `<span class="text-zinc-300 dark:text-zinc-600"> · </span><span class="text-amber-600 dark:text-amber-400">${needLabel(it)}</span>` : ''}</span>`;
  if (desk()) renderDetailBar(it);
  body.innerHTML = detailHtml(it);
  body.scrollTop = top;
  restoreEdit(keep);
}

// "⋯": everything you change now and then, out of the way of reading. Tiles for actions, segmented controls
// for type and priority, and the status grid with the same icons as the list (T65).
const STATE_ON = {proposed: 'text-amber-400 dark:text-amber-600', review: 'text-amber-400 dark:text-amber-600', doing: 'text-blue-400 dark:text-blue-600', done: 'text-emerald-400 dark:text-emerald-600', open: 'text-zinc-400 dark:text-zinc-500', dropped: 'text-zinc-400 dark:text-zinc-500'};  // icons on the dark "selected" fill
function itemMenu(n) {
  if (desk()) return itemMenuDesk(n);
  const it = byN.get(n);
  if (!it) return;
  U.sheet = 'menu';
  const tile = (act, icon, label, sub = '', attrs = '') => `<button data-act="${act}" data-n="${n}" ${attrs} class="flex h-19 flex-col items-center justify-center gap-1.5 rounded-2xl bg-zinc-100 px-1 text-[13px] leading-tight font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">${ico(icon, 'size-5.5 text-zinc-600 dark:text-zinc-300')}<span class="text-center">${label}${sub ? `<span class="block text-[11px] font-normal text-zinc-500 dark:text-zinc-400">${sub}</span>` : ''}</span></button>`;
  const state = it.archived ? tile('archive', 'archive', 'Unarchive', '', 'data-on="0"')
    : CLOSED(it.status) ? tile('archive', 'archive', 'Archive', '', 'data-on="1"')
    : it.type === 'rule' ? '' : tile('swipe', 'clock', it.when === 'now' ? 'Later' : 'Back to now', '', `data-f="when" data-v="${it.when === 'now' ? 'later' : 'now'}"`);
  const lab = t => `<div class="px-1 pb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">${t}</div>`;
  const stat = ([s, t]) => { const on = it.status === s;
    return `<button data-act="set-field" data-n="${n}" data-f="status" data-v="${s}" aria-pressed="${on}" class="flex h-11 min-w-0 items-center gap-1.5 rounded-xl px-2.5 text-[13px] font-medium whitespace-nowrap ${on ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}">${stateIcon(s, t, 'size-4.5', on ? STATE_ON[s] : STATE_ICON[s][1])}<span class="truncate">${t}</span></button>`; };
  const statuses = it.type === 'rule' ? Object.entries(RULE_STATUS).filter(([v]) => v !== 'proposed' || it.status === 'proposed') : Object.entries(STATUS);
  dialog('', `<div class="flex flex-col gap-5">
    <div class="grid grid-cols-3 gap-2">${tile('edit', 'pencil', 'Edit')}${tile('copy', 'copy', 'Copy for agent')}${tile('doc-new', 'docplus', 'New doc')}
      ${tile('sub-new', 'listplus', 'Add subitem')}${tile('reparent', 'indent', 'Move…', it.parent ? `now under ${code(it.parent)}` : '')}${state}</div>
    <div>${lab('Type')}${segctl('set-field', 'type', [...TYPES, 'rule'].map(t => [t, letterOf(t) + `<span class="truncate">${t[0].toUpperCase() + t.slice(1)}</span>`]), it.type).replaceAll('data-k="type"', `data-f="type" data-n="${n}"`)}</div>
    ${it.type === 'rule' ? '' : `<div>${lab('Priority')}${segctl('set-field', 'pri', ['P0', 'P1', 'P2', 'P3'].map(p => [p, p === 'P0' ? '<span class="font-semibold text-red-600 dark:text-red-400">P0</span>' : p]), it.pri).replaceAll('data-k="pri"', `data-f="pri" data-n="${n}"`)}</div>`}
    <div>${lab('Status')}<div class="grid grid-cols-3 gap-1.5">${statuses.map(stat).join('')}</div></div>
  </div>`, {head: `<span class="block truncate text-[15px] font-semibold"><span class="mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[it.type]}">${code(n)}</span>${esc(it.title)}</span>`, focus: false});
}

const STATUS_FILTER = {active: 'Not finished', wait: 'Needs you', proposed: 'Proposed', doing: 'In progress', review: 'In review', done: 'Done', dropped: "Won't do", archived: 'Archived'};
// Rows hang under their parent when both are in the same group (I59); one whose parent is elsewhere stands alone.
function tree(group) {
  const inG = new Set(group.map(it => it.n)), out = [];
  const add = (it, d) => { out.push(itemRow(it, d, group)); if (!U.folded.has(it.n) && d < 8) for (const k of group) if (k.parent === it.n) add(k, d + 1); };
  for (const it of group) if (!(it.parent && inG.has(it.parent))) add(it, 0);
  return out.join('');
}
const EMPTY = (text, extra = '') => `<div class="px-6 py-16 text-center text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">${text}${extra}</div>`;

function renderItems() {
  const list = $('list'), top = U.open ? U.listTop?.[0] : list.scrollTop;  // under the item page the list is hidden and reads 0
  SW.open = SW.el = null;  // rows are rebuilt closed; a stale reference would swallow the next tap
  const rows = visible();
  $('nItems').textContent = (U.tab === 'items' ? rows : visible('items')).filter(it => !it.archived).length;
  $('nRules').textContent = S.items.filter(it => it.type === 'rule' && !it.merged_into && !it.archived && it.status !== 'dropped').length || '';
  $('nArchTab').textContent = S.items.filter(it => it.archived && !it.merged_into).length || '';
  renderFilters();
  let html = '';
  if (!S.items.length) {
    html = EMPTY(`No items yet.<br>Write your first thought below${S.org.on ? ' and the organizer turns it into items' : ' and your coding agent turns it into items'}.`, `<br><button data-act="guide" class="mt-3 h-11 text-blue-600 dark:text-blue-400">Connect a coding agent</button>`);
  } else if (!rows.length && filtered()) {
    html = EMPTY('No matching items', `<br><button data-act="reset" class="mt-3 h-11 text-blue-600 dark:text-blue-400">Clear search and filters</button>`);
  } else if (U.tab === 'rules') {
    // Rules: the ones an agent proposed wait on you; then the rules in force, then the retired ones.
    const wait = rows.filter(it => it.status === 'proposed'), on = rows.filter(it => it.status === 'open'), off = rows.filter(it => it.status === 'dropped');
    html = !rows.length ? EMPTY('No rules yet.<br>Rules are standing instructions for agents in this project,<br>for example how to write commit messages or who reviews.<br>Say one in the box below and it is filed here.')
      : (wait.length ? zone('needs', 'Needs you', wait.length) + wait.map(needsRow).join('') : '')
      + (on.length ? zone('rules', 'Active', on.length) + on.map(it => itemRow(it)).join('') : '')
      + (off.length ? zone('retired', 'Retired', off.length) + off.map(it => itemRow(it)).join('') : '');
  } else if (U.tab === 'archive') {
    html = rows.length ? rows.map(it => itemRow(it)).join('') : EMPTY('Nothing archived yet.<br>Archive finished items from the end of the Items list, or from an item\'s ⋯.');
  } else {
    // Items, in the order of your loop (T65 "Needs you first"): what waits on you, the agent's queue, finished work.
    const going = desk() && U.go, needs = rows.filter(it => needsYou(it) || (going && going.done.has(it.n) && going.list.includes(it.n)));
    const settled = it => going && going.done.has(it.n) && going.list.includes(it.n);
    const queue = rows.filter(it => !needsYou(it) && !settled(it) && !CLOSED(it.status) && !it.archived && it.type !== 'rule').sort(queueOrder);
    const done = rows.filter(it => CLOSED(it.status) && !it.archived && !settled(it)), arch = rows.filter(it => it.archived);
    html = (needs.length ? zone('needs', 'Needs you', needs.filter(needsYou).length, going ? `<span class="text-xs font-medium text-amber-700 dark:text-amber-400">· Going through</span><button data-act="go-end" class="-my-1 ml-auto flex h-11 items-center gap-1 rounded-full pr-2 pl-3 text-[13px] font-semibold text-amber-800 dark:text-amber-300">End${KBD('Esc')}</button>` : goThroughBtn())
        + needs.map(it => going && going.done.has(it.n) ? settledRow(it) : needsRow(it)).join('') : '')  // nothing waiting: no band (I71)
      + (queue.length ? zone('queue', 'Agent queue', queue.length, keepGoingSwitch()) + tree(queue) : '')
      + (U.undoArch ? `<div class="flex items-center gap-3 border-b border-blue-100 bg-blue-50 py-2 pr-2 pl-4 dark:border-blue-400/15 dark:bg-blue-400/10">
          ${ico('archive', 'size-5 text-blue-600 dark:text-blue-400')}
          <p class="min-w-0 flex-1 text-sm text-blue-950 dark:text-blue-100"><span class="font-semibold">Archived ${plural(U.undoArch.ids.length, 'finished item')}.</span> They are under Archive.</p>
          <button data-act="archive-undo" class="flex h-11 shrink-0 items-center gap-2 rounded-full bg-blue-600 pr-1.5 pl-4 text-[15px] font-semibold text-white shadow-sm shadow-blue-600/30 dark:bg-blue-500">${ico('undo', 'size-4.5', '2.25')}Undo
            <span id="undoLeft" class="grid size-8 place-items-center rounded-full bg-white/20 text-sm font-bold tabular-nums ring-2 ring-white/60">${U.undoArch.left}</span></button></div>`
        : done.length ? zone('done', 'Finished', done.length, archiveAllBtn(done.length)) + tree(done) : '')
      + (arch.length ? zone('archived', 'Archived', arch.length) + arch.map(it => itemRow(it)).join('') : '');
  }
  list.innerHTML = html;
  list.scrollTop = top || 0;
}

// The filters that are set, as [key, label] pairs.
const filtersSet = () => [
  U.type !== 'all' && U.tab !== 'rules' ? ['type', `<span class="font-mono text-xs font-bold ${TYPE_TEXT[U.type]}">${LETTER[U.type]}</span>${U.type[0].toUpperCase() + U.type.slice(1)}`] : null,
  U.when !== 'all' ? ['when', WHEN[U.when]] : null,
  U.status !== 'all' ? ['status', U.tab === 'rules' ? RULE_STATUS[U.status] || STATUS[U.status] : STATUS_FILTER[U.status]] : null,
  U.pri !== 'all' ? ['pri', U.pri] : null,
].filter(Boolean);
const filterChips = set => set.map(([k, label]) => `<button data-act="unfilter" data-k="${k}" class="${HIT} flex h-8 shrink-0 items-center gap-1 rounded-full bg-blue-50 pr-2 pl-3 text-[13px] font-medium text-blue-800 ring-1 ring-blue-200 ring-inset lg:h-7 dark:bg-blue-400/10 dark:text-blue-200 dark:ring-blue-400/25">${label}${ico('x', 'size-3.5', '2.25')}</button>`).join('');
// The filter button and, under the tabs, the filters that are set as chips you can remove one by one. On the
// desktop the same controls open in place under the list header instead of a sheet.
function renderFilters() {
  const set = filtersSet(), dot = set.length ? '<span class="absolute top-2 right-2 size-2 rounded-full bg-blue-600 ring-2 ring-white dark:bg-blue-400 dark:ring-zinc-950"></span>' : '';
  $('filterBtn').hidden = U.tab === 'inputs';
  $('filterBtn').innerHTML = ico('sliders', 'size-5') + dot;
  $('deskFilterBtn').hidden = U.tab === 'inputs';
  $('deskFilterBtn').innerHTML = ico('sliders', 'size-[18px]') + dot;
  $('deskFilterBtn').classList.toggle('bg-zinc-100', D.filters);
  const strip = $('filterStrip');
  strip.hidden = !set.length || U.tab === 'inputs' || !!U.open;
  strip.innerHTML = filterChips(set) + `<button data-act="reset" class="ml-auto h-11 shrink-0 px-1 text-[13px] font-semibold text-blue-600 dark:text-blue-400">Clear</button>`;
  if (!desk()) return;
  const all = visible(), total = S.items.filter(it => !it.merged_into && (U.tab === 'rules' ? it.type === 'rule' : U.tab === 'archive' ? it.archived : !it.archived && it.type !== 'rule')).length;
  $('deskFilters').innerHTML = !set.length && !D.filters ? '' : `<div class="flex min-h-11 flex-wrap items-center gap-2 px-3 py-1.5">${filterChips(set)}
      <span class="text-xs text-zinc-400">${all.length} of ${total}</span>
      ${set.length ? `<button data-act="reset" class="ml-auto h-8 px-1 text-[13px] font-semibold text-blue-600 dark:text-blue-400">Clear</button>` : '<span class="ml-auto"></span>'}
      <button data-act="filters" aria-label="${D.filters ? 'Fold the filters' : 'Show the filters'}" class="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">${ico(D.filters ? 'chevup' : 'down', 'size-4', '2')}</button></div>
    ${D.filters ? `<div class="flex flex-col gap-3 px-3 pb-3">${filterControls(true)}</div>` : ''}`;
}

// Filters live in a sheet: segmented controls and pills instead of dropdowns (T65).
const SEG_ON = 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-900/5 dark:bg-zinc-600 dark:text-white dark:ring-white/10';
const segctl = (act, key, opts, on, small = false) => `<div class="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">${opts.map(([v, t]) =>
  `<button data-act="${act}" data-k="${key}" data-v="${v}" aria-pressed="${v === on}" class="relative flex ${small ? 'h-7' : 'h-9'} min-w-0 flex-1 items-center justify-center gap-1 rounded-lg text-[13px] font-medium after:absolute after:inset-x-0 after:-inset-y-1 ${v === on ? SEG_ON : 'text-zinc-600 dark:text-zinc-300'}">${t}</button>`).join('')}</div>`;
const letterOf = t => `<span class="font-mono text-xs font-bold ${TYPE_TEXT[t]}">${LETTER[t]}</span>`;
function filterControls(small = false) {
  const lab = t => `<div class="px-1 ${small ? 'pb-1 text-[11px]' : 'pb-2 text-xs'} font-semibold text-zinc-500 dark:text-zinc-400">${t}</div>`;
  const pill = (v, t) => `<button data-act="set-filter" data-k="status" data-v="${v}" aria-pressed="${U.status === v}" class="relative ${small ? 'h-7 px-2.5' : 'h-9 px-3.5'} rounded-full text-[13px] font-medium after:absolute after:inset-x-0 after:-inset-y-1 ${U.status === v ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}">${t}</button>`;
  const statuses = U.tab === 'rules' ? [['all', 'All'], ...Object.entries(RULE_STATUS)] : [['all', 'All'], ...Object.entries(STATUS_FILTER)];
  return `${U.tab === 'rules' ? '' : `<div>${lab('Type')}${segctl('set-filter', 'type', [['all', 'All'], ...TYPES.map(t => [t, letterOf(t) + `<span class="truncate">${t[0].toUpperCase() + t.slice(1)}</span>`])], U.type, small)}</div>`}
    <div>${lab('When')}${segctl('set-filter', 'when', [['all', 'Any time'], ['now', 'Now'], ['later', 'Later']], U.when, small)}</div>
    <div>${lab('Status')}<div class="flex flex-wrap gap-1.5">${statuses.map(([v, t]) => pill(v, t)).join('')}</div></div>
    ${U.tab === 'rules' ? '' : `<div>${lab('Priority')}${segctl('set-filter', 'pri', [['all', 'Any'], ['P0', '<span class="font-semibold text-red-600 dark:text-red-400">P0</span>'], ['P1', 'P1'], ['P2', 'P2'], ['P3', 'P3']], U.pri, small)}</div>`}`;
}
function showFilters() {
  if (desk()) { D.filters = !D.filters; return render(); }
  const n = visible().length;
  U.sheet = 'filter';
  dialog('Filter', `<div class="flex flex-col gap-5">${filterControls()}
    <button data-act="close" class="${PRIMARY} w-full">Show ${plural(n, U.tab === 'rules' ? 'rule' : 'item')}</button>
  </div>`, {extra: filtered() ? `<button data-act="reset" class="h-11 rounded-full px-3 text-sm font-semibold text-blue-600 dark:text-blue-400">Clear all</button>` : '', focus: false});
}

function keepEdit() {
  const a = document.activeElement;
  const k = {focus: a && a.id && $('detailBody').contains(a) ? a.id : null, start: a?.selectionStart, end: a?.selectionEnd};
  for (const id of ['eTitle', 'eBody', 'eNext', 'subTitle']) if ($(id)) k[id] = $(id).value;
  return k;
}

function restoreEdit(k) {
  for (const id of ['eTitle', 'eBody', 'eNext', 'subTitle']) if ($(id) && k[id] !== undefined) $(id).value = k[id];
  if (k.focus && $(k.focus)) { const el = $(k.focus); el.focus({preventScroll: true}); try { el.setSelectionRange(k.start, k.end); } catch (_) {} }
}

// ---------------------------------------------------------------- inputs

function inputState(r) {  // -> [label, tone, icon]
  if (r.moved) return [`Moved to ${r.moved.to}`, 'text-zinc-500 dark:text-zinc-400', ico('arrow', 'size-3.5', '2')];
  if (S.org.busy === r.id) return ['Organizing…', 'text-blue-600 dark:text-blue-400', '<span class="size-1.5 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400"></span>'];
  if (r.org && !r.org.ok) return ['Organizer failed', 'text-red-600 dark:text-red-400', ico('alert', 'size-3.5', '2')];
  if (r.org?.undone) return ['Undone', 'text-zinc-500 dark:text-zinc-400', ico('undo', 'size-3.5', '2')];
  if (r.acked) return r.org?.keep ? ['Handled by your agent', 'text-zinc-400 dark:text-zinc-500', ico('check', 'size-3.5', '2.25')] : ['Organized', 'text-emerald-700 dark:text-emerald-400', ico('check', 'size-3.5', '2.25')];
  if (r.org) return ['Left for your agent', 'text-zinc-600 dark:text-zinc-300', ico('arrow', 'size-3.5', '2')];
  return [S.org.on ? 'Queued' : 'Waiting for your agent', 'text-zinc-600 dark:text-zinc-300', ico('hourglass', 'size-3.5', '2')];
}

const long = r => r.text.length > 160 || r.text.split('\n').length > 4;  // show four lines, the rest on demand
const dayOf = t => { const d = new Date(t), now = new Date(); return d.toDateString() === now.toDateString() ? 'Today' : new Date(now - 864e5).toDateString() === d.toDateString() ? 'Yesterday' : d.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}); };
// What you said, newest first, under day headers: your words in a light blue bubble, what became of them under it.
function renderInputs() {
  const words = U.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = [...S.inputs].reverse().filter(r => words.every(w => (r.id + ' ' + r.text).toLowerCase().includes(w)));
  let day = '';
  $('inputsView').innerHTML = rows.length ? rows.map(r => {
    const [label, tone, icon] = inputState(r), scope = r.scope ? byN.get(r.scope) : null, d = dayOf(r.t);
    const head = d !== day ? `<div class="px-4 pt-2.5 pb-0.5 text-xs font-semibold text-zinc-500 lg:px-0 lg:pt-5 lg:pb-1 dark:text-zinc-400">${(day = d)}</div>` : '';
    const note = !r.moved && r.org && !(r.acked && r.org.keep) ? `<div class="mt-1.5 flex min-h-5 items-center gap-1 text-xs ${r.org.ok ? 'text-zinc-500 dark:text-zinc-400' : 'text-red-600 dark:text-red-400'}">${ico('sparkle', 'size-3.5')}<span class="min-w-0">${esc(r.org.msg)}</span></div>` : '';
    const chips = r.moved ? '' : r.touched.filter(n => byN.has(n)).map(n => `<button data-act="goto" data-n="${n}" class="${HIT} flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-lg bg-zinc-100 px-2 text-[13px] dark:bg-zinc-800"><span class="font-mono text-xs font-bold ${TYPE_TEXT[byN.get(n).type]}">${code(n)}</span><span class="truncate">${esc(byN.get(n).title)}</span></button>`).join('');
    const acts = r.moved ? `<a href="/p/${encodeURIComponent(r.moved.to)}/" class="${LINK_BTN}">${ico('arrow', 'size-3.5', '2')}Open ${esc(r.moved.to)} · ${esc(r.moved.as)}</a>` : (!r.acked && S.org.on && r.org && (!r.org.ok || r.org.undone) ? `<button data-act="retry" data-id="${r.id}" class="${LINK_BTN}">${ico('loop', 'size-3.5', '2')}${r.org.undone ? 'Organize again' : 'Retry'}</button>` : '')
      + (r.org && r.org.ok && !r.org.undone && !r.org.keep && r.touched.length ? `<button data-act="undo" data-id="${r.id}" class="${LINK_BTN} text-zinc-600 dark:text-zinc-300">${ico('undo', 'size-3.5', '2')}Undo</button>` : '')
      + (!r.acked && !r.scope && !(S.org.on && !r.org) && S.org.busy !== r.id ? `<button data-act="make-item" data-id="${r.id}" class="${LINK_BTN}">${ico('plus', 'size-3.5', '2')}Make item</button>` : '')
      + (otherProjects().length && S.org.busy !== r.id ? `<button data-act="move-input" data-id="${r.id}" class="${LINK_BTN} text-zinc-600 dark:text-zinc-300">${ico('arrow', 'size-3.5', '2')}Move…</button>` : '');
    // On the desktop each input is a ledger line: what you said on the left, what became of it on the right.
    return `${head}<article class="border-b border-zinc-100 px-4 py-2 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10 lg:px-0 lg:py-4 dark:border-zinc-800/70"><div class="min-w-0">
      <div class="flex min-h-5 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400"><span class="font-mono">${r.id}</span><span>${when(r.t)}</span>
        ${scope ? `<button data-act="goto" data-n="${scope.n}" class="relative min-w-0 truncate text-blue-600 after:absolute after:inset-x-0 after:-inset-y-3 dark:text-blue-400">↳ ${code(scope.n)} ${esc(scope.title)}</button>` : ''}
        <span class="ml-auto flex shrink-0 items-center gap-1 font-medium lg:hidden ${tone}">${icon}${label}</span></div>
      <div class="mt-1.5 rounded-2xl rounded-tr-md bg-blue-50 px-3.5 py-2 text-[15px] leading-relaxed text-zinc-900 dark:bg-blue-400/10 dark:text-zinc-100">
        ${r.text ? rich(r.text, 'in' + r.id, long(r) && !U.moreInputs.has(r.id) ? 'max-h-28 overflow-hidden' : '') : ''}
        ${long(r) ? `<button data-act="more-input" data-id="${r.id}" class="-my-2 flex h-11 items-center text-sm font-medium text-blue-600 dark:text-blue-400">${U.moreInputs.has(r.id) ? 'Less' : 'More'}</button>` : ''}
        ${r.files.length ? `<div class="mt-2 flex items-end gap-2 overflow-x-auto">${thumbs(r.files, 'in' + r.id, 'size-11')}</div>` : ''}
      </div></div><div class="min-w-0 lg:pt-6">
      <div class="hidden items-center gap-1.5 text-[13px] font-semibold lg:flex ${tone}">${icon}${label}</div>
      ${note}${chips || acts ? `<div class="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1.5">${chips}${acts}</div>` : ''}
    </div></article>`;
  }).join('') : EMPTY(words.length ? 'No matching inputs' : 'No inputs yet.');
  if (desk() && rows.length) $('inputsView').innerHTML = `<div class="mx-auto max-w-5xl px-8 pb-6"><div class="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_20rem] gap-10 border-b border-zinc-200 bg-white pt-5 pb-2 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase dark:border-zinc-800 dark:bg-zinc-950"><span>You said</span><span>What became of it</span></div>${$('inputsView').innerHTML}</div>`;
}

// ---------------------------------------------------------------- composer

// On the desktop the selected item counts only while its pane shows (not on Inputs or the project page).
const detailShown = () => !desk() || (U.tab !== 'inputs' && !D.page);
const scopeN = () => (U.peek && byN.has(U.peek)) ? U.peek : (U.open && !U.scopeOff && byN.has(U.open) && detailShown()) ? U.open : null;
// Voice notes: desktop only (the user does not want them on the phone), and only where the browser allows it.
// Phones too: over https (the tunnel) they record fine. Plain http can't reach the microphone, so no button there.
const canRecord = () => !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

function renderComposer() {
  const n = scopeN(), sc = $('scope');
  // On the desktop the line above the box always starts with the project (B78): "[M] my-app ›".
  const proj = desk() && S.project ? `<span class="mr-0.5 flex shrink-0 items-center gap-1.5 font-semibold text-zinc-800 dark:text-zinc-100">${projTile(S.project, 'size-[18px] rounded-[5px] text-[10px]')}<span class="max-w-40 truncate">${esc(S.project)}</span><span class="font-normal text-zinc-400 dark:text-zinc-500">›</span></span>` : '';
  $('text').placeholder = desk() && S.project ? `Write to ${S.project}…` : 'Write anything…';
  sc.hidden = !n;
  if (!n && !U.open && U.tab === 'rules') { sc.hidden = false; sc.innerHTML = `${proj}${ico('scope', 'size-3.5')}<span class="font-medium">New rule for this project</span>`; }
  else if (!n && desk()) { sc.hidden = false; sc.innerHTML = `${proj}<span class="flex min-w-0 flex-1 items-center gap-1.5 text-zinc-500 dark:text-zinc-400">${ico('inbox', 'size-3.5')}<span class="truncate"><span class="font-medium text-zinc-700 dark:text-zinc-200">New input</span> · ${S.org?.on ? 'the organizer files it' : 'your agent files it'}</span></span>${U.open && detailShown() ? `<button data-act="reply" class="h-8 shrink-0 rounded-full px-2 text-[13px] font-medium text-blue-600 dark:text-blue-400">Add to ${code(U.open)} instead${KBD('R')}</button>` : ''}`; }
  if (n) sc.innerHTML = `${proj}${ico('scope', 'size-3.5')}<span class="min-w-0 flex-1 truncate"><span class="font-medium">${byN.get(n).wait ? 'Reply to' : 'Adding to'} ${code(n)}</span> ${esc(byN.get(n).title)}</span><button data-act="unscope" aria-label="Send to the whole project instead" class="-my-2 grid size-11 shrink-0 place-items-center rounded-full text-blue-600 dark:text-blue-300">${ico('x', 'size-4')}</button>`;
  const d = $('drafts');
  d.hidden = !U.files.length;
  d.innerHTML = U.files.map((f, i) => `<div class="relative shrink-0">${(f.mime || '').startsWith('audio/')
      ? `<div class="flex h-16 items-center gap-2 rounded-xl border border-zinc-200 px-3 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">${ico('mic', 'size-4')}<span class="font-mono tabular-nums">${clock(f.ms || 0)}</span><span class="font-semibold ${f.transcribing ? 'animate-pulse text-blue-600 dark:text-blue-400' : f.tr ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'}">${f.transcribing ? (U.sendWhenReady ? 'Sends when transcribed…' : 'Transcribing…') : f.tr ? 'Transcribed' : 'No transcript, audio still sent'}</span></div>`
      : (f.mime || '').startsWith('image/')
      ? `<img src="${f.preview || P + 'f/' + encodeURIComponent(f.f)}" alt="${esc(f.name)}" class="size-16 rounded-xl border border-zinc-200 object-cover dark:border-zinc-700 ${f.f ? '' : 'opacity-40'}">`
      : `<div class="flex h-16 w-28 items-center gap-1 rounded-xl border border-zinc-200 px-2 text-xs dark:border-zinc-700 ${f.f ? '' : 'opacity-40'}">${ico('file', 'size-4')}<span class="line-clamp-2 break-all">${esc(f.name)}</span></div>`}
    <button data-act="unfile" data-i="${i}" aria-label="Remove ${esc(f.name)}" class="absolute -top-3.5 -right-3.5 grid size-11 place-items-center"><span class="grid size-6 place-items-center rounded-full bg-zinc-900 text-white ring-2 ring-white dark:bg-zinc-100 dark:text-zinc-900 dark:ring-zinc-900">${ico('x', 'size-3.5', '2.5')}</span></button></div>`).join('');
  const waitingVoice = U.files.some(f => f.transcribing);
  const empty = !$('text').value.trim() && !U.files.length, voice = empty && !R.rec && !U.sending && canRecord();
  const sb = $('sendBtn'), icon = voice ? 'mic' : 'up';
  if (sb.dataset.icon !== icon) { sb.dataset.icon = icon; sb.innerHTML = ico(icon, voice ? 'size-6' : 'size-5'); }
  sb.dataset.act = voice ? 'mic' : 'send';
  sb.disabled = !voice && !R.rec && !waitingVoice && (U.sending || U.files.some(f => !f.f) || empty);
  sb.setAttribute('aria-label', voice ? 'Record a voice note' : R.rec ? 'Stop and send' : 'Send (Shift + Enter)');
  for (const id of ['attachBtn', 'text']) $(id).hidden = !!R.rec;
  $('micBtn').hidden = !!R.rec || voice || !canRecord();
  $('recBar').hidden = !R.rec;
  if (U.peek && !$('overlay').hidden) $('overlay').style.bottom = $('composer').parentElement.offsetHeight + 'px';  // sheet stays above the input box
}

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
    <div class="-mx-1 flex flex-col gap-0.5">${others.map(p => `<button data-act="move-input-to" data-id="${rid}" data-to="${esc(p.name)}" class="flex h-12 items-center gap-3 rounded-xl px-3 text-left hover:bg-zinc-100 active:bg-zinc-100 dark:hover:bg-zinc-800 dark:active:bg-zinc-800">${projTile(p.name, 'size-7 rounded-lg text-xs')}<span class="min-w-0 flex-1 truncate font-medium">${esc(p.name)}</span><span class="text-xs text-zinc-400">${p.open} open</span></button>`).join('') || '<p class="px-3 text-sm text-zinc-500">There is no other project.</p>'}</div>
    <p class="text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">It goes there with its files and is organized again.${made.length ? byOrg ? ` What the organizer made of it here is undone: ${list}.` : ` Items made from it here stay: ${list}.` : ''}${r.scope && byN.has(r.scope) ? ` It also leaves the conversation of ${code(r.scope)}.` : ''}</p></div>`);
}

function renderFeedback() {
  const fb = $('feedback'), r = U.lastSent && byR.get(U.lastSent);
  fb.hidden = !r;
  if (!r) return;
  const link = (act, label, attrs) => `<button data-act="${act}" ${attrs} class="-my-2 h-11 shrink-0 rounded-full px-2 font-semibold text-blue-600 dark:text-blue-400">${label}</button>`;
  let html;
  const move = otherProjects().length ? link('move-input', 'Move…', `data-id="${r.id}"`) : '';  // sent to the wrong project? (F79)
  if (r.moved) html = `${ico('arrow', 'size-4 text-zinc-500', '2')}<span class="min-w-0 flex-1 truncate">Moved ${r.id} to ${esc(r.moved.to)} as ${esc(r.moved.as)}</span><a href="/p/${encodeURIComponent(r.moved.to)}/" class="-my-2 flex h-11 shrink-0 items-center rounded-full px-2 font-semibold text-blue-600 dark:text-blue-400">Open</a>`;
  else if (S.org.busy === r.id || (!r.acked && S.org.on && !r.org)) html = `<span class="size-2 shrink-0 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400"></span><span class="min-w-0 flex-1 truncate">Got ${r.id}, organizing…</span>`;
  else if (r.org && !r.org.ok) html = `${ico('alert', 'size-4 text-red-600 dark:text-red-400', '2')}<span class="min-w-0 flex-1 truncate text-red-600 dark:text-red-400">Organizer failed: ${esc(r.org.msg)}</span>${link('retry', 'Retry', `data-id="${r.id}"`)}`;
  else if (r.org?.undone) html = `<span class="min-w-0 flex-1 truncate">Undid the changes for ${r.id}</span>`;
  else if (r.acked) html = `<span class="grid size-4 shrink-0 place-items-center rounded-full bg-emerald-500 text-white dark:bg-emerald-400 dark:text-emerald-950">${ico('check', 'size-3', '3')}</span><span class="min-w-0 flex-1 truncate">${esc(r.org?.msg || 'Organized')}</span>${r.touched.length ? link('goto', 'View', `data-n="${r.touched[0]}"`) : ''}${r.org && r.org.ok && !r.org.undone && !r.org.keep && r.touched.length ? link('undo', 'Undo', `data-id="${r.id}"`) : ''}${move}`;
  else html = `<span class="size-2 shrink-0 rounded-full bg-zinc-400"></span><span class="min-w-0 flex-1 truncate">Got ${r.id}. ${r.org ? 'Left for your coding agent' : 'Waiting for your coding agent'}</span>${move}`;
  const final = r.acked || (r.org && r.org.ok) || r.moved;
  clearTimeout(renderFeedback.t);
  if (final) renderFeedback.t = setTimeout(() => { if (U.lastSent === r.id) { U.lastSent = null; renderFeedback(); } }, 6000);
  fb.innerHTML = html + `<button data-act="dismiss" aria-label="Dismiss" class="-my-2 grid size-11 shrink-0 place-items-center rounded-full text-zinc-400">${ico('x', 'size-3.5', '2')}</button>`;
}

function grow() {  // empty = one line from the classes; measuring a placeholder before styles load makes it tall
  const t = $('text'); t.style.height = '';
  if (t.value) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 192) + 'px'; }
}

async function addFiles(list) {
  for (const file of list) {
    const f = {name: file.name || 'paste.png', mime: file.type || 'application/octet-stream'};
    if (f.mime.startsWith('image/')) f.preview = URL.createObjectURL(file);
    U.files.push(f); renderComposer();
    try {
      const r = await fetch(P + 'api/file?name=' + encodeURIComponent(f.name), {method: 'POST', headers: {'Content-Type': f.mime}, body: file});
      if (!r.ok) throw new Error();
      Object.assign(f, await r.json());
    } catch (_) { U.files.splice(U.files.indexOf(f), 1); toast('Upload failed: ' + f.name); }
    renderComposer();
  }
}

async function send() {
  if (R.rec) return finishRec(true);
  if (U.files.some(f => f.transcribing)) { U.sendWhenReady = true; return renderComposer(); }  // sent once the transcript is in
  const text = $('text').value.trim();
  if (U.sending || (!text && !U.files.length) || U.files.some(f => !f.f || f.transcribing)) return;
  U.sending = true; renderComposer();
  try {
    const d = await op({op: 'input', text, scope: scopeN() ? code(scopeN()) : null, ...(U.tab === 'rules' && !U.open ? {from: 'rules'} : {}), files: U.files.map(({f, name, mime, size, tr}) => ({f, name, mime, size, ...(tr ? {tr} : {})}))});
    U.lastSent = d.res[0].split(' ')[1];
    $('text').value = ''; U.files = []; saveDraft(); grow();
    if (U.peek && U.go && scopeN() === U.peek) advance(U.peek);  // going through: your reply settles this one
    else if (desk() && U.go && U.open && !U.scopeOff && U.go.list.includes(U.open)) advanceDesk(U.open, 'Replied');
  } catch (_) {} finally { U.sending = false; render(); }
}

// ---------------------------------------------------------------- voice

const R = {rec: null, chunks: [], stream: null, t0: 0, tick: 0, ctx: null, levels: []};
const clock = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

async function startRec() {
  if (!canRecord()) return toast('Recording needs https or localhost in this browser');
  try { R.stream = await navigator.mediaDevices.getUserMedia({audio: true}); }
  catch (_) { return toast('No microphone permission'); }
  R.chunks = []; R.levels = [];
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
    $('recBars').innerHTML = R.levels.map(l => `<span class="w-[3px] shrink-0 rounded-full bg-red-400" style="height:${Math.round(4 + l * 24)}px"></span>`).join('');
  }, 100);
  renderComposer();
}

function stopRec() {
  return new Promise(done => {
    const rec = R.rec;
    if (!rec) return done(null);
    rec.onstop = () => done(new Blob(R.chunks, {type: rec.mimeType || 'audio/webm'}));
    rec.stop();
    clearInterval(R.tick);
    R.stream.getTracks().forEach(t => t.stop());
    R.ctx?.close();
    R.rec = null;
    $('recBars').innerHTML = ''; $('recTime').textContent = '0:00';
    renderComposer();
  });
}

async function finishRec(andSend) {
  const ms = Date.now() - R.t0, blob = await stopRec();
  if (!blob) return;
  if (ms < 800 || !blob.size) return toast('Too short, discarded');
  const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  const f = {name: `voice ${clock(ms).replace(':', '-')}.${ext}`, mime: blob.type, ms, transcribing: true};
  U.files.push(f); renderComposer();
  try {
    const scope = scopeN() ? '&scope=' + code(scopeN()) : '';
    const r = await fetch(`${P}api/file?name=${encodeURIComponent(f.name)}&transcribe=1${scope}`, {method: 'POST', headers: {'Content-Type': blob.type || 'audio/webm'}, body: blob});
    if (!r.ok) throw new Error();
    Object.assign(f, await r.json());
  } catch (_) { U.files.splice(U.files.indexOf(f), 1); f.transcribing = false; renderComposer(); return toast('Could not upload the recording'); }
  f.transcribing = false;
  if (f.tr) {
    const t = $('text');
    t.value = (t.value.trim() ? t.value.trimEnd() + '\n' : '') + f.tr;
    grow(); saveDraft();
  } else toast('Transcription failed. The audio is kept and can be sent as is.');
  const go = andSend || U.sendWhenReady;
  U.sendWhenReady = false;
  renderComposer();
  if (go) send();
}

async function cancelRec() { await stopRec(); toast('Recording discarded. Your text and images are still here.'); }

function saveDraft() { try { localStorage.setItem('taska.draft', $('text').value); } catch (_) {} }

// ---------------------------------------------------------------- dialogs + viewer

// Every sheet: a handle, a title row (or `head`), optional `extra` buttons beside the close button, an optional
// `sub` line under it and a fixed `foot`. The focus card (`card`) floats above the input box instead.
function dialog(title, html, {aboveComposer = false, focus = true, tall = false, card = false, head = '', extra = '', sub = '', foot = '', pop = false} = {}) {
  if (head) $('dlgTitle').innerHTML = head; else $('dlgTitle').textContent = title;
  $('dlgExtra').innerHTML = extra;
  $('dlgSub').innerHTML = sub; $('dlgSub').hidden = !sub;
  $('dlgFoot').innerHTML = foot; $('dlgFoot').hidden = !foot;
  $('dlgBody').classList.toggle('pb-[max(1.25rem,env(safe-area-inset-bottom))]', !foot); $('dlgBody').classList.toggle('pb-3', !!foot);
  $('dlgBody').innerHTML = html; $('overlay').hidden = false;
  for (const c of ['h-[88dvh]', 'sm:h-[85dvh]']) $('dlg').classList.toggle(c, tall);  // documents get the whole screen
  for (const c of ['rounded-3xl', 'shadow-2xl', 'overflow-hidden', 'max-h-[92%]']) $('dlg').classList.toggle(c, card);
  for (const c of ['rounded-t-3xl', 'max-h-[88dvh]']) $('dlg').classList.toggle(c, !card);
  for (const c of ['px-2', 'pb-2']) $('overlay').classList.toggle(c, card);
  for (const c of ['lg:items-start', 'lg:justify-end', 'lg:bg-transparent', 'dark:lg:bg-transparent', 'lg:pt-[3.75rem]', 'lg:pr-3']) $('overlay').classList.toggle(c, pop && desk());
  for (const c of ['lg:w-[24rem]', 'lg:max-h-[80dvh]', 'lg:rounded-2xl', 'lg:ring-1', 'lg:ring-zinc-900/10', 'dark:lg:ring-white/10']) $('dlg').classList.toggle(c, pop && desk());
  $('overlay').style.bottom = aboveComposer ? $('composer').parentElement.offsetHeight + 'px' : '';  // keep the input box usable
  if (focus) $('dlgClose').focus({preventScroll: true});
}
const closeDialog = () => {
  if (U.docEdit) saveDoc();  // closing the editor keeps what you wrote
  if (U.doc) U.docScroll[U.doc] = $('dlgBody').scrollTop;
  U.doc = null; U.docNew = null; U.docEdit = false; U.sheet = null; U.go = null;
  $('overlay').hidden = true; $('overlay').style.bottom = '';
  if (U.peek) { U.peek = null; renderComposer(); }
};

// From outside this machine and its network Taska needs the key; one tap on the link puts it on a device for good.
// The bodies of the project sheets. The phone shows each in a sheet; the desktop puts them together on the
// "This project" page (I70).
function phoneHtml() {
  const link = S.remote ? S.remote + '/' : '';
  return `<div class="flex flex-col gap-5">
    <div><p class="px-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">${link ? 'Send this link to your phone and open it once. From then on Taska opens there just like here, from anywhere.' : 'Taska has no public address yet (start it with --public). On the same network your phone needs no key.'}</p>
    ${link ? `<div class="mt-2 rounded-xl bg-zinc-100 p-3 font-mono text-xs leading-relaxed break-all dark:bg-zinc-800">${esc(link)}</div>
    <button data-act="copy-text" data-text="${esc(link)}" class="${PRIMARY} mt-2.5 w-full">${ico('copy', 'size-4.5')}Copy link</button>` : ''}</div>
    <div><p class="px-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">Or type the key once on the device (Taska on the Home Screen needs this):</p>
    <div class="mt-2 flex items-center gap-2"><span class="min-w-0 flex-1 px-1 font-mono text-2xl tracking-wider select-all">${esc(S.key)}</span><button data-act="copy-text" data-text="${esc(S.key)}" class="${SECOND}">${ico('copy', 'size-4')}Copy key</button></div></div>
    <div><p class="px-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">This computer and your local network never need the key. A new key signs out every other device.</p>
    <button data-act="new-key" class="mt-1 h-11 rounded-xl px-1 text-sm font-semibold text-red-600 dark:text-red-400">New key</button></div></div>`;
}
const agentAsk = () => `This project tracks work in Taska. Run \`curl -s ${BASE}/agent\` to learn the interface, then follow \`curl -s ${BASE}/next\` and write your progress back to the items.`;
function guideHtml(text, fold = false) {  // fold: the desktop page keeps the long agent text behind a disclosure
  const connect = `curl -s ${BASE}/connect | sh`, far = S.remote && S.remote !== BASE ? `curl -s ${S.remote}/connect | sh` : '', short = agentAsk();
  const box = (t, mono = true) => `<div class="mt-2 rounded-xl bg-zinc-100 p-3 text-sm leading-relaxed break-all dark:bg-zinc-800 ${mono ? 'font-mono text-xs' : ''}">${esc(t)}</div>`;
  return `<div class="flex flex-col gap-5">
    <div><p class="px-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">On the machine where your agent works, run this once in the project's folder. It saves this project's address in <code>.taska</code> and installs the Taska skill for Claude Code, Codex and Antigravity:</p>
    ${box(connect)}<button data-act="copy-text" data-text="${esc(connect)}" class="${PRIMARY} mt-2.5 w-full">${ico('copy', 'size-4.5')}Copy command</button></div>
    ${far ? `<div><p class="px-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">On a machine outside this network, use this one instead (it carries the key):</p>
    ${box(far)}<button data-act="copy-text" data-text="${esc(far)}" class="${SECOND} mt-2.5 w-full">${ico('copy', 'size-4')}Copy</button></div>` : ''}
    <div><p class="px-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">Or just send this to the agent:</p>
    ${box(short, false)}<button data-act="copy-text" data-text="${esc(short)}" class="${SECOND} mt-2.5 w-full">${ico('copy', 'size-4')}Copy</button></div>
    ${!fold ? `<div><p class="px-1 text-sm text-zinc-600 dark:text-zinc-300">What the agent reads:</p>
    <pre class="mt-2 overflow-x-auto rounded-xl bg-zinc-50 p-3 text-xs leading-relaxed whitespace-pre-wrap dark:bg-zinc-950">${esc(text)}</pre></div>`
    : `<details class="group"><summary class="flex h-9 cursor-pointer items-center gap-1 px-1 text-sm text-zinc-600 dark:text-zinc-300">${ico('right', 'size-4 transition-transform group-open:rotate-90')}What the agent reads</summary>
    <pre class="mt-2 overflow-x-auto rounded-xl bg-zinc-50 p-3 text-xs leading-relaxed whitespace-pre-wrap dark:bg-zinc-950">${esc(text || 'Loading…')}</pre></details>`}</div>`;
}
const logHtml = lines => `<ol class="divide-y divide-zinc-100 font-mono text-xs leading-relaxed text-zinc-600 dark:divide-zinc-800 dark:text-zinc-300">${lines.map(l => `<li class="py-1.5 break-words">${esc(l)}</li>`).join('')}</ol>`;
function agentsHtml(connect = true) {
  const [tone, , line] = agentState(S.agents, S.work), ask = agentAsk();
  const queue = S.items.filter(it => !it.merged_into && !it.archived && it.type !== 'rule' && !needsYou(it) && (it.status === 'open' || it.status === 'doing')).length;
  const look = {bad: ['bg-red-50 dark:bg-red-400/10', 'bg-red-500 ring-4 ring-red-500/20 dark:bg-red-400', 'text-red-800 dark:text-red-200', 'text-red-700/80 dark:text-red-300/80'],
    ok: ['bg-emerald-50 dark:bg-emerald-400/10', 'bg-emerald-500 ring-4 ring-emerald-500/20 dark:bg-emerald-400', 'text-emerald-900 dark:text-emerald-100', 'text-emerald-800/80 dark:text-emerald-300/80'],
    idle: ['bg-zinc-100 dark:bg-zinc-800', 'bg-zinc-400 ring-4 ring-zinc-400/20', 'text-zinc-800 dark:text-zinc-100', 'text-zinc-500 dark:text-zinc-400']}[tone];
  const seen = [...(S.agents || [])].sort((a, b) => b.t - a.t).map(a => `<li class="flex h-11 items-center gap-3">${avatar(a.name)}<span class="min-w-0 flex-1 text-[15px]">${esc(AGENT_NAME[a.name] || a.name)}</span><span class="text-sm text-zinc-500 dark:text-zinc-400">${a.waiting ? 'waiting for work' : agoLong(a.t)}</span></li>`).join('');
  return `<div class="flex flex-col gap-5">
    <div class="flex gap-3 rounded-2xl p-4 ${look[0]}"><span class="mt-1.5 size-2.5 shrink-0 rounded-full ${look[1]}"></span>
      <div><p class="text-[15px] leading-snug font-semibold ${look[2]}">${esc(line)}</p><p class="mt-1 text-[13px] leading-snug ${look[3]}">${plural(queue, 'item')} in the queue · Keep going is ${S.cfg?.auto ? 'on' : 'off'}</p></div></div>
    ${seen ? `<div><div class="px-1 pb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Seen in this project</div><ul class="divide-y divide-zinc-100 px-1 dark:divide-zinc-800">${seen}</ul></div>` : ''}
    ${tone === 'ok' ? '' : `<div><p class="px-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">To get one working, open your coding agent in this project's folder and send it this:</p>
      <div class="mt-2 rounded-xl bg-zinc-100 p-3 text-sm leading-relaxed break-words text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">${esc(ask)}</div>
      <button data-act="copy-text" data-text="${esc(ask)}" class="${PRIMARY} mt-2.5 w-full">${ico('copy', 'size-4.5')}Copy</button></div>`}
    ${connect ? `<button data-act="guide" class="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-zinc-200 px-3.5 py-2.5 text-left dark:border-zinc-800">${ico('plug', 'size-5 text-zinc-500 dark:text-zinc-400')}
      <span class="min-w-0 flex-1"><span class="block text-[15px] font-medium">Connect a coding agent</span><span class="block text-xs text-zinc-500 dark:text-zinc-400">First time on that machine? Run one command there.</span></span>${ico('right', 'size-4 text-zinc-300 dark:text-zinc-600')}</button>` : ''}</div>`;
}
function showPhone() { dialog('Use on your phone', phoneHtml()); }
async function showGuide() { const text = await (await fetch(P + 'agent?ui=1')).text(); dialog('Connect a coding agent', guideHtml(text)); }
async function showLog() { const text = await (await fetch(P + 'log?n=300&ui=1')).text(); dialog('Change log', logHtml(text.trim().split('\n').reverse())); }

function showSources(n) {
  const it = byN.get(n);
  dialog(`Sources of ${code(n)}`, `<div class="flex flex-col gap-4">${it.srcs.map(id => byR.get(id)).filter(Boolean).map(r => `<div>
      <div class="px-1 text-xs text-zinc-500 dark:text-zinc-400"><span class="font-mono">${r.id}</span> · ${when(r.t)} · ${esc(who(r.by))}</div>
      <div class="mt-1.5 rounded-2xl rounded-tr-md bg-blue-50 px-3.5 py-2 text-[15px] leading-relaxed dark:bg-blue-400/10">${r.text ? rich(r.text, 'src' + r.id) : ''}
      ${r.files.length ? `<div class="mt-2 flex items-end gap-2 overflow-x-auto">${thumbs(r.files, 'src' + r.id)}</div>` : ''}</div>
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
  $('viewer').hidden = false; showImage(); $('vClose').focus();
}
function showImage() {
  const f = viewerGroup[viewerIdx], url = P + 'f/' + encodeURIComponent(f), img = $('vImg');
  img.className = 'm-auto max-h-full max-w-full object-contain'; $('vZoom').textContent = 'Actual size';
  img.src = url; $('vOpen').href = url; $('vName').textContent = f.replace(/^f\d+-/, '');
  $('vIdx').textContent = viewerGroup.length > 1 ? `${viewerIdx + 1} / ${viewerGroup.length}` : '';
  document.querySelector('[data-act="v-prev"]').disabled = viewerIdx === 0;
  document.querySelector('[data-act="v-next"]').disabled = viewerIdx === viewerGroup.length - 1;
}

// ---------------------------------------------------------------- wiring

function render() {
  showView(); renderItems(); renderDetail(); renderComposer(); renderFeedback(); renderAgent();
  if (desk()) { renderDeskHead(); renderSidebar(); renderRail(); renderFilters(); if (D.page) renderProject(); }
  if (U.peek && !$('overlay').hidden) { const top = $('dlgBody').scrollTop; peek(U.peek, {focus: false}); $('dlgBody').scrollTop = top; }
  if (U.doc && !U.docEdit && !U.docQuote && !$('overlay').hidden) renderDoc();
  if (U.tab === 'inputs') renderInputs();
  const pending = S.inputs.filter(r => !r.acked).length;
  $('nInputs').textContent = pending || '';
  $('nInputs').title = pending ? `${pending} not organized yet` : '';
  const waiting = S.items.filter(needsYou).length;
  $('projName').textContent = S.project || 'Taska';
  document.title = (waiting ? `(${waiting}) ` : '') + (S.project ? `${S.project} · Taska` : 'Taska');
  if (DR.open) renderDrawerSettings();
  if (AUD.el) audioUi();
}

// The item page covers the list and its tabs; the input box stays, now adding to that item. While you swipe the
// page away (F63) it floats above the list, so the list shows underneath.
function showView() {
  if (desk()) return showDesk();
  const d = !!U.open, lift = d && BK.pull, under = !d || lift, v = $('detailView');
  $('mainHead').hidden = $('tabs').hidden = !under;
  $('itemsView').hidden = !under || U.tab === 'inputs';
  $('inputsView').hidden = !under || U.tab !== 'inputs';
  v.hidden = !d;
  for (const c of ['absolute', 'inset-x-0', 'top-[env(safe-area-inset-top)]', 'z-20', 'bg-white', 'dark:bg-zinc-950', 'shadow-2xl']) v.classList.toggle(c, lift);
  v.style.bottom = lift ? $('composer').parentElement.offsetHeight + 'px' : '';
  if (!lift) { v.style.transform = ''; v.style.transition = ''; }
}

// Opening an item is a step in the browser's history, so Back, the back button and the phone's back swipe
// all return to the list where you were.
// On the desktop opening an item only selects it: the list stays, the detail pane shows it, and the address
// follows without adding history. Full width (O) is the step Back undoes there.
function openItem(n, push = true) {
  if (!n || !byN.has(n)) return closeItem();
  if (!U.open && !desk()) U.listTop = [$('list').scrollTop, $('inputsView').scrollTop];
  if (U.open !== n) { U.editing = null; U.subFor = null; }
  const fresh = U.open !== n;
  U.open = n; U.scopeOff = false;
  if (desk() && U.tab === 'inputs') { const it = byN.get(n); U.tab = it.archived ? 'archive' : it.type === 'rule' ? 'rules' : 'items'; }  // Inputs has no item pane
  if (desk()) { D.page = null; D.compose = false; history.replaceState(history.state?.full ? {n, full: true} : null, '', '#' + code(n)); }
  else if (push && location.hash !== '#' + code(n)) history.pushState({n}, '', '#' + code(n));
  render();
  if (fresh) $('detailBody').scrollTop = 0;
  if (desk()) document.querySelector(`#list [data-act="open"][data-n="${n}"]`)?.scrollIntoView({block: 'nearest'});
}

function closeItem() {
  if (!U.open) return;
  U.open = null; U.editing = null; U.subFor = null; BK.pull = false; D.full = false;
  if (location.hash) history.replaceState(null, '', location.pathname);
  render();
  if (!desk()) [$('list').scrollTop, $('inputsView').scrollTop] = U.listTop || [0, 0];
}

function setTab(t) {
  U.tab = t;
  if (desk()) { D.page = null; D.sideOpen = false; D.compose = false; return render(); }
  document.querySelectorAll('[data-tab]').forEach(b => b.getAttribute('aria-selected') !== null && b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  showView(); renderFilters();
  if (t === 'inputs') renderInputs(); else { renderItems(); $('list').scrollTop = 0; }
  renderComposer();
}

const SAID = {open: 'is open', doing: 'is in progress', done: 'is done', dropped: "is marked won't do", later: 'moved to Later', now: 'moved to Now', review: 'is in review', proposed: 'is proposed'};
// One-tap changes (swipes, row pills, the focus card) say what happened and offer Undo, which puts the old value back.
async function change(n, f, v) {
  const before = byN.get(n)?.[f];
  const said = f === 'archived' ? (v ? 'archived' : 'unarchived') : f === 'status' && v === 'done' && before === 'review' ? 'accepted' : f === 'status' && v === 'open' && before === 'proposed' ? 'approved' : SAID[v];
  const undo = () => { D.undo = null; return op({op: 'set', ref: code(n), f: {[f]: before}}).then(() => { if (U.go) { U.go.done.delete(n); render(); } toast(`${code(n)} put back`); }, () => {}); };
  const settles = desk() && U.go && U.go.list.includes(n) && f === 'status';
  if (settles) { U.go.done.add(n); U.go.how[n] = said.replace(/^is (marked )?/, '').replace(/^./, c => c.toUpperCase()); U.go.undo[n] = undo; }
  await op({op: 'set', ref: code(n), f: {[f]: v}});
  D.undo = undo;
  toast(`${code(n)} ${said}`, undo);
  if (settles && U.open === n) advanceDesk(n, U.go.how[n]);
}
// On the desktop the search box is always there: the clear button shows only with a query, the / hint only without.
const qSync = () => { $('qX').classList.toggle('lg:hidden', !U.q); $('qKey').classList.toggle('lg:grid', !U.q); };
const searchMode = on => {
  U.searching = on;
  $('headNormal').hidden = on; $('headSearch').hidden = !on;
  if (on) $('q').focus(); else { U.q = ''; $('q').value = ''; }
  renderItems(); if (U.tab === 'inputs') renderInputs();
};
const ACT = {
  auto: async () => {
    const on = !S.cfg?.auto;
    try { await op({op: 'cfg', auto: on}); renderDrawerSettings(); toast(on ? 'Keep going is on: your agent works down the list' : 'Keep going is off: your agent stops after the current item'); } catch (_) {}
  },
  search: () => searchMode(!U.searching),
  'search-clear': () => { U.q = ''; $('q').value = ''; $('q').focus(); qSync(); renderItems(); if (U.tab === 'inputs') renderInputs(); },
  reply: () => { U.scopeOff = false; renderComposer(); $('text').focus(); },
  status: async b => {
    const n = Number(b.dataset.n);
    try { await change(n, 'status', b.dataset.v); if (U.peek === n && U.go) advance(n); } catch (_) {}
  },
  // The action on a row that waits on you: Accept and Approve happen at once (with Undo); Answer and Reply open
  // the focus card on that item, Reply with the input box ready.
  'row-act': async b => {
    const n = Number(b.dataset.n), v = b.dataset.v;
    if (v === 'accept' || v === 'approve') { try { await change(n, 'status', v === 'accept' ? 'done' : 'open'); } catch (_) {} return; }
    U.go = null; peek(n);
    if (v === 'reply' || !hasChoices(byN.get(n)?.wait?.text)) $('text').focus();
  },
  'go-through': () => { if (desk()) return startGoDesk(); U.go = {list: needsList(), done: new Set()}; if (U.go.list.length) peek(U.go.list[0]); },
  'go-prev': () => { const g = U.go; if (!g) return; const i = g.list.indexOf(U.open); openItem(g.list[(i - 1 + g.list.length) % g.list.length]); },
  'go-end': () => { U.go = null; render(); },
  'go-undo': b => { const n = Number(b.dataset.n); U.go?.undo[n]?.(); },
  prev: () => stepItem(-1),
  next: () => stepItem(1),
  full: () => fullWidth(!D.full),
  side: () => { if (WIDE.matches) D.sideHidden = !D.sideHidden; else D.sideOpen = !D.sideOpen; render(); },
  keys: () => showKeys(),
  switch: () => projectSwitcher(),
  'new-input': () => {
    D.sideOpen = false; if (D.page) D.page = null;
    if (desk() && U.tab !== 'inputs') {  // its own page in the detail pane (B73), not under the open item
      U.go = null;
      if (U.open) D.prev = U.open;
      U.open = null; U.editing = null; U.subFor = null; D.full = false; D.compose = true;
      if (location.hash) history.replaceState(null, '', location.pathname);
    }
    U.scopeOff = true; render(); $('text').focus();
  },
  'compose-back': () => leaveCompose(),
  'project-back': () => { D.page = null; render(); },
  project: () => openProject('agents'),
  'go-next': () => {
    if (desk()) {
      const g = U.go; if (!g) return startGoDesk();
      const i = g.list.indexOf(U.open), next = [...g.list.slice(i + 1), ...g.list.slice(0, Math.max(0, i))].find(k => byN.get(k) && needsYou(byN.get(k)) && !g.done.has(k));
      return next ? openItem(next) : toast('Nothing else needs you');
    }
    const g = U.go, i = g ? g.list.indexOf(U.peek) : -1;
    const next = g && [...g.list.slice(i + 1), ...g.list.slice(0, i)].find(k => byN.get(k) && needsYou(byN.get(k)) && !g.done.has(k));
    if (next) peek(next, {focus: false}); else toast('Nothing else needs you');
  },
  reopen: async b => { const n = Number(b.dataset.n); try { await setStatus(n, 'doing'); U.scopeOff = false; renderComposer(); $('text').focus(); toast(`${code(n)} reopened. Say what is missing.`); } catch (_) {} },
  projects: () => openDrawer(),
  'new-project': async () => {
    const name = (prompt('Project name (a-z, 0-9 and -):') || '').trim().toLowerCase();
    if (!name) return;
    const d = await (await fetch('/api/projects', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name})})).json();
    if (d.ok) location.href = `/p/${d.name}/`; else toast(d.error || 'Not created');
  },
  guide: () => { if (desk()) return openProject('connect'); closeDrawer(); showGuide(); },
  'agent-info': () => desk() ? openProject('agents') : dialog('Agents', agentsHtml()),
  phone: () => { if (desk()) return openProject('phone'); closeDrawer(); showPhone(); },
  'new-key': async () => {
    if (!confirm('Make a new key? Every other device has to open the new link or type the new key.')) return;
    try { await fetch('/api/key', {method: 'POST'}); await load(); if (desk()) renderProject(); else showPhone(); toast('New key made'); } catch (_) { toast('Not saved'); }
  },
  log: () => { if (desk()) return openProject('log'); closeDrawer(); showLog(); },
  tab: b => setTab(b.dataset.tab),
  filters: () => showFilters(),
  'set-filter': b => { U[b.dataset.k] = b.dataset.v; if (desk()) return render(); renderItems(); $('list').scrollTop = 0; showFilters(); },
  unfilter: b => { U[b.dataset.k] = 'all'; if (desk()) return render(); renderItems(); },
  reset: () => {
    U.q = ''; U.type = 'all'; U.when = 'all'; U.status = 'all'; U.pri = 'all'; $('q').value = '';
    if (desk()) return render();
    renderItems(); if (U.tab === 'inputs') renderInputs(); if (U.sheet === 'filter') showFilters();
  },
  open: b => openItem(Number(b.dataset.n)),
  back: () => desk() ? fullWidth(false) : history.state?.n ? history.back() : closeItem(),
  'item-menu': () => itemMenu(U.open),
  'set-field': async b => {
    const n = Number(b.dataset.n);
    try { await op({op: 'set', ref: code(n), f: {[b.dataset.f]: b.dataset.v}}); if (!$('overlay').hidden) itemMenu(n); } catch (_) {}
  },
  goto: b => { closeDialog(); openItem(Number(b.dataset.n)); },
  more: b => { U.more.add(Number(b.dataset.n)); renderDetail(); },
  'more-input': b => { const id = b.dataset.id; if (U.moreInputs.has(id)) U.moreInputs.delete(id); else U.moreInputs.add(id); renderInputs(); },
  edit: b => { closeDialog(); U.editing = Number(b.dataset.n); renderDetail(); $('eBody')?.focus(); },
  'edit-cancel': () => { U.editing = null; renderDetail(); },
  'edit-save': async b => {
    const n = Number(b.dataset.n);
    try { await op({op: 'set', ref: code(n), f: {title: $('eTitle').value, body: $('eBody').value, next: $('eNext').value}}); U.editing = null; render(); toast('Saved'); } catch (_) {}
  },
  copy: b => { closeDialog(); copyItem(Number(b.dataset.n)); },
  'peek-set': async b => {
    const n = Number(b.dataset.n), f = b.dataset.f, going = !!U.go;
    if (!going) closeDialog();
    try { await change(n, f, f === 'archived' ? b.dataset.v === 'true' : b.dataset.v); if (going) advance(n); } catch (_) {}
  },
  play: b => playAudio(b),
  'doc-open': b => openDoc(Number(b.dataset.d)),
  'doc-new': b => newDoc(Number(b.dataset.n)),
  'doc-edit': () => { U.docEdit = true; U.docText = null; renderDoc(); $('docMd').focus(); },
  'doc-done': async () => { const d = await saveDoc(); if (d) openDoc(d.d); else closeDialog(); },
  'doc-pick': (b, e) => {
    if (U.docCircle || e.target.closest('textarea, button, a') || getSelection()?.toString().trim()) return;
    const k = b.dataset.key;
    if (U.docSel.has(k)) U.docSel.delete(k); else U.docSel.add(k);
    U.docQuote = null;
    renderDoc();
  },
  'doc-unpick': () => { U.docSel = new Set(); U.docQuote = null; U.docDrafts.note = ''; getSelection()?.removeAllRanges(); renderDoc(); },
  'doc-circle': () => { U.docCircle = !U.docCircle; renderDoc(); },
  'doc-thread': b => { const k = b.dataset.key; if (U.docThreads.has(k)) U.docThreads.delete(k); else U.docThreads.add(k); renderDoc(); },
  'doc-send': async b => {
    const key = b.dataset.key, text = (U.docDrafts[key] || '').trim();
    if (!text) return;
    try { await op({op: 'dc', d: Number(b.dataset.d), key, text}); U.docDrafts[key] = ''; renderDoc(); } catch (_) {}
  },
  'doc-comment': async () => {
    const d = docById(U.doc), text = ($('docNote')?.value || '').trim();
    if (!d || !text) return;
    const blocks = d.blocks.filter(b => U.docSel.has(b.key));
    const key = U.docQuote ? U.docQuote.key : blocks[0]?.key;
    const quote = U.docQuote ? U.docQuote.text : blocks.map(b => b.text).join('\n');
    try {
      await op({op: 'dc', d: d.d, key, quote, text});
      U.docThreads.add(key); U.docSel = new Set(); U.docQuote = null; U.docDrafts.note = '';
      getSelection()?.removeAllRanges(); renderDoc(); toast('Comment added');
    } catch (_) {}
  },
  swipe: async b => {
    const n = Number(b.dataset.n), f = b.dataset.f;
    SW.open = null; closeDialog();
    try { await change(n, f, f === 'archived' ? b.dataset.v === 'true' : b.dataset.v); } catch (_) {}
  },
  archive: async b => {
    const on = b.dataset.on === '1', n = Number(b.dataset.n);
    closeDialog();
    try { await op({op: 'set', ref: code(n), f: {archived: on}}); if (on && U.open === n) ACT.back(); toast(on ? `${code(n)} archived. Find it under Archive.` : `${code(n)} unarchived`); } catch (_) {}
  },
  choice: b => {
    const n = Number(b.dataset.n), i = Number(b.dataset.i);
    if (U.choice?.n !== n) U.choice = {n, picked: new Set()};
    const p = U.choice.picked;
    if (b.dataset.multi) p.has(i) ? p.delete(i) : p.add(i); else { p.clear(); p.add(i); }
    if (U.peek === n && !$('overlay').hidden) { const top = $('dlgBody').scrollTop; peek(n, {focus: false}); $('dlgBody').scrollTop = top; }
    else renderDetail();
  },
  'choice-send': async b => {  // the answer is an ordinary reply on the item: one line per pick
    const n = Number(b.dataset.n), labels = U.choiceLabels[n] || [], picked = U.choice?.n === n ? [...U.choice.picked].sort((a, c) => a - c) : [];
    if (!picked.length) return;
    try { await op({op: 'input', text: picked.map(i => '✓ ' + labels[i]).join('\n'), scope: code(n)}); U.choice = null; if (U.peek === n) advance(n); toast('Answer sent'); if (desk() && U.go && U.open === n) advanceDesk(n, 'Answered'); } catch (_) {}
  },
  'more-msg': b => {
    const id = Number(b.dataset.id);
    U.moreMsgs.has(id) ? U.moreMsgs.delete(id) : U.moreMsgs.add(id);
    if (U.peek && !$('overlay').hidden) { const top = $('dlgBody').scrollTop; peek(U.peek, {focus: false}); $('dlgBody').scrollTop = top; } else renderDetail();
  },
  fold: b => { const n = Number(b.dataset.n); U.folded.has(n) ? U.folded.delete(n) : U.folded.add(n); renderItems(); },
  'sub-new': b => { closeDialog(); U.subFor = Number(b.dataset.n); renderDetail(); $('subTitle')?.focus(); },
  'sub-cancel': () => { U.subFor = null; renderDetail(); },
  'sub-add': async b => {  // same kind, priority and now/later as the parent; change them after if needed
    const n = Number(b.dataset.n), p = byN.get(n), title = ($('subTitle')?.value || '').trim();
    if (!title) return $('subTitle')?.focus();
    try { await op({op: 'new', title, parent: code(n), type: p.type === 'rule' ? 'task' : p.type, pri: p.pri, when: p.when}); U.subFor = null; U.folded.delete(n); render(); toast(`Added under ${code(n)}`); } catch (_) {}
  },
  'move-to': async b => {
    const n = Number(b.dataset.n), to = b.dataset.to;
    closeDialog();
    try { await op({op: 'set', ref: code(n), f: {parent: to}}); toast(to !== 'none' ? `${code(n)} is now under ${to}` : `${code(n)} stands on its own`); } catch (_) {}
  },
  reparent: async b => {
    if (desk()) { closeDialog(); return movePicker(Number(b.dataset.n)); }
    const n = Number(b.dataset.n), it = byN.get(n);
    closeDialog();
    const to = prompt(`Put ${code(n)} under which item? Type its code${it.parent ? `, or leave empty to take it out of ${code(it.parent)}` : ''}.`, '');
    if (to === null) return;
    try { await op({op: 'set', ref: code(n), f: {parent: to.trim() || 'none'}}); toast(to.trim() ? `${code(n)} is now under ${to.trim().toUpperCase()}` : `${code(n)} stands on its own`); } catch (_) {}
  },
  'make-item': async b => {  // no organizer and no agent around: turn the input into an item yourself
    const r = byR.get(b.dataset.id), lines = r.text.trim().split('\n'), first = lines[0].trim();
    const title = (first || `Files from ${r.id}`).slice(0, 120), body = first.length > 120 ? r.text.trim() : lines.slice(1).join('\n').trim();
    try {
      const d = await op({op: 'new', title, body, src: r.id});
      const n = Number((d.res[0].match(/[A-Z](\d+) new/) || [])[1]);
      if (n) { ACT.goto({dataset: {n: String(n)}}); toast(`${code(n)} made from ${r.id}. Set its type and priority.`); }
    } catch (_) {}
  },
  'archive-all': async () => {  // no question first: it happens at once, and Undo stays in the same spot for 3 seconds
    const ids = visible().filter(it => !it.archived && CLOSED(it.status)).map(it => it.n);
    if (!ids.length) return;
    try { await op(ids.map(n => ({op: 'set', ref: code(n), f: {archived: true}}))); } catch (_) { return; }
    clearInterval(U.undoArch?.timer);
    const u = U.undoArch = {ids, left: 3};
    u.timer = setInterval(() => {
      if (--u.left > 0) { const el = $('undoLeft'); if (el) el.textContent = u.left; return; }
      clearInterval(u.timer);
      if (U.undoArch === u) { U.undoArch = null; renderItems(); }
    }, 1000);
    renderItems();
  },
  'archive-undo': async () => {
    const u = U.undoArch;
    if (!u) return;
    clearInterval(u.timer); U.undoArch = null;
    try { await op(u.ids.map(n => ({op: 'set', ref: code(n), f: {archived: false}}))); toast(`Put back ${plural(u.ids.length, 'item')}`); } catch (_) { renderItems(); }
  },
  'copy-text': b => copy(b.dataset.text),
  sources: b => showSources(Number(b.dataset.n)),
  close: closeDialog,
  attach: () => $('fileInput').click(),
  mic: startRec,
  'rec-stop': () => finishRec(false),
  'rec-cancel': cancelRec,
  unfile: b => { U.files.splice(Number(b.dataset.i), 1); renderComposer(); },
  unscope: () => { U.scopeOff = true; renderComposer(); $('text').focus(); },
  send,
  dismiss: () => { U.lastSent = null; renderFeedback(); },
  undo: async b => {
    const r = await fetch(P + 'api/undo', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id: b.dataset.id})});
    const d = await r.json();
    if (!d.ok) return toast(d.error || 'Could not undo');
    U.lastSent = b.dataset.id; await load(); toast(`Undid the organizer's changes for ${b.dataset.id}`);
  },
  'move-input': b => moveInput(b.dataset.id),
  'move-input-to': async b => {
    const id = b.dataset.id, to = b.dataset.to;
    b.disabled = true;
    try {
      const d = await (await fetch(P + 'api/move', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, to})})).json();
      if (!d.ok) return toast(d.error || 'Could not move it');
      closeDialog(); U.lastSent = id; await load(); toast(`Moved ${id} to ${to} as ${d.as}`);
    } finally { b.disabled = false; }
  },
  retry: async b => { await fetch(P + 'api/organize', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id: b.dataset.id})}); U.lastSent = b.dataset.id; },
  view: b => openViewer(b.dataset.g, b.dataset.f),
  'v-close': () => { $('viewer').hidden = true; $('vImg').removeAttribute('src'); },
  'v-prev': () => { if (viewerIdx > 0) { viewerIdx--; showImage(); } },
  'v-next': () => { if (viewerIdx < viewerGroup.length - 1) { viewerIdx++; showImage(); } },
  'v-zoom': b => { const img = $('vImg'), fit = img.classList.contains('max-w-full'); img.className = fit ? 'm-auto max-w-none' : 'm-auto max-h-full max-w-full object-contain'; b.textContent = fit ? 'Fit to screen' : 'Actual size'; },
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
$('list').addEventListener('contextmenu', e => { if (SW.pressed || SW.press && e.target.closest('[data-swipe]') && matchMedia('(pointer: coarse)').matches) e.preventDefault(); });

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
  $('projectView').hidden = !page;
  $('foot').hidden = page;
  $('deskFilters').hidden = page || full || inputs || !(D.filters || filtersSet().length);
  $('mainHead').classList.toggle('lg:col-span-2', inputs);
  for (const el of [$('detailView'), $('foot')]) {  // one wide page: the inputs, or an item at full width
    el.classList.toggle('lg:col-start-1', wide); el.classList.toggle('lg:col-start-2', !wide); el.classList.toggle('lg:col-span-2', wide);
  }
  const rail = !WIDE.matches || D.sideHidden, over = rail && D.sideOpen;
  $('rail').hidden = !rail;
  $('drawer').hidden = rail && !over;
  $('drawer').classList.toggle('lg:relative', !over);
  for (const c of ['lg:fixed', 'lg:shadow-2xl']) $('drawer').classList.toggle(c, over);
  $('drawerShade').hidden = !over; $('drawerShade').style.left = over ? $('drawer').offsetWidth + 'px' : '';
}

const TAB_NAME = {items: 'Items', inputs: 'Inputs', archive: 'Archive', rules: 'Rules'};
const TAB_ICON = {items: 'items', inputs: 'inbox', archive: 'archive', rules: 'book'};
const tabCount = t => t === 'items' ? $('nItems').textContent : t === 'inputs' ? $('nInputs').textContent : t === 'archive' ? $('nArchTab').textContent : $('nRules').textContent;
function renderDeskHead() {
  const pending = S.inputs.filter(r => !r.acked).length;
  $('deskTitle').innerHTML = `<h1 class="text-[17px] font-semibold tracking-tight">${TAB_NAME[U.tab]}</h1><span class="text-sm text-zinc-400 tabular-nums">${U.tab === 'inputs' ? (pending ? `${pending} not organized yet` : '') : tabCount(U.tab)}</span>`;
  $('q').placeholder = U.tab === 'inputs' ? 'Search what you said' : 'Search items';
  qSync();
  $('headSearch').firstElementChild.classList.toggle('lg:max-w-sm', U.tab === 'inputs');
  $('headSearch').firstElementChild.classList.toggle('lg:ml-auto', U.tab === 'inputs');
}

// The sidebar: this project as a card with its agent and its tabs, the other projects, and this project's settings.
function renderSidebar() {
  const needs = S.items.filter(needsYou).length;
  const tab = t => `<button data-act="tab" data-tab="${t}" class="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm ${U.tab === t && !D.page ? 'bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-700/60 dark:text-zinc-50' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700/40'}">${ico(TAB_ICON[t], 'size-4 opacity-70')}<span class="min-w-0 flex-1">${TAB_NAME[t]}</span>
      ${t === 'items' && needs ? `<span class="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white dark:bg-amber-400 dark:text-amber-950">${needs}</span>` : ''}<span class="font-mono text-[11px] text-zinc-400 tabular-nums">${tabCount(t)}</span></button>`;
  const others = (DR.list || []).filter(p => p.name !== S.project).map(p => { const [tone, label] = agentState(p.agents, p.work);
    return `<a href="/p/${encodeURIComponent(p.name)}/" class="flex items-center gap-2.5 rounded-xl px-3 py-1.5 hover:bg-zinc-200/60 dark:hover:bg-zinc-800">${projTile(p.name, 'size-5 rounded-md text-[10px]')}
      <span class="min-w-0 flex-1"><span class="block truncate text-sm font-medium">${esc(p.name)}</span><span class="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400"><span class="size-1.5 shrink-0 rounded-full ${AGENT_TONE[tone][0]}"></span><span class="truncate ${tone === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : AGENT_TONE[tone][1]}">${esc(label)}</span><span class="shrink-0">· ${p.open} open</span></span></span>
      ${p.needs ? `<span class="grid h-5 min-w-5 place-items-center rounded-full bg-amber-100 px-1 text-[11px] font-bold text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">${p.needs}</span>` : ''}</a>`; }).join('');
  const open = S.items.filter(it => !it.merged_into && !it.archived && !CLOSED(it.status) && it.type !== 'rule').length;
  $('drawerList').innerHTML = `<div class="mb-2 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-zinc-900/5 dark:bg-zinc-800 dark:ring-white/5">
      <div class="flex items-center gap-2 px-1.5 pt-1">${projTile(S.project, 'size-6 rounded-lg text-xs')}<span class="min-w-0 flex-1 truncate text-[15px] font-semibold">${esc(S.project)}</span><span class="text-xs text-zinc-400">${open} open</span></div>
      <div id="deskAgent" class="px-1 pt-1 pb-1.5"></div>
      <div class="flex flex-col gap-px">${['items', 'inputs', 'archive', 'rules'].map(tab).join('')}</div></div>${others}`;
  $('newInputBtn').setAttribute('aria-pressed', String(D.compose));
  renderAgent(); renderDrawerSettings();
}

// Below 1280px the sidebar is a rail of icons; the logo or [ brings the whole sidebar over the page.
function renderRail() {
  const needs = S.items.filter(needsYou).length, other = (DR.list || []).some(p => p.name !== S.project && p.needs), [tone] = agentState(S.agents, S.work);
  const b = (act, inner, title, attrs = '', on = false) => `<button data-act="${act}" ${attrs} title="${title}" aria-label="${title.split(' · ')[0]}" class="relative grid size-10 place-items-center rounded-xl ${on ? 'bg-zinc-200/80 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50' : 'text-zinc-500 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800'}">${inner}</button>`;
  const badge = (n, amber) => n ? `<span class="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold ${amber ? 'bg-amber-500 text-white dark:bg-amber-400 dark:text-amber-950' : 'bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:text-zinc-100'}">${n}</span>` : '';
  $('rail').innerHTML = b('side', `<span class="text-blue-600 dark:text-blue-400">${ico('logo', 'size-6', '2.25')}</span>`, 'Show the sidebar · [')
    + b('new-input', ico('newinput', 'size-5'), 'New input · C', '', D.compose)
    + `<div class="my-1 h-px w-8 bg-zinc-200 dark:bg-zinc-800"></div>`
    + b('switch', `${projTile(S.project, 'size-7 rounded-lg text-xs')}${other ? '<span class="absolute top-1 right-1 size-2.5 rounded-full bg-amber-500 ring-2 ring-zinc-50 dark:bg-amber-400 dark:ring-zinc-900"></span>' : ''}`, `${S.project} · switch project: G P`)
    + ['items', 'inputs', 'archive', 'rules'].map(t => b('tab', ico(TAB_ICON[t], 'size-5') + badge(t === 'items' ? needs : t === 'inputs' ? Number(tabCount('inputs')) || 0 : 0, t === 'items'), TAB_NAME[t], `data-tab="${t}"`, U.tab === t && !D.page)).join('')
    + `<div class="flex-1"></div>`
    + b('agent-info', `${avatar('claude-code')}<span class="absolute right-1.5 bottom-1.5 size-2.5 rounded-full ring-2 ring-zinc-50 dark:ring-zinc-900 ${AGENT_TONE[tone][0]}"></span>`, agentState(S.agents, S.work)[2])
    + b('project', ico('sliders', 'size-5'), 'This project', '', !!D.page)
    + b('keys', ico('keyboard', 'size-5'), 'Keyboard shortcuts · ?');
}

// The desktop's New input page (B73): no item in sight, so it is plain the words go to the project. Under it, what
// you said lately and what became of it, so a new input can be followed into the items it turns into.
function composePane() {
  const recent = [...S.inputs].reverse().slice(0, 6), back = D.prev && byN.has(D.prev);
  const tip = (k, what) => `<span class="inline-flex items-center">${KBD(k)}<span class="ml-1.5">${what}</span></span>`;
  return `<div class="mx-auto w-full max-w-[46rem] px-8 pt-9 pb-6">
    <h1 class="text-[22px] leading-tight font-semibold tracking-tight">Say something new</h1>
    <p class="mt-2 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300">For <span class="font-semibold text-zinc-900 dark:text-zinc-100">${esc(S.project)}</span>: a bug, an idea, a task, a screenshot or a voice note. ${S.org?.on ? 'The organizer turns it into items, or adds it to the ones that already exist.' : 'Your coding agent turns it into items.'}</p>
    <p class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-zinc-500 dark:text-zinc-400">${tip('⌘↵', 'Send')}${canRecord() ? tip('V', 'Voice note') : ''}<span>Paste or drop screenshots</span>${tip('Esc', back ? 'Back to ' + code(D.prev) : 'Close')}</p>
    ${recent.length ? `<h2 class="mt-10 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">You said lately</h2>
      <div class="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800/70">${recent.map(recentInput).join('')}</div>
      <button data-act="tab" data-tab="inputs" class="mt-1 flex h-9 items-center text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">All inputs${KBD('G N')}</button>` : ''}
  </div>`;
}
function leaveCompose() {  // back to the item you had open, if there was one
  const p = D.prev; D.compose = false; D.prev = null;
  if (p && byN.has(p)) openItem(p); else render();
}
function recentInput(r) {
  const [label, tone, icon] = inputState(r), scope = r.scope && byN.get(r.scope);
  const said = r.text || (r.files.some(f => (f.mime || '').startsWith('audio/')) ? 'Voice note' : `${r.files.length} file${r.files.length === 1 ? '' : 's'}`);
  const chips = r.touched.filter(n => byN.has(n)).map(n => `<button data-act="goto" data-n="${n}" class="flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-lg bg-zinc-100 px-2 text-[13px] hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"><span class="font-mono text-xs font-bold ${TYPE_TEXT[byN.get(n).type]}">${code(n)}</span><span class="truncate">${esc(byN.get(n).title)}</span></button>`).join('');
  return `<div class="py-3"><div class="flex min-w-0 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400"><span class="font-mono">${r.id}</span><span class="shrink-0">${when(r.t)}</span>${scope ? `<span class="min-w-0 truncate">↳ ${code(scope.n)} ${esc(scope.title)}</span>` : ''}<span class="ml-auto flex shrink-0 items-center gap-1 font-medium ${tone}">${icon}${label}</span></div>
    <p class="mt-1 line-clamp-2 text-[15px] leading-snug break-words text-zinc-800 dark:text-zinc-200">${esc(said)}</p>
    ${chips ? `<div class="mt-2 flex flex-wrap gap-1.5">${chips}</div>` : ''}</div>`;
}

const noSelection = () => `<div class="grid h-full place-items-center p-8 text-center"><div>
  <p class="text-[15px] text-zinc-500 dark:text-zinc-400">Select an item</p>
  <p class="mt-2 flex items-center justify-center gap-1 text-[13px] text-zinc-400">${KBD('J')}${KBD('K')}<span class="ml-1">to move</span>${S.items.some(needsYou) ? `<span>·</span>${KBD('⇧J')}<span class="ml-1">to go through what needs you</span>` : ''}</p></div></div>`;

function renderDetailBar(it) {
  const b = (act, icon, title, attrs = '') => `<button data-act="${act}" ${attrs} title="${title}" aria-label="${title.split(' · ')[0]}" class="grid size-9 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">${ico(icon, 'size-[18px]')}</button>`;
  $('dActs').innerHTML = b('copy', 'copy', 'Copy for agent · ⇧C', `data-n="${it.n}"`)
    + (it.archived ? b('archive', 'archive', 'Unarchive · E', `data-n="${it.n}" data-on="0"`) : CLOSED(it.status) ? b('archive', 'archive', 'Archive · E', `data-n="${it.n}" data-on="1"`)
      : it.type === 'rule' ? '' : b('swipe', 'clock', it.when === 'now' ? 'Later · L' : 'Back to now · L', `data-n="${it.n}" data-f="when" data-v="${it.when === 'now' ? 'later' : 'now'}"`));
  $('dNav').innerHTML = b('prev', 'chevup', 'Previous · K') + b('next', 'down', 'Next · J') + b('full', D.full ? 'shrink' : 'open', D.full ? 'Back to the list · Esc' : 'Full width · O');
}

// Going through what needs you on the desktop: an amber strip on the detail pane; what you settle stays in the
// list, green, with Undo, until you end it.
function renderGoStrip() {
  const g = U.go, el = $('goStrip');
  el.hidden = !(g && desk());
  if (el.hidden) return;
  const i = g.list.indexOf(U.open);
  const b = (act, label, key) => `<button data-act="${act}" class="flex h-8 items-center gap-1 rounded-lg px-2 font-medium text-zinc-700 hover:bg-amber-100 dark:text-zinc-200 dark:hover:bg-amber-400/15">${label}${KBD(key)}</button>`;
  el.innerHTML = `<span class="text-xs font-bold tracking-wide text-amber-700 uppercase dark:text-amber-400">Needs you</span><span class="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">${i < 0 ? '–' : i + 1} of ${g.list.length}</span>
    <span class="flex w-40 gap-1">${g.list.map(k => `<span class="h-1 flex-1 rounded-full ${k === U.open ? 'bg-amber-500 dark:bg-amber-400' : g.done.has(k) ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-zinc-200 dark:bg-zinc-700'}"></span>`).join('')}</span>
    <span class="ml-auto flex items-center gap-0.5">${b('go-prev', 'Previous', '⇧K')}${b('go-next', 'Skip', '⇧J')}${b('go-end', 'End', 'Esc')}</span>`;
}
function settledRow(it) {
  const how = U.go.how[it.n] || 'Done';
  return `<article data-n="${it.n}" class="relative border-b border-zinc-100 dark:border-zinc-800/70"><div data-act="open" data-n="${it.n}" class="group relative flex cursor-pointer items-center gap-2.5 py-2.5 pr-3 pl-4 ${rowTint(it)}">
      <span class="absolute inset-y-0 left-0 w-1 bg-emerald-500 dark:bg-emerald-400"></span>
      <span class="self-start">${stateIcon('done', how)}</span>
      <div class="min-w-0 flex-1"><p class="line-clamp-1 text-[15px] leading-snug font-medium text-zinc-500 dark:text-zinc-400"><span class="mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[it.type]}">${code(it.n)}</span>${esc(it.title)}</p>
        <div class="mt-1 flex min-w-0 items-center gap-2 text-xs font-medium"><span class="shrink-0 font-semibold text-emerald-700 dark:text-emerald-400">✓ ${how}</span><span class="min-w-0 truncate font-normal text-zinc-500 dark:text-zinc-400">${esc(excerpt(it))}</span></div></div>
      ${U.go.undo[it.n] ? `<button data-act="go-undo" data-n="${it.n}" class="flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10">${ico('undo', 'size-4', '2')}Undo</button>` : ''}</div></article>`;
}
function startGoDesk(from) {
  const list = needsList();
  if (!list.length) return toast('Nothing needs you right now');
  U.go = {list, done: new Set(), how: {}, undo: {}};
  openItem(list.includes(from) ? from : list[0]);
}
function advanceDesk(from, how) {  // after you settle one: the next that still waits on you
  const g = U.go;
  if (!g) return;
  g.done.add(from); g.how[from] = how;
  const left = g.list.filter(k => !g.done.has(k) && byN.get(k) && needsYou(byN.get(k)));
  const next = left.find(k => g.list.indexOf(k) > g.list.indexOf(from)) ?? left[0];
  if (next) openItem(next);
  else { U.go = null; render(); toast('Nothing else needs you'); }
}
// J / K and the arrows in the detail bar walk the rows as the list shows them.
function stepItem(dir) {
  const rows = [...document.querySelectorAll('#list [data-act="open"][data-n]')].map(el => Number(el.dataset.n));
  if (!rows.length) return;
  const i = rows.indexOf(U.open), n = rows[i < 0 ? (dir > 0 ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, i + dir))];
  if (n !== U.open) openItem(n);
}
function fullWidth(on) {
  if (!U.open || on === D.full) return;
  if (on) { D.full = true; history.pushState({n: U.open, full: true}, '', '#' + code(U.open)); render(); }
  else if (history.state?.full) history.back();  // popstate leaves full width
  else { D.full = false; render(); }
}

// "This project": the agents, connecting one, the phone, the change log and the settings, on one page (A, screen 5).
const P_CACHE = {guide: null, log: null};
function openProject(sec) {
  D.page = 'project'; D.sideOpen = false; U.go = null;
  render();
  Promise.all([fetch(P + 'agent?ui=1').then(r => r.text()), fetch(P + 'log?n=80&ui=1').then(r => r.text())])
    .then(([g, l]) => { P_CACHE.guide = g; P_CACHE.log = l.trim().split('\n').reverse(); if (D.page) renderProject(); }).catch(() => {});
  requestAnimationFrame(() => document.getElementById('p-' + sec)?.scrollIntoView({block: 'start'}));
}
function renderProject() {
  if (!D.page) return;
  const card = (id, icon, title, body) => `<section id="p-${id}" class="scroll-mt-20 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      ${title ? `<h2 class="mb-4 flex items-center gap-2.5 text-[15px] font-semibold">${ico(icon, 'size-5 text-zinc-500 dark:text-zinc-400')}${title}</h2>` : ''}${body}</section>`;
  const top = $('projectView').scrollTop;
  $('projectView').innerHTML = `<header class="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950">
      <h1 class="text-[17px] font-semibold">${esc(S.project)}</h1><span class="text-sm text-zinc-400">This project</span>
      <button data-act="project-back" class="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">${ico('left', 'size-4')}Back to ${TAB_NAME[U.tab]}${KBD('Esc')}</button></header>
    <div class="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_22rem] gap-5 px-6 py-6">
      <div class="flex min-w-0 flex-col gap-5">
        ${card('agents', 'loop', 'Agents', agentsHtml(false))}
        ${card('connect', 'plug', 'Connect a coding agent', guideHtml(P_CACHE.guide, true))}
        ${card('log', 'history', 'Change log', P_CACHE.log ? logHtml(P_CACHE.log) : '<p class="text-sm text-zinc-400">Loading…</p>')}
      </div>
      <div class="flex min-w-0 flex-col gap-5">
        ${card('keep', '', '', `<div class="flex items-start gap-3">${ico('loop', 'mt-0.5 size-5 text-emerald-600 dark:text-emerald-400')}<div class="min-w-0 flex-1"><p class="text-[15px] font-semibold">Keep going</p><p class="mt-0.5 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">Agents take the next item without stopping. Off: they stop after the current one.</p></div>
          <button data-act="auto" aria-pressed="${!!S.cfg?.auto}" aria-label="Keep going" class="group relative h-6.5 w-11 shrink-0 rounded-full bg-zinc-300 transition-colors aria-pressed:bg-emerald-500 dark:bg-zinc-600"><span class="absolute top-0.75 left-0.75 size-5 rounded-full bg-white shadow transition-transform group-aria-pressed:translate-x-4.5"></span></button></div>`)}
        ${card('phone', 'phone', 'Use on your phone', phoneHtml())}
        ${card('info', '', '', `<dl class="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-y-1.5 text-[13px]"><dt class="text-zinc-500">Project</dt><dd>${esc(S.project)}</dd><dt class="text-zinc-500">Data</dt><dd class="font-mono text-xs break-all">${esc(S.file)}</dd><dt class="text-zinc-500">Organizer</dt><dd>${S.org?.on ? 'Gemini · ' + esc(S.org.model) : 'off (set GEMINI_API_KEY and restart)'}</dd></dl>`)}
      </div></div>`;
  $('projectView').scrollTop = top;
}

// The ⋯ menu on the desktop: a popover with the actions as rows, each with its key, then type, priority, status.
function itemMenuDesk(n) {
  const it = byN.get(n);
  if (!it) return;
  U.sheet = 'menu';
  const row = (act, icon, label, key, attrs = '', sub = '') => `<button data-act="${act}" data-n="${n}" ${attrs} class="flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">${ico(icon, 'size-[18px] text-zinc-500 dark:text-zinc-400')}<span class="min-w-0 flex-1 truncate">${label}${sub ? `<span class="ml-2 text-xs text-zinc-400">${sub}</span>` : ''}</span>${key ? `<kbd class="grid h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold text-zinc-400 ring-1 ring-zinc-300 dark:ring-zinc-600">${key}</kbd>` : ''}</button>`;
  const lab = (t, keys) => `<div class="flex items-center justify-between px-1 pb-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">${t}<span class="font-normal text-zinc-400">${keys}</span></div>`;
  const stat = ([v, t]) => { const on = it.status === v;
    return `<button data-act="set-field" data-n="${n}" data-f="status" data-v="${v}" aria-pressed="${on}" class="flex h-8 min-w-0 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium whitespace-nowrap ${on ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'}">${stateIcon(v, t, 'size-4', on ? STATE_ON[v] : STATE_ICON[v][1])}<span class="truncate">${t}</span></button>`; };
  const statuses = it.type === 'rule' ? Object.entries(RULE_STATUS).filter(([v]) => v !== 'proposed' || it.status === 'proposed') : Object.entries(STATUS);
  const state = it.archived ? row('archive', 'archive', 'Unarchive', 'E', 'data-on="0"') : CLOSED(it.status) ? row('archive', 'archive', 'Archive', 'E', 'data-on="1"')
    : it.type === 'rule' ? '' : row('swipe', 'clock', it.when === 'now' ? 'Later' : 'Back to now', 'L', `data-f="when" data-v="${it.when === 'now' ? 'later' : 'now'}"`);
  dialog('', `<div class="flex flex-col gap-3">
    <div class="-mx-1">${row('edit', 'pencil', 'Edit', 'I')}${row('copy', 'copy', 'Copy for agent', '⇧C')}${row('doc-new', 'docplus', 'New doc', '⇧D')}${row('sub-new', 'listplus', 'Add subitem', '⇧A')}${row('reparent', 'indent', 'Move under…', 'M', '', it.parent ? 'now under ' + code(it.parent) : 'stands on its own')}${state}</div>
    <div class="border-t border-zinc-100 pt-3 dark:border-zinc-800">${lab('Type', 'T')}${segctl('set-field', 'type', [...TYPES, 'rule'].map(t => [t, letterOf(t) + `<span class="truncate">${t[0].toUpperCase() + t.slice(1)}</span>`]), it.type, true).replaceAll('data-k="type"', `data-f="type" data-n="${n}"`)}</div>
    ${it.type === 'rule' ? '' : `<div>${lab('Priority', 'P')}${segctl('set-field', 'pri', ['P0', 'P1', 'P2', 'P3'].map(p => [p, p === 'P0' ? '<span class="font-semibold text-red-600 dark:text-red-400">P0</span>' : p]), it.pri, true).replaceAll('data-k="pri"', `data-f="pri" data-n="${n}"`)}</div>`}
    <div>${lab('Status', 'S')}<div class="grid grid-cols-3 gap-1">${statuses.map(stat).join('')}</div></div>
  </div>`, {pop: true, focus: false, head: `<span class="block truncate text-sm font-semibold"><span class="mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[it.type]}">${code(n)}</span>${esc(it.title)}</span>`});
}
// Move under… on the desktop: pick the parent from a list you can type into, instead of typing a code.
function movePicker(n) {
  const it = byN.get(n), below = new Set([n]);
  const walk = k => { for (const c of kids.get(k) || []) if (!below.has(c.n)) { below.add(c.n); walk(c.n); } };
  walk(n);
  U.sheet = 'move'; U.moveFor = n;
  dialog('', `<div class="flex flex-col gap-2"><input id="moveQ" class="${FIELD} lg:h-9 lg:py-0 lg:text-sm" placeholder="Put ${code(n)} under…" autocomplete="off">
    <div id="moveList" class="-mx-1 max-h-80 overflow-y-auto"></div></div>`, {pop: true, focus: false, head: `<span class="text-sm font-semibold">Move ${code(n)}</span>`});
  const draw = () => {
    const words = $('moveQ').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const cands = S.items.filter(c => !below.has(c.n) && !c.merged_into && !c.archived && c.type !== 'rule' && words.every(w => hay(c).includes(w)))
      .sort((a, b) => CLOSED(a.status) - CLOSED(b.status) || a.n - b.n).slice(0, 40);  // open items first
    $('moveList').innerHTML = cands.map(c => `<button data-act="move-to" data-n="${n}" data-to="${code(c.n)}" class="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${c.n === it.parent ? 'bg-blue-50 dark:bg-blue-400/10' : ''}">${stateIcon(c.status, statusName(c), 'size-4')}<span class="font-mono text-xs font-bold ${TYPE_TEXT[c.type]}">${code(c.n)}</span><span class="min-w-0 flex-1 truncate">${esc(c.title)}</span></button>`).join('')
      + `<button data-act="move-to" data-n="${n}" data-to="none" class="mt-1 flex h-9 w-full items-center gap-2.5 rounded-lg border-t border-zinc-100 px-2.5 text-left text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800">${ico(it.parent ? 'x' : 'check', 'size-4 text-zinc-500')}Stands on its own</button>`;
  };
  draw();
  $('moveQ').addEventListener('input', draw);
  $('moveQ').focus();
}

const KEYS = [
  ['Move', [['J / K', 'Next or previous item'], ['⇧J / ⇧K', 'Next or previous item that needs you (Go through)'], ['O or ↵', 'Full width; Esc goes back'], ['Space', 'Scroll the item'], ['G then I N A R', 'Items, Inputs, Archive, Rules'], ['G then P', 'Switch project'], ['[', 'Show or hide the sidebar']]],
  ['Act on the selected item', [['A', 'The amber action: Accept, Approve or Answer'], ['R', 'Reply or add to it'], ['N', 'Not yet: reopen and say what is missing'], ['1–9, ⌘↵', 'Pick a choice, send the answer'], ['D · W · L', "Done · Won't do · Later / Now"], ['E / ⇧E', 'Archive or unarchive / archive every finished item'], ['S · P · T', 'Status, priority, type (the ⋯ menu)'], ['M · ⇧C', 'Move under… · Copy for agent'], ['I · ⇧D · ⇧A', 'Edit · New doc · Add subitem'], ['.', 'All actions'], ['Z', 'Undo the last change']]],
  ['Write and find', [['C', 'New input to the project'], ['V', 'Record a voice note; V again stops'], ['⇧↵ or ⌘↵', 'Send'], ['/', 'Search'], ['F', 'Filters'], ['?', 'This sheet'], ['Esc', 'Step back one level']]],
];
function showKeys() {
  const sec = ([group, keys]) => `<section class="mb-5"><h3 class="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">${group}</h3>
    <dl class="flex flex-col gap-1.5 text-sm">${keys.map(([k, what]) => `<div class="flex items-baseline gap-3"><dt class="w-28 shrink-0 font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-200">${k}</dt><dd class="text-zinc-600 dark:text-zinc-300">${what}</dd></div>`).join('')}</dl></section>`;
  dialog('Keyboard shortcuts', `<div class="grid gap-x-8 sm:grid-cols-2"><div>${sec(KEYS[0])}${sec(KEYS[2])}</div><div>${sec(KEYS[1])}</div></div>`);  // moving and writing | acting
}
function projectSwitcher() {
  dialog('Switch project', `<div class="-mx-1 flex flex-col gap-0.5">${(DR.list || []).map(p => `<a href="/p/${encodeURIComponent(p.name)}/" class="flex h-11 items-center gap-3 rounded-xl px-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${p.name === S.project ? 'bg-zinc-100 font-semibold dark:bg-zinc-800' : ''}"><span class="min-w-0 flex-1 truncate">${esc(p.name)}</span>${p.needs ? `<span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">${p.needs} need you</span>` : ''}</a>`).join('')}</div>`);
  checkOthers.t = 0; checkOthers().then(() => { if (!$('overlay').hidden && $('dlgTitle').textContent === 'Switch project') projectSwitcher(); });
}

// One table drives the keys. Single keys only act while you are not typing; Esc first leaves a text field.
function deskKey(e) {
  if (!desk() || e.defaultPrevented) return;
  const el = document.activeElement, typing = /INPUT|TEXTAREA|SELECT/.test(el?.tagName) || el?.isContentEditable;
  if (typing || e.altKey || !$('viewer').hidden) return;
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && U.choice && U.choice.n === U.open) { e.preventDefault(); return document.querySelector(`[data-act="choice-send"][data-n="${U.open}"]`)?.click(); }
  if (e.metaKey || e.ctrlKey) return;
  if (!$('overlay').hidden) return;  // a sheet or menu is open: it has its own keys (Esc closes it)
  const k = e.key, it = U.open && byN.get(U.open), n = U.open;
  if (D.g && Date.now() - D.g < 1000) {  // G then a letter
    D.g = 0;
    const tab = {i: 'items', n: 'inputs', a: 'archive', r: 'rules'}[k.toLowerCase()];
    if (tab) { e.preventDefault(); return setTab(tab); }
    if (k.toLowerCase() === 'p') { e.preventDefault(); return projectSwitcher(); }
  }
  const act = (name, data = {}) => { e.preventDefault(); ACT[name]({dataset: {n: String(n), ...data}}, e); };
  const status = v => it && act('status', {v});
  switch (k) {
    case 'j': case 'ArrowDown': e.preventDefault(); return stepItem(1);
    case 'k': case 'ArrowUp': e.preventDefault(); return stepItem(-1);
    case 'J': e.preventDefault(); return U.go ? ACT['go-next']() : startGoDesk(U.open);
    case 'K': e.preventDefault(); return U.go ? ACT['go-prev']() : startGoDesk(U.open);
    case 'o': case 'Enter': if (it) { e.preventDefault(); fullWidth(!D.full); } return;
    case ' ': if (it) { e.preventDefault(); $('detailBody').scrollBy({top: (e.shiftKey ? -0.8 : 0.8) * $('detailBody').clientHeight, behavior: 'smooth'}); } return;
    case 'g': D.g = Date.now(); return;
    case '[': e.preventDefault(); return ACT.side();
    case '/': e.preventDefault(); return $('q').focus();
    case 'f': e.preventDefault(); return showFilters();
    case '?': e.preventDefault(); return showKeys();
    case 'c': e.preventDefault(); return ACT['new-input']();
    case 'z': e.preventDefault(); return D.undo ? D.undo() : toast('Nothing to undo');
    case 'E': e.preventDefault(); return ACT['archive-all']();
    case 'v': e.preventDefault(); return R.rec ? finishRec(false) : startRec();
  }
  if (!it) return;
  switch (k) {
    case 'a':  // the amber action
      if (it.status === 'review') return status('done');
      if (it.status === 'proposed') return status('open');
      if (it.wait?.kind === 'ask' && hasChoices(it.wait.text)) { e.preventDefault(); return document.querySelector(`#detailBody [data-act="choice"][data-n="${n}"]`)?.focus(); }
      if (it.wait) { e.preventDefault(); return ACT.reply(); }
      return;
    case 'r': e.preventDefault(); return ACT.reply();
    case 'n': if (it.status === 'review') return act('reopen'); return;
    case 'd': return CLOSED(it.status) ? undefined : status('done');
    case 'w': return status('dropped');
    case 'l': if (it.type !== 'rule' && !CLOSED(it.status)) act('swipe', {f: 'when', v: it.when === 'now' ? 'later' : 'now'}); return;
    case 'e': if (it.archived || CLOSED(it.status)) act('archive', {on: it.archived ? '0' : '1'}); else { e.preventDefault(); toast('Archive works on finished items'); } return;
    case '.': case 's': case 'p': case 't': e.preventDefault(); return itemMenuDesk(n);
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
  if (desk()) { DR.open = false; $('app').style.transform = ''; for (const c of ['rounded-l-3xl', 'overflow-hidden', 'shadow-2xl']) $('app').classList.remove(c); }
  else { $('drawer').hidden = !DR.open; $('rail').hidden = true; $('drawerShade').hidden = !DR.open; $('headNormal').hidden = !!U.searching; $('headSearch').hidden = !U.searching; $('projectView').hidden = true; D.page = null; D.full = false; $('q').placeholder = 'Search title, text or code'; }
  closeDialog(); render();
}
DESK.addEventListener('change', layoutChange);
WIDE.addEventListener('change', () => { D.sideOpen = false; if (desk()) render(); });
document.addEventListener('keydown', deskKey);
document.addEventListener('click', e => {  // a double click: the first click redraws the row, so no dblclick event comes
  const r = desk() && e.detail === 2 && e.target.closest('#list [data-act="open"][data-n]');
  if (r && !e.target.closest('button')) { openItem(Number(r.dataset.n)); fullWidth(true); }
});
document.addEventListener('contextmenu', e => {
  const r = desk() && e.target.closest('#list [data-act="open"][data-n]');
  if (r) { e.preventDefault(); openItem(Number(r.dataset.n)); itemMenuDesk(Number(r.dataset.n)); }
});

// ---------------------------------------------------------------- projects drawer
// The project list lives in a drawer under the page (F54): tap the menu icon and the page slides right; swipe
// it back, or tap what is left of the page, to close. The swipe in from the left edge stays the phone's "back",
// so row swipes start away from the edge.
const EDGE_W = 24, DR = {open: false, g: null};
const drawerW = () => Math.min(innerWidth * 0.85, 320);
function setDrawer(x, animate = true) {  // x: how far the page is pushed right
  const app = $('app'), shade = $('drawerShade');
  if (x > 0) $('drawer').hidden = false;
  app.style.transition = animate ? 'transform 220ms ease-out' : 'none';
  app.style.transform = x > 0 ? `translateX(${x}px)` : '';
  for (const c of ['rounded-l-3xl', 'overflow-hidden', 'shadow-2xl']) app.classList.toggle(c, x > 0);
  shade.hidden = x <= 0; shade.style.left = x + 'px';
  if (x <= 0 && animate) setTimeout(() => { if (!DR.open && !app.style.transform) $('drawer').hidden = true; }, 240);
}
async function fillDrawer() {
  if (!DR.list) $('drawerList').innerHTML = '<div class="px-3 py-3 text-sm text-zinc-400">Loading…</div>';
  try { DR.list = (await (await fetch('/api/projects', {cache: 'no-store'})).json()).sort((a, b) => b.t - a.t); } catch (_) { return; }
  $('drawerList').innerHTML = DR.list.map(p => { const cur = p.name === S.project, [tone, label] = agentState(p.agents, p.work);
    return `<a href="/p/${encodeURIComponent(p.name)}/" class="flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 ${cur ? 'bg-white shadow-sm ring-1 ring-zinc-900/5 dark:bg-zinc-800 dark:ring-white/5' : 'active:bg-zinc-200/70 dark:active:bg-zinc-800'}">
    <span class="min-w-0 flex-1"><span class="block truncate text-[17px] ${cur ? 'font-semibold' : 'font-medium'}">${esc(p.name)}</span>
    <span class="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400"><span class="size-1.5 shrink-0 rounded-full ${AGENT_TONE[tone][0]}"></span><span class="truncate ${tone === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : AGENT_TONE[tone][1]}">${esc(label)}</span><span class="shrink-0">· ${p.open} open</span></span></span>
    ${p.needs ? `<span class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">${p.needs} need you</span>` : ''}</a>`; }).join('');
  $('otherDot').hidden = !DR.list.some(p => p.name !== S.project && p.needs);
}
function renderDrawerSettings() {
  // On the desktop the same rows are compact sidebar links.
  const row = (act, icon, label) => `<button data-act="${act}" class="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left text-[15px] lg:min-h-0 lg:gap-2.5 lg:rounded-lg lg:px-3 lg:py-1.5 lg:text-sm lg:text-zinc-600 lg:hover:bg-zinc-200/60 dark:lg:text-zinc-300 dark:lg:hover:bg-zinc-800">${ico(icon, 'size-5 text-zinc-500 lg:size-4 dark:text-zinc-400')}<span class="min-w-0 flex-1">${label}</span><span class="lg:hidden">${ico('right', 'size-4 text-zinc-300 dark:text-zinc-600')}</span></button>`;
  $('drawerSettings').innerHTML = `<button data-act="auto" aria-pressed="${!!S.cfg?.auto}" class="group flex w-full items-center gap-3 px-3.5 py-3 text-left lg:gap-2.5 lg:rounded-lg lg:px-3 lg:py-1.5 lg:hover:bg-zinc-200/60 dark:lg:hover:bg-zinc-800">${ico('loop', 'size-5 text-emerald-600 lg:size-4 dark:text-emerald-400')}
      <span class="min-w-0 flex-1"><span class="block text-[15px] lg:text-sm">Keep going</span><span class="block text-xs leading-snug text-zinc-500 lg:text-[11px] dark:text-zinc-400">Agents take the next item without stopping</span></span>
      <span class="relative h-6.5 w-11 shrink-0 rounded-full bg-zinc-300 transition-colors group-aria-pressed:bg-emerald-500 lg:h-5 lg:w-8.5 dark:bg-zinc-600 dark:group-aria-pressed:bg-emerald-500"><span class="absolute top-0.75 left-0.75 size-5 rounded-full bg-white shadow transition-transform group-aria-pressed:translate-x-4.5 lg:size-3.5 lg:group-aria-pressed:translate-x-3.5"></span></span></button>
    ${row('guide', 'plug', 'Connect a coding agent')}${row('phone', 'phone', 'Use on your phone')}${row('log', 'history', 'Change log')}`;
  $('menuInfo').innerHTML = `<div><dt class="inline">Project </dt><dd class="inline">${esc(S.project)}</dd></div>
    <div><dt class="inline">Data </dt><dd class="inline font-mono text-[11px]">${esc(S.file)}</dd></div>
    <div><dt class="inline">Organizer </dt><dd class="inline">${S.org?.on ? 'Gemini · ' + esc(S.org.model) : 'off (set GEMINI_API_KEY and restart)'}</dd></div>`;
}
// The amber dot on the menu icon: another project waits on you. Checked now and then, not on every change.
async function checkOthers() {
  if (Date.now() - (checkOthers.t || 0) < 20000) return;
  checkOthers.t = Date.now();
  try { DR.list = (await (await fetch('/api/projects', {cache: 'no-store'})).json()).sort((a, b) => b.t - a.t); } catch (_) { return; }
  $('otherDot').hidden = !DR.list.some(p => p.name !== S.project && p.needs);
  if (desk()) { renderSidebar(); renderRail(); }
}
function openDrawer() { DR.open = true; renderDrawerSettings(); fillDrawer(); setDrawer(drawerW()); }
function closeDrawer() { if (desk()) { if (D.sideOpen) { D.sideOpen = false; render(); } return; } DR.open = false; setDrawer(0); }
$('drawerShade').addEventListener('click', closeDrawer);
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
addEventListener('pageshow', () => { DR.open = false; setDrawer(0, false); $('drawer').hidden = true; });  // back from another project

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
  v.style.transition = 'transform 180ms ease-out';
  v.style.transform = go ? `translateX(${w}px)` : '';
  setTimeout(() => { if (go) ACT.back(); else { BK.pull = false; showView(); } }, 180);
}
$('detailView').addEventListener('touchend', backEnd);
$('detailView').addEventListener('touchcancel', () => { BK.dx = 0; backEnd(); });

// Going through what needs you: swipe the card sideways for the next or the previous item.
const FC = {x: null};
$('dlgBody').addEventListener('touchstart', e => {
  FC.x = U.go && e.touches.length === 1 && !e.target.closest('.overflow-x-auto, pre, textarea, input') ? e.touches[0].clientX : null;
  FC.y = e.touches[0].clientY;
}, {passive: true});
$('dlgBody').addEventListener('touchend', e => {
  if (FC.x === null || !U.go) return;
  const t = e.changedTouches[0], dx = t.clientX - FC.x, dy = t.clientY - FC.y, g = U.go;
  FC.x = null;
  if (Math.abs(dx) < 70 || Math.abs(dx) < 2 * Math.abs(dy)) return;
  const i = g.list.indexOf(U.peek), k = g.list[(i + (dx < 0 ? 1 : -1) + g.list.length) % g.list.length];
  if (k !== U.peek && byN.get(k)) peek(k, {focus: false});
}, {passive: true});

$('list').addEventListener('pointerdown', swipeStart);
$('list').addEventListener('pointermove', swipeMove);
$('list').addEventListener('pointerup', swipeEnd);
$('list').addEventListener('pointercancel', e => { if (SW.el && e.pointerId === SW.id) { swipeTo(SW.el, SW.el === SW.open ? -SW.reveal : 0); SW.el.style.transition = ''; SW.el = null; } });

document.addEventListener('click', e => {
  if (e.target.closest('a[href]:not([data-act])')) return;  // a link inside a tappable paragraph still opens
  if (Date.now() - SW.swallow < 400) { e.preventDefault(); e.stopPropagation(); return; }
  if (SW.open && !e.target.closest('[data-swipe-right]')) { closeSwipe(); e.preventDefault(); return; }
  const b = e.target.closest('[data-act]');
  if (e.target === $('overlay')) return closeDialog();
  if (b && ACT[b.dataset.act]) { e.preventDefault(); ACT[b.dataset.act](b, e); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (DR.open) return closeDrawer();
    if (!$('viewer').hidden) return ACT['v-close']();
    if (U.doc && U.docCircle) { U.docCircle = false; return renderDoc(); }
    if (U.doc && (U.docQuote || U.docSel.size)) return ACT['doc-unpick']();  // first Escape drops the selection
    if (!$('overlay').hidden) return closeDialog();
    if (R.rec) return cancelRec();
    if (U.editing) { U.editing = null; return renderDetail(); }
    if (desk()) {
      if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return document.activeElement.blur();
      if (D.sideOpen) { D.sideOpen = false; return render(); }
      if (U.go) return ACT['go-end']();
      if (D.full) return fullWidth(false);
      if (D.page) return ACT['project-back']();
      if (D.compose) return leaveCompose();
      if (D.filters) { D.filters = false; return render(); }
      if (U.q) return ACT['search-clear']();
      return;
    }
    if (U.open && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return ACT.back();
  }
  if (!$('viewer').hidden && e.key === 'ArrowLeft') ACT['v-prev']();
  if (!$('viewer').hidden && e.key === 'ArrowRight') ACT['v-next']();
  if (e.key === '/' && !desk() && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); if (!U.searching) ACT.search(); else $('q').focus(); }
  if (e.key === 'Escape' && U.searching && document.activeElement === $('q') && !desk()) searchMode(false);
});

$('q').addEventListener('input', e => { U.q = e.target.value; qSync(); if (U.tab === 'inputs') renderInputs(); else { renderItems(); $('list').scrollTop = 0; } });
$('text').addEventListener('input', () => { saveDraft(); renderComposer(); grow(); });  // the buttons first: the mic showing up narrows the box
document.addEventListener('input', e => { const k = e.target.dataset?.docDraft; if (k) U.docDrafts[k] = e.target.value; if (e.target.id === 'docMd') U.docText = e.target.value; });
// Selecting text inside an open document offers to comment on exactly that text.
document.addEventListener('selectionchange', () => {
  if (!U.doc || U.docEdit || U.docCircle) return;
  const sel = getSelection(), text = sel?.toString().trim();
  if (!text || text.length < 2) return;  // a collapsed selection keeps the last quote until you comment or cancel
  const sec = (sel.anchorNode?.nodeType === 1 ? sel.anchorNode : sel.anchorNode?.parentElement)?.closest('#docBlocks > section[data-key]');
  if (!sec) return;
  U.docQuote = {key: sec.dataset.key, text: text.slice(0, 500)}; U.docSel = new Set();
  renderDocBar();
});
// Enter is a new line; Shift+Enter (or ⌘/Ctrl+Enter) sends. Not while an input method is still composing.
document.addEventListener('keydown', e => {  // Enter in the subitem box adds it
  if (e.target.id === 'subTitle' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); document.querySelector('[data-act="sub-add"]')?.click(); }
});
$('text').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing && (e.shiftKey || e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } });
$('text').addEventListener('paste', e => { const files = [...(e.clipboardData?.files || [])]; if (files.length) { e.preventDefault(); addFiles(files); } });
$('composer').addEventListener('dragover', e => e.preventDefault());
$('composer').addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files.length) addFiles([...e.dataTransfer.files]); });
$('fileInput').addEventListener('change', e => { addFiles([...e.target.files]); e.target.value = ''; });
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
window.addEventListener('focus', refresh);
window.addEventListener('online', refresh);
// The sheet sits above the input box; follow the box whenever it changes size (styles loading, keyboard, scope line).
new ResizeObserver(() => { if (U.peek && !$('overlay').hidden) $('overlay').style.bottom = $('composer').parentElement.offsetHeight + 'px'; })
  .observe($('composer').parentElement);
window.addEventListener('pageshow', e => { if (e.persisted) refresh(); });
window.addEventListener('popstate', () => {
  const n = parseRef(location.hash.slice(1));
  if (desk()) D.full = !!history.state?.full;
  if (n && byN.has(n)) openItem(n, false); else closeItem();
});

$('logo').innerHTML = ico('menu', 'size-6');
$('drawerLogo').innerHTML = ico('logo', 'size-6', '2.25');
$('drawerNew').insertAdjacentHTML('afterbegin', ico('plus', 'size-5'));
$('sideBtn').innerHTML = ico('panel', 'size-[18px]');
$('newInputBtn').innerHTML = `${ico('newinput', 'size-4')}<span class="flex-1 text-left">New input</span>${KBD('C')}`;
$('keysBtn').innerHTML = `${ico('keyboard', 'size-4')}<span class="flex-1 text-left">Keyboard shortcuts</span>${KBD('?')}`;
$('searchBtn').innerHTML = ico('search', 'size-5.5');
$('searchIcon').innerHTML = ico('search', 'size-4.5');
$('qClear').innerHTML = ico('x', 'size-3', '3');
$('attachBtn').innerHTML = ico('plus', 'size-6');
$('micBtn').innerHTML = ico('mic', 'size-6');
$('recCancel').innerHTML = ico('x');
$('recStop').innerHTML = ico('stop');
$('dlgClose').innerHTML = CLOSE_X;
$('vClose').innerHTML = ico('x');
$('backBtn').innerHTML = ico('left', 'size-6');
$('itemMenuBtn').innerHTML = ico('more', 'size-6');
try { $('text').value = localStorage.getItem('taska.draft') || ''; } catch (_) {}
$('projName').textContent = decodeURIComponent(P.split('/')[2] || 'Taska');  // right away, before the data arrives
grow();
renderComposer();  // the big button's icon, before data arrives
window.addEventListener('load', grow);  // a restored draft is measured again once styles are in

load().then(() => {
  if (desk()) checkOthers();
  const n = parseRef(location.hash.slice(1));
  if (n && byN.has(n)) {  // a link to an item: put the list under it, so Back lands there
    if (!history.state?.n && !desk()) { history.replaceState(null, '', location.pathname); history.pushState({n}, '', '#' + code(n)); }
    if (desk()) D.full = !!history.state?.full;
    openItem(n, false);
  } else if (desk()) { const first = needsList()[0]; if (first) openItem(first); }
  poll();
});
</script>
</body>
</html>
'''

VERSION = hashlib.sha1(PAGE.encode()).hexdigest()[:10]  # open pages compare it and reload after an update

if __name__ == "__main__":
    main()
