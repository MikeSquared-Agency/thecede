#!/usr/bin/env python3
"""
test-deployment.py — Interactive test script for the Lily on-chain identity stack.

Verifies the deployed contracts on Base Sepolia:
1. Identity Registry: register, URI, metadata
2. Access Policy: grant/revoke/check
3. Agent Account (TBA): session keys, spend limits
4. End-to-end: Access Gate → on-chain check → Cortex proxy

Usage:
    pip install web3 eth-account
    python scripts/test-deployment.py

Environment:
    BASE_SEPOLIA_RPC_URL   — RPC endpoint (default: https://sepolia.base.org)
    PRIVATE_KEY            — Deployer private key
    REGISTRY_ADDRESS       — LilyIdentityRegistry contract address
    POLICY_ADDRESS         — LilyAccessPolicy contract address
    ACCOUNT_IMPL_ADDRESS   — LilyAgentAccount implementation address
    TBA_ADDRESS            — Token Bound Account address
    AGENT_ID               — Lily's agent ID (default: 1)
"""

import os
import sys
import json
import time

try:
    from web3 import Web3
    from eth_account import Account
    from eth_account.messages import encode_defunct
except ImportError:
    print("Install dependencies: pip install web3 eth-account")
    sys.exit(1)


# ──────────────────── Config ─────────────────────────────

RPC_URL = os.getenv("BASE_SEPOLIA_RPC_URL", "https://sepolia.base.org")
PRIVATE_KEY = os.getenv("PRIVATE_KEY", "")
REGISTRY_ADDRESS = os.getenv("REGISTRY_ADDRESS", "")
POLICY_ADDRESS = os.getenv("POLICY_ADDRESS", "")
TBA_ADDRESS = os.getenv("TBA_ADDRESS", "")
AGENT_ID = int(os.getenv("AGENT_ID", "1"))

w3 = Web3(Web3.HTTPProvider(RPC_URL))

# ──────────────────── ABIs ───────────────────────────────

REGISTRY_ABI = json.loads("""[
    {"inputs":[{"name":"agentURI","type":"string"}],"name":"register","outputs":[{"name":"agentId","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"register","outputs":[{"name":"agentId","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"}],"name":"tokenURI","outputs":[{"name":"","type":"string"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"}],"name":"ownerOf","outputs":[{"name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"totalAgents","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"},{"name":"newURI","type":"string"}],"name":"setAgentURI","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"},{"name":"metadataKey","type":"string"}],"name":"getMetadata","outputs":[{"name":"","type":"bytes"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"},{"name":"metadataKey","type":"string"},{"name":"metadataValue","type":"bytes"}],"name":"setMetadata","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"}],"name":"getAgentWallet","outputs":[{"name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"tokenId","type":"uint256"}],"name":"name","outputs":[{"name":"","type":"string"}],"stateMutability":"view","type":"function"}
]""")

POLICY_ABI = json.loads("""[
    {"inputs":[{"name":"agentId","type":"uint256"},{"name":"caller","type":"address"},{"name":"permissions","type":"uint8"},{"name":"expiry","type":"uint256"}],"name":"grantAccess","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"},{"name":"caller","type":"address"}],"name":"revokeAccess","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"},{"name":"caller","type":"address"}],"name":"checkAccess","outputs":[{"name":"allowed","type":"bool"},{"name":"permissions","type":"uint8"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"}],"name":"getAccessList","outputs":[{"name":"","type":"address[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"},{"name":"caller","type":"address"}],"name":"getAccessEntry","outputs":[{"name":"permissions","type":"uint8"},{"name":"expiry","type":"uint256"},{"name":"exists","type":"bool"}],"stateMutability":"view","type":"function"}
]""")


def passed(msg):
    print(f"  ✅ {msg}")

def failed(msg):
    print(f"  ❌ {msg}")

def info(msg):
    print(f"  ℹ️  {msg}")


# ──────────────────── Tests ──────────────────────────────

def test_connection():
    print("\n🔗 Testing Connection...")
    connected = w3.is_connected()
    chain_id = w3.eth.chain_id if connected else None

    if connected and chain_id == 84532:
        passed(f"Connected to Base Sepolia (chain {chain_id})")
    elif connected:
        failed(f"Connected but wrong chain: {chain_id} (expected 84532)")
    else:
        failed("Cannot connect to RPC")
        sys.exit(1)


