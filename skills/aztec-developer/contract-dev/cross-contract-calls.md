# Pattern: Cross-Contract Calls

## Mental Model
Private and public are **two separate execution phases**, not just access modifiers:
1. **Private phase**: Runs entirely client-side to generate a proof. All private→private calls complete here and can return values.
2. **Public phase**: Enqueued public calls are submitted to the network and execute on-chain in order, like normal smart contract calls.

This is why private can't get return values from public (it hasn't run yet) and public can't call private (it already finished).

## Syntax
Cross-contract and inter-contract calls use the **same interface**:

```rust
ContractName::at(address).function_name(args).<method>(&mut context)
// For self-calls: ContractName::at(self.address)
```

## Call Methods

### `.call()`
Same-domain immediate execution (private→private or public→public):
```rust
Token::at(token_addr).transfer(to, amount).call();
```

### `.enqueue()`
Private queues public call for later execution:
```rust
#[external("private")]
fn transfer_to_public(to: AztecAddress, amount: u128) {
    self.storage.balances.at(from).sub(from, amount);
    MyContract::at(self.address)._increase_public_balance(to, amount).enqueue();
}

#[external("public")]
#[internal]
fn _increase_public_balance(to: AztecAddress, amount: u128) {
    self.storage.public_balances.at(to).write(storage.public_balances.at(to).read() + amount);
}
```

### `.view()`
Read-only call (works in both contexts):
```rust
let balance = Token::at(token_addr).balance_of_public(owner).view();
```

### `.set_as_teardown()`
For fee payment - executes after all public calls when `context.transaction_fee()` is known:
```rust
FPC::at(self.address)._complete_refund(token, partial_note, max_fee).set_as_teardown();
```

## Reference
`token_contract`, `amm_contract`, `fpc_contract`, `counter_contract`
