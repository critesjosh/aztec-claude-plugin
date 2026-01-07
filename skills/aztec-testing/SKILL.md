---
name: aztec-testing
description: Assists with testing Aztec smart contracts using the TestEnvironment. Use when writing unit tests, integration tests, or debugging test failures for Aztec contracts.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Aztec Testing Skill

You are an expert in testing Aztec smart contracts. Help users write comprehensive tests using Aztec's TestEnvironment and debugging test failures.

## Testing Framework Overview

Aztec provides a Noir-native testing framework using `TestEnvironment` that allows you to:

- Deploy contracts in a simulated environment
- Call private and public functions
- Verify state changes
- Test access control
- Simulate multiple users

## Test Setup

### Basic Test Structure

```rust
use dep::aztec::test::helpers::test_environment::TestEnvironment;

#[test]
fn test_example() {
    // Setup
    let mut env = TestEnvironment::new();

    // Deploy
    let deployer = env.deploy("MyContract");
    let initializer = MyContract::interface().constructor(args);
    let contract_address = deployer.with_public_initializer(owner, initializer);

    // Act
    let contract = MyContract::at(contract_address);
    contract.some_function(args).call(&mut env.private());

    // Assert
    let result = contract.view_function().call(&mut env.public());
    assert(result == expected);
}
```

### Deployment Options

```rust
// Deploy with public initializer
let address = deployer.with_public_initializer(owner, initializer);

// Deploy with private initializer
let address = deployer.with_private_initializer(owner, initializer);

// Deploy without initializer
let address = deployer.without_initializer();
```

## Common Testing Patterns

### Testing Private Functions

```rust
#[test]
fn test_private_transfer() {
    let mut env = TestEnvironment::new();
    let alice = AztecAddress::from_field(1);
    let bob = AztecAddress::from_field(2);

    // Deploy and setup
    let contract = deploy_token(&mut env, alice);

    // Mint to alice first
    contract.mint_private(alice, 100).call(&mut env.private());

    // Transfer from alice to bob
    env.impersonate(alice);
    contract.transfer(bob, 50).call(&mut env.private());

    // Verify balances
    let alice_balance = contract.balance_of_private(alice).call(&mut env.private());
    let bob_balance = contract.balance_of_private(bob).call(&mut env.private());

    assert(alice_balance == 50);
    assert(bob_balance == 50);
}
```

### Testing Public Functions

```rust
#[test]
fn test_public_mint() {
    let mut env = TestEnvironment::new();
    let admin = AztecAddress::from_field(1);
    let user = AztecAddress::from_field(2);

    let contract = deploy_token(&mut env, admin);

    // Admin mints tokens
    env.impersonate(admin);
    contract.mint_public(user, 1000).call(&mut env.public());

    // Verify balance
    let balance = contract.balance_of_public(user).call(&mut env.public());
    assert(balance == 1000);
}
```

### Testing Access Control

```rust
#[test(should_fail)]
fn test_unauthorized_mint() {
    let mut env = TestEnvironment::new();
    let admin = AztecAddress::from_field(1);
    let attacker = AztecAddress::from_field(2);

    let contract = deploy_token(&mut env, admin);

    // Non-admin tries to mint
    env.impersonate(attacker);
    contract.mint_public(attacker, 1000).call(&mut env.public());
    // Should fail with "Unauthorized" or similar
}
```

### Testing Private <> Public Communication

```rust
#[test]
fn test_public_to_private() {
    let mut env = TestEnvironment::new();
    let user = AztecAddress::from_field(1);

    let contract = deploy_token(&mut env, user);

    // Give user some public tokens
    contract.mint_public(user, 100).call(&mut env.public());

    // Move tokens from public to private
    env.impersonate(user);
    contract.public_to_private(50).call(&mut env.private());

    // Verify balances in both domains
    let public_balance = contract.balance_of_public(user).call(&mut env.public());
    let private_balance = contract.balance_of_private(user).call(&mut env.private());

    assert(public_balance == 50);
    assert(private_balance == 50);
}
```

## Testing Best Practices

### 1. Test Isolation

- Each test should be independent
- Don't rely on state from other tests
- Use fresh TestEnvironment for each test

### 2. Test Coverage

- Happy path scenarios
- Edge cases (zero amounts, max values)
- Access control violations
- Invalid inputs

### 3. Descriptive Test Names

```rust
#[test]
fn test_transfer_succeeds_with_sufficient_balance() { }

#[test(should_fail)]
fn test_transfer_fails_with_insufficient_balance() { }
```

### 4. Helper Functions

Create reusable helpers for common setup:

```rust
fn deploy_token(env: &mut TestEnvironment, admin: AztecAddress) -> Token {
    let deployer = env.deploy("Token");
    let initializer = Token::interface().constructor(admin);
    let address = deployer.with_public_initializer(admin, initializer);
    Token::at(address)
}
```

## Debugging Test Failures

### Common Issues

1. **"Not authorized" errors**

   - Check if you've called `env.impersonate(correct_user)`
   - Verify the user has the required role

2. **State not updating**

   - Ensure you're using the right context (`.private()` vs `.public()`)
   - Check that enqueued calls are being processed

3. **Note not found**

   - Make sure notes were created before consumption
   - Verify the note owner is correct

4. **Assertion failures**
   - Add print statements to debug values
   - Check for off-by-one errors
   - Verify expected vs actual values

## Running Tests

```bash
# Run all tests
nargo test

# Run specific test
nargo test --test-name test_transfer

# Run with verbose output
nargo test --show-output
```
