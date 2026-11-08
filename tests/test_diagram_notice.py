"""B714 r1181 (Yadong's choice): a diagram in a document that does not draw goes back to the agent that wrote it, so
errors fix themselves without Yadong noticing. The page reports what Mermaid said; Taska writes "D<n> ¶<k>: this
diagram does not draw: <why>. Fix it." on the document's item, addressed to the writer's session (it reads it in
/next), once per version of the document and paragraph; nothing when the user wrote the diagram. Taska's note is
neither side's word: the user's reply before it still waits for an agent, and it does not make Taska the item's
agent."""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

from taska.agent_text.language import parse  # noqa: E402
from taska.domain import rules  # noqa: E402
from taska.services.project import Project  # noqa: E402

BROKEN = "```mermaid\ngraph TD\n  A[Start (now)] --> B\n```"
WHY = "Parse error on line 2:\n...A[Start (now)] --> B\n-----------^\nExpecting 'SQE', got 'PS'"


def doc_lines(md: str) -> str:
    return "".join("  " + line + "\n" for line in md.split("\n"))


class DiagramNotice(unittest.TestCase):
    proc: "subprocess.Popen[bytes]"
    base: str
    p: str

    @classmethod
    def setUpClass(cls) -> None:
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
        s.close()
        cls.base = f"http://127.0.0.1:{port}"
        root = tempfile.mkdtemp(prefix="taska-diagram-")
        env = {k: v for k, v in os.environ.items() if "KEY" not in k}
        cls.proc = subprocess.Popen([sys.executable, "-m", "taska", "serve", "--host", "127.0.0.1", "--port", str(port), "--root",
                                     os.path.join(root, "data"), "--organizer", "off", "--log-db", ""], cwd=os.path.join(ROOT, "server"),
                                    env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(150):
            try:
                urllib.request.urlopen(cls.base + "/health", timeout=2)
                break
            except OSError:
                time.sleep(0.1)
        req = urllib.request.Request(cls.base + "/api/projects", data=b'{"title": "demo"}', headers={"Content-Type": "application/json"})
        cls.p = cls.base + "/p/" + json.loads(urllib.request.urlopen(req, timeout=10).read())["name"]

    @classmethod
    def tearDownClass(cls) -> None:
        cls.proc.terminate()
        cls.proc.wait(10)

    def do(self, text: str, session: str = "writer-1") -> str:
        url = self.p + f"/do?by=claude-code&session={session}"
        return urllib.request.urlopen(urllib.request.Request(url, data=text.encode()), timeout=10).read().decode()

    def post(self, path: str, body: dict) -> dict:
        req = urllib.request.Request(self.p + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
        return json.loads(urllib.request.urlopen(req, timeout=10).read())

    def next(self, session: str) -> str:
        return urllib.request.urlopen(self.p + f"/next?by=claude-code&session={session}", timeout=10).read().decode()

    def view(self, kind: str) -> list:
        view = json.loads(urllib.request.urlopen(self.p + "/api/view", timeout=10).read())
        return view["entities"][kind] if "entities" in view else view[kind]

    def doc(self, d: int) -> dict:
        return next(x for x in self.view("docs") if x["d"] == d)

    def report(self, d: int, error: str = WHY) -> str:
        doc = self.doc(d)
        key = next(b["key"] for b in doc["blocks"] if b["text"].startswith("```mermaid"))
        return self.post("/api/diagram-failed", {"d": d, "v": doc["versions"], "key": key, "error": error})["result"]

    def notes(self, code: str) -> list:
        it = next(i for i in self.view("items") if i["code"] == code)
        return [x for x in it["thread"] if x["by"] == "taska"]

    def test_the_writer_hears_once_per_version(self) -> None:
        code = self.do("new task P1 now Draw the flow\n").split()[1]
        out = self.do(f"{code} doc Flow\n" + doc_lines(f"# Flow\n\nHow it goes:\n\n{BROKEN}\n"))
        d = int(out.split()[1].lstrip("D"))
        self.assertIn("told writer-1", self.report(d))
        self.assertIn("told already", self.report(d))  # another view or tab: no second notice
        notes = self.notes(code)
        self.assertEqual(len(notes), 1)
        self.assertEqual(notes[0]["to"], ["writer-1"])
        self.assertTrue(notes[0]["text"].startswith(f"D{d} ¶3: this diagram does not draw:\n```\nParse error on line 2"))
        self.assertTrue(notes[0]["text"].endswith("Fix it."))
        work = self.next("writer-1")
        self.assertIn(f"resume {code}: taska wrote to you", work)
        self.assertIn(f"D{d} ¶3: this diagram does not draw", work)
        self.assertNotIn("taska wrote to you", self.next("writer-1"))  # read once
        self.assertNotIn("taska wrote to you", self.next("someone-else"))  # only its writer
        # its fix still does not draw: the new version is told again, in one line when Mermaid says one
        self.do(f"D{d} doc Flow\n" + doc_lines(f"# Flow\n\nHow it goes:\n\n{BROKEN.replace('B', 'C')}\n"))
        self.assertIn("told writer-1", self.report(d, "No diagram type detected."))
        self.assertEqual(self.notes(code)[-1]["text"], f"D{d} ¶3: this diagram does not draw: No diagram type detected. Fix it.")
        # a report from a page that drew an older version says nothing
        doc = self.doc(d)
        key = next(b["key"] for b in doc["blocks"] if b["text"].startswith("```mermaid"))
        stale = self.post("/api/diagram-failed", {"d": d, "v": doc["versions"] - 1, "key": key, "error": WHY})
        self.assertIn("no notice", stale["result"])
        self.assertEqual(len(self.notes(code)), 2)

    def test_nothing_goes_when_the_user_wrote_the_diagram(self) -> None:
        code = self.do("new task P1 now Sketch it\n").split()[1]
        self.post("/api/commands", {"id": f"t-{time.time()}", "commands": [
            {"op": "doc", "ref": code, "md": f"# Sketch\n\n{BROKEN}\n"}]})
        d = max(x["d"] for x in self.view("docs"))
        self.assertIn("no notice", self.report(d))
        self.assertEqual(self.notes(code), [])


class TaskaNoteIsNoAgentsWord(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.p = Project(self.tmp.name, "demo")
        self.p.run(parse("new task P1 now Draw the flow\nT1 doc Flow\n" + doc_lines(f"# Flow\n\n{BROKEN}\n")), "claude-code", session="w")

    def tearDown(self) -> None:
        self.p.close()
        self.tmp.cleanup()

    def test_a_reply_before_the_note_still_waits_for_an_agent(self) -> None:
        self.p.run(parse("T1 progress Drew the flow.\n"), "claude-code", session="w")
        self.p.run([(0, {"op": "say", "ref": "T1", "text": "Make it blue."})], "you")
        d = next(iter(self.p.state.docs.values()))
        key = rules.doc_view(d)[0][1].key
        lines, _ = self.p.run([(0, {"op": "diagram-failed", "d": d.d, "v": d.versions, "key": key, "error": WHY})], "taska")
        self.assertIn("told w", lines[0])
        it = self.p.state.items[1]
        self.assertEqual(it.thread[-1].by, "taska")
        self.assertTrue(rules.replied(it))
        self.assertNotEqual(it.agent.by if it.agent else None, "taska")

    def test_only_taska_reports(self) -> None:
        d = next(iter(self.p.state.docs.values()))
        lines, _ = self.p.run([(0, {"op": "diagram-failed", "d": d.d, "key": "x", "error": WHY})], "claude-code")
        self.assertTrue(lines[0].startswith("err"))


if __name__ == "__main__":
    unittest.main()
