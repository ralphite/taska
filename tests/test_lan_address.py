"""R4-5 #2: Settings › Use on your phone names the address on this network only when Taska listens there."""

from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.cli import lan_address  # noqa: E402


class LanAddress(unittest.TestCase):
    def test_this_machine_only_has_none(self) -> None:
        for host in ("127.0.0.1", "localhost", "::1"):
            self.assertEqual(lan_address(host, 7340), "")

    def test_a_named_address_is_itself(self) -> None:
        self.assertEqual(lan_address("192.168.1.20", 7340), "http://192.168.1.20:7340")

    def test_every_address_names_one_on_the_network(self) -> None:
        got = lan_address("0.0.0.0", 7340)
        self.assertTrue(got == "" or (got.startswith("http://") and got.endswith(":7340")), got)


if __name__ == "__main__":
    unittest.main()
