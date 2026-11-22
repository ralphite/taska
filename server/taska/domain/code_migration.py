"""Once (format 3, T863, Yadong r1464): every item is named T and its number in what was written too. Since T855 an
item's code is T and its number, and the older codes (B838, F839, I810) still name it; what was written before
named items by them: the words of items, messages, inputs, documents and comments. Each such code that names an item
of the project becomes T and the same digits (B838 -> T838, F06 -> T06). A code was its item's type's letter, so only
a letter the item had names it: B1 and B2 for two phones, or F1 for Google's database, where item 1 was never a bug
or a feature, stay as written. Of the small values only a code alone is rewritten (an alarm's item), not the texts
kept there (the guide as an agent last read it)."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Set, Tuple

# an older code standing alone: not inside a word, an address or a file name (f2864-voice, /assets/index-B8x.js)
OLD_CODE = re.compile(r"(?<![\w/#.\-])([FBI])(0*(\d{1,5}))\b(?![\-.]\w)")


LETTER = {"feature": "F", "bug": "B", "idea": "I", "task": "T"}
Codes = Set[Tuple[str, int]]


def item_codes(rows: List[Dict[str, Any]]) -> Codes:
    """Every (letter, number) that named an item of the log: the letters of the types it had."""
    out: Codes = set()
    for r in rows:
        n = r.get("n")
        if not isinstance(n, int):
            continue
        if r.get("k") == "add":
            out.add((LETTER.get(str(r.get("type") or "task"), "T"), n))
        elif r.get("k") == "set" and isinstance(r.get("f"), dict) and r["f"].get("type") in LETTER:
            out.add((LETTER[r["f"]["type"]], n))
    return out


def text(s: str, items: Codes) -> Tuple[str, int]:
    """A text with the older codes of these items as T codes -> (it, how many)."""
    count = 0

    def one(m: "re.Match[str]") -> str:
        nonlocal count
        if (m.group(1), int(m.group(3))) not in items:
            return m.group(0)
        count += 1
        return "T" + m.group(2)

    return OLD_CODE.sub(one, s), count


def value(v: Any, items: Codes) -> Tuple[Any, int]:
    """Every text in a value (a row, a list, a small value) rewritten -> (it, how many codes)."""
    if isinstance(v, str):
        return text(v, items)
    if isinstance(v, list):
        out, n = [], 0
        for x in v:
            y, k = value(x, items)
            out.append(y)
            n += k
        return out, n
    if isinstance(v, dict):
        d, n = {}, 0
        for key, x in v.items():
            y, k = value(x, items)
            d[key] = y
            n += k
        return d, n
    return v, 0


def rewrite(rows: List[Dict[str, Any]], kv: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Dict[str, Any], int]:
    """The log and the small values with every older code of an item as its T code -> (rows, the small values that
    changed, how many codes)."""
    items = item_codes(rows)
    new, total = [], 0
    for r in rows:
        x, n = value(r, items)
        new.append(x)
        total += n
    changed_kv = {}
    for k, v in kv.items():
        x, n = _codes_alone(v, items)
        if n:
            changed_kv[k] = x
            total += n
    return new, changed_kv, total


def _codes_alone(v: Any, items: Codes) -> Tuple[Any, int]:
    """A small value with each text that is a code alone rewritten (the item an alarm made: {"ref": "B812"})."""
    if isinstance(v, str):
        return text(v, items) if OLD_CODE.fullmatch(v) else (v, 0)
    if isinstance(v, list):
        pairs = [_codes_alone(x, items) for x in v]
        return [x for x, _ in pairs], sum(n for _, n in pairs)
    if isinstance(v, dict):
        pairs = {k: _codes_alone(x, items) for k, x in v.items()}
        return {k: x for k, (x, _) in pairs.items()}, sum(n for _, n in pairs.values())
    return v, 0
