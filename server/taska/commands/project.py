"""Commands on the project itself: its name for people (its address never changes) and its picture (F743)."""

from __future__ import annotations

import os

from ..domain import events as ev
from ..domain.text import project_title
from ..domain.vocab import Refused
from .base import Args, Outcome, Run, handles

ICON_KINDS = (".png", ".svg", ".ico", ".webp", ".jpg", ".jpeg")
ICON_MAX = 256 * 1024
ICON_HOW = "project icon f12-logo.png (an image uploaded first with POST /api/file), or project icon none"


@handles("cfg")
def rename(r: Run, a: Args) -> Outcome:
    if not a.has("name"):
        raise Refused("cfg needs name")
    title = project_title(a.get("name"))
    r.emit(ev.ProjectRenamed(name=title, by=r.by))
    return Outcome(f"ok named {title}", "")


@handles("icon")
def icon(r: Run, a: Args) -> Outcome:
    """The picture the page shows in place of the project's letter: a small image the project has; none takes it off."""
    fid = os.path.basename(a.text("f").strip())
    if fid.lower() in ("", "none"):
        if r.state.icon:
            r.emit(ev.ProjectIconSet(f="", by=r.by))
        return Outcome("ok project icon none", "Took off the project's icon")
    if not r.project.file_exists(fid):
        raise Refused(f"unknown file {fid}: upload it first with POST /api/file?name=<name>; use: {ICON_HOW}")
    if not fid.lower().endswith(ICON_KINDS):
        raise Refused(f"{fid} is not an image Taska shows as an icon (png, svg, ico, webp, jpg)")
    if r.project.file_size(fid) > ICON_MAX:
        raise Refused(f"{fid} is too big for an icon (at most {ICON_MAX // 1024} KB)")
    if r.state.icon != fid:
        r.emit(ev.ProjectIconSet(f=fid, by=r.by))
    return Outcome(f"ok project icon {fid}", "Set the project's icon")
