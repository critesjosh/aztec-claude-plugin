# Fee Payment Methods

Aztec supports multiple fee payment methods for transactions.

## Sponsored Fee Payment (Recommended for Testing)

The SponsoredFPC (Fee Payment Contract) allows a relayer to pay transaction fees on behalf of users. This is the recommended method for testing and development.

### Setup

```typescript
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { getContractInstanceFromInstantiationParams } from "@aztec/aztec.js/contracts";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { SPONSORED_FPC_SALT } from "@aztec/constants";
import { Fr } from "@aztec/aztec.js/fields";

// Get the SponsoredFPC instance (v4 pattern)
export async function getSponsoredFPCInstance() {
    return await getContractInstanceFromInstantiationParams(
        SponsoredFPCContractArtifact,
        { salt: new Fr(SPONSORED_FPC_SALT) }
    );
}

// Setup payment method
const sponsoredFPC = await getSponsoredFPCInstance();
await wallet.registerContract({ artifact: SponsoredFPCContractArtifact, instance: sponsoredFPC });
const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
```

### Usage

```typescript
// Deploy account with sponsored fees
await (await account.getDeployMethod()).send({
    from: AztecAddress.ZERO,  // No sender for account deployment
    fee: { paymentMethod },
    wait: { timeout: 120000 }
});

// Deploy contract with sponsored fees
const { contract } = await MyContract.deploy(wallet, args).send({
    from: account.address,
    fee: { paymentMethod },
    wait: { timeout: 120000, returnReceipt: true }
});

// Call contract method with sponsored fees
await contract.methods.myMethod(args).send({
    from: account.address,
    fee: { paymentMethod },
    wait: { timeout: 60000 }
});
```

## Fee Payment Options

### 1. Sponsored (SponsoredFPC)

- Relayer pays all fees
- Best for: Testing, onboarding new users
- No token balance required

```typescript
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
```

### 2. Private Fee Payment

- Pay fees from private balance
- Best for: Privacy-preserving transactions

```typescript
import { PrivateFeePaymentMethod } from "@aztec/aztec.js/fee";
const paymentMethod = new PrivateFeePaymentMethod(fpcAddress, tokenAddress, gasSettings);
```

### 3. Public Fee Payment

- Pay fees from public balance
- Best for: Standard transactions

```typescript
import { PublicFeePaymentMethod } from "@aztec/aztec.js/fee";
const paymentMethod = new PublicFeePaymentMethod(fpcAddress, tokenAddress, gasSettings);
```

### 4. Fee Juice with Claim (Bridging)

- Pay fees using bridged Fee Juice from L1
- Best for: Initial account setup when bridging funds from Ethereum

```typescript
import { FeeJuicePaymentMethodWithClaim } from "@aztec/aztec.js/fee";
const paymentMethod = new FeeJuicePaymentMethodWithClaim(claim);
```

## Gas Settings

Configure gas limits and pricing with `GasSettings`:

```typescript
import { GasSettings } from "@aztec/aztec.js/entrypoint";

const gasSettings = GasSettings.default({
    maxFeesPerGas: { feePerDaGas: new Fr(10), feePerL2Gas: new Fr(10) },
});

// Pass gasSettings to fee payment methods that require it
const paymentMethod = new PrivateFeePaymentMethod(fpcAddress, tokenAddress, gasSettings);
```

## Transaction Options

All send() calls accept these options:

```typescript
interface SendMethodOptions {
    from: AztecAddress;  // Sender address
    fee: {
        paymentMethod: FeePaymentMethod;
    };
    wait?: {
        timeout: number;        // Timeout in ms
        returnReceipt?: boolean; // Return receipt (use for .deployed() replacement)
    };
}
```

## Best Practices

1. **Always use sponsored fees for testing** - Simplifies development
2. **Register FPC contract before use** - Required for fee computation
3. **Set appropriate timeouts** - Longer on devnet vs local
4. **Handle fee estimation failures** - Wrap in try-catch
5. **Use `wait` inside `send()`** - v4 merges wait options into send

```typescript
try {
    const tx = await contract.methods.myMethod(args).send({
        from: account.address,
        fee: { paymentMethod },
        wait: { timeout: 600 }
    });
} catch (error) {
    if (error.message.includes('fee')) {
        logger.error('Fee payment failed - check balance or FPC registration');
    }
    throw error;
}
```

## Environment-Specific Configuration

### Local Network
- Timeouts: 2 min deploy, 1 min tx
- Prover: Disabled
- Fees: Sponsored only

### Devnet
- Timeouts: 20 min deploy, 3 min tx
- Prover: Enabled
- Fees: All methods available
