#[test_only]
module escrow::escrow_tests;

use escrow::escrow::{Self, EscrowedObj};
use sui::test_scenario::{Self as test, Scenario, next_tx, ctx};
use sui::coin::{Self, Coin};
use sui::sui::SUI;

// ======== Test Objects ========

/// A simple object to use in tests
public struct ItemA has key, store {
    id: UID,
    value: u64,
}

/// Another simple object to use in tests
public struct ItemB has key, store {
    id: UID,
    value: u64,
}

// ======== Helper Functions ========

fun create_item_a(value: u64, scenario: &mut Scenario): ItemA {
    ItemA {
        id: object::new(ctx(scenario)),
        value,
    }
}

fun create_item_b(value: u64, scenario: &mut Scenario): ItemB {
    ItemB {
        id: object::new(ctx(scenario)),
        value,
    }
}

// ======== Tests ========

#[test]
fun test_create_escrow() {
    let sender = @0xA;
    let recipient = @0xB;
    
    let mut scenario = test::begin(sender);
    
    // Sender creates an escrow
    {
        let item = create_item_a(100, &mut scenario);
        let escrow = escrow::create<ItemA, ItemB>(item, recipient, ctx(&mut scenario));
        
        // Verify escrow properties
        assert!(escrow::sender(&escrow) == sender, 0);
        assert!(escrow::recipient(&escrow) == recipient, 1);
        assert!(escrow::escrowed(&escrow).value == 100, 2);
        
        transfer::public_transfer(escrow, sender);
    };
    
    scenario.end();
}

#[test]
fun test_claim_escrow() {
    let sender = @0xA;
    let recipient = @0xB;
    
    let mut scenario = test::begin(sender);
    
    // Sender creates an escrow
    {
        let item = create_item_a(100, &mut scenario);
        let escrow = escrow::create<ItemA, ItemB>(item, recipient, ctx(&mut scenario));
        transfer::public_transfer(escrow, recipient);
    };
    
    // Recipient claims the escrow
    next_tx(&mut scenario, recipient);
    {
        let escrow = test::take_from_sender<EscrowedObj<ItemA, ItemB>>(&scenario);
        let item = escrow::claim(escrow, ctx(&mut scenario));
        
        assert!(item.value == 100, 0);
        
        transfer::public_transfer(item, recipient);
    };
    
    scenario.end();
}

#[test]
fun test_cancel_escrow() {
    let sender = @0xA;
    let recipient = @0xB;
    
    let mut scenario = test::begin(sender);
    
    // Sender creates an escrow
    {
        let item = create_item_a(100, &mut scenario);
        let escrow = escrow::create<ItemA, ItemB>(item, recipient, ctx(&mut scenario));
        transfer::public_transfer(escrow, sender);
    };
    
    // Sender cancels the escrow
    next_tx(&mut scenario, sender);
    {
        let escrow = test::take_from_sender<EscrowedObj<ItemA, ItemB>>(&scenario);
        let item = escrow::cancel(escrow, ctx(&mut scenario));
        
        assert!(item.value == 100, 0);
        
        transfer::public_transfer(item, sender);
    };
    
    scenario.end();
}

#[test]
fun test_swap() {
    let alice = @0xA;
    let bob = @0xB;
    
    let mut scenario = test::begin(alice);
    
    // Alice creates an escrow with ItemA for Bob
    {
        let item = create_item_a(100, &mut scenario);
        let escrow = escrow::create<ItemA, ItemB>(item, bob, ctx(&mut scenario));
        transfer::public_transfer(escrow, bob);
    };
    
    // Bob creates an escrow with ItemB for Alice
    next_tx(&mut scenario, bob);
    {
        let item = create_item_b(200, &mut scenario);
        let escrow = escrow::create<ItemB, ItemA>(item, alice, ctx(&mut scenario));
        transfer::public_transfer(escrow, alice);
    };
    
    // Alice swaps by providing ItemB to get ItemA
    next_tx(&mut scenario, alice);
    {
        let alice_escrow = test::take_from_sender<EscrowedObj<ItemB, ItemA>>(&scenario);
        let item_b = escrow::claim(alice_escrow, ctx(&mut scenario));
        
        assert!(item_b.value == 200, 0);
        transfer::public_transfer(item_b, alice);
    };
    
    // Bob can now claim ItemA
    next_tx(&mut scenario, bob);
    {
        let bob_escrow = test::take_from_sender<EscrowedObj<ItemA, ItemB>>(&scenario);
        let item_a = escrow::claim(bob_escrow, ctx(&mut scenario));
        
        assert!(item_a.value == 100, 1);
        transfer::public_transfer(item_a, bob);
    };
    
    scenario.end();
}

#[test]
fun test_swap_with_exchange() {
    let alice = @0xA;
    let bob = @0xB;
    
    let mut scenario = test::begin(alice);
    
    // Alice creates an escrow with ItemA for Bob, expecting ItemB
    {
        let item = create_item_a(100, &mut scenario);
        let escrow = escrow::create<ItemA, ItemB>(item, bob, ctx(&mut scenario));
        transfer::public_transfer(escrow, bob);
    };
    
    // Bob swaps by providing ItemB to get ItemA
    next_tx(&mut scenario, bob);
    {
        let escrow = test::take_from_sender<EscrowedObj<ItemA, ItemB>>(&scenario);
        let exchange_item = create_item_b(200, &mut scenario);
        let item_a = escrow::swap(escrow, exchange_item, ctx(&mut scenario));
        
        assert!(item_a.value == 100, 0);
        transfer::public_transfer(item_a, bob);
    };
    
    // Alice should receive the ItemB
    next_tx(&mut scenario, alice);
    {
        let item_b = test::take_from_sender<ItemB>(&scenario);
        assert!(item_b.value == 200, 1);
        transfer::public_transfer(item_b, alice);
    };
    
    scenario.end();
}

