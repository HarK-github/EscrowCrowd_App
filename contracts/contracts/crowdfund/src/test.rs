#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Env, String};

#[test]
fn test_create_campaign() {
    let env = Env::default();
    let contract_id = env.register(CrowdfundContract, ());
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let token = Address::generate(&env);
    
    // Ledger timestamp is default 0, so 1000 is in the future
    let deadline: u64 = env.ledger().timestamp() + 1000;
    let goal: i128 = 500_000_000; // 50 XLM

    client.create_campaign(&creator, &token, &goal, &deadline);

    let state = client.get_campaign_state();
    assert_eq!(state.creator, creator);
    assert_eq!(state.token, token);
    assert_eq!(state.goal, goal);
    assert_eq!(state.deadline, deadline);
    assert_eq!(state.total_raised, 0);
    assert_eq!(state.status, String::from_str(&env, "active"));
}

#[test]
#[should_panic(expected = "Goal must be > 0")]
fn test_create_campaign_invalid_goal() {
    let env = Env::default();
    let contract_id = env.register(CrowdfundContract, ());
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let token = Address::generate(&env);
    
    let deadline: u64 = env.ledger().timestamp() + 1000;
    let goal: i128 = 0; // Invalid

    client.create_campaign(&creator, &token, &goal, &deadline);
}

#[test]
#[should_panic(expected = "Deadline must be in the future")]
fn test_create_campaign_invalid_deadline() {
    let env = Env::default();
    let contract_id = env.register(CrowdfundContract, ());
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let token = Address::generate(&env);
    
    let deadline: u64 = 0; // Past or current timestamp
    let goal: i128 = 100;

    client.create_campaign(&creator, &token, &goal, &deadline);
}
