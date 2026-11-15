"""T806 #2 (r1376): a failed transcription is tried again by Taska itself, with pauses, and the note waits meanwhile; it
is failed only when the last try fails, and nothing to transcribe with is not tried again."""

import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from support import ProjectCase
from taska.domain.voice_states import DONE, FAILED, WAIT  # noqa: E402
from taska.services import voice_jobs  # noqa: E402

FID = "f1-voice_0-08.webm"


class TriedAgain(ProjectCase):
    def setUp(self):
        super().setUp()
        self.assertEqual(self.p.files.save("voice 0-08.webm", "audio/webm", b"audio").f, FID)
        self.pauses = []
        sleep = mock.patch.object(voice_jobs.time, "sleep", lambda s: self.pauses.append(s))
        sleep.start()
        self.addCleanup(sleep.stop)

    def run_with(self, results):
        tries = []

        def transcriber(data, mime, scope, path, first):
            tries.append(1)
            self.assertEqual(self.p.state.voices[FID].state, WAIT)  # still waiting between the tries
            r = results[len(tries) - 1]
            if isinstance(r, Exception):
                raise r
            return r

        self.p.voice.set_transcriber(transcriber)
        self.p.voice.start(FID, b"audio", "audio/webm", None)
        job = self.p.voice.jobs[FID]
        with self.p.lock:
            self.p.news.wait_for(lambda: job.done, timeout=5)
        return len(tries)

    def test_it_comes_through_on_a_later_try(self):
        n = self.run_with([RuntimeError("Gemini HTTP 503"), RuntimeError("timed out"), {"tr": "Keep the sort."}])
        self.assertEqual((n, self.pauses), (3, [20, 60]))
        self.assertEqual((self.p.state.voices[FID].state, self.p.state.voices[FID].tidied), (DONE, "Keep the sort."))

    def test_failed_only_after_the_last_try(self):
        n = self.run_with([RuntimeError("Gemini HTTP 503")] * 4)
        self.assertEqual((n, self.pauses), (4, list(voice_jobs.RETRY_PAUSES)))
        self.assertEqual((self.p.state.voices[FID].state, self.p.state.voices[FID].err), (FAILED, "Gemini HTTP 503"))

    def test_nothing_to_transcribe_with_is_not_tried_again(self):
        self.p.voice.set_transcriber(None)  # type: ignore[arg-type]
        self.p.voice.start(FID, b"audio", "audio/webm", None)
        job = self.p.voice.jobs[FID]
        with self.p.lock:
            self.p.news.wait_for(lambda: job.done, timeout=5)
        self.assertEqual((self.pauses, self.p.state.voices[FID].state), ([], FAILED))


if __name__ == "__main__":
    unittest.main()
