"""This Mac's screen, mouse and keyboard, for Taska's computer use (T871, Yadong r1476 r1485): a screenshot of the main
display, and clicks, typing, keys and scrolling at points on it, through macOS's own tools (screencapture, sips,
osascript with CoreGraphics). macOS asks the user once to allow the program that runs Taska to record the screen
(Screen Recording) and to control the computer (Accessibility); Taska never answers those prompts itself."""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
from typing import Callable, List, Optional, Sequence, Tuple

Run = Callable[[Sequence[str]], "subprocess.CompletedProcess[str]"]
WIDTH = 1440  # the screenshot's width as the model sees it

KEYS = {"enter": 36, "return": 36, "tab": 48, "space": 49, "backspace": 51, "delete": 51, "escape": 53, "esc": 53,
        "left": 123, "arrowleft": 123, "right": 124, "arrowright": 124, "down": 125, "arrowdown": 125, "up": 126,
        "arrowup": 126, "home": 115, "end": 119, "pageup": 116, "pagedown": 121, "forwarddelete": 117}
MODS = {"cmd": "command", "command": "command", "meta": "command", "super": "command", "ctrl": "control",
        "control": "control", "alt": "option", "option": "option", "shift": "shift"}
BUTTONS = {"left": (1, 2, 0), "right": (3, 4, 1), "middle": (25, 26, 2)}  # (down, up, button) CoreGraphics numbers


class Denied(Exception):
    """macOS did not let Taska do it (a permission the user has not given yet, or the tool failed)."""


def _run(args: Sequence[str]) -> "subprocess.CompletedProcess[str]":
    try:
        return subprocess.run(list(args), capture_output=True, text=True, timeout=20)
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(list(args), 124, "", "timed out (macOS may be asking the user to allow it)")
    except OSError as ex:
        return subprocess.CompletedProcess(list(args), 127, "", str(ex))


def _js(s: object) -> str:
    return json.dumps(s)


class Mac:
    def __init__(self, run: Run = _run) -> None:
        self.run = run
        self._size: Optional[Tuple[float, float]] = None

    def _jxa(self, script: str) -> str:
        r = self.run(["osascript", "-l", "JavaScript", "-e", 'ObjC.import("CoreGraphics"); ObjC.import("AppKit");\n' + script])
        if r.returncode != 0:
            raise Denied((r.stderr or "").strip()[:300] or f"osascript failed ({r.returncode})")
        return (r.stdout or "").strip()

    def _events(self, body: str) -> None:
        self._jxa("function post(t,x,y,b,n){const e=$.CGEventCreateMouseEvent(null,t,$.CGPointMake(x,y),b);"
                  "if(n)$.CGEventSetIntegerValueField(e,1,n);$.CGEventPost(0,e);delay(0.03)}\n" + body)

    def size(self) -> Tuple[float, float]:
        """The main display's size in points (what clicks are given in)."""
        if self._size is None:
            w, h = self._jxa("const f=$.NSScreen.mainScreen.frame; f.size.width+' '+f.size.height").split()
            self._size = (float(w), float(h))
        return self._size

    def mouse(self) -> Tuple[float, float]:
        """Where the pointer is, in points from the top left."""
        x, y = self._jxa("const m=$.NSEvent.mouseLocation; m.x+' '+m.y").split()
        return float(x), self.size()[1] - float(y)

    def shot(self) -> bytes:
        """A PNG of the main display, WIDTH wide."""
        fd, path = tempfile.mkstemp(suffix=".png", prefix="taska-screen-")
        os.close(fd)
        try:
            r = self.run(["screencapture", "-x", "-m", "-t", "png", path])
            if r.returncode != 0 or not os.path.getsize(path):
                raise Denied("macOS did not give Taska a screenshot: allow the program that runs Taska (python3) in "
                             "System Settings › Privacy & Security › Screen Recording " + (r.stderr or "").strip()[:200])
            self.run(["sips", "-Z", str(WIDTH), path])
            with open(path, "rb") as f:
                return f.read()
        finally:
            os.unlink(path)

    def point(self, x: float, y: float) -> Tuple[float, float]:
        """A point given 0..1000 across and down the screen -> points."""
        w, h = self.size()
        return max(0.0, min(w - 1, x / 1000 * w)), max(0.0, min(h - 1, y / 1000 * h))

    def click(self, x: float, y: float, button: str = "left", count: int = 1) -> None:
        down, up, b = BUTTONS[button]
        px, py = self.point(x, y)
        clicks = "".join(f"post({down},{px},{py},{b},{n});post({up},{px},{py},{b},{n});" for n in range(1, count + 1))
        self._events(f"post(5,{px},{py},0,0);delay(0.05);" + clicks)

    def move(self, x: float, y: float) -> None:
        px, py = self.point(x, y)
        self._events(f"post(5,{px},{py},0,0);")

    def drag(self, x1: float, y1: float, x2: float, y2: float) -> None:
        a, b = self.point(x1, y1), self.point(x2, y2)
        steps = "".join(f"post(6,{a[0] + (b[0] - a[0]) * i / 10},{a[1] + (b[1] - a[1]) * i / 10},0,0);" for i in range(1, 11))
        self._events(f"post(5,{a[0]},{a[1]},0,0);post(1,{a[0]},{a[1]},0,1);{steps}post(2,{b[0]},{b[1]},0,1);")

    def scroll(self, x: float, y: float, direction: str, pixels: int = 300) -> None:
        px, py = self.point(x, y)
        dy = {"up": pixels, "down": -pixels}.get(direction, 0)
        dx = {"left": pixels, "right": -pixels}.get(direction, 0)
        self._events(f"post(5,{px},{py},0,0);delay(0.05);"
                     f"$.CGEventPost(0,$.CGEventCreateScrollWheelEvent(null,0,2,{int(dy)},{int(dx)}));")

    def type(self, text: str) -> None:
        """Types the text where the focus is (words other than plain ASCII are pasted, the clipboard put back)."""
        if text.isascii():
            self._jxa(f'Application("System Events").keystroke({_js(text)})')
            return
        was = self.run(["pbpaste"]).stdout
        self._jxa(f"const p=$.NSPasteboard.generalPasteboard;p.clearContents;p.setStringForType({_js(text)},$.NSPasteboardTypeString);"
                  'delay(0.1);Application("System Events").keystroke("v",{using:"command down"});delay(0.3);'
                  f"p.clearContents;p.setStringForType({_js(was or '')},$.NSPasteboardTypeString)")

    def keys(self, names: List[str]) -> None:
        """A key, or keys held together ("cmd", "n")."""
        mods = [MODS[k.lower()] + " down" for k in names if k.lower() in MODS]
        rest = [k for k in names if k.lower() not in MODS]
        if len(rest) != 1:
            raise Denied(f"cannot press {'+'.join(names)}")
        k = rest[0]
        using = f",{{using:{_js(mods)}}}" if mods else ""
        code = KEYS.get(k.lower().replace("_", ""))
        se = 'Application("System Events")'
        self._jxa(f"{se}.keyCode({code}{using})" if code is not None else f"{se}.keystroke({_js(k.lower() if mods else k)}{using})")

    def open(self, target: str, app: bool = False) -> None:
        r = self.run(["open", "-a", target] if app else ["open", target])
        if r.returncode != 0:
            raise Denied((r.stderr or "").strip()[:200] or f"could not open {target}")
