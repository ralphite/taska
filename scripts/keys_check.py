#!/usr/bin/env python3
"""Press every desktop shortcut in a real browser and check that it does what the ? sheet says (T104).

    python3 scripts/keys_check.py            # all checks; exit code 1 if any fails
    python3 scripts/keys_check.py -k undo    # only the checks whose name contains "undo"

Each group starts its own Taska on a fresh copy of tests/fixtures (the demo project my-app) and drives
headless Chrome through scripts/cdp.py like a user: keys and clicks, with page state read only to check.
Demo items: B03 in review, F04 asks a question with choices, T14 proposed, I05 blocked, F06 in progress with
subitems T12 and T13, B07 open, F08 open, I09 later, B02 T11 F01 done, R10 a rule.
"""
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from cdp import Page  # noqa: E402

FLAGS = ('--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream')


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


class App:
    """A fresh Taska on a copy of the fixtures, and a desktop browser on it."""

    def __init__(self, size=(1440, 900)):
        self.root = tempfile.mkdtemp(prefix='taska-keys-')
        shutil.copytree(os.path.join(REPO, 'tests', 'fixtures', 'my-app'), os.path.join(self.root, 'my-app'))
        self.port = free_port()
        self.srv = subprocess.Popen([sys.executable, os.path.join(REPO, 'taska.py'), '--host', '127.0.0.1', '--port', str(self.port),
                                     '--root', self.root, '--organizer', 'off'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.base = f'http://127.0.0.1:{self.port}/p/my-app/'
        for _ in range(80):
            try:
                urllib.request.urlopen(self.base + 'agent', timeout=1)
                break
            except Exception:
                time.sleep(0.1)
        self.p = Page(size=size, port=free_port(), flags=FLAGS)

    def go(self, path='', wait=2.5):
        self.p.go(self.base + path, wait)
        self.p.js('window.ERR = []; addEventListener("error", e => ERR.push(String(e.message)))')
        self.p.js('document.activeElement.blur()')

    def js(self, expr):
        return self.p.js(expr)

    def key(self, k, wait=0.5, **kw):
        self.p.key(k, wait=wait, **kw)

    def enter(self, wait=0.6, shift=False):  # a real Enter: it presses a focused button
        mods = 8 if shift else 0
        self.p.call('Input.dispatchKeyEvent', type='keyDown', key='Enter', code='Enter', text='\r', windowsVirtualKeyCode=13, modifiers=mods)
        self.p.call('Input.dispatchKeyEvent', type='keyUp', key='Enter', code='Enter', windowsVirtualKeyCode=13, modifiers=mods)
        time.sleep(wait)

    def type(self, text, wait=0.3):
        self.p.call('Input.insertText', text=text)
        time.sleep(wait)

    def click(self, sel, wait=0.6):
        xy = self.js(f"(() => {{ const r = [...document.querySelectorAll({json.dumps(sel)})].map(e => e.getBoundingClientRect()).find(r => r.width > 0); return r && [r.x + r.width / 2, r.y + r.height / 2]; }})()")
        if not xy:
            raise AssertionError(f'nothing to click: {sel}')
        self.p.click(*xy, wait)

    def toast(self):
        return self.js("$('toast').hidden ? '' : $('toast').textContent.trim()")

    def close(self):
        self.p.close()
        self.srv.terminate()
        try:
            self.srv.wait(5)
        except subprocess.TimeoutExpired:
            self.srv.kill()
        shutil.rmtree(self.root, ignore_errors=True)


RESULTS = []


def check(name, got, want):
    ok = got == want if not callable(want) else bool(want(got))
    RESULTS.append((ok, name, got, want if not callable(want) else want.__doc__ or 'a condition'))


open_ = lambda a: a.js('U.open && code(U.open)')
status = lambda a, n: a.js(f'byN.get({n}).status')


def group_move(a):
    a.go('B03')
    a.key('j'); check('J goes to the next row', open_(a), 'F04')
    a.key('k'); check('K goes back', open_(a), 'B03')
    a.key('o'); check('O opens full width', a.js('D.full'), True)
    a.key('Escape'); check('Esc leaves full width', a.js('D.full'), False)
    top = a.js("$('detailBody').scrollTop"); a.key(' ', wait=0.8)
    check('Space scrolls the item', a.js("$('detailBody').scrollTop") > top or a.js("$('detailBody').scrollHeight <= $('detailBody').clientHeight"), True)
    for k, tab in (('n', 'inputs'), ('a', 'archive'), ('r', 'rules'), ('i', 'items')):
        a.key('g', wait=0.1); a.key(k, wait=0.6); check(f'G then {k.upper()} opens {tab}', a.js('U.tab'), tab)
    a.go('B03'); a.key('J', wait=0.8); check('Shift+J starts Go through', a.js('!!U.go'), True)
    a.key('K', wait=0.6); check('Shift+K stops at the first one', (open_(a), a.toast()), ('B03', 'This is the first one'))
    a.key('J', wait=0.8); check('Shift+J goes to the next that needs you', open_(a), 'F04')
    a.key('Escape'); a.js("performance.clearResourceTimings()")
    a.key('g', wait=0.1); a.key('p', wait=1.5)
    check('G then P opens the switcher, ready to type', a.js("document.activeElement.id"), 'projFilter')
    check('G then P loads the projects once', a.js("performance.getEntriesByType('resource').filter(e => e.name.includes('projects')).length"), lambda n: n <= 2)
    a.key('Escape'); check('Esc closes the switcher at once', a.js("$('overlay').hidden"), True)
    a.key('['); check('[ hides the sidebar', a.js('D.sideHidden'), True)
    a.key('['); check('[ shows it again', a.js('D.sideHidden'), False)


def group_act(a):
    a.go('B07')
    a.key('a'); check('A on an open item says why not', a.toast(), 'Nothing waits on you in B07')
    a.key('d', wait=1.2); check('D marks it done', status(a, 7), 'done')
    a.key('z', wait=1.5); check('Z undoes your last action', status(a, 7), 'open')
    a.key('w', wait=1.2); check("W marks it won't do", status(a, 7), 'dropped')
    a.key('z', wait=1.5); check('Z undoes that too', status(a, 7), 'open')
    a.key('l', wait=1.2); check('L moves it to later', a.js('byN.get(7).when'), 'later')
    a.key('l', wait=1.2); check('L again brings it back to now', a.js('byN.get(7).when'), 'now')
    a.key('e', wait=0.6); check('E on an open item says why not', a.toast(), 'Archive works on finished items')
    a.key('n', wait=0.6); check('N outside review says why not', a.toast(), 'Not yet works on items in review')
    a.key('r', wait=0.5); check('R puts the caret in the box, replying', (a.js('document.activeElement.id'), a.js('scopeN() && code(scopeN())')), ('text', 'B07'))
    a.js('document.activeElement.blur()')
    a.key('.', wait=0.6); check('. opens the item menu', a.js("U.sheet"), 'menu')
    a.key('i', wait=0.8); check('I works from inside the menu', (a.js("$('overlay').hidden"), a.js('U.editing')), (True, 7))
    a.type(' More detail.'); a.key('Escape', wait=0.6)
    check('Esc in the editor keeps what you typed', a.toast(), lambda t: 'kept' in t)
    a.js('document.activeElement.blur()'); a.key('i', wait=0.8)
    check('I brings the unsaved text back', a.js("$('eBody').value.endsWith('More detail.')"), True)
    a.click('[data-act=edit-cancel]')
    a.key('A', wait=0.6); check('Shift+A opens the subitem field', a.js('document.activeElement.id'), 'subTitle')
    a.type('Check big PNGs'); a.enter(1.2)
    check('Enter adds the subitem and keeps the field', (a.js("S.items.some(i => i.parent === 7 && i.title === 'Check big PNGs')"), a.js('document.activeElement.id')), (True, 'subTitle'))
    a.key('d', wait=0.5); check('A letter after that types, it does not act on the parent', (a.js("$('subTitle').value"), status(a, 7)), ('d', 'open'))
    a.key('Escape'); a.js('document.activeElement.blur()')
    a.key('m', wait=0.6); check('M opens Move under', a.js("$('dlgTitle').textContent.includes('Move') || !!$('moveList')"), True)
    a.key('Escape')


def group_answer(a):
    a.go('B03')
    a.key('a', wait=1.2); check('A on an item in review accepts it', status(a, 3), 'done')
    a.key('z', wait=1.5); check('Z puts it back in review', status(a, 3), 'review')
    a.go('F04'); a.key('a', wait=0.8); check('A on a question goes to its first choice', (a.js('document.activeElement.dataset.act'), a.js('document.activeElement.dataset.i')), ('choice', '0'))
    a.key(' ', wait=0.5); check('Space picks the focused choice', a.js('U.choice && [...U.choice.picked]'), [0])
    a.js('document.activeElement.blur()'); a.key('2', wait=0.5); check('A digit picks that choice', a.js('U.choice && [...U.choice.picked]'), lambda v: v and 1 in v)
    a.go('B03'); a.key('n', wait=1.2); check('N on review reopens it and asks what is missing', (status(a, 3), a.js('document.activeElement.id')), ('doing', 'text'))
    a.key('Escape'); a.js('document.activeElement.blur()')
    a.go(''); a.key('E', wait=1.2); check('Shift+E archives every finished item', a.js('S.items.filter(i => i.archived).length'), 3)
    time.sleep(3.2); a.key('z', wait=1.5); check('Z puts the whole batch back', a.js('S.items.filter(i => i.archived).length'), 0)


def group_write(a):
    a.go('B03')
    a.key('c', wait=0.8); check('C opens the New input page', (a.js('D.compose'), a.js('document.activeElement.id')), (True, 'text'))
    a.key('Escape', wait=0.6); check('Esc leaves it, back to the item', (a.js('D.compose'), open_(a)), (False, 'B03'))
    a.key('j', wait=0.5); check('After that, J moves instead of typing', (a.js("$('text').value"), open_(a)), ('', 'F04'))
    a.go('B07'); a.key('v', wait=1.5); check('V starts a voice note', a.js('!!R.rec'), True)
    a.enter(2.0); check('Enter stops it into the box', (a.js('!!R.rec'), a.js('U.files.length')), (False, 1))
    a.js("U.files = []; renderComposer(); document.activeElement.blur()")
    a.key('V', wait=1.5); check('Shift+V starts a new input by voice', (a.js('!!R.rec'), a.js('D.compose')), (True, True))
    a.key('Escape', wait=0.8); check('Esc discards the recording', a.js('!!R.rec'), False)
    a.key('Escape'); a.go('B07')
    a.click('#text'); a.type('hello')
    a.p.call('Input.dispatchKeyEvent', type='rawKeyDown', key='v', code='KeyV', windowsVirtualKeyCode=86, modifiers=1)
    a.p.call('Input.dispatchKeyEvent', type='keyUp', key='v', code='KeyV', windowsVirtualKeyCode=86, modifiers=1); time.sleep(1.5)
    check('Alt+V records while typing in the box', (a.js('!!R.rec'), a.js("$('text').value")), (True, 'hello'))
    a.key('Escape', wait=0.8)
    a.go('B03'); a.key('/', wait=0.4); a.type('sign', wait=0.6)
    check('/ searches; the count is the matches', (a.js('U.q'), a.js("$('nItems').textContent")), ('sign', a.js("String(document.querySelectorAll('#list article[data-n]').length)")))
    a.key('Escape', wait=0.6); check('One Esc clears the search and leaves the field', (a.js('U.q'), a.js('document.activeElement.tagName')), ('', 'BODY'))
    a.key('f', wait=0.6); check('F opens the filters', a.js('D.filters'), True)
    a.key('J', wait=0.8); a.key('Escape', wait=0.5); check('Esc closes the newest layer first (filters, then Go through)', (a.js('D.filters'), a.js('!!U.go')), (False, True))
    a.key('Escape', wait=0.5)
    a.key('?', wait=0.6); check('? opens the shortcut sheet', a.js("$('dlgTitle').textContent"), 'Keyboard shortcuts')
    a.key('Escape', wait=0.5); check('One Esc closes it', a.js("$('overlay').hidden"), True)


def group_context(a):
    a.go('B03')
    a.key('g', wait=0.1); a.key('n', wait=0.8); h = a.js('history.length')
    for k in ('a', 'd', 'Enter', '.'):
        a.key(k, wait=0.5)
    check('On Inputs, item keys leave the hidden item alone', (status(a, 3), a.js("$('overlay').hidden"), a.js('history.length')), ('review', True, h))
    a.key('g', wait=0.1); a.key('r', wait=0.8)
    check('Rules shows no item from Items', (open_(a), a.js("$('scope').textContent.includes('New rule')")), (None, True))
    a.key('g', wait=0.1); a.key('i', wait=0.8); check('Back on Items, the item you had open is there', open_(a), 'B03')
    a.key('g', wait=0.1); a.key('r', wait=0.8)
    a.key('J', wait=0.8); check('Shift+J from Rules goes to Items first', (a.js('U.tab'), a.js('!!U.go')), ('items', True))
    a.key('Escape'); a.go('')
    check('A project opens with nothing selected, the box a new input', (open_(a), a.js("$('scope').textContent.includes('New input')")), (None, True))
    a.key('j', wait=0.5); a.key('Escape', wait=0.5); check('Esc on the list goes back to nothing selected', open_(a), None)


def group_project(a):  # This project is a settings page: one section at a time, each at its own address (B162)
    a.go('')
    a.click('#drawerSettings [data-act="log"]')
    check('A sidebar row opens its own section of This project', (a.js("location.pathname.split('/').pop()"), a.js("$('projectBody').querySelector('h1').textContent")), ('log', 'Change log'))
    a.click('#projectNav [data-sec="phone"]')
    check('Each section has its own address', a.js("location.pathname.split('/').pop()"), 'phone')
    a.js('document.activeElement.blur()'); a.key('Escape', wait=0.8)
    check('Esc leaves This project at once, back to the list', (a.js('D.page'), a.js("location.pathname.split('/').pop()")), (None, ''))


def group_narrow(a):
    a.go('B03')
    a.key('['); check('[ at 1024 opens the sidebar over the page', a.js('D.sideOpen'), True)
    a.key('j'); a.key('f'); check('Keys do not reach behind it', (open_(a), a.js('D.filters')), ('B03', False))
    a.key('Escape'); check('Esc closes it', a.js('D.sideOpen'), False)


GROUPS = [('move', group_move, (1440, 900)), ('act', group_act, (1440, 900)), ('answer', group_answer, (1440, 900)),
          ('write', group_write, (1440, 900)), ('context', group_context, (1440, 900)), ('project', group_project, (1440, 900)),
          ('narrow', group_narrow, (1024, 768))]


def main():
    only = sys.argv[sys.argv.index('-k') + 1] if '-k' in sys.argv else ''
    for name, fn, size in GROUPS:
        a = App(size)
        try:
            fn(a)
            errs = a.js('window.ERR || []')
            check(f'{name}: no script errors', errs, [])
        except Exception as ex:  # a broken step fails its group, the others still run
            RESULTS.append((False, f'{name}: stopped', repr(ex)[:160], 'to finish'))
        finally:
            a.close()
    shown = [r for r in RESULTS if only.lower() in r[1].lower()]
    for ok, name, got, want in shown:
        print(f"{'PASS' if ok else 'FAIL'}  {name}" + ('' if ok else f'\n      got {got!r}, want {want!r}'))
    bad = sum(not r[0] for r in shown)
    print(f'\n{len(shown) - bad} of {len(shown)} passed')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
