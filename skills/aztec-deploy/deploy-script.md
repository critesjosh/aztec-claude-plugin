# Deployment Script Template

Complete TypeScript deployment script with all components.

## Full Deployment Script

```typescript
import { MyContract } from "../src/artifacts/MyContract.js";
import { type Logger, createLogger } from "@aztec/foundation/log";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { setupWallet } from "../src/utils/setup_wallet.js";
import { getSponsoredFPCInstance } from "../src/utils/sponsored_fpc.js";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { Fr } from "@aztec/aztec.js/fields";
import { GrumpkinScalar } from "@aztec/foundation/curves/grumpkin";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { getTimeouts } from "../config/config.js";

async function main() {
    const logger: Logger = createLogger('aztec:deploy:mycontract');
    logger.info('Starting contract deployment process...');

    const timeouts = getTimeouts();

    // ==========================================
    // STEP 1: Setup Wallet
    // ==========================================
    logger.info('Setting up wallet...');
    const wallet = await setupWallet();
    logger.info('Wallet set up successfully');

    // ==========================================
    // STEP 2: Setup Sponsored Fee Payment
    // ==========================================
    logger.info('Setting up sponsored fee payment contract...');
    const sponsoredFPC = await getSponsoredFPCInstance();
    logger.info(`Sponsored FPC instance obtained at: ${sponsoredFPC.address}`);

    logger.info('Registering sponsored FPC contract with wallet...');
    await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
    logger.info('Sponsored fee payment method configured');

    // ==========================================
    // STEP 3: Deploy or Recover Account
    // ==========================================
    logger.info('Creating Schnorr account...');

    // Generate new keys (or load from environment)
    const secretKey = Fr.random();
    const signingKey = GrumpkinScalar.random();
    const salt = Fr.random();

    // IMPORTANT: Save these for future use
    logger.info('Save these credentials:');
    logger.info(`SECRET=${secretKey.toString()}`);
    logger.info(`SIGNING_KEY=${signingKey.toString()}`);
    logger.info(`SALT=${salt.toString()}`);

    const account = await wallet.createSchnorrAccount(secretKey, salt, signingKey);
    logger.info(`Account address will be: ${account.address}`);

    // Deploy account
    const deployMethod = await account.getDeployMethod();
    const accountTx = await deployMethod.send({
        from: AztecAddress.ZERO,
        fee: { paymentMethod: sponsoredPaymentMethod },
        wait: { timeout: timeouts.deployTimeout }
    });

    logger.info(`Account deployed! Tx hash: ${accountTx.txHash}`);

    // ==========================================
    // STEP 4: Deploy Contract
    // ==========================================
    logger.info('Starting contract deployment...');
    logger.info(`Admin address for contract: ${account.address}`);

    // Replace with your contract's constructor arguments
    const constructorArgs = [account.address]; // Example: admin address

    const contractDeployMethod = MyContract.deploy(wallet, ...constructorArgs);

    logger.info('Waiting for deployment transaction to be mined...');
    const { contract } = await contractDeployMethod.send({
        from: account.address,
        fee: { paymentMethod: sponsoredPaymentMethod },
        wait: { timeout: timeouts.deployTimeout, returnReceipt: true }
    });

    logger.info(`Contract deployed successfully!`);
    logger.info(`Contract address: ${contract.address}`);

    // ==========================================
    // STEP 5: Get Instantiation Data (for recovery)
    // ==========================================
    const instance = await contractDeployMethod.getInstance();
    if (instance) {
        logger.info('Contract instantiation data:');
        logger.info(`CONTRACT_SALT=${instance.salt}`);
        logger.info(`CONTRACT_DEPLOYER=${instance.deployer}`);
        logger.info(`CONTRACT_CONSTRUCTOR_ARGS=${JSON.stringify(constructorArgs.map(a => a.toString()))}`);
    }

    // ==========================================
    // Summary
    // ==========================================
    logger.info('Deployment completed successfully!');
    logger.info('Summary:');
    logger.info(`  - Contract Address: ${contract.address}`);
    logger.info(`  - Admin Address: ${account.address}`);
    logger.info(`  - Sponsored FPC: ${sponsoredFPC.address}`);
}

main().catch((error) => {
    const logger = createLogger('aztec:deploy:mycontract');
    logger.error(`Deployment failed: ${error.message}`);
    logger.error(`Error details: ${error.stack}`);
    process.exit(1);
});
```

## Utility Functions

### setup_wallet.ts

```typescript
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { getAztecNodeUrl } from '../config/config.js';
import { EmbeddedWallet } from '@aztec/wallets/embedded';

export async function setupWallet(): Promise<EmbeddedWallet> {
    const nodeUrl = getAztecNodeUrl();
    const node = createAztecNodeClient(nodeUrl);
    const wallet = await EmbeddedWallet.create(node, { ephemeral: true });
    return wallet;
}
```

### sponsored_fpc.ts

```typescript
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { Fr } from '@aztec/aztec.js/fields';

export async function getSponsoredFPCInstance() {
    return await getContractInstanceFromInstantiationParams(
        SponsoredFPCContractArtifact, { salt: new Fr(SPONSORED_FPC_SALT) }
    );
}
```

### deploy_account.ts

```typescript
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { getSponsoredFPCInstance } from "./sponsored_fpc.js";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { Fr } from "@aztec/aztec.js/fields";
import { GrumpkinScalar } from "@aztec/foundation/curves/grumpkin";
import { type Logger, createLogger } from "@aztec/foundation/log";
import { setupWallet } from "./setup_wallet.js";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { EmbeddedWallet } from "@aztec/wallets/embedded";

export async function deploySchnorrAccount(wallet?: EmbeddedWallet): Promise<AccountManager> {
    const logger: Logger = createLogger('aztec:deploy:account');
    logger.info('Starting Schnorr account deployment...');

    // Generate account keys
    const secretKey = Fr.random();
    const signingKey = GrumpkinScalar.random();
    const salt = Fr.random();

    logger.info(`Save these credentials:`);
    logger.info(`SECRET=${secretKey.toString()}`);
    logger.info(`SIGNING_KEY=${signingKey.toString()}`);
    logger.info(`SALT=${salt.toString()}`);

    const activeWallet = wallet ?? await setupWallet();
    const account = await activeWallet.createSchnorrAccount(secretKey, salt, signingKey);
    logger.info(`Account address will be: ${account.address}`);

    // Setup sponsored FPC
    const sponsoredFPC = await getSponsoredFPCInstance();
    await activeWallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    // Deploy account
    const deployMethod = await account.getDeployMethod();
    const tx = await deployMethod.send({
        from: AztecAddress.ZERO,
        fee: { paymentMethod: sponsoredPaymentMethod },
        wait: { timeout: 120000 }
    });

    logger.info(`Account deployment successful! Tx hash: ${tx.txHash}`);
    return account;
}
```

## Package.json Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "deploy": "node --loader ts-node/esm scripts/deploy_contract.ts",
    "deploy::devnet": "AZTEC_ENV=devnet node --loader ts-node/esm scripts/deploy_contract.ts",
    "deploy-account": "node --loader ts-node/esm scripts/deploy_account.ts",
    "deploy-account::devnet": "AZTEC_ENV=devnet node --loader ts-node/esm scripts/deploy_account.ts"
  }
}
```

## Running Deployment

```bash
# Local network
yarn deploy

# Devnet
yarn deploy::devnet
# OR
AZTEC_ENV=devnet yarn deploy
```
