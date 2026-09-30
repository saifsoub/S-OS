#!/usr/bin/env python3
"""S/ server diagnostic bridge. Private interface only; no arbitrary shell."""
import hmac, json, os, subprocess, uuid
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

def make_handler(token):
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
            if not hmac.compare_digest(auth, "Bearer " + token):
                return self.respond(401, {"error": "unauthorized"})
            if self.path == "/health":
                return self.respond(200, {"component": "s-server-bridge", "mode": "read_only"})
            if self.path != "/v1/server/verify":
                return self.respond(404, {"error": "not_found"})
            checks = [run_check(name) for name in COMMANDS]
            self.respond(200, {"receipt_id": str(uuid.uuid4()), "observed_at": datetime.now(timezone.utc).isoformat(),
                "status": "passed" if all(c["passed"] for c in checks) else "failed",
                "checks": checks, "mission_execution_verified": False})
        def do_POST(self): self.respond(405, {"error": "read_only"})
    return Handler

def main():
    token = os.environ.get("S_SERVER_BRIDGE_TOKEN", "")
    bind = os.environ.get("S_SERVER_BRIDGE_BIND", "127.0.0.1")
    if len(token) < 32: raise SystemExit("S_SERVER_BRIDGE_TOKEN must contain at least 32 characters")
    if bind in ("0.0.0.0", "::", ""): raise SystemExit("Use loopback or the server Tailscale address")
    ThreadingHTTPServer((bind, 8791), make_handler(token)).serve_forever()
if __name__ == "__main__": main()
