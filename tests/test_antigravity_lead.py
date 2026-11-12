"""F755 (Yadong r1259/r1260, D133): Antigravity only. One Antigravity session runs a project; a newer one that takes it
(lead=1) replaces the one before, whose /next then says to stop, at once also while it waits. Its wait for work ends
by sending Taska's answer to itself as a message. Claude Code and Codex are told what they were told before."""

from __future__ import annotations

import os
import sys
import threading
import time
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from support import ProjectCase
from taska.agent_text import guide_text  # noqa: E402
from taska.http import agent_routes  # noqa: E402
from taska.http.messages import Request  # noqa: E402

A = "aaaaaaaa-1111-2222-3333-444444444444"
B = "bbbbbbbb-1111-2222-3333-444444444444"
CLAUDE_END = (
    "nothing to do now. End your turn (Claude Code: with the background wait from /agent running; never wait, poll or set a timer in the foreground).\n"
    "Claude Code: before ending the turn, start this with Bash run_in_background (it costs no tokens; Taska answers it only when there is work, and that wakes you):\n"
    "  while o=$(curl -s \"BASE/next?wait=540&by=claude-code&sid=$CLAUDE_CODE_SESSION_ID\"); [ -z \"$o\" ] || echo \"$o\" | grep -q 'nothing to do now'; do sleep 20; done; echo \"$o\"\n"
)


class AntigravityLead(ProjectCase):
    def call(self, path: str) -> str:
        req = Request("GET", path, {}, "127.0.0.1", read_body=lambda limit: b"")
        res = agent_routes.get(req, self.p, path.split("?")[0], "http://x/p/demo")
        assert res is not None
        return res.body.decode() if isinstance(res.body, bytes) else str(res.body)

    def test_a_newer_session_takes_over_and_the_one_before_stops(self) -> None:
        self.assertIn("nothing to do now", self.call(f"/next?by=antigravity&sid={A}&lead=1"))
        self.assertIn("nothing to do now", self.call(f"/next?by=antigravity&sid={A}"))
        self.call(f"/next?by=antigravity&sid={B}&lead=1")
        self.assertTrue(self.call(f"/next?by=antigravity&sid={A}").startswith("replaced: another Antigravity session"))
        self.assertIn("nothing to do now", self.call(f"/next?by=antigravity&sid={B}"))

    def test_taken_over_while_it_waits_it_is_told_at_once(self) -> None:
        self.call(f"/next?by=antigravity&sid={A}&lead=1")
        out: list = []
        t = threading.Thread(target=lambda: out.append(self.call(f"/next?wait=30&by=antigravity&sid={A}")))
        start = time.time()
        t.start()
        time.sleep(0.3)
        self.call(f"/next?by=antigravity&sid={B}&lead=1")
        t.join(5)
        self.assertTrue(out and out[0].startswith("replaced:"), out)
        self.assertLess(time.time() - start, 5)

    def test_its_wait_sends_the_answer_to_itself(self) -> None:
        out = self.call(f"/next?by=antigravity&sid={A}&lead=1")
        self.assertIn("BASE/next?wait=540&by=antigravity&sid=$ANTIGRAVITY_CONVERSATION_ID", out)
        self.assertIn('agentapi" send-message --title=Taska "$ANTIGRAVITY_CONVERSATION_ID" "$o"', out)

    def test_claude_code_and_codex_are_told_as_before(self) -> None:
        self.assertTrue(self.call("/next?by=claude-code").endswith(CLAUDE_END))
        self.assertNotIn("ANTIGRAVITY", self.call("/next?by=codex"))
        # every Antigravity rule is in its own section, which says so
        self.assertIn("This section is for Antigravity only", guide_text.ANTIGRAVITY)
        before = guide_text.SKILL.split("## Antigravity")[0]
        self.assertNotIn("invoke_subagent", before)
        self.assertNotIn("lead=1", before)

    def test_the_subagents_it_starts(self) -> None:
        self.assertIn("model: inherit", guide_text.ANTIGRAVITY_AGENTS["taska-code"])  # the main session's: Opus 5.5 high
        self.assertIn("model: pro", guide_text.ANTIGRAVITY_AGENTS["taska-work"])
        for a in guide_text.ANTIGRAVITY_AGENTS.values():  # a subagent has no tools unless they are listed: it ran nothing
            self.assertIn("run_command", a.split("---")[1])


if __name__ == "__main__":
    unittest.main()
