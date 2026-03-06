// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/LilyIdentityRegistry.sol";
import "../src/LilyAccessPolicy.sol";
import "../src/LilyAgentAccount.sol";
import "../src/interfaces/IERC6551.sol";

contract LilyIdentityRegistryTest is Test {
    LilyIdentityRegistry registry;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        registry = new LilyIdentityRegistry();
    }

    // ──────────────── Registration ──────────────────────────

    function test_registerWithURI() public {
        vm.prank(alice);
        uint256 agentId = registry.register("ipfs://QmTest123");

        assertEq(agentId, 1);
        assertEq(registry.ownerOf(agentId), alice);
        assertEq(registry.tokenURI(agentId), "ipfs://QmTest123");
        assertEq(registry.totalAgents(), 1);
    }

    function test_registerWithoutURI() public {
        vm.prank(alice);
        uint256 agentId = registry.register();

        assertEq(agentId, 1);
        assertEq(registry.ownerOf(agentId), alice);
    }

    function test_multipleRegistrations() public {
        vm.prank(alice);
        uint256 id1 = registry.register("ipfs://agent1");

        vm.prank(bob);
        uint256 id2 = registry.register("ipfs://agent2");

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(registry.totalAgents(), 2);
    }

    // ──────────────── URI Management ────────────────────────

    function test_setAgentURI() public {
        vm.prank(alice);
        uint256 agentId = registry.register("ipfs://old");

        vm.prank(alice);
        registry.setAgentURI(agentId, "ipfs://new");

        assertEq(registry.tokenURI(agentId), "ipfs://new");
    }

    function test_setAgentURI_revertNotOwner() public {
        vm.prank(alice);
        uint256 agentId = registry.register("ipfs://old");

        vm.prank(bob);
        vm.expectRevert("Not agent owner");
        registry.setAgentURI(agentId, "ipfs://hack");
    }

    // ──────────────── Metadata ──────────────────────────────

    function test_setAndGetMetadata() public {
        vm.prank(alice);
        uint256 agentId = registry.register("ipfs://test");

        vm.prank(alice);
        registry.setMetadata(agentId, "snapshotHash", abi.encode(keccak256("data")));

        bytes memory stored = registry.getMetadata(agentId, "snapshotHash");
        assertEq(stored, abi.encode(keccak256("data")));
    }

    function test_setMetadata_revertNotOwner() public {
        vm.prank(alice);
        uint256 agentId = registry.register("ipfs://test");

        vm.prank(bob);
        vm.expectRevert("Not agent owner");
        registry.setMetadata(agentId, "key", "value");
    }

    function test_getMetadata_revertNonexistent() public {
        vm.expectRevert();
        registry.getMetadata(999, "key");
    }

    // ──────────────── Wallet Management ─────────────────────

    function test_setAgentWallet() public {
        (address wallet, uint256 walletPk) = makeAddrAndKey("wallet");

        vm.prank(alice);
        uint256 agentId = registry.register("ipfs://test");

        // Create EIP-712 signature from wallet
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("SetAgentWallet(uint256 agentId,address newWallet,uint256 deadline)"),
                agentId,
                wallet,
                block.timestamp + 1 hours
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", registry.domainSeparator(), structHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(walletPk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(alice);
        registry.setAgentWallet(agentId, wallet, block.timestamp + 1 hours, sig);

        assertEq(registry.getAgentWallet(agentId), wallet);
        assertEq(registry.getAgentByWallet(wallet), agentId);
    }

    function test_unsetAgentWallet() public {
        (address wallet, uint256 walletPk) = makeAddrAndKey("wallet2");

        vm.prank(alice);
        uint256 agentId = registry.register("ipfs://test");

        // Set wallet first
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("SetAgentWallet(uint256 agentId,address newWallet,uint256 deadline)"),
                agentId,
                wallet,
                block.timestamp + 1 hours
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", registry.domainSeparator(), structHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(walletPk, digest);

        vm.prank(alice);
        registry.setAgentWallet(agentId, wallet, block.timestamp + 1 hours, abi.encodePacked(r, s, v));

        // Unset
        vm.prank(alice);
        registry.unsetAgentWallet(agentId);

        assertEq(registry.getAgentWallet(agentId), address(0));
        assertEq(registry.getAgentByWallet(wallet), 0);
    }
}


