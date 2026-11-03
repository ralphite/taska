"""Finding things by what the words mean (F479, plan D58): one Gemini question per search, with every project's
things as a short list made from them as they are now (the project you are in first); it answers with the closest,
closest first. Nothing is kept: each search asks again, so a thing made a moment ago can be found.

It is on by default, with the model and key the organizer and voice use; the file `search-by-meaning-off` in the
data root turns it off (settings.py). While it is off, or no key is set, no question is ever asked and the search is
by the words alone.
"""

from __future__ import annotations

import re
from typing import Callable, List, Optional, Tuple

from ..domain.finding import Found
from ..domain.vocab import Refused
from ..infra import gemini
from ..infra.logs import log
from .settings import SearchByMeaning

MOST_LINES = 2500  # the short list stops here, the project you are in first
MOST = 30
# The page waits 60 s for an answer (api/taska.ts): two tries of at most this long, and a pause, fit well inside it.
# A slow model then falls back to the words at once instead of the page giving up and asking again.
ASK_SECONDS = 22

INSTRUCTIONS = """You find things in a task tracker by what the user means. The user said (or typed) what to find, \
often by voice, maybe with words misheard or in another language. Each line of the list is one thing: an item, a \
rule, something the user said (an input) or a document, under the project it is in. Pick the lines the user most \
likely means, closest first, at most 30; leave out lines that are not about it. Answer with their line numbers, \
closest first, separated by commas (none: an empty answer)."""

Ask = Callable[..., str]
Lists = List[Tuple[str, str, List[Tuple[Found, str]]]]  # each project: its name, its title, its short list


class Meaning:
    """Asks the model what the words mean in the projects' short lists."""

    def __init__(self, setting: SearchByMeaning, allowed: bool = False, ask: Ask = gemini.ask,
                 key: Callable[[], Optional[str]] = gemini.api_key):
        self.setting = setting
        self.allowed = allowed  # the server talks to Gemini (as the organizer does: `--organizer auto` with a key)
        self._ask = ask
        self._key = key

    def on(self) -> bool:
        return self.allowed and self.setting.on() and bool(self._key())

    def rank(self, q: str, lists: Lists) -> Optional[List[Tuple[str, str]]]:
        """(project, key) of what `q` means, closest first; None: not asked (off, nothing to ask) or no answer."""
        said = " ".join(q.split())
        if not said or not self.on():
            return None
        lines: List[Tuple[str, str]] = []
        text: List[str] = []
        for name, title, short in lists:
            if not short or len(lines) >= MOST_LINES:
                continue
            text.append(f"## Project {title}")
            for f, line in short[: MOST_LINES - len(lines)]:
                lines.append((name, f.key))
                text.append(f"{len(lines)}. {line}")
        if not lines:
            return None
        try:
            answer = self._ask("search", INSTRUCTIONS, [{"text": f"The user said: {said}\n\n" + "\n".join(text)}],
                               answer_in=("lines", "the line numbers, closest first, separated by commas"),
                               timeout=ASK_SECONDS, attempts=2)
        except Refused as ex:
            log.warning(f"search by meaning failed: {ex}")
            return None
        out: List[Tuple[str, str]] = []
        for m in re.findall(r"\d+", answer):
            i = int(m) - 1
            if 0 <= i < len(lines) and lines[i] not in out:
                out.append(lines[i])
        return out[:MOST]
