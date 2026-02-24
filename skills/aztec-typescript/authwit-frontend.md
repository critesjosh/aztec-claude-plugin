# AuthWit Frontend Implementation

Client-side patterns for creating and using Authorization Witnesses (AuthWit) in TypeScript.

## Overview

AuthWit allows a user to authorize a contract to perform actions on their behalf, such as transferring their tokens. This is similar to ERC-20 approvals but authorizes specific actions rather than amounts.

## Basic Pattern

Three steps: build the action, create the witness, include in transaction.

```typescript
import { Fr } from "@aztec/aztec.js/fields";

// 1. Generate a fresh nonce (prevents replay attacks)
const nonce = Fr.random();

// 2. Build the action to authorize
const action = tokenContract.methods.transfer_in_private(
  fromAddress, // Token owner
  toAddress, // Recipient
  amount, // Amount to transfer
  nonce, // Single-use nonce
);

// 3. Create the authorization witness
// First param: address authorizing the action
// Second param: { caller, action } - caller is the contract that will execute
const witness = await wallet.createAuthWit(fromAddress, {
  caller: vaultContract.address,
  action,
});

// 4. Include witness in send() options
await vaultContract.methods
  .deposit(amount)
  .send({ from: wallet.address, authWitnesses: [witness], wait: { timeout: 600 } });
```

## Private vs Public AuthWit

### Private AuthWit

- Created off-chain by the user
- Included directly in the transaction payload
- Verified privately during proof generation (not registered on-chain)
- Most common for private transfers

```typescript
// Private AuthWit - included with transaction
const witness = await wallet.createAuthWit(fromAddress, { caller, action });
await someAction.send({ authWitnesses: [witness], wait: { timeout: 600 } });
```

### Public AuthWit

- Requires a separate on-chain transaction to register
- Anyone can see the authorization exists
- Used when authorization must be visible before use

```typescript
// Public AuthWit - registered on-chain first
const innerHash = await action.computeInnerAuthWitHash();
await wallet.setPublicAuthWit(innerHash, true).send({ wait: { timeout: 600 } });

// Later, the authorized action can execute
await someAction.send({ wait: { timeout: 600 } });
```

## Multiple Authorizations

When a transaction needs multiple authorizations:

```typescript
// Create witnesses for multiple sources
const witness1 = await wallet1.createAuthWit(from1Address, {
  caller: contractAddress,
  action: action1,
});

const witness2 = await wallet2.createAuthWit(from2Address, {
  caller: contractAddress,
  action: action2,
});

// Include all witnesses in send() options
await contract.methods
  .multiSourceOperation()
  .send({ from, authWitnesses: [witness1, witness2], wait: { timeout: 600 } });
```

## Nonce Management

**Critical: Each AuthWit can only be used once.** The nonce prevents replay attacks.

```typescript
import { Fr } from "@aztec/aztec.js/fields";

// Always generate a fresh nonce
const nonce = Fr.random();

// Include nonce in the authorized action
const action = contract.methods.transfer_in_private(from, to, amount, nonce);
```

### Nonce Best Practices

1. **Generate fresh nonces** for every authorization
2. **Never reuse nonces** - transactions will fail
3. **Store nonces** if you need to reference them later (e.g., for cancellation)

## Common Errors and Solutions

### "Authorization not found"

**Cause:** The witness wasn't included or parameters don't match.

```typescript
// Wrong: Parameters don't match
const action = contract.methods.transfer(from, to, 100n, nonce);
const witness = await wallet.createAuthWit(from, { caller, action });

// Then calling with different amount - FAILS
await caller.methods.doTransfer(from, to, 200n, nonce).send({ wait: { timeout: 600 } });
```

**Fix:** Ensure action parameters exactly match the contract call.

### "Nullifier already exists"

**Cause:** Attempting to reuse an AuthWit.

```typescript
// Wrong: Reusing the same nonce
const nonce = Fr.random();
await doAuthorizedAction(nonce);
await doAuthorizedAction(nonce); // FAILS - nonce already used
```

**Fix:** Generate a fresh nonce for each authorization.

### "Invalid caller"

**Cause:** The contract executing the action doesn't match the authorized caller.

```typescript
// Wrong: Authorized for wrong caller
const witness = await wallet.createAuthWit(fromAddress, {
  caller: contractA.address, // Authorized contractA
  action,
});

// Then contractB tries to use it - FAILS
await contractB.methods
  .useAuth()
  .send({ authWitnesses: [witness], wait: { timeout: 600 } });
```

**Fix:** Ensure `caller` matches the contract that will execute the authorized action.

## Best Practices

1. **Always generate fresh nonces** using `Fr.random()`
2. **Match parameters exactly** between action and contract call
3. **Specify correct caller** - the contract that executes the action
4. **Handle errors gracefully** with clear messages
