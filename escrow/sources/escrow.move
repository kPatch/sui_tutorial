/// Module: escrow
/// 
/// This module implements a secure escrow system on Sui where:
/// - A sender can lock an object in escrow for a specific recipient
/// - The recipient can claim the escrowed object
/// - The sender can cancel and reclaim the object if needed
/// - Supports swaps where both parties escrow objects for each other
module escrow::escrow;

use sui::event;

// ======== Types ========

/// An escrow object that holds a locked item for a recipient
public struct EscrowedObj<T: key + store, phantom ExchangeFor: key + store> has key, store {
    id: UID,
    /// The address of the sender who created the escrow
    sender: address,
    /// The address of the recipient who can claim the escrowed object
    recipient: address,
    /// The escrowed object
    escrowed: T,
}

// ======== Events ========

/// Emitted when an escrow is created
public struct EscrowCreated has copy, drop {
    escrow_id: ID,
    sender: address,
    recipient: address,
}

/// Emitted when an escrow is claimed
public struct EscrowClaimed has copy, drop {
    escrow_id: ID,
}

/// Emitted when an escrow is cancelled
public struct EscrowCancelled has copy, drop {
    escrow_id: ID,
}

/// Emitted when a swap is completed
public struct SwapCompleted has copy, drop {
    escrow1_id: ID,
    escrow2_id: ID,
}

// ======== Errors ========

const EWrongRecipient: u64 = 0;

// ======== Public Functions ========

/// Create an escrow for an object, locking it for a specific recipient
/// The sender retains the ability to cancel the escrow
/// ExchangeFor is a phantom type parameter that specifies what type of object
/// the sender expects in return (useful for swaps)
public fun create<T: key + store, ExchangeFor: key + store>(
    escrowed: T,
    recipient: address,
    ctx: &mut TxContext
): EscrowedObj<T, ExchangeFor> {
    let sender = ctx.sender();
    let id = object::new(ctx);
    let escrow_id = id.to_inner();
    
    event::emit(EscrowCreated {
        escrow_id,
        sender,
        recipient,
    });

    EscrowedObj {
        id,
        sender,
        recipient,
        escrowed,
    }
}

/// Claim an escrowed object by providing an exchange object
/// This is used for atomic swaps where both parties escrow objects for each other
/// The exchange object must match the ExchangeFor type parameter
public fun swap<T: key + store, ExchangeFor: key + store>(
    escrow: EscrowedObj<T, ExchangeFor>,
    exchange: ExchangeFor,
    ctx: &TxContext
): T {
    let EscrowedObj {
        id,
        sender,
        recipient,
        escrowed,
    } = escrow;

    assert!(recipient == ctx.sender(), EWrongRecipient);
    
    event::emit(EscrowClaimed {
        escrow_id: id.to_inner(),
    });

    // Transfer the exchange object to the original sender
    transfer::public_transfer(exchange, sender);
    
    id.delete();
    escrowed
}

/// Cancel an escrow and return the escrowed object to the sender
/// Only the sender can cancel
public fun cancel<T: key + store, ExchangeFor: key + store>(
    escrow: EscrowedObj<T, ExchangeFor>,
    ctx: &TxContext
): T {
    let EscrowedObj {
        id,
        sender,
        recipient: _,
        escrowed,
    } = escrow;

    assert!(sender == ctx.sender(), EWrongRecipient);
    
    event::emit(EscrowCancelled {
        escrow_id: id.to_inner(),
    });

    id.delete();
    escrowed
}

/// Claim an escrowed object without providing an exchange object
/// This is useful for one-way transfers or gifts
public fun claim<T: key + store, ExchangeFor: key + store>(
    escrow: EscrowedObj<T, ExchangeFor>,
    ctx: &TxContext
): T {
    let EscrowedObj {
        id,
        sender: _,
        recipient,
        escrowed,
    } = escrow;

    assert!(recipient == ctx.sender(), EWrongRecipient);
    
    event::emit(EscrowClaimed {
        escrow_id: id.to_inner(),
    });

    id.delete();
    escrowed
}

// ======== Entry Functions ========

/// Entry function to create an escrow and share it
#[allow(lint(public_entry), lint(share_owned))]
public entry fun create_and_share<T: key + store, ExchangeFor: key + store>(
    escrowed: T,
    recipient: address,
    ctx: &mut TxContext
) {
    let escrow = create<T, ExchangeFor>(escrowed, recipient, ctx);
    transfer::public_share_object(escrow);
}

/// Entry function to swap two escrowed objects atomically
/// Both escrows must be for each other
#[allow(lint(public_entry))]
public entry fun swap_escrowed<T1: key + store, T2: key + store>(
    escrow1: EscrowedObj<T1, T2>,
    escrow2: EscrowedObj<T2, T1>,
    ctx: &mut TxContext
) {
    let sender = ctx.sender();
    
    // Verify that the escrows are set up correctly for a swap
    assert!(escrow1.recipient == sender, EWrongRecipient);
    assert!(escrow2.sender == sender, EWrongRecipient);
    
    let other_party = escrow2.recipient;
    assert!(escrow1.sender == other_party, EWrongRecipient);
    
    let escrow1_id = object::id(&escrow1);
    let escrow2_id = object::id(&escrow2);

    // Perform the swap
    let obj1 = claim(escrow1, ctx);
    let obj2 = claim(escrow2, ctx);

    // Transfer objects to their new owners
    transfer::public_transfer(obj1, sender);
    transfer::public_transfer(obj2, other_party);

    event::emit(SwapCompleted {
        escrow1_id,
        escrow2_id,
    });
}

// ======== Getter Functions ========

/// Get the sender of an escrow
public fun sender<T: key + store, ExchangeFor: key + store>(
    escrow: &EscrowedObj<T, ExchangeFor>
): address {
    escrow.sender
}

/// Get the recipient of an escrow
public fun recipient<T: key + store, ExchangeFor: key + store>(
    escrow: &EscrowedObj<T, ExchangeFor>
): address {
    escrow.recipient
}

/// Get a reference to the escrowed object
public fun escrowed<T: key + store, ExchangeFor: key + store>(
    escrow: &EscrowedObj<T, ExchangeFor>
): &T {
    &escrow.escrowed
}
