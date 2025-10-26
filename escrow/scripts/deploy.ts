/**
 * TypeScript deployment script for Sui Move Escrow Contract
 * 
 * Usage:
 *   npm install @mysten/sui.js
 *   npx tsx scripts/deploy.ts [network]
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Types
interface DeploymentResult {
  network: string;
  packageId: string;
  upgradeCapId: string;
  deployer: string;
  digest: string;
  gasUsed: {
    computationCost: string;
    storageCost: string;
    storageRebate: string;
    totalGas: string;
  };
  timestamp: string;
}

// Configuration
const NETWORKS = ['localnet', 'devnet', 'testnet', 'mainnet'] as const;
type Network = typeof NETWORKS[number];

const GAS_BUDGETS: Record<Network, number> = {
  localnet: 100_000_000,   // 0.1 SUI
  devnet: 100_000_000,     // 0.1 SUI
  testnet: 100_000_000,    // 0.1 SUI
  mainnet: 200_000_000,    // 0.2 SUI (higher for safety)
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// Utility functions
function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function info(message: string) {
  log(`[INFO] ${message}`, 'blue');
}

function success(message: string) {
  log(`[SUCCESS] ${message}`, 'green');
}

function error(message: string) {
  log(`[ERROR] ${message}`, 'red');
}

function warning(message: string) {
  log(`[WARNING] ${message}`, 'yellow');
}

function execCommand(command: string): string {
  try {
    return execSync(command, { encoding: 'utf-8' });
  } catch (err: any) {
    error(`Command failed: ${command}`);
    error(err.message);
    process.exit(1);
  }
}

// Main deployment function
async function deployContract(network: Network): Promise<DeploymentResult> {
  log('\n' + '='.repeat(50), 'bright');
  log('Sui Move Escrow Contract Deployment', 'bright');
  log('='.repeat(50) + '\n', 'bright');
  
  info(`Network: ${network}`);
  info(`Gas Budget: ${GAS_BUDGETS[network]} MIST\n`);
  
  // Validate network
  if (!NETWORKS.includes(network)) {
    error(`Invalid network: ${network}`);
    error(`Valid networks: ${NETWORKS.join(', ')}`);
    process.exit(1);
  }
  
  // Switch to network
  info(`Switching to ${network}...`);
  execCommand(`sui client switch --env ${network}`);
  
  // Get active address
  const activeAddress = execCommand('sui client active-address').trim();
  success(`Active address: ${activeAddress}`);
  
  // Check balance
  const gasOutput = execCommand('sui client gas --json');
  const gasObjects = JSON.parse(gasOutput);
  const balance = gasObjects[0]?.mistBalance || 0;
  info(`Balance: ${balance} MIST (${balance / 1_000_000_000} SUI)`);
  
  if (balance < GAS_BUDGETS[network]) {
    warning('Low balance! You may not have enough gas for deployment.');
    if (network === 'devnet' || network === 'testnet') {
      info(`Request test tokens: ./scripts/request-tokens.sh ${network}`);
    }
  }
  
  // Build the contract
  info('Building contract...');
  execCommand('sui move build');
  success('Build successful!\n');
  
  // Create deployment directory
  const deploymentDir = join(process.cwd(), 'deployments', network);
  if (!existsSync(deploymentDir)) {
    mkdirSync(deploymentDir, { recursive: true });
  }
  
  // Deploy the contract
  info(`Publishing contract to ${network}...`);
  const publishOutput = execCommand(
    `sui client publish --gas-budget ${GAS_BUDGETS[network]} --json`
  );
  
  const publishResult = JSON.parse(publishOutput);
  
  // Extract deployment info
  const packageId = publishResult.objectChanges.find(
    (obj: any) => obj.type === 'published'
  )?.packageId;
  
  const upgradeCapId = publishResult.objectChanges.find(
    (obj: any) => obj.objectType?.includes('UpgradeCap')
  )?.objectId;
  
  if (!packageId || !upgradeCapId) {
    error('Failed to extract deployment information');
    console.log(JSON.stringify(publishResult, null, 2));
    process.exit(1);
  }
  
  success(`\nPackage ID: ${packageId}`);
  success(`Upgrade Cap ID: ${upgradeCapId}`);
  
  // Prepare deployment result
  const deployment: DeploymentResult = {
    network,
    packageId,
    upgradeCapId,
    deployer: activeAddress,
    digest: publishResult.digest,
    gasUsed: {
      computationCost: publishResult.effects.gasUsed.computationCost,
      storageCost: publishResult.effects.gasUsed.storageCost,
      storageRebate: publishResult.effects.gasUsed.storageRebate,
      totalGas: (
        BigInt(publishResult.effects.gasUsed.computationCost) +
        BigInt(publishResult.effects.gasUsed.storageCost) -
        BigInt(publishResult.effects.gasUsed.storageRebate)
      ).toString(),
    },
    timestamp: new Date().toISOString(),
  };
  
  // Save deployment info
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const deploymentFile = join(deploymentDir, `deployment_${timestamp}.json`);
  writeFileSync(deploymentFile, JSON.stringify(publishResult, null, 2));
  info(`\nFull deployment saved to: ${deploymentFile}`);
  
  const summaryFile = join(deploymentDir, 'latest.json');
  writeFileSync(summaryFile, JSON.stringify(deployment, null, 2));
  success(`Deployment summary saved to: ${summaryFile}`);
  
  // Save environment variables
  const envFile = join(deploymentDir, '.env');
  const envContent = `# Escrow Contract Deployment - ${network}
# Deployed at: ${new Date().toLocaleString()}

NETWORK=${network}
PACKAGE_ID=${packageId}
UPGRADE_CAP_ID=${upgradeCapId}
DEPLOYER=${activeAddress}
`;
  writeFileSync(envFile, envContent);
  success(`Environment variables saved to: ${envFile}`);
  
  // Display next steps
  log('\n' + '='.repeat(50), 'bright');
  log('Next Steps', 'bright');
  log('='.repeat(50), 'bright');
  
  console.log('\n1. View your package on Sui Explorer:');
  const explorerUrl = getExplorerUrl(network, packageId);
  console.log(`   ${explorerUrl}`);
  
  console.log('\n2. Update your application configuration:');
  console.log(`   export ESCROW_PACKAGE_ID=${packageId}`);
  
  console.log('\n3. Keep your Upgrade Cap secure:');
  console.log(`   Upgrade Cap ID: ${upgradeCapId}`);
  
  console.log('\n4. Gas used:');
  console.log(`   Total: ${deployment.gasUsed.totalGas} MIST (${
    Number(deployment.gasUsed.totalGas) / 1_000_000_000
  } SUI)`);
  
  success('\nDeployment complete!');
  
  return deployment;
}

function getExplorerUrl(network: Network, objectId: string): string {
  switch (network) {
    case 'mainnet':
      return `https://suiscan.xyz/mainnet/object/${objectId}`;
    case 'testnet':
      return `https://suiscan.xyz/testnet/object/${objectId}`;
    case 'devnet':
      return `https://suiscan.xyz/devnet/object/${objectId}`;
    case 'localnet':
      return 'http://localhost:9000 (if running local explorer)';
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const network = (args[0] || 'devnet') as Network;
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Sui Move Escrow Contract Deployment Script (TypeScript)

Usage: npx tsx scripts/deploy.ts [network]

Arguments:
  network      Target network (default: devnet)
               Valid options: ${NETWORKS.join(', ')}

Examples:
  npx tsx scripts/deploy.ts
  npx tsx scripts/deploy.ts testnet
  npx tsx scripts/deploy.ts mainnet

Requirements:
  - Node.js and npm/pnpm installed
  - Sui CLI installed and configured
  - tsx or ts-node for TypeScript execution
    `);
    process.exit(0);
  }
  
  try {
    await deployContract(network);
  } catch (err: any) {
    error('\nDeployment failed!');
    error(err.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { deployContract, DeploymentResult };

