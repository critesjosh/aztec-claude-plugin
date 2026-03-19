import { EmbeddedWallet } from '@aztec/wallets/embedded';

export async function setupWallet(): Promise<EmbeddedWallet> {
    const nodeUrl = process.env.AZTEC_NODE_URL ?? 'http://localhost:8080';
    return EmbeddedWallet.create(nodeUrl, { ephemeral: true });
}
