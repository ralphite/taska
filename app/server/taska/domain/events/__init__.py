"""Every kind of change, as a typed event, and its stored JSON row (the `events` table, one row per change).

The rows are the stored format: their keys and the order of the keys are kept exactly, so the older version runs on
a log this one wrote (a roll back). `decode` reads any row, `Event.to_row` writes one; nothing else touches the JSON.
One module per area (items, inputs, documents), each with the readers of its kinds.
"""

from __future__ import annotations

from typing import Dict

from ..model import Row
from . import docs, inputs, items
from .base import Event, Reader, Unknown, Unreadable, common
from .docs import DOC_EVENTS, CommentAdded, CommentDeleted, CommentEdited, CommentMoved, CommentRestored, DocDeleted, \
    DocMoved, DocWritten, ThreadResolved
from .inputs import FilingRedone, FilingUndone, InputAdded, InputAmended, InputDeleted, InputMoved, InputRescoped, \
    InputRestored, InputsAcked, Organized, WordsIn
from .items import FieldsSet, FileTakenOff, ItemAdded, ItemMerged, ItemsArchived, ItemsDeleted, ItemsRestored, \
    MessageHidden, MessagePosted, ProjectRenamed

READERS: Dict[str, Reader] = {**inputs.READERS, **items.READERS, **docs.READERS}


def decode(row: Row) -> Event:
    """A stored row as an event; a kind this version does not know comes back as Unknown, kept as it is."""
    read = READERS.get(str(row.get("k", "")))
    if read is None:
        return Unknown(kind=str(row.get("k", "")), raw=dict(row), src=row.get("src"), **common(row))
    try:
        return read(row)
    except (TypeError, ValueError, AttributeError) as ex:
        raise Unreadable(str(ex)) from ex


__all__ = [
    "Event", "Unknown", "Unreadable", "Row", "READERS", "DOC_EVENTS", "decode",
    "ItemAdded", "FieldsSet", "MessagePosted", "ItemMerged", "ItemsArchived", "ItemsDeleted", "ItemsRestored",
    "MessageHidden", "FileTakenOff", "ProjectRenamed",
    "InputAdded", "InputsAcked", "InputAmended", "WordsIn", "FilingUndone", "FilingRedone", "InputDeleted",
    "InputRestored", "InputMoved", "Organized", "InputRescoped",
    "DocWritten", "DocDeleted", "DocMoved", "CommentMoved", "ThreadResolved", "CommentAdded", "CommentEdited",
    "CommentDeleted", "CommentRestored",
]
