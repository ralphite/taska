"""What Taska shows: the plain-text answers agents read (/next, /items, a card, /log ...) and the page's state.

The words here are part of the agent interface and must stay exactly as they are: agents parse them.
"""

from __future__ import annotations

import textwrap
import time
from typing import TYPE_CHECKING, Any, Callable, Dict, List, Mapping, Optional, Sequence, Tuple

from .core import CLOSED, MODEL, WORK_TYPES, Doc, Input, Item, first_line, hm, home_short

if TYPE_CHECKING:
    from .store import Store

Ref = Optional[Callable[[str], str]]


def sort_queue(items: List[Item]) -> List[Item]:
    """F291: the order agents take the work. In progress first; then the user's order comes before priority: what
    they dragged or put next keeps its place (rank), and what they never placed goes in by priority, each just before
    the first item of their order that has a lower priority (the page's sortQueue does the same)."""
    out: List[Item] = []
    for doing in (True, False):
        mine = [i for i in items if (i["status"] == "doing") == doing]
        ranked = sorted((i for i in mine if i.get("rank") is not None), key=lambda i: (i["rank"], i["n"]))
        rest = sorted((i for i in mine if i.get("rank") is None), key=lambda i: (i["pri"], i["n"]))
        k = 0
        for r in ranked:
            while k < len(rest) and rest[k]["pri"] < r["pri"]:
                out.append(rest[k])
                k += 1
            out.append(r)
        out += rest[k:]
    return out


def state(s: "Store") -> Dict[str, Any]:
    """Everything the page shows about a project, in one JSON object."""
    with s.lock:
        items: List[Dict[str, Any]] = []
        F, G = s.filings(), s.deletions()
        for it in s.items.values():
            if it.get("deleted"):
                continue
            d = dict(it)
            d["code"] = s.code(it["n"])
            w = s.waiting(it)
            d["wait"] = {"id": w["id"], "kind": w["kind"], "text": w["text"], "by": w["by"], "files": w.get("files", []),
                         **({"ses": w["ses"]} if w.get("ses") else {})} if w else None
            d["reply"] = s.talked(it)  # T438 #13: a comment on its document counts on the page
            if s.reads.get(it["n"]):
                d["read"] = {k: int(v * 1000) for k, v in s.reads[it["n"]].items()}
            items.append(d)

        def doc(d: Doc) -> Dict[str, Any]:
            blocks, detached = s.doc_view(d)
            return dict({k: v for k, v in d.items() if k != "gone"}, blocks=blocks, detached=detached, whole=s.doc_whole(d), open=s.doc_open(d))

        return {"rev": s.rev, "boot": s.boot, "pv": s.pv, **s.presence(), "width": len(str(s.maxn)), "file": home_short(s.path), "cfg": s.cfg, "undo": s.undoable(),
                "org": {"on": s.org_on, "model": MODEL, "busy": s.org_busy},
                "items": items, "inputs": [dict(i, **({"tr_wait": True} if s.held(i) else {}), **({"filing": F[i["id"]]} if i["id"] in F else {}),
                                                **({"drop": G[i["id"]]} if i["id"] in G else {})) for i in s.inputs.values() if not i.get("deleted")],
                "deleted": s.deleted_list(),
                "docs": [doc(d) for d in s.docs.values() if not s.items.get(d["n"], {}).get("deleted") and not d.get("deleted")],
                "gone": s.gone_list()}


def line(s: "Store", it: Item) -> str:
    out = f"{s.code(it['n'])} {it['pri']} {it['when']} {it['status']} {it['title']}"
    w = s.waiting(it)
    if w:
        out += " !" if w["kind"] == "block" else " ?"
    elif s.replied(it):
        out += " <"
    if it["parent"]:
        out += f" ^{s.code(it['parent'])}"
    if it["archived"]:
        out += " [archived]"
    return out


