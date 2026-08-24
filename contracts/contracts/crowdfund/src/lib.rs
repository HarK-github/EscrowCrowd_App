#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct CrowdfundContract;

#[contractimpl]
impl CrowdfundContract {
    pub fn create_campaign(env: Env) {
        // Placeholder
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

mod test;
