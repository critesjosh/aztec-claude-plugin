# Pattern: Partial Notes

## When to Use
- **Public→Private transfers**: Moving tokens from public balance to private balance while hiding the recipient
- **Refunds with unknown amounts**: Private function overpays, public function determines actual cost, refund goes back privately (e.g., fee payment contracts)
- **DEX/AMM swaps**: Swap amount determined publicly, output sent privately

## Mental Model
Partial notes solve the problem: "How can a public function create a private note without knowing who it's for?"

The answer: The recipient creates an *incomplete* note commitment in private (containing their identity, randomness, storage slot—but NOT the amount). This commitment is passed to public execution, where the amount is added and the note is finalized. The recipient's PXE can reconstruct the complete note because it knows both the private parts (from creation) and the public parts (from logs).

**Key insight**: The note commitment uses elliptic curve math. Adding `G_amt * amount` to the partial commitment in public completes the note hash, without revealing who the note belongs to.

## Flow

1. **Private phase**: Create partial note with `Note::partial(owner, storage_slot, context)` → returns `PartialNote`
2. **Pass to public**: The `PartialNote` is passed as an argument to an enqueued public call
3. **Public phase**: Complete with `partial_note.complete(context, completer, amount)` or `partial_note.complete_from_private(...)`
4. **Note discovery**: Recipient's PXE matches the encrypted partial note log with the public completion log

## API

```rust
// In private: create partial note
let partial_note = UintNote::partial(
    to,                                    // recipient
    storage.balances.at(to).set.storage_slot,  // storage slot
    context,
);

// Pass partial_note to public function...

// In public: complete the note
partial_note.complete(context, completer, amount);
```

The `completer` is an address authorized to finalize the note—typically the same as `from` (the account whose balance is being reduced).

## Reference
`token_contract` - `transfer_to_private`, `prepare_private_balance_increase`, `finalize_transfer_to_private`
`fpc_contract` - fee payment with refunds using partial notes
