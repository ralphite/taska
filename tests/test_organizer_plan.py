"""The organizer's plan from the model, as the command language reads it (B623)."""

import unittest

from taska.agent_text.language import parse
from taska.services.organizer import indent_strays
from taska.domain.vocab import Refused

# what the model answered for r894 on 10-30: the body's second line was not indented
B623 = "T622 P0\nT622 body \u8fd9\u79cd more finished \u5220\u6389\u3002\n\u8fd9\u4e2a\u6539\u6210 P0\u3002\npass"


class IndentStrays(unittest.TestCase):
    def test_a_body_over_two_lines_is_one_body(self):
        got = parse(indent_strays(B623).replace("\npass", ""))
        self.assertFalse([c for _, c in got if isinstance(c, Refused)])
        body = [c for _, c in got if c.get("op") == "set"][-1]["f"]["body"]
        self.assertTrue(body.endswith("\u8fd9\u4e2a\u6539\u6210 P0\u3002"), body)

    def test_commands_stay_commands(self):
        plan = "new bug P1 now Title\n  body\nB03 P0\nack r12\npass"
        self.assertEqual(indent_strays(plan), plan)

    def test_a_stray_after_a_command_without_text_is_left_to_fail(self):
        # nothing takes it: the run reports it rather than dropping the words
        self.assertEqual(indent_strays("B03 P0\nwords"), "B03 P0\nwords")

    def test_new_and_say_take_the_following_lines(self):
        plan = "B03 say first\nsecond\nnew task P2 now T\nits body"
        self.assertEqual(indent_strays(plan), "B03 say first\n  second\nnew task P2 now T\n  its body")


if __name__ == "__main__":
    unittest.main()
