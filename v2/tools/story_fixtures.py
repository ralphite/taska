#!/usr/bin/env python3
"""Storybook's data (T457): a throwaway Taska on an empty folder, filled with a demo through the same interfaces the
agents and the page use, then every answer the page asks for saved as files the stories serve.

  python3 v2/tools/story_fixtures.py        -> v2/web/.storybook/public/fixtures/

What happens is in story_demo.json: steps in time order, each a few minutes, hours or days before now, so the times
on the page read as they do in a real project. Its words are made up but as long and as mixed (Chinese with English
code words) as a real project's; none come from a real one. It is plain JSON with \\u escapes, so the code stays
ASCII: to change a text, load it with json, change it, and save it again with ensure_ascii.

Taska runs in this process with its clock set to each step's time. fixtures/meta.json keeps when "now" was, so the
stories move every time forward by as long as has passed since.
"""
import io
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from datetime import datetime, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
SERVER = os.path.join(HERE, "..", "server")
OUT = os.path.join(HERE, "..", "web", ".storybook", "public", "fixtures")
DEMO = os.path.join(HERE, "story_demo.json")
CLOCK = [""]
# what the microphone says in Storybook (B540); \u escapes keep the code ASCII
MIC_WORDS = ("\u8ba2\u5355\u5bfc\u51fa\u7684\u65f6\u5019\uff0c\u5148\u6309\u5f53\u524d\u7684\u7b5b\u9009\u5bfc\u51fa\uff0c"
             "\u5217\u7684\u987a\u5e8f\u548c\u5c4f\u5e55\u4e0a\u4e00\u6837\u3002\u624b\u673a\u4e0a\u4e5f\u8981\u80fd\u7528\uff0c"
             "\u6587\u4ef6\u540d\u5e26\u4e0a\u65e5\u671f\u3002")


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def start(root: str, port: int):
    """Taska in this process, its clock the step's time."""
    sys.path.insert(0, SERVER)
    import importlib
    import pkgutil

    import taska
    import taska.core as core

    real = core.now

    def now() -> str:
        return CLOCK[0] or real()

    for m in pkgutil.iter_modules(taska.__path__):
        if m.name in ("__main__", "cli"):
            continue
        mod = importlib.import_module("taska." + m.name)
        if getattr(mod, "now", None) is real:
            setattr(mod, "now", now)
    from taska import logs
    from taska.hub import Hub
    from taska.web import Server

    logs.setup(os.path.join(root, "logs.db"), "warning")
    hub = Hub(root, False)
    srv = Server(("127.0.0.1", port), hub)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return hub, srv


class T:
    def __init__(self, port: int, hub):
        self.base = f"http://127.0.0.1:{port}"
        self.hub = hub

    def req(self, path: str, data=None, ctype="application/json", raw=False):
        body = None if data is None else (data if isinstance(data, bytes) else
                                          (data.encode() if isinstance(data, str) else json.dumps(data).encode()))
        r = urllib.request.Request(self.base + path, data=body, headers={"Content-Type": ctype} if body is not None else {})
        with urllib.request.urlopen(r, timeout=30) as f:
            b = f.read()
        return b if raw else b.decode()

    def state(self, p: str):
        return json.loads(self.req(f"/p/{p}/api/state?since=0"))

    def project(self, title: str) -> str:
        return json.loads(self.req("/api/projects", {"title": title}))["name"]

    def do(self, p: str, text: str, by="claude-code", ses=""):
        # a message's further lines continue it: indented, as the agents write them
        text = "\n".join(l if re.match(r"(new |ack |[A-Z]\d+ |D\d+ |\s)", l) else "  " + l for l in text.split("\n"))
        out =self.req(f"/p/{p}/do?by={by}" + (f"&session={ses}" if ses else ""), text, "text/plain")
        bad = [l for l in out.splitlines() if l.startswith("err")]
        if bad:
            raise SystemExit(f"seed {p}: {bad}\n{text}")
        return out

    def op(self, p: str, op):
        d = json.loads(self.req(f"/p/{p}/api/op", op))
        if not d.get("ok"):
            raise SystemExit(f"op {p}: {d}\n{op}")
        return d

    def file(self, p: str, name: str, data: bytes, mime: str) -> dict:
        return json.loads(self.req(f"/p/{p}/api/file?name={name}", data, mime))

    def emit(self, p: str, e: dict):
        s = self.hub.projects[p]
        with s.cond:
            s.emit(e)


