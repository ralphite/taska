#!/usr/bin/env python3
"""Storybook's data (T457): a throwaway Taska on an empty folder, filled with an English demo through the same
interfaces the agents and the page use, then every answer the page asks for saved as files the stories serve.

  python3 v2/tools/story_fixtures.py        -> v2/web/.storybook/public/fixtures/

The stories run the real page (the same build) on these answers, so they look exactly like Taska.
"""
import io
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SERVER = os.path.join(HERE, "..", "server")
OUT = os.path.join(HERE, "..", "web", ".storybook", "public", "fixtures")


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class T:
    def __init__(self, port: int):
        self.base = f"http://127.0.0.1:{port}"

    def req(self, path: str, data=None, ctype="application/json", raw=False):
        body = None if data is None else (data if isinstance(data, bytes) else
                                          (data.encode() if isinstance(data, str) else json.dumps(data).encode()))
        r = urllib.request.Request(self.base + path, data=body, headers={"Content-Type": ctype} if body is not None else {})
        with urllib.request.urlopen(r, timeout=30) as f:
            b = f.read()
        return b if raw else b.decode()

    def project(self, title: str) -> str:
        return json.loads(self.req("/api/projects", {"title": title}))["name"]

    def do(self, p: str, text: str, by="claude-code", ses=""):
        out = self.req(f"/p/{p}/do?by={by}" + (f"&session={ses}" if ses else ""), text, "text/plain")
        bad = [l for l in out.splitlines() if l.startswith("err")]
        if bad:
            raise SystemExit(f"seed {p}: {bad}\n{text}")
        return out

    def op(self, p: str, op):
        d = json.loads(self.req(f"/p/{p}/api/op", op))
        if not d.get("ok"):
            raise SystemExit(f"op {p}: {d}")
        return d

    def file(self, p: str, name: str, data: bytes, mime: str) -> dict:
        return json.loads(self.req(f"/p/{p}/api/file?name={name}", data, mime))


def screenshot_png(title: str) -> bytes:
    """A small made-up screenshot to attach (a page with a header, rows and a button)."""
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (900, 560), "white")
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 900, 56), fill=(244, 244, 245))
    d.text((24, 20), title, fill=(24, 24, 27))
    for i in range(6):
        y = 88 + i * 64
        d.rounded_rectangle((24, y, 876, y + 48), 10, outline=(228, 228, 231), fill=(250, 250, 250))
        d.text((44, y + 17), f"Order #{1042 + i}   Paid   ${(i + 3) * 17}.00", fill=(63, 63, 70))
    d.rounded_rectangle((700, 488, 876, 532), 10, fill=(37, 99, 235))
    d.text((750, 503), "Export CSV", fill="white")
    b = io.BytesIO()
    im.save(b, "PNG")
    return b.getvalue()


