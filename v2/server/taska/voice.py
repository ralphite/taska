"""Voice notes into words (B165, T101, B277, T256): two models listen at once, the project's own words are the hints,
and the words where the two heard differently are pointed out before you send.

Only the standard library: Gemini over HTTPS, afconvert / ffmpeg when the machine has them (they help with phone
recordings; without them those steps are skipped).
"""

from __future__ import annotations

import array
import base64
import difflib
import io
import json
import math
import mimetypes
import os
import queue
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import wave
from collections import Counter
from typing import TYPE_CHECKING, Any, Callable, Dict, List, Optional, Tuple

from .core import LETTER, Err, now
from .gemini import gemini, gemini_call, reply_text

if TYPE_CHECKING:
    from .store import Store

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


def voice_context(store: "Store", scope: Optional[int]) -> Tuple["Counter[str]", List[str], List[str]]:
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
        it0 = store.items.get(scope) if scope is not None else None
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


def voice_main(audio: Dict[str, Any], prompt: str, model: Optional[str] = None) -> str:
    """The main transcript (VOICE_MODEL, in a JSON field so no preface or notes get in), or the strong model's. Gemini
    sometimes refuses a voice note for no reason it gives (promptFeedback.blockReason): asked once more, then left
    to the speech model."""
    for attempt in (1, 2):
        body: Dict[str, Any] = {"contents": [{"role": "user", "parts": [{"text": prompt}, audio]}],
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
    raise Err("Gemini refused it")


def voice_asr(audio: Dict[str, Any], vocab: List[str]) -> str:
    """The second opinion: the dedicated speech-to-text model, with the project's words. "" = nobody spoke."""
    body = {"contents": [{"role": "user", "parts": [audio]}], "generationConfig": {"audioTranscriptionConfig": {
        "mode": "VERBATIM", "languageCodes": ["cmn-Hans-CN", "en-US"], "customVocabulary": vocab}}}
    text, why = reply_text(gemini_call(ASR_MODEL, body))
    if why:
        raise Err(f"the speech model refused it ({why})")
    return text


def together(*fns: Callable[[], Any], wait: float = 360) -> List[Tuple[Any, Optional[BaseException]]]:
    """The first function here and the others in threads, all at the same time -> [(result, None) or (None, error)]."""
    out: List[Tuple[Any, Optional[BaseException]]] = [(None, Err("no answer in time"))] * len(fns)

    def run(i: int, fn: Callable[[], Any]) -> None:
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


def capped(fn: Callable[[], Any], secs: float, what: str, times: Optional[Dict[str, float]] = None, key: Optional[str] = None,
           keep: Optional[Dict[str, Any]] = None) -> Any:
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


def voice_gated(path: Optional[str], mime: str) -> float:
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


AUDIO_EXT = {"audio/mp4": ".m4a", "audio/x-m4a": ".m4a", "audio/m4a": ".m4a", "audio/aac": ".aac", "audio/mpeg": ".mp3",
             "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/ogg": ".ogg"}


# B494 (r694, r700): a voice note sounds as you spoke it, at the loudness of normal speech: the browser records what the
# microphone hears, untouched (no call processing: B182), which on a laptop is far quieter than speech should be. The
# whole note is brought up by one amount, its loudest moment to just under full scale: nothing is squeezed or cut, the
# pauses stay as they were. What is loud enough already, or silent, stays as it is.
LEVEL_PEAK = -1.0  # dB: where the loudest moment goes
LEVEL_MIN_GAIN = 3.0  # dB: less than this and it is left alone
LEVEL_MAX_GAIN = 30.0  # dB: never more, so a note of nothing but a hum is not made a roar


def voice_level(data: bytes, mime: str) -> Optional[bytes]:
    """A voice note (WebM or MP4) brought to the loudness of normal speech, in the same format. None when it is loud
    enough already, silent, of another format, or there is no ffmpeg."""
    tool = shutil.which("ffmpeg")
    kind = mime.split(";")[0]
    enc = {"audio/webm": ("webm", ["-c:a", "libopus", "-b:a", "96k"]),
           **{m: ("mp4", ["-c:a", "aac", "-b:a", "128k"]) for m in ("audio/mp4", "audio/x-m4a", "audio/m4a")}}.get(kind)
    if not tool or not enc:
        return None
    with tempfile.TemporaryDirectory() as d:
        src, out = os.path.join(d, "in" + AUDIO_EXT.get(kind, ".webm")), os.path.join(d, "out." + enc[0])
        try:
            with open(src, "wb") as f:
                f.write(data)
            r = subprocess.run([tool, "-hide_banner", "-i", src, "-af", "volumedetect", "-f", "null", "-"],
                               capture_output=True, text=True, timeout=60)
            m = re.search(r"max_volume: (-?[\d.]+) dB", r.stderr)
            if not m or float(m.group(1)) < -60:  # silence
                return None
            gain = min(LEVEL_PEAK - float(m.group(1)), LEVEL_MAX_GAIN)
            if gain < LEVEL_MIN_GAIN:
                return None
            subprocess.run([tool, "-hide_banner", "-loglevel", "error", "-y", "-i", src, "-af", f"volume={gain:.1f}dB",
                            *enc[1], "-f", enc[0], out], capture_output=True, timeout=120, check=True)
            with open(out, "rb") as f:
                return f.read() or None
        except (OSError, subprocess.SubprocessError, ValueError):
            return None


def voice_louder(data: bytes, mime: str) -> Optional[bytes]:
    """B494: a note spoken far from the microphone, so quiet the speech model hears nobody: brought up to the loudness
    of normal speech (ffmpeg's loudnorm), as Opus in WebM. None when there is no sound in it at all, or no ffmpeg."""
    tool = shutil.which("ffmpeg")
    if not tool:
        return None
    with tempfile.TemporaryDirectory() as d:
        src, out = os.path.join(d, "in" + AUDIO_EXT.get(mime.split(";")[0], ".webm")), os.path.join(d, "out.webm")
        try:
            with open(src, "wb") as f:
                f.write(data)
            r = subprocess.run([tool, "-hide_banner", "-i", src, "-af", "volumedetect", "-f", "null", "-"], capture_output=True,
                               text=True, timeout=60)
            m = re.search(r"max_volume: (-?[\d.]+) dB", r.stderr)
            if not m or float(m.group(1)) < -45:  # silence, or nothing above a breath: nothing was said
                return None
            subprocess.run([tool, "-hide_banner", "-loglevel", "error", "-y", "-i", src, "-af", "loudnorm=I=-18:TP=-2", "-c:a",
                            "libopus", out], capture_output=True, timeout=120, check=True)
            with open(out, "rb") as f:
                return f.read() or None
        except (OSError, subprocess.SubprocessError, ValueError):
            return None


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


def simplified(text: str) -> str:
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
TIDY_CAP, TIDY_TRIES = float(os.environ.get("TASKA_TIDY_CAP", 8)), 3


def tidy_ok(heard: str, out: str) -> bool:
    """Tidied words count only when they keep the words: about as long as what was heard, and every link still in."""
    links = re.findall(r"https?://[^\s\uff0c\u3002\u3001\uff09)]+", heard)
    return bool(out) and 0.5 * len(heard) <= len(out) <= 1.15 * len(heard) and all(u in out for u in links)


def tidy(text: str) -> str:
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


def voice_pieces(path: Optional[str], most: int = 12) -> Tuple[List[bytes], float]:
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


def voice_by_pieces(path: Optional[str], prompt: str, vocab: List[str]) -> str:
    """B277: the note heard piece by piece (voice_pieces), both models on each at once. A piece counts only when the
    speech model heard words in it (it never makes words up from noise); the main model's words win there."""
    pieces, _secs = voice_pieces(path)
    if len(pieces) < 2:
        return ""
    def one(wav: bytes) -> str:
        aud = {"inline_data": {"mime_type": "audio/wav", "data": base64.b64encode(wav).decode()}}
        (m, _), (a, _) = together(lambda: capped(lambda: voice_main(aud, prompt), 30, "the main model"), lambda: capped(lambda: voice_asr(aud, vocab), 30, "the speech model"))
        return (m or a or "").strip() if (a or "").strip() else ""
    got = together(*[(lambda w=w: one(w)) for w in pieces])
    parts = [t for t, _e in got if t]
    return "".join(p if re.search(r"[\u3002\uff0c\uff1f\uff01.,?!]$", p) else p + "\uff0c" for p in parts).rstrip("\uff0c") + ("\u3002" if parts and not re.search(r"[\u3002\uff1f\uff01.?!]$", parts[-1]) else "")


def transcribe(store: "Store", data: bytes, mime: str, scope: Optional[int], path: Optional[str] = None,
               later: Optional[Callable[[Optional[str]], None]] = None) -> Dict[str, Any]:
    """Voice note -> {"tr": its words ("" when nobody spoke), "tr_by": "main", "asr" or "pro", "alt": the other model's
    words, "doubts": what may be misheard}, biased toward the project's own vocabulary. path: the note on disk, to tell
    a phone's voice-processed recording, which the strong model hears too. Raises Err when no model answered.
    later(words or None): when the strong model ran out of time, it goes on for up to PRO_LATE; later gets its words
    once they are in, if they hold clearly more than the words given (these hold under 90% of them), else None. The
    answer then says "more": the words may be cut short, fuller ones may follow."""
    words, items, titles = voice_context(store, scope)
    hub = store.hub
    fixes = hub.corrections() if hub else []
    terms = voice_terms(words, fixes)
    audio = {"inline_data": {"mime_type": mime.split(";")[0], "data": base64.b64encode(data).decode()}}
    vocab = list(dict.fromkeys(["Taska", "P0", "P1", "P2", "P3"] + terms))[:100]
    prompt = voice_prompt(terms, items, fixes, hub.voice_prefs()["text"] if hub else VOICE_PREFS)
    t0, times = time.time(), {}
    gated = voice_gated(path, mime) >= 0.5
    calls = [lambda: capped(lambda: voice_main(audio, prompt), VOICE_CAP, "the main model", times, "main"),
             lambda: capped(lambda: voice_asr(audio, vocab), VOICE_CAP, "the speech model", times, "asr")]
    slow = {}  # the strong model's run, when it ran out of time
    if gated:  # the strong model is slow at times: it gets PRO_CAP, then the others' words go on without it
        calls.append(lambda: capped(lambda: voice_main(audio, prompt, PRO_MODEL), PRO_CAP, "the strong model", times, "pro", slow))
    (tr, err), (alt, alt_err), *pro = together(*calls)
    out = {"tr": "", "tr_by": "asr", "times": times, **({"gated": True} if gated else {})}
    if alt_err is None and not alt:  # B494: heard nobody: said too quietly? once more, made loud enough to hear
        louder = voice_louder(data, mime)
        if louder:
            loud = {"inline_data": {"mime_type": "audio/webm", "data": base64.b64encode(louder).decode()}}
            (tr, err), (alt, alt_err) = together(
                lambda: capped(lambda: voice_main(loud, prompt), VOICE_CAP, "the main model, louder", times, "main_loud"),
                lambda: capped(lambda: voice_asr(loud, vocab), VOICE_CAP, "the speech model, louder", times, "asr_loud"))
            pro = []  # the strong model heard the quiet note: its words are not the louder note's
            if alt:
                out["louder"] = True
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
    (tr2, _), (alt2, _) = together(lambda: capped(lambda: simplified(tr or ""), cap, "simplifying"), lambda: capped(lambda: simplified(alt or ""), cap, "simplifying"))
    tr, alt = tr2 if tr2 is not None else tr, alt2 if alt2 is not None else (alt or "")
    times["total"] = round(time.time() - t0, 1)
    for c in fixes:  # what the user fixed once stays fixed (F144)
        if c.get("wrong"):
            tr, alt = tr.replace(c["wrong"], c["right"]), alt.replace(c["wrong"], c["right"])
    if later and slow.get("thread"):  # its words may still come: wait for them in the background
        threading.Thread(target=pro_later, args=(slow, t0, tr, titles, fixes, later), daemon=True).start()
        out["more"] = True
    doubts = voice_doubts(tr, alt)
    if hub and hub.tidy_on():  # T256: smooth to read, the words as said kept as "heard"
        t0_ = time.time()
        nice = tidy(tr)
        times["tidy"] = round(time.time() - t0_, 1)
        if nice != tr:
            out["heard"], tr = tr, nice
    return dict(out, tr=tr, alt=alt, doubts=doubts)


def fuller(tr: str, ptr: str) -> bool:
    """The strong model's late words hold clearly more than those given: those hold under 90% of its words."""
    a, b = len(voice_tokens(tr)), len(voice_tokens(ptr))
    return b > a and a < 0.9 * b


def pro_later(slow: Dict[str, Any], t0: float, tr: str, titles: List[str], fixes: List[Dict[str, Any]],
              later: Callable[[Optional[str]], None]) -> None:
    """Wait for a strong model that ran out of time, up to PRO_LATE from the start; later(its words or None)."""
    slow["thread"].join(max(0.0, t0 + PRO_LATE - time.time()))
    ptr = slow["box"].get("v") if not slow["thread"].is_alive() else None
    if ptr and not echoed(ptr, titles):
        ptr = simplified(str(ptr))
        for c in fixes:
            if c.get("wrong"):
                ptr = ptr.replace(c["wrong"], c["right"])
    later(ptr if ptr and fuller(tr, ptr) else None)


def echoed(tr: str, titles: List[str]) -> bool:
    """A transcript made only of item titles was copied from the prompt: nobody spoke (B092)."""
    norm = lambda t: " ".join(re.sub(r"[\W_]+", " ", t.lower()).split())
    rest = norm(tr)
    if not rest:
        return False
    for t in sorted({norm(t) for t in titles if norm(t)}, key=len, reverse=True):
        rest = rest.replace(t, " ")
    return not rest.strip()


def voice_mime(fid: str) -> str:
    """The audio type of an uploaded voice note, by its name; "" for anything else."""
    mime = AUDIO_MIME.get(os.path.splitext(fid)[1].lower()) or (mimetypes.guess_type(fid)[0] or "").replace("video/webm", "audio/webm")
    return mime if mime.startswith("audio/") else ""


def voice_answer(fid: str, job: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """What a page gets for a voice note: its words once they are in, which model's they are, what may be misheard."""
    res = (job or {}).get("res") or {}
    return {"f": fid, "done": not job or job["done"], "tr": job["tr"] if job else "",
            "tr_error": (job["err"] if job else "no such voice note") or "",
            **{k: res[k] for k in ("tr_by", "doubts", "gated", "main_error", "asr_error", "pro_error", "times", "more", "heard") if k in res}}


def voice_saved(store: "Store", fid: str) -> Optional[Dict[str, Any]]:
    """The transcript kept next to a voice note (<file>.tr.json), or None (T101)."""
    try:
        with open(store.local(fid) + ".tr.json", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def voice_keep(store: "Store", fid: str, res: Dict[str, Any]) -> None:
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
