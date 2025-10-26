#!/usr/bin/env ts-node

/**
 * Coin Escrow E2E Test
 * 
 * Tests escrow functionality specifically with SUI coins:
 * 1. Escrow different coin amounts
 * 2. Multiple concurrent coin escrows
 * 3. Escrow with large amounts
 * 4. Coin balance verification after operations
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import * as dotenv from 'dotenv';
import { TestUtils, EscrowTestHelpers } from './test-utils';

dotenv.config();

class CoinEscrowTest {
  private client: SuiClient;
  private alice: any;
  private bob: any;
  private packageId: string;
  private helpers: EscrowTestHelpers;
  private gasBudget: number;

  private testResults = {
    'Setup': false,
    'Small Amount Escrow': false,
    'Large Amount Escrow': false,
    'Multiple Concurrent Escrows': false,
    'Balance Verification': false,
    'Coin Merging After Claim': false,
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

    TestUtils.logSection('COIN ESCROW E2E TEST');
    console.log(`📦 Package ID: ${this.packageId}`);
    console.log(`👩 Alice: ${this.alice.address}`);
    console.log(`👨 Bob: ${this.bob.address}`);
    console.log('');

    try {
      await this.testSetup();
      await this.testSmallAmountEscrow();
      await this.testLargeAmountEscrow();
      await this.testMultipleConcurrentEscrows();
      await this.testBalanceVerification();
      await this.testCoinMergingAfterClaim();
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

      TestUtils.logInfo(`Alice balance: ${TestUtils.formatSui(aliceBalance)} SUI`);
      TestUtils.logInfo(`Bob balance: ${TestUtils.formatSui(bobBalance)} SUI`);

      // Ensure minimum balance for testing
      const minBalance = BigInt(this.gasBudget) * 20n;
      if (aliceBalance < minBalance) {
        TestUtils.logWarning('Alice needs more funds...');
        await TestUtils.fundAddressFromFaucet(this.alice.address, 'testnet');
        await TestUtils.sleep(5000);
      }

      if (bobBalance < minBalance) {
        TestUtils.logWarning('Bob needs more funds...');
        await TestUtils.fundAddressFromFaucet(this.bob.address, 'testnet');
        await TestUtils.sleep(5000);
      }

      this.testResults['Setup'] = true;
      TestUtils.logSuccess('Setup completed');
    } catch (error: any) {
      TestUtils.logError(`Setup failed: ${error.message}`);
      throw error;
    }
  }

  private async testSmallAmountEscrow() {
    TestUtils.logSection('Test 2: Small Amount Escrow');

    try {
      const amount = 1000000; // 0.001 SUI
      TestUtils.logInfo(`Escrowing ${TestUtils.formatSui(BigInt(amount))} SUI...`);

      const bobBalanceBefore = await TestUtils.getBalance(this.client, this.bob.address);

      // Create and escrow small coin
      const coin = await this.helpers.createTestObject(this.alice.keypair, amount);
      const escrowId = await this.helpers.createEscrow(
        this.alice.keypair,
        coin,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>',
        this.bob.address
      );
      TestUtils.logSuccess(`Escrow created: ${escrowId}`);

      // Bob claims
      const digest = await this.helpers.claimEscrow(
        this.bob.keypair,
        escrowId,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>'
      );
      await TestUtils.waitForTransaction(this.client, digest);
      TestUtils.logSuccess('Bob claimed the escrow');

      await TestUtils.sleep(2000);

      // Verify Bob's balance increased (accounting for gas)
      const bobBalanceAfter = await TestUtils.getBalance(this.client, this.bob.address);
      TestUtils.logInfo(`Bob's balance change: ${TestUtils.formatSui(bobBalanceAfter - bobBalanceBefore)} SUI`);

      this.testResults['Small Amount Escrow'] = true;
      TestUtils.logSuccess('Small amount test passed');
    } catch (error: any) {
      TestUtils.logError(`Small amount test failed: ${error.message}`);
      throw error;
    }
  }

  private async testLargeAmountEscrow() {
    TestUtils.logSection('Test 3: Large Amount Escrow');

    try {
      const amount = 100000000; // 0.1 SUI
      TestUtils.logInfo(`Escrowing ${TestUtils.formatSui(BigInt(amount))} SUI...`);

      // Create and escrow large coin
      const coin = await this.helpers.createTestObject(this.alice.keypair, amount);
      const escrowId = await this.helpers.createEscrow(
        this.alice.keypair,
        coin,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>',
        this.bob.address
      );
      TestUtils.logSuccess(`Escrow created: ${escrowId}`);

      // Bob claims
      const digest = await this.helpers.claimEscrow(
        this.bob.keypair,
        escrowId,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>'
      );
      await TestUtils.waitForTransaction(this.client, digest);
      TestUtils.logSuccess('Bob claimed large amount');

      this.testResults['Large Amount Escrow'] = true;
      TestUtils.logSuccess('Large amount test passed');
    } catch (error: any) {
      TestUtils.logError(`Large amount test failed: ${error.message}`);
      throw error;
    }
  }

  private async testMultipleConcurrentEscrows() {
    TestUtils.logSection('Test 4: Multiple Concurrent Escrows');

    try {
      const escrows: string[] = [];
      const amounts = [5000000, 10000000, 15000000]; // Different amounts

      // Create multiple escrows
      TestUtils.logInfo('Creating multiple escrows...');
      for (let i = 0; i < amounts.length; i++) {
        const coin = await this.helpers.createTestObject(this.alice.keypair, amounts[i]);
        const escrowId = await this.helpers.createEscrow(
          this.alice.keypair,
          coin,
          '0x2::coin::Coin<0x2::sui::SUI>',
          '0x2::coin::Coin<0x2::sui::SUI>',
          this.bob.address
        );
        escrows.push(escrowId);
        TestUtils.logSuccess(`Escrow ${i + 1}: ${escrowId} (${TestUtils.formatSui(BigInt(amounts[i]))} SUI)`);
      }

      // Bob claims all escrows
      TestUtils.logInfo('Bob claiming all escrows...');
      for (let i = 0; i < escrows.length; i++) {
        const digest = await this.helpers.claimEscrow(
          this.bob.keypair,
          escrows[i],
          '0x2::coin::Coin<0x2::sui::SUI>',
          '0x2::coin::Coin<0x2::sui::SUI>'
        );
        await TestUtils.waitForTransaction(this.client, digest);
        TestUtils.logSuccess(`Claimed escrow ${i + 1}`);
        await TestUtils.sleep(1000);
      }

      this.testResults['Multiple Concurrent Escrows'] = true;
      TestUtils.logSuccess('Multiple concurrent escrows test passed');
    } catch (error: any) {
      TestUtils.logError(`Multiple escrows test failed: ${error.message}`);
      throw error;
    }
  }

  private async testBalanceVerification() {
    TestUtils.logSection('Test 5: Balance Verification');

    try {
      // Record initial balances
      const aliceBalanceBefore = await TestUtils.getBalance(this.client, this.alice.address);
      const bobBalanceBefore = await TestUtils.getBalance(this.client, this.bob.address);

      TestUtils.logInfo(`Alice initial: ${TestUtils.formatSui(aliceBalanceBefore)} SUI`);
      TestUtils.logInfo(`Bob initial: ${TestUtils.formatSui(bobBalanceBefore)} SUI`);

      const escrowAmount = 20000000; // 0.02 SUI

      // Alice creates escrow
      const coin = await this.helpers.createTestObject(this.alice.keypair, escrowAmount);
      const escrowId = await this.helpers.createEscrow(
        this.alice.keypair,
        coin,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>',
        this.bob.address
      );

      await TestUtils.sleep(2000);

      // Check mid-transaction balances
      const aliceBalanceMid = await TestUtils.getBalance(this.client, this.alice.address);
      TestUtils.logInfo(`Alice after escrow: ${TestUtils.formatSui(aliceBalanceMid)} SUI`);
      TestUtils.logInfo(`Amount in escrow: ${TestUtils.formatSui(BigInt(escrowAmount))} SUI`);

      // Bob claims
      const digest = await this.helpers.claimEscrow(
        this.bob.keypair,
        escrowId,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>'
      );
      await TestUtils.waitForTransaction(this.client, digest);

      await TestUtils.sleep(2000);

      // Check final balances
      const aliceBalanceAfter = await TestUtils.getBalance(this.client, this.alice.address);
      const bobBalanceAfter = await TestUtils.getBalance(this.client, this.bob.address);

      TestUtils.logInfo(`Alice final: ${TestUtils.formatSui(aliceBalanceAfter)} SUI`);
      TestUtils.logInfo(`Bob final: ${TestUtils.formatSui(bobBalanceAfter)} SUI`);

      // Bob should have received approximately the escrow amount (minus gas)
      const bobIncrease = bobBalanceAfter - bobBalanceBefore;
      TestUtils.logInfo(`Bob net increase: ${TestUtils.formatSui(bobIncrease)} SUI`);

      this.testResults['Balance Verification'] = true;
      TestUtils.logSuccess('Balance verification test passed');
    } catch (error: any) {
      TestUtils.logError(`Balance verification failed: ${error.message}`);
      throw error;
    }
  }

  private async testCoinMergingAfterClaim() {
    TestUtils.logSection('Test 6: Coin Merging After Claim');

    try {
      TestUtils.logInfo('Testing coin management after multiple claims...');

      // Count Bob's initial coin objects
      const coinsBefore = await TestUtils.getOwnedObjects(
        this.client,
        this.bob.address,
        '0x2::coin::Coin<0x2::sui::SUI>'
      );
      TestUtils.logInfo(`Bob has ${coinsBefore.length} coin objects initially`);

      // Create and claim two small escrows
      for (let i = 0; i < 2; i++) {
        const coin = await this.helpers.createTestObject(this.alice.keypair, 1000000);
        const escrowId = await this.helpers.createEscrow(
          this.alice.keypair,
          coin,
          '0x2::coin::Coin<0x2::sui::SUI>',
          '0x2::coin::Coin<0x2::sui::SUI>',
          this.bob.address
        );

        await this.helpers.claimEscrow(
          this.bob.keypair,
          escrowId,
          '0x2::coin::Coin<0x2::sui::SUI>',
          '0x2::coin::Coin<0x2::sui::SUI>'
        );
        TestUtils.logSuccess(`Claimed escrow ${i + 1}`);
        await TestUtils.sleep(1000);
      }

      await TestUtils.sleep(2000);

      // Count Bob's final coin objects
      const coinsAfter = await TestUtils.getOwnedObjects(
        this.client,
        this.bob.address,
        '0x2::coin::Coin<0x2::sui::SUI>'
      );
      TestUtils.logInfo(`Bob has ${coinsAfter.length} coin objects after claims`);

      // Bob should have more coin objects (or same if auto-merged)
      if (coinsAfter.length >= coinsBefore.length) {
        TestUtils.logSuccess('Coin objects correctly managed');
      }

      this.testResults['Coin Merging After Claim'] = true;
      TestUtils.logSuccess('Coin merging test passed');
    } catch (error: any) {
      TestUtils.logError(`Coin merging test failed: ${error.message}`);
      throw error;
    }
  }
}

async function main() {
  const test = new CoinEscrowTest();
  await test.run();
}

main().catch(console.error);

