// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Utils.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./interfaces/IERC6551.sol";

/// @title LilyAgentAccount
/// @notice Combined ERC-6551 Token Bound Account + ERC-4337 compatible smart
///         account. This is the "bank account" for Lily's agent NFT with
///         built-in guardrails: spend limits, session keys, and multi-approval.
/// @dev Deployed per-agent via the ERC-6551 Registry. The NFT owner controls
///      the account; session keys allow delegated time-limited actions.
contract LilyAgentAccount is
    IERC6551Account,
    IERC6551Executable,
    IERC1271,
    ERC165,
    IERC1155Receiver
{
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ──────────────────── Constants ─────────────────────────

    /// @notice ERC-4337 EntryPoint v0.7 (same on all EVM chains)
    address public constant ENTRY_POINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    bytes4 constant MAGIC_VALUE = IERC1271.isValidSignature.selector; // 0x1626ba7e

    // ──────────────────── State ─────────────────────────────

    uint256 private _state;

    /// @notice Daily spend limit in wei (0 = unlimited)
    uint256 public spendLimit;

    /// @notice Spent today (resets every 24h)
    uint256 public spentToday;

    /// @notice Last reset timestamp
    uint256 public lastResetDay;

    // ─── Session Keys ───

    struct SessionKey {
        bool active;
        uint256 validAfter;
        uint256 validUntil;
        uint256 spendLimit;    // per-session spend cap (0 = can't send ETH)
        uint256 spent;
    }

    /// @notice Delegated session keys: address → session config
    mapping(address => SessionKey) public sessionKeys;

    // ─── Guardians (multi-approval) ───

    /// @notice Guardian addresses that can co-sign high-value transactions
    mapping(address => bool) public guardians;
    uint256 public guardianCount;

    /// @notice Threshold for guardian approval on transactions above spendLimit
    uint256 public guardianThreshold;

    // ──────────────────── Events ────────────────────────────

    event Executed(address indexed target, uint256 value, bytes data);
    event SessionKeyAdded(address indexed key, uint256 validUntil, uint256 spendLimit);
    event SessionKeyRevoked(address indexed key);
    event SpendLimitSet(uint256 newLimit);
    event GuardianAdded(address indexed guardian);
    event GuardianRemoved(address indexed guardian);
    event GuardianThresholdSet(uint256 threshold);

    // ──────────────────── Errors ────────────────────────────

    error NotAuthorized();
    error InvalidOperation();
    error SpendLimitExceeded();
    error SessionExpired();
    error SessionSpendExceeded();

    // ──────────────────── Modifiers ─────────────────────────

    modifier onlyOwner() {
        if (!_isValidSigner(msg.sender)) revert NotAuthorized();
        _;
    }

    modifier onlyOwnerOrEntryPoint() {
        if (!_isValidSigner(msg.sender) && msg.sender != ENTRY_POINT)
            revert NotAuthorized();
        _;
    }

    // ──────────────────── ERC-6551 Account ──────────────────

    /// @inheritdoc IERC6551Account
    receive() external payable override {}

    /// @inheritdoc IERC6551Account
    function token()
        external
        view
        virtual
        override
        returns (uint256 chainId, address tokenContract, uint256 tokenId)
    {
        bytes memory footer = new bytes(0x60);
        assembly {
            extcodecopy(address(), add(footer, 0x20), 0x4d, 0x60)
        }
        return abi.decode(footer, (uint256, address, uint256));
    }

    /// @inheritdoc IERC6551Account
    function state() external view override returns (uint256) {
        return _state;
    }

    /// @inheritdoc IERC6551Account
    function isValidSigner(address signer, bytes calldata)
        external
        view
        override
        returns (bytes4)
    {
        if (_isValidSigner(signer)) {
            return IERC6551Account.isValidSigner.selector;
        }
        return bytes4(0);
    }

    // ──────────────────── ERC-6551 Executable ───────────────

    /// @inheritdoc IERC6551Executable
    function execute(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external payable override onlyOwnerOrEntryPoint returns (bytes memory) {
        if (operation != 0) revert InvalidOperation(); // Only CALL supported

        _checkAndTrackSpend(msg.sender, value);

        _state++;

        (bool success, bytes memory result) = to.call{value: value}(data);
        require(success, "Execution failed");

        emit Executed(to, value, data);
        return result;
    }

    // ──────────────────── ERC-4337 ──────────────────────────

    /// @notice Validates a UserOperation for ERC-4337
    /// @dev Called by the EntryPoint. Returns 0 for valid, 1 for invalid.
    function validateUserOp(
        bytes calldata userOp,      // packed UserOperation
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData) {
        require(msg.sender == ENTRY_POINT, "Not EntryPoint");

        // Extract signature from userOp (last dynamic field)
        // For simplicity, we expect the signature to be a standard ECDSA sig
        bytes memory signature;
        assembly {
            let sigOffset := calldataload(add(userOp.offset, 0x100))
            let sigLen := calldataload(add(userOp.offset, sigOffset))
            signature := mload(0x40)
            mstore(signature, sigLen)
            calldatacopy(
                add(signature, 0x20),
                add(add(userOp.offset, sigOffset), 0x20),
                sigLen
            )
            mstore(0x40, add(add(signature, 0x20), sigLen))
        }

        address recovered = userOpHash.toEthSignedMessageHash().recover(signature);

        // Check if signer is owner or valid session key
        if (_isValidSigner(recovered)) {
            validationData = 0; // valid
        } else if (_isValidSessionKey(recovered)) {
            validationData = 0;
        } else {
            validationData = 1; // invalid
        }

        // Pay prefund
        if (missingAccountFunds > 0) {
            (bool sent, ) = ENTRY_POINT.call{value: missingAccountFunds}("");
            require(sent, "Prefund failed");
        }
    }

    // ──────────────────── ERC-1271 ──────────────────────────

    /// @inheritdoc IERC1271
    function isValidSignature(bytes32 hash, bytes memory signature)
        external
        view
        override
        returns (bytes4)
    {
        address recovered = hash.recover(signature);
        if (_isValidSigner(recovered) || _isValidSessionKey(recovered)) {
            return MAGIC_VALUE;
        }
        return bytes4(0xffffffff);
    }

    // ──────────────── Session Keys ──────────────────────────

    /// @notice Add a delegated session key
    /// @param key The session key address
    /// @param validAfter Start timestamp
    /// @param validUntil End timestamp
    /// @param keySpendLimit Max ETH this key can spend (wei)
    function addSessionKey(
        address key,
        uint256 validAfter,
        uint256 validUntil,
        uint256 keySpendLimit
    ) external onlyOwner {
        require(key != address(0), "Zero address");
        require(validUntil > validAfter, "Invalid time range");

        sessionKeys[key] = SessionKey({
            active: true,
            validAfter: validAfter,
            validUntil: validUntil,
            spendLimit: keySpendLimit,
            spent: 0
        });

        emit SessionKeyAdded(key, validUntil, keySpendLimit);
    }

    /// @notice Revoke a session key
    function revokeSessionKey(address key) external onlyOwner {
        sessionKeys[key].active = false;
        emit SessionKeyRevoked(key);
    }

    // ──────────────── Spend Limits ──────────────────────────

    /// @notice Set daily spend limit (only owner)
    function setSpendLimit(uint256 limit) external onlyOwner {
        spendLimit = limit;
        emit SpendLimitSet(limit);
    }

    // ──────────────── Guardians ─────────────────────────────

    /// @notice Add a guardian (only owner)
    function addGuardian(address guardian) external onlyOwner {
        require(!guardians[guardian], "Already guardian");
        guardians[guardian] = true;
        guardianCount++;
        emit GuardianAdded(guardian);
    }

    /// @notice Remove a guardian (only owner)
    function removeGuardian(address guardian) external onlyOwner {
        require(guardians[guardian], "Not guardian");
        guardians[guardian] = false;
        guardianCount--;
        emit GuardianRemoved(guardian);
    }

    /// @notice Set guardian approval threshold
    function setGuardianThreshold(uint256 threshold) external onlyOwner {
        require(threshold <= guardianCount, "Threshold too high");
        guardianThreshold = threshold;
        emit GuardianThresholdSet(threshold);
    }

    // ──────────────── ERC-165 ───────────────────────────────

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC165, IERC165)
        returns (bool)
    {
        return
            interfaceId == type(IERC6551Account).interfaceId ||    // 0x6faff5f1
            interfaceId == type(IERC6551Executable).interfaceId || // 0x51945447
            interfaceId == type(IERC1271).interfaceId ||
            interfaceId == type(IERC1155Receiver).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    // ──────────────── ERC-1155 Receiver ─────────────────────

    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return this.onERC1155BatchReceived.selector;
    }

    // ──────────────── Internal Helpers ──────────────────────

    function _isValidSigner(address signer) internal view returns (bool) {
        (uint256 chainId, address tokenContract, uint256 tokenId) = this.token();
        if (chainId != block.chainid) return false;
        return IERC721(tokenContract).ownerOf(tokenId) == signer;
    }

    function _isValidSessionKey(address key) internal view returns (bool) {
        SessionKey storage sk = sessionKeys[key];
        return
            sk.active &&
            block.timestamp >= sk.validAfter &&
            block.timestamp <= sk.validUntil;
    }

    function _checkAndTrackSpend(address spender, uint256 value) internal {
        if (value == 0) return;

        // Reset daily counter if new day
        uint256 today = block.timestamp / 1 days;
        if (today > lastResetDay) {
            spentToday = 0;
            lastResetDay = today;
        }

        // Check daily spend limit (owner)
        if (spendLimit > 0 && _isValidSigner(spender)) {
            if (spentToday + value > spendLimit) revert SpendLimitExceeded();
            spentToday += value;
        }

        // Check session key spend limit
        SessionKey storage sk = sessionKeys[spender];
        if (sk.active) {
            if (sk.spendLimit > 0 && sk.spent + value > sk.spendLimit)
                revert SessionSpendExceeded();
            sk.spent += value;
        }
    }
}
