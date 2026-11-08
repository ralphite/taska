"""Settling where the fast and the strong model heard a voice note differently (B724), the pure part: which
differences change the meaning (not punctuation, spaces, case, fillers, a word said twice, the same number or the
same English word in another form), what the reviewers are asked and how their answers are read, and what most of
them agreed on. The calls themselves are in services.voice_vote. No I/O, no models."""

from __future__ import annotations

import difflib
import json
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from .voice_words import NEGATION, VOICE_TOKEN

Token = Tuple[str, int, int]  # the word (lower case), where it starts and ends in its text

# Fillers and particles: "uh", "um", and Chinese ones that add no meaning (的 了 啊 呢 吧 呀 嘛 哦 嗯 呃 ...)
FILLERS = frozenset({"um", "uh", "uhm", "hmm", "er", "ah", "oh", "eh"} | set("的了啊呢吧呀嘛哦噢哈诶欸嗯呃额哎唉"))
# Words one model keeps and the other leaves out without changing what is meant (那个 这个 就是 然后 就 也 还 都 ...)
SOFT = ("那个", "这个", "就是", "然后", "一个", "就", "也", "还",
        "都", "那", "这", "个", "吗", "吧", "呀", "对", "嗯", "地", "得")
# One character for another with the same meaning: 的 地 得, 他 她 它, 做 作
SAME_CHARS = [set("的地得"), set("他她它"), set("做作")]
CN_DIGITS = {c: i for i, c in enumerate("零一二三四五六七八九")}
CN_DIGITS["两"] = 2
CN_UNITS = {"十": 10, "百": 100, "千": 1000}
EN_NUMBERS = {w: i for i, w in enumerate("zero one two three four five six seven eight nine ten".split())}
MOST_SPOTS = 12  # spots asked about in one note; the rest keep the strong model's words
KINDS = ("negation", "english", "number", "words")  # what a difference is about, the weightiest first


def tokens(text: str) -> List[Token]:
    """The words of text, lower case, without fillers and with a word said twice in a row once (up to four words
    repeated: 那个那个 -> 那个)."""
    toks = [(m.group().lower(), m.start(), m.end()) for m in VOICE_TOKEN.finditer(text) if m.group().lower() not in FILLERS]
    out: List[Token] = []
    for t in toks:
        out.append(t)
        for n in (4, 3, 2, 1):
            if len(out) >= 2 * n and [x[0] for x in out[-2 * n:-n]] == [x[0] for x in out[-n:]] \
                    and not all(x[0] in CN_DIGITS for x in out[-n:]):  # 七二二 is 722, not a stutter
                del out[-2 * n:-n]  # the later copy stays: its place is where the words were settled on
                break
    return out


def number(s: str) -> Optional[int]:
    """The value of a number written in digits, in Chinese (三, 十二, 一百零五) or as an English word; None if not one."""
    if not s:
        return None
    if s.isdigit():
        return int(s)
    if s in EN_NUMBERS:
        return EN_NUMBERS[s]
    if not all(c in CN_DIGITS or c in CN_UNITS for c in s):
        return None
    if all(c in CN_DIGITS for c in s):  # 一二四: digits read out one by one
        return int("".join(str(CN_DIGITS[c]) for c in s))
    total, digit = 0, None
    for c in s:
        if c in CN_DIGITS:
            digit = CN_DIGITS[c]
        else:
            total += (1 if digit is None else digit) * CN_UNITS[c]
            digit = None
    return total + (digit or 0)


def stem(w: str) -> str:
    """An English word without its ending: forms, approved, organizing, dialogue, stories -> form, approv, organiz, dialog, story."""
    for end in ("ing", "ed", "es", "ue", "ly", "s", "d"):
        if w.endswith(end) and len(w) - len(end) >= 3:
            w = w[: -len(end)]
            break
    w = w.rstrip("e")
    return w[:-1] + "y" if w.endswith("i") else w


