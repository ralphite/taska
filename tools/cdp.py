"""A tiny Chrome DevTools client (standard library only): drive a headless page like a user.

    import sys; sys.path.insert(0, 'tools'); from cdp import Page
    p = Page(size=(1440, 900), dark=False, port=9333)
    try:
        p.go('http://127.0.0.1:7342/p/my-app/', 3)
        p.key('j'); p.key('J'); p.key('Enter', meta=True)   # an upper-case letter is pressed with Shift
        p.click(x, y); p.hover(x, y)                        # real mouse events at page coordinates
        p.call('Input.insertText', text='hello')            # type into the focused field
        print(p.js('document.activeElement.id'))            # read state; find coordinates with getBoundingClientRect()
        p.shot('out.png')
    finally:
        p.close()

Pass flags=('--enable-features=OverlayScrollbar:mode/classic',) to see always-on scrollbars, or
flags=('--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream') to record from a fake microphone.
A key event without a character (Enter, Escape) does not press a focused button: send text='\\r' for that.
"""
import base64, json, os, signal, socket, struct, subprocess, sys, tempfile, time, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ui_mocks


class Page:
    def __init__(self, size=(1440, 900), dark=False, port=9333, flags=(), scrollbars=False):
        self.prof = tempfile.TemporaryDirectory()
        args = [ui_mocks.CHROME, '--headless=new', '--disable-gpu', '--no-first-run', f'--user-data-dir={self.prof.name}',
                f'--remote-debugging-port={port}', '--remote-allow-origins=*', f'--window-size={size[0]},{size[1]}',
                '--force-device-scale-factor=1', *(() if scrollbars else ('--hide-scrollbars',)), *flags, 'about:blank']
        self.p = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        for _ in range(60):
            try:
                tabs = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json'))
                break
            except Exception:
                time.sleep(0.25)
        self.port, self.dark = port, dark
        self._connect(next(t for t in tabs if t['type'] == 'page')['webSocketDebuggerUrl'], size)

    def new_tab(self):
        """A second tab of the same browser (the same localStorage), driven like this one; close it with close()."""
        t = json.load(urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:{self.port}/json/new?about:blank', method='PUT')))
        tab = object.__new__(Page)
        tab.prof = tab.p = None
        tab.port, tab.dark = self.port, self.dark
        tab._connect(t['webSocketDebuggerUrl'], self.size)
        return tab

    def _connect(self, ws, size):
        dark = self.dark
        host, path = ws[5:].split('/', 1)
        h, pt = host.split(':')
        self.s = socket.create_connection((h, int(pt)))
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall(f'GET /{path} HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                       f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n'.encode())
        buf = b''
        while b'\r\n\r\n' not in buf:
            buf += self.s.recv(4096)
        self.rest = buf.split(b'\r\n\r\n', 1)[1]
        self.id = 0
        self.size = size
        self.call('Emulation.setDeviceMetricsOverride', width=size[0], height=size[1], deviceScaleFactor=1, mobile=False)
        self.call('Emulation.setEmulatedMedia', features=[{'name': 'prefers-color-scheme', 'value': 'dark' if dark else 'light'}])

    def _read(self, n):
        while len(self.rest) < n:
            d = self.s.recv(1 << 20)
            if not d:
                raise EOFError
            self.rest += d
        out, self.rest = self.rest[:n], self.rest[n:]
        return out

    def _frame(self):
        msg = b''
        while True:
            b1, b2 = self._read(2)
            n = b2 & 127
            if n == 126:
                n = struct.unpack('>H', self._read(2))[0]
            elif n == 127:
                n = struct.unpack('>Q', self._read(8))[0]
            msg += self._read(n)
            if b1 & 0x80:
                return msg

    def call(self, method, **params):
        self.id += 1
        data = json.dumps({'id': self.id, 'method': method, 'params': params}).encode()
        n = len(data)
        hdr = bytes([0x81]) + (bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + struct.pack('>H', n) if n < 65536
                               else bytes([0x80 | 127]) + struct.pack('>Q', n))
        mask = os.urandom(4)
        self.s.sendall(hdr + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))
        while True:
            m = json.loads(self._frame())
            if m.get('id') == self.id:
                if 'error' in m:
                    raise RuntimeError(m['error'])
                return m.get('result', {})

    def go(self, url, wait=2.5):
        self.call('Page.navigate', url=url)
        time.sleep(wait)

    def js(self, expr):
        r = self.call('Runtime.evaluate', expression=expr, awaitPromise=True, returnByValue=True)
        if 'exceptionDetails' in r:
            raise RuntimeError(r['exceptionDetails'].get('exception', {}).get('description') or r['exceptionDetails'])
        return r.get('result', {}).get('value')

    KEYS = {'Enter': 13, 'Escape': 27, 'ArrowDown': 40, 'ArrowUp': 38, 'Tab': 9, 'Backspace': 8, ' ': 32}

    def key(self, k, shift=False, meta=False, wait=0.35):
        """Press one key; letters may be given upper-case for Shift."""
        if len(k) == 1 and k.isalpha() and k.isupper():
            shift = True
        mods = (8 if shift else 0) | (4 if meta else 0)
        code = self.KEYS.get(k, ord(k.upper()) if len(k) == 1 else 0)
        text = k if len(k) == 1 and not meta else ''
        self.call('Input.dispatchKeyEvent', type='keyDown' if text else 'rawKeyDown', key=k, text=text, windowsVirtualKeyCode=code, modifiers=mods)
        self.call('Input.dispatchKeyEvent', type='keyUp', key=k, windowsVirtualKeyCode=code, modifiers=mods)
        time.sleep(wait)

    def click(self, x, y, wait=0.4, button='left'):
        for t in ('mousePressed', 'mouseReleased'):
            self.call('Input.dispatchMouseEvent', type=t, x=x, y=y, button=button, clickCount=1)
        time.sleep(wait)

    def hover(self, x, y, wait=0.3):
        self.call('Input.dispatchMouseEvent', type='mouseMoved', x=x, y=y)
        time.sleep(wait)

    def shot(self, png):
        d = self.call('Page.captureScreenshot', format='png')['data']
        with open(png, 'wb') as f:
            f.write(base64.b64decode(d))

    def close(self):
        if self.p is None:  # a tab from new_tab(): the browser stays
            self.s.close()
            return
        try:
            os.killpg(self.p.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        self.prof.cleanup()
