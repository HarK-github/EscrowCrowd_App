#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token, Address, Env,
};

fn create_token_contract<'a>(
    env: &Env,
    admin: &Address,
) -> (token::Client<'a>, token::StellarAssetClient<'a>) {
    let contract_address = env.register_stellar_asset_contract_v2(admin.clone()).address();
    (
        token::Client::new(env, &contract_address),
        token::StellarAssetClient::new(env, &contract_address),
    )
}

#[test]
fn test_deposit_and_lock() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(FlexEscrowContract, ());
    let client = FlexEscrowContractClient::new(&env, &contract_id);

    let subscriber = Address::generate(&env);
    let vendor = Address::generate(&env);
    let operator = Address::generate(&env);
    let token_admin = Address::generate(&env);

    let (token_client, token_admin_client) = create_token_contract(&env, &token_admin);
    let total_deposit = 100_000_000i128; // 10 XLM
    let duration_sec = 100u64;

    token_admin_client.mint(&subscriber, &total_deposit);

    let stream_id = client.deposit_and_lock(
        &subscriber,
        &vendor,
        &operator,
        &duration_sec,
        &token_client.address,
        &total_deposit,
    );

    assert_eq!(stream_id, 1);
    assert_eq!(token_client.balance(&contract_id), total_deposit);
    assert_eq!(token_client.balance(&subscriber), 0);

    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.subscriber, subscriber);
    assert_eq!(stream.vendor, vendor);
    assert_eq!(stream.operator, operator);
    assert_eq!(stream.total_deposit, total_deposit);
    assert_eq!(stream.duration_sec, duration_sec);
    assert_eq!(stream.rate_per_sec, 1_000_000);
    assert_eq!(stream.settled_amount, 0);
    assert_eq!(stream.status, StreamStatus::Active);
}

#[test]
fn test_settle_stream_accrual() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(FlexEscrowContract, ());
    let client = FlexEscrowContractClient::new(&env, &contract_id);

    let subscriber = Address::generate(&env);
    let vendor = Address::generate(&env);
    let operator = Address::generate(&env);
    let token_admin = Address::generate(&env);

    let (token_client, token_admin_client) = create_token_contract(&env, &token_admin);
    let total_deposit = 100_000_000i128;
    let duration_sec = 100u64;

    token_admin_client.mint(&subscriber, &total_deposit);

    let stream_id = client.deposit_and_lock(
        &subscriber,
        &vendor,
        &operator,
        &duration_sec,
        &token_client.address,
        &total_deposit,
    );

    // Fast-forward ledger timestamp by 40 seconds
    let start_time = env.ledger().timestamp();
    env.ledger().set_timestamp(start_time + 40);

    // Max claimable is 40 * 1_000_000 = 40_000_000
    // Settle 25_000_000
    client.settle_stream(&operator, &stream_id, &25_000_000);

    assert_eq!(token_client.balance(&vendor), 25_000_000);
    assert_eq!(token_client.balance(&contract_id), 75_000_000);

    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.settled_amount, 25_000_000);
    assert_eq!(stream.status, StreamStatus::Active);
}

#[test]
#[should_panic(expected = "claim_amount exceeds accrued ceiling")]
fn test_settle_stream_exceeds_ceiling_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(FlexEscrowContract, ());
    let client = FlexEscrowContractClient::new(&env, &contract_id);

    let subscriber = Address::generate(&env);
    let vendor = Address::generate(&env);
    let operator = Address::generate(&env);
    let token_admin = Address::generate(&env);

    let (token_client, token_admin_client) = create_token_contract(&env, &token_admin);
    let total_deposit = 100_000_000i128;
    let duration_sec = 100u64;

    token_admin_client.mint(&subscriber, &total_deposit);

    let stream_id = client.deposit_and_lock(
        &subscriber,
        &vendor,
        &operator,
        &duration_sec,
        &token_client.address,
        &total_deposit,
    );

    // Fast forward 10 seconds (max claimable is 10_000_000)
    let start_time = env.ledger().timestamp();
    env.ledger().set_timestamp(start_time + 10);

    // Attempting to claim 15_000_000 must panic
    client.settle_stream(&operator, &stream_id, &15_000_000);
}

#[test]
fn test_remainder_dust_fix_at_full_duration() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(FlexEscrowContract, ());
    let client = FlexEscrowContractClient::new(&env, &contract_id);

    let subscriber = Address::generate(&env);
    let vendor = Address::generate(&env);
    let operator = Address::generate(&env);
    let token_admin = Address::generate(&env);

    let (token_client, token_admin_client) = create_token_contract(&env, &token_admin);
    // 1000 stroops over 3 seconds => rate_per_sec = 333 (dust = 1 stroop)
    let total_deposit = 1000i128;
    let duration_sec = 3u64;

    token_admin_client.mint(&subscriber, &total_deposit);

    let stream_id = client.deposit_and_lock(
        &subscriber,
        &vendor,
        &operator,
        &duration_sec,
        &token_client.address,
        &total_deposit,
    );

    // Fast-forward past duration
    let start_time = env.ledger().timestamp();
    env.ledger().set_timestamp(start_time + 5);

    // Settle entire deposit (1000 stroops)
    client.settle_stream(&operator, &stream_id, &1000);

    assert_eq!(token_client.balance(&vendor), 1000);
    assert_eq!(token_client.balance(&contract_id), 0);

    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.settled_amount, 1000);
    assert_eq!(stream.status, StreamStatus::Settled);
}

#[test]
fn test_pull_refund_emergency_escape() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(FlexEscrowContract, ());
    let client = FlexEscrowContractClient::new(&env, &contract_id);

    let subscriber = Address::generate(&env);
    let vendor = Address::generate(&env);
    let operator = Address::generate(&env);
    let token_admin = Address::generate(&env);

    let (token_client, token_admin_client) = create_token_contract(&env, &token_admin);
    let total_deposit = 100_000_000i128;
    let duration_sec = 100u64;

    token_admin_client.mint(&subscriber, &total_deposit);

    let stream_id = client.deposit_and_lock(
        &subscriber,
        &vendor,
        &operator,
        &duration_sec,
        &token_client.address,
        &total_deposit,
    );

    // Settle 30_000_000 first
    let start_time = env.ledger().timestamp();
    env.ledger().set_timestamp(start_time + 30);
    client.settle_stream(&operator, &stream_id, &30_000_000);

    // Subscriber pulls refund of remaining 70_000_000
    client.pull_refund(&subscriber, &stream_id);

    assert_eq!(token_client.balance(&subscriber), 70_000_000);
    assert_eq!(token_client.balance(&vendor), 30_000_000);
    assert_eq!(token_client.balance(&contract_id), 0);

    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.status, StreamStatus::Refunded);
}
