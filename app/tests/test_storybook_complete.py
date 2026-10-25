"""Storybook keeps every group and story Yadong relies on (Demo, Pages, Prototype, Review: 10-24, "those are very
important"): each one in app/web/.storybook/required-stories.json, by the name Storybook shows, must be there. The
ones still being made are listed in NOT_YET; that list only gets shorter."""

import json
import os
import re
import unittest
from typing import Dict, List

WEB = os.path.join(os.path.dirname(__file__), "..", "web")
# still being made (10-24): each goes from this list once its stories are there
NOT_YET = {
    "Demo/Agents", "Demo/Document", "Demo/Item changes", "Demo/Item list", "Demo/Item page", "Demo/Keyboard",
    "Demo/Needs you", "Demo/New input", "Demo/Phone gestures", "Demo/Projects", "Demo/Settings", "Demo/Side lists",
    "Demo/Sync and errors", "Demo/Voice", "Pages/Dev", "Pages/Document", "Pages/Inputs", "Pages/Item list",
    "Pages/Item page/By item status", "Pages/Item page/By what it holds", "Pages/Item page/Loading and errors",
    "Pages/Projects", "Pages/Settings", "Pages/Side lists", "Prototype/F479 Search everything",
    "Prototype/New mobile layout", "Review/B498 Comment on a place: voice and words", "Review/B510 Finished and asks you",
}


def shown_name(export: str) -> str:
    """The name Storybook gives a story from its export (WriteANewInput: Write A New Input)."""
    return " ".join(w[:1].upper() + w[1:] for w in re.findall(r"[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+", export))


def stories() -> Dict[str, List[str]]:
    """Each group in the page's stories, and its stories' shown names."""
    out: Dict[str, List[str]] = {}
    for folder, dirs, files in os.walk(os.path.join(WEB, "src")):
        for f in files:
            if not f.endswith(".stories.tsx"):
                continue
            with open(os.path.join(folder, f), encoding="utf-8") as fh:
                text = fh.read()
            m = re.search(r"title:\s*'([^']+)'", text)
            if not m:
                continue
            parts = re.split(r"^export const (\w+)", text, flags=re.M)
            names = out.setdefault(m.group(1), [])
            for name, body in zip(parts[1::2], parts[2::2]):
                if name[0].isupper():
                    given = re.search(r"\bname:\s*(['\"`])(.+?)\1", body)
                    names.append(given.group(2) if given else shown_name(name))
    return out


class StorybookTest(unittest.TestCase):
    def test_every_group_and_story_is_there(self) -> None:
        with open(os.path.join(WEB, ".storybook", "required-stories.json"), encoding="utf-8") as fh:
            required: Dict[str, List[str]] = json.load(fh)["groups"]
        have = stories()
        missing = [f"{g}: {s}" for g, names in required.items() if g not in NOT_YET for s in names if s not in have.get(g, [])]
        self.assertEqual(missing, [])

    def test_not_yet_only_gets_shorter(self) -> None:
        have = stories()
        self.assertEqual(sorted(g for g in NOT_YET if g in have), [], "made now: take it off NOT_YET")


if __name__ == "__main__":
    unittest.main()
