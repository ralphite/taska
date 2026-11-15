"""F817 (r1384): a table right under a line of text in a document is a table of its own (it showed as raw | lines,
part of the text's paragraph); after a list too."""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.domain.markdown import blocks  # noqa: E402

TABLE = "| 级别 | 谁主导 |\n|---|---|\n| E4 | 前半段自己主导 |"


class TableBlocks(unittest.TestCase):
    def test_a_table_under_a_line_of_text(self) -> None:
        got = blocks("**级别阶梯**【第三方】\n" + TABLE + "\n\n下一段")
        self.assertEqual([(b.kind, b.text) for b in got], [("para", "**级别阶梯**【第三方】"), ("table", TABLE), ("para", "下一段")])

    def test_a_table_under_a_list(self) -> None:
        got = blocks("- one\n- two\n" + TABLE)
        self.assertEqual([b.kind for b in got], ["list", "table"])

    def test_pipes_without_an_alignment_row_stay_text(self) -> None:
        self.assertEqual([b.kind for b in blocks("a line\n| not a table |\nmore")], ["para"])


if __name__ == "__main__":
    unittest.main()
