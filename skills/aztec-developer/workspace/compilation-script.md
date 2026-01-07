# Pattern: Compilation Script

## When to use
When creating or modifying compilation scripts, or adding new contract gitmodules.

## Workflow

1. **Artifact directory structure** - Set up with index.ts exports
2. **Create utility helpers** in `scripts/utils.ts`
3. **Create compile script** at `scripts/compile-contracts.ts`
4. **Add compile command** to package.json

## Utils Module

```typescript
// scripts/utils.ts
import { spawn } from 'child_process';
import { readFile, writeFile } from 'fs/promises';

export async function execCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
    proc.on('error', reject);
  });
}

export async function replaceInFile(
  filePath: string,
  searchValue: string | RegExp,
  replaceValue: string
): Promise<void> {
  const content = await readFile(filePath, 'utf-8');
  const newContent = content.replace(searchValue, replaceValue);
  await writeFile(filePath, newContent);
}
```

## Compile Script Example

```typescript
// scripts/compile-contracts.ts
import { execCommand, replaceInFile } from './utils';
import { cp } from 'fs/promises';

async function main() {
  // Compile contracts (includes transpilation and verification key generation)
  await execCommand('aztec', ['compile']);

  // Generate TypeScript bindings
  await execCommand('aztec', ['codegen', 'target/', '-o', 'ts/src/artifacts']);

  // Copy artifacts
  await cp('target/my_contract.json', 'ts/src/artifacts/my_contract.json');

  // Fix import paths in generated bindings
  await replaceInFile(
    'ts/src/artifacts/MyContract.ts',
    /from '\.\.\/\.\.\/target/g,
    "from './"
  );
}

main().catch(console.error);
```

## Package.json

```json
{
  "scripts": {
    "compile": "ts-node scripts/compile-contracts.ts"
  }
}
```

## Troubleshooting

1. **Copy operations fail**: Verify actual filenames in target directory
2. **replaceInFile not working**: Ensure search strings match content exactly
3. **Contract build errors**: Outside this pattern's scope - check contract code