def seed(t: T):
    shop = t.project("Shop")
    app = t.project("Mobile app")
    t.project("Website")
    # items from two agents, approved or not, in every state
    t.do(shop, """new feature P1 now Filtered export to CSV
  When a filter is set, **Export** should write only the rows you see. Today it writes every order.
new bug P0 now Checkout button does nothing on Safari
  Tapping **Pay now** on iPhone Safari does nothing; no error is shown.
new task P2 now Write the returns policy page
new idea P2 now Dark mode for the reports
  Reports are hard to read at night; a dark theme could follow the system setting.
new task P3 later Clean up old feature flags
new bug P1 now Order emails arrive twice
new task P2 now Pick the export format
new feature P2 now Gift cards
new task P2 now Translate the store into Spanish
new bug P2 now Search ignores accents
""")
    t.do(shop, """new feature P2 now Saved carts across devices
  Keep the cart when a shopper signs in on another device.
new task P1 now Load test the sale weekend
""", by="codex", ses="worker")
    for ref in ["F1", "B2", "T3", "T5", "B6", "T7", "F8", "T9", "B10", "T12"]:
        t.op(shop, {"op": "set", "ref": ref, "f": {"status": "open"}})
    t.do(shop, """new task P2 now parent=F1 Export: apply the filter when writing the file
new task P2 now parent=F1 Export: test on phone and desktop
F1 doing
F1 progress Found it: the export reads the whole list before the filter applies.
B2 doing
B2 block I need a test card that works on Safari: the sandbox card is refused there. Can you add one in the payment settings?
T7 ask Which format should the export use?
  - ( ) CSV
  - ( ) Excel (.xlsx)
  - ( ) Both
B6 done Fixed: the email job ran twice after a deploy; it now runs once.
  **Result**: one email per order.
  **How to check**: place a test order and look at the inbox.
T3 progress Drafted the page; it is in docs/returns.md.
""", ses="worker")
    t.op(shop, {"op": "set", "ref": "T13", "f": {"status": "doing"}})
    t.do(shop, "T13 progress Ran 500 virtual shoppers for 10 minutes: p95 checkout 1.8 s.", by="codex", ses="worker")
    t.do(shop, """T9 ask Which of these should be translated first?
  - [ ] Product pages
  - [ ] Checkout
  - [ ] Order emails
  - [ ] Help center
""", by="codex", ses="worker")
    t.op(shop, {"op": "set", "ref": "B10", "f": {"status": "done"}})
    t.op(shop, {"op": "set", "ref": "T5", "f": {"status": "dropped"}})
    # a long conversation on F1
    for i, (who, text) in enumerate([
        ("you", "Also keep the column order the same as on screen."),
        ("claude-code", "Will do: the export now follows the columns you see, in the same order."),
        ("you", "And the date format should be the one in Settings, not ISO."),
        ("claude-code", "Done in the branch. Dates follow Settings; the file name has the filter in it, e.g. orders-paid-2026-10.csv."),
    ]):
        if who == "you":
            t.op(shop, {"op": "input", "text": text, "scope": 1})
        else:
            t.do(shop, f"F1 say {text}", ses="worker")
    # a document with comments, and one with choices
    t.do(shop, """F1 doc Export plan
  Export plan

  **Conclusion**: ship option A today and option B next week.

  ## Options
  - **A**: apply the filter when writing the file. Ships today.
  - **B**: save filters on the server and export from them. Ships next week.

  ## Steps
  1. Apply the filter in the export.
  2. Test on phone and desktop.
  3. Ship and watch the error log for a day.

  | Option | Days | Risk |
  |---|---|---|
  | A | 1 | Low |
  | B | 5 | Medium |
""", ses="worker")
    state = json.loads(t.req(f"/p/{shop}/api/state?since=0"))
    d1 = next(d for d in state["docs"] if d["title"] == "Export plan")
    t.op(shop, {"op": "dc", "d": d1["d"], "para": 2, "text": "Why not B first?"})
    t.do(shop, f"D{d1['d']} reply ¶2 A is one day and fixes the bug now; B needs the new filter storage.", ses="worker")
    t.op(shop, {"op": "dc", "d": d1["d"], "para": 0, "text": "Looks good overall."})
    t.do(shop, """T9 doc Translation plan
  Translation plan

  Spanish first, then French. Tick what goes in the first release.

  - [ ] Product pages
  - [ ] Checkout
  - [ ] Order emails
""", by="codex", ses="worker")
    # inputs: one waiting, one with a screenshot, one filed
    png = t.file(shop, "orders.png", screenshot_png("Orders"), "image/png")
    t.op(shop, {"op": "input", "text": "The orders page is slow when the list is long, see the screenshot."})
    t.op(shop, {"op": "input", "text": "Export should also work from the phone.", "files": [png]})
    rid = t.op(shop, {"op": "input", "text": "Add a coupon field on the cart page"})["res"][0].split()[1]
    t.do(shop, f"new feature P2 now src={rid} Coupon field on the cart page\n  Add a coupon field on the cart page")
    # rules
    t.do(shop, """new rule Commit messages say what changed for the shopper
  One line, plain words; the item code at the end, e.g. (B12).
new rule Test checkout on iPhone Safari before shipping
  Every change near checkout is tried on a real iPhone first.
""")
    rules = [i for i in json.loads(t.req(f"/p/{shop}/api/state?since=0"))["items"] if i["type"] == "rule"]
    t.op(shop, {"op": "set", "ref": rules[0]["code"], "f": {"status": "open"}})  # one in force, one still proposed
    # the agent works: claims an item, so its pill shows
    t.req(f"/p/{shop}/next?by=claude-code&session=worker")
    # the other project
    t.do(app, """new bug P1 now Push notifications stop after an update
new task P2 now Release 2.3 to TestFlight
""")
    t.op(app, {"op": "set", "ref": "B1", "f": {"status": "open"}})
    t.op(app, {"op": "input", "text": "Check the crash on Android 12 from the store reviews."})
    t.req("/api/projects/delete", {"name": "default"})  # the empty one every Taska starts with: in Deleted, to restore
    return [shop, app, "website"]


def save(t: T, projects):
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)

    def keep(path: str, text: bool = False):
        # nothing of this machine goes in: its folders, the port, the throwaway Taska's key
        b = t.req(path, raw=True).decode().replace(ROOT[0], "/data").replace(t.base, "http://127.0.0.1:7340")
        if path.endswith("api/state?since=0"):
            d = json.loads(b)
            d["key"] = "demo-key-0000" if "key" in d else d.get("key")
            b = json.dumps(d)
        b = b.encode()
        name = path.split("?")[0].strip("/").replace("/", "__") or "root"  # one flat folder: / becomes __
        with open(os.path.join(OUT, name + (".txt" if text else ".json")), "wb") as f:
            f.write(b)

    for path in ["/api/projects", "/api/projects/deleted", "/api/views", "/api/voiceprefs", "/api/corrections", "/api/needs"]:
        keep(path)
    for p in projects:
        keep(f"/p/{p}/api/state?since=0")
        keep(f"/p/{p}/api/log?n=200")
        keep(f"/p/{p}/api/dims")
        keep(f"/p/{p}/agent?ui=1", text=True)
        st = json.loads(t.req(f"/p/{p}/api/state?since=0"))
        for r in st.get("inputs", []):
            for f in r.get("files", []):
                fid = f["f"] if isinstance(f, dict) else f
                with open(os.path.join(OUT, f"p__{p}__f__{fid}"), "wb") as out:
                    out.write(t.req(f"/p/{p}/f/{fid}", raw=True))


ROOT = [""]


def main():
    root = tempfile.mkdtemp(prefix="taska-stories-")
    ROOT[0] = root
    port = free_port()
    env = dict(os.environ, GEMINI_API_KEY="", GOOGLE_API_KEY="")
    srv = subprocess.Popen([sys.executable, "-m", "taska", "serve", "--host", "127.0.0.1", "--port", str(port), "--root", root,
                            "--organizer", "off"], cwd=SERVER, env=env, stdout=subprocess.DEVNULL, stderr=open(os.path.join(tempfile.gettempdir(), "story-fixtures-server.log"), "w"))
    try:
        t = T(port)
        for _ in range(100):
            try:
                t.req("/api/projects")
                break
            except OSError:
                time.sleep(0.1)
        projects = seed(t)
        save(t, projects)
        print(f"story fixtures: {len(os.listdir(OUT))} files in {os.path.relpath(OUT)}")
    finally:
        srv.terminate()
        srv.wait()
        shutil.rmtree(root, ignore_errors=True)


if __name__ == "__main__":
    main()
