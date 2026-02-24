# Contract Client Pattern

Create type-safe wrapper classes for Aztec contract interaction.

## Basic Contract Client

```typescript
import { MyContract } from "../artifacts/MyContract.js";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { TxStatus } from "@aztec/stdlib/tx";
import type { Wallet } from "@aztec/aztec.js/wallet";
import type { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { type Logger, createLogger } from "@aztec/foundation/log";

export class MyContractClient {
    private contract: MyContract;
    private wallet: Wallet;
    private paymentMethod: SponsoredFeePaymentMethod;
    private logger: Logger;
    private defaultTimeout: number;

    constructor(
        contractAddress: AztecAddress,
        wallet: Wallet,
        paymentMethod: SponsoredFeePaymentMethod,
        timeout: number = 60000
    ) {
        this.contract = MyContract.at(contractAddress, wallet);
        this.wallet = wallet;
        this.paymentMethod = paymentMethod;
        this.defaultTimeout = timeout;
        this.logger = createLogger('aztec:mycontract:client');
    }

    /**
     * Get the underlying contract instance
     */
    getContract(): MyContract {
        return this.contract;
    }

    /**
     * Get the contract address
     */
    getAddress(): AztecAddress {
        return this.contract.address;
    }

    /**
     * Example public function call
     */
    async createItem(
        itemId: bigint,
        sender: AztecAddress
    ): Promise<void> {
        this.logger.info(`Creating item ${itemId}...`);

        const tx = await this.contract.methods.create_item(itemId).send({
            from: sender,
            fee: { paymentMethod: this.paymentMethod },
            wait: { timeout: this.defaultTimeout }
        });

        if (tx.status !== TxStatus.PROPOSED && tx.status !== TxStatus.FINALIZED) {
            throw new Error(`create_item failed: ${tx.status}`);
        }

        this.logger.info(`Item ${itemId} created successfully`);
    }

    /**
     * Example private function call
     */
    async transferPrivate(
        to: AztecAddress,
        amount: bigint,
        sender: AztecAddress
    ): Promise<void> {
        this.logger.info(`Transferring ${amount} to ${to}...`);

        const tx = await this.contract.methods.transfer(to, amount).send({
            from: sender,
            fee: { paymentMethod: this.paymentMethod },
            wait: { timeout: this.defaultTimeout }
        });

        if (tx.status !== TxStatus.PROPOSED && tx.status !== TxStatus.FINALIZED) {
            throw new Error(`transfer failed: ${tx.status}`);
        }

        this.logger.info('Transfer successful');
    }

    /**
     * Example view/simulate function
     */
    async getBalance(
        owner: AztecAddress,
        sender: AztecAddress
    ): Promise<bigint> {
        const result = await this.contract.methods.balance_of(owner).simulate({
            from: sender
        });
        return result;
    }
}
```

## Usage Example

```typescript
import { MyContractClient } from "./client/MyContractClient.js";

async function main() {
    const wallet = await setupWallet();
    const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
    const account = await recoverAccountFromEnv(wallet);

    // Create client
    const client = new MyContractClient(
        contractAddress,
        wallet,
        paymentMethod,
        getTimeouts().txTimeout
    );

    // Use client
    await client.createItem(1n, account.address);
    const balance = await client.getBalance(account.address, account.address);
    console.log(`Balance: ${balance}`);
}
```

## Static Factory Methods

```typescript
export class MyContractClient {
    // ... existing code ...

    /**
     * Deploy and create client for new contract
     */
    static async deploy(
        wallet: Wallet,
        admin: AztecAddress,
        paymentMethod: SponsoredFeePaymentMethod,
        timeout: number = 120000
    ): Promise<MyContractClient> {
        const contract = await MyContract.deploy(wallet, admin).send({
            from: admin,
            fee: { paymentMethod },
            wait: { timeout, returnReceipt: true }
        });

        return new MyContractClient(
            contract.address,
            wallet,
            paymentMethod
        );
    }

    /**
     * Connect to existing contract
     */
    static connect(
        address: AztecAddress,
        wallet: Wallet,
        paymentMethod: SponsoredFeePaymentMethod
    ): MyContractClient {
        return new MyContractClient(address, wallet, paymentMethod);
    }
}
```

## Error Handling

```typescript
export class ContractError extends Error {
    constructor(
        message: string,
        public readonly method: string,
        public readonly txStatus?: string
    ) {
        super(message);
        this.name = 'ContractError';
    }
}

async function safeCall<T>(
    method: string,
    operation: () => Promise<T>
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        if (error instanceof Error) {
            throw new ContractError(
                error.message,
                method,
                undefined
            );
        }
        throw error;
    }
}

// Usage in client
async createItem(itemId: bigint, sender: AztecAddress): Promise<void> {
    return safeCall('create_item', async () => {
        const tx = await this.contract.methods.create_item(itemId).send({
            from: sender,
            fee: { paymentMethod: this.paymentMethod },
            wait: { timeout: this.defaultTimeout }
        });

        if (tx.status !== TxStatus.PROPOSED && tx.status !== TxStatus.FINALIZED) {
            throw new ContractError(
                `Transaction failed`,
                'create_item',
                tx.status
            );
        }
    });
}
```

## Batch Operations

```typescript
async function batchTransfers(
    client: MyContractClient,
    transfers: Array<{ to: AztecAddress; amount: bigint }>,
    sender: AztecAddress
): Promise<void> {
    for (const { to, amount } of transfers) {
        await client.transferPrivate(to, amount, sender);
    }
}
```

## Type Definitions

```typescript
// types.ts
import { AztecAddress } from "@aztec/aztec.js/addresses";

export interface TransferParams {
    to: AztecAddress;
    amount: bigint;
}

export interface CreateItemParams {
    itemId: bigint;
    metadata?: string;
}

export interface ClientConfig {
    timeout: number;
    retries: number;
}
```
