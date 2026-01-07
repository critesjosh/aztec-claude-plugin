# Pattern: Aztec Project Setup

## When to use
When initializing a new aztec project or when modifying an existing contract setup

### Project Creation Workflow
1. Use `aztec init --name {PROJECT_NAME} --contract` to create a new contract repository.
2. Initialize a typescript project that uses pnpm inside this repository with empty index at `ts/src/index.ts`.
Use the following tsconfig.json as a starter:
```json
{
  "compilerOptions": {
    "lib": ["ESNext", "DOM"],
    "target": "ESNext",
    "module": "ESNext",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "allowJs": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noPropertyAccessFromIndexSignature": false
  }
}
```
Override pnpm and the default tsconfig.json if requested in prompt.
3. Assume that we are working with a workspace. `{root}/src` should hold all contracts. make `{root}/src/{contract_name}/` such that the dir looks like
```
project-root/
├── src/
│   └── contract_name/
│       ├── Nargo.toml
│       └── src/
│           └── main.nr
├── Nargo.toml
```
4. make a new `Nargo.toml` that looks like
```toml
[workspace]
members = ["src/contract_name"]
```

### New contract workflow
1. make a new folder in `{root}/src` with {contract_name}
2. cd into the contract and run `aztec init --name {PROJECT_NAME} --contract`
3. in the root nargo.toml, add it as a member
4. if it requires any of the existing contracts as imports, or existing contracts import this contract, [add it to their Nargo.toml](./nargo-imports.md)
