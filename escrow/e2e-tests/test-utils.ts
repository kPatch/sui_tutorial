/**
 * Shared utilities for Escrow E2E Tests
 */

import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

export interface TestConfig {
  packageId: string;
  network: string;
  rpcUrl: string;
  gasBudget: number;
}

export interface TestUser {
  name: string;
  keypair: Ed25519Keypair;
  address: string;
}

export class TestUtils {
  static createKeypairFromEnv(envVar: string): Ed25519Keypair {
    const privateKey = process.env[envVar];
    if (!privateKey) {
      throw new Error(`${envVar} not found in environment variables. Run: npm run generate-keys`);
    }

    try {
      if (privateKey.startsWith('suiprivkey1')) {
        const { schema, secretKey } = decodeSuiPrivateKey(privateKey);
        if (schema === 'ED25519') {
          return Ed25519Keypair.fromSecretKey(secretKey);
        }
        throw new Error(`Unsupported key schema: ${schema}`);
      } else if (privateKey.startsWith('0x')) {
        const secretKey = Uint8Array.from(
          Buffer.from(privateKey.slice(2), 'hex')
        );
        return Ed25519Keypair.fromSecretKey(secretKey);
      }
      throw new Error('Invalid private key format');
    } catch (error: any) {
      throw new Error(`Failed to create keypair from ${envVar}: ${error.message}`);
    }
  }

