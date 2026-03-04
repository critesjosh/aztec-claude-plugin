# Pattern: AuthWit (Authentication Witness)

## When to Use
- Token transfers on behalf of another user (`transfer_in_private(from, to, amount, nonce)`)
- Burning tokens from another user's balance
- Any action where `msg.sender` is not the asset owner

## Mental Model
AuthWit lets a user authorize another address to act on their behalf - similar to ERC-20 approvals but more flexible. Instead of approving a specific amount, you approve a specific *action* (function call with exact arguments).

**Private authwit**: User signs an authorization off-chain, caller includes it with their tx. Never hits the chain unless used.
**Public authwit**: Authorization is registered on-chain in the AuthRegistry. Anyone can see it exists.

## Key Concepts
- **Inner hash**: Hash of the action being authorized (contract, function selector, args)
- **Outer hash**: Inner hash + caller + chain context (prevents replay across chains/contracts)
- **Nonce**: Included in the action args to make each authwit unique and single-use
- **Nullifier**: When an authwit is consumed, a nullifier is emitted to prevent reuses

## Contract Side

### The `#[authorize_once]` macro
Simplest way to add authwit checks. Specify which param is the "on behalf of" address and which is the nonce:

```rust
#[authorize_once("from", "authwit_nonce")]
#[external("private")]
fn transfer_in_private(from: AztecAddress, to: AztecAddress, amount: u128, authwit_nonce: Field) {
    // If msg_sender != from, macro automatically validates authwit
    // The authwit is consumed (nullifier emitted) so it can't be reused
    self.storage.balances.at(from).sub(amount).deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
    self.storage.balances.at(to).add(amount).deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
}
```

The macro handles:
- Checking if `msg_sender == from` (skip authwit if caller is the owner)
- Validating the authwit exists and is valid
- Emitting a nullifier to prevent reuse

### Cancelling an authwit
Users can cancel an authwit they've created by emitting its nullifier:

```rust
#[external("private")]
fn cancel_authwit(inner_hash: Field) {
    let on_behalf_of = self.msg_sender();
    let nullifier = compute_authwit_nullifier(on_behalf_of, inner_hash);
    self.context.push_nullifier(nullifier);
}
```

## End-to-End Runtime Flow

Here's exactly what happens when `#[authorize_once]` fires during a transaction:

### 1. TypeScript: Create the Authorization

```typescript
// User authorizes AMM to call Token.transfer_in_private(user, to, amount, nonce)
const action = token.methods.transfer_in_private(user.address, ammAddress, amount, nonce);
const witness = await wallet.createAuthWit({ caller: ammAddress, action });
```

The SDK computes:
- **Inner hash**: `hash(token_address, function_selector, [user, to, amount, nonce])`
- **Outer hash**: `hash(inner_hash, caller=AMM, chain_id, version)`
- User signs the outer hash → witness

### 2. TypeScript: Include Witness in Transaction

```typescript
// The authwit witness is attached to the transaction that needs it
await contract.methods.swap(args).send({
    from: user.address,
    fee: { paymentMethod },
    authWitnesses: [witness],   // PXE stores this for oracle lookup
    wait: { timeout: 600 }
});
```

### 3. PXE: Private Execution Hits `#[authorize_once]`

When the AMM calls `Token.transfer_in_private(user, to, amount, nonce)`:
- The `#[authorize_once("from", "authwit_nonce")]` macro checks: is `msg_sender == from`?
- **No** (msg_sender = AMM, from = user), so authwit validation is triggered

### 4. PXE: Oracle Returns the Witness

The macro calls `get_auth_witness(outer_hash)` — a PXE oracle that looks up the witness from the transaction's `authWitnesses` array. This is not a network call — it's a local lookup.

### 5. PXE: Account Contract Verifies

The macro makes a **static call** to the user's account contract:
- Calls `verify_private_authwit(inner_hash)` on the user's account contract
- The account contract computes the outer hash from `(msg_sender=AMM, chain_id, version, inner_hash)`
- Calls `is_valid_impl` which loads the signing key and verifies the signature

### 6. PXE: Nullifier Prevents Replay

After successful verification, the macro emits a nullifier derived from the authwit. This ensures the same authorization can never be used twice — even if the user signed it, once it's consumed, it's gone.

## AMM Authwit Example

In the AMM swap, the user must authorize the AMM to transfer their input tokens:

```
TypeScript:
  const nonce = Fr.random();  // Unique per-swap
  const action = token.methods.transfer_to_public(user, amm, amount, nonce);
  const witness = await wallet.createAuthWit({ caller: ammAddress, action });

Private Execution:
  AMM.swap_exact_tokens_for_tokens(token_in, token_out, amount, min_out, nonce)
    └─ self.call(Token.transfer_to_public(user, AMM, amount, nonce))
         │  msg_sender = AMM (not user!)
         │  #[authorize_once("from", "authwit_nonce")] fires
         │  Checks: "Did user authorize AMM to call transfer_to_public(user, AMM, amount, nonce)?"
         │  get_auth_witness(outer_hash) → returns user's signature
         │  user's account contract verifies signature → valid
         │  Nullifier emitted → this exact authwit can't be reused
         └─ Transfer proceeds
```

**Why nonce matters:** Each swap uses a unique nonce, making each authwit unique. Without it, a single authorization could be replayed in multiple swaps. The nonce is included in the inner hash, so a different nonce produces a completely different authwit.

## msg_sender in Authwit Context

This is the most common source of confusion:

- When AMM calls `Token.transfer_in_private(user, to, amount, nonce)`, `msg_sender` = **AMM** (not user)
- The `#[authorize_once]` macro checks: "Did **user** (the `from` param) authorize **AMM** (the `msg_sender`) to call this exact function with these exact args?"
- If msg_sender == from, no authwit is needed (you're the owner, you can transfer your own tokens)

## Reference
`token_contract`, `nft_contract` - use `#[authorize_once]` for transfers/burns on behalf of others
`amm_contract` - authwit for token transfers during swaps/liquidity operations
