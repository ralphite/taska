#!/usr/bin/env python3
"""F195: a push reaches the phone's Taska. Starts its own Taska on a copy of tests/fixtures, lets headless Chrome
register the service worker, delivers an empty push through DevTools (as a push service would), and checks the
notification the service worker shows: what needs you, and where a tap goes.
    python3 scripts/push_check.py
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from cdp import Page
from keys_check import free_port

REPO = Path(__file__).resolve().parents[1]


def main():
    ok = True
    with tempfile.TemporaryDirectory(prefix='taska-push-') as root:
        shutil.copytree(REPO / 'tests' / 'fixtures' / 'my-app', Path(root) / 'my-app')
        port = free_port()
        srv = subprocess.Popen([sys.executable, str(REPO / 'taska.py'), '--host', '127.0.0.1', '--port', str(port), '--root', root,
                                '--organizer', 'off'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        origin = f'http://127.0.0.1:{port}'
        p = None
        try:
            time.sleep(1.5)
            p = Page(size=(390, 844), port=free_port())
            events, frame = [], p._frame

            def record():  # DevTools events come between the answers to calls: keep the ones about service workers
                f = frame()
                m = json.loads(f)
                if 'method' in m:
                    events.append(m)
                return f
            p._frame = record
            p.call('Browser.grantPermissions', origin=origin, permissions=['notifications'])
            p.go(origin + '/p/my-app/', wait=4)
            scope = p.js("navigator.serviceWorker.ready.then(r => r.scope)")
            check = lambda name, good: print(('PASS  ' if good else 'FAIL  ') + name) or good
            ok &= check('the service worker runs', scope == origin + '/')
            p.call('ServiceWorker.enable')
            time.sleep(1)
            p.js('1')
            regs = [r for e in events if e['method'] == 'ServiceWorker.workerRegistrationUpdated'
                    for r in e['params']['registrations'] if r['scopeURL'] == origin + '/']
            ok &= check('the browser knows its registration', bool(regs))
            if regs:
                p.call('ServiceWorker.deliverPushMessage', origin=origin, registrationId=regs[-1]['registrationId'], data='')
                time.sleep(3)
                ns = json.loads(p.js("navigator.serviceWorker.ready.then(r => r.getNotifications()).then(ns => JSON.stringify(ns.map(n => ({t: n.title, b: n.body, u: n.data && n.data.url}))))"))
                ok &= check('an empty push shows what needs you', len(ns) == 1 and ns[0]['t'].endswith('things need you') and 'my-app' in ns[0]['b'])
                ok &= check('a tap opens the project', bool(ns) and ns[0]['u'] == '/p/my-app/')
        finally:
            if p:
                p.close()
            srv.terminate()
            srv.wait(5)
    print('all passed' if ok else 'some failed')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