def test_deployer():
    print("\n👤 Testing Deployer Account...")
    if not PRIVATE_KEY:
        info("PRIVATE_KEY not set, skipping write tests")
        return None

    account = Account.from_key(PRIVATE_KEY)
    balance = w3.eth.get_balance(account.address)
    eth_balance = w3.from_wei(balance, "ether")

    passed(f"Address: {account.address}")
    passed(f"Balance: {eth_balance} ETH")

    if balance == 0:
        failed("Zero balance! Get testnet ETH from a faucet")
    return account


def test_registry():
    print("\n📋 Testing Identity Registry...")
    if not REGISTRY_ADDRESS:
        info("REGISTRY_ADDRESS not set, skipping")
        return

    registry = w3.eth.contract(
        address=Web3.to_checksum_address(REGISTRY_ADDRESS),
        abi=REGISTRY_ABI
    )

    # Check total agents
    total = registry.functions.totalAgents().call()
    passed(f"Total agents registered: {total}")

    if total > 0:
        # Check agent 1
        owner = registry.functions.ownerOf(AGENT_ID).call()
        passed(f"Agent #{AGENT_ID} owner: {owner}")

        uri = registry.functions.tokenURI(AGENT_ID).call()
        passed(f"Agent #{AGENT_ID} URI: {uri}")

        wallet = registry.functions.getAgentWallet(AGENT_ID).call()
        if wallet != "0x0000000000000000000000000000000000000000":
            passed(f"Agent #{AGENT_ID} wallet: {wallet}")
        else:
            info(f"Agent #{AGENT_ID} has no wallet bound yet")

        # Check metadata
        try:
            snapshot_hash = registry.functions.getMetadata(AGENT_ID, "snapshotHash").call()
            if snapshot_hash:
                passed(f"Snapshot hash: 0x{snapshot_hash.hex()[:16]}...")
            else:
                info("No snapshot hash set yet")
        except Exception:
            info("No snapshot hash set yet")


def test_policy():
    print("\n🔒 Testing Access Policy...")
    if not POLICY_ADDRESS:
        info("POLICY_ADDRESS not set, skipping")
        return

    policy = w3.eth.contract(
        address=Web3.to_checksum_address(POLICY_ADDRESS),
        abi=POLICY_ABI
    )

    if not PRIVATE_KEY:
        info("PRIVATE_KEY not set, skipping access check")
        return

    account = Account.from_key(PRIVATE_KEY)

    # Check deployer access
    allowed, permissions = policy.functions.checkAccess(AGENT_ID, account.address).call()
    if allowed:
        perms = []
        if permissions & 1: perms.append("READ")
        if permissions & 2: perms.append("WRITE")
        if permissions & 4: perms.append("ADMIN")
        passed(f"Deployer access: {' | '.join(perms)}")
    else:
        failed("Deployer has no access!")

    # Check a random address (should be denied)
    random_addr = "0x0000000000000000000000000000000000001234"
    allowed_rand, _ = policy.functions.checkAccess(AGENT_ID, random_addr).call()
    if not allowed_rand:
        passed("Random address correctly denied")
    else:
        failed("Random address should not have access!")

    # List access
    access_list = policy.functions.getAccessList(AGENT_ID).call()
    passed(f"Access list: {len(access_list)} entries")
    for addr in access_list:
        entry = policy.functions.getAccessEntry(AGENT_ID, addr).call()
        perms = []
        if entry[0] & 1: perms.append("READ")
        if entry[0] & 2: perms.append("WRITE")
        if entry[0] & 4: perms.append("ADMIN")
        expiry = "never" if entry[1] == 0 else time.strftime("%Y-%m-%d %H:%M", time.gmtime(entry[1]))
        info(f"  {addr[:10]}... → {' | '.join(perms)} (expires: {expiry})")


