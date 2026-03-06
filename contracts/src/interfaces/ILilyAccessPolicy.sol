// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ILilyAccessPolicy - Access Control for Agent Resources
interface ILilyAccessPolicy {
    // ──────────────────────── Events ────────────────────────

    event AccessGranted(
        uint256 indexed agentId,
        address indexed caller,
        uint8 permissions,
        uint256 expiry
    );

    event AccessRevoked(
        uint256 indexed agentId,
        address indexed caller
    );

    // ──────────────── Permission Flags ──────────────────────
    // READ  = 1 (0x01)  — can query Cortex, fetch IPFS snapshots
    // WRITE = 2 (0x02)  — can store/update nodes in Cortex
    // ADMIN = 4 (0x04)  — can grant/revoke access for others

    /// @notice Grant access to a caller for a specific agent
    /// @param agentId The agent's token ID
    /// @param caller The address being granted access
    /// @param permissions Bitmask: READ=1, WRITE=2, ADMIN=4
    /// @param expiry Unix timestamp when access expires (0 = never)
    function grantAccess(
        uint256 agentId,
        address caller,
        uint8 permissions,
        uint256 expiry
    ) external;

    /// @notice Revoke all access for a caller
    /// @param agentId The agent's token ID
    /// @param caller The address to revoke
    function revokeAccess(uint256 agentId, address caller) external;

    /// @notice Check if a caller has specific permissions
    /// @param agentId The agent's token ID
    /// @param caller The address to check
    /// @return allowed Whether the caller has any valid permissions
    /// @return permissions The permission bitmask (0 if expired/revoked)
    function checkAccess(uint256 agentId, address caller)
        external
        view
        returns (bool allowed, uint8 permissions);
}
