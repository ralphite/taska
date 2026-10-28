"""How a voice note is heard: what the models are told (the rules, the user's preferences, the spellings they fixed,
the project's own words as hints, its open items), and how their words are judged: where two models heard
differently in a way that changes the meaning (what may be misheard), whether one stopped early, whether words were
only copied from the prompt, whether tidied words kept everything. Pure: no I/O, no models."""

from __future__ import annotations

import difflib
import re
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

from .vocab import LETTER
from .state import ProjectState
from .rules import by_priority

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


def voice_term_ok(t: str) -> bool:
    """A word worth a spelling hint: not a URL, a document id or key, an input ref (r119), a file name, a plain number
    or code, or an everyday English word."""
    low = t.lower()
    return (3 <= len(t) <= 30 and low not in VOICE_COMMON and not re.search(r"://|^www\.|localhost", low)
            and not ("/" in t and "." in t) and not FILE_NAME.search(low) and not re.fullmatch(r"[a-z]{0,2}\d+", low)
            and not re.search(r"\d{4,}", t) and not re.fullmatch(r"[0-9a-f]{10,}", low)
            and not (len(t) >= 16 and re.search(r"\d", t) and re.search(r"[A-Z]", t) and re.search(r"[a-z]", t)))


def voice_terms(words: "Counter[str]", fixes: List[Dict[str, Any]], limit: int = 60) -> List[str]:
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


def voice_context(st: ProjectState, scope: Optional[int]) -> Tuple["Counter[str]", List[str], List[str]]:
    """(the project's words, its open items as "B73 title", their titles): what the transcription is told. Everything
    about the item spoken to is context: its text, its thread, its subitems and its documents; their words are hints
    first (Chinese names from headings and bold text too), and the text itself goes to the main model to recognize
    words, never to copy (about 6000 characters)."""
    live = [i for i in st.items.values() if not i.merged_into and not i.deleted]
    it0 = st.items.get(scope) if scope is not None else None
    pool = [it0] if it0 is not None else []
    pool += [i for i in by_priority(live) if i.status in ("open", "doing") and i.n != scope][:80]
    words: "Counter[str]" = Counter()
    for it in pool:
        words.update(re.findall(r"[A-Za-z_][A-Za-z0-9_./\-]{2,}", it.title + " " + it.body))
    # B73, not B073: the way people say it; no "src=r119" left over in a title
    items = [f"{LETTER[it.type]}{it.n} " + " ".join(re.sub(r"\bsrc=r\d+", " ", it.title).split())[:100] for it in pool[:30]]
    if it0 is not None:
        kids = [k for k in st.items.values() if k.parent == scope]
        docs = [d for d in st.docs.values() if d.n == scope][-3:]
        parts = [it0.title, it0.body or "", it0.next or ""] + [m.text or "" for m in it0.thread][-40:] \
            + [k.title for k in kids] + [d.md or "" for d in docs]
        text = "\n".join(p for p in parts if p)
        for w in re.findall(r"[A-Za-z_][A-Za-z0-9_./\-]{2,}", text):
            words[w] += 3
        for w in re.findall(r"(?:^#+\s*|\*\*)([^*\n]{2,24}?)(?:\*\*|$)", text, re.M):
            for part in re.split(r"[\s\uff0c\u3002\u3001\uff1a:\uff1b;\uff08\uff09()\uff0f/\u00b7|+\uff0b-]+", w):
                if re.search(r"[\u4e00-\u9fff]", part) and 2 <= len(part) <= 12:
                    words[part] += 3
        items.insert(0, f"{LETTER[it0.type]}{it0.n} (the item being discussed: its text, thread, subitems and documents) "
                     + " ".join(re.sub(r"[#*`>|_-]+", " ", text).split())[-6000:])
    return words, items, [it.title for it in pool[:40]]


def voice_prompt(terms: List[str], items: List[str], fixes: List[Dict[str, Any]], prefs: str = VOICE_PREFS) -> str:
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


VOICE_TOKEN = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9_.+'/-]*[A-Za-z0-9])?|[\u3400-\u9fff]")  # a word, or one Chinese character
VOICE_FILLERS = {"\u55ef", "\u5443", "\u989d", "\u6b38", "\u8bf6", "um", "uh", "hmm", "er"}  # um, uh: the same in Chinese
NEGATION = set("\u4e0d\u6ca1\u672a\u522b\u65e0\u975e")  # not, have not, not yet, do not, without, non-
NUMBER = re.compile(r"[0-9\u96f6\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u4e24]+")  # digits; zero..nine, ten, hundred, two
UNSURE = re.compile(r"[ \t]*[(\uff08][?\uff1f][)\uff09]")  # "(?)": the model was unsure of the word before it


EN_NUMBERS = {"zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"}


def voice_tokens(text: str) -> List[Tuple[str, int, int]]:
    return [(m.group().lower(), m.start(), m.end()) for m in VOICE_TOKEN.finditer(text) if m.group().lower() not in VOICE_FILLERS]


def voice_number(s: str) -> bool:
    return bool(s) and (bool(NUMBER.fullmatch(s)) or s in EN_NUMBERS)


def voice_short(tr: str, alt: str) -> bool:
    """The main transcript holds much less than the speech model heard: it stopped early (two iPhone notes kept only
    their first half-sentence). On 328 pairs from real notes the main one always held at least 90%."""
    a, b = len(voice_tokens(tr)), len(voice_tokens(alt))
    return b >= 10 and a < 0.7 * b


def voice_either(s: str) -> bool:
    """"X not X" (can or cannot, is or is not, have or have not): a question in Chinese, not a negation."""
    return len(s) == 3 and s[1] in "\u4e0d\u6ca1" and s[0] == s[2]


def voice_doubts(tr: str, alt: str, most: int = 4) -> List[Dict[str, Any]]:
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
def tidy_ok(heard: str, out: str) -> bool:
    """Tidied words count only when they keep the words: about as long as what was heard, and every link still in."""
    links = re.findall(r"https?://[^\s\uff0c\u3002\u3001\uff09)]+", heard)
    return bool(out) and 0.5 * len(heard) <= len(out) <= 1.15 * len(heard) and all(u in out for u in links)


def traditional(text: Optional[str]) -> List[str]:
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


def fuller(tr: str, ptr: str) -> bool:
    """The strong model's late words hold clearly more than those given: those hold under 90% of its words."""
    a, b = len(voice_tokens(tr)), len(voice_tokens(ptr))
    return b > a and a < 0.9 * b


def echoed(tr: str, titles: List[str]) -> bool:
    """A transcript made only of item titles was copied from the prompt: nobody spoke (B092)."""
    norm = lambda t: " ".join(re.sub(r"[\W_]+", " ", t.lower()).split())
    rest = norm(tr)
    if not rest:
        return False
    for t in sorted({norm(t) for t in titles if norm(t)}, key=len, reverse=True):
        rest = rest.replace(t, " ")
    return not rest.strip()
