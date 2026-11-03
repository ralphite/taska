"""Finding things by what the words mean (F479), with embeddings: every line of every project's short list
(domain.finding.short_list) and the words searched for become Gemini embeddings; the lines closest to the words,
above a floor, are what they mean, closest first (the project you are in first when as close).

Each line's embedding is kept (infra.vectors: meaning.db in the data root) under the SHA-256 of the line's words.
That is not a cache of answers: every search ranks every line as it is now, and a line made or changed a moment ago
has new words, so it gets a new hash and is embedded (it alone) before the search ranks it. Answers are never kept,
because then what is new would be missed. Vectors no line has any more are let go of on each warm-up.

A warm-up thread embeds what is new soon after the server starts and after changes (once they settle), so a search
usually embeds only its own words; one that comes first embeds only the lines still missing (a few seconds for a
few thousand lines, PARALLEL requests at once).

It is on by default, with the key the organizer and voice use; the file `search-by-meaning-off` in the data root
turns it off (settings.py). While it is off, or no key is set, nothing is sent and the search is by the words alone.
"""

from __future__ import annotations

import hashlib
import math
import operator
import sqlite3
import statistics
import threading
import time
from array import array
from concurrent.futures import ThreadPoolExecutor
from typing import Callable, Dict, List, Optional, Sequence, Tuple

from ..domain.finding import Found
from ..domain.vocab import Refused
from ..infra import gemini
from ..infra.logs import log
from ..infra.vectors import Vectors
from .settings import SearchByMeaning

MOST = 30
# How close a line must be to count (cosine, gemini-embedding-001 at 768 numbers). Measured on real data: lines that
# answer a query score 0.64-0.78, while for a query about nothing in it (weather, a recipe, "purple elephant banana")
# no line passes 0.57 in English; in Chinese, short replies (a check mark and "OK, do it like this") reach 0.63-0.68
# for anything, so a line must also stand ABOVE_MEDIAN over the query's median line (its baseline), once there are
# enough lines (BASELINE_LINES) for a median to mean that.
FLOOR = 0.60
ABOVE_MEDIAN = 0.07
BASELINE_LINES = 50
MODEL = f"{gemini.EMBED_MODEL}/{gemini.EMBED_DIMS}"  # what the kept vectors are of
PARALLEL = 5  # embedding requests at once (the first fill of a few thousand lines takes seconds, not half a minute)
SETTLE = 5.0  # the warm-up waits this long after the last change ...
LONGEST_WAIT = 60.0  # ... but no longer than this after the first

Embed = Callable[[str, List[str], str], List[List[float]]]
Lists = List[Tuple[str, str, List[Tuple[Found, str]]]]  # each project: its name, its title, its short list
Line = Tuple[Tuple[str, str], str, str]  # (project, key), its words, their hash


def hash_of(words: str) -> str:
    return hashlib.sha256(words.encode("utf-8")).hexdigest()


def unit(v: Sequence[float]) -> array:
    """The vector at length 1 (cosine is then the dot product), as float32."""
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return array("f", (x / n for x in v))


def closest(q: array, lines: List[Tuple[Tuple[str, str], array]]) -> List[Tuple[str, str]]:
    """(project, key) of the lines closest to `q`, closest first, at most MOST, none under the floor."""
    scores = [(sum(map(operator.mul, q, v)), where) for where, v in lines]
    if not scores:
        return []
    floor = FLOOR
    if len(scores) >= BASELINE_LINES:
        floor = max(FLOOR, statistics.median(s for s, _ in scores) + ABOVE_MEDIAN)
    out: List[Tuple[str, str]] = []
    for s, where in sorted(scores, key=lambda x: -x[0]):  # stable: as close, the order of the lists
        if s < floor or len(out) >= MOST:
            break
        if where not in out:
            out.append(where)
    return out


