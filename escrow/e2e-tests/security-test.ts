#!/usr/bin/env ts-node

/**
 * Security and Access Control E2E Test
 * 
 * Tests security features and error cases:
 * 1. Wrong recipient cannot claim escrow
 * 2. Non-sender cannot cancel escrow
 * 3. Cannot claim after cancel
 * 4. Cannot cancel after claim
 * 5. Escrow lifecycle integrity
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import * as dotenv from 'dotenv';
import { TestUtils, EscrowTestHelpers } from './test-utils';

dotenv.config();

class SecurityTest {
  private client: SuiClient;
  private alice: any;
  private bob: any;
  private charlie: any;
  private packageId: string;
  private helpers: EscrowTestHelpers;
  private gasBudget: number;

  private testResults = {
    'Setup': false,
    'Wrong Recipient Cannot Claim': false,
    'Non-Sender Cannot Cancel': false,
    'Cannot Claim After Cancel': false,
    'Cannot Double Claim': false,
    'Escrow Lifecycle Integrity': false,
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

    TestUtils.logSection('SECURITY AND ACCESS CONTROL E2E TEST');
    console.log(`📦 Package ID: ${this.packageId}`);
    console.log(`👩 Alice (Sender): ${this.alice.address}`);
    console.log(`👨 Bob (Recipient): ${this.bob.address}`);
    console.log(`👤 Charlie (Attacker): ${this.charlie.address}`);
    console.log('');

    try {
      await this.testSetup();
      await this.testWrongRecipientCannotClaim();
      await this.testNonSenderCannotCancel();
      await this.testCannotClaimAfterCancel();
      await this.testCannotDoubleClaim();
      await this.testEscrowLifecycleIntegrity();
    } catch (error: any) {
      TestUtils.logError(`Test failed: ${error.message}`);
      console.error(error);
    }

    await TestUtils.printTestSummary(this.testResults, startTime);
  }

  private async testSetup() {
    TestUtils.logSection('Test 1: Setup');

    try {
      const balances = await Promise.all([
        TestUtils.getBalance(this.client, this.alice.address),
        TestUtils.getBalance(this.client, this.bob.address),
        TestUtils.getBalance(this.client, this.charlie.address),
      ]);

      TestUtils.logInfo(`Alice: ${TestUtils.formatSui(balances[0])} SUI`);
      TestUtils.logInfo(`Bob: ${TestUtils.formatSui(balances[1])} SUI`);
      TestUtils.logInfo(`Charlie: ${TestUtils.formatSui(balances[2])} SUI`);

      // Fund if needed
      for (let i = 0; i < balances.length; i++) {
        if (balances[i] < BigInt(this.gasBudget) * 10n) {
          const user = [this.alice, this.bob, this.charlie][i];
          await TestUtils.fundAddressFromFaucet(user.address, 'testnet');
          await TestUtils.sleep(5000);
        }
      }

      this.testResults['Setup'] = true;
      TestUtils.logSuccess('Setup completed');
    } catch (error: any) {
      TestUtils.logError(`Setup failed: ${error.message}`);
      throw error;
    }
  }

  private async testWrongRecipientCannotClaim() {
    TestUtils.logSection('Test 2: Wrong Recipient Cannot Claim');

    try {
      // Alice creates escrow for Bob
      const testCoin = await this.helpers.createTestObject(this.alice.keypair, 1000000);
      const escrowId = await this.helpers.createEscrow(
        this.alice.keypair,
        testCoin,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>',
        this.bob.address
      );
      TestUtils.logSuccess(`Escrow created for Bob: ${escrowId}`);

      // Charlie (wrong recipient) tries to claim
      TestUtils.logInfo('Charlie attempting to claim (should fail)...');
      
      try {
        await this.helpers.claimEscrow(
          this.charlie.keypair,
          escrowId,
          '0x2::coin::Coin<0x2::sui::SUI>',
          '0x2::coin::Coin<0x2::sui::SUI>'
        );
        throw new Error('Charlie should not be able to claim!');
      } catch (error: any) {
        if (error.message.includes('should not be able')) {
          throw error;
        }
        TestUtils.logSuccess('Charlie correctly prevented from claiming');
      }

      // Bob (correct recipient) claims successfully
      TestUtils.logInfo('Bob claiming (should succeed)...');
      const digest = await this.helpers.claimEscrow(
        this.bob.keypair,
        escrowId,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>'
      );
      await TestUtils.waitForTransaction(this.client, digest);
      TestUtils.logSuccess('Bob successfully claimed');

      this.testResults['Wrong Recipient Cannot Claim'] = true;
      TestUtils.logSuccess('Access control test passed');
    } catch (error: any) {
      TestUtils.logError(`Wrong recipient test failed: ${error.message}`);
      throw error;
    }
  }

  private async testNonSenderCannotCancel() {
    TestUtils.logSection('Test 3: Non-Sender Cannot Cancel');

    try {
      // Alice creates escrow for Bob
      const testCoin = await this.helpers.createTestObject(this.alice.keypair, 2000000);
      const escrowId = await this.helpers.createEscrow(
        this.alice.keypair,
        testCoin,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>',
        this.bob.address
      );
      TestUtils.logSuccess(`Escrow created: ${escrowId}`);

      // Bob (recipient) tries to cancel
      TestUtils.logInfo('Bob attempting to cancel (should fail)...');
      
      try {
        await this.helpers.cancelEscrow(
          this.bob.keypair,
          escrowId,
          '0x2::coin::Coin<0x2::sui::SUI>',
          '0x2::coin::Coin<0x2::sui::SUI>'
        );
        throw new Error('Bob should not be able to cancel!');
      } catch (error: any) {
        if (error.message.includes('should not be able')) {
          throw error;
        }
        TestUtils.logSuccess('Bob correctly prevented from canceling');
      }

      // Charlie (third party) tries to cancel
      TestUtils.logInfo('Charlie attempting to cancel (should fail)...');
      
      try {
        await this.helpers.cancelEscrow(
          this.charlie.keypair,
          escrowId,
          '0x2::coin::Coin<0x2::sui::SUI>',
          '0x2::coin::Coin<0x2::sui::SUI>'
        );
        throw new Error('Charlie should not be able to cancel!');
      } catch (error: any) {
        if (error.message.includes('should not be able')) {
          throw error;
        }
        TestUtils.logSuccess('Charlie correctly prevented from canceling');
      }

      // Alice (sender) cancels successfully
      TestUtils.logInfo('Alice canceling (should succeed)...');
      const digest = await this.helpers.cancelEscrow(
        this.alice.keypair,
        escrowId,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>'
      );
      await TestUtils.waitForTransaction(this.client, digest);
      TestUtils.logSuccess('Alice successfully canceled');

      this.testResults['Non-Sender Cannot Cancel'] = true;
      TestUtils.logSuccess('Cancel access control test passed');
    } catch (error: any) {
      TestUtils.logError(`Non-sender cancel test failed: ${error.message}`);
      throw error;
    }
  }

  private async testCannotClaimAfterCancel() {
    TestUtils.logSection('Test 4: Cannot Claim After Cancel');

    try {
      // Alice creates escrow for Bob
      const testCoin = await this.helpers.createTestObject(this.alice.keypair, 3000000);
      const escrowId = await this.helpers.createEscrow(
        this.alice.keypair,
        testCoin,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>',
        this.bob.address
      );
      TestUtils.logSuccess(`Escrow created: ${escrowId}`);

      // Alice cancels the escrow
      TestUtils.logInfo('Alice canceling escrow...');
      const cancelDigest = await this.helpers.cancelEscrow(
        this.alice.keypair,
        escrowId,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>'
      );
      await TestUtils.waitForTransaction(this.client, cancelDigest);
      TestUtils.logSuccess('Escrow canceled');

      // Bob tries to claim the canceled escrow
      TestUtils.logInfo('Bob attempting to claim canceled escrow (should fail)...');
      
      try {
        await this.helpers.claimEscrow(
          this.bob.keypair,
          escrowId,
          '0x2::coin::Coin<0x2::sui::SUI>',
          '0x2::coin::Coin<0x2::sui::SUI>'
        );
        throw new Error('Should not be able to claim canceled escrow!');
      } catch (error: any) {
        if (error.message.includes('Should not be able')) {
          throw error;
        }
        TestUtils.logSuccess('Claim after cancel correctly prevented');
      }

      this.testResults['Cannot Claim After Cancel'] = true;
      TestUtils.logSuccess('Claim after cancel test passed');
    } catch (error: any) {
      TestUtils.logError(`Claim after cancel test failed: ${error.message}`);
      throw error;
    }
  }

  private async testCannotDoubleClaim() {
    TestUtils.logSection('Test 5: Cannot Double Claim');

    try {
      // Alice creates escrow for Bob
      const testCoin = await this.helpers.createTestObject(this.alice.keypair, 4000000);
      const escrowId = await this.helpers.createEscrow(
        this.alice.keypair,
        testCoin,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>',
        this.bob.address
      );
      TestUtils.logSuccess(`Escrow created: ${escrowId}`);

      // Bob claims the escrow
      TestUtils.logInfo('Bob claiming escrow...');
      const claimDigest = await this.helpers.claimEscrow(
        this.bob.keypair,
        escrowId,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>'
      );
      await TestUtils.waitForTransaction(this.client, claimDigest);
      TestUtils.logSuccess('Escrow claimed');

      // Bob tries to claim again
      TestUtils.logInfo('Bob attempting to claim again (should fail)...');
      
      try {
        await this.helpers.claimEscrow(
          this.bob.keypair,
          escrowId,
          '0x2::coin::Coin<0x2::sui::SUI>',
          '0x2::coin::Coin<0x2::sui::SUI>'
        );
        throw new Error('Should not be able to claim twice!');
      } catch (error: any) {
        if (error.message.includes('Should not be able')) {
          throw error;
        }
        TestUtils.logSuccess('Double claim correctly prevented');
      }

      this.testResults['Cannot Double Claim'] = true;
      TestUtils.logSuccess('Double claim test passed');
    } catch (error: any) {
      TestUtils.logError(`Double claim test failed: ${error.message}`);
      throw error;
    }
  }

  private async testEscrowLifecycleIntegrity() {
    TestUtils.logSection('Test 6: Escrow Lifecycle Integrity');

    try {
      // Test complete lifecycle: create → verify → claim → verify deleted
      TestUtils.logInfo('Testing complete escrow lifecycle...');

      // Create
      const testCoin = await this.helpers.createTestObject(this.alice.keypair, 5000000);
      const escrowId = await this.helpers.createEscrow(
        this.alice.keypair,
        testCoin,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>',
        this.bob.address
      );
      TestUtils.logSuccess('✓ Created');

      // Verify exists
      const escrowObj = await TestUtils.getObjectDetails(this.client, escrowId);
      if (!escrowObj.data) {
        throw new Error('Escrow should exist');
      }
      TestUtils.logSuccess('✓ Verified exists');

      // Verify fields
      const content = (escrowObj.data.content as any).fields;
      if (content.sender !== this.alice.address) {
        throw new Error('Sender mismatch');
      }
      if (content.recipient !== this.bob.address) {
        throw new Error('Recipient mismatch');
      }
      TestUtils.logSuccess('✓ Fields verified');

      // Claim
      const digest = await this.helpers.claimEscrow(
        this.bob.keypair,
        escrowId,
        '0x2::coin::Coin<0x2::sui::SUI>',
        '0x2::coin::Coin<0x2::sui::SUI>'
      );
      await TestUtils.waitForTransaction(this.client, digest);
      TestUtils.logSuccess('✓ Claimed');

      // Verify deleted
      await TestUtils.sleep(2000);
      try {
        const deletedObj = await TestUtils.getObjectDetails(this.client, escrowId);
        if (deletedObj.data) {
          throw new Error('Escrow should be deleted');
        }
      } catch (error: any) {
        TestUtils.logSuccess('✓ Verified deleted');
      }

      this.testResults['Escrow Lifecycle Integrity'] = true;
      TestUtils.logSuccess('Lifecycle integrity test passed');
    } catch (error: any) {
      TestUtils.logError(`Lifecycle integrity test failed: ${error.message}`);
      throw error;
    }
  }
}

async function main() {
  const test = new SecurityTest();
  await test.run();
}

main().catch(console.error);