def listing(s: "Store", q: Mapping[str, Sequence[str]]) -> str:
    def one(k: str, d: str = "") -> str:
        return (q.get(k) or [d])[0]

    status, limit = one("status", "active"), int(one("limit", "60") or 60)
    words = one("q").lower().split()
    rows: List[Item] = []
    archived = one("archived")  # "" hide, "1" only archived, "all" both
    for it in s.sorted(s.active()):
        if (archived == "1" and not it["archived"]) or (not archived and it["archived"]):
            continue
        if status == "active" and it["status"] in CLOSED:
            continue
        if status not in ("active", "all") and it["status"] != status:
            continue
        if (one("type") or "") != "rule" and it["type"] == "rule":
            continue  # rules have their own view: GET /rules
        if one("type") and it["type"] != one("type").lower():
            continue
        if one("pri") and it["pri"] != one("pri").upper():
            continue
        if one("when") and it["when"] != one("when").lower():
            continue
        if one("wait") and not s.waiting(it):
            continue
        if one("reply") and not s.replied(it):
            continue
        hay = (s.code(it["n"]) + " " + str(it["n"]) + " " + it["title"] + " " + it["body"] + " " + it["next"]).lower()
        if all(w in hay for w in words):
            rows.append(it)
    out = [line(s, i) for i in rows[:limit]]
    if len(rows) > limit:
        out.append(f"… {len(rows) - limit} more (add &limit=)")
    return f"{len(rows)} items" + ("\n" + "\n".join(out) if out else "") + "\n"


def files_of(s: "Store", it: Item, ref: Ref = None) -> List[str]:
    ref_ = ref or s.local
    seen: set[str] = set()
    out: List[str] = []
    for rid in it["srcs"]:
        for f in s.inputs.get(rid, {}).get("files", []):
            if f["f"] not in seen:
                seen.add(f["f"])
                out.append(ref_(f["f"]))
    return out


def card(s: "Store", it: Item, ref: Ref = None) -> str:
    c = s.code(it["n"])
    out = [f"{c} {it['type']} {it['pri']} {it['when']} {it['status']}{' archived' if it['archived'] else ''}  {it['title']}"]
    if it.get("deleted"):
        out.append(f"deleted by the user together with input {it['deleted']}: stop working on it")
    if it["merged_into"]:
        out.append(f"merged into {s.code(it['merged_into'])}")
    kids = [s.code(i["n"]) for i in s.active() if i["parent"] == it["n"]]
    meta = [x for x in (f"parent {s.code(it['parent'])}" if it["parent"] else "",
                        "kids " + " ".join(kids) if kids else "",
                        "src " + " ".join(it["srcs"]) if it["srcs"] else "") if x]
    if meta:
        out.append(" · ".join(meta))
    if it["next"]:
        out.append("next: " + it["next"])
    w = s.waiting(it)
    if w:
        out.append(f"{'! blocked' if w['kind'] == 'block' else '? asked'}, waiting on the user: " + w["text"])
    elif s.replied(it):
        out.append("< the user replied after the agent's last message (see thread)")
    if it["body"]:
        out.append("body:\n" + it["body"])
    files = files_of(s, it, ref)
    if files:
        out.append("files: " + " ".join(files))
    docs = [d for d in s.docs.values() if d["n"] == it["n"] and not d.get("deleted")]
    if docs:
        out.append("docs: " + "; ".join(f"D{d['d']} {d['title']} ({len(d['comments'])} comments" + (f", {s.doc_open(d)} unanswered" if s.doc_open(d) else "") + ")" for d in docs))
    if it["thread"]:
        out.append("thread:")
        for x in it["thread"][-30:]:
            tag = x["by"] + (f" · {x['ses']}" if x.get("ses") else "") + ("" if x["kind"] == "say" else " " + x["kind"])
            out.append(f"#{x['id']} {hm(x['t'])} {tag}" + (f" (edited {hm(x['edited'])})" if x.get("edited") else "") + f": {x['text']}"
                       + "".join(f" [{(ref or s.local)(f['f'])}]" for f in x.get("files", [])))
    return "\n".join(out) + "\n"


def input_card(s: "Store", inp: Input, ref: Ref = None) -> str:
    ref_ = ref or s.local
    scope = f" →{s.code(inp['scope'])} {s.items[inp['scope']]['title']}" if inp["scope"] else ""
    head = f"{inp['id']} {hm(inp['t'])} {inp['by']}{scope}" + ("" if not inp["acked"] else " [handled]") + (" [deleted by the user]" if inp.get("deleted") else "")
    out = [head]
    if inp["text"]:
        out.append(textwrap.indent(inp["text"], "  "))
    if inp["files"]:
        out.append("  files: " + " ".join(ref_(f["f"]) for f in inp["files"]))
    if inp["org"]:
        out.append(f"  organizer: {inp['org']['msg']}")
    if inp.get("history"):
        out.append(f"  updated: {hm(inp['updated'])}; latest text above replaces earlier versions")
        out.append("  linked items: " + " ".join(s.code(n) for n in inp["touched"]))
    return "\n".join(out)