contract LilyAccessPolicyTest is Test {
    LilyIdentityRegistry registry;
    LilyAccessPolicy policy;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    uint256 agentId;

    uint8 constant READ = 1;
    uint8 constant WRITE = 2;
    uint8 constant ADMIN = 4;

    function setUp() public {
        registry = new LilyIdentityRegistry();
        policy = new LilyAccessPolicy(address(registry));

        vm.prank(alice);
        agentId = registry.register("ipfs://lily");
    }

    // ──────────────── Grant Access ──────────────────────────

    function test_grantReadAccess() public {
        vm.prank(alice);
        policy.grantAccess(agentId, bob, READ, 0);

        (bool allowed, uint8 perms) = policy.checkAccess(agentId, bob);
        assertTrue(allowed);
        assertEq(perms, READ);
    }

    function test_grantReadWriteAccess() public {
        vm.prank(alice);
        policy.grantAccess(agentId, bob, READ | WRITE, 0);

        (bool allowed, uint8 perms) = policy.checkAccess(agentId, bob);
        assertTrue(allowed);
        assertEq(perms, READ | WRITE);
    }

    function test_grantFullAccess() public {
        vm.prank(alice);
        policy.grantAccess(agentId, bob, READ | WRITE | ADMIN, 0);

        (bool allowed, uint8 perms) = policy.checkAccess(agentId, bob);
        assertTrue(allowed);
        assertEq(perms, 7);
    }

    // ──────────────── Expiry ────────────────────────────────

    function test_accessExpires() public {
        vm.prank(alice);
        policy.grantAccess(agentId, bob, READ, block.timestamp + 1 hours);

        // Before expiry
        (bool allowed, ) = policy.checkAccess(agentId, bob);
        assertTrue(allowed);

        // After expiry
        vm.warp(block.timestamp + 2 hours);
        (allowed, ) = policy.checkAccess(agentId, bob);
        assertFalse(allowed);
    }

    // ──────────────── Revoke ────────────────────────────────

    function test_revokeAccess() public {
        vm.prank(alice);
        policy.grantAccess(agentId, bob, READ | WRITE, 0);

        vm.prank(alice);
        policy.revokeAccess(agentId, bob);

        (bool allowed, uint8 perms) = policy.checkAccess(agentId, bob);
        assertFalse(allowed);
        assertEq(perms, 0);
    }

    // ──────────────── Owner Always Has Access ───────────────

    function test_ownerAlwaysHasFullAccess() public {
        (bool allowed, uint8 perms) = policy.checkAccess(agentId, alice);
        assertTrue(allowed);
        assertEq(perms, 7); // READ | WRITE | ADMIN
    }

    // ──────────────── Admin Delegation ──────────────────────

    function test_adminCanGrantAccess() public {
        // Alice grants Bob ADMIN
        vm.prank(alice);
        policy.grantAccess(agentId, bob, ADMIN | READ, 0);

        // Bob (as admin) grants Carol READ
        vm.prank(bob);
        policy.grantAccess(agentId, carol, READ, 0);

        (bool allowed, ) = policy.checkAccess(agentId, carol);
        assertTrue(allowed);
    }

    function test_nonAdminCannotGrantAccess() public {
        // Alice grants Bob READ only
        vm.prank(alice);
        policy.grantAccess(agentId, bob, READ, 0);

        // Bob tries to grant Carol access — should fail
        vm.prank(bob);
        vm.expectRevert("Not authorized");
        policy.grantAccess(agentId, carol, READ, 0);
    }

    // ──────────────── Edge Cases ────────────────────────────

    function test_cannotGrantZeroPermissions() public {
        vm.prank(alice);
        vm.expectRevert("Empty permissions");
        policy.grantAccess(agentId, bob, 0, 0);
    }

    function test_cannotGrantInvalidPermissions() public {
        vm.prank(alice);
        vm.expectRevert("Invalid permissions");
        policy.grantAccess(agentId, bob, 8, 0); // 8 is not valid
    }

    function test_cannotRevokeNonexistentAccess() public {
        vm.prank(alice);
        vm.expectRevert("No access to revoke");
        policy.revokeAccess(agentId, bob);
    }

    // ──────────────── View Helpers ──────────────────────────

    function test_getAccessList() public {
        vm.startPrank(alice);
        policy.grantAccess(agentId, bob, READ, 0);
        policy.grantAccess(agentId, carol, WRITE, 0);
        vm.stopPrank();

        address[] memory list = policy.getAccessList(agentId);
        assertEq(list.length, 2);
        assertEq(list[0], bob);
        assertEq(list[1], carol);
    }

    function test_getAccessEntry() public {
        vm.prank(alice);
        policy.grantAccess(agentId, bob, READ | WRITE, block.timestamp + 1 days);

        (uint8 perms, uint256 expiry, bool exists) = policy.getAccessEntry(agentId, bob);
        assertEq(perms, READ | WRITE);
        assertEq(expiry, block.timestamp + 1 days);
        assertTrue(exists);
    }
}


