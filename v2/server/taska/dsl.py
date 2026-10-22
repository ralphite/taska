"""The command language agents write to /do: one command per line, indented lines continue the command above.

    new bug P1 now parent=B03 src=r12 Export ignores the active filter
    B03 doing
    B03 ask Keep the old export?
      - ( ) Yes
      - ( ) No

parse_dsl turns the text into ops (dicts) that ops.run checks and applies, or into an Err for a line it cannot read.
"""

from __future__ import annotations

import re
import textwrap
from typing import Any, Dict, List, Tuple, Union

from .core import TEXT_VERBS, Err, Op

ATTR = re.compile(r"(?i)(?P<open>\[)?(?:(?P<kv>(?:src|parent|pri|when|status|type|files)=[^\s\]]+)|(?P<pri>P[0-3])|(?P<when>now|later)"
                  r"|(?P<st>open|doing|review|done|drop|dropped)|(?P<type>feature|bug|idea|task|rule)|(?P<arch>archive|unarchive))(?(open)\])(?=\s|$)")  # [P1] as P1 (B222)
END_KV = re.compile(r"(?i)\s+\[?(src|parent)=([^\s\]]+)\]?\s*$")  # an option at the end of a title

Parsed = List[Tuple[int, Union[Op, Err]]]


def attrs(s: str, title: bool = False) -> Tuple[Dict[str, Any], str]:
    """Consume leading attribute tokens. Returns (dict, rest of the line). Before a title (B442), a lone status word,
    a capitalized word or a second word of a kind already given starts the title: "new task P1 now Review the pages"
    is titled "Review the pages" (status= still counts)."""
    out: Dict[str, Any] = {}
    pos = 0
    while True:
        m = ATTR.match(s, pos)
        if not m:
            break
        if title and not m["kv"] and not m["pri"]:
            w = m.group(0).strip("[]")
            kind = "status" if m["st"] else "when" if m["when"] else "archived" if m["arch"] else "type"
            if m["st"] or w != w.lower() or kind in out:
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


def parse_dsl(text: str) -> Parsed:
    """-> [(lineno, op | Err)]. Forgiving: markdown fences around the commands and # comments are ignored."""
    cmds: List[Tuple[int, str, List[str]]] = []
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
    ops: Parsed = []
    for no, head, cont_lines in cmds:
        cont = textwrap.dedent("\n".join(cont_lines)).strip("\n")
        try:
            op = parse_cmd(head, cont)
            if isinstance(op, list):
                ops.extend((no, o) for o in op)
            else:
                ops.append((no, op))
        except Err as ex:
            ops.append((no, ex))
    return ops


def parse_cmd(head: str, cont: str) -> Union[Op, List[Op]]:
    word, _, rest = head.partition(" ")
    rest = rest.strip()
    low = word.lower()
    if low == "ack":
        ids = [x.lower() for x in re.findall(r"[rR]\d+", rest)]
        if not ids:
            raise Err("ack needs input ids like r12")
        return {"op": "ack", "ids": ids}
    if low == "new":
        a, title = attrs(rest, title=True)
        m = END_KV.search(title)
        while m:  # "new task Write the docs [src=r12]": the option at the end counts too (B222)
            a.setdefault(m[1].lower(), m[2])
            title = title[:m.start()]
            m = END_KV.search(title)
        if not title:
            raise Err("new needs a title")
        op: Op = {"op": "new", "title": title, "body": cont}
        for k in ("type", "pri", "when", "status", "parent", "src"):
            if k in a:
                op[k] = a[k]
        return op
    if re.fullmatch(r"[Dd]\d+", word):  # documents
        sub, _, rest2 = rest.partition(" ")
        if sub.lower() == "doc":
            return {"op": "doc", "d": word[1:], "title": rest2.strip(), "md": cont}
        if sub.lower() == "html":  # F432: the document as a web page (HTML, scripts too)
            return {"op": "doc", "d": word[1:], "title": rest2.strip(), "md": cont, "fmt": "html"}
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
    if sub_l == "html":  # F432
        return {"op": "doc", "ref": word, "title": rest2.strip(), "md": cont, "fmt": "html"}
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
    if not a:
        raise Err(f"cannot read '{rest or '(nothing)'}' after {word}")
    src = a.pop("src", None)
    op = {"op": "set", "ref": word, "f": a, "src": src}
    text = (left + ("\n" + cont if cont else "")).strip()
    return [op, {"op": "say", "ref": word, "kind": "progress", "text": text}] if text else op  # T307: "B03 done <what changed>" says it too
