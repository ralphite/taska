"""Pushes to a phone (F195): Taska's own P-256 ES256 signature checks out with an independent library, the VAPID
header is well formed, only what newly needs you is pushed, quiet hours hold, and a gone subscription is dropped."""
import base64
import importlib.util
import json
import tempfile
import time
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('taska', Path(__file__).resolve().parents[1] / 'taska.py')
taska = importlib.util.module_from_spec(spec)
spec.loader.exec_module(taska)

try:
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
except ImportError:  # the service's Python has no third-party packages: the check below needs them
    ec = None


def unb64(s):
    return base64.urlsafe_b64decode(s + '=' * (-len(s) % 4))


NEED = {'project': 'qa', 'code': 'B1', 'kind': 'ask', 'n': 1, 'title': 'x', 'ptitle': 'qa', 'pri': 'P1', 't': ''}


class PushTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.push = taska.Push(self.tmp.name)
        self.push.subscribe({'endpoint': 'https://push.example/one'}, quiet=True)
        self.push.subscribe({'endpoint': 'https://push.example/two'}, quiet=False)

    def tearDown(self):
        self.tmp.cleanup()

    @unittest.skipIf(ec is None, 'cryptography is not installed')
    def test_the_signature_checks_out(self):
        pub = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), unb64(self.push.public))
        auth = self.push.token('https://push.example/one')
        t, k = auth.removeprefix('vapid t=').split(', k=')
        self.assertEqual(k, self.push.public)
        head, claims, sig = t.split('.')
        self.assertEqual(json.loads(unb64(claims))['aud'], 'https://push.example')
        raw = unb64(sig)
        der = encode_dss_signature(int.from_bytes(raw[:32], 'big'), int.from_bytes(raw[32:], 'big'))
        pub.verify(der, f'{head}.{claims}'.encode(), ec.ECDSA(hashes.SHA256()))  # raises if it is wrong

    def test_the_key_is_kept(self):
        again = taska.Push(self.tmp.name)
        self.assertEqual(again.public, self.push.public)
        self.assertEqual(len(again.subs), 2)

    def test_only_what_is_new_and_quiet_hours(self):
        sent = []
        noon, night = time.struct_time((2026, 10, 14, 12, 0, 0, 0, 0, -1)), time.struct_time((2026, 10, 14, 23, 0, 0, 0, 0, -1))
        with patch.object(taska.Push, 'send', lambda self, sub: sent.append(sub['endpoint']) or True):
            with patch.object(taska.time, 'localtime', return_value=noon):
                self.assertEqual(self.push.check([NEED]), 0)  # the first look: what already needed you is not news
                self.assertEqual(self.push.check([NEED]), 0)
                self.assertEqual(self.push.check([NEED, dict(NEED, code='B2')]), 2)
            with patch.object(taska.time, 'localtime', return_value=night):
                self.assertEqual(self.push.check([NEED, dict(NEED, code='B2'), dict(NEED, code='B3')]), 1)  # the quiet one waits
        self.assertEqual(sent, ['https://push.example/one', 'https://push.example/two', 'https://push.example/two'])

    def test_a_gone_subscription_is_dropped(self):
        def gone(req, timeout):
            raise urllib.error.HTTPError(req.full_url, 410, 'Gone', {}, None)
        noon = time.struct_time((2026, 10, 14, 12, 0, 0, 0, 0, -1))
        with patch.object(taska.urllib.request, 'urlopen', gone), patch.object(taska.time, 'localtime', return_value=noon):
            self.assertFalse(self.push.send(self.push.subs[0]))
            self.push.seen = set()
            self.push.check([NEED])
        self.assertEqual(self.push.subs, [])

    def test_https_only(self):
        with self.assertRaises(taska.Err):
            self.push.subscribe({'endpoint': 'http://push.example/x'})


if __name__ == '__main__':
    unittest.main()
