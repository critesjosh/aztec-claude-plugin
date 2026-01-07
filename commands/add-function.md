---
description: Add a new function to an existing Aztec contract
---

# Add Function to Aztec Contract

Add a new function to the Aztec contract based on this description: "$ARGUMENTS"

## Instructions

1. First, read the existing contract to understand its structure and storage
2. Determine the appropriate function type:
   - **Private**: For client-side execution, working with private state
   - **Public**: For on-chain execution, working with public state
   - **Internal**: For functions only callable by the contract itself
   - **View**: For read-only functions
   - **Unconstrained**: For off-chain reads of private state

3. Implement the function with:
   - Proper attributes (`#[external("private")]`, `#[external("public")]`, `#[view]`, `#[only_self]`, etc.)
   - Access control if needed
   - Appropriate state operations
   - Clear error messages in assertions

4. If the function needs to communicate between private and public domains, implement the enqueue pattern correctly

5. Add any necessary imports or storage variables

Ensure the function follows Aztec best practices and integrates well with the existing contract.
