# Pattern: Public Structs (Packable)

## When to Use
When you need structured data in **public** storage. Notes are for private state; Packable structs are for public state.

## Mental Model
Public state is stored as raw fields on-chain (like Ethereum storage). To store a struct, it must be serializable to/from fields. The `Packable` trait handles this.

## Defining a Public Struct

```rust
use aztec::protocol::{
    address::AztecAddress,
    traits::{Deserialize, Packable, Serialize},
};

#[derive(Deserialize, Packable, Serialize)]
pub struct Config {
    pub admin: AztecAddress,
    pub fee_rate: u64,
    pub paused: bool,
}
```

Required derives:
- **`Packable`** - For storage read/write
- **`Serialize`** - For returning from functions
- **`Deserialize`** - For receiving as parameters

## Using in Storage

```rust
#[storage]
struct Storage<Context> {
    config: PublicMutable<Config, Context>,
    assets: Map<Field, PublicMutable<Asset, Context>, Context>,
}

#[external("public")]
fn update_config(new_config: Config) {
    self.storage.config.write(new_config);
}

#[external("public")]
#[view]
fn get_config() -> Config {
    self.storage.config.read()
}
```

## Notes vs Public Structs

| Aspect | Notes (`#[note]`) | Public Structs (`Packable`) |
|--------|-------------------|----------------------------|
| Privacy | Encrypted, private | Plaintext, public |
| Context | Private functions only | Public functions only |
| Storage | Note hash tree | Public storage slots |
| Required traits | `Eq`, `Packable`, `NullifiableNote` | `Packable`, `Serialize`, `Deserialize` |

## Reference
`token_contract` - uses Packable structs for public config
