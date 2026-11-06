// What the server sends for a project's view, from a demo project on a fresh Taska (tools/view_sample.py writes
// it). `satisfies ViewAnswer`: the type check fails when the page's types and the server's view differ.

import type { ViewAnswer } from './types'

export const VIEW_SAMPLE = {
 "cursor": "1a1b30f9368.5.9.1",
 "full": true,
 "items": [
  {
   "n": 1,
   "code": "B1",
   "type": "bug",
   "title": "Export ignores the active filter",
   "body": "The export should keep the filter I set.",
   "pri": "P1",
   "when": "now",
   "status": "proposed",
   "parent": null,
   "next": "",
   "srcs": [
    "r1"
   ],
   "mergedInto": null,
   "archived": false,
   "t0": "2026-11-06T14:51:44-08:00",
   "t1": "2026-11-06T14:51:44-08:00",
   "by": "claude-code",
   "thread": [
    {
     "id": 4,
     "by": "claude-code",
     "kind": "progress",
     "text": "Reproduced it: the export reads the list before the filter",
     "t": "2026-11-06T14:51:44-08:00",
     "src": null,
     "files": []
    },
    {
     "id": 5,
     "by": "claude-code",
     "kind": "ask",
     "text": "Which format should the export use?\n- ( ) CSV\n- ( ) Excel",
     "t": "2026-11-06T14:51:44-08:00",
     "src": null,
     "files": []
    },
    {
     "id": 8,
     "by": "you",
     "kind": "say",
     "text": "And the sort, please.",
     "t": "2026-11-06T14:51:44-08:00",
     "src": "r1",
     "files": []
    }
   ],
   "wait": null,
   "talked": true,
   "agent": {
    "by": "claude-code",
    "t": "2026-11-06T14:51:44-08:00",
    "ses": null
   }
  },
  {
   "n": 2,
   "code": "T2",
   "type": "task",
   "title": "Read the filter from the address",
   "body": "",
   "pri": "P2",
   "when": "later",
   "status": "proposed",
   "parent": 1,
   "next": "",
   "srcs": [],
   "mergedInto": null,
   "archived": false,
   "t0": "2026-11-06T14:51:44-08:00",
   "t1": "2026-11-06T14:51:44-08:00",
   "by": "claude-code",
   "thread": [],
   "wait": null,
   "talked": false,
   "agent": {
    "by": "claude-code",
    "t": "2026-11-06T14:51:44-08:00",
    "ses": null
   }
  }
 ],
 "inputs": [
  {
   "id": "r1",
   "t": "2026-11-06T14:51:44-08:00",
   "by": "you",
   "text": "And the sort, please.",
   "scope": 1,
   "files": [],
   "acked": false,
   "touched": [
    1
   ],
   "org": null,
   "seq": 8,
   "v": 0
  }
 ],
 "docs": [
  {
   "d": 1,
   "n": 1,
   "title": "Plan",
   "md": "# Plan\nFirst read the filter, then write the rows.",
   "t0": "2026-11-06T14:51:44-08:00",
   "t1": "2026-11-06T14:51:44-08:00",
   "by": "claude-code",
   "versions": 1,
   "fmt": "md",
   "blocks": [
    {
     "key": "4be021e4c5",
     "kind": "heading",
     "text": "# Plan",
     "comments": []
    },
    {
     "key": "bb67d18fbe",
     "kind": "para",
     "text": "First read the filter, then write the rows.",
     "comments": []
    }
   ],
   "detached": [],
   "whole": [],
   "unanswered": 0,
   "resolved": {}
  },
  {
   "kind": "rules",
   "proposals": [
    {
     "id": 7,
     "by": "claude-code",
     "t": "2026-11-06T14:51:44-08:00",
     "why": "Keep the filter in every export",
     "state": "wait",
     "on": 0,
     "comments": [],
     "md": "## Commits\n\n- In English.\n\n## Exports\n\n- Keep the filter in every export."
    }
   ],
   "history": [
    {
     "v": 1,
     "by": "you",
     "t0": "2026-11-06T14:51:44-08:00",
     "t": "2026-11-06T14:51:44-08:00",
     "md": "## Commits\n\n- In English.",
     "whys": [
      "Commits"
     ],
     "srcs": [],
     "seq": 9
    }
   ],
   "d": 2,
   "n": 0,
   "title": "Rules",
   "md": "## Commits\n\n- In English.",
   "t0": "2026-11-06T14:51:44-08:00",
   "t1": "2026-11-06T14:51:44-08:00",
   "by": "you",
   "versions": 1,
   "fmt": "md",
   "blocks": [
    {
     "key": "e38605b23e",
     "kind": "heading",
     "text": "## Commits",
     "comments": []
    },
    {
     "key": "56d638c588",
     "kind": "list",
     "text": "- In English.",
     "comments": []
    }
   ],
   "detached": [],
   "whole": [],
   "unanswered": 0,
   "resolved": {}
  }
 ],
 "voices": [],
 "project": {
  "slug": "shop",
  "title": "Shop",
  "width": 1,
  "file": "/tmp/taska-sample/data/shop/taska.db",
  "organizer": {
   "on": false,
   "model": "gemini-3.1-pro-preview + gemini-3.8-flash",
   "busy": []
  },
  "agents": [
   {
    "name": "claude-code",
    "t": 1794005504873,
    "waiting": false
   }
  ],
  "work": true,
  "agentsVersion": 1,
  "undo": [],
  "deletedInputs": [],
  "deleted": [],
  "phone": false,
  "base": "http://127.0.0.1:7340/p/shop",
  "key": "kncw-sen4",
  "remote": "",
  "lan": ""
 },
 "server": {
  "page": "da39a3ee5e",
  "update": false
 }
} satisfies ViewAnswer
