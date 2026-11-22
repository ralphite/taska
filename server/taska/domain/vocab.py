"""The words of Taska's data: task codes and tags, priorities, statuses, message kinds, who is a person.

These are part of the stored format and of the agent interface: they never change.
"""

from __future__ import annotations

import re

# tasks have no types (T855, D152): every code is T and a number; the letters of the old types still name the same
# task (B838 is T838). The project's rules are one document, not tasks (I693, r1118): R is no code
CODE_LETTER = "T"
OLD_LETTERS = "FBIT"
OLD_TYPES = ("feature", "bug", "idea", "task")  # what `new bug ...` and `B03 bug` once said: refused with a rewrite
# a tag is #word: letters of any language, digits, - and _ (#bug, #手机); stored without the #, in lower case
TAG = re.compile(r"#([\w-]{1,30})")
PRIORITIES = ("P0", "P1", "P2", "P3")
# a new task's priority when nobody says one: P1, the user's rule (r10, r1072); tests/test_default_priority.py holds it
DEFAULT_PRI = "P1"
WHENS = ("now", "later")
STATUSES = ("proposed", "open", "doing", "review", "done", "dropped")
CLOSED = ("done", "dropped")
# the two choices of a proposal (approve, won't do) and of finished work (accept, not yet)
DECISIONS = {"proposed": ("open", "dropped"), "review": ("done", "open")}
# "you" is the user; the organizer writes down what the user said, so it acts for the user
PEOPLE = ("you", "org")
# Taska's own notes to an agent (a diagram that does not draw, B714 r1181) are neither side's word, as the organizer's
TASKA = "taska"
NOTES = ("org", TASKA)
MESSAGE_KINDS = ("say", "ask", "withdraw", "propose", "decide", "progress")
TEXT_VERBS = MESSAGE_KINDS + ("title", "body", "next")
USER_KINDS = ("say", "decide", "propose")  # what the organizer files from an input: the user's words, decision, idea
DOC_KEY = "doc"  # the comment thread on a document as a whole; a paragraph's key is 10 hex digits

CLAIM_TTL = 30 * 60  # an agent's hold on a task: quiet longer than this, another agent may take it
VOICE_HOLD = 150  # seconds an input waits for its voice note's words, at most

MAX_TEXT = 200_000
MAX_FILE = 25 * 1024 * 1024
MAX_OPS = 50
TITLE_MAX = 60

SLUG_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"
KEY_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"  # no 0/o, 1/l/i: easy to type on a phone
PROJECT_NAME = re.compile(r"[a-z0-9][a-z0-9-]{0,39}")  # a project's address and folder, made once from its name

# what the organizer's undo says a task goes back to
STATUS_WORDS = {"proposed": "proposed", "open": "open", "doing": "in progress", "review": "in review", "done": "done",
                "dropped": "won't do"}


class Refused(Exception):
    """A request Taska refuses, with the words that say why (agents and the page show them as they are)."""


def is_person(by: object) -> bool:
    return by in PEOPLE
