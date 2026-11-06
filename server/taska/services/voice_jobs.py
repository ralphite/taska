"""Voice notes being turned into words in the background. You can send before the words are in: the message goes at
once with its recording; the words come into the note's one record (state.voices, B682) as they are worked out, and
agents and the organizer get the input then.

What transcription found (its words, what may be misheard, its times, and every step that ran with its model, its
words or error and its time: T697 r(D121)) is also kept next to the audio (<file>.tr.json), so a restart or a page
asking again does not hear it again; the record is what everyone reads.
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
from ..domain.model import FileRef, Input, Voice
from ..domain.vocab import VOICE_HOLD
from ..domain.voice_split import SplitReport, copies_in, plan
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
    early: str = ""  # the speech model's words, shown while the main model still works (T687)


class VoiceProject(Protocol):
    """What the jobs need from their project."""

    lock: Any
    news: News
    organizing: Any  # .busy: the inputs the organizer works on now

    @property
    def state(self) -> Any: ...

    def emit(self, event: ev.Event) -> None: ...

    def file_path(self, fid: str) -> str: ...

    def stored_rows(self) -> List[Dict[str, Any]]: ...


Transcriber = Callable[[bytes, str, Optional[int], Optional[str], Callable[[str], None]], Transcript]


def _now_iso() -> str:
    from datetime import datetime
    return datetime.now().astimezone().isoformat(timespec="seconds")


class VoiceJobs:
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
        """A note worked out before, as a finished job."""
        res = self.kept(fid)
        return Job(t0=time.time(), done=True, tr=str(res.get("tr", "")), res=res) if res else None

    def job(self, fid: str) -> Optional[Job]:
        return self.jobs.get(fid) or (self.saved_job(fid) if fid else None)

    def notes_of(self, inp: Input) -> List[str]:
        """The input's voice notes."""
        return [f.f for f in inp.files if os.path.splitext(f.f)[1].lower() in AUDIO_EXTS]

    def heard(self, fid: str, words: str) -> bool:
        """Whether the words were in what was heard in the note (its words, as first heard and as given)."""
        v = self._p.state.voices.get(fid)
        mine = [v.said, v.tidied, v.was or ""] if v else []
        return words in " ".join(mine + [str(x) for k, x in (self.kept(fid) or {}).items() if k in ("tr", "heard")])

    # -- what inputs see -----------------------------------------------------------------

    def held(self, inp: Input) -> bool:
        """An input whose voice note is still being worked out: it waits for its words (at most VOICE_HOLD)."""
        now = time.time()
        for f in inp.files:
            j = self.jobs.get(f.f)
            if j and not j.done and now - j.t0 < VOICE_HOLD:
                return True
        return False

    # -- working them out ----------------------------------------------------------------

    def start(self, fid: str, data: bytes, mime: str, scope: Optional[int]) -> None:
        """Start working out a note's words; words kept from before are used as they are. Call without the lock."""
        saved = self.saved_job(fid)
        with self._p.lock:
            job = saved or Job(t0=time.time())
            self.jobs[fid] = job
            if saved:
                v = self._p.state.voices.get(fid)
                if v is None or v.state == "wait":
                    self.record_job(fid, job, late=self._late(fid))
                return
            self.record(fid, "wait")
        hold = self.hold_timer(job)
        threading.Thread(target=self._work, args=(fid, data, mime, scope, job, hold), daemon=True).start()

    def _work(self, fid: str, data: bytes, mime: str, scope: Optional[int], job: Job, hold: threading.Timer) -> None:
        res: Transcript = {}
        err = ""
        try:
            if self._transcriber is None:
                raise RuntimeError("voice notes are not transcribed here")
            res = self._transcriber(data, mime, scope, self._p.file_path(fid), lambda words: self._first(fid, job, words)) or {}
            self.keep(fid, res)
        except Exception as ex:  # a failed transcription is said on the page; Taska goes on
            err = str(ex) or "transcription failed"
        hold.cancel()
        with self._p.lock:
            job.done, job.tr, job.err, job.res = True, str(res.get("tr", "")), err, res
            self.record_job(fid, job, late=self._late(fid))
            forwards = list(self.forwards.get(fid, ()))
        for jobs, other in forwards:  # its input went to another project meanwhile: the copy there gets the words
            if not err:
                jobs.keep(other, res)
            with jobs._p.lock:
                jobs.record_job(other, job, late=jobs._late(other))

    def _first(self, fid: str, job: Job, words: str) -> None:
        """The speech model's words, while the main model still works (T687): the page and the input show them at
        once; the input still waits for the final words (held), so nobody organizes or reads it twice."""
        with self._p.lock:
            if job.done:
                return
            job.early = words
            self.record(fid, "wait", early=words)

    # -- the note's one record (B682) ---------------------------------------------------

    def record(self, fid: str, state: str, said: str = "", tidied: str = "", early: str = "", err: str = "",
               late: bool = False) -> None:
        """A step of working out a note's words, into its record (one change)."""
        inp = self._input_with(fid)
        self._p.emit(ev.VoiceHeard(f=fid, state=state, said=said, tidied=tidied, early=early, err=err[:300],
                                   late=late, src=inp.id if inp else None, by="taska"))

    def record_job(self, fid: str, job: Job, late: bool = False) -> None:
        """A finished job's words into the note's record: its words, nobody heard, or why it failed."""
        if job.err:
            self.record(fid, "failed", err=job.err, late=late)
        elif job.tr:
            self.record(fid, "done", said=str(job.res.get("heard") or job.tr), tidied=job.tr, late=late)
        else:
            self.record(fid, "none", late=late)

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

    def _late(self, fid: str) -> bool:
        """An agent or the organizer had an input with this note before its words: it gets the input again."""
        busy = self._p.organizing.busy
        return any(i.acked or i.org or i.id in busy for i in self._p.state.inputs.values()
                   if not i.moved and any(f.f == fid for f in i.files))

    def split_once(self) -> Optional[SplitReport]:
        """Once per project (B682): every voice note gets its one record of words, from what was kept of them before
        (the log, the file next to its audio, the copies on its input or comment); the texts that held its words keep
        only what was typed. One change; None when it was done before, or the project never had words kept the old
        way (in its texts and on its files)."""
        st = self._p.state
        if st.voices_split:
            return None
        copies = copies_in(self._p.stored_rows())
        if not copies and not any(isinstance(e, (ev.WordsIn, ev.WordsKept)) for e in st.events):
            return None
        kept: Dict[str, Transcript] = {}
        for f in {f.f for _, _, files in _files_everywhere(st) for f in files}:
            got = self.kept(f)
            if got:
                kept[f] = got
        event, report = plan(st, kept, copies, _now_iso())
        self._p.emit(event)
        return report

    def to_resume(self) -> List[Tuple[str, str, Optional[int]]]:
        """Notes whose words were still being worked out when a restart cut it off."""
        st = self._p.state
        out: List[Tuple[str, str, Optional[int]]] = []
        for kind, owner, files in _files_everywhere(st):
            for f in files:
                v = st.voices.get(f.f)
                if v and v.state == "wait" and f.f not in self.jobs and all(x[0] != f.f for x in out):
                    out.append((f.f, f.mime or "", owner.scope if kind == "input" else None))
        return out

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


