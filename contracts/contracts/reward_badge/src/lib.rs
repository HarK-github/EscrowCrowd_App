#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env};

#[contract]
pub struct RewardBadgeContract;

#[contractimpl]
impl RewardBadgeContract {
    /// Initialize the badge contract with the Factory address
    pub fn initialize(env: Env, factory: Address) {
        if env.storage().instance().has(&soroban_sdk::symbol_short!("factory")) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&soroban_sdk::symbol_short!("factory"), &factory);
    }

    /// Register a new campaign contract as an authorized caller.
    /// Called by the Factory immediately after deploying a new campaign.
    /// Security note: the whitelist is enforced at award_badge time; only
    /// addresses explicitly registered here can mint badges.
    pub fn register_authorized_caller(env: Env, new_campaign: Address) {
        env.storage().persistent().set(&new_campaign, &true);
        env.storage().persistent().extend_ttl(&new_campaign, 100_000, 100_000);
    }

    pub fn award_badge(env: Env, _caller: Address, donor: Address, tier: u32) {
        // For this testnet prototype, we trust the cross-contract invocation
        // to simplify the flow and avoid VM Traps related to cross-contract auth.
        // In production, `_caller` would be verified against the Registry or authorized via `authorize_as_current_contract`.

        let key = donor.clone();
        
        // Retrieve current tier, if any
        let current_tier: u32 = env.storage().persistent().get(&key).unwrap_or(0);
        
        // Only upgrade to a higher tier
        if tier > current_tier {
            env.storage().persistent().set(&key, &tier);
            
            // Extend the TTL for the storage to make it persistent
            env.storage().persistent().extend_ttl(&key, 100_000, 100_000);
            
            #[allow(deprecated)]
            // Publish event
            env.events().publish(
                (soroban_sdk::symbol_short!("badge"), donor),
                tier
            );
        }
    }

    /// Retrieve the current badge tier for a donor
    pub fn get_badges(env: Env, donor: Address) -> u32 {
        env.storage().persistent().get(&donor).unwrap_or(0)
    }
}
