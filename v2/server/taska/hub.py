"""All projects under one data root, and what is shared by them: the key, spellings for voice, the order of the
projects, the phones that get pushes.

    <root>/<project>/taska.db        one project (storage.Db), with taska-files/ next to it
    <root>/.deleted/<project>/       a deleted project, as it was (Restore brings it back)
    <root>/key                       the key for access from outside this machine and its network
    <root>/corrections.json          spellings for voice transcription (every project)
    <root>/voice-prefs.txt           how voice notes are written down (every project)
    <root>/voice-tidy-off            present: voice notes are not tidied
    <root>/project-order.json        the order you dragged the projects into
    <root>/.push/                    the push key and the phones subscribed
"""

from __future__ import annotations

import contextlib
import json
import os
import secrets
import shutil
import threading
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from . import storage
from .core import CLOSED, KEY_CHARS, NAME, Err, now, short_slug, slug_of, title_of
from .organizer import Organizer
from .push import Push
from .store import Store
from .voice import MAX_PREFS, VOICE_PREFS


class Hub:
    """Projects: one folder each under the data root, holding taska.db and its files."""

    def __init__(self, root: str, organizer: bool, public: str = ""):
        self.root = os.path.abspath(os.path.expanduser(root))
        self.organizer = organizer
        self.public = public.rstrip("/")  # the tunnel's address, for the phone link
        self.lock = threading.Lock()
        self.projects: Dict[str, Store] = {}
        self.trash = os.path.join(self.root, ".deleted")  # deleted projects, as they were: Restore brings one back (F173)
        os.makedirs(self.root, exist_ok=True)
        self.push = Push(self.root)  # phones that want a push when something needs you (F195)
        self.key = ""
        try:
            with open(os.path.join(self.root, "key"), encoding="utf-8") as f:
                self.key = f.read().strip()
        except FileNotFoundError:
            self.new_key()
        self.fixes: List[Dict[str, Any]] = []
        try:
            with open(os.path.join(self.root, "corrections.json"), encoding="utf-8") as f:
                self.fixes = [c for c in json.load(f) if isinstance(c, dict) and c.get("right")]  # T256: a right word alone is one to hear right
        except (FileNotFoundError, ValueError):
            self.fixes = []
        self.views: List[Dict[str, str]] = []  # F320: your own views of the item list, the same in every project
        try:
            with open(os.path.join(self.root, "views.json"), encoding="utf-8") as f:
                self.views = self._clean_views(json.load(f))
        except (FileNotFoundError, ValueError, Err):
            self.views = []
        self.prefs: Optional[str] = None
        try:
            with open(os.path.join(self.root, "voice-prefs.txt"), encoding="utf-8") as f:
                self.prefs = f.read().strip() or None
        except FileNotFoundError:
            self.prefs = None
        self.order: List[str] = []
        try:  # F253: the order you dragged the projects into; one for every page that lists them
            with open(os.path.join(self.root, "project-order.json"), encoding="utf-8") as f:
                self.order = [n for n in json.load(f) if isinstance(n, str)]
        except (FileNotFoundError, ValueError):
            self.order = []
        for name in sorted(os.listdir(self.root)):
            if NAME.fullmatch(name) and storage.is_project(os.path.join(self.root, name)):
                self.open(name)
        if not self.projects:
            self.add("default")

    # Spelling fixes the user made to voice transcripts (F144): one list for every project, kept in the data root.
    # Transcription is told about them, and puts the right form in for a wrong one it still writes.
    def corrections(self) -> List[Dict[str, Any]]:
        with self.lock:
            return [dict(c) for c in self.fixes]

    VIEW_KEYS = ("type", "when", "status", "pri", "sort")

    @classmethod
    def _clean_views(cls, views: Any) -> List[Dict[str, str]]:
        """F320: a list of {name, type, when, status, pri, sort}; names short and different."""
        if not isinstance(views, list):
            raise Err("give the views as a list")
        out: List[Dict[str, str]] = []
        for v in views[:30]:  # pyright: ignore[reportUnknownVariableType]
            if not isinstance(v, dict):
                raise Err("each view is {name, type, when, status, pri, sort}")
            name = " ".join(str(v.get("name") or "").split())[:40]  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType]
            if not name or any(o["name"].lower() == name.lower() for o in out):
                raise Err("each view needs a name of its own")
            out.append(dict({"name": name}, **{k: str(v.get(k) or "all")[:20] for k in cls.VIEW_KEYS}))  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType]
        return out

    def get_views(self) -> List[Dict[str, str]]:
        with self.lock:
            return [dict(v) for v in self.views]

    def set_views(self, views: Any) -> List[Dict[str, str]]:
        clean = self._clean_views(views)
        with self.lock:
            self.views = clean
            path = os.path.join(self.root, "views.json")
            with open(path + ".tmp", "w", encoding="utf-8") as f:
                json.dump(clean, f, ensure_ascii=False)
            os.replace(path + ".tmp", path)
            return [dict(v) for v in clean]

    def voice_prefs(self) -> Dict[str, Any]:
        """F183: {"text": how voice notes are written down, "default": True while the user never changed it}."""
        with self.lock:
            return {"text": self.prefs or VOICE_PREFS, "default": self.prefs is None}

    def set_voice_prefs(self, text: Any) -> None:
        """New preferences for every project; empty text goes back to the default."""
        text = "\n".join(line.rstrip() for line in str(text or "").strip().splitlines())
        if len(text) > MAX_PREFS:
            raise Err(f"keep the preferences under {MAX_PREFS} characters")
        path = os.path.join(self.root, "voice-prefs.txt")
        with self.lock:
            self.prefs = text if text and text != VOICE_PREFS else None
            if self.prefs is None:
                try:
                    os.remove(path)
                except FileNotFoundError:
                    pass
                return
            with open(path + ".tmp", "w", encoding="utf-8") as f:
                f.write(self.prefs + "\n")
            os.replace(path + ".tmp", path)

    def _save_fixes(self) -> None:
        tmp = os.path.join(self.root, "corrections.json.tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self.fixes, f, ensure_ascii=False, indent=1)
        os.replace(tmp, os.path.join(self.root, "corrections.json"))

    def correct(self, wrong: Any, right: Any = None) -> None:
        """Remember wrong -> right (or forget wrong, when right is None)."""
        wrong = " ".join(str(wrong or "").split())
        if not wrong or len(wrong) > 60:
            raise Err("pick the wrong words: up to 60 characters")
        if right is not None:
            right = " ".join(str(right).split())
            if not right or len(right) > 60 or right == wrong:
                raise Err("write the right words: up to 60 characters, different from the wrong ones")
        with self.lock:
            self.fixes = [c for c in self.fixes if c.get("wrong") != wrong]
            if right is not None:
                self.fixes.append({"wrong": wrong, "right": right, "t": datetime.now().astimezone().isoformat(timespec="seconds")})
            self._save_fixes()

    def tidy_on(self) -> bool:
        """T256: voice notes are tidied unless the user turned it off (a file in the data root says off)."""
        return not os.path.exists(os.path.join(self.root, "voice-tidy-off"))

    def set_tidy(self, on: bool) -> None:
        path = os.path.join(self.root, "voice-tidy-off")
        if on:
            try:
                os.remove(path)
            except FileNotFoundError:
                pass
        else:
            open(path, "w").close()

    def word(self, right: Any, forget: bool = False) -> None:
        """T256: a word to hear right, without a wrong form first; or forget it."""
        right = " ".join(str(right or "").split())
        if not right or len(right) > 60:
            raise Err("write the word: up to 60 characters")
        with self.lock:
            self.fixes = [c for c in self.fixes if c.get("wrong") or c["right"] != right]
            if not forget:
                self.fixes.append({"right": right, "t": datetime.now().astimezone().isoformat(timespec="seconds")})
            self._save_fixes()

    def new_key(self) -> None:
        """The key that opens Taska from outside this machine and its network. A new one locks out every other device.
        8 characters (F61): short enough to type on a phone; 31^8 (about 10^12) guesses is far out of reach over the tunnel."""
        self.key = "-".join("".join(secrets.choice(KEY_CHARS) for _ in range(4)) for _ in range(2))
        path = os.path.join(self.root, "key")
        with open(path, "w", encoding="utf-8") as f:
            f.write(self.key + "\n")
        os.chmod(path, 0o600)

    def open(self, name: str) -> Store:
        s = Store(os.path.join(self.root, name), hub=self, name=name)
        s.org_on = self.organizer
        s.resume_words()  # before the organizer: an input waiting for its words is held for them again (B165)
        if s.org_on:
            Organizer(s).start()
        self.projects[name] = s
        return s

    # Projects have a name for people and an address (F173). The address (/p/<address>, also the folder) is made from
    # the name once and never changes, so agents, .taska files, phone links and bookmarks keep working through a
    # rename. A deleted project moves to .deleted/ with everything in it and keeps its address, so Restore is exact.
    def taken(self, slug: str) -> bool:
        return slug in self.projects or os.path.exists(os.path.join(self.root, slug)) or os.path.exists(os.path.join(self.trash, slug))

    def clash(self, title: str, but: Optional[Store] = None) -> None:
        if any(s is not but and s.title.lower() == title.lower() for s in self.projects.values()):
            raise Err(f"a project called {title} exists already")

    def add(self, name: Any) -> Store:
        title = title_of(name)
        with self.lock:
            self.clash(title)
            base = slug_of(title)
            slug, k = base or short_slug(), 2
            while self.taken(slug):  # an address in use, also by a deleted project, is never given twice
                slug, k = f"{base[:36].rstrip('-')}-{k}" if base else short_slug(), k + 1
            os.makedirs(os.path.join(self.root, slug), exist_ok=True)
            s = self.open(slug)
        if title != slug:
            s.run_all([(0, {"op": "cfg", "name": title})], "you")
        return s

    def live(self, slug: Any) -> Store:
        s = self.projects.get(str(slug or ""))
        if not s:
            raise Err(f"no project {slug}")
        return s

    def rename(self, slug: Any, name: Any) -> Tuple[Store, str]:
        title = title_of(name)
        with self.lock:
            s = self.live(slug)
            self.clash(title, but=s)
            was = s.title
        if title != was:
            s.run_all([(0, {"op": "cfg", "name": title})], "you")
        return s, was

    def delete(self, slug: Any) -> Store:
        """Out of the way, nothing lost: the folder moves to .deleted/; agents asking for work hear it was deleted."""
        with self.lock:
            s = self.live(slug)
            with s.cond:
                s.gone = True
                info = {"t": now(), "title": s.title, "items": len(s.active())}
                s.bump()  # pages and agents waiting on it hear at once
                s.close()
            del self.projects[s.name]
            os.makedirs(self.trash, exist_ok=True)
            os.rename(os.path.join(self.root, s.name), os.path.join(self.trash, s.name))
            with open(os.path.join(self.trash, s.name, "deleted.json"), "w", encoding="utf-8") as f:
                json.dump(info, f, ensure_ascii=False)
            return s

    def restore(self, slug: Any) -> Store:
        slug = str(slug or "")
        with self.lock:
            src = os.path.join(self.trash, slug)
            if not NAME.fullmatch(slug) or not storage.is_project(src):
                raise Err(f"no deleted project {slug}")
            if slug in self.projects or os.path.exists(os.path.join(self.root, slug)):
                raise Err(f"the address {slug} is in use")
            with contextlib.suppress(FileNotFoundError):
                os.remove(os.path.join(src, "deleted.json"))
            os.rename(src, os.path.join(self.root, slug))
            return self.open(slug)

    def purge(self, slug: Any) -> None:
        """The one step that can't be undone: a deleted project's folder goes for good."""
        slug = str(slug or "")
        with self.lock:
            src = os.path.join(self.trash, slug)
            if not NAME.fullmatch(slug) or not os.path.isdir(src):
                raise Err(f"no deleted project {slug}")
            shutil.rmtree(src)

    def deleted(self) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for slug in sorted(os.listdir(self.trash)) if os.path.isdir(self.trash) else []:
            if not NAME.fullmatch(slug) or not storage.is_project(os.path.join(self.trash, slug)):
                continue
            try:
                with open(os.path.join(self.trash, slug, "deleted.json"), encoding="utf-8") as f:
                    info = json.load(f)
            except (OSError, ValueError):
                info = {}
            out.append({"name": slug, "title": info.get("title") or slug, "t": info.get("t") or "", "items": info.get("items", 0)})
        return sorted(out, key=lambda d: d["t"], reverse=True)

    def summary(self) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for name, s in sorted(self.projects.items()):
            with s.lock:
                live = [i for i in s.active() if i["status"] not in CLOSED]
                # "open" as the project's own page counts it (A18): what Items holds that isn't finished, rules an agent
                # proposed included, since they wait in Items too
                out.append({"name": name, "title": s.title, "open": sum(1 for i in live if not i["archived"] and (i["type"] != "rule" or i["status"] == "proposed")), "auto": s.cfg["auto"],
                            "needs": sum(1 for i in live if not i["archived"] and (s.waiting(i) or (i["status"] in ("proposed", "review") and not s.replied(i)))), **s.presence(),  # archived: not on the page's list either
                            "t": int(s.mtime() * 1000), **({"pos": self.order.index(name)} if name in self.order else {})})
        return out

    def set_order(self, names: Any) -> None:
        """F253: the projects in the order you put them; ones left out keep their places after these, by name."""
        if not isinstance(names, list) or not all(isinstance(n, str) for n in names):  # pyright: ignore[reportUnknownVariableType]
            raise Err("give the projects' names in their new order")
        with self.lock:
            self.order = list(dict.fromkeys(n for n in names if n in self.projects))  # pyright: ignore[reportUnknownArgumentType]
            path = os.path.join(self.root, "project-order.json")
            with open(path + ".tmp", "w", encoding="utf-8") as f:
                json.dump(self.order, f)
            os.replace(path + ".tmp", path)

    def search(self, q: str, skip: str = "") -> List[Dict[str, Any]]:
        """Words in every project but `skip` (F196): items by their code, title, text and thread, and what you said
        (inputs). Every word must be there. Newest first, at most 30."""
        words = [w for w in q.lower().split() if w][:8]
        out: List[Dict[str, Any]] = []
        if not words:
            return out
        for name, s in sorted(self.projects.items()):
            if name == skip:
                continue
            with s.lock:
                for i in s.items.values():
                    if i["merged_into"] or i.get("deleted"):
                        continue
                    hay = " ".join([s.code(i["n"]), i["title"], i["body"], i.get("next", ""), *(x.get("text", "") for x in i["thread"])]).lower()
                    if all(w in hay for w in words):
                        out.append({"project": name, "ptitle": s.title, "kind": "item", "code": s.code(i["n"]), "title": i["title"],
                                    "status": i["status"], "archived": i["archived"], "t": i.get("t1") or i.get("t0") or ""})
                for r in s.inputs.values():
                    if not r.get("deleted") and all(w in (r["id"] + " " + r["text"]).lower() for w in words):
                        out.append({"project": name, "ptitle": s.title, "kind": "input", "code": r["id"], "title": r["text"][:200], "t": r["t"]})
        return sorted(out, key=lambda x: x["t"], reverse=True)[:30]

    def needs(self) -> List[Dict[str, Any]]:
        """What needs you in every project (F193): an agent asks or is blocked, an item waits for approval or acceptance.
        Newest first, so the sidebar's list leads with what just came in."""
        out: List[Dict[str, Any]] = []
        for name, s in sorted(self.projects.items()):
            with s.lock:
                for i in s.active():
                    if i["status"] in CLOSED or i.get("merged_into") or i["archived"]:  # as the project's own page counts them
                        continue
                    w = s.waiting(i)
                    kind = w["kind"] if w else i["status"] if i["status"] in ("proposed", "review") and not s.replied(i) else None  # B286: replied, it is the agent's turn
                    if kind:
                        out.append({"project": name, "ptitle": s.title, "n": i["n"], "code": s.code(i["n"]), "title": i["title"],
                                    "kind": kind, "pri": i["pri"], "t": i.get("t1") or i.get("t") or ""})
        return sorted(out, key=lambda x: x["t"], reverse=True)

    def close(self) -> None:
        for s in list(self.projects.values()):
            with s.lock:
                s.close()
