"""What all projects share, each kept in a small file in the data root (the stored format):

    key                  the key for access from outside this machine and its network
    corrections.json     spellings for voice notes: wrong -> right, and words to hear right
    views.json           your own views of the item list
    voice-prefs.txt      how voice notes are written down (absent: the default)
    voice-tidy-off       present: voice notes are not tidied
    project-order.json   the order you dragged the projects into
"""

from __future__ import annotations

import json
import os
import secrets
import threading
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..domain.vocab import KEY_CHARS, Refused
from ..domain.voice_words import VOICE_PREFS

DEFAULT_VOICE_PREFS = VOICE_PREFS  # how voice notes are written down until the user says otherwise
MAX_PREFS = 4000


def _write(path: str, text: str) -> None:
    with open(path + ".tmp", "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(path + ".tmp", path)


def _now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


class AccessKey:
    """The key that opens Taska from outside: 8 characters in two groups, easy to type on a phone."""

    def __init__(self, root: str):
        self._path = os.path.join(root, "key")
        try:
            with open(self._path, encoding="utf-8") as f:
                self.value = f.read().strip()
        except FileNotFoundError:
            self.value = ""
            self.renew()

    def renew(self) -> str:
        self.value = "-".join("".join(secrets.choice(KEY_CHARS) for _ in range(4)) for _ in range(2))
        with open(self._path, "w", encoding="utf-8") as f:
            f.write(self.value + "\n")
        os.chmod(self._path, 0o600)
        return self.value


class Spellings:
    """Spelling fixes for voice notes (one list for every project): transcription is told about them."""

    def __init__(self, root: str):
        self._path = os.path.join(root, "corrections.json")
        self._lock = threading.Lock()
        try:
            with open(self._path, encoding="utf-8") as f:
                self._fixes: List[Dict[str, Any]] = [c for c in json.load(f) if isinstance(c, dict) and c.get("right")]
        except (FileNotFoundError, ValueError):
            self._fixes = []

    def all(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [dict(c) for c in self._fixes]

    def _save(self) -> None:
        _write(self._path, json.dumps(self._fixes, ensure_ascii=False, indent=1))

    def correct(self, wrong: Any, right: Any = None) -> None:
        """Remember wrong -> right (or forget wrong, when right is None)."""
        wrong = " ".join(str(wrong or "").split())
        if not wrong or len(wrong) > 60:
            raise Refused("pick the wrong words: up to 60 characters")
        if right is not None:
            right = " ".join(str(right).split())
            if not right or len(right) > 60 or right == wrong:
                raise Refused("write the right words: up to 60 characters, different from the wrong ones")
        with self._lock:
            self._fixes = [c for c in self._fixes if c.get("wrong") != wrong]
            if right is not None:
                self._fixes.append({"wrong": wrong, "right": right, "t": _now()})
            self._save()

    def word(self, right: Any, forget: bool = False) -> None:
        """A word to hear right, without a wrong form first; or forget it."""
        right = " ".join(str(right or "").split())
        if not right or len(right) > 60:
            raise Refused("write the word: up to 60 characters")
        with self._lock:
            self._fixes = [c for c in self._fixes if c.get("wrong") or c["right"] != right]
            if not forget:
                self._fixes.append({"right": right, "t": _now()})
            self._save()


class ListViews:
    """Your own views of the item list ({name, type, when, status, pri, sort}), the same in every project."""

    KEYS = ("type", "when", "status", "pri", "sort")

    def __init__(self, root: str):
        self._path = os.path.join(root, "views.json")
        self._lock = threading.Lock()
        try:
            with open(self._path, encoding="utf-8") as f:
                self._views = self.clean(json.load(f))
        except (FileNotFoundError, ValueError, Refused):
            self._views = []

    @classmethod
    def clean(cls, views: Any) -> List[Dict[str, str]]:
        if not isinstance(views, list):
            raise Refused("give the views as a list")
        out: List[Dict[str, str]] = []
        for v in views[:30]:
            if not isinstance(v, dict):
                raise Refused("each view is {name, type, when, status, pri, sort}")
            name = " ".join(str(v.get("name") or "").split())[:40]
            if not name or any(o["name"].lower() == name.lower() for o in out):
                raise Refused("each view needs a name of its own")
            out.append(dict({"name": name}, **{k: str(v.get(k) or "all")[:20] for k in cls.KEYS}))
        return out

    def all(self) -> List[Dict[str, str]]:
        with self._lock:
            return [dict(v) for v in self._views]

    def replace(self, views: Any) -> List[Dict[str, str]]:
        clean = self.clean(views)
        with self._lock:
            self._views = clean
            _write(self._path, json.dumps(clean, ensure_ascii=False))
            return [dict(v) for v in clean]


class VoicePrefs:
    """How voice notes are written down, in the user's words, for every project; and the "tidy the words" switch."""

    def __init__(self, root: str):
        self._path = os.path.join(root, "voice-prefs.txt")
        self._tidy_off = os.path.join(root, "voice-tidy-off")
        self._lock = threading.Lock()
        try:
            with open(self._path, encoding="utf-8") as f:
                self._text: Optional[str] = f.read().strip() or None
        except FileNotFoundError:
            self._text = None

    def get(self) -> Dict[str, Any]:
        with self._lock:
            return {"text": self._text or DEFAULT_VOICE_PREFS, "default": self._text is None}

    def set(self, text: Any) -> None:
        """New preferences; empty text goes back to the default."""
        text = "\n".join(line.rstrip() for line in str(text or "").strip().splitlines())
        if len(text) > MAX_PREFS:
            raise Refused(f"keep the preferences under {MAX_PREFS} characters")
        with self._lock:
            self._text = text if text and text != DEFAULT_VOICE_PREFS else None
            if self._text is None:
                try:
                    os.remove(self._path)
                except FileNotFoundError:
                    pass
                return
            _write(self._path, self._text + "\n")

    def tidy(self) -> bool:
        return not os.path.exists(self._tidy_off)

    def set_tidy(self, on: bool) -> None:
        if on:
            try:
                os.remove(self._tidy_off)
            except FileNotFoundError:
                pass
        else:
            open(self._tidy_off, "w").close()


class ProjectOrder:
    """The order you dragged the projects into; one for every page that lists them."""

    def __init__(self, root: str):
        self._path = os.path.join(root, "project-order.json")
        try:
            with open(self._path, encoding="utf-8") as f:
                self.names: List[str] = [n for n in json.load(f) if isinstance(n, str)]
        except (FileNotFoundError, ValueError):
            self.names = []

    def set(self, names: List[str]) -> None:
        self.names = list(dict.fromkeys(names))
        _write(self._path, json.dumps(self.names))

    def position(self, name: str) -> Optional[int]:
        return self.names.index(name) if name in self.names else None
