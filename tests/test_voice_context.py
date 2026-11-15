"""B809: what a voice note is told about the item it is said on takes a web page document's words as it reads, never
its markup, styles or scripts ("font-size" and "border-radius" were the spelling hints for a note on T27)."""

from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from support import ProjectCase  # noqa: E402
from taska.domain.voice_words import voice_context  # noqa: E402

PAGE = """<!doctype html><html><head><style>.card{font-size:14px;border-radius:8px;color:#a8a29e}</style></head>
<body><h1>Seat holds</h1><p>Redis keeps each hold for five minutes.</p><script>const webkitTapHighlight = 1</script></body></html>"""


class VoiceContext(ProjectCase):
    def test_a_web_page_gives_its_words_not_its_markup(self) -> None:
        self.p.run([(0, {"op": "new", "type": "task", "pri": "P1", "when": "now", "title": "Design ticket booking"})], "you")
        self.p.run([(0, {"op": "doc", "ref": "T1", "title": "Lecture", "md": PAGE, "fmt": "html"})], "you")
        words, items, _ = voice_context(self.p.state, 1)
        self.assertIn("Redis", words)
        for markup in ("font-size", "border-radius", "a8a29e", "webkitTapHighlight", "doctype"):
            self.assertNotIn(markup, words)
            self.assertNotIn(markup, items[0])
        self.assertIn("Redis keeps each hold for five minutes", items[0])


if __name__ == "__main__":
    unittest.main()
