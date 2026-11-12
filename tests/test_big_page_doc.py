"""B756 (Yadong r1262): a project whose web page documents carry their sound (20 MB each) did not open over the
phone's connection, so the phone showed the project as it was before and refused what was decided since. A big web page
is not in the project's view; the page asks for its text when it is opened."""

from __future__ import annotations

import json
import unittest
import urllib.error
import urllib.request

from support import ServerCase

SOUND = "A" * 1_200_000  # a sound written into the page, as the lecture pages carry theirs


class BigPage(ServerCase):
    def test_a_big_web_page_is_not_in_the_view_and_comes_when_asked(self) -> None:
        self.do("new task Lecture")
        page = f"<html><head><title>Lecture</title></head><body><audio src='data:audio/mp3;base64,{SOUND}'></audio></body></html>"
        self.do("T1 html\n" + "\n".join("  " + x for x in page.split("\n")))
        self.do("T1 doc\n  # Notes\n\n  short")
        docs = {d["title"]: d for d in json.loads(self.get("/api/view"))["docs"]}
        big, small = docs["Lecture"], docs["Notes"]
        self.assertEqual(big["md"], "")
        self.assertEqual(big["size"], len(page))
        self.assertNotIn("size", small)
        self.assertIn("short", small["md"])
        res = urllib.request.urlopen(self.p + f"/api/doc?d={big['d']}&t={big['t1']}", timeout=10)
        self.assertEqual(res.read().decode(), page)
        self.assertTrue(res.headers["Content-Type"].startswith("text/plain"))  # never run as a page of Taska's
        with self.assertRaises(urllib.error.HTTPError):
            urllib.request.urlopen(self.p + "/api/doc?d=99", timeout=10)


if __name__ == "__main__":
    unittest.main()
