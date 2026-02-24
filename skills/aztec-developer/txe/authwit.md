# Pattern: Authwit in TXE

## When to use
When you want to TXE test a function that uses authwit.

## Workflow

**Imports** - Example with token_contract:
```rust
use token_contract::Token;
use aztec::{
    oracle::random::random,
    protocol::address::AztecAddress,
    test::helpers::{test_environment::TestEnvironment, authwit}
};
```

**Adding Authwit** - inline with:
```rust
...
let nonce = unsafe { random() };
let call_interface = Token::at(token_address)
    .transfer(from, caller, amount, nonce);
authwit::add_private_authwit_from_call_interface(
    env,
    from,
    caller,
    call_interface
);
...
// from = the owner of tokens, caller = the contract invoking `transfer`
```

The TXE will automatically wire up the authwit. All authwits use nonces - keep the nonce for the parent function call.

For public authwit, use `add_public_authwit_from_call_interface` instead.

If this authwit pattern appears frequently throughout your tests, consider extracting it into a reusable utility module at tests/utils/{contract_name}.nr to minimize code repetition.
