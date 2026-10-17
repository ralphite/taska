"""Every button's action is defined once (B250): a second definition of the same name in ACT silently replaces the first,
so one button stops working with no error ("Needs you" in the sidebar did, for a day). And every action a button names
has a definition, so no button does nothing."""
import collections
import re
import unittest
from pathlib import Path

SRC = (Path(__file__).resolve().parents[1] / 'taska.py').read_text(encoding='utf-8')
PAGE = SRC[SRC.index("PAGE = r'''"):]


def act_names():
    start = PAGE.index('const ACT = {')
    body = PAGE[start:PAGE.index('\n};', start)]
    return re.findall(r"^  '?([a-zA-Z][\w-]*)'?\s*[:(,]", body, re.M)


class ActionTests(unittest.TestCase):
    def test_each_action_is_defined_once(self):
        twice = [k for k, n in collections.Counter(act_names()).items() if n > 1]
        self.assertEqual(twice, [], 'defined more than once in ACT: the later one replaces the earlier')

    def test_each_button_action_is_defined(self):
        used = set(re.findall(r'data-act="([a-z][\w-]*)"', PAGE)) | set(re.findall(r"boxBtn\(\w+, '([a-z][\w-]*)'", PAGE))
        self.assertEqual(sorted(used - set(act_names())), [], 'buttons name these actions, but ACT has no such action')


if __name__ == '__main__':
    unittest.main()
