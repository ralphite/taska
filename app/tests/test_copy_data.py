"""A copy of a Taska data folder: the databases as they are while in use, every file, and no link."""

import os
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))

import copy_data  # noqa: E402


class CopyDataTest(unittest.TestCase):
    def test_copies_all_but_links(self) -> None:
        top = tempfile.mkdtemp()
        src, dst, elsewhere = os.path.join(top, "from"), os.path.join(top, "to"), os.path.join(top, "elsewhere")
        os.makedirs(os.path.join(src, "taska-files"))
        os.makedirs(elsewhere)
        c = sqlite3.connect(os.path.join(src, "taska.db"))
        c.execute("CREATE TABLE events (n INTEGER)")
        c.execute("INSERT INTO events VALUES (7)")
        c.commit()
        with open(os.path.join(src, "taska-files", "note.txt"), "w") as f:
            f.write("kept")
        os.symlink(elsewhere, os.path.join(src, "taska-files", "outside"))
        os.symlink(os.path.join(src, "taska.db"), os.path.join(src, "again.db"))
        left_out: list = []
        copy_data.copy_tree(src, dst, left_out)
        c.close()
        self.assertEqual(sqlite3.connect(os.path.join(dst, "taska.db")).execute("SELECT n FROM events").fetchall(), [(7,)])
        with open(os.path.join(dst, "taska-files", "note.txt")) as f:
            self.assertEqual(f.read(), "kept")
        self.assertEqual(sorted(os.path.basename(p) for p in left_out), ["again.db", "outside"])
        links = [os.path.join(d, n) for d, ds, fs in os.walk(dst) for n in ds + fs if os.path.islink(os.path.join(d, n))]
        self.assertEqual(links, [])
        self.assertFalse(os.path.exists(os.path.join(dst, "taska-files", "outside")))


if __name__ == "__main__":
    unittest.main()
