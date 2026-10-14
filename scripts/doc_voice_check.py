#!/usr/bin/env python3
"""F208: speak into a document where the caret is, for real. Starts its own Taska on a copy of tests/fixtures with
the login shell's environment (the real transcription models), makes a spoken sentence with `say`, feeds it to
headless Chrome as the microphone, and in the document editor: puts the caret between two words, presses Speak,
stops, waits for the words and checks they landed at the caret; then Save keeps them.
    python3 scripts/doc_voice_check.py
"""
import json
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from cdp import Page
from keys_check import free_port

REPO = Path(__file__).resolve().parents[1]
SAY = ('Tingting', '\u8fd9\u662f\u8bed\u97f3\u8f93\u5165\u6d4b\u8bd5\u3002\u6587\u5b57\u5e94\u8be5\u51fa\u73b0\u5728\u5149\u6807\u6240\u5728\u7684\u4f4d\u7f6e\u3002')
HEARD = '\u5149\u6807'  # a word the sentence has: the words came back
SHOTS = REPO / '.mocks' / 'f208'  # screenshots of the editor, kept out of git


def main():
    ok = True
    check = lambda name, good: print(('PASS  ' if good else 'FAIL  ') + name) or good
    with tempfile.TemporaryDirectory(prefix='taska-docvoice-') as root:
        shutil.copytree(REPO / 'tests' / 'fixtures' / 'my-app', Path(root) / 'my-app')
        aiff, wav = Path(root) / 'say.aiff', Path(root) / 'say.wav'
        subprocess.run(['say', '-v', SAY[0], '-o', str(aiff), SAY[1]], check=True)
        subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@48000', '-c', '1', str(aiff), str(wav)], check=True)
        port = free_port()
        cmd = f"exec {sys.executable} {REPO / 'taska.py'} --host 127.0.0.1 --port {port} --root {root} --organizer off"
        srv = subprocess.Popen(['zsh', '-ic', cmd], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)  # the login shell has the model keys
        origin = f'http://127.0.0.1:{port}'
        p = None
        try:
            time.sleep(2)
            p = Page(size=(1440, 900), port=free_port(), flags=('--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
                                                              f'--use-file-for-fake-audio-capture={wav}%noloop', '--no-sandbox'))  # Chrome's sandbox keeps the file from the fake microphone
            p.call('Browser.grantPermissions', origin=origin, permissions=['audioCapture'])
            p.go(origin + '/p/my-app/', wait=4)
            n = p.js("S.items.filter(i => !i.parent)[0].n")
            p.js("window.NETLOG = []; { const was = fetch; window.fetch = async (...a) => { const r = await was(...a); if (/api\\/(file|transcript)/.test(String(a[0]))) r.clone().text().then(t => NETLOG.push(r.status + ' ' + t.slice(0, 300))); return r; }; }")
            p.js(f"newDoc({n})")
            time.sleep(0.5)
            p.js("(() => { const t = $('docMd'); t.value = 'Voice title\\n\\nBEFORE AFTER'; const at = t.value.indexOf(' AFTER'); t.focus(); t.setSelectionRange(at, at); })()")
            p.js("ACT['doc-mic']()")
            time.sleep(1.5)
            ok &= check('Speak marks the place at the caret', '\u27e6' in p.js("$('docMd').value") and p.js("$('docMic').hasAttribute('data-on')"))
            ok &= check('the button says Stop while it listens', p.js("$('docMic').textContent").startswith('Stop'))
            SHOTS.mkdir(parents=True, exist_ok=True)
            p.shot(str(SHOTS / '1-listening.png'))
            time.sleep(5)
            p.js("ACT['doc-mic']()")
            words = ''
            for _ in range(60):
                time.sleep(1)
                v = p.js("$('docMd').value")
                if '\u27e6' not in v:
                    words = v
                    break
            print('  editor now:', json.dumps(words, ensure_ascii=False))
            if HEARD not in words:
                print('  toast:', p.js("$('toast').textContent"))
                print('  network:', json.dumps(json.loads(p.js("JSON.stringify(NETLOG)")), ensure_ascii=False))
            ok &= check('the words came back', HEARD in words)
            p.shot(str(SHOTS / '2-words-in.png'))
            ok &= check('they are where the caret was', words.startswith('Voice title\n\nBEFORE') and words.endswith(' AFTER')
                        and HEARD in words.split('BEFORE', 1)[1].rsplit('AFTER', 1)[0])
            p.js("ACT['doc-done']()")
            time.sleep(2)
            docs = json.loads(p.js(f"JSON.stringify(docsOf({n}).map(d => noteText(d)))"))
            ok &= check('Save keeps them', any(HEARD in d and '\u27e6' not in d for d in docs))
            # Save while the words are still coming: it waits for them
            p.js(f"newDoc({n})")
            time.sleep(0.5)
            p.js("(() => { const t = $('docMd'); t.value = 'Second\\n\\n'; t.focus(); t.setSelectionRange(t.value.length, t.value.length); })()")
            p.js("ACT['doc-mic']()")
            time.sleep(6)
            p.js("ACT['doc-done']()")
            for _ in range(60):
                time.sleep(1)
                docs = json.loads(p.js(f"JSON.stringify(docsOf({n}).map(d => noteText(d)))"))
                if any(d.startswith('Second') for d in docs):
                    break
            second = [d for d in docs if d.startswith('Second')]
            print('  saved:', json.dumps(second, ensure_ascii=False))
            ok &= check('Save during the words waits for them', bool(second) and '\u27e6' not in second[0] and len(second[0]) > len('Second'))
        finally:
            if p:
                p.close()
            srv.terminate()
            srv.wait(5)
    print('all passed' if ok else 'some failed')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
