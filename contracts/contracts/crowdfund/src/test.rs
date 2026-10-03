#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env, String,
};

fn setup_env() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|li| {
        li.timestamp = 1000;
    });

    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let contract_id = env.register(CrowdfundContract, ());

    (env, contract_id, creator, token_contract.address(), token_admin)
}

#[test]
fn test_create_campaign() {
    let (env, contract_id, creator, token, _) = setup_env();
    let client = CrowdfundContractClient::new(&env, &contract_id);

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
    let (env, contract_id, creator, token, _) = setup_env();
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let deadline: u64 = env.ledger().timestamp() + 1000;
    let goal: i128 = 0; // Invalid

    client.create_campaign(&creator, &token, &goal, &deadline);
}

#[test]
#[should_panic(expected = "Deadline must be in the future")]
fn test_create_campaign_invalid_deadline() {
    let (env, contract_id, creator, token, _) = setup_env();
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let deadline: u64 = 0; // Past timestamp
    let goal: i128 = 100;

    client.create_campaign(&creator, &token, &goal, &deadline);
}

#[test]
fn test_donate_and_withdraw_lifecycle() {
    let (env, contract_id, creator, token_id, _) = setup_env();
    let client = CrowdfundContractClient::new(&env, &contract_id);
    let token_client = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let goal: i128 = 100_000_000; // 10 XLM
    let deadline: u64 = env.ledger().timestamp() + 1000;

    client.create_campaign(&creator, &token_id, &goal, &deadline);

    // Donate
    let donor = Address::generate(&env);
    token_admin_client.mint(&donor, &150_000_000);
    client.donate(&donor, &100_000_000);

    let state = client.get_campaign_state();
    assert_eq!(state.total_raised, 100_000_000);
    assert_eq!(token_client.balance(&contract_id), 100_000_000);

    // Fast-forward past deadline
    env.ledger().with_mut(|li| {
        li.timestamp = deadline + 1;
    });

    let finished_state = client.get_campaign_state();
    assert_eq!(finished_state.status, String::from_str(&env, "completed"));

    // Withdraw funds
    client.withdraw(&creator);
    assert_eq!(token_client.balance(&creator), 100_000_000);
    assert_eq!(token_client.balance(&contract_id), 0);
}
