"""The command language agents write to /do: one command per line; indented lines continue the command above.

    new bug P1 now parent=B03 src=r12 Export ignores the active filter
    B03 doing
    B03 ask Keep the old export?
      - ( ) Yes
      - ( ) No

`parse` turns the text into commands (the same mappings the page sends), or into the reason a line can't be read.
"""

from __future__ import annotations

import re
import textwrap
from typing import Any, Dict, List, Tuple, Union

from ..domain.vocab import TEXT_VERBS, Refused

Command = Dict[str, Any]
Parsed = List[Tuple[int, Union[Command, Refused]]]

_OPTION = re.compile(
    r"(?i)(?P<open>\[)?(?:(?P<kv>(?:src|parent|pri|when|status|type|files)=[^\s\]]+)|(?P<pri>P[0-3])|(?P<when>now|later)"
    r"|(?P<st>open|doing|review|done|drop|dropped)|(?P<type>feature|bug|idea|task|rule)|(?P<arch>archive|unarchive))"
    r"(?(open)\])(?=\s|$)")  # [P1] reads as P1
_END_OPTION = re.compile(r"(?i)\s+\[?(src|parent)=([^\s\]]+)\]?\s*$")  # an option at the end of a title
_ITEM_WORD = re.compile(r"\$|[A-Za-z]?\d+")
_DOC_WORD = re.compile(r"[Dd]\d+")


def options(s: str, before_title: bool = False) -> Tuple[Dict[str, Any], str]:
    """The option words at the start of `s` -> (options, the rest). Before a title, a lone status word, a
    capitalized word or a second word of a kind already given starts the title: "new task P1 now Review the pages"
    is titled "Review the pages" (status= still counts)."""
    out: Dict[str, Any] = {}
    pos = 0
    while True:
        m = _OPTION.match(s, pos)
        if not m:
            break
        if before_title and not m["kv"] and not m["pri"]:
            word = m.group(0).strip("[]")
            kind = "status" if m["st"] else "when" if m["when"] else "archived" if m["arch"] else "type"
            if m["st"] or word != word.lower() or kind in out:
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


def parse(text: str) -> Parsed:
    """-> [(line number, command or why not)]. Forgiving: Markdown fences around the commands and # comments go."""
    heads: List[Tuple[int, str, List[str]]] = []
    for no, raw in enumerate(text.replace("\r\n", "\n").split("\n"), 1):
        if raw[:1] in (" ", "\t"):  # indented: text of the command above, fences included
            if heads:
                heads[-1][2].append(raw)
            continue
        if raw.startswith("```"):
            continue
        if not raw.strip():
            if heads and heads[-1][2]:
                heads[-1][2].append("")
            continue
        if raw.startswith("#"):
            continue
        heads.append((no, raw.strip(), []))
    out: Parsed = []
    for no, head, more in heads:
        cont = textwrap.dedent("\n".join(more)).strip("\n")
        try:
            got = command(head, cont)
            if isinstance(got, list):
                out.extend((no, c) for c in got)
            else:
                out.append((no, got))
        except Refused as ex:
            out.append((no, ex))
    return out


def command(head: str, cont: str) -> Union[Command, List[Command]]:
    word, _, rest = head.partition(" ")
    rest = rest.strip()
    low = word.lower()
    if low == "ack":
        ids = [x.lower() for x in re.findall(r"[rR]\d+", rest)]
        if not ids:
            raise Refused("ack needs input ids like r12")
        return {"op": "ack", "ids": ids}
    if low == "new":
        return _new(rest, cont)
    if _DOC_WORD.fullmatch(word):
        return _doc_command(word, rest, cont)
    if not _ITEM_WORD.fullmatch(word):
        raise Refused(f"unknown command '{word}' (start with new, ack or an item code like B03)")
    verb, _, rest2 = rest.partition(" ")
    verb_l = verb.lower()
    if verb_l == "doc":
        return {"op": "doc", "ref": word, "title": rest2.strip(), "md": cont}
    if verb_l == "html":
        return {"op": "doc", "ref": word, "title": rest2.strip(), "md": cont, "fmt": "html"}
    if verb_l in TEXT_VERBS:
        said = rest2.strip()
        opts, words = options(said) if re.match(r"(?i)(src|files)=", said) else ({}, said)
        words = (words + ("\n" + cont if cont else "")).strip()
        if verb_l in ("title", "body", "next"):
            return {"op": "set", "ref": word, "f": {verb_l: words}, "src": opts.get("src")}
        return {"op": "say", "ref": word, "kind": verb_l, "text": words, "src": opts.get("src"),
                "files": [f for f in (opts.get("files") or "").split(",") if f]}
    if verb_l == "merge":
        return {"op": "merge", "ref": word, "into": rest2.strip().split()[0] if rest2.strip() else ""}
    opts, left = options(rest)
    if not opts:
        raise Refused(f"cannot read '{rest or '(nothing)'}' after {word}")
    src = opts.pop("src", None)
    change: Command = {"op": "set", "ref": word, "f": opts, "src": src}
    words = (left + ("\n" + cont if cont else "")).strip()
    # "B03 done <what changed>" says it too
    return [change, {"op": "say", "ref": word, "kind": "progress", "text": words}] if words else change


def _new(rest: str, cont: str) -> Command:
    opts, title = options(rest, before_title=True)
    m = _END_OPTION.search(title)
    while m:  # "new task Write the docs [src=r12]": the option at the end counts too
        opts.setdefault(m[1].lower(), m[2])
        title = title[:m.start()]
        m = _END_OPTION.search(title)
    if not title:
        raise Refused("new needs a title")
    out: Command = {"op": "new", "title": title, "body": cont}
    for k in ("type", "pri", "when", "status", "parent", "src"):
        if k in opts:
            out[k] = opts[k]
    return out


def _doc_command(word: str, rest: str, cont: str) -> Command:
    verb, _, rest2 = rest.partition(" ")
    v = verb.lower()
    if v == "doc":
        return {"op": "doc", "d": word[1:], "title": rest2.strip(), "md": cont}
    if v == "html":  # the document as a web page (HTML, scripts too)
        return {"op": "doc", "d": word[1:], "title": rest2.strip(), "md": cont, "fmt": "html"}
    if v == "reply":
        m = re.match(r"¶?(\d+)\s+(.*)", rest2.strip(), re.S)
        if not m:
            raise Refused(f"use: {word} reply ¶3 <text>")
        return {"op": "dc", "d": word[1:], "para": m.group(1), "text": (m.group(2) + ("\n" + cont if cont else "")).strip()}
    raise Refused(f"{word}: use doc or reply")
