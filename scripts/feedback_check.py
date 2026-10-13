#!/usr/bin/env python3
"""Check that everything you can click answers you (T160), screen by screen, in a real browser.

    python3 scripts/feedback_check.py                  # all checks; exit code 1 if any fails
    python3 scripts/feedback_check.py -k phone         # only the checks whose name contains "phone"
    python3 scripts/feedback_check.py --taska OLD.py   # the same checks against another copy of taska.py
    python3 scripts/feedback_check.py -v               # also list what each check looked at

For every button, link and tappable row on each screen it checks four things:
- press: a finger (phone) or the mouse button (desktop) held on it changes how it looks within 100 ms, and the look
  goes again when the press is cancelled, as when a finger starts to scroll. The press is cancelled, so nothing is done;
- focus: on the desktop, the Tab key reaches it and its focus ring shows, not cut off by what it sits in;
- hover: on the desktop, the mouse over it changes how it looks;
- size: on a 390 px phone it is at least 44 x 44 px to tap, its invisible tap area included.
Disabled buttons all look the same. EXEMPT below lists, with a reason, what is left out on purpose.

Like keys_check.py, each group starts its own Taska on a fresh copy of tests/fixtures (the demo project my-app, plus
a document, an answered question and an image added through the API) and drives headless Chrome through
scripts/cdp.py: real touches, clicks and keys, with page state read only to measure.
"""
import base64, json, os, shutil, socket, struct, subprocess, sys, tempfile, time, urllib.request, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from cdp import Page  # noqa: E402

TASKA = os.path.join(REPO, 'taska.py')
VERBOSE = '-v' in sys.argv

# What is left out on purpose: [check, CSS selector, why]. Keep this short; fix the control instead where you can.
EXEMPT = [
    ('focus', '[data-act="open"]', 'list rows are reached with J and K, and the selected one is tinted; Tab goes to their buttons'),
    ('focus', '[data-act="doc-pick"]', 'document paragraphs are picked with the pointer; selected text gets a comment from the keyboard too'),
    ('focus', '[data-expand]', 'words that open on a click have their own Show more / More button'),
    ('hover', '#sendBtn', 'the input box is being redesigned on its own branch; its big round button gets its hover there'),
    ('hover', '[aria-current], [aria-selected=true], [aria-expanded=true], [aria-pressed=true]:not([data-act=auto])',
     'a control that is on, open or selected is marked already (the Keep going switch still answers)'),
    ('hover', '[data-expand]', 'words that open on a click: the pointer turns into a hand over them'),
    ('size', '[data-act="doc-pick"]', 'a paragraph of a document is as tall as its text, and as wide as the page'),
    ('size', ':is(p, li, span, dd, h1, h2, h3) > :is(a, button)', 'a link inside a sentence (WCAG 2.5.8: inline targets)'),
]

