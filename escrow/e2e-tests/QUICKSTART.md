# E2E Tests Quick Start

Get your escrow contract E2E tests running in 5 minutes!

## Prerequisites

- Node.js v18+ installed
- Escrow contract deployed to testnet
- Terminal access

## Step-by-Step Setup

### 1. Install Dependencies (1 minute)

```bash
cd e2e-tests
npm install
```

### 2. Generate Test Wallets (1 minute)

```bash
npm run generate-keys
```

**Output:**
```
🔑 Generating Test Keypairs for Escrow E2E Tests

1. Alice
   Address:     0x1234...
   Private Key: suiprivkey1...

2. Bob
   Address:     0x5678...
   Private Key: suiprivkey1...

3. Charlie
   Address:     0x9abc...
   Private Key: suiprivkey1...
```

Copy these for the next step.

### 3. Fund Test Wallets (2 minutes)

**Option A: Using script**
```bash
../scripts/request-tokens.sh testnet 0xYOUR_ADDRESS_HERE
```

**Option B: Using curl**
```bash
curl --location --request POST 'https://faucet.testnet.sui.io/gas' \
  --header 'Content-Type: application/json' \
  --data-raw '{"FixedAmountRequest": {"recipient": "0xYOUR_ADDRESS"}}'
```

Repeat for all three addresses (Alice, Bob, Charlie).

### 4. Configure Environment (1 minute)

```bash
cp env.example .env
nano .env  # or use your favorite editor
```

**Edit `.env`:**
```bash
# From generate-keys output
ALICE_PRIVATE_KEY=suiprivkey1...
BOB_PRIVATE_KEY=suiprivkey1...
CHARLIE_PRIVATE_KEY=suiprivkey1...

# From deployment
PACKAGE_ID=0x2b8edb0c597ab49c215d4d9e3f71f227c2bc196c5b8a3a6c11a6dd6b239f8277

# Default is fine
GAS_BUDGET=50000000
SUI_NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
```

### 5. Run Tests! (30 seconds)

```bash
npm run test:basic
```

**Success looks like:**
```
✅ Setup and Configuration
✅ Create Escrow
✅ Claim Escrow
✅ Cancel Escrow
✅ Getter Functions

Total: 5 | Passed: 5 | Failed: 0
Duration: 35.21s
```

## All Test Commands

```bash
# Individual tests
npm run test:basic      # ~35s - Basic create/claim/cancel
npm run test:swap       # ~80s - Atomic swaps
npm run test:security   # ~110s - Access control
npm run test:coin       # ~55s - Coin-specific tests

# All tests
npm run test:all        # ~4-5 min - Complete test suite
```

## Common Issues

### ❌ "Private key not found"
**Fix:** Run `npm run generate-keys` and update `.env`

### ❌ "Insufficient balance"
**Fix:** Fund your addresses:
```bash
../scripts/request-tokens.sh testnet YOUR_ADDRESS
```

### ❌ "Package not found"
**Fix:** Set `PACKAGE_ID` in `.env` from your deployment:
```bash
source ../deployments/testnet/.env
echo $PACKAGE_ID  # Copy this
```

### ❌ Tests timeout
**Fix:** Increase timeout in `.env`:
```bash
TEST_TIMEOUT_MS=120000  # 2 minutes
```

## Next Steps

1. ✅ Tests passing? Great! You're ready to integrate.
2. 📖 Read full docs: `README.md`
3. 🔧 Customize tests for your use case
4. 🚀 Deploy to mainnet when ready

## Need Help?

- Full documentation: `README.md`
- Main project docs: `../README.md`
- Sui docs: https://docs.sui.io/
- Discord: https://discord.gg/sui

---

**Time to first test: ~5 minutes** ⚡

