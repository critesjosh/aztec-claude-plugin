# Transaction Patterns

Common patterns for Aztec transaction handling in TypeScript.

## Basic Transaction Flow

```typescript
import { TxStatus } from "@aztec/stdlib/tx";

// 1. Call method
const txPromise = contract.methods.myMethod(args).send({
    from: senderAddress,
    fee: { paymentMethod }
});

// 2. Wait for confirmation
const tx = await txPromise.wait({ timeout: 60000 });

// 3. Check status
if (tx.status === TxStatus.SUCCESS) {
    console.log('Transaction successful');
} else {
    console.error(`Transaction failed: ${tx.status}`);
}
```

## Transaction Options

```typescript
interface SendOptions {
    from: AztecAddress;    // Sender address
    fee: {
        paymentMethod: FeePaymentMethod;
    };
}

interface WaitOptions {
    timeout: number;       // Max wait time in ms
}
```

## Public Function Calls

Public functions execute on-chain with visible state changes:

```typescript
// Create a new item (public state change)
const tx = await contract.methods.create_item(itemId).send({
    from: account.address,
    fee: { paymentMethod }
}).wait({ timeout: 60000 });

// Update public storage
const tx = await contract.methods.set_value(newValue).send({
    from: admin.address,
    fee: { paymentMethod }
}).wait({ timeout: 60000 });
```

## Private Function Calls

Private functions execute client-side, creating encrypted notes:

```typescript
// Private transfer (creates notes)
const tx = await contract.methods.transfer(recipient, amount).send({
    from: sender.address,
    fee: { paymentMethod }
}).wait({ timeout: 60000 });

// Store private data
const tx = await contract.methods.store_secret(secretData).send({
    from: account.address,
    fee: { paymentMethod }
}).wait({ timeout: 60000 });
```

## View/Simulate Functions

Simulate without sending a transaction:

```typescript
// Read public state
const value = await contract.methods.get_value().simulate({
    from: account.address
});

// Read private balance
const balance = await contract.methods.balance_of(owner).simulate({
    from: owner
});
```

## Transaction with Retry

```typescript
async function sendWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 5000
): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;
            console.log(`Attempt ${attempt} failed: ${error.message}`);

            if (attempt < maxRetries) {
                console.log(`Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

// Usage
const tx = await sendWithRetry(async () => {
    return await contract.methods.myMethod(args).send({
        from: account.address,
        fee: { paymentMethod }
    }).wait({ timeout: 60000 });
});
```

## Waiting for Multiple Transactions

```typescript
async function waitForAll(
    transactions: Array<Promise<TxReceipt>>
): Promise<TxReceipt[]> {
    return Promise.all(transactions);
}

// Usage
const txPromises = [
    contract.methods.action1(args1).send({ from, fee }).wait({ timeout }),
    contract.methods.action2(args2).send({ from, fee }).wait({ timeout }),
];

const receipts = await waitForAll(txPromises);
```

## Sequential Transactions

When order matters:

```typescript
async function executeSequential(
    actions: Array<() => Promise<TxReceipt>>
): Promise<TxReceipt[]> {
    const results: TxReceipt[] = [];

    for (const action of actions) {
        const result = await action();
        results.push(result);
    }

    return results;
}

// Usage
const receipts = await executeSequential([
    () => contract.methods.step1().send({ from, fee }).wait({ timeout }),
    () => contract.methods.step2().send({ from, fee }).wait({ timeout }),
    () => contract.methods.step3().send({ from, fee }).wait({ timeout }),
]);
```

## Error Handling Patterns

### Catch Specific Errors

```typescript
try {
    await contract.methods.transfer(to, amount).send({
        from: account.address,
        fee: { paymentMethod }
    }).wait({ timeout: 60000 });
} catch (error) {
    if (error.message.includes('insufficient balance')) {
        console.error('Not enough tokens for transfer');
    } else if (error.message.includes('timeout')) {
        console.error('Transaction timed out - network may be congested');
    } else if (error.message.includes('fee')) {
        console.error('Fee payment failed');
    } else {
        throw error;
    }
}
```

### Transaction Status Handling

```typescript
import { TxStatus } from "@aztec/stdlib/tx";

const tx = await contract.methods.myMethod(args).send({
    from: account.address,
    fee: { paymentMethod }
}).wait({ timeout: 60000 });

switch (tx.status) {
    case TxStatus.SUCCESS:
        console.log('Transaction succeeded');
        break;
    case TxStatus.DROPPED:
        console.error('Transaction was dropped');
        break;
    case TxStatus.REVERTED:
        console.error('Transaction reverted');
        break;
    default:
        console.error(`Unknown status: ${tx.status}`);
}
```

## Contract Deployment Pattern

```typescript
async function deployContract(
    wallet: TestWallet,
    admin: AztecAddress,
    paymentMethod: SponsoredFeePaymentMethod,
    timeout: number
): Promise<MyContract> {
    const deployMethod = MyContract.deploy(wallet, admin).send({
        from: admin,
        fee: { paymentMethod }
    });

    const contract = await deployMethod.deployed({ timeout });

    // Get instance data for recovery
    const instance = await deployMethod.getInstance();
    if (instance) {
        console.log(`Contract deployed at: ${contract.address}`);
        console.log(`Salt: ${instance.salt}`);
        console.log(`Deployer: ${instance.deployer}`);
    }

    return contract;
}
```

## Helper Functions

```typescript
// Reusable send helper
async function sendTx(
    contract: any,
    methodName: string,
    args: any[],
    from: AztecAddress,
    paymentMethod: SponsoredFeePaymentMethod,
    timeout: number
) {
    const tx = await contract.methods[methodName](...args).send({
        from,
        fee: { paymentMethod }
    }).wait({ timeout });

    if (tx.status !== TxStatus.SUCCESS) {
        throw new Error(`${methodName} failed: ${tx.status}`);
    }

    return tx;
}

// Usage
await sendTx(contract, 'create_item', [itemId], account.address, paymentMethod, 60000);
await sendTx(contract, 'transfer', [to, amount], account.address, paymentMethod, 60000);
```
