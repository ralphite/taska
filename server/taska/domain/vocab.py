"""The words of Taska's data: item types and their letters, priorities, statuses, message kinds, who is a person.

These are part of the stored format and of the agent interface: they never change.
"""

from __future__ import annotations

import re

LETTER = {"feature": "F", "bug": "B", "idea": "I", "task": "T", "rule": "R"}
TYPE_OF = {letter: kind for kind, letter in LETTER.items()}
PRIORITIES = ("P0", "P1", "P2", "P3")
# a new item's priority when nobody says one: P1, the user's rule (r10, r1072); tests/test_default_priority.py holds it
DEFAULT_PRI = "P1"
WHENS = ("now", "later")
STATUSES = ("proposed", "open", "doing", "review", "done", "dropped")
CLOSED = ("done", "dropped")
# the two choices of a proposal (approve, won't do) and of finished work (accept, not yet)
DECISIONS = {"proposed": ("open", "dropped"), "review": ("done", "open")}
# "you" is the user; the organizer writes down what the user said, so it acts for the user
PEOPLE = ("you", "org")
MESSAGE_KINDS = ("say", "ask", "withdraw", "propose", "decide", "progress")
# an agent that is stuck asks for what it needs (T646): the one way it waits on the user. Its old word, block, is
# still read and lands as an ask
ASK_WORDS = ("block",)
WORK_TYPES = ("bug", "feature", "task", "idea")  # what /next hands out
TEXT_VERBS = MESSAGE_KINDS + ASK_WORDS + ("title", "body", "next")
USER_KINDS = ("say", "decide", "propose")  # what the organizer files from an input: the user's words, decision, idea
DOC_KEY = "doc"  # the comment thread on a document as a whole; a paragraph's key is 10 hex digits

CLAIM_TTL = 30 * 60  # an agent's hold on an item: quiet longer than this, another agent may take it
VOICE_HOLD = 150  # seconds an input waits for its voice note's words, at most

MAX_TEXT = 200_000
MAX_FILE = 25 * 1024 * 1024
MAX_OPS = 50
TITLE_MAX = 60

SLUG_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"
KEY_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"  # no 0/o, 1/l/i: easy to type on a phone
PROJECT_NAME = re.compile(r"[a-z0-9][a-z0-9-]{0,39}")  # a project's address and folder, made once from its name

# what the organizer's undo says an item goes back to
STATUS_WORDS = {"proposed": "proposed", "open": "open", "doing": "in progress", "review": "in review", "done": "done",
                "dropped": "won't do"}


class Refused(Exception):
    """A request Taska refuses, with the words that say why (agents and the page show them as they are)."""


def is_person(by: object) -> bool:
    return by in PEOPLE
