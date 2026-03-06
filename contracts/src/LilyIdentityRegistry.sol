// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./interfaces/IERC8004.sol";

/// @title LilyIdentityRegistry
/// @notice ERC-8004 Agent Identity Registry — each agent is an NFT with
///         a context pointer (CID + hash + version) and on-chain metadata.
/// @dev Singleton registry: one deployment per chain, any address can register.
contract LilyIdentityRegistry is ERC721URIStorage, EIP712, IERC8004 {
    using ECDSA for bytes32;

    // ──────────────────── State ─────────────────────────────

    uint256 private _nextAgentId = 1;

    /// @notice On-chain metadata: agentId → key → value
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    /// @notice Agent wallet bindings: agentId → wallet address
    mapping(uint256 => address) private _agentWallets;

    /// @notice Reverse lookup: wallet → agentId (0 = unbound)
    mapping(address => uint256) private _walletToAgent;

    // ──────────────────── EIP-712 ───────────────────────────

    bytes32 private constant SET_WALLET_TYPEHASH =
        keccak256("SetAgentWallet(uint256 agentId,address newWallet,uint256 deadline)");

    // ──────────────────── Constructor ───────────────────────

    constructor()
        ERC721("Lily Agent Identity", "LILY-ID")
        EIP712("LilyIdentityRegistry", "1")
    {}

    // ──────────────────── Registration ──────────────────────

    /// @inheritdoc IERC8004
    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);
        emit Registered(agentId, agentURI, msg.sender);
    }

    /// @inheritdoc IERC8004
    function register() external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        emit Registered(agentId, "", msg.sender);
    }

    // ──────────────────── URI Management ────────────────────

    /// @inheritdoc IERC8004
    function setAgentURI(uint256 agentId, string calldata newURI) external {
        require(ownerOf(agentId) == msg.sender, "Not agent owner");
        _setTokenURI(agentId, newURI);
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    // ──────────────────── Metadata ──────────────────────────

    /// @inheritdoc IERC8004
    function getMetadata(uint256 agentId, string memory metadataKey)
        external
        view
        returns (bytes memory)
    {
        // Revert if token doesn't exist
        ownerOf(agentId);
        return _metadata[agentId][metadataKey];
    }

    /// @inheritdoc IERC8004
    function setMetadata(
        uint256 agentId,
        string memory metadataKey,
        bytes memory metadataValue
    ) external {
        require(ownerOf(agentId) == msg.sender, "Not agent owner");
        _metadata[agentId][metadataKey] = metadataValue;
        emit MetadataSet(agentId, metadataKey, metadataKey, metadataValue);
    }

    // ──────────────────── Wallet Management ─────────────────

    /// @inheritdoc IERC8004
    function setAgentWallet(
        uint256 agentId,
        address newWallet,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(ownerOf(agentId) == msg.sender, "Not agent owner");
        require(block.timestamp <= deadline, "Signature expired");
        require(newWallet != address(0), "Zero address");

        // Verify EIP-712 signature from the wallet proving consent
        bytes32 structHash = keccak256(
            abi.encode(SET_WALLET_TYPEHASH, agentId, newWallet, deadline)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = digest.recover(signature);
        require(recovered == newWallet, "Invalid wallet signature");

        // Clear previous binding if exists
        address previousWallet = _agentWallets[agentId];
        if (previousWallet != address(0)) {
            delete _walletToAgent[previousWallet];
        }

        // Ensure wallet isn't already bound to another agent
        require(_walletToAgent[newWallet] == 0, "Wallet already bound");

        _agentWallets[agentId] = newWallet;
        _walletToAgent[newWallet] = agentId;
        emit AgentWalletSet(agentId, newWallet);
    }

    /// @inheritdoc IERC8004
    function getAgentWallet(uint256 agentId) external view returns (address) {
        ownerOf(agentId); // Revert if doesn't exist
        return _agentWallets[agentId];
    }

    /// @inheritdoc IERC8004
    function unsetAgentWallet(uint256 agentId) external {
        require(ownerOf(agentId) == msg.sender, "Not agent owner");
        address previousWallet = _agentWallets[agentId];
        require(previousWallet != address(0), "No wallet set");

        delete _walletToAgent[previousWallet];
        delete _agentWallets[agentId];
        emit AgentWalletUnset(agentId, previousWallet);
    }

    // ──────────────────── View Helpers ──────────────────────

    /// @notice Get the agent ID bound to a wallet address
    /// @param wallet The wallet to look up
    /// @return agentId (0 if not bound)
    function getAgentByWallet(address wallet) external view returns (uint256) {
        return _walletToAgent[wallet];
    }

    /// @notice Get the current agent count
    function totalAgents() external view returns (uint256) {
        return _nextAgentId - 1;
    }

    /// @notice The EIP-712 domain separator
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
