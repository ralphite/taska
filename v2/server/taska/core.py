"""Words and small helpers every part of Taska shares: item types, statuses, times, Markdown blocks."""

from __future__ import annotations

import hashlib
import os
import re
import secrets
import unicodedata
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

# An item, an input, a document, an event: plain JSON objects, as they are kept in the log.
Item = Dict[str, Any]
Input = Dict[str, Any]
Doc = Dict[str, Any]
Event = Dict[str, Any]
Op = Dict[str, Any]
Msg = Dict[str, Any]

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
USER_KINDS = ("say", "decide", "propose")  # what the organizer files from your input: your words, your decision, your idea
MAX_TEXT = 200_000
MAX_FILE = 25 * 1024 * 1024
MAX_OPS = 50
TR_HOLD = 150  # seconds an input sent before its voice note's words were in waits for them, at most (B165)
MODEL = os.environ.get("TASKA_MODEL", "gemini-flash-latest")
KEY_VARS = ("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY")
DOC_KEY = "doc"  # B247: the thread of comments on the document as a whole (a paragraph's key is 10 hex digits)
TITLE_MAX = 60
SLUG_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"
KEY_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"  # no 0/o, 1/l/i: easy to type on a phone
NAME = re.compile(r"[a-z0-9][a-z0-9-]{0,39}")  # a project's address and folder: made from its name once, never changed (F173)


class Err(Exception):
    """A request Taska refuses, with the words that say why."""


def home_short(path: str) -> str:
    """A path under the home folder as ~/..., the way people read it (and no user name on screen)."""
    home = os.path.expanduser("~")
    return "~" + path[len(home):] if path == home or path.startswith(home + os.sep) else path


def now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def hm(t: str) -> str:
    return t[5:10] + " " + t[11:16]


def first_line(s: Any, n: int = 60) -> str:
    s = " ".join(str(s).split())
    return s if len(s) <= n else s[: n - 1] + "…"


def plain_key(k: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(k or "").lower())


def stamp(t: str) -> float:
    """An ISO time as seconds since the epoch."""
    return datetime.fromisoformat(t).timestamp()


# --------------------------------------------------------------------------- documents

TABLE_SEP = re.compile(r"\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$")


def md_blocks(md: str) -> List[Tuple[str, str]]:
    """Split Markdown into blocks (kind, text). Comments attach to a block through its text, so an edit
    that changes a paragraph detaches its comments instead of moving them to another paragraph."""
    out: List[Tuple[str, str]] = []
    lines, i = md.replace("\r\n", "\n").split("\n"), 0
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


TICKED = re.compile(r"^(\s*[-*+]\s+)(\[[xX]\]|\([xX]\))", re.M)


def block_key(text: str) -> str:
    # F393: a choice you tick in a document is the same paragraph: its comments stay with it ([x] counts as [ ])
    text = TICKED.sub(lambda m: m.group(1) + ("[ ]" if m.group(2)[0] == "[" else "( )"), text)
    return hashlib.sha1(" ".join(text.split()).encode("utf-8")).hexdigest()[:10]


def edit_note(rid: str, old: str, new: str) -> str:
    """S1: what changed in an input, short: the words added, or the part that changed ("old" -> "new")."""
    if new.startswith(old) and old.strip():
        return f"Added to {rid}:\n{new[len(old):].strip()}"
    i = 0
    while i < min(len(old), len(new)) and old[i] == new[i]:
        i += 1
    j = 0
    while j < min(len(old), len(new)) - i and old[-1 - j] == new[-1 - j]:
        j += 1

    def word(c: str) -> bool:
        return c.isascii() and c.isalnum()

    while i > 0 and word(old[i - 1]):  # whole words, where words have spaces
        i -= 1
    while j > 0 and word(old[len(old) - j]):
        j -= 1
    was, now_ = old[i:len(old) - j].strip(), new[i:len(new) - j].strip()
    if not old.strip() or len(was) + len(now_) > 400:
        return f"Edited {rid}:\n{new}"
    return f"Edited {rid}: “{was}” → “{now_}”"


def user_word(x: Msg) -> bool:
    """A message on an item that is the user's own words: what you wrote there (a reply typed in the box, a picked
    choice, details added), or what the organizer filed there from one of your inputs (an answer written on the list
    goes to the whole project, and the organizer files it here, often as a decision). Any of them answers an open ask
    (B163); the page has the same rule (userWord). The organizer's own notes (merges) and questions are not yours."""
    return x["by"] == "you" or (x["by"] == "org" and x["kind"] in USER_KINDS and bool(x.get("src")))


def clean_title(t: str) -> Tuple[str, Optional[str]]:
    """A title with the guide's options left in it, as agents wrote them when the guide showed them in brackets
    ("[src=r246] Fix the export", B222): the options go; -> (title, src it named or None). Bare words stay: "Open
    the settings" keeps its Open."""
    if "src=" not in t and "parent=" not in t and "[" not in t:
        return t, None
    found: List[str] = []

    def drop(m: "re.Match[str]") -> str:  # only real refs: "[src=...]" written about the tags stays in the title
        if m[1] or m[2]:
            found.append((m[1] or m[2]).lower())
        return " "

    out = re.sub(r"(?i)\[src=(r\d+)\]|\[parent=[A-Za-z]?\d+\]|\bsrc=(r\d+)\b", drop, t)
    lead = re.match(r"(?i)(?:\s*\[(?:P[0-3]|now|later|open|doing|review|done|drop|dropped|feature|bug|idea|task|rule)\])+", out)
    if lead:
        out = out[lead.end():]
    out = " ".join(out.split())
    return (out, found[0] if found else None) if out else (t, None)


# --------------------------------------------------------------------------- projects


def title_of(name: Any) -> str:
    """A project's name for people (F173): any text, spaces, Chinese, emoji; one line, up to TITLE_MAX characters."""
    t = " ".join(str(name or "").split())
    if not t:
        raise Err("give the project a name")
    if len(t) > TITLE_MAX:
        raise Err(f"a project name is up to {TITLE_MAX} characters")
    return t


def slug_of(title: str) -> str:
    """The address a new project gets from its name (F173): Home Budget -> home-budget, Cafe -> cafe; "" for a name
    with no a-z or 0-9 in it (it gets a short code instead, see short_slug)."""
    t = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")[:40].strip("-")


def short_slug() -> str:
    return "p-" + "".join(secrets.choice(SLUG_CHARS) for _ in range(4))  # p-7k2m
