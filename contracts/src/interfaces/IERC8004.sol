// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IERC8004 - Trustless Agent Identity Registry
/// @notice Interface for the ERC-8004 Agent Identity standard (Draft)
/// @dev Based on the ERC-8004 specification by MetaMask, EF, Google, Coinbase
interface IERC8004 {
    // ──────────────────────── Events ────────────────────────

    event Registered(
        uint256 indexed agentId,
        string agentURI,
        address indexed owner
    );

    event URIUpdated(
        uint256 indexed agentId,
        string newURI,
        address indexed updatedBy
    );

    event MetadataSet(
        uint256 indexed agentId,
        string indexed indexedMetadataKey,
        string metadataKey,
        bytes metadataValue
    );

    event AgentWalletSet(
        uint256 indexed agentId,
        address indexed wallet
    );

    event AgentWalletUnset(
        uint256 indexed agentId,
        address indexed previousWallet
    );

    // ──────────────────── Registration ──────────────────────

    /// @notice Register a new agent with a URI and optional metadata
    /// @param agentURI The URI pointing to the agent's registration file
    /// @return agentId The newly minted agent's token ID
    function register(string calldata agentURI) external returns (uint256 agentId);

    /// @notice Register a new agent with no URI
    /// @return agentId The newly minted agent's token ID
    function register() external returns (uint256 agentId);

    // ──────────────────── URI Management ────────────────────

    /// @notice Update an agent's URI (context pointer: CID + hash + version)
    /// @param agentId The agent's token ID
    /// @param newURI The new URI to set
    function setAgentURI(uint256 agentId, string calldata newURI) external;

    // ──────────────── On-chain Metadata ─────────────────────

    /// @notice Get metadata for an agent by key
    /// @param agentId The agent's token ID
    /// @param metadataKey The metadata key to look up
    /// @return The metadata value as bytes
    function getMetadata(uint256 agentId, string memory metadataKey) external view returns (bytes memory);

    /// @notice Set metadata for an agent
    /// @param agentId The agent's token ID
    /// @param metadataKey The metadata key
    /// @param metadataValue The metadata value as bytes
    function setMetadata(uint256 agentId, string memory metadataKey, bytes memory metadataValue) external;

    // ──────────────── Wallet Management ─────────────────────

    /// @notice Set the agent's associated wallet address (EIP-712 signed)
    /// @param agentId The agent's token ID
    /// @param newWallet The wallet address to associate
    /// @param deadline Signature expiry timestamp
    /// @param signature EIP-712 signature from the wallet
    function setAgentWallet(
        uint256 agentId,
        address newWallet,
        uint256 deadline,
        bytes calldata signature
    ) external;

    /// @notice Get the agent's associated wallet
    /// @param agentId The agent's token ID
    /// @return The wallet address
    function getAgentWallet(uint256 agentId) external view returns (address);

    /// @notice Remove the agent's wallet association
    /// @param agentId The agent's token ID
    function unsetAgentWallet(uint256 agentId) external;
}
