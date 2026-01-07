---
description: Add a test for an Aztec contract function
---

# Add Aztec Contract Test

Add a test for the Aztec contract function described as: "$ARGUMENTS"

## Instructions

1. Read the contract to understand the function being tested
2. Create a comprehensive test that covers:

   - **Setup**: Deploy the contract with proper initialization
   - **Arrange**: Set up any required state (mint tokens, set permissions, etc.)
   - **Act**: Call the function being tested
   - **Assert**: Verify the expected outcomes

3. Include tests for:

   - Happy path (normal successful execution)
   - Edge cases if applicable
   - Access control (use `#[test(should_fail)]` or `#[test(should_fail_with = "error message")]` for unauthorized access)

4. Use the TestEnvironment properly:

   ```rust
   #[test]
   unconstrained fn test_something() {
       let mut env = TestEnvironment::new();
       let owner = env.create_light_account();
       let initializer = MyContract::interface().constructor(param1, param2);
       let contract_address = env.deploy("ContractName").with_public_initializer(owner, initializer);
   }
   ```

5. Remember to:
   - Use `env.create_light_account()` to create test accounts
   - Use `env.call_private(account, Contract::at(address).function())` for private functions
   - Use `env.call_public(account, Contract::at(address).function())` for public functions
   - Use `.view_public()` for view operations on public state

Place the test in the appropriate test file, following the project's testing conventions.
