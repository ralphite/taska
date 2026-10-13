"""Undoing what you did on the page (T113): every change can be put back, and only while nothing else changed it."""
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('taska', Path(__file__).resolve().parents[1] / 'taska.py')
taska = importlib.util.module_from_spec(spec)
spec.loader.exec_module(taska)


class UndoTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / 'taska.jsonl'
        self.s = taska.Store(str(self.path))
        self.s.name = 'qa'

    def tearDown(self):
        self.s.out.close()
        self.tmp.cleanup()

    def run_op(self, op, by='you', ok=True):
        lines, _ = self.s.run_all([(0, op)], by)
        self.assertEqual(lines[0].startswith('ok'), ok, lines)
        return lines[0]

    def replayed(self):
        again = taska.Store(str(self.path))
        again.out.close()
        return again

    def test_make_item_can_be_undone(self):  # A7: "Make item", then Undo or Z
        self.run_op({'op': 'input', 'text': 'Show the version in Settings'})
        self.run_op({'op': 'new', 'title': 'Show the version in Settings', 'src': 'r1'})
        self.assertTrue(self.s.inputs['r1']['acked'])
        self.run_op({'op': 'unmake', 'ref': 'I1'})
        it, inp = self.s.items[1], self.s.inputs['r1']
        self.assertEqual((it['status'], it['archived']), ('dropped', True))
        self.assertEqual((inp['acked'], inp['touched']), (False, []))
        again = self.replayed()
        self.assertEqual((again.items, again.inputs), (self.s.items, self.s.inputs))
        self.assertIn('unmade', self.s.log(5))

    def test_make_item_undo_only_while_nothing_else_happened(self):
        self.run_op({'op': 'input', 'text': 'Show the version in Settings'})
        self.run_op({'op': 'new', 'title': 'Show the version in Settings', 'src': 'r1'})
        self.run_op({'op': 'say', 'ref': 'I1', 'kind': 'progress', 'text': 'Started'}, 'codex')
        self.assertIn('changed since', self.run_op({'op': 'unmake', 'ref': 'I1'}, ok=False))
        self.assertEqual(self.s.items[1]['status'], 'open')

    def test_archive_many_in_one_change(self):  # A5: "Archive N" stopped at 50 and left 50 lines in the log
        for k in range(60):
            self.run_op({'op': 'new', 'title': f'Finished {k}', 'status': 'done'})
        self.run_op({'op': 'new', 'title': 'Still open'})
        before = len(self.s.events)
        line = self.run_op({'op': 'archive', 'refs': [f'I{k}' for k in range(1, 62)], 'on': True})
        self.assertEqual(line, 'ok archived 60; not finished, so not archived: I61')
        self.assertEqual(len(self.s.events), before + 1)  # one change
        self.assertTrue(all(self.s.items[k]['archived'] for k in range(1, 61)))
        self.assertFalse(self.s.items[61]['archived'])
        self.assertIn('archived 60: I01 I02', self.s.log(1))
        self.run_op({'op': 'archive', 'refs': [f'I{k}' for k in range(1, 61)], 'on': False})  # its Undo
        self.assertFalse(any(self.s.items[k]['archived'] for k in range(1, 61)))
        again = self.replayed()
        self.assertEqual(again.items, self.s.items)

    def file_r1(self):  # the organizer files r1: a new item F2, and a priority on F1
        self.run_op({'op': 'new', 'title': 'Export as CSV', 'type': 'feature', 'pri': 'P2'})
        self.run_op({'op': 'input', 'text': 'Excel export too, and CSV export is urgent'})
        with patch.object(taska, 'gemini', return_value='new feature P2 Export as Excel\nF1 P0'):
            taska.Organizer(self.s).process(self.s.inputs['r1'])
        self.assertTrue(self.s.inputs['r1']['acked'])

    def test_undo_filing_says_what_and_comes_back(self):  # A4
        self.file_r1()
        f = self.s.filings()['r1']
        self.assertEqual(f, {'can': True, 'why': '', 'what': 'removes F2 · F1 back to P2'})
        with self.s.lock:
            self.s.emit({'k': 'undo', 'src': 'r1', 'by': 'you'})
        self.assertEqual((self.s.items[2]['status'], self.s.items[2]['archived'], self.s.items[1]['pri']), ('dropped', True, 'P2'))
        self.assertIsNone(self.s.redo_blocked('r1'))
        with self.s.lock:  # Z: the filing comes back
            self.s.emit({'k': 'redo', 'src': 'r1', 'by': 'you'})
        self.assertEqual((self.s.items[2]['status'], self.s.items[2]['archived'], self.s.items[1]['pri']), ('open', False, 'P0'))
        self.assertTrue(self.s.inputs['r1']['acked'])
        self.assertFalse(self.s.inputs['r1']['org'].get('undone'))
        self.assertTrue(self.s.filings()['r1']['can'])  # and it can be undone again
        again = self.replayed()
        self.assertEqual((again.items, again.inputs), (self.s.items, self.s.inputs))

    def test_no_undo_filing_once_its_work_changed(self):  # A4: undo turned items finished since into won't do
        self.file_r1()
        self.run_op({'op': 'set', 'ref': 'F2', 'f': {'status': 'done'}}, 'codex')
        f = self.s.filings()['r1']
        self.assertEqual((f['can'], f['why']), (False, 'F2 changed since'))

    def test_no_redo_once_its_items_changed(self):
        self.file_r1()
        with self.s.lock:
            self.s.emit({'k': 'undo', 'src': 'r1', 'by': 'you'})
        self.run_op({'op': 'set', 'ref': 'F1', 'f': {'pri': 'P1'}})
        self.assertEqual(self.s.redo_blocked('r1'), 'F1 changed since the filing was undone')

    def test_only_items_made_from_an_input(self):
        self.run_op({'op': 'new', 'title': 'Typed in by hand'})
        self.assertIn('not made from an input', self.run_op({'op': 'unmake', 'ref': 'I1'}, ok=False))


if __name__ == '__main__':
    unittest.main(verbosity=2)


class VoiceEventTests(unittest.TestCase):
    """A voice note's "tr" event carries its file name in "f", not a dict of fields: the page state must still build."""

    def test_state_builds_with_a_transcript_event(self):
        with tempfile.TemporaryDirectory() as d:
            s = taska.Store(str(Path(d) / 'taska.jsonl'))
            s.name = 'qa'
            s.run_all(taska.parse_dsl('new bug A crash'), 'you')
            with s.cond:
                s.emit({'k': 'in', 'id': 'r9', 'by': 'you', 'text': '', 'scope': None, 'files': [{'f': 'f1-voice.webm', 'name': 'voice.webm', 'mime': 'audio/webm', 'size': 1}]})
                s.emit({'k': 'tr', 'src': 'r9', 'f': 'f1-voice.webm', 'tr': 'hello', 'by': 'you'})
            self.assertEqual(len(s.state()['items']), 1)
            s.out.close()
