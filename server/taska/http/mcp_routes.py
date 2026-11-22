"""Taska over MCP (T866, Yadong r1467): each project at /p/<name>/mcp, so an agent that speaks MCP (Claude Code, Codex,
Cursor, Claude's and ChatGPT's apps) adds it once and has Taska's tools, typed, instead of reading the guide and writing
curl. Streamable HTTP, answered as JSON (no event stream): JSON-RPC 2.0 posted, one answer per request.

Each tool asks Taska what an agent's curl would (/next, /T03, /tasks, /do ...), through the same routes, so the two
answer alike. A connection is one session: its id names the agent (from the client's name) and a part of its own, so a
session is known again after a restart and two connections are two sessions (T862), never one shared "claude-code"."""

from __future__ import annotations

import json
import re
import secrets
from typing import TYPE_CHECKING, Any, Callable, Dict, List, Optional, Tuple
from urllib.parse import quote, urlencode

from ..domain.vocab import MAX_FILE, Refused
from ..services.project import Project
from . import agent_routes
from .messages import Request, Response, as_json, text

if TYPE_CHECKING:
    from .app import AppContext

PROTOCOL = "2025-06-18"
SESSION = re.compile(r"([a-z][a-z0-9-]{0,19})\.([A-Za-z0-9_-]{8,40})")
INSTRUCTIONS = (
    "Taska is the user's tracker of the work in this project: tasks (codes like T03) with tags, groups and documents, "
    "and the user's words (inputs, r12) that became them. Call next to get work and do what it says: it gives your "
    "next task's card, or inputs to handle first. Write back on the task as you go (say: progress, ask with choices, "
    "done with your report), then call next again. Read guide once for the rules of the work.")


def _agent(client: str) -> str:
    """The agent's name in Taska, from the name its MCP client gives."""
    c = client.lower()
    for known in ("claude-code", "codex", "antigravity", "cursor", "chatgpt"):
        if known in c or (known == "claude-code" and "claude" in c):
            return known
    return re.sub(r"[^a-z0-9-]", "-", c)[:20].strip("-") or "agent"


S = {"type": "string"}
CODE = {"type": "string", "description": "a task's code, like T03"}
TOOLS: List[Dict[str, Any]] = [
    {"name": "next", "description": "Your next work: inputs to handle first, a task the user replied on, or the next "
     "task in the queue (its card), or nothing to do now. wait: seconds to hold for work when there is none (0-540).",
     "inputSchema": {"type": "object", "properties": {"wait": {"type": "integer", "minimum": 0, "maximum": 540}}}},
    {"name": "task", "description": "A task's card: its words, every level it is part of, its thread, documents and "
     "the user's inputs it came from.", "inputSchema": {"type": "object", "properties": {"code": CODE}, "required": ["code"]}},
    {"name": "tasks", "description": "The open tasks, one line each; filters optional.",
     "inputSchema": {"type": "object", "properties": {
         "q": S, "tag": {"type": "string", "description": "a tag without #"},
         "status": {"type": "string", "enum": ["open", "doing", "done", "dropped", "all"]},
         "pri": {"type": "string", "enum": ["P0", "P1", "P2", "P3"]}, "archived": {"type": "boolean"}}}},
    {"name": "inbox", "description": "The user's inputs waiting for an agent.", "inputSchema": {"type": "object", "properties": {}}},
    {"name": "say", "description": "Write on a task. kind: say (a note), progress, ask (a question for the user; give "
     "choices to make it one to pick), propose (a plan the user approves), done (finished: your report; the task goes "
     "to the user's review).", "inputSchema": {"type": "object", "properties": {
         "code": CODE, "text": S, "kind": {"type": "string", "enum": ["say", "progress", "ask", "propose", "done"]},
         "choices": {"type": "array", "items": S}, "pick": {"type": "string", "enum": ["one", "any"]},
         "src": {"type": "string", "description": "the input it answers, like r12"}},
         "required": ["code", "text"]}},
    {"name": "set", "description": "Change a task: status, priority, now or later, tags on or off, what it waits for, "
     "its parent, or make it a group (or a task again).", "inputSchema": {"type": "object", "properties": {
         "code": CODE, "status": {"type": "string", "enum": ["open", "doing", "done", "drop"]},
         "pri": {"type": "string", "enum": ["P0", "P1", "P2", "P3"]}, "when": {"type": "string", "enum": ["now", "later"]},
         "tags": {"type": "array", "items": S, "description": "tags to put on (without #)"},
         "untag": {"type": "array", "items": S, "description": "tags to take off"},
         "after": {"type": "string", "description": "the code it waits for; -T12 waits no more"},
         "parent": {"type": "string", "description": "the code of the task or group to put it in"},
         "group": {"type": "boolean", "description": "true: a group; false: a task again"}}, "required": ["code"]}},
    {"name": "new", "description": "A new task (or group). It starts proposed: the user approves it, unless it is a part "
     "the user asked for (give src, the input that asked).", "inputSchema": {"type": "object", "properties": {
         "title": S, "body": S, "pri": {"type": "string", "enum": ["P0", "P1", "P2", "P3"]},
         "tags": {"type": "array", "items": S}, "parent": S, "after": S, "src": S, "group": {"type": "boolean"}},
         "required": ["title"]}},
    {"name": "doc", "description": "Read a document (d: its number), or write one: on a task (code, title, markdown) or "
     "over a document's text (d, markdown).", "inputSchema": {"type": "object", "properties": {
         "d": {"type": "integer"}, "code": CODE, "title": S, "markdown": S}}},
    {"name": "ack", "description": "Inputs handled (codes like r12).", "inputSchema": {
        "type": "object", "properties": {"inputs": {"type": "array", "items": S}}, "required": ["inputs"]}},
    {"name": "do", "description": "Any of Taska's commands as an agent writes them, one per line (the guide lists them).",
     "inputSchema": {"type": "object", "properties": {"commands": S}, "required": ["commands"]}},
    {"name": "guide", "description": "The guide for agents: how to work in Taska, every command.",
     "inputSchema": {"type": "object", "properties": {}}},
]


