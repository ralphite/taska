"""T814 (r1377, from the T805 brainstorm): a done report says what the agent checked itself and the proof, and leaves
the user only what is theirs to judge, never steps to prove it works. Change only on Yadong's explicit word."""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.agent_text import guide_text  # noqa: E402


class DoneReport(unittest.TestCase):
    def test_it_brings_the_proof_and_leaves_only_judgement(self) -> None:
        g = " ".join(guide_text.AGENT.split())
        for part in ("Result", "Checked (what you checked yourself", "Left for you", "What changed"):
            self.assertIn(part, g)
        self.assertIn("never steps for them to prove it works", g)
        self.assertNotIn("How to check", g)


if __name__ == "__main__":
    unittest.main()
