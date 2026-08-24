#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, String, Symbol
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Creator,
    Goal,
    Deadline,
    TotalRaised,
    Token,
    Donation(Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignState {
    pub creator: Address,
    pub goal: i128,
    pub deadline: u64,
    pub total_raised: i128,
    pub token: Address,
    pub status: String,
}

#[contract]
pub struct CrowdfundContract;

#[contractimpl]
impl CrowdfundContract {
    /// Initialize the campaign
    pub fn create_campaign(
        env: Env,
        creator: Address,
        token: Address,
        goal: i128,
        deadline: u64,
    ) {
        creator.require_auth();

        if env.storage().instance().has(&DataKey::Creator) {
            panic!("Campaign already initialized");
        }
        if goal <= 0 {
            panic!("Goal must be > 0");
        }
        if deadline <= env.ledger().timestamp() {
            panic!("Deadline must be in the future");
        }

        env.storage().instance().set(&DataKey::Creator, &creator);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Goal, &goal);
        env.storage().instance().set(&DataKey::Deadline, &deadline);
        env.storage().instance().set(&DataKey::TotalRaised, &0i128);
        
        env.storage().instance().extend_ttl(100_000, 100_000);
    }

    pub fn donate(env: Env) {
        // Placeholder
    }

    pub fn get_campaign_state(env: Env) {
        // Placeholder
    }

    pub fn withdraw(env: Env) {
        // Placeholder
    }
}
