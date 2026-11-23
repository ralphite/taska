"""T871 (Yadong r1476 r1485): Taska's computer use. A goal from an agent; Gemini's computer use model sees the screen
and says what to do; Taska does it on this Mac, shows it the screen again, until it says it is done. Only while the
user leaves the Mac alone; it stops when they move the mouse, when the model asks for the user's confirmation, and it
opens only web and app links."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import support  # noqa: E402,F401  (the server on the path)
from taska.services import computer as cu  # noqa: E402


class FakeMac:
    def __init__(self) -> None:
        self.did: list = []
        self.pointer = (10.0, 10.0)
        self.drift = None  # where the user moves the pointer after the first action

    def shot(self) -> bytes:
        return b"\x89PNG fake"

    def mouse(self):
        at = self.pointer
        if self.drift and self.did:  # read once where Taska left it, then the user moves it
            self.pointer, self.drift = self.drift, None
        return at

    def click(self, x, y, button="left", count=1):
        self.did.append(("click", x, y, button, count))
        self.pointer = (x, y)

    def type(self, text):
        self.did.append(("type", text))

    def keys(self, names):
        self.did.append(("keys", tuple(names)))

    def open(self, target, app=False):
        self.did.append(("open", target, app))


def call(name, **args):
    return {"type": "function_call", "id": f"c-{name}", "name": name, "arguments": args}


def said(text):
    return {"type": "model_output", "content": [{"type": "text", "text": text}]}


class Script:
    """The model's turns, in order; what Taska sent each time is kept."""

    def __init__(self, *turns) -> None:
        self.turns = list(turns)
        self.sent: list = []

    def __call__(self, who, body):
        self.sent.append(body)
        steps = self.turns.pop(0)
        return {"id": f"i{len(self.sent)}", "steps": steps}


def computer(mac, script, idle=300.0):
    return cu.Computer(mac=mac, ask=script, sleep=lambda s: None, idle=lambda: idle, platform="darwin")


class ComputerTest(unittest.TestCase):
    def test_does_the_goal_turn_by_turn(self):
        mac = FakeMac()
        script = Script([call("click", x=262, y=160, intent="Open Shop")],
                        [call("type", text="做 T50", press_enter=True, intent="Ask it to do T50")],
                        [said("Opened Shop and asked it to do T50.")])
        out = computer(mac, script).do("open Shop and ask for T50", "claude-code")
        self.assertTrue(out.done)
        self.assertEqual(out.said, "Opened Shop and asked it to do T50.")
        self.assertEqual(mac.did, [("click", 262, 160, "left", 1), ("type", "做 T50"), ("keys", ("enter",))])
        self.assertEqual(out.steps, ["Open Shop (ok)", "Ask it to do T50 (ok)"])
        first, second = script.sent[0], script.sent[1]
        self.assertIn("Never", first["system_instruction"])
        self.assertEqual(first["tools"][0]["environment"], "desktop")
        self.assertEqual(second["previous_interaction_id"], "i1")
        result = second["input"][0]
        self.assertEqual((result["type"], result["call_id"]), ("function_result", "c-click"))
        self.assertEqual(result["result"][-1]["type"], "image")  # the screen after the step
        self.assertTrue(out.report().startswith("done: Opened Shop"))

    def test_waits_for_the_user_to_leave_the_mac(self):
        mac, script = FakeMac(), Script()
        out = computer(mac, script, idle=5).do("anything")
        self.assertFalse(out.done)
        self.assertIn("using this Mac", out.said)
        self.assertEqual((mac.did, script.sent), ([], []))

    def test_stops_when_the_user_moves_the_mouse(self):
        mac = FakeMac()
        mac.drift = (900.0, 700.0)
        script = Script([call("click", x=100, y=100)], [call("click", x=200, y=200)])
        out = computer(mac, script).do("two clicks")
        self.assertFalse(out.done)
        self.assertIn("came back", out.said)
        self.assertEqual(len(mac.did), 1)

    def test_a_step_the_model_wants_confirmed_is_left_to_the_user(self):
        mac = FakeMac()
        confirm = call("click", x=1, y=2, safety_decision={"decision": "require_confirmation", "explanation": "Allow it?"})
        out = computer(mac, Script([confirm])).do("unblock it")
        self.assertFalse(out.done)
        self.assertEqual(out.said, "needs the user: Allow it?")
        self.assertEqual(mac.did, [])

    def test_opens_only_web_and_app_links(self):
        mac = FakeMac()
        script = Script([call("open_url", url="file:///etc/passwd")], [call("open_url", url="claude://code/new?q=x")],
                        [call("open_app", app_name="Codex")], [said("Opened.")])
        out = computer(mac, script).do("open things")
        self.assertTrue(out.done)
        self.assertEqual(mac.did, [("open", "claude://code/new?q=x", False), ("open", "Codex", True)])
        self.assertIn("refused", out.steps[0])

    def test_an_unknown_action_is_told_to_the_model(self):
        out = computer(FakeMac(), Script([call("navigate", url="https://x")], [said("ok")])).do("go")
        self.assertIn("not available: navigate", out.steps[0])


if __name__ == "__main__":
    unittest.main()
