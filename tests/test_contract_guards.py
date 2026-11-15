"""Guards for rows of the feature contract (D136, T795/T803) that held but had nothing to fail when they break. Each
test names its row (Cnnn) and the item Yadong said it on. Change one only on Yadong's explicit word; when a row changes,
change D136 too."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from collections import Counter
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from support import ProjectCase
from taska.agent_text import guide_text  # noqa: E402
from taska.agent_text.organizer_text import INSTRUCTIONS  # noqa: E402
from taska.domain.text import clean_title  # noqa: E402
from taska.domain.vocab import STATUSES  # noqa: E402
from taska.domain.voice_words import echoed  # noqa: E402
from taska.http import agent_routes  # noqa: E402
from taska.http.messages import Request  # noqa: E402
from taska.infra import audio  # noqa: E402
from taska.services import organizer as org, transcribe as tr  # noqa: E402
from taska.services.settings import Spellings  # noqa: E402


class Agent(ProjectCase):
    def do(self, body: str, by: str = "claude-code") -> str:
        req = Request("POST", f"/do?by={by}&session=a", {}, "127.0.0.1", read_body=lambda limit: body.encode())
        return agent_routes.do(req, self.p).body.decode()

    def get(self, path: str) -> str:
        req = Request("GET", path, {}, "127.0.0.1", read_body=lambda limit: b"")
        res = agent_routes.get(req, self.p, path.split("?")[0], "http://x/p/demo")
        assert res is not None
        return res.body.decode()

    def new(self, type_: str, title: str) -> int:
        self.p.run([(0, {"op": "new", "type": type_, "pri": "P1", "when": "now", "title": title})], "you")
        return max(self.p.state.items)


class Items(Agent):
    def test_c012_a_title_keeps_no_src_or_field_tags(self) -> None:  # B222
        self.assertEqual(clean_title("[src=r246] Fix the export"), ("Fix the export", "r246"))
        self.assertEqual(clean_title("Fix the export [src=r12]"), ("Fix the export", "r12"))
        self.assertEqual(clean_title("Open the settings"), ("Open the settings", None))
        self.do("new task [P1] [now] Fix the export\n")
        self.assertEqual([i.title for i in self.p.state.items.values()], ["Fix the export"])

    def test_c027_an_ask_on_an_item_in_progress_leaves_it_in_progress(self) -> None:  # B606 #8696
        n = self.new("task", "Export loses the filter")
        self.do(f"T{n} doing\nT{n} ask Which filter should win?\n")
        self.assertEqual(self.p.state.items[n].status, "doing")

    def test_c029_there_is_no_paused_status(self) -> None:  # B606 #8696: Open is the agent's turn
        self.assertEqual(STATUSES, ("proposed", "open", "doing", "review", "done", "dropped"))

    def test_c066_the_organizer_never_finishes_work(self) -> None:  # B442: no "Organizer finished this"
        n = self.new("task", "Old chore")
        self.assertIn("only an agent that did the work", self.do(f"T{n} review\n", by="org"))
        self.do(f"T{n} done\n", by="org")  # the user said it is done: done, not in review as finished work
        self.assertEqual(self.p.state.items[n].status, "done")

    def test_c424_an_idea_is_taken_up_like_a_task(self) -> None:  # B49
        self.new("idea", "Try a dark list")
        self.assertIn("next I1", self.get("/next?by=claude-code&session=a"))

    def test_c426_an_agent_cannot_reopen_what_the_user_marked_wont_do(self) -> None:  # F197 #2028
        n = self.new("task", "Rewrite the list")
        self.p.run([(0, {"op": "set", "ref": f"T{n}", "f": {"status": "dropped"}})], "you")
        self.assertIn("the user marked it won't do", self.do(f"T{n} open\n"))
        self.assertIn("the user marked it won't do", self.do(f"T{n} doing\n"))
        self.assertEqual(self.p.state.items[n].status, "dropped")


class Organizer(ProjectCase):
    def organize(self, text: str, plan: str, scope: int | None = None) -> None:
        self.p.run([(0, {"op": "input", "text": text, "q": "q1", **({"scope": scope} if scope else {})})], "you")
        with mock.patch.object(org.gemini, "ask", side_effect=lambda *a, **k: plan):
            org.Organizer(self.p).organize("r1")

    def test_c047_the_organizer_writes_in_the_language_of_the_input(self) -> None:  # F22
        self.assertIn("in the language of THIS input", INSTRUCTIONS)
        self.assertIn("Chinese input ->", INSTRUCTIONS)

    def test_c054_a_link_to_a_file_not_uploaded_does_not_fail_it(self) -> None:  # B172
        said = "The list is cut off, see ![shot](/Users/x/Desktop/shot.png) and f77-missing.png"
        self.organize(said, "new bug P1 now The list is cut off src=r1\n    See ![shot](/Users/x/Desktop/shot.png)\nack r1")
        self.assertEqual([i.title for i in self.p.state.items.values()], ["The list is cut off"])
        self.assertTrue(self.p.state.inputs["r1"].org.ok)

    def test_c100_a_reply_stays_on_the_item_it_was_said_on(self) -> None:  # B452 #5670
        self.p.run([(0, {"op": "new", "type": "bug", "pri": "P1", "when": "now", "title": "Book is missing"}),
                    (0, {"op": "new", "type": "task", "pri": "P1", "when": "now", "title": "Shelf order"})], "you")
        self.organize("Found it on the second shelf", "B002 say related: the book was on the second shelf\nack r1", scope=1)
        self.assertEqual(self.p.state.inputs["r1"].scope, 1)


class Guide(unittest.TestCase):
    """What the agent guide must keep saying (its words, not a behavior the server can check)."""

    def test_c423_the_user_sees_only_what_is_in_taska(self) -> None:  # T44 #568
        self.assertIn("The user reads Taska only", guide_text.AGENT)

    def test_c429_the_done_report_has_its_four_parts(self) -> None:  # T274 #3064
        self.assertIn("four parts", guide_text.AGENT)
        for part in ("Result", "How to", "What changed", "picture"):
            self.assertIn(part, guide_text.AGENT)

    def test_c445_the_guide_says_which_icon_fits_a_project(self) -> None:  # T744
        self.assertIn("ICON", guide_text.AGENT)
        self.assertIn("favicon", guide_text.AGENT)

    def test_c450_the_guide_says_what_to_do_with_an_item_another_session_holds(self) -> None:  # T775
        self.assertIn("An item another session holds", guide_text.AGENT)
        self.assertIn("B03 take", guide_text.GRAMMAR)


class Voice(unittest.TestCase):
    def test_c131_a_transcript_of_only_item_titles_counts_as_nobody_speaking(self) -> None:  # B92
        titles = ["Export loses the filter", "Book is missing"]
        self.assertTrue(echoed("Export loses the filter. Book is missing!", titles))
        self.assertFalse(echoed("The export loses the filter again", titles))
        self.assertFalse(echoed("", titles))

    def heard(self, main, asr, fixes=lambda: []):
        hearing = tr.Hearing(context=lambda scope: (Counter(), ["Export loses the filter"], []), fixes=fixes,
                             prefs=lambda: "", tidy=lambda: False)
        stubs = [mock.patch.object(tr.tools, "processed_silence", lambda path, mime: 0.0),
                 mock.patch.object(tr.tools, "duration", lambda path: 0.0),
                 mock.patch.object(tr.tools, "pieces", lambda path: ([], 0.0)),
                 mock.patch.object(tr.tools, "louder", lambda data, mime: b"LOUD"),
                 mock.patch.object(tr, "voice_main", main), mock.patch.object(tr, "voice_asr", asr),
                 mock.patch.object(tr.time, "sleep", lambda s: None)]
        for s in stubs:
            s.start()
        try:
            return tr.transcribe(hearing, b"quiet", "audio/webm", None)
        finally:
            for s in stubs:
                s.stop()

    @staticmethod
    def loud(audio) -> bool:
        return isinstance(audio, dict) and audio.get("inline_data", {}).get("data") == "TE9VRA=="  # b"LOUD"

    def test_c131_nobody_speaking_gives_no_words_even_when_the_main_model_made_some(self) -> None:  # B92
        out = self.heard(lambda audio, prompt, model=None: "Export loses the filter", lambda audio, vocab: "")
        self.assertEqual(out["tr"], "")

    def test_c156_a_quiet_note_is_heard_again_made_louder(self) -> None:  # B494
        words = "导出的时候保留筛选"
        out = self.heard(lambda audio, prompt, model=None: words if self.loud(audio) else "",
                         lambda audio, vocab: words if self.loud(audio) else "")
        self.assertEqual(out["tr"], words)
        self.assertTrue(out.get("louder"))

    def test_c135_a_correction_is_kept_and_fixes_every_note_after(self) -> None:  # F144: one list for every project
        with tempfile.TemporaryDirectory() as root:
            Spellings(root).correct("温江波", "闻江波")
            kept = Spellings(root)  # read again, as after a restart
            self.assertEqual([(c["wrong"], c["right"]) for c in kept.all()], [("温江波", "闻江波")])
            out = self.heard(lambda audio, prompt, model=None: "温江波说导出要保留筛选",
                             lambda audio, vocab: "温江波说导出要保留筛选", fixes=kept.all)
            self.assertEqual(out["tr"], "闻江波说导出要保留筛选")

    @unittest.skipUnless(shutil.which("ffmpeg"), "needs ffmpeg")
    def test_c156_louder_brings_up_quiet_speech_and_leaves_silence(self) -> None:  # B494
        with tempfile.TemporaryDirectory() as d:
            def note(volume: str) -> bytes:
                path = os.path.join(d, f"{volume}.wav")
                subprocess.run(["ffmpeg", "-v", "quiet", "-y", "-f", "lavfi", "-i", "sine=frequency=300:duration=2",
                                "-af", f"volume={volume}", path], check=True)
                with open(path, "rb") as f:
                    return f.read()
            self.assertTrue(audio.louder(note("-20dB"), "audio/wav"))
            self.assertIsNone(audio.louder(note("-90dB"), "audio/wav"))


if __name__ == "__main__":
    unittest.main()
