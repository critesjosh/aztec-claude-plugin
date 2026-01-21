---
name: aztec-typescript
description: Generate TypeScript client code for interacting with Aztec contracts. Use when building frontend integrations, creating contract clients, or setting up wallet connections.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Aztec TypeScript Integration

Generate TypeScript code for interacting with Aztec contracts.

## Subskills

* [Contract Client](./contract-client.md) - Type-safe contract interaction wrapper
* [Wallet Setup](./wallet-setup.md) - Wallet and node connection patterns
* [Transaction Patterns](./transaction-patterns.md) - Common transaction patterns
* [AuthWit Frontend](./authwit-frontend.md) - Client-side authorization witness implementation

## Quick Start: Contract Interaction

```typescript
import { MyContract } from "../artifacts/MyContract.js";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { TxStatus } from "@aztec/stdlib/tx";

// Get contract instance
const contract = MyContract.at(contractAddress, wallet);

// Call a method
const tx = await contract.methods.myMethod(arg1, arg2).send({
    from: account.address,
    fee: { paymentMethod }
}).wait({ timeout: 60000 });

if (tx.status === TxStatus.SUCCESS) {
    console.log('Transaction successful');
}
```

## Generated Artifacts

After running `aztec codegen`, you get TypeScript bindings:

```typescript
// src/artifacts/MyContract.ts
import { MyContractContract } from "../artifacts/MyContract.js";

// Available methods
MyContractContract.deploy(wallet, ...args)  // Deploy new contract
MyContractContract.at(address, wallet)       // Connect to existing
contract.methods.myFunction(args)            // Call contract method
```

## Key Imports

```typescript
// Contract and wallet
import { Wallet } from "@aztec/aztec.js/wallet";
import { AztecAddress } from "@aztec/stdlib/aztec-address";

// Transaction handling
import { TxStatus } from "@aztec/stdlib/tx";
import { TxReceipt } from "@aztec/stdlib/tx";

// Fee payment
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";

// Fields and types
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";

// Logging
import { Logger, createLogger } from "@aztec/aztec.js/log";
```

## Transaction Flow

1. Get contract instance (`at()` or `deploy()`)
2. Call method via `contract.methods.xxx()`
3. Send with fee payment `.send({ from, fee })`
4. Wait for confirmation `.wait({ timeout })`
5. Check status `tx.status === TxStatus.SUCCESS`
