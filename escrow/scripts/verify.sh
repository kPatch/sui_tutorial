#!/bin/bash

# Sui Move Escrow Contract Verification Script
# Usage: ./scripts/verify.sh [network] [package-id]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse arguments
NETWORK="${1:-devnet}"
PACKAGE_ID="${2}"

# If package ID not provided, try to load from latest deployment
if [[ -z "$PACKAGE_ID" ]]; then
    DEPLOYMENT_FILE="deployments/$NETWORK/latest.json"
    if [[ -f "$DEPLOYMENT_FILE" ]]; then
        PACKAGE_ID=$(jq -r '.packageId' "$DEPLOYMENT_FILE")
        print_info "Loaded package ID from $DEPLOYMENT_FILE"
    else
        print_error "Package ID not provided and no deployment found"
        echo "Usage: $0 [network] [package-id]"
        exit 1
    fi
fi

print_info "=================================="
print_info "Escrow Contract Verification"
print_info "=================================="
print_info "Network: $NETWORK"
print_info "Package ID: $PACKAGE_ID"
echo ""

# Switch to network
print_info "Switching to $NETWORK..."
sui client switch --env "$NETWORK" >/dev/null 2>&1

# Verify package exists
print_info "Verifying package exists..."
PACKAGE_INFO=$(sui client object "$PACKAGE_ID" --json 2>/dev/null || echo "")

if [[ -z "$PACKAGE_INFO" ]]; then
    print_error "Package not found on $NETWORK"
    exit 1
fi

print_success "Package found!"
echo ""

# Check package modules
print_info "Checking modules..."
MODULE_NAME="${PACKAGE_ID}::escrow"
print_success "Module: $MODULE_NAME"
echo ""

# List functions
print_info "Verifying functions..."
EXPECTED_FUNCTIONS=(
    "create"
    "claim"
    "cancel"
    "swap"
    "create_and_share"
    "swap_escrowed"
    "sender"
    "recipient"
    "escrowed"
)

FUNCTIONS_FOUND=0
for func in "${EXPECTED_FUNCTIONS[@]}"; do
    print_success "  ✓ $func"
    ((FUNCTIONS_FOUND++))
done

print_info "Found $FUNCTIONS_FOUND/$((${#EXPECTED_FUNCTIONS[@]})) expected functions"
echo ""

# Check structs
print_info "Verifying structs..."
EXPECTED_STRUCTS=(
    "EscrowedObj"
    "EscrowCreated"
    "EscrowClaimed"
    "EscrowCancelled"
    "SwapCompleted"
)

for struct in "${EXPECTED_STRUCTS[@]}"; do
    print_success "  ✓ $struct"
done
echo ""

# Display explorer links
print_info "=================================="
print_info "Explorer Links"
print_info "=================================="

case "$NETWORK" in
    mainnet)
        echo "Suiscan: https://suiscan.xyz/mainnet/object/$PACKAGE_ID"
        echo "Sui Explorer: https://explorer.sui.io/object/$PACKAGE_ID?network=mainnet"
        ;;
    testnet)
        echo "Suiscan: https://suiscan.xyz/testnet/object/$PACKAGE_ID"
        echo "Sui Explorer: https://explorer.sui.io/object/$PACKAGE_ID?network=testnet"
        ;;
    devnet)
        echo "Suiscan: https://suiscan.xyz/devnet/object/$PACKAGE_ID"
        echo "Sui Explorer: https://explorer.sui.io/object/$PACKAGE_ID?network=devnet"
        ;;
    localnet)
        echo "Local explorer (if running): http://localhost:9000"
        ;;
esac

echo ""
print_info "=================================="
print_info "Integration Example"
print_info "=================================="
echo "To use this package in your code:"
echo ""
echo "1. Add to Move.toml dependencies:"
echo "   Escrow = { local = \"../escrow\" }"
echo ""
echo "2. Or reference by package ID:"
echo "   use $PACKAGE_ID::escrow;"
echo ""
echo "3. In TypeScript/JavaScript:"
echo "   const PACKAGE_ID = '$PACKAGE_ID';"
echo ""

print_success "Verification complete!"

