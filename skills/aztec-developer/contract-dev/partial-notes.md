# Pattern: Partial Notes

## When to Use

- **Public->Private transfers**: Moving tokens from public balance to private balance while hiding the recipient
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

## PartialUintNote

In Aztec v4, partial notes use the `PartialUintNote` type from the `uint_note` library:

```rust
use uint_note::PartialUintNote;
```

`PartialUintNote` is a partially constructed `UintNote` that contains the recipient's identity and randomness but is missing the amount (`u128`). It is created in a private function and finalized in a public function.

## Example: Token Contract Pattern (v4)

The token contract uses internal functions to manage partial notes:

```rust
use aztec::macros::aztec;

#[aztec]
pub contract Token {
    use aztec::macros::{functions::{external, internal}, storage::storage};
    use aztec::protocol::address::AztecAddress;
    use uint_note::PartialUintNote;

    #[external("private")]
    fn transfer_to_private(to: AztecAddress, amount: u128) {
        let from = self.msg_sender();

        // In private: prepare the partial note for the recipient
        let partial_note = self.internal._prepare_private_balance_increase(to);

        // Enqueue public call to finalize the note and deduct from sender's public balance
        self.internal._finalize_transfer_to_private(from, amount, partial_note);
    }

    #[internal("private")]
    fn _prepare_private_balance_increase(to: AztecAddress) -> PartialUintNote {
        // Creates a partial note owned by `to` with randomness and storage slot,
        // but without the amount. Returns the partial note to be completed in public.
    }

    #[internal("public")]
    fn _finalize_transfer_to_private(
        from_and_completer: AztecAddress,
        amount: u128,
        partial_note: PartialUintNote,
    ) {
        // Deducts `amount` from `from_and_completer`'s public balance
        // and completes the partial note with the amount.
    }
}
```

### Key Points

- **`_prepare_private_balance_increase`** is an `#[internal("private")]` function that creates the partial note commitment for the recipient. It returns a `PartialUintNote`.
- **`_finalize_transfer_to_private`** is an `#[internal("public")]` function that completes the partial note by adding the `u128` amount and deducting from the sender's public balance.
- Both are internal functions (prefixed with `_`), called via `self.internal.*`.
- The `from_and_completer` address is both the payer (whose public balance is deducted) and the entity completing the note.

### Calling From Another Contract

When calling partial note functions on an external token contract:

```rust
// In a private function of another contract
let partial_note = Token::at(token_address)._prepare_private_balance_increase(to).call(&mut context);

// Enqueue public completion
Token::at(token_address)._finalize_transfer_to_private(from, amount, partial_note).enqueue(&mut context);
```

## Reference

`token_contract` - `transfer_to_private`, `_prepare_private_balance_increase`, `_finalize_transfer_to_private`
`fpc_contract` - fee payment with refunds using partial notes
