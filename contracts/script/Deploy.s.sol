// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/LilyIdentityRegistry.sol";
import "../src/LilyAccessPolicy.sol";
import "../src/LilyAgentAccount.sol";
import "../src/interfaces/IERC6551.sol";

/// @title DeployLily
/// @notice Deploys the full Lily on-chain identity stack to Base Sepolia:
///         1. LilyIdentityRegistry (ERC-8004 agent NFT)
///         2. LilyAccessPolicy (access control)
///         3. LilyAgentAccount (TBA implementation)
///         4. Registers Lily as Agent #1
///         5. Creates Token Bound Account via ERC-6551 Registry
///         6. Grants initial access policy
contract DeployLily is Script {
    // ERC-6551 Registry — same address on all EVM chains
    address constant ERC6551_REGISTRY = 0x000000006551c19487814612e58FE06813775758;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        string memory agentURI = vm.envOr("AGENT_URI", string("ipfs://placeholder"));

        console.log("Deployer:", deployer);
        console.log("Agent URI:", agentURI);
        console.log("Chain ID:", block.chainid);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // ── 1. Deploy Identity Registry ──
        LilyIdentityRegistry registry = new LilyIdentityRegistry();
        console.log("LilyIdentityRegistry:", address(registry));

        // ── 2. Deploy Access Policy ──
        LilyAccessPolicy policy = new LilyAccessPolicy(address(registry));
        console.log("LilyAccessPolicy:    ", address(policy));

        // ── 3. Deploy Agent Account Implementation ──
        LilyAgentAccount accountImpl = new LilyAgentAccount();
        console.log("LilyAgentAccount:    ", address(accountImpl));

        // ── 4. Register Lily as Agent #1 ──
        uint256 agentId = registry.register(agentURI);
        console.log("Lily Agent ID:       ", agentId);

        // ── 5. Create Token Bound Account ──
        address tba = IERC6551Registry(ERC6551_REGISTRY).createAccount(
            address(accountImpl),  // implementation
            bytes32(0),            // salt
            block.chainid,         // chainId
            address(registry),     // tokenContract
            agentId                // tokenId
        );
        console.log("Lily TBA Address:    ", tba);

        // ── 6. Grant deployer full access in the policy ──
        policy.grantAccess(
            agentId,
            deployer,
            7,  // READ | WRITE | ADMIN
            0   // never expires
        );
        console.log("Access granted to deployer");

        vm.stopBroadcast();

        console.log("");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("Registry:     ", address(registry));
        console.log("Policy:       ", address(policy));
        console.log("Account Impl: ", address(accountImpl));
        console.log("Agent ID:      1");
        console.log("TBA:          ", tba);
    }
}
