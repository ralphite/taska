# Known product gaps

No product gap is known to fail a browser check now. The four that did (a missing document and a task's offline
message on the phone, the reload while recording, and the waiting mark for unsent document choices) passed three
times on 2026-11-15 and in two full sweeps on 2026-11-08, so their lines are out of `web/e2e/known.txt`. A new gap
goes there, one line for its check, and here: `python3 tools/e2e.py --gate`, which a ship runs, reports a listed
check failing and goes on; any other failure stops the ship. Take its line out of both once the gap is fixed.

The documentation review also found a historical **Go through / ⇧J guided-triage** promise. The current action
table has J/K task navigation and the Needs you view, but no guided-triage action or stepper. The README and mobile
QA instructions now describe the available controls. Restoring guided triage would be separate product work.