contract LilyAgentAccountTest is Test {
    LilyIdentityRegistry registry;
    LilyAgentAccount accountImpl;
    address alice;
    uint256 alicePk;
    uint256 agentId;
    LilyAgentAccount tba;

    function setUp() public {
        (alice, alicePk) = makeAddrAndKey("alice");

        registry = new LilyIdentityRegistry();

        vm.prank(alice);
        agentId = registry.register("ipfs://lily");

        // Use the ERC-6551 registry to create a proper TBA.
        // Deploy a mock registry that creates accounts with correct appended data.
        // For testing, we use a TestTBAFactory helper.
        tba = new TestLilyAgentAccount(block.chainid, address(registry), agentId);

        // Fund the TBA
        vm.deal(address(tba), 10 ether);
    }

    // ──────────────── Basic TBA ─────────────────────────────

    function test_tbaReceivesETH() public {
        assertEq(address(tba).balance, 10 ether);

        vm.deal(address(this), 1 ether);
        (bool sent, ) = address(tba).call{value: 1 ether}("");
        assertTrue(sent);
        assertEq(address(tba).balance, 11 ether);
    }

    function test_supportsInterfaces() public view {
        assertTrue(tba.supportsInterface(type(IERC6551Account).interfaceId));
        assertTrue(tba.supportsInterface(type(IERC6551Executable).interfaceId));
        assertTrue(tba.supportsInterface(type(IERC1271).interfaceId));
    }

    // ──────────────── Session Keys ──────────────────────────

    function test_addAndUseSessionKey() public {
        address sessionAddr = makeAddr("session");

        vm.prank(alice);
        tba.addSessionKey(
            sessionAddr,
            block.timestamp,
            block.timestamp + 1 hours,
            1 ether
        );

        (bool active, , uint256 validUntil, , ) = tba.sessionKeys(sessionAddr);
        assertTrue(active);
        assertEq(validUntil, block.timestamp + 1 hours);
    }

    function test_revokeSessionKey() public {
        address sessionAddr = makeAddr("session2");

        vm.prank(alice);
        tba.addSessionKey(sessionAddr, block.timestamp, block.timestamp + 1 hours, 0);

        vm.prank(alice);
        tba.revokeSessionKey(sessionAddr);

        (bool active, , , , ) = tba.sessionKeys(sessionAddr);
        assertFalse(active);
    }

    // ──────────────── Spend Limits ──────────────────────────

    function test_setSpendLimit() public {
        vm.prank(alice);
        tba.setSpendLimit(1 ether);

        assertEq(tba.spendLimit(), 1 ether);
    }

    // ──────────────── Guardians ──────────────────────────────

    function test_addAndRemoveGuardian() public {
        address guardian = makeAddr("guardian");

        vm.prank(alice);
        tba.addGuardian(guardian);
        assertTrue(tba.guardians(guardian));
        assertEq(tba.guardianCount(), 1);

        vm.prank(alice);
        tba.removeGuardian(guardian);
        assertFalse(tba.guardians(guardian));
        assertEq(tba.guardianCount(), 0);
    }

    // ──────────────── Access Control ────────────────────────

    function test_nonOwnerCannotAddSessionKey() public {
        address attacker = makeAddr("attacker");

        vm.prank(attacker);
        vm.expectRevert(LilyAgentAccount.NotAuthorized.selector);
        tba.addSessionKey(attacker, block.timestamp, block.timestamp + 1 hours, 0);
    }

    function test_nonOwnerCannotSetSpendLimit() public {
        address attacker = makeAddr("attacker");

        vm.prank(attacker);
        vm.expectRevert(LilyAgentAccount.NotAuthorized.selector);
        tba.setSpendLimit(100 ether);
    }
}


/// @notice Test helper that extends LilyAgentAccount with hardcoded token data
///         instead of reading from ERC-1167 appended bytes via extcodecopy.
contract TestLilyAgentAccount is LilyAgentAccount {
    uint256 private _chainId;
    address private _tokenContract;
    uint256 private _tokenId;

    constructor(uint256 chainId_, address tokenContract_, uint256 tokenId_) {
        _chainId = chainId_;
        _tokenContract = tokenContract_;
        _tokenId = tokenId_;
    }

    function token()
        external
        view
        override
        returns (uint256 chainId, address tokenContract, uint256 tokenId)
    {
        return (_chainId, _tokenContract, _tokenId);
    }
}
