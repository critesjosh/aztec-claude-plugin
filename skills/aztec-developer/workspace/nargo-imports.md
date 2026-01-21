# Pattern: Imports

## When to use
* When an aztec smart contract requires any noir import
* When a potentially common pattern (hashing, tokens, etc) is needed

## Workflow
* add a remote package like `dep = { git = "url", tag = "{version}", directory = "{path to dir nargo.toml IF not in import dir root}" }`
* add a local package like `dep = { path = "path/to/dir/with/nargo.toml"}`

## Libraries
* `aztec = { git = "https://github.com/AztecProtocol/aztec-packages/", tag = "{version}", directory = "noir-projects/aztec-nr/aztec" }` - required for all contracts. Check `noir-projects/aztec-nr` and `noir-projects/noir-contracts` for more packages via the Aztec MCP server
* `nodash = { git = "https://github.com/olehmisar/nodash/", tag = "{check https://github.com/olehmisar/nodash/tags for latest}" }` - hash functions and math utilities. Use the Aztec MCP server to discover available utils

## Contracts
 * aztec-standards has a "token_contract" and a "nft_contract" (https://github.com/defi-wonderland/aztec-standards). As a contract, review [compilation script](./compilation-script.md) and [git module strategy](./gitmodules-strategy.md) for handling imports, linking, and compilation
