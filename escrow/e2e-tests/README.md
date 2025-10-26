# Escrow Contract E2E Tests

End-to-end tests for the Sui Move Escrow smart contract using the TypeScript SDK.

## Overview

These tests validate the complete escrow contract functionality on a live Sui network (testnet/devnet) using real transactions and the `@mysten/sui` TypeScript SDK.

## Test Suites

### 1. Basic Escrow Test (`basic-escrow-test.ts`)
Tests fundamental escrow operations:
- ✅ Create escrow
- ✅ Claim escrow (recipient)
- ✅ Cancel escrow (sender)
- ✅ Getter functions (sender, recipient, escrowed)
- ✅ Object lifecycle verification

**Run:** `npm run test:basic`

### 2. Swap Test (`swap-test.ts`)
Tests atomic swap functionality:
- ✅ Two-party escrow creation
- ✅ Atomic swap with exchange object
- ✅ Simple claim without exchange
- ✅ Three-way swap scenario
- ✅ Multi-party coordination

**Run:** `npm run test:swap`

### 3. Security Test (`security-test.ts`)
Tests access control and security features:
- ✅ Wrong recipient cannot claim
- ✅ Non-sender cannot cancel
- ✅ Cannot claim after cancel
- ✅ Cannot double claim
- ✅ Escrow lifecycle integrity
- ✅ Field verification

**Run:** `npm run test:security`

### 4. Coin Escrow Test (`coin-escrow-test.ts`)
Tests SUI coin-specific functionality:
- ✅ Small amount escrows (0.001 SUI)
- ✅ Large amount escrows (0.1+ SUI)
- ✅ Multiple concurrent escrows
- ✅ Balance verification
- ✅ Coin object management

**Run:** `npm run test:coin`

## Prerequisites

### 1. Node.js
```bash
node --version  # v18.0.0 or higher
```

### 2. Sui CLI (Optional, for manual testing)
```bash
sui --version
```

### 3. Deployed Contract
Deploy the escrow contract to testnet first:
```bash
cd ..
./scripts/deploy.sh testnet
```

## Setup

### 1. Install Dependencies
```bash
cd e2e-tests
npm install
```

### 2. Generate Test Wallets
```bash
npm run generate-keys
```

This will generate three test wallets (Alice, Bob, Charlie) and display their private keys and addresses.

### 3. Fund Test Wallets
Request test tokens from the Sui faucet for each address:

```bash
# Method 1: Using curl (from generate-keys output)
curl --location --request POST 'https://faucet.testnet.sui.io/gas' \
  --header 'Content-Type: application/json' \
  --data-raw '{"FixedAmountRequest": {"recipient": "YOUR_ADDRESS"}}'

# Method 2: Discord faucet
# Visit: https://discord.com/channels/916379725201563759/971488439931392130
```

Or use the deployment script:
```bash
../scripts/request-tokens.sh testnet YOUR_ADDRESS
```

### 4. Configure Environment
Copy the example environment file:
```bash
cp env.example .env
```

Edit `.env` with your values:
```bash
# Network
SUI_NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443

# Private keys (from generate-keys)
ALICE_PRIVATE_KEY=suiprivkey1...
BOB_PRIVATE_KEY=suiprivkey1...
CHARLIE_PRIVATE_KEY=suiprivkey1...

# Package ID (from deployment)
PACKAGE_ID=0x2b8edb0c597ab49c215d4d9e3f71f227c2bc196c5b8a3a6c11a6dd6b239f8277

# Test configuration
GAS_BUDGET=50000000
```

## Running Tests

### Run Individual Tests
```bash
# Basic functionality
npm run test:basic

# Atomic swaps
npm run test:swap

# Security and access control
npm run test:security

# Coin-specific tests
npm run test:coin
```

### Run All Tests
```bash
npm run test:all
```

### Run with Direct Execution
```bash
# Using ts-node
npx ts-node basic-escrow-test.ts

# Or make executable and run
chmod +x basic-escrow-test.ts
./basic-escrow-test.ts
```