def trimmed(x: str, y: str) -> Tuple[str, str]:
    """x and y without what both have at the start and at the end (P1 / P2 -> 1 / 2)."""
    n = 0
    while n < min(len(x), len(y)) and x[n] == y[n]:
        n += 1
    x, y = x[n:], y[n:]
    n = 0
    while n < min(len(x), len(y)) and x[-1 - n] == y[-1 - n]:
        n += 1
    return x[: len(x) - n], y[: len(y) - n]


def soft_only(s: str) -> bool:
    """s is made only of words that can be left out without changing what is meant (那个, 就是, 然后, ...)."""
    for w in sorted(SOFT, key=len, reverse=True):
        s = s.replace(w, "")
    return not s


def kind(xs: List[str], ys: List[str]) -> Optional[str]:
    """What the difference between the words xs and ys (lower case) is about, or None when it does not change the
    meaning: "negation", "english", "number" or "words"."""
    x, y = (re.sub(r"[^a-z0-9㐀-鿿]", "", "".join(s)) for s in (xs, ys))
    if x == y:
        return None  # DevTools / Dev Tools, Shift+V / shift + V, punctuation, case
    if len(xs) == len(ys) and all(re.fullmatch(r"[a-z]+", u) and re.fullmatch(r"[a-z]+", v) and stem(u) == stem(v)
                                  for u, v in zip(xs, ys)):
        return None  # form / forms, organize / organizing, dialog / dialogue
    cx, cy = trimmed(x, y)
    neg = bool(set(cx) & NEGATION) != bool(set(cy) & NEGATION)
    if neg:
        return "negation"
    nx, ny = number(cx), number(cy)
    if nx is not None and nx == ny:
        return None  # 3 / three / 三, one pager / 1-pager
    if re.search(r"[a-z]", x) and not re.search(r"[a-z0-9]", y):
        return None  # English kept as spoken where the speech model put it in Chinese or left it out (merge, pull)
    if not (cx and cy) and soft_only(cx or cy):
        return None  # 那个, 就是, 然后: kept by one model only
    if len(cx) == 1 and len(cy) == 1 and any(cx in g and cy in g for g in SAME_CHARS):
        return None  # 的 / 地 / 得, 他 / 她
    if re.search(r"[a-z]", cx + cy):
        return "english"
    if re.search(r"[0-9]", cx + cy) or nx is not None or ny is not None:
        return "number"
    return "words"


@dataclass
class Spot:
    """One place the two transcripts disagree on what was said: its number, where it is in each (character offsets),
    its words in each, and what the difference is about."""
    n: int
    a: Tuple[int, int]
    b: Tuple[int, int]
    was: str
    alt: str
    why: str
    picks: List[str] = field(default_factory=list)  # each reviewer's answer: "A", "B", "own: <words>" or "-"


def disputes(tr: str, alt: str, most: int = MOST_SPOTS) -> List[Spot]:
    """Where tr (the strong model's words) and alt (the fast model's) disagree in a way that changes the meaning.
    Differences one word apart are one spot; a word only one side has is shown with the word next to it."""
    A, B = tokens(tr), tokens(alt)
    ops = difflib.SequenceMatcher(None, [t for t, _, _ in A], [t for t, _, _ in B], autojunk=False).get_opcodes()
    found: List[List[Any]] = []  # [i1, i2, j1, j2, why]
    for tag, i1, i2, j1, j2 in ops:
        if tag == "equal":
            continue
        why = kind([t for t, _, _ in A[i1:i2]], [t for t, _, _ in B[j1:j2]])
        if not why:
            continue
        if found and i1 - found[-1][1] <= 1 and j1 - found[-1][3] <= 1:  # one word apart: one spot
            last = found[-1]
            last[1], last[3] = i2, j2
            last[4] = min(last[4], why, key=KINDS.index)
            continue
        found.append([i1, i2, j1, j2, why])
    found = found[:most]
    weight = lambda T, s, e: sum(1 if t >= "㐀" else 3 for t, _, _ in T[s:e])  # a Chinese character 1, a word 3
    spots: List[Spot] = []
    lo = (0, 0)  # where the spot before ends, in A's and B's words
    for k, (i1, i2, j1, j2, why) in enumerate(found):
        hi = (found[k + 1][0], found[k + 1][2]) if k + 1 < len(found) else (len(A), len(B))
        for step in range(6):  # too short to read (a word on one side only, one character): the words next to it
            if i1 < i2 and j1 < j2 and weight(A, i1, i2) >= 2 and weight(B, j1, j2) >= 2:
                break
            left = i1 > lo[0] and j1 > lo[1]
            right = i2 < hi[0] and j2 < hi[1]
            if left and (step % 2 == 0 or not right):
                i1, j1 = i1 - 1, j1 - 1
            elif right:
                i2, j2 = i2 + 1, j2 + 1
            else:
                break
        if i1 == i2 or j1 == j2:
            continue
        lo = (i2, j2)
        a, b = (A[i1][1], A[i2 - 1][2]), (B[j1][1], B[j2 - 1][2])
        spots.append(Spot(len(spots) + 1, a, b, tr[a[0]:a[1]], alt[b[0]:b[1]], why))
    return spots


