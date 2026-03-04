# Transaction Lifecycle

## Why This Matters

Understanding Aztec's execution model is the single most important thing for writing correct contracts. Unlike Solidity where execution is synchronous, Aztec transactions execute in **three distinct phases** with strict ordering constraints. Every "why can't I do X?" question traces back to this model.

## Three-Phase Execution Model

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: PRIVATE (runs on user's PXE)                       │
│                                                             │
│  Account.entrypoint()                                       │
│    ├─ verify signature (is_valid_impl)                      │
│    ├─ execute AppPayload calls:                             │
│    │   ├─ App.private_fn()     ← private→private composing  │
│    │   │   ├─ self.call(Token.transfer(...))                │
│    │   │   ├─ self.call(Token.prepare_partial_note(...))    │
│    │   │   └─ self.enqueue_self._public_fn(...)  ← queued  │
│    │   └─ (up to 5 batched calls in AppPayload)            │
│    └─ all private calls complete, kernel proof generated    │
│                                                             │
│  Output: proof + nullifiers + note commitments +            │
│          enqueued public call list                           │
├─────────────────────────────────────────────────────────────┤
│ Phase 2: KERNEL PROOF (submitted to network)                │
│                                                             │
│  - Validates private proof                                  │
│  - Checks nullifiers aren't already spent                   │
│  - Packages enqueued public calls for sequencer             │
├─────────────────────────────────────────────────────────────┤
│ Phase 3: PUBLIC (runs on sequencer)                         │
│                                                             │
│  Enqueued calls execute in order:                           │
│    ├─ Token._finalize_transfer(...)                         │
│    ├─ AMM._swap(...)                                        │
│    └─ Token.finalize_transfer_to_private(...)               │
│                                                             │
│  - Can read/write public state                              │
│  - Can complete partial notes                               │
│  - Cannot call back into private (already finished)         │
│  - set_as_teardown() runs last (for fee settlement)         │
└─────────────────────────────────────────────────────────────┘
```

### Key Constraints From This Model

| Constraint | Why |
|-----------|-----|
| Private cannot read public return values | Public hasn't executed yet |
| Public cannot call private | Private proof already generated |
| Private→private calls return values immediately | Same PXE execution, composed into one proof |
| Enqueued public calls have no return value to private | They're just recorded for later |
| All enqueued calls execute in order | Sequencer processes them sequentially |

## Account Contract Entrypoint

Every transaction starts with the user's **account contract**. This is how authentication and call dispatching work:

### What Happens Step-by-Step

1. **User signs the transaction** in TypeScript — the SDK computes a hash of the `AppPayload` (up to 5 function calls) and the user signs it.

2. **PXE calls `entrypoint()`** on the user's account contract:
```rust
fn entrypoint(app_payload: AppPayload, fee_payment_method: u8, cancellable: bool) {
    let actions = AccountActions::init(self.context, is_valid_impl);
    actions.entrypoint(app_payload, fee_payment_method, cancellable);
}
```

3. **`AccountActions.entrypoint()`** verifies the signature, then executes:
```rust
pub fn entrypoint(self, app_payload: AppPayload, fee_payment_method: u8, cancellable: bool) {
    // 1. Verify signature — calls is_valid_impl(context, app_payload.hash())
    let valid_fn = self.is_valid_impl;
    assert(valid_fn(self.context, app_payload.hash()));

    // 2. Handle fee payment method
    if fee_payment_method == AccountFeePaymentMethodOptions.PREEXISTING_FEE_JUICE { ... }

    // 3. Execute all calls in the payload
    app_payload.execute_calls(self.context);

    // 4. Optionally emit cancellation nullifier
    if cancellable { ... }
}
```

4. **`execute_calls()`** dispatches each call in the payload:
```rust
pub fn execute_calls(self, context: &mut PrivateContext) {
    for call in self.function_calls {
        if !call.target_address.is_zero() {
            if call.is_public {
                // Enqueue for public execution
                context.call_public_function_with_calldata_hash(...);
            } else {
                // Execute privately, right now, in this PXE session
                context.call_private_function_with_args_hash(...);
            }
        }
    }
}
```

### msg_sender Through the Chain

- **`entrypoint()` itself**: `msg_sender` is the account contract's own address (self-call from protocol)
- **App calls dispatched by `execute_calls()`**: `msg_sender` = the account contract's address (the user's identity)
- **Nested calls from app contracts**: `msg_sender` = the calling contract's address

This is why `self.msg_sender()` in your app contract returns the user's account address — it's their account contract calling your contract.

## Traced Example: AMM Swap

Walking through `swap_exact_tokens_for_tokens` shows all three phases in action. The user wants to swap TokenA for TokenB through the AMM.

### Phase 1: Private (PXE)

```
User's Account Contract
  └─ entrypoint(AppPayload[AMM.swap_exact_tokens_for_tokens(...)])
      └─ AMM.swap_exact_tokens_for_tokens(token_in, token_out, amount_in, amount_out_min, nonce)
          │
          │  // msg_sender = User's account address
          │  let sender = self.msg_sender();
          │
          │  // 1. Transfer input tokens to AMM's public balance
          │  //    This is private→private (self.call), executes NOW
          │  //    Token sees msg_sender = AMM contract address
          │  //    Authwit needed: user authorized AMM to transfer their tokens
          │  self.call(Token::at(token_in).transfer_to_public(
          │      sender, self.address, amount_in, authwit_nonce));
          │
          │  // 2. Prepare partial note for output tokens
          │  //    Creates commitment with sender's identity but NO amount yet
          │  let token_out_partial_note = self.call(
          │      Token::at(token_out).prepare_private_balance_increase(sender));
          │
          │  // 3. Queue the public swap calculation for later
          │  //    This does NOT execute now — just recorded in kernel proof
          │  self.enqueue_self._swap_exact_tokens_for_tokens(
          │      token_in, token_out, amount_in, amount_out_min,
          │      token_out_partial_note);
```

**At this point, PXE has:**
- Nullified the user's input token notes (spent them)
- Created a note commitment for the AMM's public balance increase
- Created a partial note commitment for the output (amount unknown)
- Recorded the enqueued public call
- Generated the kernel proof

### Phase 2: Kernel Proof → Network

The proof, nullifiers, commitments, and enqueued call list are submitted to the network.

### Phase 3: Public (Sequencer)

The sequencer executes `_swap_exact_tokens_for_tokens`:

```
AMM._swap_exact_tokens_for_tokens(token_in, token_out, amount_in, amount_out_min, partial_note)
    │
    │  // By now, transfer_to_public has already completed (enqueued earlier)
    │  // So AMM's balance already includes the input tokens
    │
    │  // 1. Read live balances (public state)
    │  let balance_in = self.view(Token::at(token_in).balance_of_public(self.address)) - amount_in;
    │  let balance_out = self.view(Token::at(token_out).balance_of_public(self.address));
    │
    │  // 2. Compute swap output using constant-product formula
    │  let amount_out = get_amount_out(amount_in, balance_in, balance_out);
    │  assert(amount_out >= amount_out_min, "INSUFFICIENT_OUTPUT_AMOUNT");
    │
    │  // 3. Complete the partial note with the calculated amount
    │  //    Now the user's PXE can reconstruct the full note
    │  Token::at(token_out).finalize_transfer_to_private(amount_out, partial_note).call(self.context);
```

### Why This Design?

The AMM **must** use this private→public pattern because:
- The swap output amount depends on live pool balances (public state)
- Private execution can't read public state (it hasn't been finalized yet)
- But we want the user's identity hidden — partial notes achieve this
- The user's identity is embedded in the partial note commitment during private execution, so the public phase never sees who the recipient is

## Common Mistakes

### Trying to read public state in private
```rust
// WRONG — public state not available in private context
#[external("private")]
fn bad_swap(amount: u128) {
    let balance = self.storage.public_balance.read(); // Won't compile
}
```
**Fix:** Enqueue a public call that reads the state and acts on it.

### Expecting return values from enqueued calls
```rust
// WRONG — enqueue doesn't return values
#[external("private")]
fn bad_logic() {
    let result = self.enqueue(Other::at(addr).compute_something()); // No return!
}
```
**Fix:** Use partial notes or pass enough context to the public call so it can act independently.

### Calling private from public
```rust
// WRONG — public cannot call private
#[external("public")]
fn bad_callback() {
    self.call(Self::at(self.address).private_fn()); // Won't work
}
```
**Fix:** This is architecturally impossible. Restructure so all private work happens before public.

## Reference
`amm_contract` — full private→public swap pipeline
`schnorr_account_contract` — account entrypoint and signature verification
`token_contract` — `transfer_to_public`, partial notes, `finalize_transfer_to_private`
