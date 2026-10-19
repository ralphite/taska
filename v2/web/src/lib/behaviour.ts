// Behaviours the user is deciding on (T318, document D21: changes that drifted from the original requirements).
// Each one is a switch here, so the decision is one line. The values are the one-file Taska's behaviour today,
// except autoReload, which rule R284 already forbids.

export const BEHAVIOUR = {
  // D21 #1: C, New input and a click on the project open a New input page (the box in the middle, what you said
  // lately below it, the draft card between them; B073, B083, I239, B269). Off: the box at the bottom turns into a new
  // input and the item you read stays above it (T274 #8); the page shows only when you come from a document.
  newInputPage: false,
  // D21 #2: finished items from before today go to Archive by themselves when a project opens (T274 #6).
  autoArchive: true,
  // D21 #3: a page reloads itself after Taska is updated. R284 says never: the new code comes with the next reload.
  autoReload: false,
  // D21 #4: an item in progress whose agent has been quiet for 30 minutes says "Stuck" (T274 #7).
  stuckLabel: true,
  // D21 #5: a document comment is written in place: the one input box moves under the passage it is about (B265
  // option B). Off: the box stays at the bottom of the pane and its line says what it comments on.
  docCommentInPlace: true,
}
