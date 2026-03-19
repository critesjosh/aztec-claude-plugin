use ::aztec::macros::aztec;

#[aztec]
pub contract Token {
    use ::aztec::{
        macros::{functions::{external, initializer, only_self}, storage::storage},
        messages::message_delivery::MessageDelivery,
    };
    use ::aztec::protocol::address::AztecAddress;
    use ::aztec::state_vars::{Map, Owned, PrivateSet, PublicMutable};

    use uint_note::UintNote;

    #[storage]
    struct Storage<Context> {
        admin: PublicMutable<AztecAddress, Context>,
        total_supply: PublicMutable<u64, Context>,
        public_balances: Map<AztecAddress, PublicMutable<u64, Context>, Context>,
        private_balances: Map<AztecAddress, Owned<PrivateSet<UintNote, Context>, Context>, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor(admin: AztecAddress, initial_supply: u64) {
        self.storage.admin.write(admin);
        self.storage.total_supply.write(initial_supply);
        self.storage.public_balances.at(admin).write(initial_supply);
    }

    #[external("public")]
    fn mint_public(to: AztecAddress, amount: u64) {
        let caller = self.context.maybe_msg_sender().unwrap();
        assert(caller.eq(self.storage.admin.read()));

        let current = self.storage.public_balances.at(to).read();
        self.storage.public_balances.at(to).write(current + amount);

        let supply = self.storage.total_supply.read();
        self.storage.total_supply.write(supply + amount);
    }

    #[external("public")]
    fn transfer_public(from: AztecAddress, to: AztecAddress, amount: u64) {
        let caller = self.context.maybe_msg_sender().unwrap();
        assert(caller.eq(from));

        let from_balance = self.storage.public_balances.at(from).read();
        assert(from_balance >= amount);

        self.storage.public_balances.at(from).write(from_balance - amount);
        let to_balance = self.storage.public_balances.at(to).read();
        self.storage.public_balances.at(to).write(to_balance + amount);
    }

    #[external("private")]
    fn shield(amount: u64) {
        let caller = self.context.maybe_msg_sender().unwrap();

        self.storage.private_balances.at(caller).at(caller)
            .insert(UintNote { value: amount as u128 })
            .deliver(MessageDelivery.ONCHAIN_CONSTRAINED);

        self.enqueue(Token::at(self.context.this_address()).subtract_public_balance(caller, amount));
    }

    #[external("public")]
    #[only_self]
    fn subtract_public_balance(from: AztecAddress, amount: u64) {
        let current = self.storage.public_balances.at(from).read();
        assert(current >= amount);
        self.storage.public_balances.at(from).write(current - amount);
    }

    #[external("utility")]
    unconstrained fn balance_of_public(account: AztecAddress) -> u64 {
        self.storage.public_balances.at(account).read()
    }

    #[external("utility")]
    unconstrained fn total_supply() -> u64 {
        self.storage.total_supply.read()
    }
}
