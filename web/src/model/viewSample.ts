// What the server sends for a project's view, from a demo project on a fresh Taska (tools/view_sample.py writes
// it). `satisfies ViewAnswer`: the type check fails when the page's types and the server's view differ.

import type { ViewAnswer } from './types'

export const VIEW_SAMPLE = {
 "cursor": "1a1a476a113.5.8.1",
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
   "t0": "2026-11-03T18:50:00-08:00",
   "t1": "2026-11-03T18:50:00-08:00",
   "by": "claude-code",
   "thread": [
    {
     "id": 4,
     "by": "claude-code",
     "kind": "progress",
     "text": "Reproduced it: the export reads the list before the filter",
     "t": "2026-11-03T18:50:00-08:00",
     "src": null,
     "files": []
    },
    {
     "id": 5,
     "by": "claude-code",
     "kind": "ask",
     "text": "Which format should the export use?\n- ( ) CSV\n- ( ) Excel",
     "t": "2026-11-03T18:50:00-08:00",
     "src": null,
     "files": []
    },
    {
     "id": 8,
     "by": "you",
     "kind": "say",
     "text": "And the sort, please.",
     "t": "2026-11-03T18:50:00-08:00",
     "src": "r1",
     "files": []
    }
   ],
   "wait": null,
   "talked": true,
   "agent": {
    "by": "claude-code",
    "t": "2026-11-03T18:50:00-08:00",
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
   "t0": "2026-11-03T18:50:00-08:00",
   "t1": "2026-11-03T18:50:00-08:00",
   "by": "claude-code",
   "thread": [],
   "wait": null,
   "talked": false,
   "agent": {
    "by": "claude-code",
    "t": "2026-11-03T18:50:00-08:00",
    "ses": null
   }
  },
  {
   "n": 3,
   "code": "R3",
   "type": "rule",
   "title": "Keep the filter in every export",
   "body": "",
   "pri": "P1",
   "when": "now",
   "status": "proposed",
   "parent": null,
   "next": "",
   "srcs": [],
   "mergedInto": null,
   "archived": false,
   "t0": "2026-11-03T18:50:00-08:00",
   "t1": "2026-11-03T18:50:00-08:00",
   "by": "claude-code",
   "thread": [],
   "wait": null,
   "talked": false,
   "agent": {
    "by": "claude-code",
    "t": "2026-11-03T18:50:00-08:00",
    "ses": null
   }
  }
 ],
 "inputs": [
  {
   "id": "r1",
   "t": "2026-11-03T18:50:00-08:00",
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
   "t0": "2026-11-03T18:50:00-08:00",
   "t1": "2026-11-03T18:50:00-08:00",
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
  }
 ],
 "project": {
  "slug": "shop",
  "title": "Shop",
  "width": 1,
  "file": "/tmp/taska-sample/data/shop/taska.db",
  "organizer": {
   "on": false,
   "model": "gemini-flash-latest",
   "busy": null
  },
  "agents": [
   {
    "name": "claude-code",
    "t": 1793760600340,
    "waiting": false
   }
  ],
  "work": true,
  "agentsVersion": 1,
  "undo": [],
  "deletedInputs": [],
  "deleted": [],
  "base": "http://127.0.0.1:7340/p/shop",
  "key": "cu5k-mwpb",
  "remote": "",
  "lan": ""
 },
 "server": {
  "page": "index-Cr5r0E7o.js",
  "update": false
 }
} satisfies ViewAnswer
