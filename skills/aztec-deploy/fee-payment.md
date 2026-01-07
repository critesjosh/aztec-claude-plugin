# Fee Payment Methods

Aztec supports multiple fee payment methods for transactions.

## Sponsored Fee Payment (Recommended for Testing)

The SponsoredFPC (Fee Payment Contract) allows a relayer to pay transaction fees on behalf of users. This is the recommended method for testing and development.

### Setup

```typescript
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { getProtocolContractAddress } from "@aztec/stdlib/protocol-contracts";
import { ProtocolContractAddresses } from "@aztec/stdlib/client";

// Get the SponsoredFPC instance
async function getSponsoredFPCInstance() {
    const fpcAddress = getProtocolContractAddress(ProtocolContractAddresses.SponsoredFPC);
    return {
        address: fpcAddress,
    };
}

// Setup payment method
const sponsoredFPC = await getSponsoredFPCInstance();
await wallet.registerContract(sponsoredFPC, SponsoredFPCContract.artifact);
const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
```

### Usage

```typescript
// Deploy account with sponsored fees
await (await account.getDeployMethod()).send({
    from: AztecAddress.ZERO,  // No sender for account deployment
    fee: { paymentMethod }
}).wait({ timeout: 120000 });

// Deploy contract with sponsored fees
const contract = await MyContract.deploy(wallet, args).send({
    from: account.address,
    fee: { paymentMethod }
}).deployed({ timeout: 120000 });

// Call contract method with sponsored fees
await contract.methods.myMethod(args).send({
    from: account.address,
    fee: { paymentMethod }
}).wait({ timeout: 60000 });
```

## Fee Payment Options

### 1. Sponsored (SponsoredFPC)

- Relayer pays all fees
- Best for: Testing, onboarding new users
- No token balance required

```typescript
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
```

### 2. Private Fee Payment

- Pay fees from private balance
- Best for: Privacy-preserving transactions

```typescript
import { PrivateFeePaymentMethod } from "@aztec/aztec.js/fee";
const paymentMethod = new PrivateFeePaymentMethod(fpcAddress, tokenAddress);
```

### 3. Public Fee Payment

- Pay fees from public balance
- Best for: Standard transactions

```typescript
import { PublicFeePaymentMethod } from "@aztec/aztec.js/fee";
const paymentMethod = new PublicFeePaymentMethod(fpcAddress, tokenAddress);
```

## Transaction Options

All send() calls accept these options:

```typescript
interface SendMethodOptions {
    from: AztecAddress;  // Sender address
    fee: {
        paymentMethod: FeePaymentMethod;
    };
}
```

## Best Practices

1. **Always use sponsored fees for testing** - Simplifies development
2. **Register FPC contract before use** - Required for fee computation
3. **Set appropriate timeouts** - Longer on devnet vs local
4. **Handle fee estimation failures** - Wrap in try-catch

```typescript
try {
    const tx = await contract.methods.myMethod(args).send({
        from: account.address,
        fee: { paymentMethod }
    }).wait({ timeout: getTimeouts().txTimeout });
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
