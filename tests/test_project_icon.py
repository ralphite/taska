"""F743: a project's icon. An agent uploads an image and writes `project icon f12-logo.png` (or `project icon none`);
the page then draws that picture in place of the project's letter. Only a small image the project has is taken; the
change is in the log (it survives a restart, the activity shows it) and the page's project rows and facts carry it."""

from __future__ import annotations

import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from support import ProjectCase, ServerCase  # noqa: E402
from taska.agent_text import language, log  # noqa: E402
from taska.services.project import Project  # noqa: E402

PNG = b"\x89PNG\r\n\x1a\n" + b"\0" * 64


class IconCommand(ProjectCase):
    def save(self, name: str, data: bytes = PNG) -> str:
        return self.p.files.save(name, "image/png", data).f

    def do(self, text: str) -> list:
        """Agent lines -> the answers (a refusal comes back as its words)."""
        out = []
        for _, c in language.parse(text):
            out.append(str(c) if isinstance(c, Exception) else self.p.run([(0, c)], "claude-code")[0][0])
        return out

    def test_set_and_clear(self) -> None:
        f = self.save("logo.png")
        self.assertEqual(self.do(f"project icon {f}"), [f"ok project icon {f}"])
        self.assertEqual(self.p.state.icon, f)
        self.assertIn(f"project icon {f}", log.text(self.p.state, 5))  # in the log, as agents read it
        self.assertEqual(log.entries(self.p.state, 1)[-1]["kind"], "icon")
        self.assertEqual(self.do("project icon none"), ["ok project icon none"])
        self.assertEqual(self.p.state.icon, "")
        self.assertIn("project icon none", log.text(self.p.state, 5))

    def test_refuses_what_is_not_a_small_image_it_has(self) -> None:
        text = self.p.files.save("notes.txt", "text/plain", b"hello").f
        big = self.save("big.png", PNG + b"\0" * (256 * 1024))
        self.assertIn("unknown file f99-nope.png", self.do("project icon f99-nope.png")[0])
        self.assertIn("is not an image", self.do(f"project icon {text}")[0])
        self.assertIn("too big", self.do(f"project icon {big}")[0])
        self.assertIn("use: project icon", self.do("project icon")[0])
        self.assertIn("use: project icon", self.do("project logo x.png")[0])
        self.assertEqual(self.p.state.icon, "")
        for name in ("a.svg", "a.ico", "a.webp", "a.jpg"):
            f = self.save(name)
            self.assertEqual(self.do(f"project icon {f}"), [f"ok project icon {f}"])

    def test_survives_a_restart(self) -> None:
        f = self.save("logo.png")
        self.do(f"project icon {f}")
        self.p.close()
        self.p = Project(self.tmp.name, "demo")  # the log replayed
        self.assertEqual(self.p.state.icon, f)


class IconOverHttp(ServerCase):
    def test_upload_set_and_the_page_reads_it(self) -> None:
        req = urllib.request.Request(self.p + "/api/file?name=logo.png", data=PNG, headers={"Content-Type": "image/png"})
        f = json.loads(urllib.request.urlopen(req, timeout=10).read())["f"]
        self.assertEqual(self.do(f"project icon {f}").strip().splitlines()[0], f"ok project icon {f}")
        rows = json.loads(urllib.request.urlopen(self.base + "/api/projects", timeout=10).read())
        rows = rows["projects"] if isinstance(rows, dict) else rows
        self.assertEqual([r["icon"] for r in rows if self.p.endswith("/" + r["name"])], [f])
        view = json.loads(self.get("/api/view"))
        self.assertEqual(view["project"]["icon"], f)
        served = urllib.request.urlopen(self.p + "/f/" + f, timeout=10)  # the page draws it from the file's address
        self.assertEqual(served.read(), PNG)
        self.do("project icon none")
        self.assertEqual(json.loads(self.get("/api/view"))["project"]["icon"], "")
