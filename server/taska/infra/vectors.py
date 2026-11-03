"""The embeddings search by meaning has made (meaning.db in the data folder), so a line is embedded once: each row is
one line's vector, under the model that made it and the SHA-256 of the line's words, as float32 numbers.

  sqlite3 ~/.taska/meaning.db "select model, count(*) from vectors group by model"

Rows are looked up by the words' hash, so a line whose words change is a new row; `keep_only` lets go of the rows no
line has any more (and of every other model's).
"""

from __future__ import annotations

import contextlib
import sqlite3
import threading
from array import array
from typing import Dict, Iterable, Iterator, Set, Tuple

TABLE = """
CREATE TABLE IF NOT EXISTS vectors (model TEXT NOT NULL, hash TEXT NOT NULL, v BLOB NOT NULL,
  PRIMARY KEY (model, hash));
"""


class Vectors:
    """The file, one connection at a time (requests and the warm-up thread share it)."""

    def __init__(self, path: str):
        self.path = path
        self._lock = threading.Lock()
        with self._lock, self._db() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.executescript(TABLE)

    @contextlib.contextmanager
    def _db(self) -> Iterator[sqlite3.Connection]:
        """A connection that commits (or rolls back) and closes at the end."""
        with contextlib.closing(sqlite3.connect(self.path, timeout=30)) as db, db:
            yield db

    def all(self, model: str) -> Dict[str, array]:
        """Every vector of `model`, by its line's hash."""
        with self._lock, self._db() as db:
            return {h: _floats(v) for h, v in db.execute("SELECT hash, v FROM vectors WHERE model = ?", (model,))}

    def put(self, model: str, rows: Iterable[Tuple[str, array]]) -> None:
        with self._lock, self._db() as db:
            db.executemany("INSERT OR REPLACE INTO vectors (model, hash, v) VALUES (?, ?, ?)",
                           [(model, h, v.tobytes()) for h, v in rows])

    def keep_only(self, model: str, hashes: Set[str]) -> int:
        """Lets go of `model`'s vectors whose hash is not in `hashes`, and of every other model's; -> how many."""
        with self._lock, self._db() as db:
            gone = [(model, h) for (h,) in db.execute("SELECT hash FROM vectors WHERE model = ?", (model,))
                    if h not in hashes]
            db.executemany("DELETE FROM vectors WHERE model = ? AND hash = ?", gone)
            return len(gone) + db.execute("DELETE FROM vectors WHERE model != ?", (model,)).rowcount


def _floats(b: bytes) -> array:
    out = array("f")
    out.frombytes(b)
    return out

