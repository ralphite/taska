"""Voice notes being turned into words in the background. You can send before the words are in: the message goes at
once with its recording; the words are added when they come, and agents and the organizer get the input then.

The words of a note are kept next to its audio (<file>.tr.json), so a restart or a page asking again gets them.
Callers hold the project lock unless a method says otherwise.
"""

from __future__ import annotations

import json
import os
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Protocol, Tuple

from ..domain import events as ev
from ..domain.model import FileRef, Input
from ..domain.vocab import VOICE_HOLD
from .news import News

Transcript = Dict[str, Any]
AUDIO_EXTS = (".webm", ".ogg", ".m4a", ".mp4", ".mp3", ".wav", ".aac", ".flac")


@dataclass
class Job:
    t0: float
    done: bool = False
    tr: str = ""
    err: str = ""
    res: Transcript = field(default_factory=dict)


class VoiceProject(Protocol):
    """What the jobs need from their project."""

    lock: Any
    news: News
    organizing: Any  # .busy: the input the organizer works on now

    @property
    def state(self) -> Any: ...

    def emit(self, event: ev.Event) -> None: ...

    def file_path(self, fid: str) -> str: ...


Transcriber = Callable[[bytes, str, Optional[int], Optional[str], Callable[[Optional[str]], None]], Transcript]


def _now_iso() -> str:
    from datetime import datetime
    return datetime.now().astimezone().isoformat(timespec="seconds")


