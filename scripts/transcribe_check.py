#!/usr/bin/env python3
"""Replay voice recordings through Taska's transcription and check what comes back (T101). Run it before changing the
transcription model or its prompt, and after: the same recordings, the same checks, numbers side by side.

    python3 scripts/transcribe_check.py DIR                    # a throwaway Taska from this checkout (needs GEMINI_API_KEY)
    python3 scripts/transcribe_check.py DIR --runs 3           # each recording three times: the models are not steady
    python3 scripts/transcribe_check.py DIR --log my.jsonl     # the throwaway Taska gets a copy of this project log, so it
                                                               # builds the same vocabulary as that project
    python3 scripts/transcribe_check.py DIR --base http://127.0.0.1:7360/p/my-app   # a Taska you started yourself
    python3 scripts/transcribe_check.py DIR --out results.json # every answer, to compare runs later

DIR holds the recordings (.webm .m4a .mp4 .ogg .mp3 .wav .aac .flac) and expect.json, keyed by file name in DIR:

    {
      "priority.webm": {"ok": ["P\\\\s*0"], "scope": "B73"},       regexes a right transcript matches; scope: the item it is about
      "long.webm":     {"ok": ["pytest"], "ref": "the whole note, word for word"},     ref: for the character error rate
      "quiet.webm":    {"silent": true}                            nobody speaks: the transcript must be empty
    }

Recordings and what they say are yours: keep them outside the repository. This script holds none. Put phone recordings
in too (.m4a from an iPhone is sent as audio/mp4, like the page does): two of them once came back as their first
half-sentence only, because the phone's voice processing had cut their pauses to silence.

Per recording and run it prints the transcript's start and what went wrong; then the totals:
  key terms right   regexes in "ok" that matched
  CER               character error rate against "ref" (no punctuation, spaces, "(?)" or filler sounds)
  cut short         transcripts with less than 70% of the characters in "ref" (it stopped early)
  Traditional       runs with Traditional characters (CJK ones GB2312 cannot encode but Big5 can)
  no transcript     runs that came back with an error instead (refused, failed)
  made up           silent recordings that got words anyway (B092)
  speech model      runs that took the second, speech-to-text model's words (the main one refused, failed, stopped
                    early or was empty)
  strong model      runs that took the strong model's words (a phone's voice-processed note, where it heard more)
  hints             "Maybe misheard" lines the page would show
  strong model late runs where the strong model ran out of time and went on: did fuller words follow, and were the
                    words given first cut short (the transcript, CER and cut short above are the final words)
  time ...          seconds per stage on the server, median and max: the main, speech (asr) and strong (pro) model,
                    the main model asked again, and the whole note (total); a model that ran out of time shows its cap
"""
import argparse
import json
import os
import re
import shutil
import socket
import statistics
import subprocess
import sys
import tempfile
import time
import unicodedata
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = {".webm": "audio/webm", ".m4a": "audio/mp4", ".mp4": "audio/mp4", ".ogg": "audio/ogg", ".mp3": "audio/mpeg",
         ".wav": "audio/wav", ".aac": "audio/aac", ".flac": "audio/flac"}
FILLERS = "\u55ef\u5443\u989d\u6b38\u8bf6"  # um, uh... in Chinese


def traditional(text):
    out = []
    for ch in text or "":
        if "\u4e00" <= ch <= "\u9fff":
            try:
                ch.encode("gb2312")
            except UnicodeEncodeError:
                try:
                    ch.encode("big5")
                    out.append(ch)
                except UnicodeEncodeError:
                    pass
    return out


def norm(s):
    s = unicodedata.normalize("NFKC", s or "").lower().replace("(?)", "")
    s = re.sub(r"(?<![a-z])(um+|uh+|hmm+|er)(?![a-z])", " ", s)
    s = re.sub(f"[{FILLERS}]", "", s)
    return re.sub(r"[\W_]+", "", s)


