"""Gemini, over plain HTTPS with the standard library: the organizer and the voice transcription use it.

Only what is sent here leaves the machine, and only when a key is set (GEMINI_API_KEY or one of KEY_VARS).
"""

from __future__ import annotations

import http.client
import json
import os
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

from .logs import log
from .core import KEY_VARS, MODEL, Err, first_line

Body = Dict[str, Any]


def api_key() -> Optional[str]:
    for v in KEY_VARS:
        if os.environ.get(v):
            return os.environ[v]
    return None


def keep(model: str, body: Body, t0: float, reply: Optional[Dict[str, Any]] = None, status: Optional[int] = None,
         error: str = "") -> None:
    """T453: every Gemini call into the log table: what was sent (audio and images by size only), the reply, how
    long it took, the tokens, and who asked (the organizer or voice)."""
    def strip(x: Any) -> Any:
        if isinstance(x, dict):
            if "data" in x and ("mime_type" in x or "mimeType" in x):
                return {"mime_type": x.get("mime_type") or x.get("mimeType"), "bytes": len(str(x["data"])) * 3 // 4}
            return {k: strip(v) for k, v in x.items()}
        if isinstance(x, list):
            return [strip(v) for v in x]
        return x
    caller = sys._getframe(2).f_globals.get("__name__", "").rsplit(".", 1)[-1]
    caller = sys._getframe(3).f_globals.get("__name__", "").rsplit(".", 1)[-1] if caller == "gemini" else caller
    use = (reply or {}).get("usageMetadata") or {}
    ms = int((time.monotonic() - t0) * 1000)
    (log.error if error else log.info)(f"gemini {model} for {caller}: {status or 200} in {ms} ms", extra={"f": {
        "source": "server", "kind": "gemini", "who": {"organizer": "org"}.get(caller, caller), "ms": ms,
        "status": status or (200 if reply is not None else None), "model": model, "sent": strip(body), "reply": reply,
        "error": error or None, "tokens_in": use.get("promptTokenCount"), "tokens_out": use.get("candidatesTokenCount"),
        "tokens_think": use.get("thoughtsTokenCount")}})


def gemini_call(model: str, body: Body, timeout: float = 120) -> Dict[str, Any]:
    """One generateContent request -> the parsed reply. Busy and network errors are tried again; a model without a
    thinking switch is asked again without thinkingConfig."""
    for attempt in range(3):
        req = urllib.request.Request(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            data=json.dumps(body).encode(), headers={"x-goog-api-key": api_key() or "", "Content-Type": "application/json"})
        t0 = time.monotonic()
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                out: Dict[str, Any] = json.load(r)
                keep(model, body, t0, reply=out)
                return out
        except urllib.error.HTTPError as ex:
            detail = ex.read().decode("utf-8", "replace")
            keep(model, body, t0, status=ex.code, error=detail[:4000])
            gen = body.get("generationConfig") or {}
            if ex.code == 400 and "hinking" in detail and "thinkingConfig" in gen:
                del gen["thinkingConfig"]  # model without a thinking switch
                continue
            if ex.code in (429, 500, 502, 503, 504) and attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            raise Err(f"Gemini HTTP {ex.code}: {first_line(detail, 160)}")
        except (OSError, http.client.HTTPException) as ex:  # unreachable, timed out, connection dropped
            keep(model, body, t0, error=repr(ex))
            if attempt < 2:
                time.sleep(2)
                continue
            raise Err(f"Gemini unreachable: {ex}")
    raise Err("Gemini failed")


def reply_text(data: Dict[str, Any]) -> Tuple[str, Optional[str]]:
    """(text, why it was refused or None) from a generateContent reply. A speech model's words count as text."""
    cand = (data.get("candidates") or [{}])[0]
    text = "".join(p.get("text", "") or (p.get("audioTranscription") or {}).get("text", "")
                   for p in cand.get("content", {}).get("parts", []) if not p.get("thought")).strip()
    why = (data.get("promptFeedback") or {}).get("blockReason")
    if not why and not text and cand.get("finishReason") not in (None, "STOP", "MAX_TOKENS"):
        why = cand["finishReason"]
    return text, why


def gemini(system: str, parts: List[Dict[str, Any]], think: int = 0, temperature: float = 0.2, timeout: float = 120,
           field: Optional[str] = None, hint: str = "", model: Optional[str] = None) -> str:
    """field: answer as JSON {field: "..."} (hint describes it) and return that string; keeps prefaces and notes out."""
    body: Body = {"contents": [{"role": "user", "parts": parts}],
                  "generationConfig": {"temperature": temperature, "thinkingConfig": {"thinkingBudget": think}}}
    if field:
        body["generationConfig"].update(responseMimeType="application/json", responseSchema={
            "type": "OBJECT", "properties": {field: {"type": "STRING", "description": hint}}, "required": [field]})
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    text, _ = reply_text(gemini_call(model or MODEL, body, timeout))
    if field:
        try:
            return str(json.loads(text).get(field) or "").strip()
        except (ValueError, AttributeError):
            raise Err("Gemini answered in an unexpected format")
    return text