class VoiceJobs:
    LATE = 180.0  # the strong model may go on this long past its cap; fuller words then follow

    def __init__(self, project: VoiceProject, transcriber: Optional[Transcriber] = None):
        self._p = project
        self._transcriber = transcriber
        self.jobs: Dict[str, Job] = {}
        self.forwards: Dict[str, List[Tuple["VoiceJobs", str]]] = {}  # notes whose input moved before their words came

    def set_transcriber(self, transcriber: Transcriber) -> None:
        self._transcriber = transcriber

    # -- the words kept next to the audio ------------------------------------------

    def kept(self, fid: str) -> Optional[Transcript]:
        try:
            with open(self._p.file_path(fid) + ".tr.json", encoding="utf-8") as f:
                got = json.load(f)
                return got if isinstance(got, dict) else None
        except (OSError, ValueError):
            return None

    def keep(self, fid: str, res: Transcript) -> None:
        side = self._p.file_path(fid) + ".tr.json"
        try:
            with open(side + ".tmp", "w", encoding="utf-8") as f:
                json.dump(dict(res, t=_now_iso()), f, ensure_ascii=False)
            os.replace(side + ".tmp", side)
        except OSError:
            pass

    def saved_job(self, fid: str) -> Optional[Job]:
        """A note worked out before, as a finished job (fuller words still to come were lost with a restart)."""
        res = self.kept(fid)
        if res:
            res = {k: v for k, v in res.items() if k != "more"}
        return Job(t0=time.time(), done=True, tr=str(res.get("tr", "")), res=res) if res else None

    def job(self, fid: str) -> Optional[Job]:
        return self.jobs.get(fid) or (self.saved_job(fid) if fid else None)

    def notes_of(self, inp: Input) -> List[str]:
        """The input's voice notes."""
        return [f.f for f in inp.files if os.path.splitext(f.f)[1].lower() in AUDIO_EXTS]

    def heard(self, fid: str, words: str) -> bool:
        """Whether the words were in what was heard in the note (its words, as first heard and as given)."""
        return words in " ".join(str(v) for k, v in (self.kept(fid) or {}).items() if k in ("tr", "heard"))

    # -- what inputs see -----------------------------------------------------------------

    def held(self, inp: Input) -> bool:
        """An input whose voice note is still being worked out: it waits for its words (at most VOICE_HOLD)."""
        now = time.time()
        for f in inp.files:
            j = self.jobs.get(f.f)
            if j and not j.done and now - j.t0 < VOICE_HOLD:
                return True
        return False

    def with_words(self, text: str, files: List[FileRef]) -> Tuple[str, List[FileRef]]:
        """Words of voice notes that came in after the page let go of them; a note whose words are still to come is
        marked wait, so they are worked out again if Taska stops before."""
        out: List[FileRef] = []
        for f in files:
            if f.tr or not f.is_audio:
                out.append(f)
                continue
            j = self.jobs.get(f.f) or self.saved_job(f.f)
            if j and j.done and j.tr:
                f = f.with_words(j.tr)
                if j.tr not in text:
                    text = text.rstrip() + "\n" + j.tr if text.strip() else j.tr
            elif j and not (j.done and not j.err):  # still being worked out, or failed and may be asked for again
                f = f.with_wait(True)
            out.append(f)
        return text, out

    # -- working them out ----------------------------------------------------------------

    def start(self, fid: str, data: bytes, mime: str, scope: Optional[int]) -> None:
        """Start working out a note's words; words kept from before are used as they are. Call without the lock."""
        saved = self.saved_job(fid)
        with self._p.lock:
            job = saved or Job(t0=time.time())
            self.jobs[fid] = job
            if saved:
                self.words_in(fid, job)
                return
        hold = self.hold_timer(job)
        threading.Thread(target=self._work, args=(fid, data, mime, scope, job, hold), daemon=True).start()

    def _work(self, fid: str, data: bytes, mime: str, scope: Optional[int], job: Job, hold: threading.Timer) -> None:
        res: Transcript = {}
        err = ""
        try:
            if self._transcriber is None:
                raise RuntimeError("voice notes are not transcribed here")
            res = self._transcriber(data, mime, scope, self._p.file_path(fid), lambda words: self._more(fid, job, words)) or {}
            self.keep(fid, res)
        except Exception as ex:  # a failed transcription is said on the page; Taska goes on
            err = str(ex) or "transcription failed"
        hold.cancel()
        with self._p.lock:
            job.done, job.tr, job.err, job.res = True, str(res.get("tr", "")), err, res
            self.words_in(fid, job)
            forwards = list(self.forwards.get(fid, ()))
        for jobs, other in forwards:  # its input went to another project meanwhile: the copy there gets the words
            if not err:
                jobs.keep(other, res)
            with jobs._p.lock:
                jobs.words_in(other, job)

    def _more(self, fid: str, job: Job, words: Optional[str]) -> None:
        """The strong model's words after its cap: fuller ones replace those given."""
        with self._p.lock:
            self._p.news.wait_for(lambda: job.done, timeout=self.LATE)
            was = job.tr
            res = {k: v for k, v in job.res.items() if k != "more"}
            if words:
                res.update(tr=words, tr_by="pro", alt="", doubts=[], pro_error="",
                           times=dict(res.get("times") or {}, late=round(time.time() - job.t0, 1)))
                job.tr = words
            job.res = res
            if words and was:
                self.words_more(fid, was, words)
            elif words:
                self.words_in(fid, job)
            self._p.news.bump()
        self.keep(fid, res)

    def hold_timer(self, job: Job) -> threading.Timer:
        """When an input's hold for its words runs out, whoever waits for work hears it."""
        def over() -> None:
            with self._p.lock:
                if not job.done:
                    self._p.news.bump()

        t = threading.Timer(max(0.0, job.t0 + VOICE_HOLD - time.time()) + 0.05, over)
        t.daemon = True
        t.start()
        return t

    def _input_with(self, fid: str) -> Optional[Input]:
        return next((i for i in self._p.state.inputs.values() if not i.moved and any(f.f == fid for f in i.files)), None)

    def _late(self, inp: Input) -> bool:
        return bool(inp.acked or inp.org or self._p.organizing.busy == inp.id)

    def words_in(self, fid: str, job: Job) -> None:
        """A note's words are in: the input that has the note gets them. They come late when an agent or the
        organizer had the input: it is then organized again with them."""
        inp = self._input_with(fid)
        if inp and job.tr and not any(f.f == fid and f.tr for f in inp.files):
            self._p.emit(ev.WordsIn(src=inp.id, f=fid, tr=job.tr, by="you", late=self._late(inp)))
        else:
            self._p.news.bump()  # an input waiting for these words goes on without them; the page hears it is done

    def words_more(self, fid: str, was: str, tr: str) -> None:
        inp = self._input_with(fid)
        if inp:
            self._p.emit(ev.WordsIn(src=inp.id, f=fid, tr=tr, was=was, by="you", late=self._late(inp)))

    def to_resume(self) -> List[Tuple[str, str, Optional[int]]]:
        """Notes sent before their words were in whose transcription a restart cut off."""
        return [(f.f, f.mime or "", i.scope) for i in self._p.state.inputs.values() if not i.moved
                for f in i.files if f.wait and not f.tr and f.f not in self.jobs]

    def resume(self) -> None:
        """Work those out again (call without the lock)."""
        with self._p.lock:
            todo = self.to_resume()
        for fid, mime, scope in todo:
            data = b""
            if not self.kept(fid):
                try:
                    with open(self._p.file_path(fid), "rb") as fh:
                        data = fh.read()
                except OSError:
                    continue  # its audio is gone
            self.start(fid, data, mime, scope)

    def busy(self) -> int:
        return sum(1 for j in list(self.jobs.values()) if not j.done)


def answer(fid: str, job: Optional[Job]) -> Dict[str, Any]:
    """What a page gets for a voice note: its words once they are in, whose they are, what may be misheard."""
    res = job.res if job else {}
    return {"f": fid, "done": not job or job.done, "tr": job.tr if job else "",
            "tr_error": (job.err if job else "no such voice note") or "",
            **{k: res[k] for k in ("tr_by", "doubts", "gated", "main_error", "asr_error", "pro_error", "times", "more", "heard")
               if k in res}}
