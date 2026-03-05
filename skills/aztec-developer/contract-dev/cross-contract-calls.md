# Pattern: Cross-Contract Calls

## Mental Model
Private and public are **two separate execution phases**, not just access modifiers:
1. **Private phase**: Runs entirely client-side to generate a proof. All private→private calls complete here and can return values.
2. **Public phase**: Enqueued public calls are submitted to the network and execute on-chain in order, like normal smart contract calls.

This is why private can't get return values from public (it hasn't run yet) and public can't call private (it already finished).

## Syntax
Cross-contract calls use `self.call()`, `self.enqueue()`, etc.:

```rust
// Call another contract
self.call(ContractName::at(address).function_name(args));

// For self-calls, use shorthand
self.enqueue_self.my_public_function(args);
```

## Call Methods

### `self.call()`
Same-domain immediate execution (private→private or public→public):
```rust
self.call(Token::at(token_addr).transfer(to, amount));
```

### `self.enqueue()`
Private queues public call for later execution:
```rust
#[external("private")]
fn transfer_to_public(to: AztecAddress, amount: u128) {
    let from = self.msg_sender();
    self.storage.balances.at(from).sub(amount).deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
    self.enqueue(MyContract::at(self.address)._increase_public_balance(to, amount));
}

#[external("public")]
#[only_self]
fn _increase_public_balance(to: AztecAddress, amount: u128) {
    let current = self.storage.public_balances.at(to).read();
    self.storage.public_balances.at(to).write(current + amount);
}
```

For self-calls, use shorthand:
```rust
self.enqueue_self._increase_public_balance(to, amount);
```

### `self.view()`
Read-only call (works in both contexts):
```rust
let balance = self.view(Token::at(token_addr).balance_of_public(owner));
```

### `self.set_as_teardown()`
For fee payment - executes after all public calls when transaction fee is known:
```rust
self.set_as_teardown(FPC::at(self.address)._complete_refund(token, partial_note, max_fee));
```

## What Actually Happens at Runtime

The syntax above hides important runtime behavior. Here's what each call method actually does:

### `self.call()` — Immediate Same-Domain Execution

Both functions execute **in the same PXE session** (private→private) or **in the same sequencer batch** (public→public):
- The called function runs immediately and returns a value
- `msg_sender` in the called function = the calling contract's address
- Private→private: composed into the same kernel proof
- Public→public: executes sequentially in the same block

### `self.enqueue()` / `self.enqueue_self` — Deferred Public Execution

The public call is **recorded but NOT executed** during private execution:
- No return value available to the private caller (public hasn't run yet)
- The call is added to the kernel proof's enqueued call list
- Executes later on the sequencer, in the order it was enqueued
- `msg_sender` in the public function = the contract that enqueued it
- With `#[only_self]`: asserts `msg_sender == self.address` (the contract itself)

### `self.view()` — Static (Read-Only) Call

Makes a **static call** that cannot modify state:
- In **private context**: executes on PXE, returns a value not proven in the circuit (potentially stale data from last synced block)
- In **public context**: executes on the sequencer with current on-chain state, same trust model as other public calls
- Useful for reading state from other contracts without side effects

### `self.set_as_teardown()` — Post-Execution Hook

Executes **after all other public calls**, when the transaction fee is known:
- Used by Fee Payment Contracts (FPC) to settle refunds
- The `transaction_fee` global is only available in teardown phase

## msg_sender Propagation

Understanding who `msg_sender` is at each point prevents subtle authorization bugs:

| Call Chain | msg_sender in Target |
|-----------|---------------------|
| User → ContractA.foo() | User's account contract address |
| ContractA.foo() → `self.call(ContractB.bar())` | ContractA's address |
| ContractA.foo() → `self.enqueue_self._pub()` | ContractA's address (verified by `#[only_self]`) |
| AppPayload dispatches ContractA.foo() | User's account contract address |

### Privacy Implication

When a private function enqueues a public call, `msg_sender` in the public function is **visible on-chain**. This reveals which contract made the call, though not necessarily which user initiated it.

### Incognito Calls (Hiding msg_sender)

Use `self.enqueue_incognito()` to hide the calling contract's identity from public functions:

```rust
// Standard enqueue — msg_sender visible on-chain
self.enqueue(Token::at(address).increase_total_supply_by(amount));

// Incognito — msg_sender is None in the public function
self.enqueue_incognito(Token::at(address).increase_total_supply_by(amount));
```

**Three incognito variants:**
- `self.enqueue_incognito(call)` — enqueue public call with hidden sender
- `self.enqueue_view_incognito(call)` — read-only public call with hidden sender
- `self.set_as_teardown_incognito(call)` — teardown call with hidden sender

**Important:** The target public function must handle a None msg_sender. If it calls `self.msg_sender()` (which unwraps), it will **revert**. The function must use `self.context.maybe_msg_sender()` instead and handle the None case.

## Traced Example: AMM Swap Pipeline

The AMM's `swap_exact_tokens_for_tokens` demonstrates the full private→enqueue→public pipeline:

```
PRIVATE PHASE (PXE):
─────────────────────
User calls AMM.swap_exact_tokens_for_tokens(token_in, token_out, 100, 90, nonce)
│
│  msg_sender = User's account address
│
├─ self.call(Token.transfer_to_public(user, AMM, 100, nonce))
│     msg_sender = AMM address
│     Token checks authwit: "Did User authorize AMM to transfer 100 tokens?"
│     Nullifies user's private notes, creates public balance for AMM
│
├─ self.call(Token.prepare_private_balance_increase(user))
│     msg_sender = AMM address
│     Creates partial note commitment (user's identity + randomness, NO amount)
│     Returns PartialUintNote to AMM
│
└─ self.enqueue_self._swap_exact_tokens_for_tokens(...)
      Records call for public execution — does NOT run now

PUBLIC PHASE (Sequencer):
─────────────────────────
AMM._swap_exact_tokens_for_tokens(token_in, token_out, 100, 90, partial_note)
│
│  msg_sender = AMM address (enqueued by self)
│  #[only_self] verifies this
│
├─ Reads live pool balances (public state, now available)
├─ Computes amount_out = 95 using constant-product formula
├─ Asserts 95 >= 90 (amount_out_min)
└─ Token.finalize_transfer_to_private(95, partial_note)
      Completes the partial note with amount = 95
      User's PXE reconstructs the full note on next sync
```

## Reference
`token_contract`, `amm_contract`, `fpc_contract`, `counter_contract`
