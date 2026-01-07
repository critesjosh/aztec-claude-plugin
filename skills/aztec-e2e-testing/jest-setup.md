# Jest Setup for Aztec E2E Tests

Configure Jest for testing Aztec contracts.

## Jest Configuration

### jest.integration.config.json

```json
{
  "preset": "ts-jest/presets/default-esm",
  "testEnvironment": "node",
  "testMatch": ["./src/**/*.test.ts"],
  "moduleNameMapper": {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  "transform": {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        "useESM": true
      }
    ]
  },
  "extensionsToTreatAsEsm": [".ts"],
  "testTimeout": 600000,
  "maxWorkers": 1,
  "verbose": true
}
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "yarn clear-store && yarn test:js && yarn test:nr",
    "test::devnet": "AZTEC_ENV=devnet yarn test:js",
    "test:js": "yarn clear-store && node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.integration.config.json",
    "test:nr": "aztec test",
    "clear-store": "rm -rf ./store"
  }
}
```

## Test File Structure

```
src/
├── test/
│   └── e2e/
│       ├── index.test.ts      # Main contract tests
│       ├── accounts.test.ts   # Account management tests
│       └── helpers/
│           ├── setup.ts       # Test setup utilities
│           └── fixtures.ts    # Test data
```

## Basic Test Template

```typescript
import { MyContract } from "../../artifacts/MyContract.js";
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee/testing';
import { setupWallet } from "../../utils/setup_wallet.js";
import { getSponsoredFPCInstance } from "../../utils/sponsored_fpc.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { getTimeouts } from "../../../config/config.js";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { ContractInstanceWithAddress } from "@aztec/stdlib/contract";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { TxStatus } from "@aztec/stdlib/tx";
import { TestWallet } from '@aztec/test-wallet/server';
import { AccountManager } from "@aztec/aztec.js/wallet";

describe("MyContract", () => {
    let logger: Logger;
    let sponsoredFPC: ContractInstanceWithAddress;
    let sponsoredPaymentMethod: SponsoredFeePaymentMethod;
    let wallet: TestWallet;
    let account: AccountManager;
    let contract: MyContract;

    beforeAll(async () => {
        logger = createLogger('aztec:test:mycontract');
        logger.info('Setting up test environment...');

        // 1. Setup wallet
        wallet = await setupWallet();

        // 2. Setup sponsored fees
        sponsoredFPC = await getSponsoredFPCInstance();
        await wallet.registerContract(sponsoredFPC, SponsoredFPCContract.artifact);
        sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

        // 3. Create account
        const secretKey = Fr.random();
        const signingKey = GrumpkinScalar.random();
        const salt = Fr.random();
        account = await wallet.createSchnorrAccount(secretKey, salt, signingKey);

        await (await account.getDeployMethod()).send({
            from: AztecAddress.ZERO,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().deployTimeout });

        await wallet.registerSender(account.address);

        // 4. Deploy contract
        contract = await MyContract.deploy(wallet, account.address).send({
            from: account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).deployed({ timeout: getTimeouts().deployTimeout });

        logger.info(`Contract deployed at: ${contract.address}`);
    }, 600000);  // 10 minute timeout for setup

    afterAll(async () => {
        logger.info('Test suite completed');
    });

    // Tests go here
    it("should be defined", () => {
        expect(contract).toBeDefined();
        expect(contract.address).toBeDefined();
    });
});
```

## Test Setup Utilities

### helpers/setup.ts

```typescript
import { TestWallet } from '@aztec/test-wallet/server';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee/testing';
import { AccountManager } from "@aztec/aztec.js/wallet";
import { setupWallet } from "../../utils/setup_wallet.js";
import { getSponsoredFPCInstance } from "../../utils/sponsored_fpc.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { getTimeouts } from "../../../config/config.js";

export interface TestContext {
    wallet: TestWallet;
    paymentMethod: SponsoredFeePaymentMethod;
    accounts: AccountManager[];
}

export async function createTestContext(accountCount: number = 1): Promise<TestContext> {
    const wallet = await setupWallet();

    // Setup sponsored fees
    const sponsoredFPC = await getSponsoredFPCInstance();
    await wallet.registerContract(sponsoredFPC, SponsoredFPCContract.artifact);
    const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    // Create accounts
    const accounts: AccountManager[] = [];
    for (let i = 0; i < accountCount; i++) {
        const secretKey = Fr.random();
        const signingKey = GrumpkinScalar.random();
        const salt = Fr.random();

        const account = await wallet.createSchnorrAccount(secretKey, salt, signingKey);
        await (await account.getDeployMethod()).send({
            from: AztecAddress.ZERO,
            fee: { paymentMethod }
        }).wait({ timeout: getTimeouts().deployTimeout });

        await wallet.registerSender(account.address);
        accounts.push(account);
    }

    return { wallet, paymentMethod, accounts };
}
```

## Timeouts

Aztec E2E tests require longer timeouts than typical unit tests:

| Operation | Local Network | Devnet |
|-----------|---------------|--------|
| beforeAll | 10 minutes | 20 minutes |
| it() test | 1-10 minutes | 3-15 minutes |
| Transaction | 1 minute | 3 minutes |
| Deploy | 2 minutes | 20 minutes |

```typescript
// In test file
beforeAll(async () => {
    // ... setup code
}, 600000);  // 10 minutes

it("test name", async () => {
    // ... test code
}, 60000);  // 1 minute
```

## Running Tests

```bash
# All tests (local network)
yarn test

# JavaScript tests only
yarn test:js

# Devnet tests
yarn test::devnet

# Specific test file
yarn test:js -- --testPathPattern="index.test.ts"

# Watch mode (not recommended for E2E)
yarn test:js -- --watch
```
