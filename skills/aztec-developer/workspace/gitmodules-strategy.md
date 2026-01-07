# Pattern: Aztec Gitmodule Dependencies

## When to use
Importing a contract from GitHub that the Aztec contracts use.

**[CRITICAL]** NEVER USE THIS SUBSKILL FOR `aztec-packages` or any import whose Nargo.toml has package.type == "lib" (library)

## Workflow

### 1. Create the deps folder
Create a `deps/` folder at the project root:
```bash
mkdir -p deps
```

### 2. Add the gitmodule
Add the repository as a git submodule inside the `deps/` folder:
```bash
git submodule add <repo-url> deps/<repo-name>
```

### 3. Checkout the correct version
Navigate to the submodule and checkout the version matching your Aztec Version:
```bash
cd deps/<repo-name>
git checkout <tag-or-commit>
cd ../..
```
If the tag is not found, ask the user for the version they want before continuing

### 4. Initialize submodules (for cloning)
When cloning a project with submodules:
```bash
git clone --recurse-submodules <your-repo>
```

Or if already cloned:
```bash
git submodule update --init --recursive
```

### 5. Find the target package
In deps/{import} you will find the entire repository. The nargo.toml of your target import may be in the root, or may be nested further in the contract - either as a workspace member or the import isn't at root. Find the path to where the Nargo.toml of the target import is for step 6. It should contain the Nargo.toml as well as the src folder containing the lib or contract implementation.

### 6. Symlinking
Symlink the folder you found in step 5. Use [project setup spec](./project-setup.md) to know where to place the new contract.

### 7 Handle nargo workspace and compilation
* review the [nargo import spec](./nargo-imports.md) for contract level imports
* review the [compilation script spec](./compilation-script.md) for handling the new compilation.

## Directory Structure
```
project-root/
├── deps/
│   └── <repo-name>/
│       └── ...
├── src/
│   └── your_contract/
│       ├── Nargo.toml
│       └── src/
├── Nargo.toml
└── .gitmodules
```
