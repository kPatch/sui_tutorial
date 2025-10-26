# Deployment Scripts

This directory contains scripts for deploying, upgrading, and managing the Sui Move Escrow Contract.

## Quick Start

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Request test tokens (devnet/testnet only)
./scripts/request-tokens.sh devnet

# Deploy to devnet
./scripts/deploy.sh devnet

# Verify deployment
./scripts/verify.sh devnet
```

## Available Scripts

### 1. `deploy.sh` - Main Deployment Script

Deploys the escrow contract to a Sui network.

**Usage:**
```bash
./scripts/deploy.sh [network] [gas-budget]
```

**Examples:**
```bash
# Deploy to devnet with default gas (0.1 SUI)
./scripts/deploy.sh devnet

# Deploy to testnet with default gas
./scripts/deploy.sh testnet

# Deploy to mainnet with 0.2 SUI gas budget
./scripts/deploy.sh mainnet 200000000

# Deploy to local network
./scripts/deploy.sh localnet
```

**Output:**
- Creates `deployments/<network>/` directory
- Saves deployment info to `latest.json`
- Creates `.env` file with environment variables
- Displays package ID and upgrade cap ID

### 2. `deploy.ts` - TypeScript Deployment Script

TypeScript version of the deployment script for programmatic deployment.

**Setup:**
```bash
cd scripts
npm install
```

**Usage:**
```bash
npx tsx deploy.ts [network]

# Or use npm scripts
npm run deploy:devnet
npm run deploy:testnet
npm run deploy:mainnet
```

**Benefits:**
- Better error handling
- Structured JSON output
- Easier integration with CI/CD
- Type-safe deployment results

### 3. `verify.sh` - Verification Script

Verifies that a deployed contract exists and has the expected functions and structs.

**Usage:**
```bash
./scripts/verify.sh [network] [package-id]
```

**Examples:**
```bash
# Verify latest deployment on devnet
./scripts/verify.sh devnet

# Verify specific package
./scripts/verify.sh testnet 0x1234...
```

**Checks:**
- Package exists on network
- All expected functions present
- All expected structs present
- Provides explorer links

### 4. `upgrade.sh` - Upgrade Script

Upgrades an existing deployment to a new version.

**Usage:**
```bash
./scripts/upgrade.sh [network] [upgrade-cap-id] [gas-budget]
```

**Examples:**
```bash
# Upgrade latest devnet deployment
./scripts/upgrade.sh devnet

# Upgrade with specific upgrade cap
./scripts/upgrade.sh testnet 0xabcd...

# Upgrade with custom gas budget
./scripts/upgrade.sh mainnet 0xabcd... 200000000
```

**Important:**
- Verifies upgrade cap ownership
- Warns about compatibility requirements
- Backs up previous deployment info
- Saves upgrade history

### 5. `request-tokens.sh` - Faucet Request Script

Requests test tokens from Sui faucet (devnet/testnet only).

**Usage:**
```bash
./scripts/request-tokens.sh [network] [address]
```

**Examples:**
```bash
# Request for active address on devnet
./scripts/request-tokens.sh devnet

# Request for specific address on testnet
./scripts/request-tokens.sh testnet 0x1234...
```

## Prerequisites

### All Scripts
- [Sui CLI](https://docs.sui.io/build/install) installed
- Sui client configured with networks
- Active address with sufficient balance

### Bash Scripts
- `jq` for JSON parsing: `sudo apt install jq` or `brew install jq`
- `bc` for calculations (usually pre-installed)

### TypeScript Scripts
- Node.js v18+ 
- npm or pnpm

## Network Configuration

Make sure your Sui client is configured with the networks:

```bash
# View configured networks
sui client envs

# Add a network if needed
sui client new-env --alias devnet --rpc https://fullnode.devnet.sui.io:443

