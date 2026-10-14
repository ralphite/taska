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
    a.click('[data-act=unfile]'); a.js("document.activeElement.blur()")  # removed with its X: a kept recording would come back (T101)
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


def group_project(a):  # Settings: one page in the sidebar's place, one section at a time, each at its own address (B162)
    a.go('')
    a.click('#sideFoot [data-act="project"]')
    check('Settings opens from the sidebar, at Agents, in the sidebar\'s place',
          (a.js("location.pathname.split('/').pop()"), a.js("$('projectBody').querySelector('h1').textContent"), a.js("$('drawer').hidden")), ('agents', 'Agents', True))
    a.click('#projectNav [data-sec="log"]')
    check('Each section has its own address', (a.js("location.pathname.split('/').pop()"), a.js("$('projectBody').querySelector('h1').textContent")), ('log', 'Change log'))
    a.js('document.activeElement.blur()'); a.key('Escape', wait=0.8)
    check('Esc leaves Settings at once, back to the list', (a.js('D.page'), a.js("location.pathname.split('/').pop()"), a.js("$('drawer').hidden")), (None, '', False))
    a.key('g', wait=0.1); a.key('s', wait=0.8)
    check('G S opens Settings', a.js('D.page'), 'project')


def group_box(a):  # T113 group 1: the box writes where you started, and keeps the focus while it waits for words
    post = lambda o: json.load(urllib.request.urlopen(urllib.request.Request(a.base + 'api/op', json.dumps(o).encode(), {'Content-Type': 'application/json'})))
    post({'op': 'doc', 'ref': 'F04', 'md': '# Plan\n\nFirst paragraph.\n\nSecond paragraph.'})
    line = lambda: a.js("$('scope').textContent")
    a.go('D1')
    a.click('#docBlocks > section:nth-of-type(2)')
    check('A1: picking a paragraph to comment on puts the focus in the box', a.js('document.activeElement.id'), 'text')
    a.js("$('text').blur()"); a.key('w', wait=0.3)
    check('A1: a letter then is a word, not Won\'t do', (a.js("$('text').value"), status(a, 4)), ('w', 'open'))
    a.enter(1.0, shift=True)
    check('B2: after a comment the box stays in its thread', line(), lambda t: 'Reply in D1' in t)
    a.key('Escape', wait=0.4); a.type('stray words'); n = a.js('S.inputs.length'); a.enter(0.8, shift=True)
    check('B2: with nothing picked the box waits, it does not reply to F04', (line(), a.js('S.inputs.length'), a.js("$('text').value")), (lambda t: 'Comment on D1' in t[0] and t[1] == n and t[2] == 'stray words'))
    a.js("$('text').value = ''; saveDraft()")
    a.go('D1')  # F184: select, speak, select, speak, one send
    sel = "(i => { const n = document.querySelectorAll('#docBlocks > section')[i].querySelector('p') || document.querySelectorAll('#docBlocks > section')[i]; const t = document.createTreeWalker(n, NodeFilter.SHOW_TEXT).nextNode(); const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 5); getSelection().removeAllRanges(); getSelection().addRange(r); })"
    words = "(i => { const f = U.files[i]; f.transcribing = false; f.tr = 'Words ' + i; f.settle(); placeWords(f); renderComposer(); })"
    for i in (1, 2):
        a.js(sel + f'({i})'); time.sleep(0.4)
        check(f'F184: selected text shows Voice comment ({i})', a.js("$('vcBar').hidden ? '' : $('vcBtn').textContent"), 'Voice comment')
        a.click('#vcBtn', 1.5)
        if not a.js('!!R.rec'):  # the microphone was slow to start: once more
            a.js(sel + f'({i})'); time.sleep(0.4); a.click('#vcBtn', 2.0)
        check(f'F184: the same button records ({i})', a.js("[!!R.rec, $('vcBtn').textContent]"), [True, 'Stop'])
        time.sleep(1.0); a.click('#vcBtn', 1.2)  # a note under a second, or with nothing recorded yet, is dropped as too short
        a.js(words + f'({i - 1})')
    check('F184: the quotes and the words wait in the box, unsent', (a.js("vcCount($('text').value)"), a.js('U.files.length'), a.js("$('scope').textContent")), lambda t: t[0] == 2 and t[1] == 2 and '2 comments on D1' in t[2])
    a.click('#text'); a.enter(2.5, shift=True)
    check('F184: one send posts each as a comment on its passage, with its recording', a.js("docById(1).blocks.flatMap(b => b.comments).filter(c => c.files?.length).map(c => c.text + ':' + (c.files || []).length).join('|')"), 'Words 0:1|Words 1:1')
    a.go('B07'); a.key('c', wait=0.8)
    a.js('startRec()'); time.sleep(1.5); a.enter(1.2)  # B185: a voice note on the New input page, stopped into the box
    a.type('About the export')
    check('B185: the note and words are in the New input box, the focus too', (a.js('U.files.length'), a.js("$('text').value"), a.js('document.activeElement.id')), (1, 'About the export', 'text'))
    a.click('#list [data-act="open"][data-n="8"]')
    check('B185: another item opens: its box is its own, and the page says the new input waits', (a.js("$('text').value"), a.js('U.files.length'), a.toast()), (lambda t: t[0] == '' and t[1] == 0 and 'kept' in t[2]))
    a.go('F08')
    check('B185: after a reload the voice note is back in the New input box, not in F08\'s', (a.js('U.files.length'), a.js("(U.parked.new || []).length")), (0, 1))
    a.js("$('toast').hidden = true"); a.click('#scope [data-act="new-input-instead"]')
    check('B185, A8: New input instead brings the words and the voice note back', (a.js('D.compose'), a.js("$('text').value"), a.js('U.files.length')), (True, 'About the export', 1))
    a.js("U.files.forEach(f => { f.gone = true; dropRec(f, false); }); U.files = []; $('text').value = ''; saveDraft(); renderComposer()")
    a.go('F08'); a.click('#text'); a.type('For everyone')
    a.js("$('toast').hidden = true"); a.click('#scope [data-act="new-input-instead"]')
    check('A8: New input instead carries the words', a.js("$('text').value"), 'For everyone')
    a.click('#toast button', 1.0)
    check('A8: Undo puts them back on F08', (open_(a), a.js("$('text').value"), a.js("draftStore().new || ''")), ('F08', 'For everyone', ''))
    a.js("$('text').value = ''; saveDraft()")
    a.go('T13'); a.js("$('text').blur()"); a.key('v', wait=1.5); a.key('j', wait=0.6)
    check('B1: moved on while recording, the line says where the note goes', line(), lambda t: 'Recording for T13' in t)
    a.enter(1.2)
    check('B1: stopped elsewhere, the note goes into T13\'s box', (a.js('U.files.length'), a.js("(U.parked.T13 || []).length")), (0, 1))
    a.js("U.parked.T13.forEach(f => { f.gone = true; dropRec(f, false); }); delete U.parked.T13")
    a.go(''); a.key('J', wait=0.8); a.click('#text'); a.type('Check the header row'); a.enter(1.2, shift=True)
    check('A2: a reply while going through stays on its item, focus in the box', (open_(a), a.js('document.activeElement.id'), a.js('U.go.done.has(3)')), ('B03', 'text', True))
    a.key('Escape'); a.key('Escape')
    a.go('B03'); a.click('#text'); a.type('Add a test for three filters')
    a.click('#detailBody [data-act="status"][data-v="done"]', 1.2)
    check('B4: Accept sends the note with it', (status(a, 3), a.js("S.inputs.at(-1).text"), a.js("$('text').value")), ('done', 'Add a test for three filters', ''))
    a.go('D1'); a.key('c', wait=0.8)
    check('B14: C on a document opens the New input page, Back to D1', (a.js('location.pathname.split("/").pop()'), a.js("$('dNav').textContent")), lambda t: t[0] == 'new' and 'Back to D1' in t[1])
    a.key('Escape', wait=0.8)
    check('B14: Esc goes back to the document', (a.js('U.doc'), a.js('location.pathname.split("/").pop()')), (1, 'D1'))
    a.go('new')  # I176 + F186: the draft card, its toggles, a word corrected in place
    a.js("""(() => { const f = voiceFile({name: 'voice 0-09.webm', mime: 'audio/webm', ms: 9000, blob: new Blob(['x'], {type: 'audio/webm'}), at: 0, key: U.draftKey, scope: null});
      U.files.push(f); f.transcribing = false; f.tr = 'Move the sub project filter up and stop the notices'; f.doubts = [{was: 'sub project filter', alt: 'subproject filter', show: ['sub project', 'subproject']}];
      f.settle(); placeWords(f); renderComposer(); })()""")
    check('I176: the draft shows on the New input page, the box points to it', (a.js("$('draftText')?.textContent"), a.js("$('doubts').textContent")), lambda t: 'stop the notices' in t[0] and '1 word may be misheard' in t[1])
    a.click('#draftText [data-act="doubt-pick"][data-side="alt"]', 0.5)
    check('F186: a pick changes the box, and can be switched back', (a.js("$('text').value"), a.js("$('doubts').hidden")), ('Move the subproject filter up and stop the notices', True))
    a.click('#draftText [data-act="doubt-pick"][data-side="was"]', 0.5)
    check('F186: switched back', a.js("$('text').value"), 'Move the sub project filter up and stop the notices')
    a.click('#text'); a.js("const t = $('text'); t.selectionStart = t.selectionEnd = t.value.length"); a.type(' Again: sub project filter.')
    check('F186: a word that is in the text twice is a toggle in both places', a.js("document.querySelectorAll('#draftText [data-tog]').length"), 2)
    a.js("document.querySelector('#draftText [data-tog] [aria-pressed=true]').focus()"); a.key('ArrowRight', wait=0.4)
    check('F186: → picks the other word in every place, and the toggle keeps the focus', (a.js("$('text').value"), a.js("document.activeElement.dataset.side")),
          ('Move the subproject filter up and stop the notices Again: subproject filter.', 'alt'))
    a.key('1', wait=0.4)
    check('F186: 1 picks the main word again', a.js("$('text').value"), 'Move the sub project filter up and stop the notices Again: sub project filter.')
    a.key('Escape', wait=0.4)
    check('F186: Esc goes back to the box, still on New input', (a.js('document.activeElement.id'), a.js('D.compose')), ('text', True))
    a.js("$('text').value = 'Move the sub project filter up and stop the notices'; saveDraft(); renderComposer()")
    a.js("""(() => { const sp = [...document.querySelectorAll('#draftText [data-v]')].find(s => s.textContent.includes('notices')); const n = sp.firstChild, i = n.data.indexOf('notices'); const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 7); getSelection().removeAllRanges(); getSelection().addRange(r); draftFix(); })()""")
    a.type('notifications'); a.enter(1.2)
    check('I176: a word corrected in the card: the box follows and the spelling is kept', (a.js("$('text').value"), a.toast()), lambda t: t[0].endswith('stop the notifications') and 'Remembered' in t[1])
    a.js("U.files.forEach(f => { f.gone = true; dropRec(f, false); }); U.files = []; $('text').value = ''; saveDraft(); renderComposer()")
    a.go('spellings'); a.click('[data-act="prefs-edit"]')  # F183: transcription preferences, edited in the one box
    check('F183: Edit puts the preferences into the box', (a.js("$('foot').hidden"), a.js("$('scope').textContent"), a.js("$('text').value.startsWith('Chinese in Simplified')")), lambda t: not t[0] and 'Edit transcription preferences' in t[1] and t[2])
    a.js("const t = $('text'); t.selectionStart = t.selectionEnd = t.value.length"); a.type('\nTimes on a 24-hour clock.'); a.enter(1.2, shift=True)
    check('F183: Save keeps them for every project', a.js("fetch('/api/voiceprefs').then(r => r.json()).then(d => d.text.endsWith('24-hour clock.') && !d.default)"), True)
    a.go('rules'); a.key('c', wait=0.8)
    check('B10: New rule has its own address', a.js('location.pathname.split("/").pop()'), 'new-rule')
    a.go('new-rule')
    check('B10: a reload stays a new rule', a.js("$('dHead').textContent"), 'New rule')


