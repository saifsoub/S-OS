#!/usr/bin/env python3
"""S/ server diagnostic bridge. Private interface only; no arbitrary shell."""
import hashlib, hmac, json, os, sqlite3, subprocess, uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

COMMANDS = {
    "hostname": ["hostname"],
    "s_cli": ["s-cli", "--version"],
    "agent_enabled": ["systemctl", "is-enabled", "s-agent.service"],
    "agent_active": ["systemctl", "is-active", "s-agent.service"],
    "tailscale": ["tailscale", "status", "--json"],
    "n8n_readiness": ["curl", "--fail", "--silent", "--max-time", "5", "http://127.0.0.1:5678/healthz/readiness"],
}
def run_check(name):
    if name not in COMMANDS:
        raise ValueError("unknown_check")
    try:
        result = subprocess.run(COMMANDS[name], capture_output=True, text=True, timeout=10, shell=False)
        # Tailscale peer inventory is intentionally not returned.
        output = result.stdout.strip()[:4096] if name != "tailscale" else ""
        ready = result.returncode == 0
        if name == "tailscale" and ready:
            ready = json.loads(result.stdout).get("BackendState") == "Running"
        return {"check": name, "passed": ready, "exit_code": result.returncode, "output": output}
    except (OSError, subprocess.TimeoutExpired, ValueError):
        return {"check": name, "passed": False, "error": "unavailable_or_timeout"}

class TaskStore:
    def __init__(self, path):
        self.path = path
        with self.connect() as db:
            db.execute("CREATE TABLE IF NOT EXISTS tasks (key TEXT PRIMARY KEY, digest TEXT, id TEXT UNIQUE, receipt TEXT)")
        os.chmod(path, 0o600)
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.execute("PRAGMA synchronous=FULL")
        return db
    def submit(self, task):
        if not isinstance(task, dict) or set(task) != {"task", "idempotency_key"} or task["task"] != "server_verify":
            raise ValueError("unsupported_task")
        key = task["idempotency_key"]
        if not isinstance(key, str) or not 1 <= len(key) <= 128:
            raise ValueError("invalid_key")
        digest = hashlib.sha256(json.dumps(task, sort_keys=True).encode()).hexdigest()
        receipt_id = str(uuid.uuid4())
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            old = db.execute("SELECT digest, id, receipt FROM tasks WHERE key=?", (key,)).fetchone()
            if old:
                if old[0] != digest: raise ValueError("idempotency_conflict")
                return (json.loads(old[2]) if old[2] else {"receipt_id": old[1], "status": "running", "retry_safe": False}), True
            db.execute("INSERT INTO tasks VALUES (?, ?, ?, NULL)", (key, digest, receipt_id))
        checks = [run_check(name) for name in COMMANDS]
        receipt = {"receipt_id": receipt_id, "task": "server_verify", "status": "completed" if all(c["passed"] for c in checks) else "failed",
                   "checks": checks, "observed_at": datetime.now(timezone.utc).isoformat(), "scope": "diagnostics",
                   "general_mission_execution_verified": False}
        with self.connect() as db:
            db.execute("UPDATE tasks SET receipt=? WHERE key=?", (json.dumps(receipt), key))
        return receipt, False
    def get(self, receipt_id):
        with self.connect() as db:
            row = db.execute("SELECT receipt FROM tasks WHERE id=?", (receipt_id,)).fetchone()
        if not row: return None
        return json.loads(row[0]) if row[0] else {"receipt_id": receipt_id, "status": "running", "retry_safe": False}

def make_handler(token, store=None):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args): pass
        def respond(self, code, value):
            data = json.dumps(value).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
        def do_GET(self):
            auth = self.headers.get("Authorization", "")
            if not hmac.compare_digest(auth.encode(), ("Bearer " + token).encode()):
                return self.respond(401, {"error": "unauthorized"})
            if self.path.startswith("/v1/receipts/") and store:
                receipt = store.get(self.path[len("/v1/receipts/"):])
                return self.respond(200 if receipt else 404, receipt or {"error": "not_found"})
            if self.path == "/health":
                return self.respond(200, {"component": "s-server-bridge", "mode": "read_only"})
            if self.path != "/v1/server/verify":
                return self.respond(404, {"error": "not_found"})
            checks = [run_check(name) for name in COMMANDS]
            self.respond(200, {"receipt_id": str(uuid.uuid4()), "observed_at": datetime.now(timezone.utc).isoformat(),
                "status": "passed" if all(c["passed"] for c in checks) else "failed",
                "checks": checks, "mission_execution_verified": False})
        def do_POST(self):
            if not store: return self.respond(405, {"error": "read_only"})
            if not hmac.compare_digest(self.headers.get("Authorization", "").encode(), ("Bearer " + token).encode()):
                return self.respond(401, {"error": "unauthorized"})
            if self.path != "/v1/tasks": return self.respond(404, {"error": "not_found"})
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size <= 4096 or self.headers.get("Transfer-Encoding"): raise ValueError("invalid_size")
                self.connection.settimeout(15)
                receipt, replayed = store.submit(json.loads(self.rfile.read(size)))
                self.respond(202 if receipt["status"] == "running" else 200, {**receipt, "replayed": replayed})
            except (ValueError, TypeError, UnicodeError):
                self.respond(400, {"error": "invalid_or_unsupported_task"})
    return Handler

def main():
    token = os.environ.get("S_SERVER_BRIDGE_TOKEN", "")
    bind = os.environ.get("S_SERVER_BRIDGE_BIND", "127.0.0.1")
    if len(token) < 32: raise SystemExit("S_SERVER_BRIDGE_TOKEN must contain at least 32 characters")
    if bind in ("0.0.0.0", "::", ""): raise SystemExit("Use loopback or the server Tailscale address")
    store = TaskStore(os.environ.get("S_SERVER_BRIDGE_DB", "/var/lib/s-server-bridge/tasks.sqlite3"))
    ThreadingHTTPServer((bind, 8791), make_handler(token, store)).serve_forever()
if __name__ == "__main__": main()
