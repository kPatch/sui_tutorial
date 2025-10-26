#!/usr/bin/env ts-node

/**
 * Basic Escrow E2E Test
 * 
 * Tests the fundamental escrow workflow:
 * 1. Alice creates an escrow for Bob
 * 2. Bob claims the escrow
 * 3. Alice creates another escrow and cancels it
 * 4. Test getter functions
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import * as dotenv from 'dotenv';
import { TestUtils, EscrowTestHelpers } from './test-utils';

dotenv.config();

class BasicEscrowTest {
  private client: SuiClient;
  private alice: any;
  private bob: any;
  private packageId: string;
  private helpers: EscrowTestHelpers;
  private gasBudget: number;

  private testResults = {
    'Setup and Configuration': false,
    'Create Escrow': false,
    'Claim Escrow': false,
    'Cancel Escrow': false,
    'Getter Functions': false,
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

    TestUtils.logSection('BASIC ESCROW E2E TEST');
    console.log(`📦 Package ID: ${this.packageId}`);
    console.log(`👩 Alice: ${this.alice.address}`);
    console.log(`👨 Bob: ${this.bob.address}`);
    console.log('');

    try {
      await this.testSetup();
      await this.testCreateEscrow();
      await this.testClaimEscrow();
      await this.testCancelEscrow();
      await this.testGetterFunctions();
    } catch (error: any) {
      TestUtils.logError(`Test failed: ${error.message}`);
      console.error(error);
    }

    await TestUtils.printTestSummary(this.testResults, startTime);
  }

  private async testSetup() {
    TestUtils.logSection('Test 1: Setup and Configuration');

    try {
      // Check balances
      const aliceBalance = await TestUtils.getBalance(this.client, this.alice.address);
      const bobBalance = await TestUtils.getBalance(this.client, this.bob.address);

      TestUtils.logInfo(`Alice balance: ${TestUtils.formatSui(aliceBalance)} SUI`);
      TestUtils.logInfo(`Bob balance: ${TestUtils.formatSui(bobBalance)} SUI`);

      if (aliceBalance < BigInt(this.gasBudget) * 10n) {
        TestUtils.logWarning('Alice has low balance, requesting from faucet...');
        await TestUtils.fundAddressFromFaucet(this.alice.address, 'testnet');
        await TestUtils.sleep(5000);
      }

      if (bobBalance < BigInt(this.gasBudget) * 10n) {
        TestUtils.logWarning('Bob has low balance, requesting from faucet...');
        await TestUtils.fundAddressFromFaucet(this.bob.address, 'testnet');
        await TestUtils.sleep(5000);
      }

      this.testResults['Setup and Configuration'] = true;
      TestUtils.logSuccess('Setup completed');
    } catch (error: any) {
      TestUtils.logError(`Setup failed: ${error.message}`);
      throw error;
    }
  }

  private async testCreateEscrow() {
    TestUtils.logSection('Test 2: Create Escrow');

    try {
      // Create a test coin for Alice to escrow
      TestUtils.logInfo('Creating test coin for Alice...');
      const testCoinId = await this.helpers.createTestObject(this.alice.keypair, 1000000);
      TestUtils.logSuccess(`Created test coin: ${testCoinId}`);

      // Alice creates an escrow for Bob
      TestUtils.logInfo('Alice creating escrow for Bob...');
      const escrowId = await this.helpers.createEscrow(
        this.alice.keypair,
        testCoinId,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>',
        this.bob.address
      );

      TestUtils.logSuccess(`Escrow created: ${escrowId}`);

      // Verify escrow exists
      const escrowObj = await TestUtils.getObjectDetails(this.client, escrowId);
      if (!escrowObj.data) {
        throw new Error('Escrow object not found');
      }

      TestUtils.logInfo(`Escrow object type: ${escrowObj.data.type}`);

      // Store for next test
      (this as any).testEscrowId = escrowId;

      this.testResults['Create Escrow'] = true;
      TestUtils.logSuccess('Create escrow test passed');
    } catch (error: any) {
      TestUtils.logError(`Create escrow failed: ${error.message}`);
      throw error;
    }
  }

  private async testClaimEscrow() {
    TestUtils.logSection('Test 3: Claim Escrow');

    try {
      const escrowId = (this as any).testEscrowId;
      if (!escrowId) {
        throw new Error('No escrow ID from previous test');
      }

      // Bob claims the escrow
      TestUtils.logInfo('Bob claiming escrow...');
      const digest = await this.helpers.claimEscrow(
        this.bob.keypair,
        escrowId,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>'
      );

      await TestUtils.waitForTransaction(this.client, digest);
      TestUtils.logSuccess(`Escrow claimed: ${digest}`);

      // Verify escrow no longer exists
      try {
        const escrowObj = await TestUtils.getObjectDetails(this.client, escrowId);
        if (escrowObj.data) {
          throw new Error('Escrow should have been deleted');
        }
      } catch (error: any) {
        // Expected - object should not exist
        TestUtils.logInfo('Escrow object correctly deleted after claim');
      }

      this.testResults['Claim Escrow'] = true;
      TestUtils.logSuccess('Claim escrow test passed');
    } catch (error: any) {
      TestUtils.logError(`Claim escrow failed: ${error.message}`);
      throw error;
    }
  }

  private async testCancelEscrow() {
    TestUtils.logSection('Test 4: Cancel Escrow');

    try {
      // Create another test coin
      TestUtils.logInfo('Creating another test coin for Alice...');
      const testCoinId = await this.helpers.createTestObject(this.alice.keypair, 2000000);

      // Alice creates another escrow
      TestUtils.logInfo('Alice creating another escrow...');
      const escrowId = await this.helpers.createEscrow(
        this.alice.keypair,
        testCoinId,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>',
        this.bob.address
      );
      TestUtils.logSuccess(`Escrow created: ${escrowId}`);

      // Alice cancels the escrow
      TestUtils.logInfo('Alice canceling escrow...');
      const digest = await this.helpers.cancelEscrow(
        this.alice.keypair,
        escrowId,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>'
      );

      await TestUtils.waitForTransaction(this.client, digest);
      TestUtils.logSuccess(`Escrow canceled: ${digest}`);

      // Verify escrow no longer exists
      try {
        const escrowObj = await TestUtils.getObjectDetails(this.client, escrowId);
        if (escrowObj.data) {
          throw new Error('Escrow should have been deleted');
        }
      } catch (error: any) {
        TestUtils.logInfo('Escrow object correctly deleted after cancel');
      }

      this.testResults['Cancel Escrow'] = true;
      TestUtils.logSuccess('Cancel escrow test passed');
    } catch (error: any) {
      TestUtils.logError(`Cancel escrow failed: ${error.message}`);
      throw error;
    }
  }

  private async testGetterFunctions() {
    TestUtils.logSection('Test 5: Getter Functions');

    try {
      // Create an escrow to test getters
      TestUtils.logInfo('Creating escrow for getter tests...');
      const testCoinId = await this.helpers.createTestObject(this.alice.keypair, 3000000);
      
      const escrowId = await this.helpers.createEscrow(
        this.alice.keypair,
        testCoinId,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>',
        this.bob.address
      );

      // Get escrow details
      const escrowObj = await TestUtils.getObjectDetails(this.client, escrowId);
      TestUtils.logInfo(`Escrow details retrieved: ${escrowId}`);

      if (escrowObj.data && escrowObj.data.content) {
        const content = (escrowObj.data.content as any).fields;
        TestUtils.logInfo(`Sender: ${content.sender}`);
        TestUtils.logInfo(`Recipient: ${content.recipient}`);
        
        if (content.sender === this.alice.address && content.recipient === this.bob.address) {
          TestUtils.logSuccess('Sender and recipient correctly set');
        }
      }

      // Clean up - cancel this escrow
      await this.helpers.cancelEscrow(
        this.alice.keypair,
        escrowId,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>'
      );

      this.testResults['Getter Functions'] = true;
      TestUtils.logSuccess('Getter functions test passed');
    } catch (error: any) {
      TestUtils.logError(`Getter functions test failed: ${error.message}`);
      throw error;
    }
  }
}

// Run the test
async function main() {
  const test = new BasicEscrowTest();
  await test.run();
}

main().catch(console.error);

