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
message.deliver_to(recipient, MessageDelivery.CONSTRAINED_ONCHAIN);

// Can deliver to multiple recipients
message.deliver_to(sender, MessageDelivery.UNCONSTRAINED_OFFCHAIN);
message.deliver_to(recipient, MessageDelivery.CONSTRAINED_ONCHAIN);
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
- **`CONSTRAINED_ONCHAIN`** - In proof, most secure, most expensive
- **`UNCONSTRAINED_ONCHAIN`** - On-chain but not in proof, cheaper
- **`UNCONSTRAINED_OFFCHAIN`** - Not on-chain, cheapest, recipient must be online

## When to Use What

| Scenario | Use |
|----------|-----|
| Public state changes | `self.emit(event)` |
| Private transfers | `self.emit(event).deliver_to(recipient, CONSTRAINED_ONCHAIN)` |
| Non-critical private notifications | `self.emit(event).deliver_to(recipient, UNCONSTRAINED_ONCHAIN)` |

## Reference
`token_contract` - emits Transfer events for private transfers
