"""Where the fast and the strong model heard a voice note differently, reviewers settle it (B724; Yadong: "cost
doesn't matter, user experience does", "five models, the first three answers"). Each reviewer hears the note with
both transcripts, the spots where they disagree numbered, and the project's words, and answers each spot: the strong
model's words, the fast model's, or its own. The first three answers count; a reading two of them give is used,
otherwise the strong model's words stay and the spot is pointed out as maybe misheard. While Gemini says it is over
a rate (429) for these models, fewer reviewers are asked, a little apart, and the log and the step say so.

The pure part (what disagrees in a way that matters, the question, reading and counting the answers) is
domain.voice_vote; this is the calls.
"""

from __future__ import annotations

import os
import queue
import threading
import time
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

from ..domain.vocab import Refused
from ..domain.voice_vote import REVIEW_SCHEMA, REVIEW_SYSTEM, disputes, read_review, review_prompt, tally
from ..domain.voice_words import UNSURE
from ..infra.gemini import client, words_of
from ..infra.logs import log

VOTERS = int(os.environ.get("TASKA_VOTERS", 5))  # reviewers asked at once
VOTERS_LIMITED = 3  # ... while there were rate limits lately
TAKE = 3  # the answers that count: the first ones in
VOTE_WAIT = float(os.environ.get("TASKA_VOTE_WAIT", 25))  # s: what has not answered by then is left out
LIMIT_WINDOW = 600.0  # s: a rate limit this recent means fewer reviewers
STAGGER = 1.5  # s between reviewers while there were rate limits lately
ATTEMPTS = 2  # each reviewer's request: one more attempt at most (others answer meanwhile)

Step = Dict[str, Any]


def recent_limits(models: List[str]) -> int:
    """Answers over a rate for these models in the last LIMIT_WINDOW seconds."""
    return client.limits(LIMIT_WINDOW, models)


def ask_reviewer(model: str, body: Dict[str, Any], timeout: float) -> Dict[str, Any]:
    return client.generate("voice", model, body, timeout, attempts=ATTEMPTS)


def review(model: str, audio: Dict[str, Any], prompt: str) -> str:
    """One reviewer's answer, as the JSON asked for."""
    body = {"contents": [{"role": "user", "parts": [{"text": prompt}, audio]}],
            "systemInstruction": {"parts": [{"text": REVIEW_SYSTEM}]},
            "generationConfig": {"temperature": 0.4, "responseMimeType": "application/json", "responseSchema": REVIEW_SCHEMA,
                                 "thinkingConfig": {"thinkingLevel": "low"}}}
    text, why = words_of(ask_reviewer(model, body, VOTE_WAIT + 5))
    if why:
        raise Refused(f"Gemini refused it ({why})")
    return text


def over_rate(error: str) -> bool:
    return "429" in error or "RESOURCE_EXHAUSTED" in error or "quota" in error.lower()


def settle(steps: List[Step], audio: Dict[str, Any], tr: str, alt: str, glossary: str,
           models: List[str]) -> Tuple[str, List[Dict[str, Any]]]:
    """The strong model's words tr settled against the fast model's alt -> (the words, what may still be misheard).
    No difference that changes the meaning: tr as it is (without its "(?)" marks: both heard the same) and no
    doubts, and no step. Otherwise a "vote" step goes into steps: its words, each spot with each answer, each
    reviewer's model, time and answer or error, and "chosen" when an answer came."""
    tr = UNSURE.sub("", tr)
    spots = disputes(tr, alt)
    if not spots:
        return tr, []
    models = [m for m in models if m] or ["gemini-3.1-pro-preview"]
    limited = recent_limits(models)
    count, gap = (min(VOTERS, VOTERS_LIMITED), STAGGER) if limited else (VOTERS, 0.0)
    who = [models[i % len(models)] for i in range(count)]
    step: Step = {"step": "vote", "model": ", ".join(f"{m} × {n}" for m, n in Counter(who).items())}
    steps.append(step)
    if limited:
        step["limited"] = {"recent": limited, "within": LIMIT_WINDOW, "reviewers": count, "apart": gap}
        log.warning(f"voice vote: {limited} rate limits in the last {LIMIT_WINDOW / 60:.0f} min: {count} reviewers "
                    f"instead of {VOTERS}, {gap} s apart", extra={"f": {"source": "server", "kind": "voicevote", **step["limited"]}})
    reviewers: List[Dict[str, Any]] = [{"model": m, **({"swap": True} if i % 2 else {})} for i, m in enumerate(who)]
    got: "queue.Queue[Tuple[int, Optional[Dict[int, str]], str, float]]" = queue.Queue()
    t0 = time.time()

    def one(i: int) -> None:
        if gap and i:
            time.sleep(gap * i)
        t1, swap = time.time(), bool(reviewers[i].get("swap"))
        try:
            picks = read_review(review(who[i], audio, review_prompt(tr, alt, spots, glossary, swap)), spots, swap)
            got.put((i, picks, "", round(time.time() - t1, 1)))
        except Exception as ex:  # one failing must not lose the others' answers
            got.put((i, None, str(ex) or "failed", round(time.time() - t1, 1)))
    for i in range(count):
        threading.Thread(target=one, args=(i,), daemon=True).start()
    answers: List[Dict[int, str]] = []
    end, heard = t0 + VOTE_WAIT, 0
    while len(answers) < TAKE and heard < count:
        try:
            i, picks, err, secs = got.get(timeout=max(0.0, end - time.time()))
        except queue.Empty:
            break
        heard += 1
        reviewers[i]["secs"] = secs
        if picks is None:
            reviewers[i]["error"] = err
        else:
            reviewers[i]["picks"] = {str(n): p for n, p in sorted(picks.items())}
            reviewers[i]["used"] = True
            answers.append(picks)
    for r in reviewers:
        if "secs" not in r:
            r["error"] = "not needed: three answered first" if len(answers) >= TAKE else f"no answer within {VOTE_WAIT:.0f} s"
    text, doubts = tally(tr, spots, answers)
    step["secs"] = round(time.time() - t0, 1)
    step["spots"] = [{"n": x.n, "a": x.was, "b": x.alt, "why": x.why, "picks": x.picks} for x in spots]
    step["reviewers"] = reviewers
    hits = sum(1 for r in reviewers if over_rate(str(r.get("error") or "")))
    if hits:
        step["rate_limited"] = hits
        log.warning(f"voice vote: {hits} of {count} reviewers over a rate limit", extra={"f": {
            "source": "server", "kind": "voicevote", "rate_limited": hits, "reviewers": count}})
    if answers:
        step["text"], step["chosen"] = text, True
    else:
        step["error"] = "no reviewer answered: " + "; ".join(sorted({str(r.get("error")) for r in reviewers}))[:300]
    changed = sum(1 for x in spots if x.picks[-1] not in ("result: A", "result: doubt"))
    log.info(f"voice vote: {len(spots)} spots, {len(answers)} of {count} answers in {step['secs']} s, {changed} changed, "
             f"{len(doubts)} left as doubts", extra={"f": {"source": "server", "kind": "voicevote", "ms": int(step["secs"] * 1000)}})
    return text, doubts
