---
description: Generate a TypeScript deployment script for an Aztec contract
---

# Deploy Aztec Contract

Generate a deployment script for the Aztec contract named "$ARGUMENTS".

## Instructions

1. If no contract name is provided, ask for one
2. Look for the contract artifact in `src/artifacts/` or `target/`
3. Generate a deployment script in `scripts/deploy_$ARGUMENTS.ts` that includes:
   - Wallet setup using `setupWallet()`
   - Sponsored fee payment configuration
   - Schnorr account creation and deployment
   - Contract deployment with proper fee payment
   - Logging of deployed contract address and credentials
   - Error handling with informative messages

4. The script should:
   - Use environment-aware configuration from `config/config.ts`
   - Save credentials (SECRET, SIGNING_KEY, SALT) for later recovery
   - Output contract address and instantiation data
   - Follow the patterns from the aztec-deploy skill

5. Add corresponding npm scripts to package.json:
   - `deploy-$ARGUMENTS` for local network
   - `deploy-$ARGUMENTS::devnet` for devnet

## Template Structure

```typescript
import { ContractNameContract } from "../src/artifacts/ContractName.js";
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { setupWallet } from "../src/utils/setup_wallet.js";
import { getSponsoredFPCInstance } from "../src/utils/sponsored_fpc.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { getTimeouts } from "../config/config.js";

async function main() {
    const logger = createLogger('aztec:deploy:contractname');
    logger.info('Starting deployment...');

    // Setup wallet
    const wallet = await setupWallet();

    // Setup sponsored fee payment
    const sponsoredFPC = await getSponsoredFPCInstance();
    await wallet.registerContract(sponsoredFPC, SponsoredFPCContract.artifact);
    const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    // Create and deploy account
    const secretKey = Fr.random();
    const signingKey = GrumpkinScalar.random();
    const salt = Fr.random();

    logger.info('Save these credentials:');
    logger.info(`SECRET=${secretKey.toString()}`);
    logger.info(`SIGNING_KEY=${signingKey.toString()}`);
    logger.info(`SALT=${salt.toString()}`);

    const account = await wallet.createSchnorrAccount(secretKey, salt, signingKey);
    await (await account.getDeployMethod()).send({
        from: AztecAddress.ZERO,
        fee: { paymentMethod }
    }).wait({ timeout: getTimeouts().deployTimeout });

    logger.info(`Account deployed at: ${account.address}`);

    // Deploy contract
    const contract = await ContractNameContract.deploy(wallet, account.address).send({
        from: account.address,
        fee: { paymentMethod }
    }).deployed({ timeout: getTimeouts().deployTimeout });

    logger.info(`Contract deployed at: ${contract.address}`);
}

main().catch((error) => {
    console.error('Deployment failed:', error);
    process.exit(1);
});
```