## Test Output

### Successful Test Run
```
====================================================================================
  BASIC ESCROW E2E TEST
====================================================================================

📦 Package ID: 0x2b8e...8277
👩 Alice: 0x999c...6fb8
👨 Bob: 0xabc1...def2

====================================================================================
  Test 1: Setup and Configuration
====================================================================================

ℹ️  Alice balance: 0.6080 SUI
ℹ️  Bob balance: 0.5240 SUI
✅ Setup completed

====================================================================================
  Test 2: Create Escrow
====================================================================================

ℹ️  Creating test coin for Alice...
✅ Created test coin: 0x1234...5678
ℹ️  Alice creating escrow for Bob...
✅ Escrow created: 0xabcd...ef01
✅ Create escrow test passed

...

====================================================================================
  TEST SUMMARY
====================================================================================

✅ Setup and Configuration
✅ Create Escrow
✅ Claim Escrow
✅ Cancel Escrow
✅ Getter Functions

Total: 5 | Passed: 5 | Failed: 0
Duration: 45.32s
```

### Failed Test Run
```
====================================================================================
  Test 2: Create Escrow
====================================================================================

❌ Create escrow failed: Insufficient balance
Total: 5 | Passed: 1 | Failed: 4
Duration: 12.18s
```

## Project Structure

```
e2e-tests/
├── package.json              # NPM dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── .gitignore               # Git ignore rules
├── env.example              # Environment template
├── README.md                # This file
├── generate-keys.ts         # Wallet generation utility
├── test-utils.ts            # Shared test utilities
├── basic-escrow-test.ts     # Basic functionality tests
├── swap-test.ts             # Atomic swap tests
├── security-test.ts         # Security and access control tests
└── coin-escrow-test.ts      # Coin-specific tests
```

## Key Concepts

### Test Users
- **Alice**: Primary sender, creates most escrows
- **Bob**: Primary recipient, claims most escrows
- **Charlie**: Third party, used for security tests and multi-party swaps

### Test Objects
Tests use SUI coins as the test objects. In production, you can escrow any type with `key + store` abilities.

### Gas Management
- Default gas budget: 50 MIST (0.05 SUI)
- Configurable via `GAS_BUDGET` in `.env`
- Tests automatically request faucet tokens if balances are low

### Transaction Waiting
Tests include proper transaction confirmation:
```typescript
await TestUtils.waitForTransaction(client, digest);
```

## Utilities (`test-utils.ts`)

### TestUtils
General-purpose test utilities:

```typescript
// Keypair creation
TestUtils.createKeypairFromEnv('ALICE_PRIVATE_KEY')

// Transaction waiting
await TestUtils.waitForTransaction(client, digest, timeoutMs)

// Balance checking
await TestUtils.getBalance(client, address)

// Owned objects
await TestUtils.getOwnedObjects(client, address, structType)

// Logging
TestUtils.logSuccess('Message')
TestUtils.logError('Error')
TestUtils.logInfo('Information')

// Test summary
await TestUtils.printTestSummary(results, startTime)
```

### EscrowTestHelpers
Escrow-specific helpers:

```typescript
const helpers = new EscrowTestHelpers(client, packageId, gasBudget);

// Create test object
const objId = await helpers.createTestObject(keypair, value);

// Create escrow
const escrowId = await helpers.createEscrow(
  sender,
  objectId,
  objectType,
  exchangeForType,
  recipientAddress
);

// Claim escrow
await helpers.claimEscrow(recipient, escrowId, objType, exchangeType);

// Cancel escrow
await helpers.cancelEscrow(sender, escrowId, objType, exchangeType);

// Swap with exchange
await helpers.swapEscrow(recipient, escrowId, exchangeObjId, objType, exchangeType);
```

## Troubleshooting

### "Private key not found"
```
❌ ALICE_PRIVATE_KEY not found in environment variables
💡 Run: npm run generate-keys
```

**Solution:** Generate keys or set them in `.env`