def key(words: str) -> str:
    """What two readings of a spot are compared by: their words, without punctuation, spaces, case, fillers or
    repeats."""
    return "".join(t for t, _, _ in tokens(words))


REVIEW_SYSTEM = ("You check a voice note's transcript. Two speech-to-text models wrote down the same recording (Mandarin "
                 "Chinese mixed with English, about software work) and disagree at a few numbered spots. Listen to the "
                 "recording and say, for each spot, what the speaker actually said there. Write Chinese in Simplified "
                 "characters only.")
REVIEW_SCHEMA = {"type": "OBJECT", "properties": {"spots": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
    "n": {"type": "INTEGER", "description": "the spot's number"},
    "pick": {"type": "STRING", "enum": ["1", "2", "own"], "description": "1 or 2: that transcript's words there are what was said; own: neither"},
    "words": {"type": "STRING", "description": "with own: exactly the words said at that spot, nothing around it"}},
    "required": ["n", "pick"]}}}, "required": ["spots"]}


def marked(text: str, spans: List[Tuple[int, Tuple[int, int]]]) -> str:
    """text with each spot's words between ⟦n⟧ and ⟦/n⟧."""
    out, at = [], 0
    for n, (s, e) in spans:
        out += [text[at:s], f"⟦{n}⟧", text[s:e], f"⟦/{n}⟧"]
        at = e
    return "".join(out + [text[at:]])


def review_prompt(tr: str, alt: str, spots: List[Spot], glossary: str, swap: bool = False) -> str:
    """What one reviewer is asked: both transcripts with the spots marked, the spots listed, and the project's words.
    swap: the fast model's transcript is shown first (so no reviewer always sees the strong one first)."""
    first, second = (alt, tr) if swap else (tr, alt)
    side = (lambda x: x.b, lambda x: x.a) if swap else (lambda x: x.a, lambda x: x.b)
    words = (lambda x: x.alt, lambda x: x.was) if swap else (lambda x: x.was, lambda x: x.alt)
    lines = ["Transcript 1:", marked(first, [(x.n, side[0](x)) for x in spots]), "",
             "Transcript 2:", marked(second, [(x.n, side[1](x)) for x in spots]), "", "Spots:"]
    lines += [f"{x.n}. transcript 1: {json.dumps(words[0](x), ensure_ascii=False)} | transcript 2: "
              f"{json.dumps(words[1](x), ensure_ascii=False)}" for x in spots]
    lines += ["", "For every spot answer pick \"1\" when transcript 1's words there are what was said, \"2\" for "
              "transcript 2's, or \"own\" with the exact words you hear there when neither is right. Judge only what is "
              "said, not the punctuation. The words below are this project's: when you hear one, it is written this "
              "way; never choose a reading only because it has one of them.", "", glossary]
    return "\n".join(lines)