def lev(a, b):
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def throwaway(log):
    """A Taska from this checkout on a free port, on a temporary data folder (with a copy of log, if given)."""
    root = tempfile.mkdtemp(prefix="taska-transcribe-check-")
    os.makedirs(os.path.join(root, "check"))
    if log:
        shutil.copyfile(log, os.path.join(root, "check", "taska.jsonl"))
    else:
        open(os.path.join(root, "check", "taska.jsonl"), "w").close()
    port = free_port()
    srv = subprocess.Popen([sys.executable, os.path.join(REPO, "taska.py"), "--host", "127.0.0.1", "--port", str(port), "--root", root,
                            "--organizer", "off"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(100):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=1)
            return srv, root, f"http://127.0.0.1:{port}/p/check"
        except OSError:
            time.sleep(0.1)
    srv.kill()
    raise SystemExit("the throwaway Taska did not start")


def post(url, data=b"", ctype="application/octet-stream"):
    last = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=data, headers={"Content-Type": ctype}), timeout=120) as r:
                return json.load(r)
        except (urllib.error.URLError, OSError) as ex:
            last = ex
            time.sleep(2)
    raise OSError(f"Taska did not answer: {last}")


def transcribe(base, path, scope):
    """Upload as the page does, then ask for the words until they are in (the upload answers at once: B165)."""
    with open(path, "rb") as f:
        data = f.read()
    sc = f"&scope={scope}" if scope else ""
    t0 = time.time()
    try:
        f = post(f"{base}/api/file?name={urllib.request.quote(os.path.basename(path))}&transcribe=1{sc}", data,
                 AUDIO.get(os.path.splitext(path)[1].lower(), "audio/webm"))
        while True:
            d = post(f"{base}/api/transcript?f={urllib.request.quote(f['f'])}{sc}")
            if d.get("done") or time.time() - t0 > 900:
                break
        if d.get("more"):  # the strong model ran out of time: its fuller words may still come
            first, ms = d.get("tr") or "", int((time.time() - t0) * 1000)
            while time.time() - t0 < 900:
                d = post(f"{base}/api/transcript?f={urllib.request.quote(f['f'])}{sc}&more=1")
                if not d.get("more"):
                    break
            return dict(d, first=first, ms=ms, ms_late=int((time.time() - t0) * 1000))
    except OSError as ex:
        d = {"tr_error": str(ex)}
    return dict(d, ms=int((time.time() - t0) * 1000))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dir", help="a folder with the recordings and expect.json")
    ap.add_argument("--runs", type=int, default=1)
    ap.add_argument("--base", help="a running Taska project, e.g. http://127.0.0.1:7360/p/my-app (default: a throwaway one)")
    ap.add_argument("--log", help="for the throwaway Taska: a project log to copy, for its vocabulary")
    ap.add_argument("--jobs", type=int, default=2, help="recordings transcribed at the same time (default 2)")
    ap.add_argument("--out", help="write every answer to this JSON file")
    args = ap.parse_args()
    exp_path = os.path.join(args.dir, "expect.json")
    expect = json.load(open(exp_path, encoding="utf-8")) if os.path.isfile(exp_path) else {}
    files = sorted(n for n in os.listdir(args.dir) if os.path.splitext(n)[1].lower() in AUDIO)
    if not files:
        raise SystemExit(f"no recordings in {args.dir}")
    srv = root = None
    base = (args.base or "").rstrip("/")
    if not base:
        srv, root, base = throwaway(args.log)
    try:
        jobs = [(n, r) for r in range(1, args.runs + 1) for n in files]
        with ThreadPoolExecutor(max(1, args.jobs)) as ex:
            res = list(ex.map(lambda j: transcribe(base, os.path.join(args.dir, j[0]), (expect.get(j[0]) or {}).get("scope")), jobs))
    finally:
        if srv:
            srv.terminate()
            srv.wait(90)
            shutil.rmtree(root, ignore_errors=True)
    t = dict(runs=0, key_ok=0, keys=0, edits=0, ref_chars=0, refs=0, short=0, trad=0, failed=0, silent=0, made_up=0, asr=0, pro=0, hints=0, late=0, fuller=0, first_short=0)
    ms = []
    for (name, run), d in zip(jobs, res):
        e, tr, notes = expect.get(name) or {}, d.get("tr") or "", []
        t["runs"] += 1
        ms.append(d.get("ms", 0))
        if d.get("tr_error"):
            t["failed"] += 1
            notes.append("NO TRANSCRIPT: " + d["tr_error"][:80])
        if e.get("silent"):
            t["silent"] += 1
            if tr.strip():
                t["made_up"] += 1
                notes.append("MADE UP")
        for rx in e.get("ok") or []:
            t["keys"] += 1
            if re.search(rx, tr, re.I):
                t["key_ok"] += 1
            else:
                notes.append(f"missed /{rx}/")
        if e.get("ref") and not d.get("tr_error"):
            ed = lev(norm(tr), norm(e["ref"]))
            t["edits"] += ed
            t["ref_chars"] += len(norm(e["ref"]))
            t["refs"] += 1
            notes.append(f"CER {ed / max(1, len(norm(e['ref']))):.1%}")
            if len(norm(tr)) < 0.7 * len(norm(e["ref"])):
                t["short"] += 1
                notes.append("CUT SHORT")
        if traditional(tr):
            t["trad"] += 1
            notes.append(f"{len(traditional(tr))} Traditional")
        if d.get("tr_by") == "asr" and tr:
            t["asr"] += 1
            notes.append("speech model's words" + (f" ({d['main_error'][:60]})" if d.get("main_error") else ""))
        if d.get("tr_by") == "pro" and tr:
            t["pro"] += 1
            notes.append("strong model's words")
        if d.get("pro_error"):
            notes.append("strong model: " + d["pro_error"][:60])
        if "first" in d:  # given first while the strong model ran on: were those cut short, did fuller ones follow?
            t["late"] += 1
            if d.get("tr") != d["first"]:
                t["fuller"] += 1
            notes.append(f"strong model ran late: {len(norm(d['first']))} chars first, {len(norm(tr))} after {d.get('ms_late', 0) / 1000:.0f}s")
            if e.get("ref") and len(norm(d["first"])) < 0.7 * len(norm(e["ref"])):
                t["first_short"] += 1
        t["hints"] += len(d.get("doubts") or [])
        print(f"{name[:36]:36} #{run} {d.get('ms', 0) / 1000:5.1f}s  {' '.join(tr.split())[:60]!r}  {'; '.join(notes)}")
    print()
    print(f"recordings {len(files)}, runs {t['runs']}, median {statistics.median(ms) / 1000:.1f}s per transcription")
    if t["keys"]:
        print(f"key terms right   {t['key_ok']}/{t['keys']}")
    if t["ref_chars"]:
        print(f"CER               {t['edits'] / t['ref_chars']:.1%}")
        print(f"cut short         {t['short']}/{t['refs']}")
    print(f"Traditional       {t['trad']}/{t['runs']}")
    print(f"no transcript     {t['failed']}/{t['runs']}")
    if t["silent"]:
        print(f"made up           {t['made_up']}/{t['silent']} silent runs got words")
    print(f"speech model      {t['asr']}/{t['runs']} runs used its words")
    print(f"strong model      {t['pro']}/{t['runs']} runs used its words")
    print(f"hints             {t['hints']} 'Maybe misheard' lines")
    if t["late"]:
        print(f"strong model late {t['late']}/{t['runs']} runs: fuller words followed in {t['fuller']}, the first words were cut short in {t['first_short']}")
    stages = [(k, [d["times"][k] for d in res if isinstance(d.get("times"), dict) and d["times"].get(k) is not None]) for k in ("main", "asr", "pro", "again", "total")]
    for k, v in stages:  # seconds each model took on the server (a model that ran out of time shows its cap)
        if v:
            print(f"{'time ' + k:17} median {statistics.median(v):.1f}s, max {max(v):.1f}s ({len(v)} runs)")
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump([dict(d, file=n, run=r) for (n, r), d in zip(jobs, res)], f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
