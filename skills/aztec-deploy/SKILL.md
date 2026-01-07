---
name: aztec-deploy
description: Generate TypeScript deployment scripts for Aztec contracts with fee payment configuration. Use when deploying contracts, setting up deployment pipelines, or configuring fee payment methods.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Aztec Deployment Skill

Generate production-ready TypeScript deployment scripts for Aztec smart contracts.

## Subskills

Navigate to the appropriate section based on your task:

* [Deploy Script](./deploy-script.md) - Full deployment script template
* [Fee Payment](./fee-payment.md) - Fee payment methods and configuration
* [Environment Config](./environment-config.md) - Local network vs devnet setup

## Quick Start: Basic Deployment Script

```typescript
import { MyContract } from "../src/artifacts/MyContract.js";
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { setupWallet } from "../src/utils/setup_wallet.js";
import { getSponsoredFPCInstance } from "../src/utils/sponsored_fpc.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { deploySchnorrAccount } from "../src/utils/deploy_account.js";
import { getTimeouts } from "../config/config.js";

async function main() {
    const logger = createLogger('aztec:deploy');

    // 1. Setup wallet connection
    const wallet = await setupWallet();

    // 2. Setup sponsored fee payment
    const sponsoredFPC = await getSponsoredFPCInstance();
    await wallet.registerContract(sponsoredFPC, SponsoredFPCContract.artifact);
    const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    // 3. Deploy account (or use existing)
    const account = await deploySchnorrAccount(wallet);

    // 4. Deploy contract
    const contract = await MyContract.deploy(wallet, account.address).send({
        from: account.address,
        fee: { paymentMethod }
    }).deployed({ timeout: getTimeouts().deployTimeout });

    logger.info(`Contract deployed at: ${contract.address}`);
}

main().catch(console.error);
```

## Deployment Workflow

1. **Setup Wallet** - Connect to Aztec node via PXE
2. **Configure Fees** - Setup sponsored or other fee payment
3. **Create Account** - Deploy Schnorr account or recover existing
4. **Deploy Contract** - Send deployment transaction
5. **Verify** - Confirm deployment succeeded

## Key Imports

```typescript
// Wallet and node connection
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { TestWallet } from '@aztec/test-wallet/server';

// Account management
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { AztecAddress } from "@aztec/stdlib/aztec-address";

// Fee payment
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";

// Logging
import { Logger, createLogger } from "@aztec/aztec.js/log";
```

## Using Context7 MCP

For detailed API documentation and latest deployment patterns, use Context7:

```
Library ID: /aztecprotocol/aztec-packages
```
