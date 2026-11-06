"""Every kind of change, as a typed event, and its stored JSON row (the `events` table, one row per change).

The rows are the durable storage format. `decode` reads a row and `Event.to_row` writes one; nothing else touches
the JSON. Stored history remains intact when it is read.
One module per area (items, inputs, documents, voice notes' words), each with the readers of its kinds.
"""

from __future__ import annotations

from typing import Dict

from ..model import Row
from . import docs, inputs, items, voices
from .base import Event, Reader, Unknown, Unreadable, common
from .docs import DOC_EVENTS, CommentAdded, CommentDeleted, CommentEdited, CommentMoved, CommentRestored, DocDeleted, \
    DocMoved, DocWritten, ThreadResolved
from .inputs import FilingRedone, FilingUndone, InputAdded, InputAmended, InputDeleted, InputMoved, InputRescoped, \
    InputRestored, InputSent, InputsAcked, Organized, WordsIn, WordsKept
from .items import BlocksAsked, FieldsSet, FileTakenOff, ItemAdded, ItemMerged, ItemUnmerged, ItemsArchived, ItemsDeleted, ItemsRestored, LaterEnded, \
    MessageHidden, MessagePosted, ProjectRenamed
from .voices import VoiceFixed, VoiceHeard, VoicesSplit

READERS: Dict[str, Reader] = {**inputs.READERS, **items.READERS, **docs.READERS, **voices.READERS}


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
    "ItemAdded", "FieldsSet", "MessagePosted", "ItemMerged", "ItemUnmerged", "ItemsArchived", "ItemsDeleted", "ItemsRestored", "LaterEnded",
    "MessageHidden", "BlocksAsked", "FileTakenOff", "ProjectRenamed",
    "InputAdded", "InputsAcked", "InputAmended", "WordsIn", "WordsKept", "FilingUndone", "FilingRedone", "InputDeleted",
    "InputRestored", "InputMoved", "Organized", "InputRescoped", "InputSent",
    "DocWritten", "DocDeleted", "DocMoved", "CommentMoved", "ThreadResolved", "CommentAdded", "CommentEdited",
    "CommentDeleted", "CommentRestored", "VoiceHeard", "VoiceFixed", "VoicesSplit",
]
