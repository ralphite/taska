"""A project's files (attachments, pictures, voice notes): plain files in taska-files/, named f<N>-<name>.

The number counts up from the highest one in the folder, so a file is never written over.
"""

from __future__ import annotations

import mimetypes
import os
import re
import threading
from typing import Optional

from ..domain.model import FileRef

FOLDER = "taska-files"
_NUMBERED = re.compile(r"f(\d+)-")


class FileStore:
    def __init__(self, project_folder: str):
        self.folder = os.path.join(project_folder, FOLDER)
        self._lock = threading.Lock()
        self._last = 0
        if os.path.isdir(self.folder):
            for name in os.listdir(self.folder):
                m = _NUMBERED.match(name)
                if m:
                    self._last = max(self._last, int(m.group(1)))

    def save(self, name: Optional[str], mime: Optional[str], data: bytes) -> FileRef:
        with self._lock:
            self._last += 1
            base = re.sub(r"[^\w.\-]+", "_", os.path.basename(name or "file"))  # \w keeps CJK and other letters
            if "." not in base:
                base += mimetypes.guess_extension(mime or "") or ""
            fid = f"f{self._last}-{base}"
            os.makedirs(self.folder, exist_ok=True)
            with open(os.path.join(self.folder, fid), "wb") as f:
                f.write(data)
        return FileRef(f=fid, name=name or base, mime=mime or "application/octet-stream", size=len(data))

    def path(self, fid: str) -> str:
        return os.path.join(self.folder, fid)

    def exists(self, fid: str) -> bool:
        return bool(fid) and os.path.isfile(self.path(fid))

    def read(self, fid: str) -> bytes:
        with open(self.path(fid), "rb") as f:
            return f.read()
