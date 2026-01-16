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
    let from = self.msg_sender().unwrap();
    self.storage.balances.at(from).sub(amount).deliver(MessageDelivery::CONSTRAINED_ONCHAIN);
    self.enqueue(MyContract::at(self.address)._increase_public_balance(to, amount));
}

#[external("public")]
#[internal]
fn _increase_public_balance(to: AztecAddress, amount: u128) {
    let current = self.storage.public_balances.at(to).read();
    self.storage.public_balances.at(to).write(current + amount);
}
```

For self-calls, use shorthand:
```rust
self.enqueue_self._increase_public_balance(to, amount);
```

### `self.call_view()`
Read-only call (works in both contexts):
```rust
let balance = self.call_view(Token::at(token_addr).balance_of_public(owner));
```

### `self.set_as_teardown()`
For fee payment - executes after all public calls when transaction fee is known:
```rust
self.set_as_teardown(FPC::at(self.address)._complete_refund(token, partial_note, max_fee));
```

## Reference
`token_contract`, `amm_contract`, `fpc_contract`, `counter_contract`