# Switch between networks
sui client switch --env devnet
```

## Directory Structure After Deployment

```
deployments/
├── devnet/
│   ├── latest.json                    # Current deployment info
│   ├── .env                          # Environment variables
│   ├── deployment_TIMESTAMP.json     # Full deployment output
│   └── upgrades/                     # Upgrade history
│       ├── upgrade_TIMESTAMP.json
│       └── upgrade_TIMESTAMP_summary.json
├── testnet/
│   └── ...
└── mainnet/
    └── ...
```

## Deployment Info Format

`latest.json` contains:
```json
{
  "network": "devnet",
  "packageId": "0x...",
  "upgradeCapId": "0x...",
  "deployer": "0x...",
  "timestamp": "2024-01-15T10:30:00Z",
  "gasUsed": {
    "computationCost": "1000000",
    "storageCost": "5000000",
    "storageRebate": "500000",
    "totalGas": "5500000"
  }
}
```

## Environment Variables

After deployment, `.env` file contains:
```bash
NETWORK=devnet
PACKAGE_ID=0x...
UPGRADE_CAP_ID=0x...
DEPLOYER=0x...
```

Use in your application:
```bash
source deployments/devnet/.env
echo $PACKAGE_ID
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Devnet

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Sui CLI
        run: |
          cargo install --locked --git https://github.com/MystenLabs/sui.git sui
      
      - name: Configure Sui
        env:
          SUI_KEY: ${{ secrets.SUI_PRIVATE_KEY }}
        run: |
          sui client new-env --alias devnet --rpc https://fullnode.devnet.sui.io:443
          echo "$SUI_KEY" | sui keytool import --alias deploy-key
      
      - name: Deploy Contract
        run: |
          chmod +x scripts/deploy.sh
          ./scripts/deploy.sh devnet
      
      - name: Save Deployment Info
        uses: actions/upload-artifact@v3
        with:
          name: deployment-info
          path: deployments/devnet/latest.json
```

## Upgrade Compatibility Checklist

Before upgrading, ensure:

✅ **Can Do:**
- Add new public functions
- Modify function implementations
- Add new structs
- Add new error codes
- Change internal logic
- Add new events

❌ **Cannot Do:**
- Change existing struct layouts
- Remove or change public function signatures
- Change struct abilities
- Remove existing functions
- Change type parameters

## Troubleshooting

### "Package not found" error
- Wait a few seconds for transaction to process
- Verify you're on the correct network
- Check explorer to confirm package exists

### "Insufficient gas" error
- Request more tokens: `./scripts/request-tokens.sh`
- Increase gas budget parameter
- Check balance: `sui client gas`

### "Upgrade cap not found" error
- Verify you own the upgrade cap
- Check `deployments/<network>/latest.json` for correct ID
- Ensure you haven't transferred the cap

### "Build failed" error
- Run `sui move build` manually to see detailed errors
- Ensure all dependencies are available
- Check Move.toml configuration

## Best Practices

1. **Always verify deployments:**
   ```bash
   ./scripts/verify.sh <network>
   ```

2. **Test on devnet first:**
   ```bash
   ./scripts/deploy.sh devnet
   # Test thoroughly
   ./scripts/deploy.sh testnet
   # More testing
   ./scripts/deploy.sh mainnet
   ```

3. **Keep upgrade caps secure:**
   - Store upgrade cap ID safely
   - Consider multisig for mainnet
   - Never expose in public repositories

4. **Document upgrades:**
   - Note what changed
   - Update changelog
   - Communicate to users

5. **Monitor gas costs:**
   - Check deployment costs
   - Optimize before mainnet
   - Budget for upgrades

## Support

For issues or questions:
- Check [Sui Documentation](https://docs.sui.io/)
- Visit [Sui Discord](https://discord.gg/sui)
- Review [Move Examples](https://examples.sui.io/)

## Security Notes

⚠️ **Important:**
- Never commit private keys
- Keep upgrade caps secure
- Test thoroughly on testnets
- Audit code before mainnet deployment
- Consider using multisig for mainnet upgrades

