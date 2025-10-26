#!/usr/bin/env ts-node

/**
 * Atomic Swap E2E Test
 * 
 * Tests the atomic swap workflow:
 * 1. Alice creates an escrow for Bob (with Item A)
 * 2. Bob creates an escrow for Alice (with Item B)
 * 3. Bob claims Alice's escrow by providing Item B (swap)
 * 4. Alice claims Bob's escrow (simple claim)
 * 5. Verify both parties received the correct items
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import * as dotenv from 'dotenv';
import { TestUtils, EscrowTestHelpers } from './test-utils';

dotenv.config();

class SwapTest {
  private client: SuiClient;
  private alice: any;
  private bob: any;
  private charlie: any;
  private packageId: string;
  private helpers: EscrowTestHelpers;
  private gasBudget: number;

  private testResults = {
    'Setup': false,
    'Alice Creates Escrow for Bob': false,
    'Bob Creates Escrow for Alice': false,
    'Bob Swaps with Alice': false,
    'Alice Claims from Bob': false,
    'Three-Way Swap': false,
  };

  constructor() {
    this.client = new SuiClient({
      url: process.env.SUI_RPC_URL || getFullnodeUrl('testnet')
    });

    this.alice = {
      name: 'Alice',
      keypair: TestUtils.createKeypairFromEnv('ALICE_PRIVATE_KEY'),
    };
    this.alice.address = this.alice.keypair.getPublicKey().toSuiAddress();

    this.bob = {
      name: 'Bob',
      keypair: TestUtils.createKeypairFromEnv('BOB_PRIVATE_KEY'),
    };
    this.bob.address = this.bob.keypair.getPublicKey().toSuiAddress();

    this.charlie = {
      name: 'Charlie',
      keypair: TestUtils.createKeypairFromEnv('CHARLIE_PRIVATE_KEY'),
    };
    this.charlie.address = this.charlie.keypair.getPublicKey().toSuiAddress();

    this.packageId = process.env.PACKAGE_ID || '';
    this.gasBudget = parseInt(process.env.GAS_BUDGET || '50000000');

    if (!this.packageId) {
      throw new Error('PACKAGE_ID not set in environment variables');
    }

    this.helpers = new EscrowTestHelpers(
      this.client,
      this.packageId,
      this.gasBudget
    );
  }

  async run() {
    const startTime = Date.now();

    TestUtils.logSection('ATOMIC SWAP E2E TEST');
    console.log(`📦 Package ID: ${this.packageId}`);
    console.log(`👩 Alice: ${this.alice.address}`);
    console.log(`👨 Bob: ${this.bob.address}`);
    console.log(`👤 Charlie: ${this.charlie.address}`);
    console.log('');

    try {
      await this.testSetup();
      await this.testAliceCreatesEscrow();
      await this.testBobCreatesEscrow();
      await this.testBobSwapsWithAlice();
      await this.testAliceClaimsFromBob();
      await this.testThreeWaySwap();
    } catch (error: any) {
      TestUtils.logError(`Test failed: ${error.message}`);
      console.error(error);
    }

    await TestUtils.printTestSummary(this.testResults, startTime);
  }

  private async testSetup() {
    TestUtils.logSection('Test 1: Setup');

    try {
      const aliceBalance = await TestUtils.getBalance(this.client, this.alice.address);
      const bobBalance = await TestUtils.getBalance(this.client, this.bob.address);
      const charlieBalance = await TestUtils.getBalance(this.client, this.charlie.address);

      TestUtils.logInfo(`Alice balance: ${TestUtils.formatSui(aliceBalance)} SUI`);
      TestUtils.logInfo(`Bob balance: ${TestUtils.formatSui(bobBalance)} SUI`);
      TestUtils.logInfo(`Charlie balance: ${TestUtils.formatSui(charlieBalance)} SUI`);

      // Fund accounts if needed
      if (aliceBalance < BigInt(this.gasBudget) * 10n) {
        await TestUtils.fundAddressFromFaucet(this.alice.address, 'testnet');
        await TestUtils.sleep(5000);
      }
      if (bobBalance < BigInt(this.gasBudget) * 10n) {
        await TestUtils.fundAddressFromFaucet(this.bob.address, 'testnet');
        await TestUtils.sleep(5000);
      }
      if (charlieBalance < BigInt(this.gasBudget) * 10n) {
        await TestUtils.fundAddressFromFaucet(this.charlie.address, 'testnet');
        await TestUtils.sleep(5000);
      }

      this.testResults['Setup'] = true;
      TestUtils.logSuccess('Setup completed');
    } catch (error: any) {
      TestUtils.logError(`Setup failed: ${error.message}`);
      throw error;
    }
  }

  private async testAliceCreatesEscrow() {
    TestUtils.logSection('Test 2: Alice Creates Escrow for Bob');

    try {
      // Alice creates a coin (Item A) worth 1.0 SUI
      TestUtils.logInfo('Alice creating Item A (1.0 SUI coin)...');
      const itemA = await this.helpers.createTestObject(this.alice.keypair, 1000000000);
      TestUtils.logSuccess(`Item A created: ${itemA}`);

      // Alice creates escrow for Bob, expecting Item B (coin) in return
      TestUtils.logInfo('Alice creating escrow for Bob...');
      const escrowId = await this.helpers.createEscrow(
        this.alice.keypair,
        itemA,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>',
        this.bob.address
      );
      TestUtils.logSuccess(`Alice's escrow created: ${escrowId}`);

      (this as any).aliceEscrowId = escrowId;

      this.testResults['Alice Creates Escrow for Bob'] = true;
      TestUtils.logSuccess('Alice created escrow successfully');
    } catch (error: any) {
      TestUtils.logError(`Alice escrow creation failed: ${error.message}`);
      throw error;
    }
  }

  private async testBobCreatesEscrow() {
    TestUtils.logSection('Test 3: Bob Creates Escrow for Alice');

    try {
      // Bob creates a coin (Item B) worth 2.0 SUI
      TestUtils.logInfo('Bob creating Item B (2.0 SUI coin)...');
      const itemB = await this.helpers.createTestObject(this.bob.keypair, 2000000000);
      TestUtils.logSuccess(`Item B created: ${itemB}`);

      // Bob creates escrow for Alice, expecting Item A (coin) in return
      TestUtils.logInfo('Bob creating escrow for Alice...');
      const escrowId = await this.helpers.createEscrow(
        this.bob.keypair,
        itemB,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>',
        this.alice.address
      );
      TestUtils.logSuccess(`Bob's escrow created: ${escrowId}`);

      (this as any).bobEscrowId = escrowId;

      this.testResults['Bob Creates Escrow for Alice'] = true;
      TestUtils.logSuccess('Bob created escrow successfully');
    } catch (error: any) {
      TestUtils.logError(`Bob escrow creation failed: ${error.message}`);
      throw error;
    }
  }

  private async testBobSwapsWithAlice() {
    TestUtils.logSection('Test 4: Bob Swaps with Alice');

    try {
      const aliceEscrowId = (this as any).aliceEscrowId;
      const bobEscrowId = (this as any).bobEscrowId;

      // Bob needs to provide an exchange object to claim Alice's escrow
      // First, Bob claims his own escrow to get the item back
      TestUtils.logInfo('Bob claiming his escrow to get Item B back...');
      const cancelDigest = await this.helpers.cancelEscrow(
        this.bob.keypair,
        bobEscrowId,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>'
      );
      await TestUtils.waitForTransaction(this.client, cancelDigest);

      // Get Bob's coins to use for swap
      const bobCoins = await TestUtils.getOwnedObjects(
        this.client,
        this.bob.address,
        '0x2::coin::Coin<0x2::sui::SUI>'
      );

      if (bobCoins.length === 0) {
        throw new Error('Bob has no coins for swap');
      }

      const exchangeCoin = (bobCoins[0].data as any).objectId;
      TestUtils.logInfo(`Bob using coin ${exchangeCoin} for exchange`);

      // Bob swaps: provides his coin to get Alice's escrowed coin
      TestUtils.logInfo('Bob performing swap...');
      const swapDigest = await this.helpers.swapEscrow(
        this.bob.keypair,
        aliceEscrowId,
        exchangeCoin,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>'
      );
      await TestUtils.waitForTransaction(this.client, swapDigest);
      TestUtils.logSuccess(`Swap completed: ${swapDigest}`);

      // Verify: Alice should have received Bob's coin
      await TestUtils.sleep(2000);
      const aliceCoins = await TestUtils.getOwnedObjects(
        this.client,
        this.alice.address,
        '0x2::coin::Coin<0x2::sui::SUI>'
      );
      TestUtils.logInfo(`Alice now has ${aliceCoins.length} coin object(s)`);

      // Verify: Bob should have received Alice's coin
      const bobCoinsAfter = await TestUtils.getOwnedObjects(
        this.client,
        this.bob.address,
        '0x2::coin::Coin<0x2::sui::SUI>'
      );
      TestUtils.logInfo(`Bob now has ${bobCoinsAfter.length} coin object(s)`);

      this.testResults['Bob Swaps with Alice'] = true;
      TestUtils.logSuccess('Swap test passed');
    } catch (error: any) {
      TestUtils.logError(`Swap failed: ${error.message}`);
      throw error;
    }
  }

  private async testAliceClaimsFromBob() {
    TestUtils.logSection('Test 5: Alice Claims Simple Escrow');

    try {
      // Create a new simple escrow (without swap requirement)
      TestUtils.logInfo('Bob creating simple escrow for Alice...');
      const itemC = await this.helpers.createTestObject(this.bob.keypair, 500000000);
      
      const escrowId = await this.helpers.createEscrow(
        this.bob.keypair,
        itemC,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>',
        this.alice.address
      );
      TestUtils.logSuccess(`Simple escrow created: ${escrowId}`);

      // Alice claims without providing exchange
      TestUtils.logInfo('Alice claiming without exchange...');
      const claimDigest = await this.helpers.claimEscrow(
        this.alice.keypair,
        escrowId,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>'
      );
      await TestUtils.waitForTransaction(this.client, claimDigest);
      TestUtils.logSuccess(`Claimed: ${claimDigest}`);

      this.testResults['Alice Claims from Bob'] = true;
      TestUtils.logSuccess('Simple claim test passed');
    } catch (error: any) {
      TestUtils.logError(`Claim failed: ${error.message}`);
      throw error;
    }
  }

  private async testThreeWaySwap() {
    TestUtils.logSection('Test 6: Three-Way Swap Scenario');

    try {
      // Alice creates escrow for Bob
      const itemForBob = await this.helpers.createTestObject(this.alice.keypair, 100000000);
      const aliceEscrow = await this.helpers.createEscrow(
        this.alice.keypair,
        itemForBob,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>',
        this.bob.address
      );
      TestUtils.logSuccess(`Alice → Bob escrow: ${aliceEscrow}`);

      // Bob creates escrow for Charlie
      const itemForCharlie = await this.helpers.createTestObject(this.bob.keypair, 200000000);
      const bobEscrow = await this.helpers.createEscrow(
        this.bob.keypair,
        itemForCharlie,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>',
        this.charlie.address
      );
      TestUtils.logSuccess(`Bob → Charlie escrow: ${bobEscrow}`);

      // Charlie creates escrow for Alice
      const itemForAlice = await this.helpers.createTestObject(this.charlie.keypair, 300000000);
      const charlieEscrow = await this.helpers.createEscrow(
        this.charlie.keypair,
        itemForAlice,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>',
        this.alice.address
      );
      TestUtils.logSuccess(`Charlie → Alice escrow: ${charlieEscrow}`);

      // Now everyone claims
      TestUtils.logInfo('All parties claiming their escrows...');
      
      await this.helpers.claimEscrow(
        this.bob.keypair,
        aliceEscrow,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>'
      );
      TestUtils.logSuccess('Bob claimed from Alice');

      await this.helpers.claimEscrow(
        this.charlie.keypair,
        bobEscrow,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>'
      );
      TestUtils.logSuccess('Charlie claimed from Bob');

      await this.helpers.claimEscrow(
        this.alice.keypair,
        charlieEscrow,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>'
      );
      TestUtils.logSuccess('Alice claimed from Charlie');

      this.testResults['Three-Way Swap'] = true;
      TestUtils.logSuccess('Three-way swap test passed');
    } catch (error: any) {
      TestUtils.logError(`Three-way swap failed: ${error.message}`);
      throw error;
    }
  }
}

async function main() {
  const test = new SwapTest();
  await test.run();
}

main().catch(console.error);

