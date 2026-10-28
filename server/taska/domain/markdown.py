"""A document's Markdown as blocks (paragraphs, headings, lists, tables, code), and each block's key.

Comments attach to a block through its key, a hash of its text: an edit that changes a paragraph detaches its
comments instead of moving them to another paragraph. The split and the key are part of the stored format.
"""

from __future__ import annotations

import hashlib
import re
from typing import NamedTuple

_TABLE_SEPARATOR = re.compile(r"\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$")
_HEADING = re.compile(r"#{1,6}\s")
_LIST_START = re.compile(r"\s*([-*+]|\d+[.)])\s")
_LIST_OR_QUOTE = re.compile(r"\s*([-*+]|\d+[.)])\s|\s*>")
_TICKED = re.compile(r"^(\s*[-*+]\s+)(\[[xX]\]|\([xX]\))", re.M)


class Block(NamedTuple):
    kind: str  # heading, para, list, quote, code, table
    text: str


def _is_fence(line: str) -> bool:
    return line.lstrip().startswith("```")


def blocks(md: str) -> list[Block]:
    out: list[Block] = []
    lines = md.replace("\r\n", "\n").split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
        elif _is_fence(line):
            j = i + 1
            while j < len(lines) and not _is_fence(lines[j]):
                j += 1
            out.append(Block("code", "\n".join(lines[i:j + 1])))
            i = j + 1
        elif _HEADING.match(line):
            out.append(Block("heading", line))
            i += 1
        elif line.lstrip().startswith("|") and i + 1 < len(lines) and _TABLE_SEPARATOR.match(lines[i + 1]):
            j = i + 2
            while j < len(lines) and lines[j].lstrip().startswith("|"):
                j += 1
            out.append(Block("table", "\n".join(lines[i:j])))
            i = j
        else:
            kind = "list" if _LIST_START.match(line) else "quote" if line.lstrip().startswith(">") else "para"
            j = i + 1
            while j < len(lines) and lines[j].strip() and not _is_fence(lines[j]) and not _HEADING.match(lines[j]):
                if kind == "para" and _LIST_OR_QUOTE.match(lines[j]):
                    break
                j += 1
            out.append(Block(kind, "\n".join(lines[i:j])))
            i = j
    return out


def block_key(text: str) -> str:
    """The key of a block. A choice ticked in a list is the same paragraph: [x] counts as [ ] (F393)."""
    text = _TICKED.sub(lambda m: m.group(1) + ("[ ]" if m.group(2)[0] == "[" else "( )"), text)
    return hashlib.sha1(" ".join(text.split()).encode("utf-8")).hexdigest()[:10]
