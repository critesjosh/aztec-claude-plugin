---
description: Generate a TypeScript client class for an Aztec contract
---

# Generate Contract Client

Generate a TypeScript client class for the Aztec contract named "$ARGUMENTS".

## Instructions

1. If no contract name is provided, ask for one
2. Look for the contract artifact in `src/artifacts/` to understand available methods
3. Generate a client class in `src/client/${ContractName}Client.ts` that includes:
   - Type-safe wrapper methods for all contract functions
   - Proper error handling
   - Transaction status checking
   - Logging support
   - Static factory methods for deployment and connection

4. The client should:
   - Wrap the generated contract artifact
   - Provide typed methods matching contract functions
   - Handle fee payment automatically
   - Include JSDoc documentation for methods
   - Follow the patterns from the aztec-typescript skill

## Template Structure

```typescript
import { ContractNameContract } from "../artifacts/ContractName.js";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { TxStatus } from "@aztec/stdlib/tx";
import type { Wallet } from "@aztec/aztec.js/wallet";
import type { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { Logger, createLogger } from "@aztec/aztec.js/log";

export class ContractNameClient {
    private contract: ContractNameContract;
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
        this.contract = ContractNameContract.at(contractAddress, wallet);
        this.wallet = wallet;
        this.paymentMethod = paymentMethod;
        this.defaultTimeout = timeout;
        this.logger = createLogger('aztec:client:contractname');
    }

    /**
     * Get the underlying contract instance
     */
    getContract(): ContractNameContract {
        return this.contract;
    }

    /**
     * Get the contract address
     */
    getAddress(): AztecAddress {
        return this.contract.address;
    }

    /**
     * Deploy and create client for new contract
     */
    static async deploy(
        wallet: Wallet,
        admin: AztecAddress,
        paymentMethod: SponsoredFeePaymentMethod,
        timeout: number = 120000
    ): Promise<ContractNameClient> {
        const contract = await ContractNameContract.deploy(wallet, admin).send({
            from: admin,
            fee: { paymentMethod }
        }).deployed({ timeout });

        return new ContractNameClient(
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
    ): ContractNameClient {
        return new ContractNameClient(address, wallet, paymentMethod);
    }

    // Add methods for each contract function below
    // Example:
    // async myMethod(arg1: Type1, sender: AztecAddress): Promise<void> {
    //     const tx = await this.contract.methods.my_method(arg1).send({
    //         from: sender,
    //         fee: { paymentMethod: this.paymentMethod }
    //     }).wait({ timeout: this.defaultTimeout });
    //
    //     if (tx.status !== TxStatus.SUCCESS) {
    //         throw new Error(`my_method failed: ${tx.status}`);
    //     }
    // }
}
```

## Method Generation

For each contract method, generate:

### Public/Private Methods (State Changes)
```typescript
async methodName(args, sender: AztecAddress): Promise<void> {
    this.logger.info(`Calling methodName...`);
    const tx = await this.contract.methods.method_name(args).send({
        from: sender,
        fee: { paymentMethod: this.paymentMethod }
    }).wait({ timeout: this.defaultTimeout });

    if (tx.status !== TxStatus.SUCCESS) {
        throw new Error(`method_name failed: ${tx.status}`);
    }
}
```

### View/Unconstrained Methods (Read-Only)
```typescript
async getMethodName(args, sender: AztecAddress): Promise<ReturnType> {
    return await this.contract.methods.method_name(args).simulate({
        from: sender
    });
}
```