def inbox(s: "Store", ref: Ref = None) -> str:
    rows = sorted(s.for_agent(), key=lambda i: int(i["id"][1:]))
    busy = sum(1 for i in s.pending() if s.org_on and not i["org"])
    head = f"inbox {len(rows)} pending" + (f" (+{busy} being organized)" if busy else "") + f" · {s.mode()}\n"
    return head + "".join(input_card(s, i, ref) + "\n" for i in rows)


def rules_text(s: "Store") -> str:
    rows = s.rules()
    out = [f"{len(rows)} project rule{'s' if len(rows) != 1 else ''} in force. Follow the ones that apply to what you are doing." if rows else "No project rules yet."]
    for it in rows:
        out.append(f"{s.code(it['n'])} {it['title']}" + ("\n" + textwrap.indent(it["body"], "  ") if it["body"] else ""))
    return "\n".join(out) + "\n"


def doc_text(s: "Store", d: Doc) -> str:
    blocks, detached = s.doc_view(d)
    titled = blocks and " ".join(blocks[0]["text"].lstrip("#").split()) == d["title"]
    out = [f"D{d['d']} on {s.code(d['n'])}{'' if titled else ': ' + d['title']}  (updated {hm(d['t1'])} by {d['by']}; reply with: D{d['d']} reply ¶N <text>, ¶0 for the whole document)"]
    whole = s.doc_whole(d)
    if whole:  # B247
        out.append("¶0 comments on the whole document:")
        for c in whole:
            out.append(f"   > {c['by']} {hm(c['t'])}: {c['text']}" + "".join(f" [{s.local(f['f'])}]" for f in c.get("files", [])))
    for i, b in enumerate(blocks, 1):
        out.append(f"¶{i} " + b["text"].replace("\n", "\n   "))
        for c in b["comments"]:
            part = "" if " ".join(c["quote"].split()) == " ".join(b["text"].split()) else f"on \"{first_line(c['quote'], 120)}\": "
            out.append(f"   > {c['by']} {hm(c['t'])}: {part}{c['text']}" + "".join(f" [{s.local(f['f'])}]" for f in c.get("files", [])))
    if detached:
        out.append("comments whose paragraph was rewritten or removed:")
        for t in detached:
            out.append(f"   on \"{first_line(t['quote'], 80)}\"")
            for c in t["comments"]:
                out.append(f"   > {c['by']} {hm(c['t'])}: {c['text']}")
    return "\n".join(out) + "\n"


