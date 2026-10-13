"""B163: whatever the user says after an agent's question answers it, a picked choice or not. The list, the item,
Go through (the page reads `wait` and `reply` from /api/state) and /next all agree."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('taska', Path(__file__).resolve().parents[1] / 'taska.py')
taska = importlib.util.module_from_spec(spec)
spec.loader.exec_module(taska)

QUESTION = 'F1 ask Should dark mode follow the system, or have its own switch?\n  - ( ) Follow the system\n  - ( ) A switch in Settings\n'


class AnswerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.s = taska.Store(str(Path(self.tmp.name) / 'taska.jsonl'))
        self.s.name = 'qa'
        self.do('new feature Dark mode for the reading view', 'you')
        self.do(QUESTION, 'claude-code')
        self.it = self.s.items[1]

    def tearDown(self):
        self.s.out.close()
        self.tmp.cleanup()

    def do(self, text, by, src=None):
        lines, _ = self.s.run_all(taska.parse_dsl(text), by, src=src)
        self.assertTrue(all(x.startswith('ok') for x in lines), lines)

    def op(self, op, by='you', src=None):
        lines, _ = self.s.run_all([(0, op)], by, src=src)
        self.assertTrue(lines[0].startswith('ok'), lines)
        return lines[0].split()[1]

    def view(self):
        """What the page gets for F1 (list, item page, Go through) and what an agent gets."""
        st = next(i for i in self.s.state()['items'] if i['n'] == 1)
        return {'wait': st['wait'] is not None, 'reply': st['reply'], 'line': self.s.line(self.it),
                'waiting_list': self.s.listing({'wait': ['1']}).split('\n')[0], 'next': self.s.next_text()[0]}

    def assertWaiting(self):
        v = self.view()
        self.assertTrue(v['wait'])
        self.assertFalse(v['reply'])
        self.assertTrue(v['line'].endswith(' ?'), v['line'])
        self.assertEqual(v['waiting_list'], '1 items')
        self.assertIn('waiting on the user (skip): F1', v['next'])

    def assertAnswered(self):
        v = self.view()
        self.assertFalse(v['wait'], 'still shows Needs reply')
        self.assertTrue(v['reply'], 'agents are not told the user replied')
        self.assertTrue(v['line'].endswith(' <'), v['line'])
        self.assertEqual(v['waiting_list'], '0 items')
        self.assertNotIn('waiting on the user', v['next'])
        for rid in [r for r, i in self.s.inputs.items() if not i['acked']]:  # once the agent has read the inputs,
            self.do(f'ack {rid}', 'claude-code')  # /next brings the item back to it
        self.assertIn('resume F1: the user replied', self.s.next_text()[0])
        self.assertIn('< the user replied', self.s.card(self.it))

    def test_the_question_waits_on_the_user(self):
        self.assertWaiting()

    def test_a_reply_typed_in_the_box_answers_it(self):
        self.op({'op': 'input', 'text': 'Neither for now: how would a switch work on the phone?', 'scope': 'F1'})
        self.assertAnswered()

    def test_a_picked_choice_answers_it(self):
        self.op({'op': 'input', 'text': '✓ Follow the system', 'scope': 'F1'})
        self.assertAnswered()

    def test_details_added_to_an_earlier_input_answer_it(self):
        rid = self.op({'op': 'input', 'text': 'Dark mode please', 'scope': 'F1'})
        self.do(QUESTION, 'claude-code')
        self.assertWaiting()
        self.op({'op': 'amend', 'id': rid, 'v': 0, 'mode': 'append', 'text': 'Follow the system.'})
        self.assertAnswered()

    def test_an_answer_written_on_the_list_and_filed_here_answers_it(self):
        # Written in the box under the list, so it goes to the whole project; the organizer files it on F1, as the
        # user's words or, as a real organizer run did, as the user's decision. It also marks the input handled, so
        # F1 itself must bring the answer back to the agent.
        for kind in ('decide', 'say', 'propose'):
            with self.subTest(kind=kind):
                self.do(QUESTION, 'claude-code')
                self.assertWaiting()
                rid = self.op({'op': 'input', 'text': 'Dark mode: just follow the system.'})
                self.op({'op': 'say', 'ref': 'F1', 'kind': kind, 'text': 'Follow the system setting.'}, by='org', src=rid)
                self.assertTrue(self.s.inputs[rid]['acked'])
                self.assertAnswered()

    def test_the_organizers_own_notes_and_questions_do_not_answer_it(self):
        rid = self.op({'op': 'input', 'text': 'Night theme is the same thing as dark mode'})
        self.op({'op': 'new', 'title': 'Night theme'}, by='org', src=rid)
        self.op({'op': 'merge', 'ref': 'I2', 'into': 'F1'}, by='org', src=rid)  # "Merged in I2" on F1, from the user's input
        self.op({'op': 'say', 'ref': 'F1', 'kind': 'progress', 'text': 'Checked the old themes'}, by='org')
        self.assertWaiting()
        self.op({'op': 'say', 'ref': 'F1', 'kind': 'ask', 'text': 'Which screens?'}, by='org', src=rid)
        self.assertTrue(self.view()['wait'])

    def test_an_agents_own_words_do_not_answer_it(self):
        self.do('F1 progress Meanwhile I checked the colours.', 'claude-code')
        self.assertWaiting()

    def test_a_new_question_after_the_answer_waits_again(self):
        self.op({'op': 'input', 'text': 'Follow the system.', 'scope': 'F1'})
        self.assertAnswered()
        self.do('F1 ask And the code blocks: dark too?', 'claude-code')
        self.assertWaiting()

    def test_a_withdrawn_question_no_longer_waits(self):
        self.do('F1 withdraw Decided: it follows the system.', 'claude-code')
        self.assertFalse(self.view()['wait'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