  static async waitForTransaction(
    client: SuiClient,
    digest: string,
    timeoutMs: number = 30000
  ): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      try {
        const result = await client.getTransactionBlock({
          digest,
          options: { showEffects: true }
        });
        if (result.effects?.status?.status === 'success') {
          return;
        }
        if (result.effects?.status?.status === 'failure') {
          throw new Error(`Transaction failed: ${result.effects.status.error}`);
        }
      } catch (error: any) {
        if (!error.message.includes('not found')) {
          throw error;
        }
      }
      await this.sleep(2000);
    }
    throw new Error(`Transaction timeout: ${digest}`);
  }

  static async getBalance(
    client: SuiClient,
    address: string
  ): Promise<bigint> {
    const coins = await client.getCoins({ owner: address });
    return coins.data.reduce((sum, coin) => sum + BigInt(coin.balance), 0n);
  }

  static async getOwnedObjects(
    client: SuiClient,
    address: string,
    structType?: string
  ): Promise<any[]> {
    const objects = await client.getOwnedObjects({
      owner: address,
      filter: structType ? { StructType: structType } : undefined,
      options: { showContent: true, showType: true }
    });
    return objects.data;
  }

  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static logSection(title: string): void {
    console.log('');
    console.log('='.repeat(80));
    console.log(`  ${title}`);
    console.log('='.repeat(80));
    console.log('');
  }

  static logSuccess(message: string): void {
    console.log(`✅ ${message}`);
  }

  static logError(message: string): void {
    console.log(`❌ ${message}`);
  }

  static logInfo(message: string): void {
    console.log(`ℹ️  ${message}`);
  }

  static logWarning(message: string): void {
    console.log(`⚠️  ${message}`);
  }

  static async fundAddressFromFaucet(
    address: string,
    network: string = 'testnet'
  ): Promise<void> {
    if (network !== 'testnet' && network !== 'devnet') {
      throw new Error('Faucet only available on testnet and devnet');
    }

    const url = `https://faucet.${network}.sui.io/gas`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        FixedAmountRequest: { recipient: address }
      })
    });

    if (!response.ok) {
      throw new Error(`Faucet request failed: ${response.statusText}`);
    }

    this.logSuccess(`Funded ${address} from faucet`);
  }

  static formatSui(mist: bigint): string {
    return (Number(mist) / 1_000_000_000).toFixed(4);
  }

  static async getObjectDetails(
    client: SuiClient,
    objectId: string
  ): Promise<any> {
    return await client.getObject({
      id: objectId,
      options: { showContent: true, showType: true, showOwner: true }
    });
  }

  static extractObjectId(result: any, objectType: string): string | null {
    const created = result.effects?.created || [];
    for (const obj of created) {
      if (obj.owner && typeof obj.owner === 'object' && 'Shared' in obj.owner) {
        return obj.reference.objectId;
      }
      if (obj.reference.objectId) {
        return obj.reference.objectId;
      }
    }
    return null;
  }

  static async printTestSummary(
    results: Record<string, boolean>,
    startTime: number
  ): Promise<void> {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    this.logSection('TEST SUMMARY');
    
    const passed = Object.values(results).filter(r => r).length;
    const total = Object.values(results).length;
    const failed = total - passed;

    Object.entries(results).forEach(([test, result]) => {
      if (result) {
        this.logSuccess(test);
      } else {
        this.logError(test);
      }
    });

    console.log('');
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
    console.log(`Duration: ${duration}s`);
    console.log('');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

export class EscrowTestHelpers {
  constructor(
    private client: SuiClient,
    private packageId: string,
    private gasBudget: number
  ) {}

  /**
   * Create a test object that can be escrowed
   */
  async createTestObject(
    signer: Ed25519Keypair,
    value: number
  ): Promise<string> {
    // For testing, we'll use Sui coins as the test objects
    // In a real scenario, you'd create custom objects
    const tx = new Transaction();
    
    // Split a coin to create a test object with specific value
    const [coin] = tx.splitCoins(tx.gas, [value]);
    tx.transferObjects([coin], signer.getPublicKey().toSuiAddress());

    const result = await this.client.signAndExecuteTransaction({
      signer,
      transaction: tx,
      options: { showEffects: true, showObjectChanges: true }
    });

    await TestUtils.waitForTransaction(this.client, result.digest);

    // Get the created coin object ID
    const created = result.objectChanges?.filter(
      (obj: any) => obj.type === 'created'
    ) || [];
    
    if (created.length > 0) {
      return (created[0] as any).objectId;
    }

    throw new Error('Failed to create test object');
  }

  /**
   * Create an escrow
   */
  async createEscrow(
    sender: Ed25519Keypair,
    escrowedObjectId: string,
    escrowedObjectType: string,
    exchangeForType: string,
    recipientAddress: string
  ): Promise<string> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::escrow::create`,
      typeArguments: [escrowedObjectType, exchangeForType],
      arguments: [
        tx.object(escrowedObjectId),
        tx.pure.address(recipientAddress)
      ]
    });

    const result = await this.client.signAndExecuteTransaction({
      signer: sender,
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true
      }
    });

    await TestUtils.waitForTransaction(this.client, result.digest);

    // Extract escrow object ID
    const created = result.objectChanges?.filter(
      (obj: any) => obj.type === 'created' && obj.objectType?.includes('EscrowedObj')
    ) || [];

    if (created.length > 0) {
      return (created[0] as any).objectId;
    }

    throw new Error('Failed to create escrow');
  }

  /**
   * Claim an escrow
   */
  async claimEscrow(
    recipient: Ed25519Keypair,
    escrowObjectId: string,
    escrowedType: string,
    exchangeForType: string
  ): Promise<string> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::escrow::claim`,
      typeArguments: [escrowedType, exchangeForType],
      arguments: [tx.object(escrowObjectId)]
    });

    const result = await this.client.signAndExecuteTransaction({
      signer: recipient,
      transaction: tx,
      options: { showEffects: true, showEvents: true }
    });

    return result.digest;
  }

  /**
   * Cancel an escrow
   */
  async cancelEscrow(
    sender: Ed25519Keypair,
    escrowObjectId: string,
    escrowedType: string,
    exchangeForType: string
  ): Promise<string> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::escrow::cancel`,
      typeArguments: [escrowedType, exchangeForType],
      arguments: [tx.object(escrowObjectId)]
    });

    const result = await this.client.signAndExecuteTransaction({
      signer: sender,
      transaction: tx,
      options: { showEffects: true, showEvents: true }
    });

    return result.digest;
  }

  /**
   * Swap with exchange object
   */
  async swapEscrow(
    recipient: Ed25519Keypair,
    escrowObjectId: string,
    exchangeObjectId: string,
    escrowedType: string,
    exchangeForType: string
  ): Promise<string> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::escrow::swap`,
      typeArguments: [escrowedType, exchangeForType],
      arguments: [
        tx.object(escrowObjectId),
        tx.object(exchangeObjectId)
      ]
    });

    const result = await this.client.signAndExecuteTransaction({
      signer: recipient,
      transaction: tx,
      options: { showEffects: true, showEvents: true }
    });

    return result.digest;
  }
}

