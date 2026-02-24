# E2E Test Patterns

Common patterns for Aztec E2E tests.

## Testing Contract Deployment

```typescript
it("should deploy contract successfully", async () => {
    expect(contract).toBeDefined();
    expect(contract.address).toBeDefined();
    expect(contract.address.toString()).not.toBe(AztecAddress.ZERO.toString());
}, 60000);
```

## Testing Public Functions

```typescript
it("should execute public function", async () => {
    const tx = await contract.methods.create_item(itemId).send({
        from: account.address,
        fee: { paymentMethod },
        wait: { timeout: getTimeouts().txTimeout },
    });

    expect(tx.status).toBe("success");
}, 60000);
```

## Testing Private Functions

```typescript
it("should execute private function", async () => {
    const tx = await contract.methods.transfer(recipient, amount).send({
        from: sender.address,
        fee: { paymentMethod },
        wait: { timeout: getTimeouts().txTimeout },
    });

    expect(tx.status).toBe("success");
}, 60000);
```

## Testing Error Cases

```typescript
it("should reject invalid input", async () => {
    await expect(
        contract.methods.create_item(invalidId).send({
            from: account.address,
            fee: { paymentMethod },
            wait: { timeout: getTimeouts().txTimeout },
        })
    ).rejects.toThrow();
}, 60000);
```

## Testing Access Control

```typescript
it("should reject unauthorized caller", async () => {
    // Non-admin tries to perform admin action
    await expect(
        contract.methods.admin_function().send({
            from: nonAdminAccount.address,
            fee: { paymentMethod },
            wait: { timeout: getTimeouts().txTimeout },
        })
    ).rejects.toThrow();
}, 60000);
```

## Testing Multi-User Scenarios

```typescript
describe("Multi-user tests", () => {
    let user1: AccountManager;
    let user2: AccountManager;

    beforeAll(async () => {
        // Create two user accounts
        user1 = await createAndDeployAccount(wallet, paymentMethod);
        user2 = await createAndDeployAccount(wallet, paymentMethod);
    }, 300000);

    it("should allow transfer between users", async () => {
        // User1 transfers to User2
        await contract.methods.transfer(user2.address, amount).send({
            from: user1.address,
            fee: { paymentMethod },
            wait: { timeout: getTimeouts().txTimeout },
        });

        // Verify balances
        const balance1 = await contract.methods.balance_of(user1.address).simulate({
            from: user1.address
        });
        const balance2 = await contract.methods.balance_of(user2.address).simulate({
            from: user2.address
        });

        expect(balance1).toBeLessThan(initialBalance);
        expect(balance2).toBeGreaterThan(0n);
    }, 120000);
});
```

## Testing Full Workflows

```typescript
it("should complete full workflow", async () => {
    const gameId = new Fr(100);

    // Step 1: Create game
    await contract.methods.create_game(gameId).send({
        from: player1.address,
        fee: { paymentMethod },
        wait: { timeout: getTimeouts().txTimeout },
    });

    // Step 2: Join game
    await contract.methods.join_game(gameId).send({
        from: player2.address,
        fee: { paymentMethod },
        wait: { timeout: getTimeouts().txTimeout },
    });

    // Step 3: Play rounds
    for (let round = 1; round <= 3; round++) {
        await contract.methods.play_round(gameId, round, 2, 2, 2, 2, 1).send({
            from: player1.address,
            fee: { paymentMethod },
            wait: { timeout: getTimeouts().txTimeout },
        });

        await contract.methods.play_round(gameId, round, 1, 1, 2, 2, 3).send({
            from: player2.address,
            fee: { paymentMethod },
            wait: { timeout: getTimeouts().txTimeout },
        });
    }

    // Step 4: Finish
    await contract.methods.finish_game(gameId).send({
        from: player1.address,
        fee: { paymentMethod },
        wait: { timeout: getTimeouts().txTimeout },
    });

    await contract.methods.finish_game(gameId).send({
        from: player2.address,
        fee: { paymentMethod },
        wait: { timeout: getTimeouts().txTimeout },
    });

    logger.info('Full workflow completed successfully');
}, 600000);
```

## Helper Functions

```typescript
// Reusable transaction helper
async function executeTx(
    contract: any,
    method: string,
    args: any[],
    from: AztecAddress,
    paymentMethod: SponsoredFeePaymentMethod,
    timeout: number
) {
    const tx = await contract.methods[method](...args).send({
        from,
        fee: { paymentMethod },
        wait: { timeout },
    });

    expect(tx.status).toBe("success");
    return tx;
}

// Usage
await executeTx(contract, 'create_item', [itemId], account.address, paymentMethod, 60000);
```

## Test Data Constants

```typescript
const TEST_IDS = {
    CREATE: 1,
    JOIN: 2,
    TRANSFER: 3,
    FULL_FLOW: 100,
};

const STRATEGIES = {
    balanced: { track1: 2, track2: 2, track3: 2, track4: 2, track5: 1 },
    aggressive: { track1: 3, track2: 3, track3: 3, track4: 0, track5: 0 },
};
```

## Logging in Tests

```typescript
import { Logger, createLogger } from "@aztec/aztec.js/log";

describe("MyContract", () => {
    let logger: Logger;

    beforeAll(async () => {
        logger = createLogger('aztec:test:mycontract');
        logger.info('Starting test suite');
    });

    it("test with logging", async () => {
        logger.info('Starting test');
        // ... test code
        logger.info('Test completed');
    });
});
```

## Cleanup Between Tests

```typescript
describe("Tests requiring cleanup", () => {
    let testId = 1;

    beforeEach(() => {
        // Use unique IDs for each test
        testId++;
    });

    it("test 1", async () => {
        await contract.methods.create_item(testId).send({
            from: account.address,
            fee: { paymentMethod },
            wait: { timeout: getTimeouts().txTimeout },
        });
    });

    it("test 2", async () => {
        await contract.methods.create_item(testId).send({
            from: account.address,
            fee: { paymentMethod },
            wait: { timeout: getTimeouts().txTimeout },
        });
    });
});
```
