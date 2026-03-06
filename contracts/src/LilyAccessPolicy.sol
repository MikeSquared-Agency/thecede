// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./interfaces/ILilyAccessPolicy.sol";

/// @title LilyAccessPolicy
/// @notice On-chain access control for agent resources (Cortex, IPFS snapshots).
///         Only the agent NFT owner or addresses with ADMIN permission can
///         grant/revoke access. The Access Gate reads these policies before
///         proxying requests to the off-chain Cortex runtime.
contract LilyAccessPolicy is ILilyAccessPolicy {
    // ──────────────────── Constants ─────────────────────────

    uint8 public constant READ  = 1;   // 0x01
    uint8 public constant WRITE = 2;   // 0x02
    uint8 public constant ADMIN = 4;   // 0x04

    // ──────────────────── State ─────────────────────────────

    /// @notice The ERC-721 identity registry (LilyIdentityRegistry)
    IERC721 public immutable identityRegistry;

    struct AccessEntry {
        uint8 permissions;   // bitmask: READ | WRITE | ADMIN
        uint256 expiry;      // 0 = never expires
        bool exists;         // true if entry has been created
    }

    /// @notice agentId → caller → access entry
    mapping(uint256 => mapping(address => AccessEntry)) private _access;

    /// @notice agentId → list of addresses with access (for enumeration)
    mapping(uint256 => address[]) private _accessList;

    // ──────────────────── Constructor ───────────────────────

    constructor(address identityRegistry_) {
        require(identityRegistry_ != address(0), "Zero address");
        identityRegistry = IERC721(identityRegistry_);
    }

    // ──────────────────── Modifiers ─────────────────────────

    modifier onlyAgentAdmin(uint256 agentId) {
        address owner = identityRegistry.ownerOf(agentId);
        if (msg.sender == owner) {
            _;
            return;
        }
        // Check if caller has ADMIN permission
        AccessEntry storage entry = _access[agentId][msg.sender];
        require(
            entry.exists &&
            (entry.permissions & ADMIN) != 0 &&
            (entry.expiry == 0 || entry.expiry > block.timestamp),
            "Not authorized"
        );
        _;
    }

    // ──────────────────── Access Control ────────────────────

    /// @inheritdoc ILilyAccessPolicy
    function grantAccess(
        uint256 agentId,
        address caller,
        uint8 permissions,
        uint256 expiry
    ) external onlyAgentAdmin(agentId) {
        require(caller != address(0), "Zero address");
        require(permissions != 0, "Empty permissions");
        require(permissions <= (READ | WRITE | ADMIN), "Invalid permissions");

        AccessEntry storage entry = _access[agentId][caller];

        if (!entry.exists) {
            _accessList[agentId].push(caller);
        }

        entry.permissions = permissions;
        entry.expiry = expiry;
        entry.exists = true;

        emit AccessGranted(agentId, caller, permissions, expiry);
    }

    /// @inheritdoc ILilyAccessPolicy
    function revokeAccess(uint256 agentId, address caller)
        external
        onlyAgentAdmin(agentId)
    {
        require(caller != address(0), "Zero address");
        AccessEntry storage entry = _access[agentId][caller];
        require(entry.exists, "No access to revoke");

        entry.permissions = 0;
        entry.exists = false;
        // Note: we don't remove from _accessList to save gas;
        // enumeration checks entry.exists

        emit AccessRevoked(agentId, caller);
    }

    /// @inheritdoc ILilyAccessPolicy
    function checkAccess(uint256 agentId, address caller)
        external
        view
        returns (bool allowed, uint8 permissions)
    {
        // Owner always has full access
        address owner = identityRegistry.ownerOf(agentId);
        if (caller == owner) {
            return (true, READ | WRITE | ADMIN);
        }

        AccessEntry storage entry = _access[agentId][caller];
        if (!entry.exists) {
            return (false, 0);
        }

        // Check expiry
        if (entry.expiry != 0 && entry.expiry <= block.timestamp) {
            return (false, 0);
        }

        return (true, entry.permissions);
    }

    // ──────────────────── View Helpers ──────────────────────

    /// @notice List all addresses that have (or had) access to an agent
    /// @param agentId The agent's token ID
    /// @return callers Array of addresses (check entry.exists for current status)
    function getAccessList(uint256 agentId)
        external
        view
        returns (address[] memory)
    {
        return _accessList[agentId];
    }

    /// @notice Get the full access entry for a caller
    /// @param agentId The agent's token ID
    /// @param caller The address to check
    function getAccessEntry(uint256 agentId, address caller)
        external
        view
        returns (uint8 permissions, uint256 expiry, bool exists)
    {
        AccessEntry storage entry = _access[agentId][caller];
        return (entry.permissions, entry.expiry, entry.exists);
    }
}