READ_ONLY = {"task", "tasks", "inbox", "guide"}  # next holds the task it gives for the session: it changes something
for _t in TOOLS:
    _t["annotations"] = {"readOnlyHint": _t["name"] in READ_ONLY, "destructiveHint": False, "openWorldHint": False}


class _Headers:
    def __init__(self, d: Dict[str, str]):
        self.d = {k.lower(): v for k, v in d.items()}

    def get(self, name: str, /) -> Optional[str]:
        return self.d.get(name.lower())


def _indented(s: str) -> str:
    return "".join(f"\n    {line}" for line in s.strip("\n").split("\n")) if s.strip() else ""


def commands(name: str, a: Dict[str, Any]) -> str:
    """A writing tool's call as the commands an agent writes."""
    if name == "do":
        return str(a.get("commands") or "")
    if name == "ack":
        return "ack " + " ".join(str(x) for x in a.get("inputs") or [])
    if name == "say":
        kind = a.get("kind") or "say"
        body = str(a.get("text") or "")
        if kind == "ask" and a.get("choices"):
            box = "[ ]" if a.get("pick") == "any" else "( )"
            body += "".join(f"\n- {box} {c}" for c in a["choices"])
        src = f" src={a['src']}" if a.get("src") else ""
        return f"{a['code']} {kind}{src}" + _indented(body)
    if name == "set":
        c, out = a["code"], []
        fields = " ".join(str(a[k]) for k in ("pri", "when", "status") if a.get(k))
        if fields:
            out.append(f"{c} {fields}")
        tags = [f"#{t.lstrip('#')}" for t in a.get("tags") or []] + [f"-#{t.lstrip('#')}" for t in a.get("untag") or []]
        if tags:
            out.append(f"{c} " + " ".join(tags))
        if a.get("after"):
            out.append(f"{c} after {a['after']}")
        if a.get("parent"):
            out.append(f"{c} parent={a['parent']}")
        if "group" in a:
            out.append(f"{c} {'group' if a['group'] else 'task'}")
        return "\n".join(out)
    if name == "new":
        opts = [a["pri"]] if a.get("pri") else []
        opts += [f"#{t.lstrip('#')}" for t in a.get("tags") or []]
        opts += [f"{k}={a[k]}" for k in ("parent", "after", "src") if a.get(k)]
        head = "new group" if a.get("group") else "new"
        return " ".join([head, *opts, str(a["title"])]) + _indented(str(a.get("body") or ""))
    if name == "doc":
        target = f"D{a['d']}" if a.get("d") else str(a.get("code") or "")
        return f"{target} doc {a.get('title') or ''}".rstrip() + _indented(str(a.get("markdown") or ""))
    raise ValueError(f"no tool {name}")


def reads(name: str, a: Dict[str, Any]) -> Optional[str]:
    """A reading tool's call as the path an agent's curl asks for (None: it writes)."""
    if name == "next":
        return "/next" + (f"?wait={int(a['wait'])}" if a.get("wait") else "")
    if name == "task":
        return "/" + quote(str(a["code"]))
    if name == "tasks":
        q = {k: str(a[k]) for k in ("q", "tag", "status", "pri") if a.get(k)}
        if a.get("archived"):
            q["archived"] = "1"
        return "/tasks" + (f"?{urlencode(q)}" if q else "")
    if name == "inbox":
        return "/inbox"
    if name == "guide":
        return "/agent"
    if name == "doc" and a.get("d") and not a.get("markdown"):
        return f"/D{int(a['d'])}"
    return None


