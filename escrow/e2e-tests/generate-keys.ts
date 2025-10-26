#!/usr/bin/env ts-node

/**
 * Generate Sui Keypairs for E2E Testing
 * 
 * This script generates new Ed25519 keypairs for testing purposes
 * and displays them in the format needed for the .env file.
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { encodeSuiPrivateKey } from '@mysten/sui/cryptography';
import * as fs from 'fs';

interface KeyInfo {
  name: string;
  address: string;
  privateKey: string;
}

function generateKeypair(name: string): KeyInfo {
  const keypair = Ed25519Keypair.generate();
  const address = keypair.getPublicKey().toSuiAddress();
  const privateKey = encodeSuiPrivateKey(
    keypair.export().privateKey,
    keypair.getKeyScheme()
  );

  return {
    name,
    address,
    privateKey,
  };
}

function main() {
  console.log('🔑 Generating Test Keypairs for Escrow E2E Tests\n');
  console.log('=' .repeat(80));
  console.log('');

  // Generate keypairs for test users
  const keys = [
    generateKeypair('Alice'),
    generateKeypair('Bob'),
    generateKeypair('Charlie'),
  ];

  // Display keys
  keys.forEach((key, index) => {
    console.log(`${index + 1}. ${key.name}`);
    console.log(`   Address:     ${key.address}`);
    console.log(`   Private Key: ${key.privateKey}`);
    console.log('');
  });

  console.log('=' .repeat(80));
  console.log('');

  // Generate .env content
  console.log('📝 Copy these to your .env file:\n');
  console.log('# Wallet Private Keys');
  console.log(`ALICE_PRIVATE_KEY=${keys[0].privateKey}`);
  console.log(`BOB_PRIVATE_KEY=${keys[1].privateKey}`);
  console.log(`CHARLIE_PRIVATE_KEY=${keys[2].privateKey}`);
  console.log('');

  console.log('💰 Fund these addresses with test tokens:');
  console.log('   https://discord.com/channels/916379725201563759/971488439931392130');
  console.log('');
  keys.forEach((key) => {
    console.log(`   curl --location --request POST 'https://faucet.testnet.sui.io/gas' \\`);
    console.log(`     --header 'Content-Type: application/json' \\`);
    console.log(`     --data-raw '{"FixedAmountRequest": {"recipient": "${key.address}"}}'`);
    console.log('');
  });

  // Optionally save to a file
  const envContent = `# Generated Test Keys - $(date)
ALICE_PRIVATE_KEY=${keys[0].privateKey}
BOB_PRIVATE_KEY=${keys[1].privateKey}
CHARLIE_PRIVATE_KEY=${keys[2].privateKey}

# Addresses (for reference)
# Alice:   ${keys[0].address}
# Bob:     ${keys[1].address}
# Charlie: ${keys[2].address}
`;

  fs.writeFileSync('.env.generated', envContent);
  console.log('✅ Keys saved to .env.generated');
  console.log('   Copy relevant lines to your .env file');
  console.log('');
  
  console.log('⚠️  WARNING: Keep these private keys secure!');
  console.log('   Never commit them to version control.');
}

main();