#[test]
fun test_escrow_with_coins() {
    let alice = @0xA;
    let bob = @0xB;
    
    let mut scenario = test::begin(alice);
    
    // Alice creates an escrow with 1000 SUI for Bob
    {
        let coin = coin::mint_for_testing<SUI>(1000, ctx(&mut scenario));
        let escrow = escrow::create<Coin<SUI>, ItemA>(coin, bob, ctx(&mut scenario));
        transfer::public_transfer(escrow, bob);
    };
    
    // Bob claims the coins
    next_tx(&mut scenario, bob);
    {
        let escrow = test::take_from_sender<EscrowedObj<Coin<SUI>, ItemA>>(&scenario);
        let coin = escrow::claim(escrow, ctx(&mut scenario));
        
        assert!(coin.value() == 1000, 0);
        transfer::public_transfer(coin, bob);
    };
    
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 0)]
fun test_claim_wrong_recipient() {
    let sender = @0xA;
    let recipient = @0xB;
    let wrong_recipient = @0xC;
    
    let mut scenario = test::begin(sender);
    
    // Sender creates an escrow
    {
        let item = create_item_a(100, &mut scenario);
        let escrow = escrow::create<ItemA, ItemB>(item, recipient, ctx(&mut scenario));
        transfer::public_transfer(escrow, wrong_recipient);
    };
    
    // Wrong recipient tries to claim (should fail)
    next_tx(&mut scenario, wrong_recipient);
    {
        let escrow = test::take_from_sender<EscrowedObj<ItemA, ItemB>>(&scenario);
        let item = escrow::claim(escrow, ctx(&mut scenario));
        transfer::public_transfer(item, wrong_recipient);
    };
    
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 0)]
fun test_cancel_wrong_sender() {
    let sender = @0xA;
    let recipient = @0xB;
    
    let mut scenario = test::begin(sender);
    
    // Sender creates an escrow
    {
        let item = create_item_a(100, &mut scenario);
        let escrow = escrow::create<ItemA, ItemB>(item, recipient, ctx(&mut scenario));
        transfer::public_transfer(escrow, recipient);
    };
    
    // Recipient tries to cancel (should fail, only sender can cancel)
    next_tx(&mut scenario, recipient);
    {
        let escrow = test::take_from_sender<EscrowedObj<ItemA, ItemB>>(&scenario);
        let item = escrow::cancel(escrow, ctx(&mut scenario));
        transfer::public_transfer(item, recipient);
    };
    
    scenario.end();
}

#[test]
fun test_multiple_escrows() {
    let alice = @0xA;
    let bob = @0xB;
    let charlie = @0xC;
    
    let mut scenario = test::begin(alice);
    
    // Alice creates escrows for both Bob and Charlie
    {
        let item1 = create_item_a(100, &mut scenario);
        let escrow1 = escrow::create<ItemA, ItemB>(item1, bob, ctx(&mut scenario));
        transfer::public_transfer(escrow1, bob);
        
        let item2 = create_item_a(200, &mut scenario);
        let escrow2 = escrow::create<ItemA, ItemB>(item2, charlie, ctx(&mut scenario));
        transfer::public_transfer(escrow2, charlie);
    };
    
    // Bob claims his escrow
    next_tx(&mut scenario, bob);
    {
        let escrow = test::take_from_sender<EscrowedObj<ItemA, ItemB>>(&scenario);
        let item = escrow::claim(escrow, ctx(&mut scenario));
        assert!(item.value == 100, 0);
        transfer::public_transfer(item, bob);
    };
    
    // Charlie claims his escrow
    next_tx(&mut scenario, charlie);
    {
        let escrow = test::take_from_sender<EscrowedObj<ItemA, ItemB>>(&scenario);
        let item = escrow::claim(escrow, ctx(&mut scenario));
        assert!(item.value == 200, 1);
        transfer::public_transfer(item, charlie);
    };
    
    scenario.end();
}

#[test]
fun test_create_cancel_recreate() {
    let sender = @0xA;
    let recipient = @0xB;
    
    let mut scenario = test::begin(sender);
    
    // Sender creates an escrow
    {
        let item = create_item_a(100, &mut scenario);
        let escrow = escrow::create<ItemA, ItemB>(item, recipient, ctx(&mut scenario));
        transfer::public_transfer(escrow, sender);
    };
    
    // Sender cancels the escrow
    next_tx(&mut scenario, sender);
    {
        let escrow = test::take_from_sender<EscrowedObj<ItemA, ItemB>>(&scenario);
        let item = escrow::cancel(escrow, ctx(&mut scenario));
        transfer::public_transfer(item, sender);
    };
    
    // Sender creates a new escrow with the same item
    next_tx(&mut scenario, sender);
    {
        let item = test::take_from_sender<ItemA>(&scenario);
        let escrow = escrow::create<ItemA, ItemB>(item, recipient, ctx(&mut scenario));
        transfer::public_transfer(escrow, recipient);
    };
    
    // Recipient claims the new escrow
    next_tx(&mut scenario, recipient);
    {
        let escrow = test::take_from_sender<EscrowedObj<ItemA, ItemB>>(&scenario);
        let item = escrow::claim(escrow, ctx(&mut scenario));
        assert!(item.value == 100, 0);
        transfer::public_transfer(item, recipient);
    };
    
    scenario.end();
}
