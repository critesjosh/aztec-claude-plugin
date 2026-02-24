# Pattern: Events and Logs

## Types of Logs

### Public Logs (from public functions)
Unencrypted, visible to everyone. Like Ethereum events.

```rust
self.emit(MyEvent { from, to, amount });
```

### Private Events (from private functions)
Encrypted for a specific recipient. Only they can decrypt.

```rust
use aztec::messages::message_delivery::MessageDelivery;

// self.emit() returns an EventMessage that must be delivered to recipients
let message = self.emit(MyEvent { from, to, amount });
message.deliver_to(recipient, MessageDelivery.ONCHAIN_CONSTRAINED);

// Can deliver to multiple recipients
message.deliver_to(sender, MessageDelivery.OFFCHAIN);
message.deliver_to(recipient, MessageDelivery.ONCHAIN_CONSTRAINED);
```

## Defining Events

```rust
use aztec::macros::events::event;

#[event]
struct Transfer {
    from: AztecAddress,
    to: AztecAddress,
    amount: u128,
}
```

## MessageDelivery Options

Same options as note emission:
- **`ONCHAIN_CONSTRAINED`** - In proof, most secure, most expensive
- **`ONCHAIN_UNCONSTRAINED`** - On-chain but not in proof, cheaper
- **`OFFCHAIN`** - Not on-chain, cheapest, recipient must be online

## When to Use What

| Scenario | Use |
|----------|-----|
| Public state changes | `self.emit(event)` |
| Private transfers | `self.emit(event).deliver_to(recipient, ONCHAIN_CONSTRAINED)` |
| Non-critical private notifications | `self.emit(event).deliver_to(recipient, ONCHAIN_UNCONSTRAINED)` |

## Reference
`token_contract` - emits Transfer events for private transfers
