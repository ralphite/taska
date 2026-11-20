"""r1450 (Yadong, 11-20, on T848: "release 自带这些 skill"): Taska comes with its skills. A data folder that has never
had one gets it, with its text, added by Taska; one here already (changed or not) stays as it is; one added before and
then renamed does not come back; starting again adds nothing. Change these only on Yadong's explicit word."""

from __future__ import annotations

import importlib.resources
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.services.workspace import Workspace  # noqa: E402

COMES_WITH = sorted("/" + f.name[:-3] for f in importlib.resources.files("taska").joinpath("default_skills").iterdir() if f.name.endswith(".md"))


class DefaultSkills(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.ws = Workspace(self.tmp.name)

    def tearDown(self) -> None:
        self.ws.close()
        self.tmp.cleanup()

    def test_new_data_gets_every_skill_taska_comes_with_once(self) -> None:
        self.assertIn("/qa", COMES_WITH)
        self.assertEqual(sorted(self.ws.shared_rules.seed()), COMES_WITH)
        qa = importlib.resources.files("taska").joinpath("default_skills/qa.md").read_text(encoding="utf-8")
        self.assertEqual(self.ws.skills()["/qa"], qa.strip())
        self.assertEqual(self.ws.shared_rules.seed(), [])
        self.ws.close()
        self.ws = Workspace(self.tmp.name)  # started again
        self.assertEqual(self.ws.shared_rules.seed(), [])
        self.assertEqual(sorted(self.ws.skills()), COMES_WITH)

    def test_a_skill_here_already_is_kept_and_one_renamed_does_not_come_back(self) -> None:
        mine = self.ws.shared_rules.add("/qa")
        mine.run([(0, {"op": "rules", "md": "My own words."})], "you")
        self.ws.shared_rules.seed()
        self.assertEqual(self.ws.skills()["/qa"], "My own words.")
        why = next(p for p in self.ws.shared_rules.rules.values() if p.title == "/why")
        why.run([(0, {"op": "cfg", "name": "/reason"})], "you")
        self.assertEqual(self.ws.shared_rules.seed(), [])
        self.assertNotIn("/why", self.ws.skills())


if __name__ == "__main__":
    unittest.main()
