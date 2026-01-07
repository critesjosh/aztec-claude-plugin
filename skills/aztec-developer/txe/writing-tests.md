# Pattern: Writing Tests

## When to use
When writing or modifying a TXE unit test.

## Test Attributes

**Basic test** - must be `unconstrained` when using TestEnvironment:
```rust
#[test]
unconstrained fn test_my_function() {
    let (env, accounts, contracts) = setup();
    // test logic
}
```

**Expected failure** - test passes if it fails:
```rust
#[test(should_fail)]
unconstrained fn test_unauthorized_access() {
    let (env, accounts, contracts) = setup();
    env.call_private(attacker, Contract::at(contract).owner_only_function());
}
```

**Expected failure with message** - test passes if it fails with specific error:
```rust
#[test(should_fail_with = "Balance too low")]
unconstrained fn test_insufficient_balance() {
    let (env, accounts, contracts) = setup();
    env.call_private(owner, Token::at(token).transfer(recipient, 1000000));
}
```

## Calling Contract Functions

All methods take a `CallInterface` (e.g., `Token::at(address).function(args)`).

**Private** - requires `from` (caller):
```rust
env.call_private(caller, Token::at(token_address).transfer(recipient, 100));
```

**Public** - requires `from` (caller):
```rust
env.call_public(caller, Token::at(token_address).mint_to_public(recipient, 100));
```

**View** - read-only, no `from` needed:
```rust
let balance = env.view_public(Token::at(token_address).balance_of_public(owner));
let balance = env.view_private(Token::at(token_address).balance_of_private(owner));
```

**Utility** - simulate without state changes:
```rust
let total = env.simulate_utility(Token::at(token_address).balance_of_private(owner));
```
