"""Finding things in a project by what you said or typed (F479): its items and rules, what you said (inputs) and its
documents, closest first. Pure: a function of the state and the words.

By the words: the words that carry meaning (not "the", "where", "my"; for Chinese, each two characters in a row) are
looked for in each thing; a thing is found when one of them is there, and it is the closer the more of them it has,
in its title above all. The short list is what a model reads to find things by meaning: one line per thing.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from .model import Doc, Input, Item
from .text import page_text
from .state import ProjectState
from .voices import said, voices_of, words_of

# words that say nothing about what to find
STOP = frozenset("""
a about after again all also am an and any are as at be been before but by can could did do does doing done for from
had has have how i if in into is it its just me more most my no not now of on only or our out over so some than that
the their them then there these they this those to too up us very was we were what when where which while who why
will with would you your find show search look looking get got want need where's what's it's i'm don't doesn't
""".split())
CJK = re.compile(r"[㐀-鿿豈-﫿]+")
LATIN = re.compile(r"[a-z0-9][a-z0-9'_-]*")
TOP = 60  # the most things a project gives, closest first
LONG = 300  # characters: words found in a longer text count for less


@dataclass(frozen=True)
class Found:
    """One thing found: its kind (items, rules, inputs, docs), its key in the project ("i3", "r8", "d1"), the item
    it opens (an input's: the item it became; None: none) and how close it is (higher: closer)."""

    kind: str
    key: str
    n: Optional[int]
    score: float = 0


def terms(q: str) -> List[str]:
    """The words of `q` that carry meaning, lower case, each once: Latin words not in STOP, and for Chinese each two
    characters in a row (one character alone when it is all there is)."""
    low = q.lower()
    out: List[str] = []
    for w in LATIN.findall(CJK.sub(" ", low)):
        w = w.strip("'_-")
        if len(w) > 1 and w not in STOP and w not in out:
            out.append(w)
    for run in CJK.findall(low):
        grams = [run] if len(run) == 1 else [run[i:i + 2] for i in range(len(run) - 1)]
        out += [g for g in grams if g not in out]
    return out[:24]


def _score(ws: List[str], title: str, rest: str) -> float:
    """Two for a word in the title, one for a word only in the rest (less in a long rest, where words turn up by
    chance); a little more when every word is there."""
    got = 0.0
    seen = 0
    far = min(1.0, (LONG / len(rest)) ** 0.5) if rest else 1.0
    for w in ws:
        if w in title:
            got, seen = got + 2, seen + 1
        elif w in rest:
            got, seen = got + far, seen + 1
    # every word there: a little more, as much as they count
    return got + (min(1.0, got / len(ws)) if seen == len(ws) and len(ws) > 1 else 0) if seen else 0


def _input_n(st: ProjectState, r: Input) -> Optional[int]:
    """The item an input opens: the first live one it made or changed, or the one it was a reply on."""
    for n in [*r.touched, *([r.scope] if r.scope else [])]:
        it = st.items.get(n)
        while it is not None and it.merged_into:
            it = st.items.get(it.merged_into)
        if it is not None and it.live:
            return it.n
    return None


def _items(st: ProjectState) -> List[Item]:
    return [i for i in st.items.values() if i.live]


def _inputs(st: ProjectState) -> List[Input]:
    return [r for r in st.inputs.values() if not r.deleted and not r.moved and said(st, r.text, r.files)]


def _comments(st: ProjectState, d: Doc) -> str:
    """What was said in a document's comments (a voice comment's words too)."""
    return " ".join(said(st, c.text, c.files) for c in d.comments)


def _docs(st: ProjectState) -> List[Doc]:
    return [d for d in st.docs.values() if not d.deleted and d.n in st.items and st.items[d.n].live]


def by_words(st: ProjectState, q: str) -> List[Found]:
    """What `q`'s words find, closest first (the newer first when as close), at most TOP."""
    ws = terms(q)
    if not ws:
        return []
    out: List[Tuple[float, str, Found]] = []
    for i in _items(st):
        code = st.code(i.n).lower()
        talk = [m.text or "" for m in i.thread] + [words_of(st, f.f) for r in i.srcs if r in st.inputs
                                                   for f in voices_of(st.inputs[r].files)]
        rest = " ".join([code, i.body, i.next or "", *talk]).lower()
        s = _score(ws, i.title.lower(), rest)
        if s:
            out.append((s, i.t1 or i.t0 or "", Found("rules" if i.type == "rule" else "items", "i%d" % i.n, i.n, s)))
    for r in _inputs(st):
        s = _score(ws, "", said(st, r.text, r.files).lower())
        if s:
            out.append((s, r.t, Found("inputs", r.id, _input_n(st, r), s)))
    for d in _docs(st):
        # a web page by the words it shows, not its markup ("div" or "margin" found every page); and its comments' words
        s = _score(ws, d.title.lower(), ((page_text(d.md) if d.is_page else d.md) + " " + _comments(st, d)).lower())
        if s:
            out.append((s, d.t1 or d.t0, Found("docs", "d%d" % d.d, d.n, s)))
    out.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return [f for _, _, f in out[:TOP]]


def short_list(st: ProjectState, most_inputs: int = 150) -> List[Tuple[Found, str]]:
    """Every thing of the project as one short line, for a model to find things by meaning: items and rules (code,
    title, the start of the body), the latest inputs, documents (their title and item)."""
    out: List[Tuple[Found, str]] = []
    for i in sorted(_items(st), key=lambda x: x.n):
        body = " ".join(i.body.split())[:80]
        kind = "rules" if i.type == "rule" else "items"
        out.append((Found(kind, "i%d" % i.n, i.n), f"{st.code(i.n)} {i.title}" + (f" — {body}" if body else "")))
    for r in sorted(_inputs(st), key=lambda x: x.number, reverse=True)[:most_inputs]:
        out.append((Found("inputs", r.id, _input_n(st, r)), "#%d said: %s" % (r.number, " ".join(said(st, r.text, r.files).split())[:100])))
    for d in sorted(_docs(st), key=lambda x: x.d):
        out.append((Found("docs", "d%d" % d.d, d.n), f"D{d.d} document on {st.code(d.n)}: {d.title}"))
    return out


def by_key(st: ProjectState) -> Dict[str, Found]:
    """Each thing of the project by its key."""
    return {f.key: f for f, _ in short_list(st, most_inputs=10 ** 9)}