def screenshot_png(title: str, rows: int, accent=(37, 99, 235)) -> bytes:
    """A made-up screenshot to attach: a page with a header, rows and a button, phone-like when it has few rows."""
    from PIL import Image, ImageDraw
    w, h = (900, 560) if rows > 4 else (420, 860)
    im = Image.new("RGB", (w, h), (244, 244, 245))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, w, 64), fill=(24, 24, 27))
    d.text((24, 24), title, fill="white")
    for i in range(rows):
        y = 92 + i * 72
        d.rounded_rectangle((24, y, w - 24, y + 56), 12, outline=(212, 212, 216), fill="white")
        d.rounded_rectangle((40, y + 12, 72, y + 44), 8, fill=accent)
        d.text((88, y + 21), f"Order #{1042 + i}   Paid   ${(i + 3) * 17}.00", fill=(39, 39, 42))
    d.rounded_rectangle((w - 200, h - 72, w - 24, h - 28), 10, fill=accent)
    d.text((w - 160, h - 57), "Pay now" if rows <= 4 else "Export CSV", fill="white")
    b = io.BytesIO()
    im.save(b, "PNG")
    return b.getvalue()


SHOTS = {
    "shot-checkout": ("Checkout", 3, (37, 99, 235)),
    "shot-cart": ("Cart  -  SAVE10 + gift card", 4, (5, 150, 105)),
    "shot-cart2": ("Cart total", 2, (217, 119, 6)),
    "shot-orders": ("Orders  (2,184)", 7, (37, 99, 235)),
}


def spoken_webm(words: str) -> bytes:
    """A voice note that says these words, in the Mac's own reading voice (Tingting: not anyone's real voice), as the
    page records them (Opus in WebM). B540: so a voice note sounds like speech and its waveform is a real one."""
    tmp = tempfile.mkdtemp(prefix="story-voice-")
    aiff, out = os.path.join(tmp, "v.aiff"), os.path.join(tmp, "v.webm")
    subprocess.run(["say", "-v", "Tingting", "-r", "160", "-o", aiff, words], check=True)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", aiff, "-ac", "1", "-c:a", "libopus", "-b:a", "24k", out],
                   check=True)
    with open(out, "rb") as f:
        b = f.read()
    shutil.rmtree(tmp, ignore_errors=True)
    return b


def seconds_of(webm: bytes) -> int:
    tmp = tempfile.NamedTemporaryFile(suffix=".webm", delete=False)
    tmp.write(webm)
    tmp.close()
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", tmp.name],
                         capture_output=True, text=True, check=True).stdout
    os.unlink(tmp.name)
    return max(1, round(float(out.strip() or 0)))


def media(t: T, p: str, spec: str, words: str) -> dict:
    if spec.startswith("voice-"):
        audio = spoken_webm(words)
        s = seconds_of(audio)
        f = t.file(p, f"voice_{s // 60}-{s % 60:02d}.webm", audio, "audio/webm")
        return {**f, "mime": "audio/webm", "tr": words}
    title, rows, accent = SHOTS[spec]
    f = t.file(p, f"{spec}.png", screenshot_png(title, rows, accent), "image/png")
    return {**f, "mime": "image/png"}