def next_text(s: "Store", ref: Ref = None, who: Optional[str] = None, given: Optional[List[int]] = None) -> Tuple[str, bool]:
    """-> (text, has_work). who: the agent asking: items another agent is on are skipped for it (F194). given (a
    list) gets the item whose card it holds, if any."""
    if s.gone:
        return f"Project {s.name} was deleted: there is no work here. The user can restore it in Taska (Settings › Projects).\n", False
    auto = s.cfg["auto"]
    out = [s.mode() + (": keep working without stopping. After each item, write back, then GET /next again."
                       if auto else ": finish what you are doing, write back, then stop and wait for the user.")]
    if s.rules():
        out.append(f"{len(s.rules())} project rule{'s' if len(s.rules()) != 1 else ''}: read GET /rules once per session and follow those that apply.")
    live = s.sorted(i for i in s.active() if i["status"] not in CLOSED and not i["archived"])  # F281: an archived item rests, whatever its state
    talking = {n for r in s.inputs.values() if s.held(r) for n in [r["scope"], *r["touched"]] if n}  # B165
    for label, rows in (("waiting on the user (skip)", [i for i in live if s.waiting(i)]),
                        ("proposed, the user has not approved yet (skip)", [i for i in live if i["status"] == "proposed" and not s.replied(i)]),
                        ("in review, the user accepts them (skip)", [i for i in live if i["status"] == "review" and not s.replied(i)]),  # B286: replied ones come back below
                        ("the user's voice note on it is being transcribed (skip, it comes next)", [i for i in live if i["n"] in talking])):
        if rows:
            out.append(f"{label}: " + " ".join(s.code(i["n"]) for i in rows))
    inbox_ = s.for_agent()
    if inbox_:
        return "\n".join(out) + f"\nfirst handle the inbox ({len(inbox_)}):\n" + "".join(input_card(s, i, ref) + "\n" for i in sorted(inbox_, key=lambda i: int(i["id"][1:]))), True
    docs = [d for d in s.docs.values() if s.doc_open(d) and not d.get("deleted") and s.items.get(d["n"]) and not s.items[d["n"]]["merged_into"] and not s.items[d["n"]].get("deleted")]
    if docs:
        d = min(docs, key=lambda d: d["t1"])
        return "\n".join(out) + f"\nanswer the user's comments on D{d['d']} (GET /D{d['d']}):\n" + doc_text(s, d), True
    live = [i for i in live if i["n"] not in talking]  # their latest words are not in yet: they come next
    back = sorted((i for i in live if s.replied(i)), key=lambda i: i["t1"])
    if back:
        if given is not None:
            given.append(back[0]["n"])
        return "\n".join(out) + f"\nresume {s.code(back[0]['n'])}: the user replied\n" + card(s, back[0], ref), True
    queue = sort_queue([i for i in live if i["when"] == "now" and i["type"] in WORK_TYPES and i["status"] in ("open", "doing") and not s.waiting(i)
                        and not s.open_kids(i)])  # subitems first: the parent comes when they are finished
    if who:  # F194: what another agent is on is theirs; each agent gets its own next item
        theirs = [(i, c[0]) for i in queue for c in [s.claimer(i)] if c and c[0] != who]
        if theirs:
            out.append("others are on (skip): " + " ".join(f"{s.code(i['n'])} ({a})" for i, a in theirs))
            queue = [i for i in queue if all(i is not x for x, _ in theirs)]
    if queue:
        it = queue[0]
        if who:
            s.claims[it["n"]] = (who, time.time())
        if given is not None:
            given.append(it["n"])
        how = ("\nan idea: think it through first. Small and clear: do it. Bigger, or more than one way to go: "
               f"post your plan ({s.code(it['n'])} propose ...) and ask before building.") if it["type"] == "idea" else ""
        return "\n".join(out) + f"\nnext {s.code(it['n'])} ({len(queue)} in queue: doing first, then P0→P3, oldest first){how}\n" + card(s, it, ref), True
    idle = "nothing to do now." + (" Wait for work: GET /next?wait=540 (returns as soon as something comes in)." if auto else "")
    return "\n".join(out) + "\n" + idle + "\n", False


LOG_WORDS = {
    "idel": lambda s, e: "deleted " + " ".join(s.code(n) for n in e.get("ns", [])),
    "iundel": lambda s, e: "restored " + " ".join(s.code(n) for n in e.get("ns", [])),
    "ddel": lambda s, e: f"{'deleted' if e.get('on', True) else 'restored'} D{e['d']}",
    "dmove": lambda s, e: f"D{e['d']} moved to {s.code(e['to'])}",
    "dcmove": lambda s, e: f"moved a comment on D{e['d']}",
    "unfile": lambda s, e: f"took {e['f']} off " + (f"a comment on D{e['d']}" if e.get("d") else str(e.get("src"))),
    "hide": lambda s, e: f"{'hid' if e.get('on', True) else 'showed'} a message on {s.code(e['n'])}",
    "rescope": lambda s, e: f"{e['src']} now goes with {s.code(e['to'])}",
}  # v2: the old log stopped on these changes (it read them as the organizer's); they are said in words now


def log(s: "Store", n: int) -> str:
    return "".join(f"#{x['seq']} {hm(x['t'])} {x['who']}{' · ' + x['ses'] if x.get('ses') else ''} {x['what']}\n"
                   for x in log_entries(s, n)) or "\n"


