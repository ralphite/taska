"""Applying a change to a project's state: one reducer per kind of event, and the bookkeeping every change shares.

Replaying a project's log is `for event in log: apply(state, event)`. A reducer never checks whether a change is
allowed (the command handlers did); it only says what the change does. The stored log's meaning is fixed, so this is
the behaviour of the stored format, kept exactly.
"""

from . import docs, filing, inputs, items  # noqa: F401  (each registers its reducers)
from .core import apply, replay
from .docs import thread_of

__all__ = ["apply", "replay", "thread_of"]
