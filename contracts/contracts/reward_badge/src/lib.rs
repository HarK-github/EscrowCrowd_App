#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env};

#[contract]
pub struct RewardBadgeContract;

#[contractimpl]
impl RewardBadgeContract {
    /// Award a badge of a certain tier to a donor
    pub fn award_badge(env: Env, donor: Address, tier: u32) {
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
