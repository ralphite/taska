#!/usr/bin/env python3
"""Ask Gemini for several phone UI designs of one part of Taska, then screenshot each one.

    python3 tools/ui_mocks.py "the main screen: header, tabs, filters, list, input box" --shot now.png
    python3 tools/ui_mocks.py brief.md --shot now-light.png --shot now-dark.png --n 5

Writes .mocks/<time>/: 1.html .. N.html (open them in a browser), 1.png / 1-dark.png (390x844 phone
screenshots via headless Chrome) and 1.json .. / designs.json (each design's name and idea).
Screenshots again, e.g. after editing a design by hand:  python3 tools/ui_mocks.py .mocks/<time> --shots-only An agent looks at the
screenshots, drops the weakest, and shows the best ones to the user in Taska. Needs GEMINI_API_KEY.
"""
import argparse
import base64
import json
import mimetypes
import os
import signal
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DARK = ["--force-dark-mode"]  # makes prefers-color-scheme: dark
LIGHT = ["--blink-settings=preferredColorScheme=1"]  # light even when the Mac itself is in dark mode
DIRECTIONS = [  # one per design, so the options really differ
    "calm and minimal: lots of air, quiet colors, content first",
    "native iPhone feel: like a well-made iOS app, bottom-reachable controls",
    "dense and fast for a power user: more on screen, every action one tap away",
    "friendly and warm: rounded, soft color accents, clear states",
    "bold and modern: strong hierarchy, confident type, a striking accent",
    "chat-first: the input box and recent conversation are the heart of the screen",
]

SYSTEM = """You are a senior product designer who also writes production HTML. You design the phone UI of Taska.

Taska is a personal tracker the user shares with AI coding agents. The user drops thoughts (text, voice, images) into
an input box; a built-in organizer turns them into items: features (F), bugs (B), ideas (I), tasks (T) and rules (R),
each with a code like F47, a priority P0-P3, now/later, and a status (proposed, open, in progress, in review, done,
won't do). Agents work through the items and write back; the user reviews and answers on the phone. Items that need
the user (proposed, in review, an agent asking) must stand out. Text is often Chinese, sometimes English.

Hard rules for your HTML:
- One self-contained HTML file. Styling only with Tailwind CSS v4 utilities, loaded with exactly
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>. No <style> blocks, no inline style=.
- Designed for a 390x844 phone. It must look right in light mode and in dark mode (use dark: variants; the page
  follows prefers-color-scheme). Inline SVG icons only (lucide style, stroke 1.75), no icon fonts, no images.
- Use realistic sample content (the user's real items are given below when available). Static mock: no app logic,
  but you may add a few lines of JavaScript for an open/close state if it helps show the design.
- Keep every existing function reachable (listed in the brief). You may move, merge or restyle them.
- Tap targets at least 44px. Respect the iPhone safe areas (pb-[env(safe-area-inset-bottom)] etc.).
"""


def ask(model, parts, temperature=1.0):
    body = {"systemInstruction": {"parts": [{"text": SYSTEM}]},
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {"temperature": temperature, "responseMimeType": "application/json", "responseSchema": {
                "type": "OBJECT", "required": ["name", "idea", "html"], "properties": {
                    "name": {"type": "STRING", "description": "2-4 word name of this design"},
                    "idea": {"type": "STRING", "description": "2-3 sentences: what this design does differently and why it is easier to use"},
                    "html": {"type": "STRING", "description": "the complete HTML file"}}}}}
    for attempt in range(3):
        req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                                     data=json.dumps(body).encode(),
                                     headers={"x-goog-api-key": os.environ["GEMINI_API_KEY"], "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                data = json.load(r)
            text = "".join(p.get("text", "") for p in data["candidates"][0]["content"]["parts"] if not p.get("thought"))
            return json.loads(text), data.get("modelVersion", model)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, KeyError, ValueError) as ex:
            if attempt == 2:
                raise
            print(f"  retry after {type(ex).__name__}: {str(ex)[:120]}", file=sys.stderr)
            time.sleep(5 * (attempt + 1))


def shoot_desktop(html_path, png_path, dark, size=(1440, 900)):
    """A desktop screenshot of the page itself, no phone frame, at 1x (wide enough to read, small enough to share)."""
    html_path, png_path = os.path.abspath(html_path), os.path.abspath(png_path)
    if os.path.exists(png_path):
        os.remove(png_path)
    with tempfile.TemporaryDirectory() as profile:
        cmd = [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", f"--user-data-dir={profile}",
               f"--window-size={size[0]},{size[1]}", "--force-device-scale-factor=1", "--virtual-time-budget=5000",
               *(DARK if dark else LIGHT), f"--screenshot={png_path}", "file://" + html_path]
        proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        size_now, deadline = -1, time.time() + 90
        try:
            while time.time() < deadline and proc.poll() is None:
                time.sleep(0.5)
                now = os.path.getsize(png_path) if os.path.exists(png_path) else -1
                if now > 0 and now == size_now:
                    break
                size_now = now
        finally:
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
    if not os.path.exists(png_path):
        raise RuntimeError(f"no screenshot for {html_path}")


