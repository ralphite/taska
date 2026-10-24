"""Who waits for a project's news, and the number that says there is some.

`rev` goes up with every change and with news that is not a change (the organizer starts on an input, words came
in). It starts again with the process; `boot` tells a page that it did. Pages waiting for changes, agents waiting for
work and the voice jobs waiting for words all wait here, on the project's lock.
"""

from __future__ import annotations

import threading
import time
from typing import Callable, Optional


class News:
    def __init__(self, lock: threading.RLock, rev: int):
        self._cond = threading.Condition(lock)
        self.rev = rev
        self.boot = format(int(time.time() * 1000), "x")

    def bump(self) -> None:
        """There is news: everyone waiting hears it."""
        with self._cond:
            self.rev += 1
            self._cond.notify_all()

    def wake(self) -> None:
        """Wake those waiting, to look again (news counted elsewhere, like an agent turning up)."""
        with self._cond:
            self._cond.notify_all()

    def wait_for(self, done: Callable[[], bool], timeout: Optional[float]) -> bool:
        """Wait until `done` (checked under the lock) or the time is up; whether it is done."""
        with self._cond:
            return self._cond.wait_for(done, timeout=timeout)

    def wait(self, timeout: float) -> None:
        """Wait for the next news, or the time."""
        with self._cond:
            self._cond.wait(timeout=max(0.0, timeout))