class Meaning:
    """The projects' lines as embeddings, kept by their words, and what the words searched for are closest to."""

    def __init__(self, setting: SearchByMeaning, allowed: bool = False, embed: Embed = gemini.embed,
                 key: Callable[[], Optional[str]] = gemini.api_key, path: str = "",
                 lists: Callable[[], Lists] = lambda: [], settle: Optional[float] = SETTLE):
        self.setting = setting
        self.allowed = allowed  # the server talks to Gemini (as the organizer does: `--organizer auto` with a key)
        self._embed = embed
        self._key = key
        self._path = path  # the kept vectors' file; "": in memory only
        self._lists = lists  # every project's short list now, for the warm-up
        self._settle = settle  # None: no warm-up thread
        self._vectors: Optional[Dict[str, array]] = None  # by hash, loaded from the file on first use
        self._store: Optional[Vectors] = None
        self._open = threading.Lock()
        self._filling = threading.Lock()  # one fill at a time
        self._poked = threading.Event()
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def on(self) -> bool:
        return self.allowed and self.setting.on() and bool(self._key())

    def rank(self, q: str, lists: Lists) -> Optional[List[Tuple[str, str]]]:
        """(project, key) of what `q` means, closest first; None: not asked (off, nothing to rank) or no answer."""
        said = " ".join(q.split())
        if not said or not self.on():
            return None
        lines = self._lines(lists)
        if not lines:
            return None
        try:
            q_vector = unit(self._embed("search", [said], gemini.QUERY)[0])
            vectors = self._fill(lines)
        except (Refused, sqlite3.Error) as ex:
            log.warning(f"search by meaning failed: {ex}")
            return None
        return closest(q_vector, [(where, v) for where, _, h in lines if (v := vectors.get(h)) is not None])

    def warm(self) -> None:
        """Every line has its vector; the vectors no line has any more are let go of."""
        if not self.on():
            return
        lines = self._lines(self._lists())
        self._fill(lines)
        keep = {h for _, _, h in lines}
        with self._filling:
            vectors = self._loaded()
            for h in [h for h in vectors if h not in keep]:
                del vectors[h]
            if self._store:
                self._store.keep_only(MODEL, keep)

    def soon(self) -> None:
        """Warm up once changes settle (the warm-up thread starts on the first call)."""
        if self._settle is None or self._stop.is_set() or not self.on():
            return
        self._poked.set()
        with self._open:
            if self._thread is None:
                self._thread = threading.Thread(target=self._warming, daemon=True, name="meaning-warm-up")
                self._thread.start()

    def close(self) -> None:
        self._stop.set()
        self._poked.set()

    def _warming(self) -> None:
        settle = self._settle or 0.0
        while True:
            self._poked.wait()
            first = time.monotonic()
            while self._poked.is_set() and not self._stop.is_set() and time.monotonic() - first < LONGEST_WAIT:
                self._poked.clear()
                self._stop.wait(settle)
            if self._stop.is_set():
                return
            try:
                self.warm()
            except Exception as ex:  # the warm-up must never take Taska down; the next search fills in
                log.warning(f"search by meaning: warm-up failed: {ex}")

    @staticmethod
    def _lines(lists: Lists) -> List[Line]:
        return [((name, f.key), words, hash_of(words)) for name, _, short in lists for f, words in short]

    def _loaded(self) -> Dict[str, array]:
        with self._open:
            if self._vectors is None:
                if self._path:
                    self._store = Vectors(self._path)
                    self._vectors = self._store.all(MODEL)
                else:
                    self._vectors = {}
            return self._vectors

    def _fill(self, lines: List[Line]) -> Dict[str, array]:
        """The vectors, with those of `lines` that were missing embedded (PARALLEL batches at a time) and kept. One
        fill at a time: a search that comes during the warm-up waits for it, then has nothing left to embed."""
        vectors = self._loaded()
        if all(h in vectors for _, _, h in lines):
            return vectors
        with self._filling:
            words = {h: w for _, w, h in lines if h not in vectors}
            missing = list(words)
            batches = [missing[i: i + gemini.EMBED_BATCH] for i in range(0, len(missing), gemini.EMBED_BATCH)]
            failed: Optional[Exception] = None
            with ThreadPoolExecutor(min(PARALLEL, len(batches) or 1), thread_name_prefix="meaning-embed") as pool:
                asked = [pool.submit(self._embed, "search", [words[h] for h in b], gemini.DOCUMENT) for b in batches]
                for batch, answer in zip(batches, asked):
                    try:
                        got = [(h, unit(v)) for h, v in zip(batch, answer.result())]
                    except Refused as ex:
                        failed = failed or ex
                        continue
                    if self._store:
                        self._store.put(MODEL, got)
                    vectors.update(got)
            if failed:
                raise failed
        return vectors
