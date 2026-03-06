#!/usr/bin/env python3
"""
snapshot-cortex.py — Export Cortex state, encrypt, and pin to IPFS via Pinata.
Then optionally update the on-chain context pointer.

Usage:
    python scripts/snapshot-cortex.py

Environment variables:
    PINATA_JWT          — Pinata JWT for pinning
    ENCRYPTION_KEY      — 32-byte hex key for AES-256-GCM encryption
    GCP_VM              — VM name (default: openclaw-vm)
    GCP_ZONE            — VM zone (default: europe-west2-c)
    GCP_PROJECT         — GCP project ID
"""

import os
import sys
import json
import hashlib
import subprocess
import tempfile
import time
from pathlib import Path

# Optional: update on-chain pointer
try:
    from web3 import Web3
    HAS_WEB3 = True
except ImportError:
    HAS_WEB3 = False

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


# ──────────────────── Config ─────────────────────────────

VM_NAME = os.getenv("GCP_VM", "openclaw-vm")
VM_ZONE = os.getenv("GCP_ZONE", "europe-west2-c")
GCP_PROJECT = os.getenv("GCP_PROJECT", "gen-lang-client-0820949984")
PINATA_JWT = os.getenv("PINATA_JWT", "")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "")  # 64 hex chars = 32 bytes

CORTEX_EXPORT_CMD = (
    f"gcloud compute ssh {VM_NAME} --zone={VM_ZONE} --project={GCP_PROJECT} "
    f'--command="sudo docker exec openclaw-stack-openclaw-gateway-1 '
    f'/usr/local/bin/cortex export 2>/dev/null"'
)


def export_cortex() -> dict:
    """SSH into GCP VM and export Cortex state as JSON."""
    print("[1/4] Exporting Cortex state from VM...")
    result = subprocess.run(
        CORTEX_EXPORT_CMD,
        shell=True,
        capture_output=True,
        text=True,
        timeout=120
    )
    if result.returncode != 0:
        print(f"  ERROR: {result.stderr[:500]}")
        sys.exit(1)

    data = json.loads(result.stdout)
    node_count = len(data.get("nodes", []))
    edge_count = len(data.get("edges", []))
    print(f"  Exported {node_count} nodes, {edge_count} edges")
    return data


def encrypt_snapshot(data: dict) -> tuple[bytes, bytes]:
    """Encrypt the JSON snapshot with AES-256-GCM."""
    print("[2/4] Encrypting snapshot...")

    if not HAS_CRYPTO:
        print("  WARNING: cryptography not installed, skipping encryption")
        raw = json.dumps(data, separators=(",", ":")).encode("utf-8")
        return raw, hashlib.sha256(raw).digest()

    if not ENCRYPTION_KEY:
        print("  WARNING: No ENCRYPTION_KEY set, storing unencrypted")
        raw = json.dumps(data, separators=(",", ":")).encode("utf-8")
        return raw, hashlib.sha256(raw).digest()

    key = bytes.fromhex(ENCRYPTION_KEY)
    assert len(key) == 32, "ENCRYPTION_KEY must be 64 hex chars (32 bytes)"

    plaintext = json.dumps(data, separators=(",", ":")).encode("utf-8")
    content_hash = hashlib.sha256(plaintext).digest()

    nonce = os.urandom(12)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)

    # Bundle format: [12 bytes nonce][ciphertext+tag]
    bundle = nonce + ciphertext
    print(f"  Encrypted: {len(plaintext)} bytes -> {len(bundle)} bytes")
    return bundle, content_hash


