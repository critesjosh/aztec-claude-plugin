# Pattern: Partial Notes

## When to Use

- **Public→Private transfers**: Moving tokens from public balance to private balance while hiding the recipient
- **Refunds with unknown amounts**: Private function overpays, public function determines actual cost, refund goes back privately (e.g., fee payment contracts)
- **DEX/AMM swaps**: Swap amount determined publicly, output sent privately

## Mental Model

Partial notes solve the problem: "How can a public function create a private note without knowing who it's for?"

The answer: The recipient creates an _incomplete_ note commitment in private (containing their identity, randomness, storage slot—but NOT the amount). This commitment is passed to public execution, where the amount is added and the note is finalized. The recipient's PXE can reconstruct the complete note because it knows both the private parts (from creation) and the public parts (from logs).

## Flow

1. **Private phase**: Create partial note commitment (contains recipient identity, randomness, storage slot—but NOT the amount)
2. **Pass to public**: The partial note is passed as an argument to an enqueued public call
3. **Public phase**: Complete the note by adding the amount
4. **Note discovery**: Recipient's PXE matches the encrypted partial note log with the public completion log

## Example: Token Contract Pattern

The token contract provides high-level functions for partial notes:

```rust
// In private: prepare the partial note
let partial_note = self.call(Token::at(token_address).prepare_private_balance_increase());

// Enqueue public call that will complete the note
self.enqueue(Token::at(token_address).finalize_transfer_to_private(amount, partial_note));
```

For a complete public→private transfer in a single call:

```rust
#[external("private")]
fn transfer_to_private(to: AztecAddress, amount: u64) {
    let from = self.msg_sender().unwrap();
    // Deduct from public balance and complete partial note in one flow
    self.enqueue_self._transfer_to_private(from, to, amount);
}
```

See the `token_contract` source for the full implementation of `prepare_private_balance_increase` and `finalize_transfer_to_private`.

## Reference

`token_contract` - `transfer_to_private`, `prepare_private_balance_increase`, `finalize_transfer_to_private`
`fpc_contract` - fee payment with refunds using partial notes
