#!/bin/bash

# Sui Move Escrow Contract Deployment Script
# Usage: ./scripts/deploy.sh [network] [gas-budget]
# Example: ./scripts/deploy.sh devnet 100000000

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
NETWORK="${1:-devnet}"
GAS_BUDGET="${2:-100000000}"  # 0.1 SUI

# Supported networks
VALID_NETWORKS=("localnet" "devnet" "testnet" "mainnet")

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if network is valid
validate_network() {
    local network=$1
    for valid in "${VALID_NETWORKS[@]}"; do
        if [[ "$network" == "$valid" ]]; then
            return 0
        fi
    done
    return 1
}

# Function to get active address
get_active_address() {
    sui client active-address 2>/dev/null || echo ""
}

# Function to check balance
check_balance() {
    local address=$1
    print_info "Checking balance for address: $address"
    sui client gas --json | jq -r '.[0].mistBalance // 0'
}

# Main deployment function
deploy_contract() {
    local network=$1
    local gas_budget=$2
    
    print_info "=================================="
    print_info "Sui Move Escrow Deployment"
    print_info "=================================="
    print_info "Network: $network"
    print_info "Gas Budget: $gas_budget MIST ($(echo "scale=4; $gas_budget/1000000000" | bc) SUI)"
    echo ""
    
    # Validate network
    if ! validate_network "$network"; then
        print_error "Invalid network: $network"
        print_info "Valid networks: ${VALID_NETWORKS[*]}"
        exit 1
    fi
    
    # Switch to the specified network
    print_info "Switching to $network..."
    sui client switch --env "$network" || {
        print_error "Failed to switch to $network"
        print_info "Please ensure the network is configured in your Sui client"
        exit 1
    }
    
    # Get active address
    ACTIVE_ADDRESS=$(get_active_address)
    if [[ -z "$ACTIVE_ADDRESS" ]]; then
        print_error "No active address found"
        print_info "Please run: sui client active-address"
        exit 1
    fi
    
    print_success "Active address: $ACTIVE_ADDRESS"
    
    # Check balance
    BALANCE=$(check_balance "$ACTIVE_ADDRESS")
    print_info "Balance: $BALANCE MIST ($(echo "scale=4; $BALANCE/1000000000" | bc) SUI)"
    
    if [[ "$BALANCE" -lt "$gas_budget" ]]; then
        print_warning "Low balance! You may not have enough gas for deployment."
        
        if [[ "$network" == "devnet" || "$network" == "testnet" ]]; then
            print_info "You can request test tokens from the faucet:"
            print_info "  curl --location --request POST 'https://faucet.$network.sui.io/gas' \\"
            print_info "    --header 'Content-Type: application/json' \\"
            print_info "    --data-raw '{ \"FixedAmountRequest\": { \"recipient\": \"$ACTIVE_ADDRESS\" } }'"
            echo ""
            read -p "Do you want to continue anyway? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        else
            exit 1
        fi
    fi
    
    # Build the contract
    print_info "Building contract..."
    sui move build || {
        print_error "Build failed!"
        exit 1
    }
    print_success "Build successful!"
    echo ""
    
    # Create deployment directory
    DEPLOYMENT_DIR="deployments/$network"
    mkdir -p "$DEPLOYMENT_DIR"
    
    # Deploy the contract
    print_info "Publishing contract to $network..."
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    OUTPUT_FILE="$DEPLOYMENT_DIR/deployment_${TIMESTAMP}.json"
    
    sui client publish --gas-budget "$gas_budget" --json > "$OUTPUT_FILE" 2>&1 || {
        print_error "Deployment failed!"
        cat "$OUTPUT_FILE"
        exit 1
    }
    
    print_success "Contract published successfully!"
    echo ""
    
    # Parse deployment output
    PACKAGE_ID=$(jq -r '.objectChanges[] | select(.type == "published") | .packageId' "$OUTPUT_FILE")
    UPGRADE_CAP_ID=$(jq -r '.objectChanges[] | select(.objectType | contains("UpgradeCap")) | .objectId' "$OUTPUT_FILE")
    
    print_success "Package ID: $PACKAGE_ID"
    print_success "Upgrade Cap ID: $UPGRADE_CAP_ID"
    
    # Save deployment info in a more readable format
    SUMMARY_FILE="$DEPLOYMENT_DIR/latest.json"
    cat > "$SUMMARY_FILE" << EOF
{
  "network": "$network",
  "packageId": "$PACKAGE_ID",
  "upgradeCapId": "$UPGRADE_CAP_ID",
  "deployer": "$ACTIVE_ADDRESS",
  "timestamp": "$(date -Iseconds)",
  "gasUsed": $(jq -r '.effects.gasUsed' "$OUTPUT_FILE"),
  "digest": "$(jq -r '.digest' "$OUTPUT_FILE")"
}
EOF
    
    print_info "Deployment summary saved to: $SUMMARY_FILE"
    echo ""
    
    # Save to environment file
    ENV_FILE="$DEPLOYMENT_DIR/.env"
    cat > "$ENV_FILE" << EOF
# Escrow Contract Deployment - $network
# Deployed at: $(date)

NETWORK=$network
PACKAGE_ID=$PACKAGE_ID
UPGRADE_CAP_ID=$UPGRADE_CAP_ID
DEPLOYER=$ACTIVE_ADDRESS
EOF
    
    print_success "Environment variables saved to: $ENV_FILE"
    echo ""
    
    # Display next steps
    print_info "=================================="
    print_info "Next Steps"
    print_info "=================================="
    echo "1. View your package on Sui Explorer:"
    
    case "$network" in
        mainnet)
            echo "   https://suiscan.xyz/mainnet/object/$PACKAGE_ID"
            ;;
        testnet)
            echo "   https://suiscan.xyz/testnet/object/$PACKAGE_ID"
            ;;
        devnet)
            echo "   https://suiscan.xyz/devnet/object/$PACKAGE_ID"
            ;;
        localnet)
            echo "   http://localhost:9000 (if running local explorer)"
            ;;
    esac
    
    echo ""
    echo "2. Update your frontend/client with the package ID:"
    echo "   export ESCROW_PACKAGE_ID=$PACKAGE_ID"
    echo ""
    echo "3. Keep your Upgrade Cap secure:"
    echo "   Upgrade Cap ID: $UPGRADE_CAP_ID"
    echo ""
    echo "4. Run verification tests:"
    echo "   ./scripts/verify.sh $network $PACKAGE_ID"
    echo ""
    
    print_success "Deployment complete!"
}