def _files_everywhere(st: Any) -> List[Tuple[str, Any, List[FileRef]]]:
    out: List[Tuple[str, Any, List[FileRef]]] = [("input", i, i.files) for i in st.inputs.values()]
    out += [("comment", c, c.files) for d in st.docs.values() for c in d.comments + list(d.gone.values())]
    return out


def answer(fid: str, job: Optional[Job], voice: Optional[Voice] = None) -> Dict[str, Any]:
    """What a page gets for a voice note: its words once they are in, whose they are, what may be misheard, and every
    step that worked them out (T697 r(D121)). Words you changed are the note's words (its record), with nothing left
    to check."""
    res = job.res if job else {}
    if job and not job.done and job.early:  # the first words, better ones to follow (T687)
        return {"f": fid, "done": True, "tr": job.early, "tr_error": "", "tr_by": "asr", "more": True}
    steps = {"steps": res["steps"]} if res.get("steps") else {}
    if voice and voice.fixed:
        return {"f": fid, "done": True, "tr": voice.tidied, "tr_error": "", "doubts": [], "heard": voice.said, **steps}
    return {"f": fid, "done": not job or job.done, "tr": job.tr if job else "",
            "tr_error": (job.err if job else "no such voice note") or "",
            **{k: res[k] for k in ("tr_by", "doubts", "gated", "main_error", "asr_error", "times", "heard", "steps")
               if k in res}}