def log_entries(s: "Store", n: int, before: int = 0) -> List[Dict[str, Any]]:
    """The last n changes, one each: {seq, t, who, what} (T339: the page reads these; agents read log() above).
    With `before`, the n changes before that one (T427: the page loads more as you scroll down)."""
    out: List[Dict[str, Any]] = []
    evs = s.events
    if before:
        lo, hi = 0, len(evs)
        while lo < hi:  # events are in seq order: the first at or after `before`
            mid = (lo + hi) // 2
            if evs[mid]["seq"] < before:
                lo = mid + 1
            else:
                hi = mid
        evs = evs[:lo]
    for e in evs[-n:]:
        k, who = e["k"], e.get("by", "")
        if k == "in":
            t = f"in {e['id']}" + (f" →{s.code(e['scope'])}" if e.get("scope") else "") + f" {first_line(e.get('text', ''))!r}"
        elif k == "add":
            t = f"new {s.code(e['n'])} {e['type']} {e['pri']} {e['when']} {first_line(e['title'])!r}" + (f" ←{e['src']}" if e.get("src") else "")
        elif k == "set":
            t = f"{s.code(e['n'])} " + ", ".join(f"{a} {first_line(e['was'].get(a, ''), 24)}→{first_line(b, 24)}" for a, b in e["f"].items()) + (f" (undo #{e['undo_of']})" if e.get("undo_of") else "")
        elif k == "say":
            t = f"{s.code(e['n'])} {e['kind']} {first_line(e['text'])!r}"
        elif k == "merge":
            t = f"{s.code(e['n'])} merged into {s.code(e['into'])}"
        elif k == "ack":
            t = "ack " + " ".join(e["ids"])
        elif k == "cfg":
            t = f"renamed the project {e['f']['name']!r}" if "name" in e["f"] else "keep-going " + ("ON" if e["f"].get("auto") else "OFF")
        elif k == "doc":
            t = f"doc D{e['d']} on {s.code(e['n'])} {first_line(e.get('title', ''))!r}"
        elif k == "dc":
            t = f"D{e['d']} comment {first_line(e['text'])!r}"
        elif k == "dcres":
            t = f"{'resolved' if e.get('on') else 'reopened'} a thread on D{e['d']}"
        elif k in ("dcedit", "dcdel", "dcundel"):
            t = {"dcedit": f"edited a comment on D{e['d']}: {first_line(e.get('text', ''))!r}", "dcdel": f"deleted a comment on D{e['d']}", "dcundel": f"restored a comment on D{e['d']}"}[k]
        elif k == "undo":
            t = f"undo organizer changes for {e['src']}"
        elif k == "redo":
            t = f"redo organizer changes for {e['src']}"
        elif k == "unmake":
            t = f"{s.code(e['n'])} unmade: {e['src']} waits again"
        elif k in ("del", "undel"):
            t = f"{e['src']} {'deleted' if k == 'del' else 'restored'}" + (" with " + " ".join(s.code(n) for n in e["ns"]) if e.get("ns") else "") \
                + ("; kept " + ", ".join(f"{s.code(n)} ({why})" for n, why in e["kept"]) if e.get("kept") else "")
        elif k == "arch":
            t = f"{'archived' if e['on'] else 'unarchived'} {len(e['ns'])}: " + " ".join(s.code(n) for n in e["ns"][:12]) + (" …" if len(e["ns"]) > 12 else "")
        elif k == "moved":
            t = f"{e['src']} moved to {e['to']} as {e['as']}"
        elif k == "amend":
            t = f"{e['src']} {e['mode']}: {first_line(e['text'])!r}"
        elif k == "tr":
            t = f"{e['src']} voice note words: {first_line(e['tr'])!r}"
        elif k in LOG_WORDS:
            t = LOG_WORDS[k](s, e)
        elif k != "org" and "src" not in e:  # a kind this log has no words for (like B406's "plain"): said as it is
            t = f"{k} {e.get('id', '')}".rstrip()
        elif e.get("retry"):
            t = f"organizer {e['src']} retry"
        else:
            t = f"organizer {e['src']} {'ok' if e.get('ok') else 'FAILED'}: {first_line(e.get('msg', ''), 90)}"
            who = "org"
        out.append({"seq": e["seq"], "t": e["t"], "who": who, "what": t, **({"ses": e["ses"]} if e.get("ses") else {})})
    return out
