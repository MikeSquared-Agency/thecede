#!/usr/bin/env python3
"""
Access Gate — HTTP middleware that checks on-chain permissions before
proxying requests to the Cortex runtime.

Flow:
    Other Agent  →  signs request (EIP-712)
                 →  Access Gate verifies signature
                 →  Checks LilyAccessPolicy on-chain (Base Sepolia)
                 →  If allowed: proxies to Cortex gRPC/HTTP
                 →  If denied: returns 403

Endpoints:
    POST /query     — query Cortex (requires READ)
    POST /store     — store to Cortex (requires WRITE)
    GET  /snapshot  — fetch latest IPFS snapshot (requires READ)
    GET  /health    — health check (no auth)
    GET  /policy/:agentId/:address — check access policy (no auth)

Environment:
    BASE_SEPOLIA_RPC_URL    — RPC endpoint
    POLICY_ADDRESS          — LilyAccessPolicy contract address
    REGISTRY_ADDRESS        — LilyIdentityRegistry contract address
    AGENT_ID                — Lily's agent ID (default: 1)
    CORTEX_URL              — Cortex HTTP URL (default: http://localhost:9091)
    PINATA_GATEWAY          — Pinata gateway URL
    PORT                    — Server port (default: 8888)
"""

import os
import json
import time
import hashlib
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import urllib.request

# Optional web3 for on-chain verification
try:
    from eth_account.messages import encode_defunct
    from eth_account import Account
    HAS_ETH = True
except ImportError:
    HAS_ETH = False

try:
    from web3 import Web3
    HAS_WEB3 = True
except ImportError:
    HAS_WEB3 = False


# ──────────────────── Config ─────────────────────────────

PORT = int(os.getenv("PORT", "8888"))
CORTEX_URL = os.getenv("CORTEX_URL", "http://localhost:9091")
AGENT_ID = int(os.getenv("AGENT_ID", "1"))
BASE_SEPOLIA_RPC = os.getenv("BASE_SEPOLIA_RPC_URL", "")
POLICY_ADDRESS = os.getenv("POLICY_ADDRESS", "")
REGISTRY_ADDRESS = os.getenv("REGISTRY_ADDRESS", "")
PINATA_GATEWAY = os.getenv("PINATA_GATEWAY", "https://gateway.pinata.cloud")

# Permission constants
READ = 1
WRITE = 2
ADMIN = 4