def _call(ctx: "AppContext", req: Request, p: Project, base: str, who: Tuple[str, str], name: str,
          a: Dict[str, Any]) -> Tuple[str, bool]:
    """A tool's answer -> (its text, whether it failed)."""
    by, ses = who
    path = reads(name, a)
    if path is None and name not in ("say", "set", "new", "doc", "ack", "do"):
        raise ValueError(f"no tool {name}")
    body = b"" if path is not None else commands(name, a).encode("utf-8")
    sub = path or "/do"
    who_q = urlencode({"by": by, "session": ses})
    raw = f"{req.prefix}/p/{p.slug}{sub}{'&' if '?' in sub else '?'}{who_q}"
    inner = Request("GET" if path is not None else "POST", raw, _Headers({"Host": req.header("Host")}), req.client_ip,
                    lambda limit: body[:limit], req.prefix)
    try:
        answer = agent_routes.get(inner, p, sub.split("?")[0], base) if path is not None else agent_routes.do(inner, p)
    except Refused as ex:
        return f"{ex}", True
    if answer is None:
        return f"nothing at {sub}", True
    said = answer.body.decode("utf-8", "replace")
    if name == "next" and "\nnothing to do now" in said:  # the curl wait it names is not for a session over MCP
        said = said[:said.index("\nnothing to do now")] + ("\nnothing to do now. End your turn, or call next with wait "
                                                          "(up to 540 seconds): it answers as soon as there is work.\n")
    failed = answer.status >= 400 or any(line.startswith("err") for line in said.splitlines())
    return said, failed


def _answer(ctx: "AppContext", req: Request, p: Project, base: str, msg: Dict[str, Any], sid: str
            ) -> Tuple[Optional[Dict[str, Any]], str]:
    """One JSON-RPC message -> (its answer, None for a notification; the session id)."""
    method, rid, params = msg.get("method"), msg.get("id"), msg.get("params") or {}
    ok: Callable[[Any], Dict[str, Any]] = lambda result: {"jsonrpc": "2.0", "id": rid, "result": result}  # noqa: E731
    if rid is None:
        return None, sid  # notifications (initialized, cancelled): nothing to answer
    if method == "initialize":
        client = str((params.get("clientInfo") or {}).get("name") or "agent")
        sid = f"{_agent(client)}.{secrets.token_urlsafe(9)}"
        return ok({"protocolVersion": params.get("protocolVersion") or PROTOCOL, "capabilities": {"tools": {}},
                   "serverInfo": {"name": "taska", "title": f"Taska · {p.title}", "version": "1"},
                   "instructions": INSTRUCTIONS}), sid
    if method == "ping":
        return ok({}), sid
    if method == "tools/list":
        return ok({"tools": TOOLS}), sid
    if method == "tools/call":
        m = SESSION.fullmatch(sid or "")
        if not m:
            return {"jsonrpc": "2.0", "id": rid, "error": {"code": -32000, "message": "no session: initialize first"}}, sid
        try:
            said, failed = _call(ctx, req, p, base, (m.group(1), f"mcp {m.group(2)[:6]}"), str(params.get("name")),
                                 params.get("arguments") or {})
        except (KeyError, ValueError, TypeError) as ex:
            said, failed = f"bad call: {ex}", True
        return ok({"content": [{"type": "text", "text": said}], "isError": failed}), sid
    return {"jsonrpc": "2.0", "id": rid, "error": {"code": -32601, "message": f"no method {method}"}}, sid


def post(ctx: "AppContext", req: Request, p: Project, base: str) -> Response:
    """POST /mcp: one JSON-RPC message or a batch."""
    try:
        msg = json.loads(req.body(MAX_FILE).decode("utf-8") or "null")
    except ValueError:
        return as_json({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "not JSON"}}, 400)
    sid = req.header("Mcp-Session-Id")
    batch = msg if isinstance(msg, list) else [msg]
    out = []
    for m in batch:
        if not isinstance(m, dict):
            out.append({"jsonrpc": "2.0", "id": None, "error": {"code": -32600, "message": "not a request"}})
            continue
        a, sid = _answer(ctx, req, p, base, m, sid)
        if a is not None:
            out.append(a)
    headers = {"Mcp-Session-Id": sid} if sid else {}
    if not out:
        return Response(202, b"", headers=headers)
    return as_json(out if isinstance(msg, list) else out[0], headers=headers)


def other(req: Request) -> Response:
    """GET: this server sends no event stream (a session keeps nothing here to end)."""
    return text(405, "POST JSON-RPC here; this server sends no event stream\n", headers={"Allow": "POST"})
