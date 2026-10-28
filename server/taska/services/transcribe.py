"""Voice notes into words (B165, T101, B277, T256): two models listen at once, the project's own words are the hints,
and the words where the two heard differently are pointed out before you send. A phone's processed recording is
heard by the strong model too; a quiet note again, made louder; a long note with few words again, piece by piece;
Traditional characters made Simplified; the words tidied when the user wants them tidied, the words as said kept.

Only the standard library: Gemini over HTTPS (infra.gemini), afconvert / ffmpeg when the machine has them (infra.audio).
"""

from __future__ import annotations

import base64
import json
import os
import queue
import re
import threading
import time
from collections import Counter
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Tuple

from ..domain.vocab import Refused
from ..domain.voice_words import (T2S_HINT, T2S_SYSTEM, TIDY_SYSTEM, VOICE_HINT, VOICE_SYSTEM, echoed, fuller,
                                  tidy_ok, traditional, voice_doubts, voice_prompt, voice_short, voice_terms, voice_tokens)
from ..infra import audio as tools
from ..infra.gemini import ask, client, words_of


def generate(model: str, body: Dict[str, Any], timeout: float = 120) -> Dict[str, Any]:
    return client.generate("voice", model, body, timeout)


@dataclass
class Hearing:
    """What a note is heard with: the project's context for it, the spellings fixed before, the user's preferences,
    whether the words are tidied."""
    context: Callable[[Optional[int]], Tuple["Counter[str]", List[str], List[str]]]
    fixes: Callable[[], List[Dict[str, Any]]]
    prefs: Callable[[], str]
    tidy: Callable[[], bool]


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
        text, why = words_of(generate(model or VOICE_MODEL, body, timeout=240 if model else 120))
        if why and attempt == 1:
            continue
        if why:
            raise Refused(f"Gemini refused it twice ({why})")
        try:
            return str(json.loads(text).get("transcript") or "").strip()
        except (ValueError, AttributeError):
            raise Refused("Gemini answered in an unexpected format")
    raise Refused("Gemini refused it")


def voice_asr(audio: Dict[str, Any], vocab: List[str]) -> str:
    """The second opinion: the dedicated speech-to-text model, with the project's words. "" = nobody spoke."""
    body = {"contents": [{"role": "user", "parts": [audio]}], "generationConfig": {"audioTranscriptionConfig": {
        "mode": "VERBATIM", "languageCodes": ["cmn-Hans-CN", "en-US"], "customVocabulary": vocab}}}
    text, why = words_of(generate(ASR_MODEL, body))
    if why:
        raise Refused(f"the speech model refused it ({why})")
    return text


