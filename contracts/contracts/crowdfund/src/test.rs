#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env, IntoVal, token, vec};

#[contract]
pub struct MockBadgeContract;

#[contractimpl]
impl MockBadgeContract {
    pub fn award_badge(env: Env, donor: Address, tier: u32) {
        env.storage().instance().set(&donor, &tier);
    }
    pub fn get_badge(env: Env, donor: Address) -> u32 {
        env.storage().instance().get(&donor).unwrap_or(0)
    }
}

fn setup_env() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|li| {
        li.timestamp = 12345;
    });
    
    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    
    let contract_id = env.register(CrowdfundContract, ());
    
    (env, contract_id, creator, token_id.address(), token_admin)
}

#[test]
fn test_donate_updates_state() {
    let (env, contract_id, creator, token_id, _token_admin) = setup_env();
    let client = CrowdfundContractClient::new(&env, &contract_id);
    let token_client = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    
    let goal = 5000_0000000;
    let deadline = env.ledger().timestamp() + 1000;
    
    client.create_campaign(&creator, &token_id, &goal, &deadline);
    
    let donor = Address::generate(&env);
    token_admin_client.mint(&donor, &100_0000000); // 100 XLM
    
    client.donate(&donor, &50_0000000);
    
    let state = client.get_campaign_state();
    assert_eq!(state.total_raised, 50_0000000);
    assert_eq!(token_client.balance(&contract_id), 50_0000000);
}

#[test]
fn test_donate_triggers_badge() {
    let (env, contract_id, creator, token_id, _token_admin) = setup_env();
    let client = CrowdfundContractClient::new(&env, &contract_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    
    let goal = 5000_0000000;
    let deadline = env.ledger().timestamp() + 1000;
    
    client.create_campaign(&creator, &token_id, &goal, &deadline);
    
    let badge_id = env.register(MockBadgeContract, ());
    client.set_badge_contract(&creator, &badge_id);
    
    let donor = Address::generate(&env);
    token_admin_client.mint(&donor, &2000_0000000); // 200 XLM
    
    client.donate(&donor, &1_000_000_000);
    
    let tier: u32 = env.invoke_contract(&badge_id, &soroban_sdk::Symbol::new(&env, "get_badge"), vec![&env, donor.into_val(&env)]);
    assert_eq!(tier, 1);
}

#[test]
#[should_panic(expected = "Campaign is still active")]
fn test_withdraw_fails_before_deadline() {
    let (env, contract_id, creator, token_id, _) = setup_env();
    let client = CrowdfundContractClient::new(&env, &contract_id);
    let goal = 100_0000000;
    let deadline = env.ledger().timestamp() + 1000;
    
    client.create_campaign(&creator, &token_id, &goal, &deadline);
    client.withdraw(&creator);
}

#[test]
#[should_panic(expected = "Goal not met")]
fn test_withdraw_fails_goal_not_met() {
    let (env, contract_id, creator, token_id, _) = setup_env();
    let client = CrowdfundContractClient::new(&env, &contract_id);
    let goal = 100_0000000;
    let deadline = env.ledger().timestamp() + 1000;
    
    client.create_campaign(&creator, &token_id, &goal, &deadline);
    
    env.ledger().with_mut(|li| {
        li.timestamp = deadline + 1;
    });
    
    client.withdraw(&creator);
}

#[test]
fn test_withdraw_succeeds() {
    let (env, contract_id, creator, token_id, _token_admin) = setup_env();
    let client = CrowdfundContractClient::new(&env, &contract_id);
    let token_client = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    
    let goal = 100_0000000;
    let deadline = env.ledger().timestamp() + 1000;
    
    client.create_campaign(&creator, &token_id, &goal, &deadline);
    
    let donor = Address::generate(&env);
    token_admin_client.mint(&donor, &100_0000000);
    client.donate(&donor, &100_0000000);
    
    env.ledger().with_mut(|li| {
        li.timestamp = deadline + 1;
    });
    
    client.withdraw(&creator);
    assert_eq!(token_client.balance(&creator), 100_0000000);
    assert_eq!(token_client.balance(&contract_id), 0);
}
