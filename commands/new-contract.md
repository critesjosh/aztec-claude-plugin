---
description: Create a new Aztec smart contract with boilerplate code
---

# New Aztec Contract

Create a new Aztec smart contract named "$ARGUMENTS" with the standard structure.

## Instructions

1. Create a new directory for the contract under `contracts/` if it doesn't exist
2. Create a `Nargo.toml` file with the necessary Aztec dependencies
3. Create a `src/main.nr` file with the contract boilerplate including:
   - The `#[aztec]` attribute
   - Standard imports from `dep::aztec`
   - A Storage struct with common state variables
   - A public constructor/initializer
   - Example private and public functions with comments

Use the contract name provided by the user. If no name is provided, ask for one.

The contract should follow Aztec best practices and include helpful comments explaining each section.
