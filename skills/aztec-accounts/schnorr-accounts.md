# Schnorr Accounts

Schnorr accounts are the recommended account type for Aztec development.

## Creating a New Account

### Step 1: Generate Keys

```typescript
import { Fr } from "@aztec/aztec.js/fields";
import { GrumpkinScalar } from "@aztec/foundation/curves/grumpkin";

// Generate random keys
const secretKey = Fr.random();      // Encryption key
const signingKey = GrumpkinScalar.random();  // Transaction signing key
const salt = Fr.random();           // Address derivation salt
```

### Step 2: Create Account Manager

```typescript
import { EmbeddedWallet } from "@aztec/wallets/embedded";

const wallet = await setupWallet();
const account = await wallet.createSchnorrAccount(secretKey, salt, signingKey);

console.log(`Account address will be: ${account.address}`);
```

### Step 3: Deploy Account

Accounts must be deployed before they can send transactions:

```typescript
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";

// Setup fee payment
const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

// Get deployment method
const deployMethod = await account.getDeployMethod();

// Deploy
const tx = await deployMethod.send({
    from: AztecAddress.ZERO,  // No sender for account deployment
    fee: { paymentMethod },
    wait: { timeout: 120000 }
});

console.log(`Account deployed! Tx: ${tx.txHash}`);
```

## Complete Account Creation Utility

```typescript
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { getSponsoredFPCInstance } from "./sponsored_fpc.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { Fr } from "@aztec/aztec.js/fields";
import { GrumpkinScalar } from "@aztec/foundation/curves/grumpkin";
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { setupWallet } from "./setup_wallet.js";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { EmbeddedWallet } from "@aztec/wallets/embedded";

export interface AccountCredentials {
    secretKey: Fr;
    signingKey: GrumpkinScalar;
    salt: Fr;
    address: AztecAddress;
}

export async function createAndDeployAccount(
    wallet?: EmbeddedWallet
): Promise<{ account: AccountManager; credentials: AccountCredentials }> {
    const logger = createLogger('aztec:account');
    logger.info('Creating new Schnorr account...');

    // Generate keys
    const secretKey = Fr.random();
    const signingKey = GrumpkinScalar.random();
    const salt = Fr.random();

    // IMPORTANT: Log credentials for saving
    logger.info('Save these credentials:');
    logger.info(`SECRET=${secretKey.toString()}`);
    logger.info(`SIGNING_KEY=${signingKey.toString()}`);
    logger.info(`SALT=${salt.toString()}`);

    // Create account
    const activeWallet = wallet ?? await setupWallet();
    const account = await activeWallet.createSchnorrAccount(secretKey, salt, signingKey);
    logger.info(`Account address: ${account.address}`);

    // Setup fee payment
    const sponsoredFPC = await getSponsoredFPCInstance();
    await activeWallet.registerContract(sponsoredFPC, SponsoredFPCContract.artifact);
    const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    // Deploy account
    const deployMethod = await account.getDeployMethod();
    const tx = await deployMethod.send({
        from: AztecAddress.ZERO,
        fee: { paymentMethod },
        wait: { timeout: 120000 }
    });

    logger.info(`Account deployed! Tx: ${tx.txHash}`);

    return {
        account,
        credentials: {
            secretKey,
            signingKey,
            salt,
            address: account.address
        }
    };
}
```

## Creating Multiple Accounts

For testing with multiple users:

```typescript
async function createTestAccounts(wallet: EmbeddedWallet, count: number) {
    const accounts: AccountManager[] = [];
    const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    for (let i = 0; i < count; i++) {
        const secretKey = Fr.random();
        const signingKey = GrumpkinScalar.random();
        const salt = Fr.random();

        const account = await wallet.createSchnorrAccount(secretKey, salt, signingKey);

        await (await account.getDeployMethod()).send({
            from: AztecAddress.ZERO,
            fee: { paymentMethod },
            wait: { timeout: 120000 }
        });

        // Register account as sender
        await wallet.registerSender(account.address);

        accounts.push(account);
    }

    return accounts;
}
```

## Batch Account Generation

Generate multiple Schnorr accounts in parallel for efficient setup:

```typescript
import { Fr } from "@aztec/aztec.js/fields";
import { GrumpkinScalar } from "@aztec/foundation/curves/grumpkin";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { EmbeddedWallet } from "@aztec/wallets/embedded";

export async function generateSchnorrAccounts(
    wallet: EmbeddedWallet,
    count: number,
    paymentMethod: SponsoredFeePaymentMethod
): Promise<AccountManager[]> {
    // Step 1: Create all account managers (fast, no network)
    const accountPromises = Array.from({ length: count }, async () => {
        const secretKey = Fr.random();
        const signingKey = GrumpkinScalar.random();
        const salt = Fr.random();
        return wallet.createSchnorrAccount(secretKey, salt, signingKey);
    });
    const accounts = await Promise.all(accountPromises);

    // Step 2: Deploy all accounts (sends transactions)
    for (const account of accounts) {
        await (await account.getDeployMethod()).send({
            from: AztecAddress.ZERO,
            fee: { paymentMethod },
            wait: { timeout: 120000 }
        });
        await wallet.registerSender(account.address);
    }

    return accounts;
}

// Usage
const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
const accounts = await generateSchnorrAccounts(wallet, 3, paymentMethod);
console.log(`Created ${accounts.length} accounts`);
```

## Registering Accounts

After deployment, register accounts for transaction sending:

```typescript
// Register a deployed account as a valid sender
await wallet.registerSender(account.address);

// Now the wallet can send transactions from this account
await contract.methods.myMethod(args).send({
    from: account.address,
    fee: { paymentMethod },
    wait: { timeout: 600 }
});
```

## Key Responsibilities

| Key | Purpose | Storage |
|-----|---------|---------|
| Secret Key | Decrypt private notes | Store securely |
| Signing Key | Sign transactions | Store securely |
| Salt | Derive account address | Store for recovery |

## Security Best Practices

1. **Never commit credentials** - Use `.env` and `.gitignore`
2. **Generate fresh keys** - Don't reuse across environments
3. **Backup immediately** - Save credentials after generation
4. **Use secure storage** - Consider encryption at rest
