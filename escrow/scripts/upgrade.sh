#!/bin/bash

# Sui Move Escrow Contract Upgrade Script
# Usage: ./scripts/upgrade.sh [network] [upgrade-cap-id] [gas-budget]

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

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse arguments
NETWORK="${1:-devnet}"
UPGRADE_CAP_ID="${2}"
GAS_BUDGET="${3:-100000000}"

# If upgrade cap not provided, try to load from latest deployment
if [[ -z "$UPGRADE_CAP_ID" ]]; then
    DEPLOYMENT_FILE="deployments/$NETWORK/latest.json"
    if [[ -f "$DEPLOYMENT_FILE" ]]; then
        UPGRADE_CAP_ID=$(jq -r '.upgradeCapId' "$DEPLOYMENT_FILE")
        print_info "Loaded Upgrade Cap ID from $DEPLOYMENT_FILE"
    else
        print_error "Upgrade Cap ID not provided and no deployment found"
        echo "Usage: $0 [network] [upgrade-cap-id] [gas-budget]"
        exit 1
    fi
fi

print_info "=================================="
print_info "Sui Move Escrow Contract Upgrade"
print_info "=================================="
print_info "Network: $NETWORK"
print_info "Upgrade Cap ID: $UPGRADE_CAP_ID"
print_info "Gas Budget: $GAS_BUDGET MIST ($(echo "scale=4; $GAS_BUDGET/1000000000" | bc) SUI)"
echo ""

# Switch to network
print_info "Switching to $NETWORK..."
sui client switch --env "$NETWORK" >/dev/null 2>&1

# Get active address
ACTIVE_ADDRESS=$(sui client active-address 2>/dev/null || echo "")
if [[ -z "$ACTIVE_ADDRESS" ]]; then
    print_error "No active address found"
    exit 1
fi

print_success "Active address: $ACTIVE_ADDRESS"

# Verify upgrade cap ownership
print_info "Verifying Upgrade Cap ownership..."
UPGRADE_CAP_INFO=$(sui client object "$UPGRADE_CAP_ID" --json 2>/dev/null || echo "")

if [[ -z "$UPGRADE_CAP_INFO" ]]; then
    print_error "Upgrade Cap not found"
    exit 1
fi

OWNER=$(echo "$UPGRADE_CAP_INFO" | jq -r '.owner.AddressOwner // empty')
if [[ "$OWNER" != "$ACTIVE_ADDRESS" ]]; then
    print_error "You are not the owner of this Upgrade Cap"
    print_error "Owner: $OWNER"
    print_error "Your address: $ACTIVE_ADDRESS"
    exit 1
fi

print_success "Upgrade Cap ownership verified!"
echo ""

# Get current package ID
CURRENT_PACKAGE=$(echo "$UPGRADE_CAP_INFO" | jq -r '.content.fields.package')
print_info "Current Package ID: $CURRENT_PACKAGE"

# Warning about compatibility
print_warning "=================================="
print_warning "UPGRADE COMPATIBILITY WARNING"
print_warning "=================================="
echo ""
echo "Remember that upgrades must maintain compatibility:"
echo "  ✓ Can add new functions"
echo "  ✓ Can modify function implementations"
echo "  ✓ Can add new structs"
echo "  ✗ Cannot change existing struct layouts"
echo "  ✗ Cannot remove or change public function signatures"
echo "  ✗ Cannot change struct abilities"
echo ""
read -p "Have you verified upgrade compatibility? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Upgrade cancelled"
    exit 0
fi

# Build the contract
print_info "Building updated contract..."
sui move build || {
    print_error "Build failed!"
    exit 1
}
print_success "Build successful!"
echo ""

# Create upgrade directory
UPGRADE_DIR="deployments/$NETWORK/upgrades"
mkdir -p "$UPGRADE_DIR"

# Perform upgrade
print_info "Upgrading contract on $NETWORK..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$UPGRADE_DIR/upgrade_${TIMESTAMP}.json"

sui client upgrade --upgrade-capability "$UPGRADE_CAP_ID" --gas-budget "$GAS_BUDGET" --json > "$OUTPUT_FILE" 2>&1 || {
    print_error "Upgrade failed!"
    cat "$OUTPUT_FILE"
    exit 1
}

print_success "Contract upgraded successfully!"
echo ""

# Parse upgrade output
NEW_PACKAGE_ID=$(jq -r '.objectChanges[] | select(.type == "published") | .packageId' "$OUTPUT_FILE")

print_success "New Package ID: $NEW_PACKAGE_ID"
print_info "Previous Package ID: $CURRENT_PACKAGE"

# Update deployment info
DEPLOYMENT_FILE="deployments/$NETWORK/latest.json"
if [[ -f "$DEPLOYMENT_FILE" ]]; then
    # Create backup
    cp "$DEPLOYMENT_FILE" "$DEPLOYMENT_FILE.backup_$TIMESTAMP"
    
    # Update with new package ID
    jq --arg pkg "$NEW_PACKAGE_ID" --arg ts "$(date -Iseconds)" \
       '.packageId = $pkg | .lastUpgraded = $ts | .previousPackageId = .packageId' \
       "$DEPLOYMENT_FILE" > "$DEPLOYMENT_FILE.tmp" && mv "$DEPLOYMENT_FILE.tmp" "$DEPLOYMENT_FILE"
    
    print_info "Updated deployment info: $DEPLOYMENT_FILE"
fi

# Save upgrade summary
UPGRADE_SUMMARY="$UPGRADE_DIR/upgrade_${TIMESTAMP}_summary.json"
cat > "$UPGRADE_SUMMARY" << EOF
{
  "network": "$NETWORK",
  "previousPackageId": "$CURRENT_PACKAGE",
  "newPackageId": "$NEW_PACKAGE_ID",
  "upgradeCapId": "$UPGRADE_CAP_ID",
  "upgrader": "$ACTIVE_ADDRESS",
  "timestamp": "$(date -Iseconds)",
  "gasUsed": $(jq -r '.effects.gasUsed' "$OUTPUT_FILE"),
  "digest": "$(jq -r '.digest' "$OUTPUT_FILE")"
}
EOF

print_info "Upgrade summary saved to: $UPGRADE_SUMMARY"
echo ""

# Display next steps
print_info "=================================="
print_info "Next Steps"
print_info "=================================="
echo "1. View upgraded package on explorer:"

case "$NETWORK" in
    mainnet)
        echo "   https://suiscan.xyz/mainnet/object/$NEW_PACKAGE_ID"
        ;;
    testnet)
        echo "   https://suiscan.xyz/testnet/object/$NEW_PACKAGE_ID"
        ;;
    devnet)
        echo "   https://suiscan.xyz/devnet/object/$NEW_PACKAGE_ID"
        ;;
    localnet)
        echo "   http://localhost:9000"
        ;;
esac

echo ""
echo "2. Update your application configuration:"
echo "   OLD: ESCROW_PACKAGE_ID=$CURRENT_PACKAGE"
echo "   NEW: ESCROW_PACKAGE_ID=$NEW_PACKAGE_ID"
echo ""
echo "3. Run verification:"
echo "   ./scripts/verify.sh $NETWORK $NEW_PACKAGE_ID"
echo ""
echo "4. Test thoroughly before updating production clients!"
echo ""

print_success "Upgrade complete!"

