# Sui Move Escrow Contract

A comprehensive escrow smart contract implementation on Sui blockchain that enables secure peer-to-peer asset exchanges.

## Features

### Core Functionality

1. **Create Escrow**: Lock an object for a specific recipient with optional exchange requirements
2. **Claim Escrow**: Recipient can claim the escrowed object
3. **Cancel Escrow**: Sender can cancel and reclaim the escrowed object
4. **Atomic Swaps**: Exchange objects between two parties atomically
5. **Type Safety**: Uses phantom types to specify expected exchange objects

### Security Features

- **Access Control**: Only the designated recipient can claim, only the sender can cancel
- **Type-Safe Exchanges**: Phantom type parameters ensure correct object types in swaps
- **Event Emissions**: All major actions emit events for tracking
- **Atomic Operations**: Swap operations are atomic - both succeed or both fail

## Project Structure

```
escrow/
├── Move.toml                 # Package configuration
├── sources/
│   └── escrow.move          # Main escrow contract
└── tests/
    └── escrow_tests.move    # Comprehensive test suite
```

## Building the Project

```bash
sui move build
```

## Running Tests

```bash
sui move test
```

All 10 tests should pass:
- `test_create_escrow` - Basic escrow creation
- `test_claim_escrow` - Recipient claiming escrow
- `test_cancel_escrow` - Sender canceling escrow
- `test_swap` - Two-party swap scenario
- `test_swap_with_exchange` - Swap with exchange object
- `test_escrow_with_coins` - Escrow with Sui coins
- `test_claim_wrong_recipient` - Security test (should fail)
- `test_cancel_wrong_sender` - Security test (should fail)
- `test_multiple_escrows` - Multiple concurrent escrows
- `test_create_cancel_recreate` - Escrow lifecycle

## Usage Examples

### Creating an Escrow

```move
// Create an escrow for ItemA, expecting ItemB in return
let escrow = escrow::create<ItemA, ItemB>(
    my_item,
    recipient_address,
    ctx
);
```

### Claiming an Escrow (Simple)

```move
// Recipient claims without providing exchange
let item = escrow::claim(escrow, ctx);
```

### Claiming with Exchange (Swap)

```move
// Recipient provides ItemB to get ItemA
let item_a = escrow::swap(escrow, my_item_b, ctx);
// ItemB is automatically transferred to the original sender
```

### Canceling an Escrow

```move
// Sender cancels and gets their item back
let item = escrow::cancel(escrow, ctx);
```

## API Reference

### Public Functions

#### `create<T, ExchangeFor>`
Creates a new escrow object.
- **Parameters**: 
  - `escrowed: T` - The object to escrow
  - `recipient: address` - Who can claim it
  - `ctx: &mut TxContext`
- **Returns**: `EscrowedObj<T, ExchangeFor>`

#### `claim<T, ExchangeFor>`
Claim an escrowed object without exchange.
- **Parameters**: 
  - `escrow: EscrowedObj<T, ExchangeFor>`
  - `ctx: &TxContext`
- **Returns**: `T` - The escrowed object

#### `swap<T, ExchangeFor>`
Claim by providing an exchange object.
- **Parameters**: 
  - `escrow: EscrowedObj<T, ExchangeFor>`
  - `exchange: ExchangeFor` - Object to exchange
  - `ctx: &TxContext`
- **Returns**: `T` - The escrowed object

#### `cancel<T, ExchangeFor>`
Cancel escrow and reclaim object (sender only).
- **Parameters**: 
  - `escrow: EscrowedObj<T, ExchangeFor>`
  - `ctx: &TxContext`
- **Returns**: `T` - The escrowed object

### Entry Functions

#### `create_and_share<T, ExchangeFor>`
Creates an escrow and makes it a shared object.

#### `swap_escrowed<T1, T2>`
Atomically swaps two escrowed objects between two parties.

### Getter Functions

- `sender<T, ExchangeFor>(&EscrowedObj<T, ExchangeFor>): address`
- `recipient<T, ExchangeFor>(&EscrowedObj<T, ExchangeFor>): address`
- `escrowed<T, ExchangeFor>(&EscrowedObj<T, ExchangeFor>): &T`

## Events

### `EscrowCreated`
Emitted when an escrow is created.
- `escrow_id: ID`
- `sender: address`
- `recipient: address`

### `EscrowClaimed`
Emitted when an escrow is claimed.
- `escrow_id: ID`

### `EscrowCancelled`
Emitted when an escrow is cancelled.
- `escrow_id: ID`

### `SwapCompleted`
Emitted when a swap is completed.
- `escrow1_id: ID`
- `escrow2_id: ID`

## Error Codes

- `EWrongRecipient (0)`: Caller is not the designated recipient or sender

## Use Cases

1. **Peer-to-Peer Trading**: Safely exchange NFTs or other assets
2. **Escrow Services**: Hold assets until conditions are met
3. **Atomic Swaps**: Exchange different types of objects atomically
4. **Gift Transfers**: Send assets to recipients who can claim them
5. **Conditional Payments**: Lock coins until recipient provides something in return

## Development

### Prerequisites
- Sui CLI installed (version 1.56.2 or later)
- Basic understanding of Move programming language

### Testing Strategy
The test suite covers:
- Happy path scenarios (create, claim, cancel)
- Swap scenarios (simple and with exchange)
- Security tests (wrong recipient/sender)
- Edge cases (multiple escrows, lifecycle)
- Integration with Sui coins

## License

This is a tutorial project for learning Sui Move development.

