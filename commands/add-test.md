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
       let owner = env.create_light_account();  // or env.create_contract_account() for authwit tests
       let initializer = MyContract::interface().constructor(param1, param2);
       let contract_address = env.deploy("ContractName").with_public_initializer(owner, initializer);

       // Call private function
       env.call_private(owner, MyContract::at(contract_address).some_private_fn(args));

       // Call public function
       env.call_public(owner, MyContract::at(contract_address).some_public_fn(args));

       // View public state (read-only)
       let result = env.view_public(MyContract::at(contract_address).get_value());

       // Simulate utility function (unconstrained reads)
       let balance = env.simulate_utility(MyContract::at(contract_address).balance_of_private(owner));
   }
   ```

5. Remember to:
   - Use `env.create_light_account()` to create test accounts (fast, limited features)
   - Use `env.create_contract_account()` for authwit tests (full features, slower)
   - Use `env.call_private(caller, Contract::at(address).function())` for private functions
   - Use `env.call_public(caller, Contract::at(address).function())` for public functions
   - Use `env.view_public(...)` for read-only view operations on public state
   - Use `env.simulate_utility(...)` for unconstrained/utility function calls

Place the test in the appropriate test file, following the project's testing conventions.
