# Pattern: Contract With Custom Keys

## Overview
This pattern covers implementing contract deployment with custom keys for testing the secret escrow pattern in the TXE (Test Execution Environment).

## Required Import
```rust
use aztec::test::helpers::txe_oracles;
```

## Implementation Approach
Rather than standard contract deployment, the custom keys pattern involves:

1. **Generate a secret**: Create a random escrow secret using `unsafe { random() }`
2. **Register the account**: Call `txe_oracles::add_account(escrow_secret)` to register it
3. **Configure deployment**: Set up the initializer call interface for your contract
4. **Apply custom keys**: Assign the generated secret to `contract_instance.secret`
5. **Deploy**: Execute the deployment with your private initializer

## Key Considerations
Returning and storing the contract's secret key may be necessary depending on your specific requirements. However, an important limitation: because the TXE is unified across all accounts, all callers will know the decryption keys, preventing realistic testing of key confidentiality scenarios within this environment.

This pattern accommodates varying initializer arguments across different contract implementations.
