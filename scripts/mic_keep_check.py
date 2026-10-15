#!/usr/bin/env python3
"""B217: Taska from the Home Screen asks for the microphone once. Starts its own Taska on a copy of tests/fixtures,
makes headless Chrome look like the Home Screen app (navigator.standalone), records two voice notes and checks the
microphone was asked for once; going to the background lets it go; in a browser tab every recording asks and closes.
    python3 scripts/mic_keep_check.py
"""
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from cdp import Page
from keys_check import free_port, FLAGS

REPO = Path(__file__).resolve().parents[1]
SPY = """
window.MICLOG = {asked: 0};
const was = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
navigator.mediaDevices.getUserMedia = async c => { MICLOG.asked++; const s = await was(c); MICLOG.last = s; return s; };
"""
HOME = "Object.defineProperty(navigator, 'standalone', {get: () => true});"


def record(p):
    p.js("startRec()")
    time.sleep(1.5)
    p.js("finishRec(false)")
    time.sleep(1)


def run(origin, home):
    p = Page(size=(390, 844), port=free_port(), flags=FLAGS)
    try:
        p.call('Page.enable')
        p.call('Page.addScriptToEvaluateOnNewDocument', source=(HOME if home else '') + SPY)
        p.call('Browser.grantPermissions', origin=origin, permissions=['audioCapture'])
        p.go(origin + '/p/my-app/', wait=3)
        record(p)
        record(p)
        asked = p.js("MICLOG.asked")
        live = p.js("MICLOG.last.getAudioTracks()[0].readyState")
        p.js("Object.defineProperty(document, 'visibilityState', {get: () => 'hidden', configurable: true}); dispatchEvent(new Event('visibilitychange'))")
        time.sleep(0.3)
        after = p.js("MICLOG.last.getAudioTracks()[0].readyState")
        return asked, live, after
    finally:
        p.close()


def main():
    ok = True
    check = lambda name, good: print(('PASS  ' if good else 'FAIL  ') + name) or good
    with tempfile.TemporaryDirectory(prefix='taska-mic-') as root:
        shutil.copytree(REPO / 'tests' / 'fixtures' / 'my-app', Path(root) / 'my-app')
        port = free_port()
        srv = subprocess.Popen([sys.executable, str(REPO / 'taska.py'), '--host', '127.0.0.1', '--port', str(port), '--root', root,
                                '--organizer', 'off'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        origin = f'http://127.0.0.1:{port}'
        try:
            time.sleep(1.5)
            asked, live, after = run(origin, home=True)
            ok &= check('Home Screen app: two recordings ask for the microphone once', asked == 1)
            ok &= check('it keeps the microphone between recordings', live == 'live')
            ok &= check('going to the background lets it go', after == 'ended')
            asked, live, _ = run(origin, home=False)
            ok &= check('a browser tab: each recording opens and closes it', asked == 2 and live == 'ended')
        finally:
            srv.terminate()
            srv.wait(5)
    print('all passed' if ok else 'some failed')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
