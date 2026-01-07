---
name: aztec-e2e-testing
description: Generate Jest end-to-end tests for Aztec contracts with real network interaction. Use when writing integration tests, testing contract deployments, or validating full transaction flows.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Aztec E2E Testing Skill

Generate Jest end-to-end tests for Aztec contracts against live networks.

## Subskills

* [Jest Setup](./jest-setup.md) - Jest configuration and test structure
* [Test Patterns](./test-patterns.md) - Common E2E test patterns
* [Sponsored Testing](./sponsored-testing.md) - Testing with sponsored fees

## Quick Start: Basic E2E Test

```typescript
import { MyContract } from "../../artifacts/MyContract.js";
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee/testing';
import { setupWallet } from "../../utils/setup_wallet.js";
import { getSponsoredFPCInstance } from "../../utils/sponsored_fpc.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { TxStatus } from "@aztec/stdlib/tx";
import { TestWallet } from '@aztec/test-wallet/server';
import { AccountManager } from "@aztec/aztec.js/wallet";
import { getTimeouts } from "../../../config/config.js";

describe("MyContract", () => {
    let wallet: TestWallet;
    let account: AccountManager;
    let contract: MyContract;
    let paymentMethod: SponsoredFeePaymentMethod;

    beforeAll(async () => {
        // Setup wallet
        wallet = await setupWallet();

        // Setup sponsored fees
        const sponsoredFPC = await getSponsoredFPCInstance();
        await wallet.registerContract(sponsoredFPC, SponsoredFPCContract.artifact);
        paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

        // Create and deploy account
        const secretKey = Fr.random();
        const signingKey = GrumpkinScalar.random();
        const salt = Fr.random();
        account = await wallet.createSchnorrAccount(secretKey, salt, signingKey);
        await (await account.getDeployMethod()).send({
            from: AztecAddress.ZERO,
            fee: { paymentMethod }
        }).wait({ timeout: getTimeouts().deployTimeout });

        // Deploy contract
        contract = await MyContract.deploy(wallet, account.address).send({
            from: account.address,
            fee: { paymentMethod }
        }).deployed({ timeout: getTimeouts().deployTimeout });
    }, 600000);

    it("should perform an action", async () => {
        const tx = await contract.methods.myMethod(args).send({
            from: account.address,
            fee: { paymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        expect(tx.status).toBe(TxStatus.SUCCESS);
    }, 60000);
});
```

## Key Differences from Noir Tests

| Aspect | Noir (TestEnvironment) | TypeScript (Jest) |
|--------|------------------------|-------------------|
| Network | Simulated | Real (local/devnet) |
| Fees | Not required | Required |
| Proofs | Simulated | Real (on devnet) |
| Speed | Fast | Slower |
| State | In-memory | Persistent |

## When to Use E2E Tests

- Integration with real network behavior
- Fee payment verification
- Multi-account scenarios
- Full deployment pipeline testing
- Cross-contract interactions
- Production readiness validation