def read_review(text: str, spots: List[Spot], swap: bool = False) -> Dict[int, str]:
    """A reviewer's answer -> {spot number: "A" (the strong model's words), "B" (the fast model's) or "own: <words>"};
    an answer for a spot that is not there, or own words far longer than either reading, is left out. ValueError
    when it is not the JSON asked for."""
    got = json.loads(text)
    by_n = {x.n: x for x in spots}
    out: Dict[int, str] = {}
    for ans in (got.get("spots") or []) if isinstance(got, dict) else []:
        if not isinstance(ans, dict):
            continue
        n = ans.get("n")
        x, pick = by_n.get(n if isinstance(n, int) else -1), str(ans.get("pick") or "")
        if x is None or x.n in out:
            continue
        if pick in ("1", "2"):
            out[x.n] = "A" if (pick == "1") != swap else "B"
        elif pick == "own":
            own = " ".join(str(ans.get("words") or "").split())
            if own and len(own) <= 3 * max(len(x.was), len(x.alt)) + 20:
                k = key(own)
                out[x.n] = "A" if k == key(x.was) else "B" if k == key(x.alt) else "own: " + own
    return out


def reading(x: Spot, pick: str) -> str:
    return x.was if pick == "A" else x.alt if pick == "B" else pick[5:]


def widened(text: str, s: int, e: int) -> Tuple[int, int]:
    """s:e grown a word at a time (before it first) until it reads as words and is found once in text, so the page
    can swap it (at most 8 words)."""
    toks = [(m.start(), m.end()) for m in VOICE_TOKEN.finditer(text)]
    for _ in range(8):
        part = text[s:e]
        if text.count(part) == 1 and sum(1 if c >= "㐀" else 0 for c in part) + 3 * len(re.findall(r"[A-Za-z0-9]+", part)) >= 2:
            break
        before = [t for t in toks if t[1] <= s]
        after = [t for t in toks if t[0] >= e]
        if before:
            s = before[-1][0]
        elif after:
            e = after[0][1]
        else:
            break
    return s, e


def tally(tr: str, spots: List[Spot], answers: List[Dict[int, str]], most_doubts: int = 6) -> Tuple[str, List[Dict[str, Any]]]:
    """The words most reviewers agreed on, and the doubts left. For each spot: a reading two of the answers agree on
    (of at most three) is used; otherwise the strong model's words stay and the spot is a doubt ({was, alt, why} as
    the page knows them, alt the reading most often given that is not the strong one's, "alts" every other reading,
    "votes" the answers). Each spot's picks get the answers ("-" for none) and "result": its outcome."""
    out, at, places = [], 0, []  # places: (start, end of the spot in out, the spot, its other readings) for doubts
    for x in spots:
        picks = [a.get(x.n, "-") for a in answers]
        x.picks = picks
        count = Counter(key(reading(x, p)) for p in picks if p != "-")
        top, n = count.most_common(1)[0] if count else ("", 0)
        if n >= 2:
            pick = next(p for p in picks if p != "-" and key(reading(x, p)) == top)
            words, result = reading(x, pick), pick.split(":")[0]
        else:
            words, result = x.was, "doubt"
        out.append(tr[at:x.a[0]])
        s = sum(len(p) for p in out)
        out.append(words)
        at = x.a[1]
        x.picks = picks + [f"result: {result}"]
        if result == "doubt":
            others = [reading(x, p) for p in picks if p not in ("-", "A") and key(reading(x, p)) != key(x.was)]
            others = list(dict.fromkeys(others or [x.alt]))
            others.sort(key=lambda w: -sum(1 for p in picks if p != "-" and key(reading(x, p)) == key(w)))
            places.append((s, s + len(words), x, others))
    out.append(tr[at:])
    text = "".join(out)
    doubts = []
    for s, e, x, others in places[:most_doubts]:
        ws, we = widened(text, s, e)
        doubts.append({"was": text[ws:we], "alt": text[ws:s] + others[0] + text[e:we], "why": x.why,
                       "alts": [text[ws:s] + o + text[e:we] for o in others], "votes": [p for p in x.picks if not p.startswith("result")]})
    return text, doubts
