# Known product gaps

The full browser sweep found these existing issues during the source cleanup. This cleanup does not change
product behavior; these issues remain for separate work. The corresponding checks retain their assertions.

- **Missing document on the phone:** the expected missing-document message is not shown.
- **Item offline on the phone:** the expected offline message is not shown on the item page.
- **Reload while recording:** the expected recording protection does not hold in the reload check.
- **Unsent document choices:** the document card does not show the expected waiting indicator for unsent choices.

The complete browser sweep is therefore not all green. CI runs the verified representative core journeys;
`python3 tools/e2e.py --all` remains available for the full set.

The documentation review also found a historical **Go through / ⇧J guided-triage** promise. The current action
table has J/K item navigation and the Needs you view, but no guided-triage action or stepper. The README and mobile
QA instructions now describe the available controls. Restoring guided triage would be separate product work.
