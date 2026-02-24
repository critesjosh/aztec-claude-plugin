# Pattern: TXE Initial Setup

## When to use
When initializing a new TXE unit testing strategy.

### Imports
Some imports you may need:
```rust
use aztec::{
    oracle::random::random,
    protocol::address::AztecAddress,
    test::helpers::test_environment::TestEnvironment,
};
use token::Token; // contract imports will vary based on what you're testing
```

### Constants
Define globals for values reused across tests. Example for a token:
```rust
pub global USDC_NAME: str<31> = "USD Coin\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n";
pub global USDC_SYMBOL: str<31> = "USDC\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n";
pub global USDC_DECIMALS: u8 = 6;
```
Note: `str<31>` requires exactly 31 characters - pad with `\n` as needed.

### Test creation workflow
1. In the aztec package you're currently working in, add a test folder.
2. Add mod.nr to the test folder:
```rust
pub(crate) mod utils;
mod some_tests;
mod more_tests;
```
(where the non published crates are the actual unit tests you intend to run)
3. In the tests folder you created, now create a sub folder `utils` and a mod.nr
4. Make a `setup.nr` file in utils (export from utils mod.nr) with the following components:

**Account setup** - generic utility to create N accounts:
```rust
pub unconstrained fn setup_accounts<let NUM_ACCOUNTS: u32>(
    env: &mut TestEnvironment
) -> [AztecAddress; NUM_ACCOUNTS] {
    let mut accounts = [AztecAddress::zero(); NUM_ACCOUNTS];
    for i in 0..NUM_ACCOUNTS {
        accounts[i] = env.create_contract_account();
    }
    accounts
}
```

**Deployment functions** - one per contract, using any `#[initializer]`. See [deploying contracts with chosen keys](./deploy-contract-with-keys.md) for the secret escrow pattern.
```rust
pub unconstrained fn deploy_token_contract(
    env: &mut TestEnvironment,
    owner: AztecAddress,
    name: str<31>,
    symbol: str<31>,
    decimals: u8
) -> AztecAddress {
    let initializer = Token::interface().constructor_with_minter(
        name, symbol, decimals, owner, AztecAddress::zero()
    );
    env.deploy("Token").with_public_initializer(owner, initializer)
}
```
Note: `env.deploy("X")` looks for `X` in your Nargo.toml workspace. See [workspace subskill](../workspace/index.md) for setup.

**Structs** - define accounts and contracts for easy access:
```rust
pub struct TestAccounts {
    pub minter: AztecAddress,
    pub sender: AztecAddress,
    pub receiver: AztecAddress,
    pub external: AztecAddress,
}

pub struct TestContracts {
    pub usdc: AztecAddress,
    pub eth: AztecAddress,
}
```

**Setup hook** - the main export that initializes everything:
```rust
pub unconstrained fn setup(mint: bool) -> (
    &mut TestEnvironment,
    TestAccounts,
    TestContracts,
) {
    let mut env = TestEnvironment::new();
    let accounts = setup_accounts::<4>(&mut env);
    let test_accounts = TestAccounts {
        minter: accounts[0],
        sender: accounts[1],
        receiver: accounts[2],
        external: accounts[3],
    };

    let usdc = deploy_token_contract(
        &mut env,
        test_accounts.minter,
        USDC_NAME,
        USDC_SYMBOL,
        USDC_DECIMALS
    );
    let eth = deploy_token_contract(
        &mut env,
        test_accounts.minter,
        ETH_NAME,
        ETH_SYMBOL,
        ETH_DECIMALS
    );
    let test_contracts = TestContracts { usdc, eth };
    (&mut env, test_accounts, test_contracts)
}
```

### Setup Customization
Add optional params (e.g., `mint: bool`) to customize behavior per test. Common additions: token minting, additional contract deployments, custom account states. Adapt this pattern to your contract's needs.
