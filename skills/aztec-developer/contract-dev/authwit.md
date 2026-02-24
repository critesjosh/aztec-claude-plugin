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

## Reference
`token_contract`, `nft_contract` - use `#[authorize_once]` for transfers/burns on behalf of others
