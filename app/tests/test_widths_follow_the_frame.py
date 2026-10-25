"""B593: a story looks as the page does at the same width. Every width Tailwind knows answers to the frame a part is
drawn in (@container frame, or the layout's data-layout), never to the window: a story's 393 frame sits in a wide
Storybook window, and a width that asks the window draws the desktop's look in the phone's frame."""

import os
import re
import unittest

CSS = os.path.join(os.path.dirname(__file__), "..", "web", "src", "index.css")
WIDTHS = ["sm", "md", "lg", "xl", "2xl", "max-sm", "max-md", "max-lg", "max-xl", "max-2xl"]


class WidthsFollowTheFrame(unittest.TestCase):
    def test_every_tailwind_width_is_the_frames(self) -> None:
        with open(CSS, encoding="utf-8") as f:
            css = f.read()
        defined = dict(re.findall(r"@custom-variant ([\w-]+) \(([^;]+)\);", css))
        missing = [w for w in WIDTHS if w not in defined]
        self.assertEqual(missing, [], "these widths still ask the window: define each as the frame's in index.css")
        for w in WIDTHS:
            self.assertRegex(defined[w], r"@container frame|data-layout", w)

    def test_no_width_asks_the_window(self) -> None:
        with open(CSS, encoding="utf-8") as f:
            css = f.read()
        self.assertNotRegex(css, r"@media\s*\(\s*(min|max)-width|@media\s*\(\s*width\s*[<>]", "a width that asks the window")


if __name__ == "__main__":
    unittest.main()