def pin_to_pinata(data: bytes, name: str) -> str:
    """Pin data to IPFS via Pinata and return the CID."""
    print("[3/4] Pinning to IPFS via Pinata...")

    if not HAS_REQUESTS:
        print("  ERROR: requests not installed. pip install requests")
        sys.exit(1)

    if not PINATA_JWT:
        print("  ERROR: PINATA_JWT not set")
        sys.exit(1)

    with tempfile.NamedTemporaryFile(suffix=".bin", delete=False) as f:
        f.write(data)
        tmp_path = f.name

    try:
        url = "https://api.pinata.cloud/pinning/pinFileToIPFS"
        headers = {"Authorization": f"Bearer {PINATA_JWT}"}

        metadata = json.dumps({
            "name": name,
            "keyvalues": {
                "agent": "lily",
                "type": "cortex-snapshot",
                "timestamp": str(int(time.time()))
            }
        })

        with open(tmp_path, "rb") as f:
            resp = requests.post(
                url,
                files={"file": (name, f)},
                data={"pinataMetadata": metadata},
                headers=headers,
                timeout=120
            )

        resp.raise_for_status()
        result = resp.json()
        cid = result["IpfsHash"]
        print(f"  Pinned! CID: {cid}")
        print(f"  Gateway: https://gateway.pinata.cloud/ipfs/{cid}")
        return cid
    finally:
        os.unlink(tmp_path)


def update_onchain_pointer(cid: str, content_hash: bytes, version: int):
    """Update the on-chain agent URI and metadata (optional)."""
    print("[4/4] Updating on-chain pointer...")

    if not HAS_WEB3:
        print("  SKIP: web3 not installed. pip install web3")
        return

    rpc_url = os.getenv("BASE_SEPOLIA_RPC_URL", "")
    private_key = os.getenv("PRIVATE_KEY", "")
    registry_addr = os.getenv("REGISTRY_ADDRESS", "")
    agent_id = int(os.getenv("AGENT_ID", "1"))

    if not all([rpc_url, private_key, registry_addr]):
        print("  SKIP: Missing BASE_SEPOLIA_RPC_URL, PRIVATE_KEY, or REGISTRY_ADDRESS")
        print(f"  CID to set manually: ipfs://{cid}")
        return

    w3 = Web3(Web3.HTTPProvider(rpc_url))
    account = w3.eth.account.from_key(private_key)

    # Minimal ABI for setAgentURI and setMetadata
    abi = [
        {
            "inputs": [
                {"name": "agentId", "type": "uint256"},
                {"name": "newURI", "type": "string"}
            ],
            "name": "setAgentURI",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {"name": "agentId", "type": "uint256"},
                {"name": "metadataKey", "type": "string"},
                {"name": "metadataValue", "type": "bytes"}
            ],
            "name": "setMetadata",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ]

    contract = w3.eth.contract(address=registry_addr, abi=abi)

    # Update URI
    new_uri = f"ipfs://{cid}"
    tx1 = contract.functions.setAgentURI(agent_id, new_uri).build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": 200000,
    })
    signed1 = account.sign_transaction(tx1)
    tx_hash1 = w3.eth.send_raw_transaction(signed1.raw_transaction)
    print(f"  URI tx: {tx_hash1.hex()}")

    # Update metadata: snapshotHash
    tx2 = contract.functions.setMetadata(
        agent_id, "snapshotHash", content_hash
    ).build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": 200000,
    })
    signed2 = account.sign_transaction(tx2)
    tx_hash2 = w3.eth.send_raw_transaction(signed2.raw_transaction)
    print(f"  Hash tx: {tx_hash2.hex()}")

    # Update metadata: snapshotVersion
    tx3 = contract.functions.setMetadata(
        agent_id, "snapshotVersion", version.to_bytes(32, "big")
    ).build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": 200000,
    })
    signed3 = account.sign_transaction(tx3)
    tx_hash3 = w3.eth.send_raw_transaction(signed3.raw_transaction)
    print(f"  Version tx: {tx_hash3.hex()}")

    print(f"  On-chain pointer updated to ipfs://{cid}")


def main():
    print("=== Lily Cortex Snapshot Pipeline ===\n")

    version = int(time.time())
    snapshot_name = f"lily-cortex-snapshot-{version}.bin"

    # 1. Export
    data = export_cortex()

    # 2. Encrypt
    bundle, content_hash = encrypt_snapshot(data)

    # 3. Pin to IPFS
    cid = pin_to_pinata(bundle, snapshot_name)

    # 4. Update on-chain (optional)
    update_onchain_pointer(cid, content_hash, version)

    print(f"\n=== DONE ===")
    print(f"CID:     {cid}")
    print(f"URI:     ipfs://{cid}")
    print(f"Hash:    {content_hash.hex()}")
    print(f"Version: {version}")


if __name__ == "__main__":
    main()
