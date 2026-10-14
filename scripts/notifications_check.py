"""F191: desktop notifications through headless Chrome and the real polling endpoints.

    python3 scripts/notifications_check.py

Starts its own server with two fixture projects. Writes agent events directly to that temporary
server's Store (never /do). CDP grants permission; a Notification stub records delivery and clicks.
Visibility and the local hour are controlled to make foreground and quiet-hour checks deterministic.
"""
import json
from pathlib import Path
import shutil
import sys
import tempfile
import threading
import time

from cdp import Page
from keys_check import free_port

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
import taska


STUB = """
window.calls = []; window.errors = []; window.hiddenForTest = true; window.focusedForTest = false;
window.hourForTest = 12; window.focusCalls = 0;
addEventListener('error', e => errors.push(e.message));
Object.defineProperty(document, 'hidden', {get: () => hiddenForTest});
document.hasFocus = () => focusedForTest;
Date.prototype.getHours = () => hourForTest;
window.focus = () => { focusCalls++; sessionStorage.setItem('notice.focused', 'yes'); };
const NativeNotification = window.Notification;
window.Notification = class {
  static get permission() { return NativeNotification.permission; }
  static requestPermission() { return NativeNotification.requestPermission(); }
  constructor(title, options) { this.title = title; this.options = options; calls.push(this); }
  close() { this.closed = true; }
};
"""


def until(p, expr, timeout=12):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if p.js(expr):
            return
        time.sleep(0.15)
    raise AssertionError(expr)


def click(p, selector):
    xy = p.js(f"(() => {{ const r = document.querySelector({json.dumps(selector)}).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }})()")
    p.click(*xy)


def main():
    with tempfile.TemporaryDirectory(prefix='taska-notifications-') as root:
        for name in ('my-app', 'other-app'):
            shutil.copytree(REPO / 'tests/fixtures/my-app', Path(root) / name)
        taska.HUB = taska.Hub(root, False)
        srv = taska.Server(('127.0.0.1', 0), taska.Handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        origin = f'http://127.0.0.1:{srv.server_port}'
        p = None
        try:
            p = Page(port=free_port())
            p.call('Browser.grantPermissions', origin=origin, permissions=['notifications'])
            p.call('Page.addScriptToEvaluateOnNewDocument', source=STUB)
            p.go(origin + '/p/my-app/notifications')
            until(p, 'NOTICE.projects && NOTICE.items')
            assert p.js('noticeState()') == 'Off'
            click(p, '[data-act="notifications-on"]')
            assert p.js('noticeState()') == 'On'
            assert p.js('document.querySelector("[data-act=notifications-quiet]").getAttribute("aria-pressed")') == 'true'
            click(p, '[data-act="notifications-quiet"]')
            p.go(origin + '/p/my-app/notifications')
            until(p, 'NOTICE.projects')
            assert p.js('noticeOn() && !noticeRead("quiet", true)')
            click(p, '[data-act="notifications-quiet"]')
            assert p.js('calls.length') == 0

            def event(project, ref, kind='ask'):
                taska.HUB.projects[project].run_all([(0, {'op': 'say', 'ref': ref, 'kind': kind, 'text': 'Which option should we use?'})], 'codex')

            def others():
                p.js('checkOthers.t = 0; checkOthers()')

            event('other-app', 'B07')
            others()
            time.sleep(2)
            assert p.js('calls.length') == 0, 'batch must wait eight seconds'
            event('other-app', 'F08')
            others()
            until(p, 'calls.length === 1')
            assert p.js('calls[0].title.includes("2 new things need you in other-app")')
            assert p.js('calls[0].options.tag') == 'taska-needs-you'
            p.js('calls[0].onclick()')
            until(p, 'location.pathname === "/p/other-app/" && S.project === "other-app"')
            assert p.js('U.tab === "items" && !U.open')
            assert p.js('sessionStorage.getItem("notice.focused")') == 'yes'
            print('PASS: other-project questions batch once; click focuses and opens its Items list')

            p.go(origin + '/p/my-app/notifications')
            until(p, 'NOTICE.projects')
            others()
            time.sleep(9)
            assert p.js('calls.length') == 0
            print('PASS: reload does not repeat existing needs')

            for hour in (22, 7):
                p.js(f'hourForTest = {hour}')
                event('my-app', 'B07')
                p.js('load()')
                assert p.js('NOTICE.pending.size') == 0
            p.js('hourForTest = 8')
            event('my-app', 'B07')
            p.js('load()')
            until(p, 'calls.length === 1')
            assert p.js('calls[0].title.includes("B07 asks in my-app")')
            p.js('calls[0].onclick()')
            until(p, 'U.open === 7 && location.pathname.endsWith("/B07")')
            assert p.js('sessionStorage.getItem("notice.focused")') == 'yes'
            print('PASS: quiet hours suppress, 08:00 allows, a new question on the same item opens it')

            p.js('hiddenForTest = false; focusedForTest = true')
            event('my-app', 'F08', 'block')
            p.js('load()')
            assert p.js('NOTICE.pending.size') == 0
            p.js('focusedForTest = false')
            event('my-app', 'F08', 'block')
            p.js('load()')
            until(p, 'calls.length === 1')
            assert p.js('calls[0].title.includes("is blocked")')
            print('PASS: focused foreground suppresses; unfocused window allows')

            p.call('Emulation.setDeviceMetricsOverride', width=390, height=844, deviceScaleFactor=1, mobile=False)
            event('my-app', 'B07')
            p.js('load()')
            assert p.js('NOTICE.pending.size') == 0
            assert p.js('errors') == []
            print('PASS: phone width suppresses; no page errors')
        finally:
            if p:
                p.close()
            srv.shutdown()
            srv.server_close()


if __name__ == '__main__':
    main()
