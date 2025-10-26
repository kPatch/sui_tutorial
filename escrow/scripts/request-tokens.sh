#!/bin/bash

# Request test tokens from Sui faucet
# Usage: ./scripts/request-tokens.sh [network] [address]

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
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
ADDRESS="${2}"

# If address not provided, use active address
if [[ -z "$ADDRESS" ]]; then
    ADDRESS=$(sui client active-address 2>/dev/null || echo "")
    if [[ -z "$ADDRESS" ]]; then
        print_error "No address provided and no active address found"
        echo "Usage: $0 [network] [address]"
        exit 1
    fi
    print_info "Using active address: $ADDRESS"
fi

# Validate network
if [[ "$NETWORK" != "devnet" && "$NETWORK" != "testnet" ]]; then
    print_error "Faucet only available for devnet and testnet"
    echo "Current network: $NETWORK"
    exit 1
fi

print_info "Requesting tokens from $NETWORK faucet..."
print_info "Recipient: $ADDRESS"

# Request tokens
RESPONSE=$(curl -s --location --request POST "https://faucet.$NETWORK.sui.io/gas" \
    --header 'Content-Type: application/json' \
    --data-raw "{
        \"FixedAmountRequest\": {
            \"recipient\": \"$ADDRESS\"
        }
    }")

# Check if request was successful
if echo "$RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error')
    print_error "Faucet request failed: $ERROR_MSG"
    exit 1
fi

# Parse response
TRANSFERRED=$(echo "$RESPONSE" | jq -r '.transferredGasObjects[0].amount // 0')

if [[ "$TRANSFERRED" -gt 0 ]]; then
    print_success "Received $TRANSFERRED MIST ($(echo "scale=4; $TRANSFERRED/1000000000" | bc) SUI)"
    
    # Wait a bit for the transaction to be processed
    print_info "Waiting for transaction to be processed..."
    sleep 3
    
    # Check balance
    sui client switch --env "$NETWORK" >/dev/null 2>&1
    BALANCE=$(sui client gas --json | jq -r '.[0].mistBalance // 0')
    print_info "Current balance: $BALANCE MIST ($(echo "scale=4; $BALANCE/1000000000" | bc) SUI)"
else
    print_error "No tokens received. Response:"
    echo "$RESPONSE" | jq '.'
fi

