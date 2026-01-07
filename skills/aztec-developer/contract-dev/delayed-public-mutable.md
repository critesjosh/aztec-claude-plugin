# Pattern: DelayedPublicMutable

## Mental Model
Allows private functions to read public state with stability guarantees.

**The problem**: Private execution happens client-side before the tx is submitted. If a private function reads public state that can change at any moment, the value could change between proof generation and tx inclusion, breaking the proof or enabling front-running.

**The solution**: Changes are *scheduled*, not immediate. When you update the value, it doesn't take effect until `DELAY` seconds pass. This gives private functions a stability window - they know the current value won't change for at least `DELAY` seconds.

## Key Concepts
- **Current value**: The active value (any scheduled change from >DELAY seconds ago)
- **Scheduled value**: A pending change that will become current after the delay
- **DELAY**: The stability guarantee window (in seconds), set as a generic parameter

## When to Use
Only for **slow-changing state** - updates are delayed, so frequent changes will be stale or conflicting.

Good: admin addresses, authorization lists, protocol parameters, feature flags
Bad: price oracles, balances, anything needing real-time accuracy

## Tradeoff
When you read DelayedPublicMutable in private, it internally calls `context.set_include_by_timestamp()`. This constrains the tx to only be valid if included before a certain timestamp (current time + remaining delay). This leaks timing information.

Additionally, if too short of a delay is set, it can be difficult to land a transaction.

## Reference
`token_blacklist_contract` in AztecProtocol/aztec-packages uses DelayedPublicMutable for blacklist management with private transfer checks.