### "Insufficient balance"
```
❌ Create escrow failed: Insufficient balance
```

**Solution:** Fund the address using the faucet:
```bash
../scripts/request-tokens.sh testnet YOUR_ADDRESS
```

### "Package not found"
```
❌ Package ID not set in environment variables
```

**Solution:** Set `PACKAGE_ID` in `.env` from your deployment

### "Transaction timeout"
```
❌ Transaction timeout: 5sJ4V1V7...
```

**Solution:** 
- Network might be slow, increase `TEST_TIMEOUT_MS`
- Check RPC URL is correct
- Verify transaction on explorer

### "Wrong recipient cannot claim"
This is expected behavior! The security test verifies access control.

## Advanced Usage

### Custom Network
```bash
# Edit .env
SUI_NETWORK=devnet
SUI_RPC_URL=https://fullnode.devnet.sui.io:443
```

### Custom Types
To test with custom object types, modify the type arguments:
```typescript
await helpers.createEscrow(
  sender,
  objectId,
  '0xPACKAGE::module::CustomType',  // Your type
  '0xPACKAGE::module::ExchangeType', // Exchange type
  recipient
);
```

### Programmatic Usage
```typescript
import { EscrowTestHelpers } from './test-utils';

// Your test code
const helpers = new EscrowTestHelpers(client, packageId, gasBudget);
// Use helpers in your custom tests
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Dependencies
        working-directory: e2e-tests
        run: npm install
      
      - name: Run E2E Tests
        working-directory: e2e-tests
        env:
          ALICE_PRIVATE_KEY: ${{ secrets.ALICE_PRIVATE_KEY }}
          BOB_PRIVATE_KEY: ${{ secrets.BOB_PRIVATE_KEY }}
          CHARLIE_PRIVATE_KEY: ${{ secrets.CHARLIE_PRIVATE_KEY }}
          PACKAGE_ID: ${{ secrets.PACKAGE_ID }}
        run: npm run test:all
```

## Best Practices

1. **Always test on testnet first** before mainnet
2. **Keep private keys secure** - never commit to git
3. **Fund accounts with sufficient balance** for all tests
4. **Wait for transactions** to confirm before verification
5. **Clean up test objects** after tests when possible
6. **Use descriptive test names** and logging
7. **Handle failures gracefully** with try-catch
8. **Verify object states** before and after operations

## Test Coverage

Current test coverage:

| Feature | Tested | Test Suite |
|---------|--------|------------|
| Create Escrow | ✅ | basic, swap, coin, security |
| Claim Escrow | ✅ | basic, swap, coin |
| Cancel Escrow | ✅ | basic, security |
| Swap with Exchange | ✅ | swap |
| Wrong Recipient Block | ✅ | security |
| Non-Sender Block | ✅ | security |
| Double Claim Block | ✅ | security |
| Lifecycle Integrity | ✅ | security |
| Multiple Escrows | ✅ | coin |
| Balance Tracking | ✅ | coin |
| Three-Way Swap | ✅ | swap |

## Performance

Typical test execution times:
- Basic Test: ~30-45 seconds
- Swap Test: ~60-90 seconds
- Security Test: ~90-120 seconds
- Coin Test: ~45-60 seconds
- **Total (all tests): ~4-5 minutes**

Times may vary based on network congestion.

## Support

For issues or questions:
- Check [main README](../README.md)
- Review [deployment guide](../DEPLOYMENT.md)
- Consult [Sui documentation](https://docs.sui.io/)
- Ask in [Sui Discord](https://discord.gg/sui)

## Contributing

To add new tests:

1. Create a new test file: `my-test.ts`
2. Follow the existing test patterns
3. Use `TestUtils` and `EscrowTestHelpers`
4. Add npm script to `package.json`
5. Update this README
6. Ensure all tests pass

## License

Same as parent project (see main README).

---

**Last Updated:** 2024
**Test Framework:** @mysten/sui v1.38.0+
**Node Version:** v18.0.0+

