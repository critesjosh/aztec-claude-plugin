# Environment Configuration

Configure your Aztec project for different deployment targets.

## Configuration Structure

### config/local-network.json

```json
{
  "name": "local-network",
  "environment": "local",
  "network": {
    "nodeUrl": "http://localhost:8080",
    "l1RpcUrl": "http://localhost:8545",
    "l1ChainId": 31337
  },
  "settings": {
    "skipLocalNetwork": false,
    "version": "3.0.0-devnet.6-patch.1"
  },
  "timeouts": {
    "deployTimeout": 120000,
    "txTimeout": 60000,
    "waitTimeout": 30000
  }
}
```

### config/devnet.json

```json
{
  "name": "devnet",
  "environment": "devnet",
  "network": {
    "nodeUrl": "https://devnet-6.aztec-labs.com",
    "l1RpcUrl": "https://sepolia.infura.io/v3/YOUR_KEY",
    "l1ChainId": 11155111
  },
  "settings": {
    "skipLocalNetwork": true,
    "version": "3.0.0-devnet.6-patch.1"
  },
  "timeouts": {
    "deployTimeout": 1200000,
    "txTimeout": 180000,
    "waitTimeout": 60000
  }
}
```

## Configuration Manager

### config/config.ts

```typescript
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface NetworkConfig {
  nodeUrl: string;
  l1RpcUrl: string;
  l1ChainId: number;
}

export interface TimeoutConfig {
  deployTimeout: number;
  txTimeout: number;
  waitTimeout: number;
}

export interface EnvironmentConfig {
  name: string;
  environment: 'local' | 'testnet' | 'devnet' | 'mainnet';
  network: NetworkConfig;
  settings: {
    skipLocalNetwork: boolean;
    version: string;
  };
  timeouts?: TimeoutConfig;
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config!: EnvironmentConfig;

  private constructor() {
    const env = process.env.AZTEC_ENV || 'local-network';
    const configPath = path.resolve(process.cwd(), `config/${env}.json`);
    const configData = fs.readFileSync(configPath, 'utf-8');
    this.config = JSON.parse(configData);
    console.log(`Loaded configuration: ${this.config.name}`);
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public getConfig(): EnvironmentConfig {
    return this.config;
  }

  public getNodeUrl(): string {
    return this.config.network.nodeUrl;
  }

  public getL1RpcUrl(): string {
    return this.config.network.l1RpcUrl;
  }

  public isDevnet(): boolean {
    return this.config.environment === 'devnet';
  }

  public isLocalNetwork(): boolean {
    return this.config.environment === 'local';
  }

  public getTimeouts(): TimeoutConfig {
    if (this.config.timeouts) {
      return this.config.timeouts;
    }

    // Default timeouts based on environment
    if (this.isDevnet()) {
      return {
        deployTimeout: 1200000, // 20 minutes
        txTimeout: 180000,      // 3 minutes
        waitTimeout: 60000      // 1 minute
      };
    }

    return {
      deployTimeout: 120000,  // 2 minutes
      txTimeout: 60000,       // 1 minute
      waitTimeout: 30000      // 30 seconds
    };
  }
}

// Export convenience functions
const configManager = ConfigManager.getInstance();

export function getAztecNodeUrl(): string {
  return configManager.getNodeUrl();
}

export function getL1RpcUrl(): string {
  return configManager.getL1RpcUrl();
}

export function getEnv(): string {
  return configManager.getConfig().name;
}

export function getTimeouts(): TimeoutConfig {
  return configManager.getTimeouts();
}

export default configManager;
```

## Environment Variables

### .env.example

```bash
# Environment selection
AZTEC_ENV=local-network  # or "devnet"

# Account credentials (save after first deployment)
SECRET=
SIGNING_KEY=
SALT=

# Contract deployment (save after deployment)
CONTRACT_ADDRESS=
CONTRACT_SALT=
CONTRACT_DEPLOYER=
CONTRACT_CONSTRUCTOR_ARGS=

# Optional: API keys for devnet
INFURA_API_KEY=
```

## Switching Environments

### Option 1: Environment Variable

```bash
# Local network (default)
yarn deploy

# Devnet
AZTEC_ENV=devnet yarn deploy
```

### Option 2: Package.json Scripts

```json
{
  "scripts": {
    "deploy": "node --loader ts-node/esm scripts/deploy.ts",
    "deploy::devnet": "AZTEC_ENV=devnet node --loader ts-node/esm scripts/deploy.ts"
  }
}
```

### Option 3: Programmatic

```typescript
process.env.AZTEC_ENV = 'devnet';
import { getTimeouts } from '../config/config.js';
```

## Timeout Reference

| Operation | Local Network | Devnet |
|-----------|---------------|--------|
| Deploy Contract | 2 minutes | 20 minutes |
| Transaction | 1 minute | 3 minutes |
| Wait | 30 seconds | 1 minute |

## Starting Local Network

```bash
# Install Aztec tools
bash -i <(curl -s https://install.aztec.network)

# Set version and update
export VERSION=3.0.0-devnet.6-patch.1
aztec-up

# Start local network
aztec start --local-network
```

Wait for the network to be ready before deploying:

```bash
# Check if network is ready
curl http://localhost:8080/status
```
