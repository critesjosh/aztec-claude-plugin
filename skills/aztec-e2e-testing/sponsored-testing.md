# Sponsored Fee Testing

Using sponsored fees in E2E tests simplifies testing by eliminating token management.

## Setup Sponsored Fees in Tests

```typescript
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee/testing';
import { getSponsoredFPCInstance } from "../../utils/sponsored_fpc.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { ContractInstanceWithAddress } from "@aztec/stdlib/contract";

let sponsoredFPC: ContractInstanceWithAddress;
let sponsoredPaymentMethod: SponsoredFeePaymentMethod;

beforeAll(async () => {
    // Get sponsored FPC instance
    sponsoredFPC = await getSponsoredFPCInstance();

    // Register with wallet
    await wallet.registerContract(sponsoredFPC, SponsoredFPCContract.artifact);

    // Create payment method
    sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
});
```

## Using Sponsored Fees

### Account Deployment

```typescript
// Deploy account with sponsored fees (no sender required)
await (await account.getDeployMethod()).send({
    from: AztecAddress.ZERO,  // ZERO address for account deployment
    fee: { paymentMethod: sponsoredPaymentMethod }
}).wait({ timeout: getTimeouts().deployTimeout });
```

### Contract Deployment

```typescript
// Deploy contract with sponsored fees
const contract = await MyContract.deploy(wallet, admin).send({
    from: admin,
    fee: { paymentMethod: sponsoredPaymentMethod }
}).deployed({ timeout: getTimeouts().deployTimeout });
```

### Transaction Execution

```typescript
// Execute transaction with sponsored fees
await contract.methods.myMethod(args).send({
    from: account.address,
    fee: { paymentMethod: sponsoredPaymentMethod }
}).wait({ timeout: getTimeouts().txTimeout });
```

## Complete Test Setup with Sponsored Fees

```typescript
import { MyContract } from "../../artifacts/MyContract.js";
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee/testing';
import { setupWallet } from "../../utils/setup_wallet.js";
import { getSponsoredFPCInstance } from "../../utils/sponsored_fpc.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { getTimeouts } from "../../../config/config.js";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { TxStatus } from "@aztec/stdlib/tx";
import { TestWallet } from '@aztec/test-wallet/server';
import { AccountManager } from "@aztec/aztec.js/wallet";
import { ContractInstanceWithAddress } from "@aztec/stdlib/contract";

describe("MyContract with Sponsored Fees", () => {
    let wallet: TestWallet;
    let sponsoredFPC: ContractInstanceWithAddress;
    let paymentMethod: SponsoredFeePaymentMethod;
    let account: AccountManager;
    let contract: MyContract;

    beforeAll(async () => {
        // 1. Setup wallet
        wallet = await setupWallet();

        // 2. Setup sponsored fee payment
        sponsoredFPC = await getSponsoredFPCInstance();
        await wallet.registerContract(sponsoredFPC, SponsoredFPCContract.artifact);
        paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

        // 3. Create and deploy account
        account = await wallet.createSchnorrAccount(
            Fr.random(),
            Fr.random(),
            GrumpkinScalar.random()
        );

        await (await account.getDeployMethod()).send({
            from: AztecAddress.ZERO,
            fee: { paymentMethod }
        }).wait({ timeout: getTimeouts().deployTimeout });

        await wallet.registerSender(account.address);

        // 4. Deploy contract
        contract = await MyContract.deploy(wallet, account.address).send({
            from: account.address,
            fee: { paymentMethod }
        }).deployed({ timeout: getTimeouts().deployTimeout });

    }, 600000);

    it("should perform action with sponsored fees", async () => {
        const tx = await contract.methods.myAction(args).send({
            from: account.address,
            fee: { paymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        expect(tx.status).toBe(TxStatus.SUCCESS);
    }, 60000);
});
```

## Sponsored FPC Utility

### sponsored_fpc.ts

```typescript
import { getProtocolContractAddress } from "@aztec/stdlib/protocol-contracts";
import { ProtocolContractAddresses } from "@aztec/stdlib/client";
import { ContractInstanceWithAddress } from "@aztec/stdlib/contract";

export async function getSponsoredFPCInstance(): Promise<ContractInstanceWithAddress> {
    const fpcAddress = getProtocolContractAddress(ProtocolContractAddresses.SponsoredFPC);
    return {
        address: fpcAddress,
    } as ContractInstanceWithAddress;
}
```

## Benefits of Sponsored Fees in Tests

| Benefit | Description |
|---------|-------------|
| No token setup | Don't need to mint/transfer tokens |
| Simpler tests | Focus on contract logic, not fees |
| Faster iteration | Skip token management code |
| Works on testnet | SponsoredFPC available on devnet |

## When Sponsored Fees Don't Work

Sponsored fees may not work in certain scenarios:

1. **Mainnet** - Not available on production networks
2. **Custom fee tokens** - When testing specific token payments
3. **Fee estimation** - When testing gas estimation

For these cases, use other fee payment methods:

```typescript
// Private fee payment
import { PrivateFeePaymentMethod } from "@aztec/aztec.js/fee";
const privateFee = new PrivateFeePaymentMethod(fpcAddress, tokenAddress);

// Public fee payment
import { PublicFeePaymentMethod } from "@aztec/aztec.js/fee";
const publicFee = new PublicFeePaymentMethod(fpcAddress, tokenAddress);
```

## Test Helper for Multiple Accounts

```typescript
async function createSponsoredAccount(
    wallet: TestWallet,
    paymentMethod: SponsoredFeePaymentMethod
): Promise<AccountManager> {
    const account = await wallet.createSchnorrAccount(
        Fr.random(),
        Fr.random(),
        GrumpkinScalar.random()
    );

    await (await account.getDeployMethod()).send({
        from: AztecAddress.ZERO,
        fee: { paymentMethod }
    }).wait({ timeout: getTimeouts().deployTimeout });

    await wallet.registerSender(account.address);

    return account;
}

// Usage in test
const alice = await createSponsoredAccount(wallet, paymentMethod);
const bob = await createSponsoredAccount(wallet, paymentMethod);
```