def seed(t: T, anchor: datetime):
    shop = t.project("Shop")
    app = t.project("Mobile app")
    t.project("Website")
    names = {"shop": shop, "mobile-app": app}
    rids = {}

    def fill(p: str, x):
        """{r:label} is the input made under that label, {d:title} the document of that title."""
        if isinstance(x, dict):
            return {k: fill(p, v) for k, v in x.items()}
        if isinstance(x, list):
            return [fill(p, v) for v in x]
        if not isinstance(x, str) or "{" not in x:
            return x

        def one(m):
            kind, key = m.group(1), m.group(2)
            if kind == "r":
                return rids[key]
            d = next((d for d in t.state(p)["docs"] if d["title"] == key), None)
            if not d:
                raise SystemExit(f"no document {key} yet")
            return f"D{d['d']}"

        return re.sub(r"\{([rd]):([^}]+)\}", one, x)

    with open(DEMO) as f:
        steps = json.load(f)["steps"]
    for k in steps:
        CLOCK[0] = (anchor - timedelta(minutes=k["m"])).isoformat(timespec="seconds")
        p = names[k["p"]]
        if "do" in k:
            t.do(p, fill(p, k["do"]), by=k["by"], ses=k.get("ses") or "")
        elif "op" in k:
            t.op(p, fill(p, k["op"]))
        elif "next" in k:
            t.req(f"/p/{p}/next?by={k['next']}&session={k['ses']}")
        elif "input" in k:
            i = k["input"]
            files = [media(t, p, s, i["text"]) for s in i["files"]]
            o = {"op": "input", "text": i["text"], "files": files}
            if i["scope"]:
                o["scope"] = i["scope"]
            rid = t.op(p, o)["res"][0].split()[1]
            rids[i["label"]] = rid
            if k.get("org"):  # what the organizer did with it, as it says on the page
                t.emit(p, {"k": "ack", "ids": [rid], "by": "org"})
                t.emit(p, {"k": "org", "src": rid, "ok": True, "msg": k["org"], "plan": "", "keep": False,
                           "changed": not k["org"].startswith("No changes"), "ms": 2400, "by": "org"})
    CLOCK[0] = ""
    t.req("/api/projects/delete", {"name": "default"})  # the empty one every Taska starts with: in Deleted, to restore
    return [shop, app, "website"]


def save(t: T, projects, root: str, anchor: datetime):
    # the answers this makes go again; other saved answers in the folder (dev__..., kept by other tools) stay
    os.makedirs(OUT, exist_ok=True)
    for name in os.listdir(OUT):
        if name.startswith(("api__", "p__")) or name in ("meta.json", "mic.webm"):
            os.remove(os.path.join(OUT, name))

    def keep(path: str, text: bool = False):
        # nothing of this machine goes in: its folders, the port, the throwaway Taska's key
        b = t.req(path, raw=True).decode().replace(root, "/data").replace(t.base, "http://127.0.0.1:7340")
        if not text:
            d = json.loads(b)
            if path.endswith("api/state?since=0") and "key" in d:
                d["key"] = "demo-key-0000"
            b = json.dumps(d, ensure_ascii=True)
        name = path.split("?")[0].strip("/").replace("/", "__") or "root"  # one flat folder: / becomes __
        with open(os.path.join(OUT, name + (".txt" if text else ".json")), "w") as f:
            f.write(b)

    # the other projects' hits for a search in Shop (the list shows them under its own), as the page asks for them
    keep("/api/search?q=%E5%AF%BC%E5%87%BA&skip=shop")
    for path in ["/api/projects", "/api/projects/deleted", "/api/views", "/api/voiceprefs", "/api/corrections", "/api/needs"]:
        keep(path)
    for p in projects:
        keep(f"/p/{p}/api/state?since=0")
        keep(f"/p/{p}/api/log?n=200")
        keep(f"/p/{p}/api/dims")
        keep(f"/p/{p}/agent?ui=1", text=True)
        st = t.state(p)
        refs = [f for r in st.get("inputs", []) for f in r.get("files", [])]
        refs += [f for it in st["items"] for m in it["thread"] for f in m.get("files") or []]
        for fid in {f["f"] if isinstance(f, dict) else f for f in refs}:
            with open(os.path.join(OUT, f"p__{p}__f__{fid}"), "wb") as out:
                out.write(t.req(f"/p/{p}/f/{fid}", raw=True))
    # B540: what Storybook's microphone hears (app-shim.js plays it instead of asking for yours): a sentence in the
    # Mac's reading voice, so the page draws a real waveform from real speech
    with open(os.path.join(OUT, "mic.webm"), "wb") as f:
        f.write(spoken_webm(MIC_WORDS))
    with open(os.path.join(OUT, "meta.json"), "w") as f:
        json.dump({"now": int(anchor.timestamp() * 1000)}, f)


def main():
    root = tempfile.mkdtemp(prefix="taska-stories-")
    anchor = datetime.now().astimezone().replace(microsecond=0)
    port = free_port()
    os.environ.update(GEMINI_API_KEY="", GOOGLE_API_KEY="")
    hub, srv = start(root, port)
    try:
        t = T(port, hub)
        projects = seed(t, anchor)
        time.sleep(0.5)  # the last writes reach the files
        save(t, projects, root, anchor)
        print(f"story fixtures: {len(os.listdir(OUT))} files in {os.path.relpath(OUT)}")
    finally:
        srv.shutdown()
        shutil.rmtree(root, ignore_errors=True)


if __name__ == "__main__":
    main()
