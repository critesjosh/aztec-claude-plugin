# Wallet Setup

Connect to Aztec nodes and initialize wallets for contract interaction.

## Basic Wallet Setup

```typescript
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { TestWallet } from '@aztec/test-wallet/server';

export async function setupWallet(): Promise<TestWallet> {
    const nodeUrl = 'http://localhost:8080';  // or devnet URL
    const node = createAztecNodeClient(nodeUrl);

    // proverEnabled: false for local, true for devnet
    const proverEnabled = false;

    const wallet = await TestWallet.create(node, { proverEnabled });
    return wallet;
}
```

## Environment-Aware Setup

```typescript
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { getAztecNodeUrl, getEnv } from '../config/config.js';
import { TestWallet } from '@aztec/test-wallet/server';

export async function setupWallet(): Promise<TestWallet> {
    const nodeUrl = getAztecNodeUrl();
    const node = createAztecNodeClient(nodeUrl);

    // Enable prover on non-local networks
    const proverEnabled = getEnv() !== 'local-network';

    const wallet = await TestWallet.create(node, { proverEnabled });
    return wallet;
}
```

## Wallet with PXE Store

For persistent state across sessions:

```typescript
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { TestWallet } from '@aztec/test-wallet/server';
import path from 'path';

export async function setupWalletWithStore(): Promise<TestWallet> {
    const nodeUrl = getAztecNodeUrl();
    const node = createAztecNodeClient(nodeUrl);

    const wallet = await TestWallet.create(node, {
        proverEnabled: false,
        dataDirectory: path.resolve(process.cwd(), './store')
    });

    return wallet;
}
```

## Registering Contracts

Before interacting with contracts, register them with the wallet:

```typescript
import { MyContract } from "../artifacts/MyContract.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";

async function setupContracts(wallet: TestWallet) {
    // Register SponsoredFPC for fee payment
    const sponsoredFPC = await getSponsoredFPCInstance();
    await wallet.registerContract(sponsoredFPC, SponsoredFPCContract.artifact);

    // Register your contract (if connecting to existing)
    const myContract = MyContract.at(contractAddress, wallet);
    await wallet.registerContract(myContract, MyContract.artifact);

    return { sponsoredFPC, myContract };
}
```

## Registering Senders

Register accounts that will send transactions:

```typescript
async function setupSenders(wallet: TestWallet, accounts: AccountManager[]) {
    for (const account of accounts) {
        await wallet.registerSender(account.address);
    }
}
```

## Complete Wallet Initialization

```typescript
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { TestWallet } from '@aztec/test-wallet/server';
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { getAztecNodeUrl, getEnv, getTimeouts } from '../config/config.js';

export interface WalletContext {
    wallet: TestWallet;
    paymentMethod: SponsoredFeePaymentMethod;
    timeouts: {
        deployTimeout: number;
        txTimeout: number;
        waitTimeout: number;
    };
}

export async function initializeWallet(): Promise<WalletContext> {
    const logger = createLogger('aztec:wallet');
    logger.info('Initializing wallet...');

    // Create wallet
    const nodeUrl = getAztecNodeUrl();
    const node = createAztecNodeClient(nodeUrl);
    const proverEnabled = getEnv() !== 'local-network';

    const wallet = await TestWallet.create(node, { proverEnabled });
    logger.info(`Connected to node at ${nodeUrl}`);

    // Setup sponsored fee payment
    const sponsoredFPC = await getSponsoredFPCInstance();
    await wallet.registerContract(sponsoredFPC, SponsoredFPCContract.artifact);
    const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
    logger.info('Fee payment configured');

    return {
        wallet,
        paymentMethod,
        timeouts: getTimeouts()
    };
}
```

## Usage Pattern

```typescript
async function main() {
    // Initialize
    const { wallet, paymentMethod, timeouts } = await initializeWallet();

    // Create or recover account
    const account = await deploySchnorrAccount(wallet);

    // Deploy or connect to contract
    const contract = await MyContract.deploy(wallet, account.address).send({
        from: account.address,
        fee: { paymentMethod }
    }).deployed({ timeout: timeouts.deployTimeout });

    // Interact
    await contract.methods.myMethod(args).send({
        from: account.address,
        fee: { paymentMethod }
    }).wait({ timeout: timeouts.txTimeout });
}
```

## Network Configuration

### Local Network

```typescript
const config = {
    nodeUrl: 'http://localhost:8080',
    proverEnabled: false,
    timeouts: {
        deployTimeout: 120000,  // 2 min
        txTimeout: 60000,       // 1 min
        waitTimeout: 30000      // 30 sec
    }
};
```

### Devnet

```typescript
const config = {
    nodeUrl: 'https://devnet-6.aztec-labs.com',
    proverEnabled: true,
    timeouts: {
        deployTimeout: 1200000,  // 20 min
        txTimeout: 180000,       // 3 min
        waitTimeout: 60000       // 1 min
    }
};
```

## Error Handling

```typescript
async function setupWalletSafe(): Promise<TestWallet | null> {
    try {
        return await setupWallet();
    } catch (error) {
        if (error.message.includes('ECONNREFUSED')) {
            console.error('Cannot connect to Aztec node. Is it running?');
            console.error('Start with: aztec start --local-network');
        } else {
            console.error(`Wallet setup failed: ${error.message}`);
        }
        return null;
    }
}
```