def shoot(html_path, png_path, dark, flags=None):
    """390x844 phone screenshot at 2x. Headless Chrome is at least 500px wide, so the design goes into a 390x844 frame
    and the picture is cropped back to its center (sips, built into macOS). Chrome here does not always exit after the screenshot,
    so we wait for the file and then stop that Chrome ourselves (a throwaway profile, never the user's browser)."""
    html_path, png_path = os.path.abspath(html_path), os.path.abspath(png_path)
    frame = os.path.join(os.path.dirname(html_path), f".frame-{os.path.basename(html_path)}")
    with open(frame, "w", encoding="utf-8") as f:
        f.write(f'<!doctype html><body style="margin:0"><iframe src="{os.path.basename(html_path)}" width="390" height="844" '
                'style="border:0;display:block;margin:43.5px 55px"></iframe></body>')  # centered in the 500x931 window
    if os.path.exists(png_path):
        os.remove(png_path)
    with tempfile.TemporaryDirectory() as profile:
        cmd = [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", f"--user-data-dir={profile}",
               "--window-size=500,931", "--force-device-scale-factor=2", "--virtual-time-budget=5000",  # page time for Tailwind to style it
               *(flags if flags is not None else (DARK if dark else LIGHT)), f"--screenshot={png_path}", "file://" + frame]
        proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        size, deadline = -1, time.time() + 90
        try:
            while time.time() < deadline and proc.poll() is None:
                time.sleep(0.5)
                now = os.path.getsize(png_path) if os.path.exists(png_path) else -1
                if now > 0 and now == size:
                    break  # written and no longer growing
                size = now
        finally:
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
    os.remove(frame)
    if not os.path.exists(png_path):
        raise RuntimeError(f"no screenshot for {html_path}")
    subprocess.run(["sips", "-c", "1688", "780", png_path], check=True, capture_output=True)  # sips crops around the center


def shots_for(out, desktop=False):
    """Light and dark screenshots of every N.html in the folder, one Chrome at a time (phone, or 1440x900 desktop)."""
    names = sorted((f for f in os.listdir(out) if f[:-5].isdigit() and f.endswith(".html")), key=lambda f: int(f[:-5]))
    for f in names:
        for dark in (False, True):
            png = os.path.join(out, f"{f[:-5]}{'-dark' if dark else ''}.png")
            try:
                (shoot_desktop if desktop else shoot)(os.path.join(out, f), png, dark)
            except Exception as ex:
                print(f"  screenshot failed for {png}: {ex}", file=sys.stderr, flush=True)
    print(f"screenshots for {len(names)} designs in {out}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("brief", help="what to design: text, or a file with the brief (or the folder, with --shots-only)")
    ap.add_argument("--shot", action="append", default=[], help="screenshot of the current UI (repeatable)")
    ap.add_argument("--n", type=int, default=5, help="how many designs (default 5)")
    ap.add_argument("--model", default="gemini-pro-latest")
    ap.add_argument("--out", default="", help="output folder (default .mocks/<time>)")
    ap.add_argument("--shots-only", action="store_true", help="only (re)take the screenshots of the designs in that folder")
    ap.add_argument("--desktop", action="store_true", help="with --shots-only: 1440x900 desktop screenshots instead of phone ones")
    args = ap.parse_args()
    if args.shots_only:
        return shots_for(args.brief, args.desktop)
    brief = open(args.brief, encoding="utf-8").read() if os.path.isfile(args.brief) else args.brief
    out = args.out or os.path.join(".mocks", time.strftime("%m%d-%H%M"))
    os.makedirs(out, exist_ok=True)
    shots = [{"inline_data": {"mime_type": mimetypes.guess_type(p)[0] or "image/png",
                              "data": base64.b64encode(open(p, "rb").read()).decode()}} for p in args.shot]

    def one(i):
        direction = DIRECTIONS[(i - 1) % len(DIRECTIONS)]
        parts = [{"text": f"Design brief:\n{brief}\n\n" + ("The screenshots show how it looks today.\n" if shots else "")
                  + f"This is design {i} of {args.n}. Its direction: {direction}. Make it clearly your own take."}] + shots
        t0 = time.time()
        d, version = ask(args.model, parts)
        with open(os.path.join(out, f"{i}.html"), "w", encoding="utf-8") as f:
            f.write(d["html"])
        meta = {"n": i, "name": d["name"], "idea": d["idea"], "direction": direction, "model": version}
        with open(os.path.join(out, f"{i}.json"), "w", encoding="utf-8") as f:  # kept even if a later step fails
            json.dump(meta, f, ensure_ascii=False, indent=2)
        print(f"  {i}. {d['name']} ({version}, {time.time() - t0:.0f}s)", flush=True)
        return meta

    print(f"Asking {args.model} for {args.n} designs -> {out}", flush=True)
    with ThreadPoolExecutor(args.n) as pool:
        designs = [d for d in pool.map(lambda i: _safe(one, i), range(1, args.n + 1)) if d]
    with open(os.path.join(out, "designs.json"), "w", encoding="utf-8") as f:
        json.dump(designs, f, ensure_ascii=False, indent=2)
    shots_for(out)


def _safe(fn, i):
    try:
        return fn(i)
    except Exception as ex:  # one failed design should not sink the others
        print(f"  {i}. failed: {type(ex).__name__}: {str(ex)[:200]}", file=sys.stderr, flush=True)
        return None


if __name__ == "__main__":
    main()
