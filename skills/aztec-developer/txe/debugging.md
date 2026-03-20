# Pattern: Debugging TXE Test Failures

## When to use
When a TXE test fails and you need to diagnose the root cause.

## Common Issues

### 1. "Not authorized" / Authorization Errors

The most frequent test failure. The caller passed to `env.call_private()` or `env.call_public()` does not match what the contract expects.

**Diagnosis:**
- Verify you are passing the correct account as the first argument:
  ```rust
  // The first argument is the caller — this sets msg_sender inside the contract
  env.call_private(alice, Token::at(token_address).transfer(bob, 100));
  ```
- Check that the account has the required role (e.g., admin, minter, owner)
- If the function requires an authwit, ensure you have created and added one. See [Authwit](./authwit.md)

**Common mistake — wrong caller:**
```rust
// WRONG: bob is calling transfer, but the contract deducts from msg_sender (bob),
// not from alice. If bob has no balance, this fails.
env.call_private(bob, Token::at(token_address).transfer(alice, 100));

// RIGHT: alice calls transfer, deducting from her own balance
env.call_private(alice, Token::at(token_address).transfer(bob, 100));
```

### 2. State Not Updating

Public or private state appears unchanged after a function call.

**Diagnosis:**
- Ensure you are using the correct call method for the function type:
  - `env.call_private(caller, ...)` for `#[external("private")]` functions
  - `env.call_public(caller, ...)` for `#[external("public")]` functions
- If a private function enqueues a public call, both phases execute automatically in TXE — no extra steps needed
- Check that you are reading state with the correct method:
  - `env.view_public(...)` for public state
  - `env.execute_utility(...)` for unconstrained reads (e.g., `balance_of_private`)

**Common mistake — reading with wrong method:**
```rust
// WRONG: Using view_public for a private balance query
let balance = env.view_public(Token::at(addr).balance_of_private(alice));

// RIGHT: Use execute_utility for unconstrained functions
let balance = env.execute_utility(Token::at(addr).balance_of_private(alice));
```

### 3. Note Not Found

A note expected to exist cannot be retrieved or consumed.

**Diagnosis:**
- Confirm the note was created before you try to consume it
- Verify the note owner is correct — only the owner can nullify (spend/consume) a note
- If the note was created in a private function, make sure that function was called with the right caller
- Check that the note's storage slot is correct (e.g., `storage.balances.at(owner)` uses the right `owner`)

**Common mistake — wrong note owner:**
```rust
// This creates a note owned by `alice` (the caller, msg_sender)
env.call_private(alice, Token::at(addr).mint_private(alice, 100));

// This fails if `bob` tries to spend alice's note
env.call_private(bob, Token::at(addr).transfer(alice, 50)); // bob has no notes!

// Correct: alice spends her own note
env.call_private(alice, Token::at(addr).transfer(bob, 50));
```

### 4. Assertion Failures (Wrong Values)

The test asserts a value that doesn't match the actual state.

**Diagnosis:**
- Use `println` or `dep::aztec::oracle::debug_log::debug_log` to inspect intermediate values
- Check for off-by-one errors, especially in round counters or array indices
- Verify expected vs actual values — the test output shows both
- For Field arithmetic, remember that underflow wraps around (no negative numbers)

**Debugging with print:**
```rust
#[test]
unconstrained fn test_balance_after_transfer() {
    // ... setup ...
    env.call_private(alice, Token::at(addr).transfer(bob, 50));

    let balance = env.execute_utility(Token::at(addr).balance_of_private(alice));
    println(f"Alice balance after transfer: {balance}");
    assert(balance == 50);
}
```

### 5. Deployment Failures

Contract deployment fails during test setup.

**Diagnosis:**
- The string passed to `env.deploy("ContractName")` must match the contract name in `Nargo.toml`
- Ensure the initializer interface matches the contract's constructor signature exactly
- Check that all constructor arguments are valid (non-zero addresses where required, etc.)

**Common mistake — name mismatch:**
```rust
// WRONG: Name doesn't match Nargo.toml
let addr = env.deploy("token").with_public_initializer(owner, init);

// RIGHT: Must match the exact name from Nargo.toml
let addr = env.deploy("Token").with_public_initializer(owner, init);
```

### 6. Expected Failure Tests Passing When They Shouldn't

A `#[test(should_fail)]` test passes, but the function isn't actually failing for the right reason.

**Diagnosis:**
- Use `#[test(should_fail_with = "specific error message")]` instead of bare `#[test(should_fail)]`
- This ensures the test fails for the expected reason, not due to an unrelated error
- Match the exact error string from the contract's `assert()` message

```rust
// FRAGILE: Passes on ANY failure, even unrelated ones
#[test(should_fail)]
unconstrained fn test_unauthorized() { ... }

// BETTER: Only passes if the specific error occurs
#[test(should_fail_with = "Unauthorized")]
unconstrained fn test_unauthorized() { ... }
```

### 7. Account Type Issues

Some features require specific account types.

**Diagnosis:**
- `env.create_light_account()` — fast, sufficient for most tests, but does NOT support authwits
- `env.create_contract_account()` — slower, but supports authwits and full account contract features
- If a test needs authwit support (e.g., `transfer_in_public` with allowance), use `create_contract_account()`

```rust
// Light account — no authwit support
let alice = env.create_light_account();

// Contract account — needed when testing authwit flows
let alice = env.create_contract_account();
```

## General Debugging Strategy

1. **Isolate the failure**: Comment out test logic and add it back incrementally
2. **Check the call chain**: Trace which functions are called and in what order
3. **Verify msg_sender**: The first argument to `env.call_private`/`env.call_public` determines `msg_sender` inside the contract
4. **Read error messages carefully**: TXE error messages often include the failing assertion text from the contract
5. **Run with output**: Use `aztec test --show-output` to see `println` debug output
6. **Run a single test**: Use `aztec test --test-name test_my_function` to focus on one failing test
