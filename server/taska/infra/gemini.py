"""Talking to Gemini (the organizer, voice notes into words, and search by meaning). A question (Question) becomes one
generateContent request; texts to find by meaning become embeddings (`embed`, batchEmbedContents, at most EMBED_BATCH
texts a request). The client (Gemini) sends over HTTPS with the standard library and decides, attempt by attempt,
whether to try again (busy, cut off) or to ask without the thinking switch a model does not have. Only what is sent
here leaves the machine, and only when a key is set. Every request is one entry in the log: what was sent (audio and
pictures by size only; texts to embed by their count and length only), the reply (embeddings by their count only),
how long it took, the tokens, and who asked."""

from __future__ import annotations

import http.client
import json
import os
import random
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple

from ..domain.text import first_line
from ..domain.vocab import Refused
from .logs import log

Json = Dict[str, Any]
KEY_VARS = ("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY")
MODEL = os.environ.get("TASKA_MODEL", "gemini-flash-latest")
ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
EMBED_MODEL = "gemini-embedding-001"
EMBED_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:batchEmbedContents"
EMBED_DIMS = 768
EMBED_BATCH = 100  # texts in one request
DOCUMENT, QUERY = "RETRIEVAL_DOCUMENT", "RETRIEVAL_QUERY"  # what is searched, what searches it
ATTEMPTS = 6
SERVER = frozenset((500, 502, 503, 504))  # its servers busy or failing: often over in seconds (B684)
TOO_MANY = 429  # over a rate (tokens or requests per minute): it says when to come back


def api_key() -> Optional[str]:
    return next((os.environ[v] for v in KEY_VARS if os.environ.get(v)), None)


@dataclass(frozen=True)
class Question:
    """What to ask: the instructions, the parts (words, audio, pictures), how much to think, and optionally one JSON
    field to answer in (its name and what it holds), which keeps prefaces and notes out of the answer."""
    system: str
    parts: List[Json]
    think: int = 0
    temperature: float = 0.2
    answer_in: Optional[Tuple[str, str]] = None

    def body(self) -> Json:
        config: Json = {"temperature": self.temperature, "thinkingConfig": {"thinkingBudget": self.think}}
        if self.answer_in:
            name, what = self.answer_in
            config["responseMimeType"] = "application/json"
            config["responseSchema"] = {"type": "OBJECT", "properties": {name: {"type": "STRING", "description": what}},
                                        "required": [name]}
        out: Json = {"contents": [{"role": "user", "parts": self.parts}], "generationConfig": config}
        if self.system:
            out["systemInstruction"] = {"parts": [{"text": self.system}]}
        return out

    def answer(self, reply: Json) -> str:
        said = words_of(reply)[0]
        if not self.answer_in:
            return said
        try:
            return str(json.loads(said).get(self.answer_in[0]) or "").strip()
        except (ValueError, AttributeError):
            raise Refused("Gemini answered in an unexpected format")


def words_of(reply: Json) -> Tuple[str, Optional[str]]:
    """(the reply's words, why it was refused or None). A speech model's words count as words; thoughts do not."""
    first = (reply.get("candidates") or [{}])[0]
    words = "".join(p.get("text", "") or (p.get("audioTranscription") or {}).get("text", "")
                    for p in first.get("content", {}).get("parts", []) if not p.get("thought")).strip()
    refused = (reply.get("promptFeedback") or {}).get("blockReason")
    if not refused and not words and first.get("finishReason") not in (None, "STOP", "MAX_TOKENS"):
        refused = first["finishReason"]
    return words, refused


class Failed(Exception):
    """One attempt that did not answer: its HTTP status (None: no answer at all) and what came back."""

    def __init__(self, status: Optional[int], detail: str):
        super().__init__(detail)
        self.status, self.detail = status, detail


def https_post(url: str, data: bytes, headers: Dict[str, str], timeout: float) -> Json:
    """The transport: one POST, its JSON answer; Failed when it does not answer with one."""
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers), timeout=timeout) as r:
            got: Json = json.load(r)
            return got
    except urllib.error.HTTPError as ex:
        raise Failed(ex.code, ex.read().decode("utf-8", "replace"))
    except (OSError, http.client.HTTPException) as ex:  # unreachable, timed out, connection dropped
        raise Failed(None, repr(ex))