# ABI fragments
POLICY_ABI = [
    {
        "inputs": [
            {"name": "agentId", "type": "uint256"},
            {"name": "caller", "type": "address"}
        ],
        "name": "checkAccess",
        "outputs": [
            {"name": "allowed", "type": "bool"},
            {"name": "permissions", "type": "uint8"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

REGISTRY_ABI = [
    {
        "inputs": [{"name": "agentId", "type": "uint256"}],
        "name": "tokenURI",
        "outputs": [{"name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    }
]

# Web3 setup
w3 = None
policy_contract = None
registry_contract = None

if HAS_WEB3 and BASE_SEPOLIA_RPC and POLICY_ADDRESS:
    w3 = Web3(Web3.HTTPProvider(BASE_SEPOLIA_RPC))
    policy_contract = w3.eth.contract(
        address=Web3.to_checksum_address(POLICY_ADDRESS),
        abi=POLICY_ABI
    )
    if REGISTRY_ADDRESS:
        registry_contract = w3.eth.contract(
            address=Web3.to_checksum_address(REGISTRY_ADDRESS),
            abi=REGISTRY_ABI
        )


def verify_signature(message: str, signature: str) -> str | None:
    """Recover the signer address from an EIP-191 signed message."""
    if not HAS_ETH:
        return None
    try:
        msg = encode_defunct(text=message)
        address = Account.recover_message(msg, signature=bytes.fromhex(
            signature.replace("0x", "")
        ))
        return address
    except Exception as e:
        print(f"  Signature verification failed: {e}")
        return None


def check_onchain_access(caller_address: str, required_permission: int) -> bool:
    """Check on-chain policy for caller's permissions."""
    if not policy_contract:
        print("  WARNING: No policy contract configured, allowing all")
        return True

    try:
        allowed, permissions = policy_contract.functions.checkAccess(
            AGENT_ID,
            Web3.to_checksum_address(caller_address)
        ).call()

        if not allowed:
            return False
        return (permissions & required_permission) != 0
    except Exception as e:
        print(f"  On-chain check failed: {e}")
        return False


def proxy_to_cortex(path: str, method: str = "GET", body: bytes = b"") -> tuple[int, dict, bytes]:
    """Forward a request to the Cortex HTTP API."""
    url = f"{CORTEX_URL}{path}"
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")

    try:
        if body:
            resp = urllib.request.urlopen(req, data=body, timeout=30)
        else:
            resp = urllib.request.urlopen(req, timeout=30)
        return resp.status, dict(resp.headers), resp.read()
    except urllib.error.HTTPError as e:
        return e.code, {}, e.read()
    except Exception as e:
        return 502, {}, json.dumps({"error": str(e)}).encode()


def get_snapshot_cid() -> str | None:
    """Get the current IPFS CID from the on-chain agent URI."""
    if not registry_contract:
        return None
    try:
        uri = registry_contract.functions.tokenURI(AGENT_ID).call()
        if uri.startswith("ipfs://"):
            return uri[7:]
        return None
    except Exception:
        return None


class AccessGateHandler(BaseHTTPRequestHandler):
    """HTTP request handler with on-chain access control."""

    def _send_json(self, status: int, data: dict):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Signature, X-Message, X-Address")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _authenticate(self, required_permission: int) -> str | None:
        """
        Authenticate caller via signed message.
        Headers:
            X-Address:   caller's Ethereum address
            X-Message:   the message that was signed (should include timestamp)
            X-Signature: hex-encoded EIP-191 signature
        Returns caller address if authorized, None otherwise.
        """
        address = self.headers.get("X-Address", "")
        message = self.headers.get("X-Message", "")
        signature = self.headers.get("X-Signature", "")

        if not all([address, message, signature]):
            self._send_json(401, {"error": "Missing auth headers (X-Address, X-Message, X-Signature)"})
            return None

        # Verify signature
        recovered = verify_signature(message, signature)
        if not recovered or recovered.lower() != address.lower():
            self._send_json(401, {"error": "Invalid signature"})
            return None

        # Check message freshness (prevent replay — message should contain timestamp)
        try:
            msg_data = json.loads(message)
            msg_ts = msg_data.get("timestamp", 0)
            if abs(time.time() - msg_ts) > 300:  # 5 minute window
                self._send_json(401, {"error": "Message expired"})
                return None
        except (json.JSONDecodeError, TypeError):
            pass  # Allow non-JSON messages for flexibility

        # Check on-chain policy
        if not check_onchain_access(address, required_permission):
            self._send_json(403, {
                "error": "Access denied",
                "address": address,
                "required": required_permission
            })
            return None

        return address

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Signature, X-Message, X-Address")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path

        # Health check — no auth
        if path == "/health":
            self._send_json(200, {
                "status": "ok",
                "agent_id": AGENT_ID,
                "cortex": CORTEX_URL,
                "chain_connected": w3.is_connected() if w3 else False
            })
            return

        # Policy check — no auth (read-only view of on-chain state)
        if path.startswith("/policy/"):
            parts = path.split("/")
            if len(parts) >= 4:
                try:
                    aid = int(parts[2])
                    addr = parts[3]
                    allowed = check_onchain_access(addr, READ)
                    self._send_json(200, {
                        "agent_id": aid,
                        "address": addr,
                        "allowed": allowed
                    })
                except (ValueError, IndexError):
                    self._send_json(400, {"error": "Invalid path"})
                return

        # Snapshot fetch — requires READ
        if path == "/snapshot":
            caller = self._authenticate(READ)
            if not caller:
                return

            cid = get_snapshot_cid()
            if not cid:
                self._send_json(404, {"error": "No snapshot CID found on-chain"})
                return

            self._send_json(200, {
                "cid": cid,
                "gateway_url": f"{PINATA_GATEWAY}/ipfs/{cid}",
                "ipfs_uri": f"ipfs://{cid}"
            })
            return

        self._send_json(404, {"error": "Not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else b""

        # Query Cortex — requires READ
        if path == "/query":
            caller = self._authenticate(READ)
            if not caller:
                return

            print(f"  [QUERY] {caller}")
            status, headers, data = proxy_to_cortex("/api/search", "POST", body)
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(data)
            return

        # Store to Cortex — requires WRITE
        if path == "/store":
            caller = self._authenticate(WRITE)
            if not caller:
                return

            print(f"  [STORE] {caller}")
            status, headers, data = proxy_to_cortex("/api/store", "POST", body)
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(data)
            return

        self._send_json(404, {"error": "Not found"})

    def log_message(self, format, *args):
        """Custom log format."""
        print(f"[{time.strftime('%H:%M:%S')}] {args[0]}")


def main():
    print("=== Lily Access Gate ===")
    print(f"Port:          {PORT}")
    print(f"Cortex:        {CORTEX_URL}")
    print(f"Agent ID:      {AGENT_ID}")
    print(f"Chain RPC:     {'connected' if (w3 and w3.is_connected()) else 'not configured'}")
    print(f"Policy:        {POLICY_ADDRESS or 'not set'}")
    print(f"Registry:      {REGISTRY_ADDRESS or 'not set'}")
    print()

    server = HTTPServer(("0.0.0.0", PORT), AccessGateHandler)
    print(f"Access Gate listening on http://0.0.0.0:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