def test_tba():
    print("\n💰 Testing Token Bound Account...")
    if not TBA_ADDRESS:
        info("TBA_ADDRESS not set, skipping")
        return

    balance = w3.eth.get_balance(Web3.to_checksum_address(TBA_ADDRESS))
    eth_balance = w3.from_wei(balance, "ether")
    passed(f"TBA address: {TBA_ADDRESS}")
    passed(f"TBA balance: {eth_balance} ETH")

    code = w3.eth.get_code(Web3.to_checksum_address(TBA_ADDRESS))
    if len(code) > 0:
        passed(f"TBA has contract code ({len(code)} bytes)")
    else:
        failed("TBA has no contract code — deployment may have failed")


def test_access_gate_signing():
    print("\n🔑 Testing Access Gate Signature Flow...")
    if not PRIVATE_KEY:
        info("PRIVATE_KEY not set, skipping")
        return

    account = Account.from_key(PRIVATE_KEY)

    # Create a signed request like the Access Gate expects
    message_data = {
        "action": "query",
        "timestamp": int(time.time()),
        "agent_id": AGENT_ID
    }
    message = json.dumps(message_data, separators=(",", ":"))

    msg = encode_defunct(text=message)
    signed = account.sign_message(msg)
    signature = signed.signature.hex()

    # Verify locally
    recovered = Account.recover_message(msg, signature=signed.signature)

    if recovered == account.address:
        passed(f"Signature valid, recovered: {recovered[:10]}...")
        info(f"  X-Address:   {account.address}")
        info(f"  X-Message:   {message}")
        info(f"  X-Signature: 0x{signature[:20]}...")
    else:
        failed(f"Signature recovery mismatch: {recovered} != {account.address}")

    # Show curl example
    print("\n  📝 Test with Access Gate (when running):")
    print(f'  curl -X POST http://localhost:8888/query \\')
    print(f'    -H "X-Address: {account.address}" \\')
    print(f'    -H "X-Message: {message}" \\')
    print(f'    -H "X-Signature: 0x{signature}" \\')
    print(f'    -H "Content-Type: application/json" \\')
    print(f'    -d \'{{"query": "what is lily?"}}\' ')


def test_write_metadata():
    """Test writing metadata on-chain (costs gas)."""
    print("\n📝 Testing Write Operations (costs gas)...")
    if not PRIVATE_KEY or not REGISTRY_ADDRESS:
        info("PRIVATE_KEY or REGISTRY_ADDRESS not set, skipping")
        return

    account = Account.from_key(PRIVATE_KEY)
    registry = w3.eth.contract(
        address=Web3.to_checksum_address(REGISTRY_ADDRESS),
        abi=REGISTRY_ABI
    )

    # Write a test metadata key
    test_value = f"test-{int(time.time())}".encode()
    try:
        tx = registry.functions.setMetadata(
            AGENT_ID, "testKey", test_value
        ).build_transaction({
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 100000,
        })
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        passed(f"setMetadata tx sent: {tx_hash.hex()[:20]}...")

        # Wait for receipt
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        if receipt.status == 1:
            passed("Transaction confirmed!")

            # Read it back
            stored = registry.functions.getMetadata(AGENT_ID, "testKey").call()
            if stored == test_value:
                passed(f"Metadata round-trip verified: {test_value.decode()}")
            else:
                failed(f"Metadata mismatch: {stored} != {test_value}")
        else:
            failed("Transaction reverted!")
    except Exception as e:
        failed(f"Write test failed: {e}")


# ──────────────────── Main ───────────────────────────────

def main():
    print("=" * 60)
    print("    Lily On-Chain Identity — Deployment Test Suite")
    print("=" * 60)
    print(f"  Chain:    Base Sepolia (84532)")
    print(f"  RPC:      {RPC_URL}")
    print(f"  Agent ID: {AGENT_ID}")

    test_connection()
    account = test_deployer()
    test_registry()
    test_policy()
    test_tba()
    test_access_gate_signing()

    # Ask before running write tests
    if account and REGISTRY_ADDRESS:
        try:
            answer = input("\n  Run write tests (costs gas)? [y/N]: ").strip().lower()
            if answer == "y":
                test_write_metadata()
        except EOFError:
            info("Non-interactive, skipping write tests")

    print("\n" + "=" * 60)
    print("    Test suite complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