# Show help
show_help() {
    cat << EOF
Sui Move Escrow Contract Deployment Script

Usage: $0 [network] [gas-budget]

Arguments:
  network      Target network (default: devnet)
               Valid options: localnet, devnet, testnet, mainnet
  gas-budget   Gas budget in MIST (default: 100000000 = 0.1 SUI)

Examples:
  $0                          # Deploy to devnet with default gas
  $0 testnet                  # Deploy to testnet with default gas
  $0 mainnet 200000000        # Deploy to mainnet with 0.2 SUI gas budget

Environment Setup:
  Make sure you have:
  - Sui CLI installed and configured
  - Active address with sufficient balance
  - Correct network configured in Sui client

For testnet/devnet, get test tokens from faucet:
  curl --location --request POST 'https://faucet.devnet.sui.io/gas' \\
    --header 'Content-Type: application/json' \\
    --data-raw '{ "FixedAmountRequest": { "recipient": "YOUR_ADDRESS" } }'

EOF
}

# Parse command line arguments
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_help
    exit 0
fi

# Check dependencies
command -v sui >/dev/null 2>&1 || {
    print_error "sui CLI is not installed. Please install it first."
    print_info "Visit: https://docs.sui.io/build/install"
    exit 1
}

command -v jq >/dev/null 2>&1 || {
    print_error "jq is not installed. Please install it first."
    print_info "Run: sudo apt-get install jq  # or brew install jq on macOS"
    exit 1
}

# Run deployment
deploy_contract "$NETWORK" "$GAS_BUDGET"