JS = r"""
(() => {
  const SEL = 'button, a[href], summary, [data-act], [role=button]';
  const PROPS = ['opacity', 'backgroundColor', 'color', 'borderTopColor', 'boxShadow', 'outlineStyle', 'outlineWidth', 'outlineColor',
    'textDecorationLine', 'transform', 'filter', 'visibility', 'display'];
  const one = el => { const c = getComputedStyle(el); return PROPS.map(p => c[p]).join('|'); };
  const shown = el => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    for (let a = el; a && a.nodeType === 1; a = a.parentElement) { const s = getComputedStyle(a); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false; }
    return true;
  };
  const name = el => {
    const t = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.dataset.tip || '').replace(/\s+/g, ' ').trim().slice(0, 28);
    const where = el.closest('[id]');
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.dataset.act ? `[${el.dataset.act}]` : ''} "${t}"${where && where !== el ? ' in #' + where.id : ''}`;
  };
  const scrollers = el => { const out = []; for (let a = el.parentElement; a; a = a.parentElement) { const s = getComputedStyle(a); if (s.overflowX !== 'visible' || s.overflowY !== 'visible') out.push(a); } return out; };
  window.FB = {
    els: [], rest: [],
    list() {
      FB.els = [...document.querySelectorAll(SEL)].filter(el => shown(el) && !el.closest('#tip'));
      FB.rest = FB.els.map(FB.sig);
      return FB.els.map((el, i) => ({i, name: name(el), disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true', pressed: el.getAttribute('aria-pressed'),
        focusable: el.tabIndex >= 0 && !el.disabled, exempt: FB.exempt(el)}));
    },
    exempt(el) { return Object.fromEntries(EXEMPT.map(([k, sel]) => [k, el.matches(sel)]).filter(([, v]) => v)); },
    sig(el) { return [el, ...[...el.querySelectorAll('*')].slice(0, 40)].map(one).join('#'); },
    changed(i) { const el = FB.els[i]; return !!el && el.isConnected && FB.sig(el) !== FB.rest[i]; },
    // Where to touch it: its middle if nothing covers it there, else a point inside it that is free. Scrolled into view first.
    spot(i) {
      const el = FB.els[i];
      if (!el || !el.isConnected) return null;
      let r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) { el.scrollIntoView({block: 'center', inline: 'nearest'}); r = el.getBoundingClientRect(); FB.rest[i] = FB.sig(el); }
      for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.5], [0.75, 0.5], [0.5, 0.25], [0.5, 0.75], [0.15, 0.5], [0.85, 0.5]]) {
        const x = r.left + r.width * fx, y = r.top + r.height * fy;
        if (x < 1 || y < 1 || x > innerWidth - 1 || y > innerHeight - 1) continue;
        const hit = document.elementFromPoint(x, y);
        if (hit && (el === hit || el.contains(hit)) && hit.closest(SEL) === el) return [x, y];
      }
      return null;
    },
    // The area a finger can hit: the box, and the ::after layer that HIT-style classes stretch over it.
    target(i) {
      const el = FB.els[i], r = el.getBoundingClientRect(), a = getComputedStyle(el, '::after'), pos = getComputedStyle(el).position;
      let [t, rr, b, l] = [r.top, r.right, r.bottom, r.left];
      if (a.content !== 'none' && a.position === 'absolute' && pos !== 'static') {
        const px = v => v === 'auto' ? null : parseFloat(v);
        const [at, ar, ab, al] = [px(a.top), px(a.right), px(a.bottom), px(a.left)];
        if (at !== null && at < 0) t = Math.min(t, r.top + at);
        if (ab !== null && ab < 0) b = Math.max(b, r.bottom - ab);
        if (al !== null && al < 0) l = Math.min(l, r.left + al);
        if (ar !== null && ar < 0) rr = Math.max(rr, r.right - ar);
      }
      return {w: Math.round(rr - l), h: Math.round(b - t), inline: getComputedStyle(el).display === 'inline'};
    },
    // The focus ring of the focused element: is there one, and is it cut off by what it sits in?
    ring() {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const i = FB.els.indexOf(el), c = getComputedStyle(el), w = parseFloat(c.outlineWidth) || 0, off = parseFloat(c.outlineOffset) || 0;
      const outline = c.outlineStyle !== 'none' && w >= 1 && !/rgba\(.*, 0\)$/.test(c.outlineColor);
      const shadow = i >= 0 && c.boxShadow !== FB.rest[i].split('#')[0].split('|')[4];
      const out = outline ? Math.max(0, off + w) : 0, r = el.getBoundingClientRect();
      let cut = 0;
      if (outline && off + w > 0) {
        const ring = {t: r.top - out, r: r.right + out, b: r.bottom + out, l: r.left - out};
        let clip = {t: -1e9, r: 1e9, b: 1e9, l: -1e9};
        for (const a of scrollers(el)) { const q = a.getBoundingClientRect(); clip = {t: Math.max(clip.t, q.top), r: Math.min(clip.r, q.right), b: Math.min(clip.b, q.bottom), l: Math.max(clip.l, q.left)}; }
        cut = (ring.t < clip.t - 0.5) + (ring.r > clip.r + 0.5) + (ring.b > clip.b + 0.5) + (ring.l < clip.l - 0.5);
      }
      return {i, name: name(el), visible: el.matches(':focus-visible') && (outline || shadow), cut, exempt: i >= 0 ? FB.exempt(el) : {}};
    },
  };
})()
"""


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def png(w=24, h=16):  # a small image to attach, made here so the check needs no files
    raw = b''.join(b'\x00' + bytes((40 + x * 8) % 256 for x in range(w) for _ in range(3)) for _ in range(h))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')