def group_narrow(a):
    a.go('B03')
    a.key('['); check('[ at 1024 opens the sidebar over the page', a.js('D.sideOpen'), True)
    a.key('j'); a.key('f'); check('Keys do not reach behind it', (open_(a), a.js('D.filters')), ('B03', False))
    check('and say why', a.toast(), 'The sidebar is over the page: [ closes it')
    a.key('Escape'); check('Esc closes it', a.js('D.sideOpen'), False)


def post(a, path, body):
    req = urllib.request.Request(a.base + path, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    return json.loads(urllib.request.urlopen(req, timeout=10).read())


def group_unseen(a):  # T113 group 3: keys act on what you see, and say why when they can't
    post(a, 'api/op', {'op': 'doc', 'ref': 'F06', 'md': '# Rollout plan\n\nStaging first, then everyone.'})
    a.go('D1', 3)
    when, st = a.js('byN.get(6).when'), status(a, 6)
    for k in ('l', 'd', '.', 'j'):
        a.key(k, wait=0.4)
    check('On a document, item keys leave its item alone and say so', (a.js('byN.get(6).when'), status(a, 6), a.js("$('overlay').hidden"), a.js('U.doc'), a.toast()), (when, st, True, 1, 'Back to F06 first: Esc'))
    a.key('o', wait=0.8); check('O shows the document full width', (a.js('D.full'), a.js('U.doc'), a.js("location.pathname.split('/').pop()")), (True, 1, 'D1'))
    a.key('Escape', wait=0.8); check('Esc leaves full width first, the document stays', (a.js('D.full'), a.js('U.doc')), (False, 1))
    a.key('i', wait=0.8); check('I edits the document', (a.js('U.docEdit'), a.js("!!$('docMd')")), (True, True))
    a.click('[data-act="doc-discard"]', 0.8); a.js('document.activeElement.blur()')
    a.key('Escape', wait=0.8); check('Esc goes back to its item', (a.js('U.doc'), open_(a)), (None, 'F06'))
    a.go('F04')
    a.key('d', wait=0.5); a.key('w', wait=0.5)
    check("D and W leave an item that waits for your answer, as its hover does", (status(a, 4), a.toast()), ('open', 'F04 waits for your answer: A answers it'))
    a.go('R10')
    a.key('d', wait=0.5); check('On a rule, D says it is active already', a.toast(), 'R10 is active already')
    a.key('w', wait=1.2); check('W retires a rule, in its words', (status(a, 10), a.toast()), ('dropped', 'R10 is retiredUndo'))
    a.key('d', wait=1.2); check('D makes it active again', (status(a, 10), a.toast()), ('open', 'R10 is active againUndo'))
    a.go('B07')
    a.key('p', wait=0.6)
    check('P opens the menu at Priority, the keys in it', (a.js('U.menuArm'), a.js("document.activeElement.dataset.f"), a.js("$('dlgBody').contains(document.activeElement)")), ('p', 'pri', True))
    a.key('1', wait=1.0); check('then 1 sets P1, and the menu stays', (a.js('byN.get(7).pri'), a.js('U.sheet'), a.js("document.activeElement.dataset.v")), ('P1', 'menu', 'P1'))
    a.key('s', wait=0.5); a.key('3', wait=1.0); check('S then 3 sets In progress', status(a, 7), 'doing')
    a.key('t', wait=0.5); a.key('i', wait=1.2); check('T then I sets Idea, it does not open Edit', (a.js('byN.get(7).type'), a.js('U.editing')), ('idea', None))
    a.key('b', wait=1.2); check('then B sets Bug', a.js('byN.get(7).type'), 'bug')
    for k in ('ArrowDown', 'ArrowDown', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab'):
        a.key(k, wait=0.05)
    check('The arrows and Tab move in the menu and never leave it', a.js("$('dlgBody').contains(document.activeElement)"), True)
    a.key('Escape', wait=0.5); a.key('z', wait=1.2); a.key('z', wait=1.2); a.key('z', wait=1.2); a.key('z', wait=1.2); a.key('z', wait=1.2)
    check('Z undoes each of them', (status(a, 7), a.js('byN.get(7).pri'), a.js('byN.get(7).type')), ('open', 'P0', 'bug'))
    a.js("document.querySelector('#list').dispatchEvent(new PointerEvent('pointerleave'))"); time.sleep(3.5)
    a.key('l', wait=0.4)
    check('L holds the row in place as the hover button does', a.js("!!document.querySelector('#list article[data-n=\"7\"][data-settled]')"), True)
    time.sleep(3.5); check('and lets it go after 3 s', a.js("!!document.querySelector('#list article[data-n=\"7\"][data-settled]')"), False)
    a.key('l', wait=1.0)
    tips = lambda n: a.js(f"""[...document.querySelectorAll('#list [data-act="open"][data-n="{n}"] button[title]')].map(b => b.title)""")
    check('Start, Pause and Reopen say their keys', ['Start · S then 3' in tips(8), 'Pause · S then 2' in tips(6), 'Reopen · S then 2' in tips(2)], [True, True, True])
    a.go('')
    a.key('d', wait=0.4); check('With nothing picked, an item key says so', a.toast(), 'First pick an item: J or a click')
    a.key('j', wait=0.6); a.key('k', wait=0.5); check('K on the first row says so', a.toast(), 'This is the first item')
    a.go('B02'); a.key('d', wait=0.4); check('D on a done item says so', a.toast(), 'B02 is done already')
    a.key('g', wait=0.1); a.key('n', wait=0.8)
    a.key('j', wait=0.4); check('J on Inputs says where it works', a.toast(), 'J and K move in Items, Archive and Rules')
    a.key('f', wait=0.4); check('F on Inputs says where it works', a.toast(), 'Filters work in Items, Archive and Rules')
    a.go('log', 3); a.js('document.activeElement.blur()')
    a.key('j', wait=0.4); check('J in This project says why not', a.toast(), 'J and K move in a list: Esc goes back to it')
    a.key('/', wait=0.4); check('/ in This project says why not', a.toast(), 'Search works on a list: Esc goes back to it')


def group_walk(a):  # T113 group 4: Go through keeps its place, ends with what you did, says what a filter hides
    strip = lambda: a.js("$('goStrip').hidden ? '' : [...$('goStrip').children].map(e => e.textContent.trim()).filter(Boolean).join(' ')")
    a.go('B03'); a.key('J', wait=0.8)
    check('Shift+J starts at the first that needs you', (open_(a), strip().startswith('Needs you 1 of 4')), ('B03', True))
    a.click('#list [data-act="open"][data-n="8"]', 0.8)
    check('Another item: Go through waits, and says where you left off', (a.js('!!U.go'), strip().startswith('Going through paused at 1 of 4')), (True, True))
    a.key('J', wait=0.8); check('Shift+J goes back there, not to the start', (open_(a), strip().startswith('Needs you 1 of 4')), ('B03', True))
    a.key('J', wait=0.8); check('Shift+J goes on', open_(a), 'F04')
    a.key('g', wait=0.1); a.key('a', wait=0.8); a.key('g', wait=0.1); a.key('i', wait=0.8)
    check('A trip to Archive keeps it', (a.js('!!U.go'), open_(a), strip().startswith('Needs you 2 of 4')), (True, 'F04', True))
    for keys in (('.', 'Escape'), ('c', 'Escape'), ('i', 'Escape'), ('A', 'Escape')):
        for k in keys:
            a.key(k, wait=0.6)
        a.js('document.activeElement.blur()')
    check('The menu, New input, Edit and a subitem keep it', a.js('!!U.go'), True)
    a.key('J', wait=0.8)
    a.go(a.js("location.pathname.split('/').pop()"), 3)
    check('A reload keeps it, where you were', (a.js('!!U.go'), strip().startswith('Needs you')), (True, True))
    while open_(a) != 'I05' and a.js('!!U.go'):
        a.key('J', wait=0.8)
    a.key('J', wait=0.8)
    check('Skip on the last one ends it, and says what is left', (a.js('!!U.go'), a.toast()), (False, 'That was the last one · 0 settled · 4 still need you'))
    a.go('B03'); a.key('J', wait=0.8); a.key('a', wait=1.5)
    check('Settling one goes to the next', (status(a, 3), open_(a)), ('done', 'F04'))
    a.click('#text'); a.type('Follow the system, please'); a.enter(1.5, shift=True)
    check('A reply settles it, and the box stays on it (A2, B146)', (open_(a), a.js('U.go.done.has(4)'), a.js('document.activeElement.id')), ('F04', True, 'text'))
    a.key('Escape', wait=0.4); check('Esc leaves the box, Go through goes on', a.js('!!U.go'), True)
    a.key('J', wait=0.8); check('Shift+J goes to the next', open_(a), 'T14')
    a.key('Escape', wait=0.6); check('Esc ends it, with what you settled', (a.js('!!U.go'), a.toast()), (False, 'Stopped going through · 2 settled · 2 still need you'))
    a.go('?type=task', 3); a.key('J', wait=1.0)
    check('Under a filter it says what the filter hides', (open_(a), a.toast(), 'more hidden by your filter' in strip()), ('T14', 'Going through the 1 your filter shows · 1 more needs you', True))
    a.key('Escape', wait=0.6)
    a.click('#list [data-act="open"][data-n="12"]', 0.8)
    post(a, 'api/op', {'op': 'set', 'ref': 'T12', 'f': {'type': 'bug'}}); time.sleep(2.0)
    check('The open item left the list', a.js("!!document.querySelector('#list [data-act=open][data-n=\"12\"]')"), False)
    a.key('j', wait=0.8); check('J goes on from where it was, not from the top', open_(a), 'T13')


def group_tabs(a):  # T113 group 7: two tabs show one draft; a draft sent in one leaves the other; rows say "Draft"
    send = lambda p: (p.call('Input.dispatchKeyEvent', type='rawKeyDown', key='Enter', code='Enter', windowsVirtualKeyCode=13, modifiers=4),
                      p.call('Input.dispatchKeyEvent', type='keyUp', key='Enter', code='Enter', windowsVirtualKeyCode=13, modifiers=4), time.sleep(1.5))
    mark = lambda p, n: p.js(f"!!document.querySelector('#list article[data-n=\"{n}\"] [data-draft]')")
    a.go('F06'); a.click('#text'); a.type('Check the Android build too', 0.6)
    b = a.p.new_tab()
    try:
        b.go(a.base + 'F06', 3)
        check('Tab B: the draft from tab A is in the box', b.js("$('text').value"), 'Check the Android build too')
        check('Tab B: its row and its project say Draft', (mark(b, 6), b.js("!!document.querySelector('#drawerList [aria-current=page] [data-draft]')")), (True, True))
        send(a.p)
        check('Sent in tab A: tab B\'s box is empty, and it says why', (b.js("$('text').value"), b.js("$('toast').hidden ? '' : $('toast').textContent.trim()")), ('', 'Your reply to F06 was sent from another tab'))
        b.js("$('text').focus()"); send(b)
        sent = json.loads(urllib.request.urlopen(a.base + 'api/state', timeout=5).read())['inputs']
        check('It went once, not twice', sum('Android build' in (r.get('text') or '') for r in sent), 1)
        check('No Draft mark once it went', mark(b, 6), False)
        b.js("$('text').focus()"); b.call('Input.insertText', text='also '); time.sleep(0.6)
        check('Typing in tab B shows in tab A as you type', a.js("$('text').value"), 'also ')
    finally:
        b.close()


GROUPS = [('move', group_move, (1440, 900)), ('act', group_act, (1440, 900)), ('answer', group_answer, (1440, 900)),
          ('write', group_write, (1440, 900)), ('box', group_box, (1440, 900)), ('context', group_context, (1440, 900)), ('project', group_project, (1440, 900)),
          ('unseen', group_unseen, (1440, 900)), ('walk', group_walk, (1440, 900)), ('tabs', group_tabs, (1440, 900)), ('narrow', group_narrow, (1024, 768))]


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
