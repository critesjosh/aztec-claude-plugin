# Account Recovery

Recover existing Aztec accounts from saved credentials.

## Recovery from Environment Variables

### .env File

```bash
# Account credentials
SECRET=0x1234567890abcdef...
SIGNING_KEY=0x9876543210fedcba...
SALT=0xabcdef1234567890...
```

### Recovery Function

```typescript
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { TestWallet } from "@aztec/test-wallet/server";

export async function recoverAccountFromEnv(
    wallet: TestWallet
): Promise<AccountManager> {
    // Load from environment
    const secretKey = Fr.fromString(process.env.SECRET!);
    const signingKey = GrumpkinScalar.fromString(process.env.SIGNING_KEY!);
    const salt = Fr.fromString(process.env.SALT!);

    // Recreate account manager
    const account = await wallet.createSchnorrAccount(secretKey, salt, signingKey);

    console.log(`Recovered account: ${account.address}`);

    return account;
}
```

## Recovery from Credentials Object

```typescript
export interface AccountCredentials {
    secretKey: string;
    signingKey: string;
    salt: string;
}

export async function recoverAccount(
    wallet: TestWallet,
    credentials: AccountCredentials
): Promise<AccountManager> {
    const secretKey = Fr.fromString(credentials.secretKey);
    const signingKey = GrumpkinScalar.fromString(credentials.signingKey);
    const salt = Fr.fromString(credentials.salt);

    return await wallet.createSchnorrAccount(secretKey, salt, signingKey);
}

// Usage
const account = await recoverAccount(wallet, {
    secretKey: '0x1234...',
    signingKey: '0x5678...',
    salt: '0x9abc...'
});
```

## Complete Recovery Utility

```typescript
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { TestWallet } from "@aztec/test-wallet/server";
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export async function createAccountFromEnv(
    wallet: TestWallet
): Promise<AccountManager | null> {
    const logger = createLogger('aztec:account:recovery');

    // Check for required credentials
    if (!process.env.SECRET || !process.env.SIGNING_KEY || !process.env.SALT) {
        logger.warn('Missing account credentials in .env');
        logger.info('Required: SECRET, SIGNING_KEY, SALT');
        return null;
    }

    try {
        const secretKey = Fr.fromString(process.env.SECRET);
        const signingKey = GrumpkinScalar.fromString(process.env.SIGNING_KEY);
        const salt = Fr.fromString(process.env.SALT);

        const account = await wallet.createSchnorrAccount(secretKey, salt, signingKey);

        logger.info(`Account recovered: ${account.address}`);

        // Register as sender
        await wallet.registerSender(account.address);

        return account;
    } catch (error) {
        logger.error(`Failed to recover account: ${error}`);
        return null;
    }
}
```

## Verifying Account Recovery

Check that a recovered account has the expected address:

```typescript
async function verifyAccountRecovery(
    wallet: TestWallet,
    expectedAddress: string
): Promise<boolean> {
    const account = await recoverAccountFromEnv(wallet);

    if (account.address.toString() !== expectedAddress) {
        console.error('Address mismatch!');
        console.error(`Expected: ${expectedAddress}`);
        console.error(`Got: ${account.address}`);
        return false;
    }

    console.log('Account verified successfully');
    return true;
}
```

## Using Recovered Account

After recovery, the account can be used immediately if already deployed:

```typescript
async function useRecoveredAccount() {
    const wallet = await setupWallet();

    // Recover account
    const account = await recoverAccountFromEnv(wallet);
    if (!account) {
        throw new Error('Failed to recover account');
    }

    // Setup fee payment
    const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    // Use account for transactions
    const contract = MyContract.at(contractAddress, wallet);

    await contract.methods.myMethod(args).send({
        from: account.address,
        fee: { paymentMethod }
    }).wait({ timeout: 60000 });
}
```

## Recovery vs New Deployment

| Scenario | Action |
|----------|--------|
| First time | Generate new keys, deploy account |
| Have credentials | Recover, skip deployment |
| Lost credentials | Generate new keys, deploy new account |

## Checking if Account is Deployed

```typescript
async function isAccountDeployed(
    wallet: TestWallet,
    account: AccountManager
): Promise<boolean> {
    try {
        const contractClass = await wallet.getContractClassAt(account.address);
        return contractClass !== undefined;
    } catch {
        return false;
    }
}

// Usage
const account = await recoverAccountFromEnv(wallet);
const isDeployed = await isAccountDeployed(wallet, account);

if (!isDeployed) {
    console.log('Account not yet deployed, deploying...');
    await (await account.getDeployMethod()).send({
        from: AztecAddress.ZERO,
        fee: { paymentMethod }
    }).wait({ timeout: 120000 });
}
```

## Environment File Template

```bash
# .env.example

# Account credentials (populated after first deployment)
SECRET=
SIGNING_KEY=
SALT=

# Contract deployment info
CONTRACT_ADDRESS=
CONTRACT_SALT=
CONTRACT_DEPLOYER=
CONTRACT_CONSTRUCTOR_ARGS=

# Environment
AZTEC_ENV=local-network
```
