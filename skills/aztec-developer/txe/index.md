# TXE Unit Testing Overview

TXE (Test Execution Environment) is Aztec's native testing framework designed for Noir contracts. It simulates the Aztec network, allowing you to unit test private/public functions of a smart contract quickly and without all the overhead.

## Key Testing Principles

- **Comprehensive coverage**: Test expected cases and edge cases
- **State validation**: When modifying state, verify that expected values match across all contracts
- **Logical organization**: Organize tests by functionality—authorization, logic groups, or execution paths

## Important Considerations

Developers should be aware of potential cyclic dependencies when building multiple contracts in a single workspace. You may need to choose a main single contract downstream all others to unit test all logic.

## Subskills

1. [Setup](./setup.md) - Initialize TXE test structure and utilities
2. [Writing Tests](./writing-tests.md) - Learn test attributes and function calling
3. [Test Running](./test-running.md) - Understand compilation and execution
4. [Authwit](./authwit.md) - Test authorization-dependent functions
5. [Deploy Contract with Keys](./deploy-contract-with-keys.md) - Deploy with specific keys