def _sizes_only(x: Any) -> Any:
    """What was sent, with audio and pictures as their size."""
    if isinstance(x, list):
        return [_sizes_only(v) for v in x]
    if not isinstance(x, dict):
        return x
    if "data" in x and ("mime_type" in x or "mimeType" in x):
        return {"mime_type": x.get("mime_type") or x.get("mimeType"), "bytes": len(str(x["data"])) * 3 // 4}
    return {k: _sizes_only(v) for k, v in x.items()}


def _logged(who: str, model: str, body: Json, ms: int, reply: Optional[Json] = None, status: Optional[int] = None,
            error: str = "") -> None:
    usage = (reply or {}).get("usageMetadata") or {}
    (log.error if error else log.info)(f"gemini {model} for {who}: {status or 200} in {ms} ms", extra={"f": {
        "source": "server", "kind": "gemini", "who": "org" if who == "organizer" else who, "ms": ms,
        "status": status or (200 if reply is not None else None), "model": model, "sent": _sizes_only(body),
        "reply": reply, "error": error or None, "tokens_in": usage.get("promptTokenCount"),
        "tokens_out": usage.get("candidatesTokenCount"), "tokens_think": usage.get("thoughtsTokenCount")}})


@dataclass
class Gemini:
    """The client: the key, the model, the transport and the clock are its own, so a test gives its own."""
    key: Callable[[], Optional[str]] = api_key
    model: str = MODEL
    post: Callable[[str, bytes, Dict[str, str], float], Json] = https_post
    pause: Callable[[float], None] = time.sleep
    clock: Callable[[], float] = field(default=time.monotonic)
    jitter: Callable[[], float] = random.random

    def ask(self, who: str, q: Question, timeout: float = 120, model: Optional[str] = None) -> str:
        return q.answer(self.generate(who, model or self.model, q.body(), timeout))

    def generate(self, who: str, model: str, body: Json, timeout: float = 120) -> Json:
        """One question -> the reply, after as many attempts as it takes (at most ATTEMPTS)."""
        return self._send(who, model, ENDPOINT.format(model=model), body, timeout)

    def embed(self, who: str, texts: List[str], task: str, timeout: float = 30) -> List[List[float]]:
        """Each text's embedding (EMBED_DIMS numbers, in its order), EMBED_BATCH texts a request; `task`: DOCUMENT for
        what is searched, QUERY for what searches it."""
        out: List[List[float]] = []
        for i in range(0, len(texts), EMBED_BATCH):
            chunk = texts[i: i + EMBED_BATCH]
            body = {"requests": [{"model": f"models/{EMBED_MODEL}", "content": {"parts": [{"text": t}]},
                                  "taskType": task, "outputDimensionality": EMBED_DIMS} for t in chunk]}
            seen = {"texts": len(chunk), "chars": sum(len(t) for t in chunk), "taskType": task,
                    "outputDimensionality": EMBED_DIMS}
            reply = self._send(who, EMBED_MODEL, EMBED_ENDPOINT.format(model=EMBED_MODEL), body, timeout, seen)
            got = [e.get("values") for e in reply.get("embeddings") or []]
            if len(got) != len(chunk) or not all(isinstance(v, list) and len(v) == EMBED_DIMS for v in got):
                raise Refused("Gemini answered the embeddings in an unexpected format")
            out += got
        return out

    def _send(self, who: str, model: str, url: str, body: Json, timeout: float, seen: Optional[Json] = None) -> Json:
        """One request -> its reply, after as many attempts as it takes (at most ATTEMPTS); `seen`: what the log
        keeps of what was sent and of the reply's size, instead of both."""
        for attempt in range(ATTEMPTS):
            t0 = self.clock()
            try:
                reply = self.post(url, json.dumps(body).encode(),
                                  {"x-goog-api-key": self.key() or "", "Content-Type": "application/json"}, timeout)
            except Failed as fail:
                _logged(who, model, seen or body, int((self.clock() - t0) * 1000), status=fail.status,
                        error=fail.detail[:4000] if fail.status else fail.detail)
                wait = self._again(fail, body, attempt)
                if wait is None:
                    raise Refused(f"Gemini HTTP {fail.status}: {first_line(fail.detail, 160)}" if fail.status
                                  else f"Gemini unreachable: {fail.detail}")
                if wait:
                    self.pause(wait)
                continue
            _logged(who, model, seen or body, int((self.clock() - t0) * 1000),
                    reply={"embeddings": len(reply.get("embeddings") or [])} if seen else reply)
            return reply
        raise Refused("Gemini failed")

    def _again(self, fail: Failed, body: Json, attempt: int) -> Optional[float]:
        """How long to wait before the next attempt (0: at once); None: no more attempts (B684, aimed at what
        happens most): a model without a thinking switch is asked again at once without it; over a rate (429), after
        the wait it names; its servers busy or failing (5xx), after 1, 2, 4, 8, 16 s, each spread at random so many
        waiting do not come back together; the connection dropped, after a short pause. A request that ran out of
        time is not sent again here: it took the whole time already, and its caller asks again later."""
        config = body.get("generationConfig") or {}
        if fail.status == 400 and "hinking" in fail.detail and "thinkingConfig" in config:
            del config["thinkingConfig"]
            return 0
        if attempt >= ATTEMPTS - 1:
            return None
        spread = 0.5 + self.jitter()  # 0.5 to 1.5 times the wait
        if fail.status is None:
            return None if re.search(r"(?i)timed? ?out", fail.detail) else min(8.0, 2.0 ** attempt) * spread
        if fail.status == TOO_MANY:
            named = retry_delay(fail.detail)
            return min(60.0, named if named is not None else 2.0 ** (attempt + 1)) + self.jitter()
        return min(16.0, 2.0 ** attempt) * spread if fail.status in SERVER else None


def retry_delay(detail: str) -> Optional[float]:
    """The wait a 429 names (its RetryInfo: "retryDelay": "23s", or "retry in 23.5s"), in seconds."""
    m = re.search(r'"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"', detail) or re.search(r"(?i)retry in (\d+(?:\.\d+)?)\s*s", detail)
    return float(m.group(1)) if m else None


client = Gemini()


def ask(who: str, system: str, parts: List[Json], think: int = 0, temperature: float = 0.2, timeout: float = 120,
        answer_in: Optional[Tuple[str, str]] = None, model: Optional[str] = None) -> str:
    """Ask with the server's one client (the organizer's and voice's way in)."""
    return client.ask(who, Question(system, parts, think, temperature, answer_in), timeout, model)


def embed(who: str, texts: List[str], task: str, timeout: float = 30) -> List[List[float]]:
    """Embed with the server's one client (search by meaning's way in)."""
    return client.embed(who, texts, task, timeout)
