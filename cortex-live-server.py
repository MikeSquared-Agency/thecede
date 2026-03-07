"""
Cortex Live Server — streams graph updates from VM to browser via SSE.
Usage: python cortex-live-server.py [--interval 30] [--port 8765]
"""

import http.server
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

# ── Config ──
INTERVAL = 30  # seconds between fetches
PORT = 8765
VM = "openclaw-vm"
ZONE = "europe-west2-c"
CONTAINER = "openclaw-stack-openclaw-gateway-1"
ROOT = Path(__file__).parent

# Parse CLI args
args = sys.argv[1:]
i = 0
while i < len(args):
    if args[i] == "--interval" and i + 1 < len(args):
        INTERVAL = int(args[i + 1]); i += 2
    elif args[i] == "--port" and i + 1 < len(args):
        PORT = int(args[i + 1]); i += 2
    else:
        i += 1

# ── State ──
current_data = None
data_lock = threading.Lock()
sse_clients = []
clients_lock = threading.Lock()
fetch_count = 0
last_fetch_time = None
last_fetch_error = None


def fetch_cortex_data():
    """Fetch graph data from VM via gcloud SSH."""
    global current_data, fetch_count, last_fetch_time, last_fetch_error
    cmd = f'gcloud compute ssh {VM} --zone={ZONE} --command="sudo docker exec {CONTAINER} cortex export --format json 2>/dev/null"'
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30, shell=True)
        if result.returncode != 0:
            last_fetch_error = result.stderr.strip()[:200]
            print(f"  [!] SSH error: {last_fetch_error}")
            return None
        # Strip any gcloud WARNING lines
        lines = result.stdout.split("\n")
        json_start = next(i for i, l in enumerate(lines) if l.strip().startswith("{"))
        raw = "\n".join(lines[json_start:])
        data = json.loads(raw)
        last_fetch_error = None
        return data
    except subprocess.TimeoutExpired:
        last_fetch_error = "SSH timeout (30s)"
        print(f"  [!] {last_fetch_error}")
        return None
    except Exception as e:
        last_fetch_error = str(e)[:200]
        print(f"  [!] Fetch error: {last_fetch_error}")
        return None


def broadcast(event_type, data):
    """Send SSE event to all connected clients."""
    msg = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
    encoded = msg.encode("utf-8")
    with clients_lock:
        dead = []
        for client in sse_clients:
            try:
                client.wfile.write(encoded)
                client.wfile.flush()
            except Exception:
                dead.append(client)
        for c in dead:
            sse_clients.remove(c)
            print(f"  [-] SSE client disconnected ({len(sse_clients)} remaining)")


def poller_loop():
    """Background thread: periodically fetch and broadcast updates."""
    global current_data, fetch_count, last_fetch_time
    print(f"[Poller] Starting — fetch every {INTERVAL}s")
    while True:
        fetch_count += 1
        t0 = time.time()
        print(f"[Poller] Fetch #{fetch_count}...")
        data = fetch_cortex_data()
        elapsed = time.time() - t0

        if data:
            node_count = len(data.get("nodes", []))
            edge_count = len(data.get("edges", []))
            last_fetch_time = time.strftime("%H:%M:%S")
            print(f"  [OK] {node_count} nodes, {edge_count} edges ({elapsed:.1f}s)")

            with data_lock:
                old_nodes = len(current_data["nodes"]) if current_data else 0
                old_edges = len(current_data["edges"]) if current_data else 0
                current_data = data

            # Broadcast update
            broadcast("graph", {
                "nodes": data["nodes"],
                "edges": data["edges"],
                "meta": {
                    "fetchCount": fetch_count,
                    "fetchTime": last_fetch_time,
                    "elapsed": round(elapsed, 1),
                    "nodesDelta": node_count - old_nodes,
                    "edgesDelta": edge_count - old_edges,
                }
            })

            # Also save to disk as backup
            (ROOT / "cortex-export.json").write_text(json.dumps(data, indent=2), encoding="utf-8")
        else:
            broadcast("error", {"message": last_fetch_error, "fetchCount": fetch_count})

        time.sleep(INTERVAL)


class Handler(http.server.SimpleHTTPRequestHandler):
    """Serve static files + SSE stream endpoint."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path == "/":
            self.path = "/cortex-explorer.html"
            return super().do_GET()

        if self.path == "/events":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            # Send current data immediately
            with data_lock:
                if current_data:
                    msg = f"event: graph\ndata: {json.dumps({'nodes': current_data['nodes'], 'edges': current_data['edges'], 'meta': {'fetchCount': fetch_count, 'fetchTime': last_fetch_time, 'elapsed': 0, 'nodesDelta': 0, 'edgesDelta': 0}})}\n\n"
                    self.wfile.write(msg.encode("utf-8"))
                    self.wfile.flush()

            with clients_lock:
                sse_clients.append(self)
                print(f"  [+] SSE client connected ({len(sse_clients)} total)")

            # Keep connection alive
            try:
                while True:
                    time.sleep(1)
            except Exception:
                pass
            return

        if self.path == "/api/status":
            status = {
                "fetchCount": fetch_count,
                "lastFetchTime": last_fetch_time,
                "lastError": last_fetch_error,
                "interval": INTERVAL,
                "clients": len(sse_clients),
                "nodes": len(current_data["nodes"]) if current_data else 0,
                "edges": len(current_data["edges"]) if current_data else 0,
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(status).encode("utf-8"))
            return

        return super().do_GET()

    def log_message(self, format, *args):
        # Quiet down static file logging
        if "/events" not in str(args[0]) and "/api/" not in str(args[0]):
            return
        super().log_message(format, *args)


def main():
    global current_data

    print(f"╔══════════════════════════════════════════════╗")
    print(f"║   Cortex Live Server                        ║")
    print(f"║   http://localhost:{PORT}/                      ║")
    print(f"║   Fetch interval: {INTERVAL}s                       ║")
    print(f"╚══════════════════════════════════════════════╝")

    # Load cached data if available
    cache = ROOT / "cortex-export.json"
    if cache.exists():
        try:
            current_data = json.loads(cache.read_text(encoding="utf-8"))
            print(f"[Cache] Loaded {len(current_data['nodes'])} nodes, {len(current_data['edges'])} edges")
        except Exception:
            pass

    # Start poller thread
    poller = threading.Thread(target=poller_loop, daemon=True)
    poller.start()

    # Start HTTP server (threaded for SSE)
    server = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"[Server] Listening on http://localhost:{PORT}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Server] Shutting down")
        server.shutdown()


if __name__ == "__main__":
    main()
