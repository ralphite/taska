"""Voice notes into words (B165, T101, B277, T256): two models listen at once, the project's own words are the hints,
where the two heard differently in a way that changes the meaning reviewers settle it (B724, services.voice_vote),
and the words they could not agree on are pointed out. A phone's processed recording is
heard by the strong model too; a quiet note again, made louder; a long note with few words again, piece by piece;
the words tidied when the user wants them tidied, the words as said kept. Every step that ran is kept with the note
(T697 r(D121)): its model, its words or its error, how long it took, and whether its words were chosen.

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
from ..domain.voice_words import (TIDY_SYSTEM, VOICE_HINT, VOICE_SYSTEM, echoed, tidy_ok, voice_doubts, voice_glossary,
                                  voice_prompt, voice_short, voice_terms, voice_tokens, voice_vocab)
from ..infra import audio as tools
from ..infra.gemini import ask, client, words_of
from . import voice_vote


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
# - Simplified characters only: the transcribing and the tidying instructions say so (T697 r(D121): no separate
#   request to turn Traditional characters Simplified any more).
# - A phone's voice processing (iPhone Safari records through the one made for calls) can cut every pause to digital
#   silence and turn later phrases 10 to 30 dB quieter. On two such notes both models kept only the first few words,
#   whatever the format, loudness or silence was changed to; only the strong model heard the rest. Such a note (exact
#   digital silence inside the speech, which none of 59 notes from a computer had) is heard by it too.
# T687 (Yadong's choice, #9841, measured on 40 of his notes): the speech model's words show at once (~2 s); the strong
# model hears the note too and its words win (D121, 11-06: a try with no answer in 30 s fails and it is asked again); tidying
# and pieces use gemini-3.5-flash (tidying: median 1.7 s against 45 s, judged 4.04 against 4.29).
VOICE_MODEL = os.environ.get("TASKA_VOICE_MODEL", "gemini-3.5-flash")
ASR_MODEL = os.environ.get("TASKA_ASR_MODEL", "gemini-3.5-transcribe")
PRO_MODEL = os.environ.get("TASKA_PRO_MODEL", "gemini-3.1-pro-preview")
# How long one voice note may take, in seconds: the strong model once took 250 s on a phone note. Each model gets its
# own cap; what one did not finish in time is left out.
VOICE_CAP = float(os.environ.get("TASKA_VOICE_CAP", 50))  # the main and the speech model
PRO_TRIES = int(os.environ.get("TASKA_PRO_TRIES", 3))  # D121 (11-06): failed, the strong model is asked again
PRO_TRY = float(os.environ.get("TASKA_PRO_TRY", 30))  # T697 (11-06): one try with no answer in 30 s failed (the slowest answer was 8 s)
# B724: where the two disagree on what was said, reviewers settle it (services.voice_vote): the strong model, or the
# models named here in turn
VOTE_MODELS = [m.strip() for m in os.environ.get("TASKA_VOTE_MODELS", PRO_MODEL).split(",") if m.strip()]


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


def capped(fn: Callable[[], Any], secs: float, what: str, times: Optional[Dict[str, float]] = None, key: Optional[str] = None) -> Any:
    """fn() in a thread, given secs at most: its answer, or Refused("<what> timed out after N s"); the thread is left to
    finish on its own. times[key]: how long it took."""
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
        raise Refused(f"{what} timed out after {secs:.0f} s")
    if "e" in box:
        raise box["e"]
    return box["v"]


TIDY_CAP, TIDY_TRIES = float(os.environ.get("TASKA_TIDY_CAP", 8)), 3
Step = Dict[str, Any]


def strong(steps: List[Step], name: str, audio: Dict[str, Any], prompt: str, times: Dict[str, float], key: str) -> Callable[[], str]:
    """The strong model's words (Yadong on D121, 11-06: "not 10 s: wait, and when it fails, ask again"; T697: a try
    with no answer in PRO_TRY seconds has failed, as connections stalled for 4 to 6 minutes): up to PRO_TRIES tries,
    each its own step (every result kept), a little apart."""
    hear = lambda: capped(lambda: voice_main(audio, prompt, PRO_MODEL), PRO_TRY, "the strong model")  # a stalled connection is a failed try
    first = ran(steps, name, PRO_MODEL, hear)  # its step in the order the steps are started

    def go() -> str:
        t0, last = time.time(), None
        try:
            for i in range(PRO_TRIES):
                try:
                    return (first if i == 0 else ran(steps, f"{name}_{i + 1}", PRO_MODEL, hear))()
                except Exception as ex:
                    last = ex
                    if i + 1 < PRO_TRIES:
                        time.sleep(min(8, 2 ** i))
            raise last or Refused("the strong model failed")
        finally:
            times[key] = round(time.time() - t0, 1)
    return go


def tidy(text: str, step: Optional[Step] = None) -> str:
    """text made smooth to read (TIDY_SYSTEM), or as it was: short words, no good answer within TIDY_CAP, or words lost.
    Asked TIDY_TRIES times at once; the first answer that keeps the words wins (Nota's T678). step (a dict) gets every
    answer back by then ("tries": its words or its error, whether it kept the words) and the words chosen."""
    if len(text) < 12:
        return text
    got = queue.Queue()

    def one():
        try:
            out, why = ask("voice", TIDY_SYSTEM, [{"text": text}], think=0, temperature=0.2, timeout=60, answer_in=("text", "the tidied text"), model=VOICE_MODEL), ""
        except Exception as ex:
            out, why = "", str(ex) or "failed"
        got.put((out, why))
    for _ in range(TIDY_TRIES):
        threading.Thread(target=one, daemon=True).start()
    tries: List[Dict[str, Any]] = []
    if step is not None:
        step["tries"] = tries
    end = time.time() + TIDY_CAP
    for _ in range(TIDY_TRIES):
        try:
            out, why = got.get(timeout=max(0.0, end - time.time()))
        except queue.Empty:
            tries.append({"error": f"no answer within {TIDY_CAP:.0f} s"})
            break
        ok = tidy_ok(text, out)
        tries.append({"error": why} if why else {"text": out, "kept": ok})
        if ok:
            if step is not None:
                step["text"] = out
            return out
    if step is not None:
        step["error"] = "no tidied words kept all the words"
    return text


def voice_by_pieces(path: Optional[str], prompt: str, vocab: List[str]) -> Tuple[str, List[Dict[str, Any]]]:
    """B277: the note heard piece by piece (voice_pieces), both models on each at once. A piece counts only when the
    speech model heard words in it (it never makes words up from noise); the main model's words win there.
    -> (the words, each piece's two answers: words or error); no pieces when the note is not cut."""
    pieces, _secs = tools.pieces(path)
    if len(pieces) < 2:
        return "", []

    def answer(v: Any, e: Optional[BaseException]) -> Dict[str, Any]:
        return {"error": str(e) or "failed"} if e else {"text": v or ""}

    def one(wav: bytes) -> Tuple[str, Dict[str, Any]]:
        aud = {"inline_data": {"mime_type": "audio/wav", "data": base64.b64encode(wav).decode()}}
        (m, me), (a, ae) = together(lambda: capped(lambda: voice_main(aud, prompt), 30, "the main model"), lambda: capped(lambda: voice_asr(aud, vocab), 30, "the speech model"))
        return ((m or a or "").strip() if (a or "").strip() else ""), {"main": answer(m, me), "asr": answer(a, ae)}
    got = together(*[(lambda w=w: one(w)) for w in pieces])
    parts = [r[0] for r, _e in got if r and r[0]]
    each = [r[1] if r else {"error": str(e) or "failed"} for r, e in got]
    words = "".join(p if re.search(r"[。，？！.,?!]$", p) else p + "，" for p in parts).rstrip("，") + ("。" if parts and not re.search(r"[。？！.?!]$", parts[-1]) else "")
    return words, each


def ran(steps: List[Step], name: str, model: str, fn: Callable[[], Any]) -> Callable[[], Any]:
    """fn as a step of hearing the note (T697 r(D121): every result is kept): its record goes into steps now, in the
    order the steps are started, and gets its words or its error and how long it took once fn is done."""
    step: Step = {"step": name, "model": model}
    steps.append(step)

    def run() -> Any:
        t0 = time.time()
        try:
            out = fn()
            step["text"] = out if isinstance(out, str) else str(out or "")
            return out
        except Exception as ex:
            step["error"] = str(ex) or "failed"
            raise
        finally:
            step["secs"] = round(time.time() - t0, 1)
    return run


def chose(steps: List[Step], name: str) -> None:
    """The step whose words the note got (the last of that name that answered; a try again is "<name>_2", ...)."""
    for step in reversed(steps):
        if re.fullmatch(re.escape(name) + r"(_\d+)?", step["step"]) and "error" not in step:
            step["chosen"] = True
            return


def transcribe(h: Hearing, data: bytes, mime: str, scope: Optional[int], path: Optional[str] = None,
               first: Optional[Callable[[str], None]] = None) -> Dict[str, Any]:
    """Voice note -> {"tr": its words ("" when nobody spoke), "tr_by": "main", "asr", "pro" or "pieces", "alt": the
    other model's words, "doubts": what may be misheard, "steps": every step that ran (T697 r(D121)): its model, its
    words or its error, how long it took, and "chosen" on the step whose words the note got (and on tidy when its words
    are the note's)}, biased toward the project's own vocabulary. path: the note on disk. Raises Err when no model
    answered. first(words): the speech model's words, as soon as they are in while the main model still works (T687:
    about 2 s instead of up to a minute); the answer's words then take their place."""
    words, items, titles = h.context(scope)
    fixes = h.fixes()
    terms = voice_terms(words, fixes)
    audio = {"inline_data": {"mime_type": mime.split(";")[0], "data": base64.b64encode(data).decode()}}
    vocab = voice_vocab(terms, items, fixes)  # B724: the open items' codes and the product's words too
    prompt = voice_prompt(terms, items, fixes, h.prefs())
    t0, times = time.time(), {}
    steps: List[Step] = []
    gated = tools.processed_silence(path, mime) >= 0.5
    def told(words: str) -> str:  # the speech model's words go ahead while the main model still works (T687)
        if first and words.strip() and "main" not in times:
            early = words.strip()
            for c in fixes:
                if c.get("wrong"):
                    early = early.replace(c["wrong"], c["right"])
            first(early)
        return words

    # the strong model is the main one (T687); the speech model's words show meanwhile, and it is waited for (D121)
    (tr, err), (alt, alt_err) = together(
        strong(steps, "pro", audio, prompt, times, "main"),
        ran(steps, "asr", ASR_MODEL, lambda: told(capped(lambda: voice_asr(audio, vocab), VOICE_CAP, "the speech model", times, "asr"))))
    out = {"tr": "", "tr_by": "asr", "times": times, "steps": steps, **({"gated": True} if gated else {})}
    if alt_err is None and not alt:  # B494: heard nobody: said too quietly? once more, made loud enough to hear
        louder = tools.louder(data, mime)
        if louder:
            loud = {"inline_data": {"mime_type": "audio/webm", "data": base64.b64encode(louder).decode()}}
            (tr, err), (alt, alt_err) = together(
                strong(steps, "pro_loud", loud, prompt, times, "main_loud"),
                ran(steps, "asr_loud", ASR_MODEL, lambda: capped(lambda: voice_asr(loud, vocab), VOICE_CAP, "the speech model, louder", times, "asr_loud")))
            if alt:
                out["louder"], audio = True, loud
    if err:
        out["main_error"] = str(err)
    if alt_err:
        out["asr_error"] = str(alt_err)
    if alt_err is None and not alt:  # the speech model heard nobody: what the other wrote was made up (B092)
        times["total"] = round(time.time() - t0, 1)
        return out
    if err is None and tr and not echoed(tr, titles) and alt_err is None and voice_short(tr, alt):
        # it stopped early: the speech model's words (each try of it is kept in steps)
        out["main_error"] = f"the strong model's transcript stopped early ({len(voice_tokens(tr))} of {len(voice_tokens(alt))} words)"
        tr = ""
    if err is None and tr and not echoed(tr, titles):
        out["tr_by"] = "pro"
    elif alt_err is None:  # the main one refused, failed, stopped early, heard nothing or wrote only item titles: the speech model's words
        tr, alt = alt, ""
    elif err is None:  # nothing heard but item titles, and no second opinion
        out["tr_by"], tr = "main", ""
    else:
        tr = None
    times["total"] = round(time.time() - t0, 1)
    if tr is None:
        raise Refused(f"{err}; the speech model: {alt_err}")
    if not tr:
        return out
    dur = tools.duration(path)  # B277: few words for a long note: heard again piece by piece, and those words win when clearly more
    if dur >= 6 and len(voice_tokens(tr)) < 2.0 * dur and len(tr) < 2.0 * dur:
        t1 = time.time()
        try:
            (pieced, each), why = voice_by_pieces(path, prompt, vocab), ""
        except Exception as ex:
            pieced, each, why = "", [], str(ex) or "failed"
        times["pieces"] = round(time.time() - t1, 1)
        if each or why:
            steps.append({"step": "pieces", "model": f"{VOICE_MODEL} + {ASR_MODEL}", "secs": times["pieces"],
                          **({"error": why} if why else {"text": pieced, "pieces": each})})
        if pieced and len(pieced) >= 1.3 * len(tr) and not echoed(pieced, titles):
            out["tr_by"], alt, tr = "pieces", tr, pieced
        times["total"] = round(time.time() - t0, 1)
    again = "_loud" if out.get("louder") else ""
    chose(steps, {"pro": "pro" + again, "asr": "asr" + again}.get(out["tr_by"], out["tr_by"]))
    for c in fixes:  # what the user fixed once stays fixed (F144)
        if c.get("wrong"):
            tr, alt = tr.replace(c["wrong"], c["right"]), alt.replace(c["wrong"], c["right"])
    if out["tr_by"] == "pro" and alt:  # B724: where the two heard differently, reviewers settle it
        t1 = time.time()
        tr, doubts = voice_vote.settle(steps, audio, tr, alt, voice_glossary(items, fixes, terms), VOTE_MODELS)
        if steps[-1]["step"] == "vote":
            times["vote"] = round(time.time() - t1, 1)
        times["total"] = round(time.time() - t0, 1)
    else:
        doubts = voice_doubts(tr, alt)
    if h.tidy():  # T256: smooth to read, the words as said kept as "heard"
        t0_ = time.time()
        step: Step = {"step": "tidy", "model": VOICE_MODEL}
        nice = tidy(tr, step)
        times["tidy"] = step["secs"] = round(time.time() - t0_, 1)
        if "tries" in step:  # it was asked (short words are not)
            steps.append(step)
        if nice != tr:
            out["heard"], tr = tr, nice
            step["chosen"] = True
    return dict(out, tr=tr, alt=alt, doubts=doubts)