def together(*fns: Callable[[], Any], wait: float = 360) -> List[Tuple[Any, Optional[BaseException]]]:
    """The first function here and the others in threads, all at the same time -> [(result, None) or (None, error)]."""
    out: List[Tuple[Any, Optional[BaseException]]] = [(None, Refused("no answer in time"))] * len(fns)

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
    """fn() in a thread, given secs at most: its answer, or Refused("<what> timed out after N s"); the thread is left to
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
        raise Refused(f"{what} timed out after {secs:.0f} s")
    if "e" in box:
        raise box["e"]
    return box["v"]


def simplified(text: str) -> str:
    """text with its Traditional characters made Simplified by one cheap text-only request, made only when there are
    any. Nothing else may change (the same Latin words and numbers, about the same length), or text stays as it was."""
    before = traditional(text)
    if not before:
        return text
    try:
        out = ask("voice", T2S_SYSTEM, [{"text": text}], think=0, temperature=0, timeout=60, answer_in=("text", T2S_HINT), model=VOICE_MODEL)
    except Exception:
        return text
    latin = lambda s: re.findall(r"[A-Za-z0-9]+", s)
    same = latin(out) == latin(text) and abs(len(out) - len(text)) <= max(2, len(text) // 50)
    return out if out and same and len(traditional(out)) < len(before) else text


TIDY_CAP, TIDY_TRIES = float(os.environ.get("TASKA_TIDY_CAP", 8)), 3


def tidy(text: str) -> str:
    """text made smooth to read (TIDY_SYSTEM), or as it was: short words, no good answer within TIDY_CAP, or words lost.
    Asked TIDY_TRIES times at once; the first answer that keeps the words wins (Nota's T678)."""
    if len(text) < 12:
        return text
    got = queue.Queue()

    def one():
        try:
            out = ask("voice", TIDY_SYSTEM, [{"text": text}], think=0, temperature=0.2, timeout=60, answer_in=("text", "the tidied text"), model=VOICE_MODEL)
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


def voice_by_pieces(path: Optional[str], prompt: str, vocab: List[str]) -> str:
    """B277: the note heard piece by piece (voice_pieces), both models on each at once. A piece counts only when the
    speech model heard words in it (it never makes words up from noise); the main model's words win there."""
    pieces, _secs = tools.pieces(path)
    if len(pieces) < 2:
        return ""
    def one(wav: bytes) -> str:
        aud = {"inline_data": {"mime_type": "audio/wav", "data": base64.b64encode(wav).decode()}}
        (m, _), (a, _) = together(lambda: capped(lambda: voice_main(aud, prompt), 30, "the main model"), lambda: capped(lambda: voice_asr(aud, vocab), 30, "the speech model"))
        return (m or a or "").strip() if (a or "").strip() else ""
    got = together(*[(lambda w=w: one(w)) for w in pieces])
    parts = [t for t, _e in got if t]
    return "".join(p if re.search(r"[\u3002\uff0c\uff1f\uff01.,?!]$", p) else p + "\uff0c" for p in parts).rstrip("\uff0c") + ("\u3002" if parts and not re.search(r"[\u3002\uff1f\uff01.?!]$", parts[-1]) else "")


def transcribe(h: Hearing, data: bytes, mime: str, scope: Optional[int], path: Optional[str] = None,
               later: Optional[Callable[[Optional[str]], None]] = None) -> Dict[str, Any]:
    """Voice note -> {"tr": its words ("" when nobody spoke), "tr_by": "main", "asr" or "pro", "alt": the other model's
    words, "doubts": what may be misheard}, biased toward the project's own vocabulary. path: the note on disk, to tell
    a phone's voice-processed recording, which the strong model hears too. Raises Err when no model answered.
    later(words or None): when the strong model ran out of time, it goes on for up to PRO_LATE; later gets its words
    once they are in, if they hold clearly more than the words given (these hold under 90% of them), else None. The
    answer then says "more": the words may be cut short, fuller ones may follow."""
    words, items, titles = h.context(scope)
    fixes = h.fixes()
    terms = voice_terms(words, fixes)
    audio = {"inline_data": {"mime_type": mime.split(";")[0], "data": base64.b64encode(data).decode()}}
    vocab = list(dict.fromkeys(["Taska", "P0", "P1", "P2", "P3"] + terms))[:100]
    prompt = voice_prompt(terms, items, fixes, h.prefs())
    t0, times = time.time(), {}
    gated = tools.processed_silence(path, mime) >= 0.5
    calls = [lambda: capped(lambda: voice_main(audio, prompt), VOICE_CAP, "the main model", times, "main"),
             lambda: capped(lambda: voice_asr(audio, vocab), VOICE_CAP, "the speech model", times, "asr")]
    slow = {}  # the strong model's run, when it ran out of time
    if gated:  # the strong model is slow at times: it gets PRO_CAP, then the others' words go on without it
        calls.append(lambda: capped(lambda: voice_main(audio, prompt, PRO_MODEL), PRO_CAP, "the strong model", times, "pro", slow))
    (tr, err), (alt, alt_err), *pro = together(*calls)
    out = {"tr": "", "tr_by": "asr", "times": times, **({"gated": True} if gated else {})}
    if alt_err is None and not alt:  # B494: heard nobody: said too quietly? once more, made loud enough to hear
        louder = tools.louder(data, mime)
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
        raise Refused(f"{err}; the speech model: {alt_err}")
    if not tr:
        return out
    dur = tools.duration(path)  # B277: few words for a long note: heard again piece by piece, and those words win when clearly more
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
    if h.tidy():  # T256: smooth to read, the words as said kept as "heard"
        t0_ = time.time()
        nice = tidy(tr)
        times["tidy"] = round(time.time() - t0_, 1)
        if nice != tr:
            out["heard"], tr = tr, nice
    return dict(out, tr=tr, alt=alt, doubts=doubts)


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
