# Item states

What an item's status means, who moves it, and the rule that keeps exactly one side responsible at any moment.

```mermaid
stateDiagram-v2
  [*] --> Proposed: an agent proposes it
  [*] --> Open: the user or the organizer makes it
  Proposed --> Open: the user approves
  Proposed --> Dropped: the user declines (won't do)
  Open --> Doing: an agent starts working on it
  Doing --> Open: the agent asks the user, is blocked, or stops
  Doing --> Review: the agent is done
  Review --> Done: the user accepts
  Review --> Open: the user says not yet, or writes on it
  Open --> Dropped: won't do
  Doing --> Dropped: won't do
  Done --> Open: reopened
  Dropped --> Open: reopened
```

`doing` (In progress) means an agent session is working on it now (r942). An open item can also say who acts:

| Open item | Shown as | Who acts |
|---|---|---|
| the agent's last word is an `ask` or a `block` | Needs you | the user |
| the user wrote after the agent's last word | Open (it is the agent's turn) | an agent, by priority |
| neither | Open | an agent, by priority |

`when` (now or later) and `archived` are separate from the status.

## One side responsible at a time

- `doing` is only for work an agent session is doing now. An agent that hands back a result sets the item done (it goes to review) or asks; a result never sits in `doing` (T646). Asking or saying it is blocked sets the item back to open by itself. The agent guide says this in its LOOP part.
- Words from the user move the turn to the agent: on an item in review they set it back to open, and `/next` gives an item first only while an agent is working on it; other replies wait their turn by priority (B606).
- An agent that stops working on an item sets it back to open.