class App:
    """A fresh Taska on a copy of the fixtures, with a few more things to look at, and a browser on it."""

    def __init__(self, size, dark=False, phone=False):
        self.root = tempfile.mkdtemp(prefix='taska-feedback-')
        shutil.copytree(os.path.join(REPO, 'tests', 'fixtures', 'my-app'), os.path.join(self.root, 'my-app'))
        self.port = free_port()
        self.srv = subprocess.Popen([sys.executable, TASKA, '--host', '127.0.0.1', '--port', str(self.port), '--root', self.root, '--organizer', 'off'],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.base = f'http://127.0.0.1:{self.port}/p/my-app/'
        for _ in range(80):
            try:
                urllib.request.urlopen(self.base + 'agent', timeout=1)
                break
            except Exception:
                time.sleep(0.1)
        self.seed()
        self.p = Page(size=size, dark=dark, port=free_port())
        self.p.call('Emulation.setFocusEmulationEnabled', enabled=True)  # focused from the start: no focus event (and refresh) mid-check
        self.phone = phone
        if phone:  # a touch screen: coarse pointer, no hover
            self.p.call('Emulation.setDeviceMetricsOverride', width=size[0], height=size[1], deviceScaleFactor=1, mobile=True)
            self.p.call('Emulation.setTouchEmulationEnabled', enabled=True, maxTouchPoints=5)

    def post(self, path, body, ctype='application/json', agent=False):
        data = body if isinstance(body, bytes) else (body.encode() if isinstance(body, str) else json.dumps(body).encode())
        req = urllib.request.Request(self.base + path, data=data, headers={'Content-Type': ctype}, method='POST')
        return urllib.request.urlopen(req, timeout=5).read().decode()

    def seed(self):  # a document, an answered question and an image, so their controls are on screen too
        self.post('api/op', {'op': 'doc', 'ref': 'F06', 'md': '# Sign-in plan\n\nUse the same button style as Google sign-in.\n\nThe callback goes to /auth/apple.'})
        block = json.loads(urllib.request.urlopen(self.base + 'api/state', timeout=5).read())['docs'][0]['blocks'][1]
        self.post('api/op', {'op': 'dc', 'd': 1, 'key': block['key'], 'quote': block['text'], 'text': 'Which Google button?'})
        self.post('do?by=claude-code', 'B07 ask Which limit do we keep?\n  - ( ) 20 MB\n  - ( ) 50 MB', 'text/plain')
        self.post('api/op', {'op': 'input', 'text': '✓ 20 MB', 'scope': 'B07'})
        f = json.loads(self.post('api/file?name=crash.png', png(), 'image/png'))
        self.post('api/op', {'op': 'input', 'text': 'The crash, in a picture', 'scope': 'B07', 'files': [f]})

    def go(self, path='', wait=2.5):
        self.p.go(self.base + path, wait)
        self.p.js('window.ERR = []; addEventListener("error", e => ERR.push(String(e.message)))')
        self.p.js("document.activeElement.blur(); window.__block = e => { if (window.__noclick) { e.stopImmediatePropagation(); e.preventDefault(); } }; addEventListener('click', __block, true)")
        self.p.js(JS.replace('EXEMPT', json.dumps([[k, s] for k, s, _ in EXEMPT])))

    def js(self, expr):
        return self.p.js(expr)

    def touch(self, kind, x=0, y=0):
        self.p.call('Input.dispatchTouchEvent', type=kind, touchPoints=[] if kind in ('touchEnd', 'touchCancel') else [{'x': x, 'y': y, 'id': 1}])

    def tap(self, sel, wait=0.8):  # a real tap on the first one of these that shows
        xy = self.js(f"(() => {{ const el = [...document.querySelectorAll({json.dumps(sel)})].find(e => e.getBoundingClientRect().width > 0); if (!el) return null; el.scrollIntoView({{block: 'nearest'}}); const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }})()")
        if not xy:
            raise AssertionError(f'nothing to tap: {sel}')
        if self.phone:
            self.touch('touchStart', *xy); time.sleep(0.05); self.touch('touchEnd')
        else:
            self.p.click(*xy, 0)
        time.sleep(wait)

    def key(self, k, wait=0.5, **kw):
        self.p.key(k, wait=wait, **kw)

    def close(self):
        self.p.close()
        self.srv.terminate()
        try:
            self.srv.wait(5)
        except subprocess.TimeoutExpired:
            self.srv.kill()
        shutil.rmtree(self.root, ignore_errors=True)


RESULTS = []


def check(name, bad, looked=0):
    """bad: what failed (empty = pass); looked: how many things were checked."""
    RESULTS.append((not bad, name, bad, looked))


def survey(a, view, desk=False):
    """Every control on the screen as it is now: press, size (phone), hover and focus (desktop)."""
    els = a.js('FB.list()')
    live = [e for e in els if not e['disabled']]
    no_press, stuck, small, no_hover, skipped = [], [], [], [], 0
    off = a.js("FB.els.filter(el => el.disabled && !el.hasAttribute('aria-pressed')).map(el => getComputedStyle(el).opacity)")
    check(f'{view}: disabled buttons all look the same (40 %)', sorted(set(o for o in off if o != '0.4')), len(off))
    if not desk:  # sizes first, before anything moves
        for e in els:
            t = a.js(f"FB.target({e['i']})")
            if (t['w'] < 44 or t['h'] < 44) and not t['inline'] and 'size' not in e['exempt']:
                small.append(f"{e['name']} {t['w']}x{t['h']}")
    a.js('window.__noclick = true')
    for e in live:
        i = e['i']
        xy = a.js(f'FB.spot({i})')
        if not xy:
            skipped += 1
            continue
        if desk:
            a.p.call('Input.dispatchMouseEvent', type='mouseMoved', x=xy[0], y=xy[1])
            time.sleep(0.02)
            a.js(f'FB.rest[{i}] = FB.sig(FB.els[{i}])')  # at rest under the mouse: hover is checked on its own
            a.p.call('Input.dispatchMouseEvent', type='mousePressed', x=xy[0], y=xy[1], button='left', clickCount=1)
        else:
            a.touch('touchStart', *xy)
        time.sleep(0.1)
        if not a.js(f'FB.changed({i})'):
            no_press.append(e['name'])
        if desk:
            a.p.call('Input.dispatchMouseEvent', type='mouseMoved', x=1, y=1)  # the pointer leaves it: the press is off
            a.p.call('Input.dispatchMouseEvent', type='mouseReleased', x=1, y=1, button='left', clickCount=1)
        else:
            a.touch('touchCancel')
        time.sleep(0.05)
        if not desk and a.js(f'FB.changed({i})'):
            time.sleep(0.3)  # a colour that fades back
            if a.js(f'FB.changed({i})'):
                stuck.append(e['name'])
    a.js('window.__noclick = false')
    gone = a.js('FB.els.filter(el => !el.isConnected).length')
    if gone:
        RESULTS.append((False, f'{view}: the screen was redrawn while it was checked', [f'{gone} controls replaced'], len(els)))
    check(f'{view}: every control shows a press within 100 ms', no_press, len(live) - skipped)
    if not desk:
        check(f'{view}: a cancelled press (a finger that scrolls) leaves no pressed look', stuck, len(live) - skipped)
        check(f'{view}: every control is at least 44 px to tap', small, len(els))
    else:
        a.p.call('DOM.getDocument', depth=0)  # this page's nodes, for the hover state below
        live = [e for e in a.js('FB.list()') if not e['disabled']]  # afresh: a refresh may have redrawn parts
        for e in live:
            if 'hover' in e['exempt']:
                continue
            if not hovered(a, e['i']):
                no_hover.append(e['name'])
        check(f'{view}: every control answers the mouse hovering it', no_hover, len(live))
        focus_walk(a, view)
    if VERBOSE:
        print(f'  {view}: {len(els)} controls, {skipped} covered or off screen')
    return els


def hovered(a, i):
    obj = a.p.call('Runtime.evaluate', expression=f'FB.els[{i}]')['result'].get('objectId')
    if not obj:
        return True
    node = a.p.call('DOM.requestNode', objectId=obj)['nodeId']
    a.js(f'FB.rest[{i}] = FB.sig(FB.els[{i}])')
    a.p.call('CSS.forcePseudoState', nodeId=node, forcedPseudoClasses=['hover'])
    time.sleep(0.03)
    ok = a.js(f'FB.changed({i})')
    a.p.call('CSS.forcePseudoState', nodeId=node, forcedPseudoClasses=[])
    return ok


def focus_walk(a, view, most=160):
    """Tab through the screen like a keyboard user: each stop must show its focus ring, not cut off."""
    a.js('FB.list(); document.activeElement.blur()')
    seen, hidden, cut, stops = set(), [], [], 0
    for _ in range(most):
        a.p.call('Input.dispatchKeyEvent', type='rawKeyDown', key='Tab', code='Tab', windowsVirtualKeyCode=9)
        a.p.call('Input.dispatchKeyEvent', type='keyUp', key='Tab', code='Tab', windowsVirtualKeyCode=9)
        time.sleep(0.02)
        r = a.js('FB.ring()')
        if not r:
            continue
        if r['name'] in seen:
            break
        seen.add(r['name'])
        stops += 1
        if r['i'] < 0 or 'focus' in r['exempt']:
            continue  # a text field or a scrolling area: not a control
        if not r['visible']:
            hidden.append(r['name'])
        elif r['cut'] > 1:
            cut.append(r['name'])
    a.js('document.activeElement.blur()')
    check(f'{view}: Tab shows a focus ring on every control', hidden, stops)
    check(f'{view}: no focus ring is cut off by what it sits in', cut, stops)
    unreachable = a.js("FB.els.filter(el => el.isConnected && el.tabIndex < 0 && !el.disabled && !Object.keys(FB.exempt(el)).includes('focus')).map(el => el.outerHTML.slice(0, 80))")
    check(f'{view}: every control can be reached with Tab', unreachable, len(seen))


def press_timing(a):
    """The press itself: at once under a finger, at least ~130 ms for a quick tap, gone when the finger moves."""
    a.go('')
    a.js('window.__noclick = true')
    xy = a.js("(() => { const r = $('searchBtn').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()")
    op = "getComputedStyle($('searchBtn')).opacity"
    a.touch('touchStart', *xy); time.sleep(0.03)
    check('phone: a finger on a button dims it at once (30 ms)', [] if a.js(op) != '1' else ['searchBtn: still 1'], 1)
    a.touch('touchCancel'); time.sleep(0.05)
    a.touch('touchStart', *xy); time.sleep(0.02); a.touch('touchEnd'); time.sleep(0.06)
    check('phone: a quick tap stays pressed for a moment after the finger lifts', [] if a.js(op) != '1' else ['searchBtn: back at once'], 1)
    time.sleep(0.25)
    check('phone: then it goes back', [] if a.js(op) == '1' else [f'searchBtn: {a.js(op)}'], 1)
    row = a.js("(() => { const r = document.querySelector('#list [data-act=open]').getBoundingClientRect(); return [r.x + r.width / 3, r.y + r.height / 2]; })()")
    bg = "getComputedStyle(document.querySelector('#list [data-act=open]')).backgroundColor"
    rest = a.js(bg)
    a.touch('touchStart', *row); time.sleep(0.01)
    a.p.call('Input.dispatchTouchEvent', type='touchMove', touchPoints=[{'x': row[0], 'y': row[1] - 30, 'id': 1}]); time.sleep(0.2)
    check('phone: a finger that scrolls the list does not press the row', [] if a.js(bg) == rest else [f'row: {a.js(bg)}'], 1)
    a.touch('touchCancel'); a.js('window.__noclick = false')


def group_phone(a, dark=False):
    tone = 'phone dark' if dark else 'phone'
    if not dark:
        press_timing(a)
    a.go(''); survey(a, f'{tone} list')
    a.go('B03'); survey(a, f'{tone} item in review')
    a.go('F04'); survey(a, f'{tone} item with a question')
    if dark:
        return
    a.go('I05'); survey(a, f'{tone} blocked item')
    a.go('F06'); survey(a, f'{tone} item with subitems and a doc')
    a.go('B07'); survey(a, f'{tone} item with an answer and an image')
    a.go('T14'); survey(a, f'{tone} proposed item')
    a.go('B03'); a.tap('#itemMenuBtn'); survey(a, f'{tone} item menu')
    a.go(''); a.tap('#filterBtn'); survey(a, f'{tone} filters')
    a.go(''); a.tap('#projBtn', 1.0); survey(a, f'{tone} drawer')
    a.go(''); a.tap('[data-act="go-through"]'); survey(a, f'{tone} focus card')
    a.go('inputs'); survey(a, f'{tone} inputs')
    a.go('rules'); survey(a, f'{tone} rules')
    a.go(''); a.tap('#searchBtn'); survey(a, f'{tone} search')
    a.go('D1', 3); survey(a, f'{tone} document')
    a.go('B07'); a.tap('#detailBody [data-act="view"]'); survey(a, f'{tone} image viewer')


def group_desk(a, dark=False):
    tone = 'desktop dark' if dark else 'desktop'
    a.p.call('DOM.enable'); a.p.call('CSS.enable'); a.p.call('DOM.getDocument', depth=1)
    a.go('B03'); survey(a, f'{tone} list and item', desk=True)
    if dark:
        return
    a.go('F04'); survey(a, f'{tone} item with a question', desk=True)
    a.go('B07'); survey(a, f'{tone} item with an answer and an image', desk=True)
    a.go('B03'); a.key('.', 0.8); survey(a, f'{tone} item menu', desk=True)
    a.go(''); a.key('f', 0.8); survey(a, f'{tone} filters', desk=True)
    a.go(''); a.key('J', 1.0); survey(a, f'{tone} go through', desk=True)
    a.go('D1', 3); survey(a, f'{tone} document', desk=True)
    a.go('inputs'); survey(a, f'{tone} inputs', desk=True)
    a.go('new'); survey(a, f'{tone} new input', desk=True)
    for sec in ('settings', 'connect', 'phone', 'log'):
        a.go(sec, 3); survey(a, f'{tone} this project: {sec}', desk=True)


def group_narrow(a):
    a.p.call('DOM.enable'); a.p.call('CSS.enable'); a.p.call('DOM.getDocument', depth=1)
    a.go('B03'); survey(a, 'desktop 1024 rail', desk=True)


GROUPS = [('phone', lambda a: group_phone(a), dict(size=(390, 844), phone=True)),
          ('phone dark', lambda a: group_phone(a, True), dict(size=(390, 844), phone=True, dark=True)),
          ('desktop', lambda a: group_desk(a), dict(size=(1440, 900))),
          ('desktop dark', lambda a: group_desk(a, True), dict(size=(1440, 900), dark=True)),
          ('narrow', group_narrow, dict(size=(1024, 768)))]


def main():
    global TASKA
    if '--taska' in sys.argv:
        TASKA = os.path.abspath(sys.argv[sys.argv.index('--taska') + 1])
    only = sys.argv[sys.argv.index('-k') + 1] if '-k' in sys.argv else ''
    for name, fn, opts in GROUPS:
        if only and only.lower() not in name.lower():
            continue
        a = App(**opts)
        try:
            fn(a)
            check(f'{name}: no script errors', a.js('window.ERR || []'))
        except Exception as ex:  # a broken step fails its group, the others still run
            RESULTS.append((False, f'{name}: stopped', [repr(ex)[:200]], 0))
        finally:
            a.close()
    for ok, name, bad, looked in RESULTS:
        print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f'  ({looked})' if VERBOSE else '')
              + ('' if ok else ''.join(f'\n      {b}' for b in bad[:12]) + (f'\n      … and {len(bad) - 12} more' if len(bad) > 12 else '')))
    bad = sum(not r[0] for r in RESULTS)
    print(f'\n{len(RESULTS) - bad} of {len(RESULTS)} passed')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
