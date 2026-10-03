#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Env, String};

#[test]
fn test_register_and_get_campaigns() {
    let env = Env::default();
    let contract_id = env.register(ProjectFactory, ());
    let client = ProjectFactoryClient::new(&env, &contract_id);

    let creator1 = Address::generate(&env);
    let campaign1 = Address::generate(&env);
    let title1 = String::from_str(&env, "First Campaign");

    // Mock creator's authorization
    env.mock_all_auths();

    // Register first campaign
    client.register_campaign(&creator1, &campaign1, &title1);

    // Verify it is in the list
    let all_campaigns = client.get_all_campaigns(&0, &10);
    assert_eq!(all_campaigns.len(), 1);
    assert_eq!(all_campaigns.get(0).unwrap(), campaign1);

    // Verify metadata
    let meta = client.get_campaign_metadata(&campaign1);
    assert_eq!(meta.creator, creator1);
    assert_eq!(meta.title, title1);

    // Register second campaign
    let creator2 = Address::generate(&env);
    let campaign2 = Address::generate(&env);
    let title2 = String::from_str(&env, "Second Campaign");
    client.register_campaign(&creator2, &campaign2, &title2);

    let all_campaigns = client.get_all_campaigns(&0, &10);
    assert_eq!(all_campaigns.len(), 2);
    assert_eq!(all_campaigns.get(1).unwrap(), campaign2);
}

#[test]
#[should_panic(expected = "Campaign already registered")]
fn test_register_duplicate_campaign() {
    let env = Env::default();
    let contract_id = env.register(ProjectFactory, ());
    let client = ProjectFactoryClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let campaign = Address::generate(&env);
    let title = String::from_str(&env, "My Campaign");

    env.mock_all_auths();

    // First registration succeeds
    client.register_campaign(&creator, &campaign, &title);
    
    // Second registration of the same campaign fails
    client.register_campaign(&creator, &campaign, &title);
}
