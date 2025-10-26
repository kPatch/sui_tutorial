# Escrow Contract Quick Start Guide

## Quick Commands

```bash
# Build the project
sui move build

# Run all tests
sui move test

# Run tests with verbose output
sui move test --verbose

# Run a specific test
sui move test test_create_escrow
```

## Quick Example: Simple Escrow

```move
// 1. Alice creates an escrow for Bob
let item = ItemA { id: object::new(ctx), value: 100 };
let escrow = escrow::create<ItemA, ItemB>(item, bob_address, ctx);
transfer::public_transfer(escrow, bob_address);

// 2. Bob claims the escrow
let claimed_item = escrow::claim(escrow, ctx);
```

## Quick Example: Atomic Swap

```move
// Scenario: Alice has ItemA, Bob has ItemB, they want to swap

// 1. Alice creates escrow for Bob, expecting ItemB
let escrow_a = escrow::create<ItemA, ItemB>(item_a, bob, ctx);
transfer::public_transfer(escrow_a, bob);

// 2. Bob creates escrow for Alice, expecting ItemA  
let escrow_b = escrow::create<ItemB, ItemA>(item_b, alice, ctx);
transfer::public_transfer(escrow_b, alice);

// 3. Alice claims by providing nothing (or Bob does the same)
let item_b = escrow::claim(escrow_b, ctx);

// 4. Bob claims
let item_a = escrow::claim(escrow_a, ctx);

// Alternative: Bob can use swap to provide ItemB and get ItemA in one call
let item_a = escrow::swap(escrow_a, item_b, ctx);
// This automatically transfers item_b to Alice
```

## Key Concepts

### Phantom Types
The `ExchangeFor` type parameter is a phantom type that documents what the sender expects in return:

```move
// Alice expects ItemB in return for ItemA
EscrowedObj<ItemA, ItemB>

// Bob expects ItemA in return for ItemB
EscrowedObj<ItemB, ItemA>
```

### Object Ownership
Escrow objects can be:
- **Transferred** to a specific address (owned object)
- **Shared** for public access (shared object)

```move
// Owned by recipient
transfer::public_transfer(escrow, recipient);

// Shared publicly
transfer::public_share_object(escrow);
```

## Common Patterns

### Pattern 1: Gift/One-way Transfer
```move
let escrow = escrow::create<Gift, ()>(gift, recipient, ctx);
transfer::public_transfer(escrow, recipient);
// Recipient claims without providing anything
```

### Pattern 2: Conditional Payment
```move
// Sender locks coins, expecting a service token
let escrow = escrow::create<Coin<SUI>, ServiceToken>(
    coins, 
    service_provider, 
    ctx
);
// Provider delivers service token to claim coins
```

### Pattern 3: NFT Marketplace
```move
// Seller creates escrow for NFT, expecting payment
let escrow = escrow::create<NFT, Coin<SUI>>(
    nft,
    buyer,
    ctx
);
// Buyer provides coins to get NFT
let nft = escrow::swap(escrow, payment_coins, ctx);
```

## Testing Your Own Code

To use the escrow module in your tests:

```move
#[test_only]
module your_module::your_tests;

use escrow::escrow;
use sui::test_scenario;

#[test]
fun test_your_escrow_scenario() {
    let mut scenario = test_scenario::begin(@0xA);
    
    // Your test logic here
    
    scenario.end();
}
```

## Deployment Checklist

Before deploying to mainnet:

1. ✅ All tests pass (`sui move test`)
2. ✅ Build succeeds without errors (`sui move build`)
3. ✅ Review all linter warnings
4. ✅ Audit security-critical functions (claim, cancel, swap)
5. ✅ Test with real-world scenarios on devnet/testnet
6. ✅ Document expected behavior and edge cases
7. ✅ Consider adding additional access controls if needed

## Troubleshooting

### Issue: Tests fail with MISSING_DEPENDENCY error
**Solution**: Remove explicit Sui dependency from Move.toml and let it auto-resolve

### Issue: Wrong recipient/sender errors
**Solution**: Verify that the caller matches the expected recipient (for claim) or sender (for cancel)

### Issue: Type mismatch in swap
**Solution**: Ensure the exchange object type matches the `ExchangeFor` phantom type parameter

## Next Steps

1. Deploy to Sui devnet for testing
2. Integrate with a frontend application
3. Add custom business logic for your use case
4. Consider adding time locks or additional conditions
5. Implement admin functions if needed

## Resources

- [Sui Documentation](https://docs.sui.io/)
- [Move Book](https://move-language.github.io/move/)
- [Sui Move by Example](https://examples.sui.io/)

