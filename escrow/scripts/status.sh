#!/bin/bash

# Display deployment status across all networks
# Usage: ./scripts/status.sh

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}$1${NC}"
}

print_success() {
    echo -e "${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}$1${NC}"
}

print_info() {
    echo "$1"
}

# Check if deployments directory exists
if [[ ! -d "deployments" ]]; then
    print_warning "No deployments found"
    echo "Run './scripts/deploy.sh [network]' to deploy"
    exit 0
fi

print_header "=================================="
print_header "Escrow Contract Deployment Status"
print_header "=================================="
echo ""

# Check each network
NETWORKS=("localnet" "devnet" "testnet" "mainnet")
FOUND_DEPLOYMENT=false

for network in "${NETWORKS[@]}"; do
    LATEST_FILE="deployments/$network/latest.json"
    
    if [[ -f "$LATEST_FILE" ]]; then
        FOUND_DEPLOYMENT=true
        
        # Parse deployment info
        PACKAGE_ID=$(jq -r '.packageId' "$LATEST_FILE")
        UPGRADE_CAP=$(jq -r '.upgradeCapId' "$LATEST_FILE")
        DEPLOYER=$(jq -r '.deployer' "$LATEST_FILE")
        TIMESTAMP=$(jq -r '.timestamp' "$LATEST_FILE")
        
        # Format timestamp
        if command -v date >/dev/null 2>&1; then
            FORMATTED_TIME=$(date -d "$TIMESTAMP" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$TIMESTAMP")
        else
            FORMATTED_TIME="$TIMESTAMP"
        fi
        
        print_success "📦 $network"
        echo "   Package ID:     $PACKAGE_ID"
        echo "   Upgrade Cap:    $UPGRADE_CAP"
        echo "   Deployer:       $DEPLOYER"
        echo "   Deployed:       $FORMATTED_TIME"
        
        # Check for upgrades
        UPGRADE_DIR="deployments/$network/upgrades"
        if [[ -d "$UPGRADE_DIR" ]]; then
            UPGRADE_COUNT=$(ls -1 "$UPGRADE_DIR"/*summary.json 2>/dev/null | wc -l)
            if [[ $UPGRADE_COUNT -gt 0 ]]; then
                echo "   Upgrades:       $UPGRADE_COUNT"
            fi
        fi
        
        # Explorer link
        case "$network" in
            mainnet)
                echo "   Explorer:       https://suiscan.xyz/mainnet/object/$PACKAGE_ID"
                ;;
            testnet)
                echo "   Explorer:       https://suiscan.xyz/testnet/object/$PACKAGE_ID"
                ;;
            devnet)
                echo "   Explorer:       https://suiscan.xyz/devnet/object/$PACKAGE_ID"
                ;;
        esac
        
        echo ""
    fi
done

if [[ "$FOUND_DEPLOYMENT" == false ]]; then
    print_warning "No deployments found"
    echo ""
    echo "Deploy to a network:"
    echo "  ./scripts/deploy.sh devnet"
fi

# Show current Sui client status
print_header "=================================="
print_header "Sui Client Status"
print_header "=================================="
echo ""

# Current environment
CURRENT_ENV=$(sui client active-env 2>/dev/null || echo "unknown")
print_info "Active Network:  $CURRENT_ENV"

# Active address
ACTIVE_ADDR=$(sui client active-address 2>/dev/null || echo "unknown")
print_info "Active Address:  $ACTIVE_ADDR"

# Balance
if [[ "$ACTIVE_ADDR" != "unknown" ]]; then
    BALANCE=$(sui client gas --json 2>/dev/null | jq -r '.[0].mistBalance // 0')
    SUI_BALANCE=$(echo "scale=4; $BALANCE/1000000000" | bc 2>/dev/null || echo "0")
    print_info "Balance:         $SUI_BALANCE SUI"
fi

echo ""

# Quick commands
print_header "=================================="
print_header "Quick Commands"
print_header "=================================="
echo ""
echo "Deploy:          ./scripts/deploy.sh [network]"
echo "Verify:          ./scripts/verify.sh [network]"
echo "Upgrade:         ./scripts/upgrade.sh [network]"
echo "Request Tokens:  ./scripts/request-tokens.sh [network]"
echo ""

